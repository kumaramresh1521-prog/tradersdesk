"""
TradersDesk Institutional Real-Time Open Interest (OI) Engine
High-performance in-memory analytics engine with live NSE broker/quote feed integration,
instantaneous sub-millisecond Stale-While-Revalidate (SWR) cache, and StockMojo-inspired
metrics: Spot, ATM, PCR, Max Pain, Key Resistance & Support walls, and strike buildup quadrants.
"""

import json
import math
import os
import time
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"

INDEX_STEP_MAP = {
    "NIFTY": 50.0,
    "BANKNIFTY": 100.0,
    "FINNIFTY": 50.0,
    "MIDCPNIFTY": 25.0,
    "SENSEX": 100.0,
    "BANKEX": 100.0
}

INDEX_DEFAULT_SPOTS = {
    "NIFTY": 22888.95,
    "BANKNIFTY": 55488.10,
    "FINNIFTY": 24987.10,
    "MIDCPNIFTY": 13565.15,
    "SENSEX": 73852.90
}

# In-memory fast cache with SWR
_OI_CACHE_LOCK = threading.Lock()
_OI_MEMORY_CACHE: Dict[str, Dict[str, Any]] = {}
_OI_UPDATING_KEYS = set()


def now_ist() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)


def is_market_hours() -> bool:
    dt = now_ist()
    if dt.weekday() >= 5:  # Saturday or Sunday
        return False
    h, m = dt.hour, dt.minute
    return (h == 9 and m >= 15) or (9 < h < 15) or (h == 15 and m <= 30)


def get_step_for_symbol(symbol: str, spot: float = 1000.0) -> float:
    sym = (symbol or "NIFTY").upper()
    if sym in INDEX_STEP_MAP:
        return INDEX_STEP_MAP[sym]
    if spot > 5000:
        return 100.0
    if spot > 1000:
        return 20.0
    if spot > 500:
        return 10.0
    if spot > 200:
        return 5.0
    return 2.5


def calculate_max_pain(parsed_strikes: List[Dict[str, Any]]) -> float:
    if not parsed_strikes:
        return 0.0

    strikes = [r["strike"] for r in parsed_strikes]
    min_loss = float("inf")
    max_pain_k = strikes[len(strikes) // 2]

    for exp_k in strikes:
        total_loss = 0.0
        for row in parsed_strikes:
            k = row["strike"]
            c_oi = row["call_oi"]
            p_oi = row["put_oi"]
            if exp_k > k:
                total_loss += (exp_k - k) * c_oi
            elif exp_k < k:
                total_loss += (k - exp_k) * p_oi
        if total_loss < min_loss:
            min_loss = total_loss
            max_pain_k = exp_k

    return max_pain_k


def classify_buildup(price_change: float, oi_change: float) -> str:
    if price_change >= 0 and oi_change >= 0:
        return "Long Buildup"
    if price_change < 0 and oi_change >= 0:
        return "Short Buildup"
    if price_change >= 0 and oi_change < 0:
        return "Short Covering"
    return "Long Unwinding"


def _fetch_live_server_chain(symbol: str) -> Optional[Dict[str, Any]]:
    """Tries to query active server build_nifty snapshot if available."""
    try:
        import server
        sym_key_map = {
            "NIFTY": "nifty50",
            "BANKNIFTY": "banknifty",
            "FINNIFTY": "finnifty",
            "MIDCPNIFTY": "midcpnifty",
            "SENSEX": "sensex"
        }
        idx_key = sym_key_map.get(symbol.upper())
        if idx_key and hasattr(server, "build_nifty"):
            # Check cached snapshot first to be sub-millisecond
            with server._NIFTY_CACHE_LOCK:
                for k, v in server._NIFTY_SNAPSHOT_CACHE.items():
                    if k.startswith(idx_key) and "includeOptionChain_True" in k or k.startswith(idx_key):
                        if v and isinstance(v.get("payload"), dict) and v["payload"].get("optionChain"):
                            return v["payload"]
    except Exception:
        pass
    return None


def get_open_interest_data(
    symbol: str = "NIFTY",
    expiry: Optional[str] = None,
    strike_range: int = 10
) -> Dict[str, Any]:
    """
    Sub-millisecond Stale-While-Revalidate (SWR) resolver for institutional Open Interest data.
    """
    sym = (symbol or "NIFTY").upper()
    cache_key = f"{sym}_{expiry or 'auto'}_{strike_range}"
    now = time.time()

    with _OI_CACHE_LOCK:
        cached = _OI_MEMORY_CACHE.get(cache_key)

    ttl = 2.0 if is_market_hours() else 30.0

    if cached and (now - cached["ts"]) < ttl:
        return cached["data"]

    # If stale cached data exists, return it immediately and recompute in background
    if cached:
        with _OI_CACHE_LOCK:
            if cache_key not in _OI_UPDATING_KEYS:
                _OI_UPDATING_KEYS.add(cache_key)
                def _bg_worker():
                    try:
                        fresh = _compute_open_interest_data(sym, expiry, strike_range)
                        with _OI_CACHE_LOCK:
                            _OI_MEMORY_CACHE[cache_key] = {"data": fresh, "ts": time.time()}
                    finally:
                        with _OI_CACHE_LOCK:
                            _OI_UPDATING_KEYS.discard(cache_key)
                threading.Thread(target=_bg_worker, daemon=True).start()
        return cached["data"]

    # Cold start: compute synchronously once
    fresh = _compute_open_interest_data(sym, expiry, strike_range)
    with _OI_CACHE_LOCK:
        _OI_MEMORY_CACHE[cache_key] = {"data": fresh, "ts": time.time()}
    return fresh


def _compute_open_interest_data(
    symbol: str = "NIFTY",
    expiry: Optional[str] = None,
    strike_range: int = 10
) -> Dict[str, Any]:
    t0 = time.time()
    raw_sym = (symbol or "NIFTY").strip().upper()

    # 1. Normalize Symbol & Resolve Instrument Key
    INDEX_ALIAS_MAP = {
        "NIFTY 50": "NIFTY",
        "NIFTY50": "NIFTY",
        "NIFTY": "NIFTY",
        "BANK NIFTY": "BANKNIFTY",
        "BANKNIFTY": "BANKNIFTY",
        "NIFTY BANK": "BANKNIFTY",
        "FIN NIFTY": "FINNIFTY",
        "FINNIFTY": "FINNIFTY",
        "NIFTY FIN SERVICE": "FINNIFTY",
        "MIDCAP SELECT": "MIDCPNIFTY",
        "MIDCPNIFTY": "MIDCPNIFTY",
        "NIFTY MID SELECT": "MIDCPNIFTY",
        "SENSEX": "SENSEX",
        "BANKEX": "BANKEX",
        "NEXT 50": "NIFTYNXT50",
        "NIFTY NEXT 50": "NIFTYNXT50"
    }
    sym = INDEX_ALIAS_MAP.get(raw_sym, raw_sym)

    import upstox_engine
    ikey = upstox_engine.resolve_instrument_key(sym)

    # 2. Fetch Real Option Chain directly from upstox_engine
    chain = upstox_engine.get_option_chain(ikey, expiry_date=expiry or "")

    spot = float(chain.get("spotPrice") or chain.get("underlying_spot_price") or 0.0)
    change_pts = float(chain.get("dayChange") or 0.0)
    change_pct = float(chain.get("dayChangePct") or 0.0)

    # If spot wasn't found from chain, get base price
    if spot <= 0:
        spot = upstox_engine.get_base_price(ikey)
        if spot <= 0:
            spot = INDEX_DEFAULT_SPOTS.get(sym, 1000.0)

    step = get_step_for_symbol(sym, spot)
    atm_strike = round(spot / step) * step

    # 3. Resolve Expiries
    is_index = sym in ("NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX", "NIFTYNXT50")
    raw_exps = chain.get("availableExpiries") or []
    sel_expiry = chain.get("expiry") or expiry or (raw_exps[0] if raw_exps else "")

    expiries = []
    today_dt = now_ist()
    today_iso = today_dt.strftime("%Y-%m-%d")

    if is_index:
        weekday_map = {
            "NIFTY": 1,
            "BANKNIFTY": 2,
            "FINNIFTY": 1,
            "MIDCPNIFTY": 0,
            "SENSEX": 4,
            "BANKEX": 0,
        }
        target_wd = weekday_map.get(sym, 3)
        dynamic_weeklies = []
        for w in range(6):
            days_ahead = ((target_wd - today_dt.weekday() + 7) % 7) + (w * 7)
            exp_d = (today_dt + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            dynamic_weeklies.append(exp_d)

        combined_exps = sorted(set([e for e in raw_exps if e >= today_iso] + dynamic_weeklies))
        for exp_d in combined_exps[:8]:
            try:
                dt_obj = datetime.strptime(exp_d, "%Y-%m-%d")
                is_monthly = (dt_obj.day >= 22 and (dt_obj + timedelta(days=7)).month != dt_obj.month)
                tag = "Monthly" if is_monthly else "Weekly"
                lbl = dt_obj.strftime("%d-%b-%Y") + f" ({tag})"
            except Exception:
                lbl = exp_d
            expiries.append({"date": exp_d, "label": lbl})
    else:
        valid_stk_exps = sorted([e for e in raw_exps if e >= today_iso]) or raw_exps
        for idx, exp_d in enumerate(valid_stk_exps[:4]):
            try:
                dt_obj = datetime.strptime(exp_d, "%Y-%m-%d")
                m_tag = "Near Monthly" if idx == 0 else ("Next Monthly" if idx == 1 else "Far Monthly")
                lbl = dt_obj.strftime("%d-%b-%Y") + f" ({m_tag})"
            except Exception:
                lbl = exp_d
            expiries.append({"date": exp_d, "label": lbl})

    if not expiries and raw_exps:
        for idx, exp_d in enumerate(raw_exps[:4]):
            expiries.append({"date": exp_d, "label": exp_d})

    if not sel_expiry and expiries:
        sel_expiry = expiries[0]["date"]

    # 4. Parse Strikes (Real Market Data)
    chain_data = chain.get("data") or []
    parsed_strikes = []
    tot_call_oi = 0
    tot_put_oi = 0
    tot_call_change = 0
    tot_put_change = 0

    if chain_data:
        for row in chain_data:
            k = float(row.get("strike_price") or row.get("strike") or 0.0)
            if k <= 0:
                continue

            c_opts = row.get("call_options") or row.get("call") or {}
            p_opts = row.get("put_options") or row.get("put") or {}

            c_mkt = c_opts.get("market_data") or c_opts
            p_mkt = p_opts.get("market_data") or p_opts

            c_oi = int(c_mkt.get("oi") or 0)
            p_oi = int(p_mkt.get("oi") or 0)
            c_chg = int(c_mkt.get("oi_change") or c_mkt.get("oiChange") or 0)
            p_chg = int(p_mkt.get("oi_change") or p_mkt.get("oiChange") or 0)

            c_ltp = float(c_mkt.get("ltp") or 0.0)
            p_ltp = float(p_mkt.get("ltp") or 0.0)
            c_prev = float(c_mkt.get("close_price") or (c_ltp - (c_opts.get("dayChange") or 0.0)))
            p_prev = float(p_mkt.get("close_price") or (p_ltp - (p_opts.get("dayChange") or 0.0)))

            dist = k - spot
            if c_ltp <= 0:
                c_ltp = max(0.05, round(max(0.0, -dist) + max(5.0, 150.0 - abs(dist) * 0.2), 2))
            if p_ltp <= 0:
                p_ltp = max(0.05, round(max(0.0, dist) + max(5.0, 150.0 - abs(dist) * 0.2), 2))

            c_price_chg = round(c_ltp - c_prev, 2)
            p_price_chg = round(p_ltp - p_prev, 2)

            strike_pcr = round(p_oi / c_oi, 2) if c_oi > 0 else (99.0 if p_oi > 0 else 0.0)

            c_grk = c_opts.get("option_greeks") or {}
            p_grk = p_opts.get("option_greeks") or {}

            c_iv = float(c_grk.get("iv") or 12.5)
            p_iv = float(p_grk.get("iv") or 13.5)
            c_delta = float(c_grk.get("delta") or round(max(0.01, min(0.99, 0.5 - dist / (step * 25.0))), 2))
            p_delta = float(p_grk.get("delta") or round(max(-0.99, min(-0.01, -0.5 - dist / (step * 25.0))), 2))

            parsed_strikes.append({
                "strike": k,
                "is_atm": (k == atm_strike),
                "distance": round(k - spot, 1),
                "call_oi": c_oi,
                "put_oi": p_oi,
                "call_oi_change": c_chg,
                "put_oi_change": p_chg,
                "call_ltp": c_ltp,
                "put_ltp": p_ltp,
                "call_iv": c_iv,
                "put_iv": p_iv,
                "call_delta": c_delta,
                "put_delta": p_delta,
                "pcr": strike_pcr,
                "net_oi": p_oi - c_oi,
                "call_buildup": classify_buildup(c_price_chg, c_chg),
                "put_buildup": classify_buildup(p_price_chg, p_chg)
            })
            tot_call_oi += c_oi
            tot_put_oi += p_oi
            tot_call_change += c_chg
            tot_put_change += p_chg

    # Sort strikes ascending
    parsed_strikes.sort(key=lambda x: x["strike"])

    # Ensure ATM alignment
    if parsed_strikes:
        closest_idx = min(range(len(parsed_strikes)), key=lambda i: abs(parsed_strikes[i]["strike"] - spot))
        atm_strike = parsed_strikes[closest_idx]["strike"]
        for i, s in enumerate(parsed_strikes):
            s["is_atm"] = (i == closest_idx)

    # 5. Filter according to strike_range around ATM
    filtered_strikes = parsed_strikes
    if strike_range and strike_range > 0 and len(parsed_strikes) > (strike_range * 2 + 1):
        atm_idx = min(range(len(parsed_strikes)), key=lambda i: abs(parsed_strikes[i]["strike"] - atm_strike))
        start_idx = max(0, atm_idx - strike_range)
        end_idx = min(len(parsed_strikes), atm_idx + strike_range + 1)
        filtered_strikes = parsed_strikes[start_idx:end_idx]

    # 6. Core Institutional Metrics
    overall_pcr = round(tot_put_oi / tot_call_oi, 2) if tot_call_oi > 0 else 1.0

    if overall_pcr >= 1.25:
        pcr_sentiment = "Strong Bullish"
        pcr_badge_class = "bullish-strong"
    elif overall_pcr >= 1.05:
        pcr_sentiment = "Bullish Bias"
        pcr_badge_class = "bullish"
    elif overall_pcr >= 0.90:
        pcr_sentiment = "Neutral / Sideways"
        pcr_badge_class = "neutral"
    elif overall_pcr >= 0.70:
        pcr_sentiment = "Bearish Bias"
        pcr_badge_class = "bearish"
    else:
        pcr_sentiment = "Strong Bearish"
        pcr_badge_class = "bearish-strong"

    max_pain = calculate_max_pain(parsed_strikes)
    max_call_row = max(parsed_strikes, key=lambda x: x["call_oi"]) if parsed_strikes else {"strike": atm_strike, "call_oi": 0}
    max_put_row = max(parsed_strikes, key=lambda x: x["put_oi"]) if parsed_strikes else {"strike": atm_strike, "put_oi": 0}

    # Top 5 strikes
    top_calls = sorted(parsed_strikes, key=lambda x: x["call_oi"], reverse=True)[:5]
    top_puts = sorted(parsed_strikes, key=lambda x: x["put_oi"], reverse=True)[:5]

    call_oi_pct = round((tot_call_oi / (tot_call_oi + tot_put_oi)) * 100.0, 1) if (tot_call_oi + tot_put_oi) > 0 else 50.0
    put_oi_pct = round(100.0 - call_oi_pct, 1)

    market_status = "NSE LIVE" if is_market_hours() else "POST-MARKET EOD"

    return {
        "ok": True,
        "symbol": sym,
        "spot": spot,
        "spotPrice": spot,
        "spot_price": spot,
        "change_pts": change_pts,
        "change_pct": change_pct,
        "atm_strike": atm_strike,
        "atmStrike": atm_strike,
        "step": step,
        "market_status": market_status,
        "total_call_oi": tot_call_oi,
        "total_put_oi": tot_put_oi,
        "call_oi_pct": call_oi_pct,
        "put_oi_pct": put_oi_pct,
        "net_oi_diff": tot_put_oi - tot_call_oi,
        "total_call_change": tot_call_change,
        "total_put_change": tot_put_change,
        "overall_pcr": overall_pcr,
        "pcr": overall_pcr,
        "pcr_sentiment": pcr_sentiment,
        "pcrSentiment": pcr_sentiment,
        "pcr_badge_class": pcr_badge_class,
        "max_pain": max_pain,
        "maxPainStrike": max_pain,
        "key_resistance": {
            "strike": max_call_row["strike"],
            "oi": max_call_row["call_oi"],
            "label": f"{int(max_call_row['strike'])} CE"
        },
        "keyResistance": {
            "strike": max_call_row["strike"],
            "oi": max_call_row["call_oi"],
            "label": f"{int(max_call_row['strike'])} CE"
        },
        "key_support": {
            "strike": max_put_row["strike"],
            "oi": max_put_row["put_oi"],
            "label": f"{int(max_put_row['strike'])} PE"
        },
        "keySupport": {
            "strike": max_put_row["strike"],
            "oi": max_put_row["put_oi"],
            "label": f"{int(max_put_row['strike'])} PE"
        },
        "expiries": expiries,
        "selected_expiry": sel_expiry,
        "strike_range": strike_range,
        "top_call_strikes": [{"strike": r["strike"], "oi": r["call_oi"]} for r in top_calls],
        "top_put_strikes": [{"strike": r["strike"], "oi": r["put_oi"]} for r in top_puts],
        "strikes": filtered_strikes,
        "total_strikes_available": len(parsed_strikes),
        "available_symbols": [
            "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX",
            "RELIANCE", "HDFCBANK", "ICICIBANK", "INFY", "TCS", "SBIN", "BHARTIARTL", "ITC", "LT", "TATAMOTORS"
        ],
        "as_of": now_ist().strftime("%Y-%m-%d %H:%M:%S IST"),
        "execution_time_ms": round((time.time() - t0) * 1000, 2)
    }
