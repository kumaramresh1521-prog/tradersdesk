"""
snapshot_engine.py
TradersDesk 90-Days Daily Market & Tools Snapshot Engine
Captures, persists to Supabase, queries, and purges daily snapshots across:
- Options (Option Chain Pro, Call vs Put, Multi-Strike OI)
- Straddle / Strangle Matrix (ATM Straddle, Decay, IV, Range)
- Smart Money (FII / DII Cash Net Flow & Participant OI)
- Delivery Desk Analytics (High Delivery %, Volume Surge Toppers)
- MTF Margin Financing Desk
- Market Breadth & Contribution
"""

from __future__ import annotations
import json
import time
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List, Optional
from pathlib import Path

import supabase_engine

ROOT = Path(__file__).resolve().parent

# Local in-memory cache for ultra-fast repeated loads (0ms latency)
_SNAPSHOT_CACHE: Dict[str, Dict[str, Any]] = {}
_SNAPSHOT_CACHE_TS: Dict[str, float] = {}
_CACHE_TTL = 300.0  # 5 minutes in-memory cache


def get_ist_today_str() -> str:
    """Returns today's date in IST as YYYY-MM-DD."""
    utc_now = datetime.now(timezone.utc)
    ist_now = utc_now + timedelta(hours=5, minutes=30)
    return ist_now.strftime("%Y-%m-%d")


# Target instruments for full EOD options snapshot: 6 Major Indices + 10 Liquid F&O Heavyweights
PRIMARY_OPTIONS_INSTRUMENTS = [
    # 6 Core Major Indices
    {"key": "NSE_INDEX|Nifty 50", "aliases": ["NIFTY", "NIFTY 50", "nifty"]},
    {"key": "NSE_INDEX|Nifty Bank", "aliases": ["BANKNIFTY", "NIFTY BANK", "banknifty"]},
    {"key": "NSE_INDEX|Nifty Fin Service", "aliases": ["FINNIFTY", "FIN NIFTY", "finnifty"]},
    {"key": "NSE_INDEX|NIFTY MID SELECT", "aliases": ["MIDCPNIFTY", "MIDCAP NIFTY", "midcpnifty"]},
    {"key": "BSE_INDEX|SENSEX", "aliases": ["SENSEX", "sensex"]},
    {"key": "BSE_INDEX|BANKEX", "aliases": ["BANKEX", "bankex"]},
    # Top 10 Liquid F&O Market Heavyweights
    {"key": "NSE_EQ|RELIANCE", "aliases": ["RELIANCE", "reliance"]},
    {"key": "NSE_EQ|HDFCBANK", "aliases": ["HDFCBANK", "hdfcbank"]},
    {"key": "NSE_EQ|ICICIBANK", "aliases": ["ICICIBANK", "icicibank"]},
    {"key": "NSE_EQ|SBIN", "aliases": ["SBIN", "sbin"]},
    {"key": "NSE_EQ|TCS", "aliases": ["TCS", "tcs"]},
    {"key": "NSE_EQ|INFY", "aliases": ["INFY", "infy"]},
    {"key": "NSE_EQ|TATAMOTORS", "aliases": ["TATAMOTORS", "tatamotors"]},
    {"key": "NSE_EQ|BHARTIARTL", "aliases": ["BHARTIARTL", "bhartiartl"]},
    {"key": "NSE_EQ|ITC", "aliases": ["ITC", "itc"]},
    {"key": "NSE_EQ|LT", "aliases": ["LT", "lt"]},
]


def _compact_option_chain(raw_chain: dict, instrument_key: str) -> dict:
    """Extracts compact, high-density strikes and greeks for a single instrument option chain."""
    if not raw_chain or not isinstance(raw_chain, dict):
        return {}

    strikes_list = raw_chain.get("data") or raw_chain.get("strikes") or []
    compact_strikes = []
    for s in strikes_list[:40]:  # Up to 40 active strikes around ATM
        if isinstance(s, dict):
            sp = float(s.get("strike_price") or s.get("strikePrice") or 0.0)
            compact_strikes.append({
                "strike_price": sp,
                "strikePrice": sp,
                "pcr": float(s.get("pcr") or 0.0),
                "expiry": s.get("expiry") or raw_chain.get("expiry"),
                "call_options": s.get("call_options") or {
                    "market_data": {
                        "ltp": float(s.get("callLtp") or 0.0),
                        "oi": int(s.get("callOi") or 0),
                        "oi_change": int(s.get("callOiChg") or 0),
                        "volume": int(s.get("callVolume") or 0),
                    },
                    "option_greeks": s.get("callGreeks") or {"iv": float(s.get("callIv") or 0.0)},
                },
                "put_options": s.get("put_options") or {
                    "market_data": {
                        "ltp": float(s.get("putLtp") or 0.0),
                        "oi": int(s.get("putOi") or 0),
                        "oi_change": int(s.get("putOiChg") or 0),
                        "volume": int(s.get("putVolume") or 0),
                    },
                    "option_greeks": s.get("putGreeks") or {"iv": float(s.get("putIv") or 0.0)},
                },
                "quant_metrics": s.get("quant_metrics", {}),
            })

    und_name = raw_chain.get("underlying") or instrument_key.split("|")[-1]
    return {
        "instrumentKey": raw_chain.get("instrumentKey") or instrument_key,
        "underlying": und_name,
        "spotPrice": raw_chain.get("spotPrice") or raw_chain.get("spot"),
        "expiry": raw_chain.get("expiry"),
        "availableExpiries": (raw_chain.get("availableExpiries") or [])[:6],
        "pcr": raw_chain.get("pcr"),
        "maxPain": raw_chain.get("maxPain"),
        "atmStrike": raw_chain.get("atmStrike"),
        "atmStraddle": raw_chain.get("atmStraddle"),
        "indiaVix": raw_chain.get("indiaVix"),
        "totalCeOi": raw_chain.get("totalCeOi"),
        "totalPeOi": raw_chain.get("totalPeOi"),
        "totalCeOiChange": raw_chain.get("totalCeOiChange"),
        "totalPeOiChange": raw_chain.get("totalPeOiChange"),
        "strikes": compact_strikes,
    }


def build_options_snapshot(underlying: str = "NSE_INDEX|Nifty 50") -> dict:
    """
    Builds clean options snapshot with multi-instrument coverage:
    - 6 core major indices (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX, BANKEX)
    - Top liquid F&O stocks (RELIANCE, HDFCBANK, ICICIBANK, SBIN, TCS, INFY, TATAMOTORS, BHARTIARTL, ITC, LT)
    Maintains 100% backward compatibility by keeping Nifty 50 at root, while providing 'instruments' map.
    """
    try:
        import upstox_engine
    except Exception as e:
        print(f"[SnapshotEngine] upstox_engine import error: {e}")
        return {}

    instruments_map = {}
    primary_snap = {}

    for inst in PRIMARY_OPTIONS_INSTRUMENTS:
        key = inst["key"]
        try:
            raw = upstox_engine.get_option_chain(key)
            if raw and isinstance(raw, dict) and (raw.get("ok") or raw.get("spotPrice") or raw.get("data") or raw.get("strikes")):
                compact = _compact_option_chain(raw, key)
                instruments_map[key] = compact

                # Also map by actual normalized key if different (e.g. Upstox ISIN for stocks)
                actual_k = compact.get("instrumentKey")
                if actual_k and actual_k != key:
                    instruments_map[actual_k] = compact

                # Also map aliases for instant lookup
                for alias in inst.get("aliases", []):
                    instruments_map[alias] = compact
                    instruments_map[alias.lower()] = compact

                if key == "NSE_INDEX|Nifty 50":
                    primary_snap = compact
        except Exception as e:
            print(f"[SnapshotEngine] Failed fetching option chain for {key}: {e}")

    # Fallback if primary wasn't captured
    if not primary_snap and instruments_map:
        primary_snap = next(iter(instruments_map.values()))

    res = dict(primary_snap)
    res["instruments"] = instruments_map
    res["instrument_keys"] = [inst["key"] for inst in PRIMARY_OPTIONS_INSTRUMENTS if inst["key"] in instruments_map]
    return res


def build_straddle_snapshot() -> dict:
    """Builds clean ATM Straddle & Strangle snapshot for all 6 dropdown indices including full 370-min intraday points."""
    res = {}
    try:
        from server import get_straddle_chart_response
        indices = ("NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX")
        for idx in indices:
            try:
                st = get_straddle_chart_response({"symbol": idx})
                if st and isinstance(st, dict) and st.get("ok"):
                    latest = st.get("latest") or {}
                    st_data = {
                        "symbol": idx,
                        "spotPrice": latest.get("spot"),
                        "atmStrike": latest.get("straddle_strike") or st.get("atm_strike"),
                        "combinedPremium": latest.get("straddle_price"),
                        "callLtp": latest.get("ce_price"),
                        "putLtp": latest.get("pe_price"),
                        "decayPoints": latest.get("decay_pts") or 0.0,
                        "decayPct": latest.get("decay_pct") or 0.0,
                        "iv": (latest.get("greeks") or {}).get("iv") or 13.5,
                        "rangeLower": latest.get("lower_breakeven"),
                        "rangeUpper": latest.get("upper_breakeven"),
                        "expiry": st.get("expiry"),
                        "greeks": latest.get("greeks", {}),
                        "available_expiries": st.get("available_expiries", []),
                        "available_strikes": st.get("available_strikes", []),
                        "strikes_data": st.get("strikes_data", {}),
                        "latest": latest,
                        "points": st.get("points", []),
                    }
                    res[idx.lower()] = st_data
                    res[idx.upper()] = st_data
            except Exception as ex_idx:
                print(f"[SnapshotEngine] Straddle snapshot error for {idx}: {ex_idx}")
    except Exception as e:
        print(f"[SnapshotEngine] Straddle snapshot error: {e}")
    return res


def build_smart_money_snapshot(trade_date: str) -> dict:
    """Gathers FII/DII cash net flow, derivatives flow, and participant OI matrix."""
    try:
        from server import build_smart_money
        sm = build_smart_money({"date": trade_date})
        if not sm or not isinstance(sm, dict):
            return {}
        return {
            "date": sm.get("date") or trade_date,
            "asOf": sm.get("asOf") or trade_date,
            "cashFlow": sm.get("cashFlow", {}),
            "derivativesFlow": sm.get("derivativesFlow", {}),
            "participants": sm.get("participants", []),
            "fiiMetrics": sm.get("fiiMetrics", {}),
            "trapRadar": sm.get("trapRadar", {}),
            "gameplan": sm.get("gameplan", {}),
            "majorIndicesDelivery": sm.get("majorIndicesDelivery", {}),
            "history": (sm.get("history") or [])[-15:],
        }
    except Exception as e:
        print(f"[SnapshotEngine] Smart money snapshot error: {e}")
        return {}


def build_delivery_snapshot(trade_date: str) -> dict:
    """Gathers top delivery percentage and volume surge stocks."""
    try:
        from server import build_delivery_analytics
        deliv = build_delivery_analytics({"date": trade_date})
        if not deliv or not isinstance(deliv, dict):
            return {}
        stocks = deliv.get("stocks") or []
        # Compact top 60 stocks sorted by delivery turnover / %
        top_stocks = []
        for s in stocks[:60]:
            if isinstance(s, dict):
                top_stocks.append({
                    "symbol": s.get("symbol"),
                    "close": s.get("close") or s.get("ltp"),
                    "changePct": s.get("changePct") or s.get("pChg"),
                    "deliveryPct": s.get("deliveryPct"),
                    "avgDeliveryPct": s.get("avgDeliveryPct") or s.get("avg5dDelivPct"),
                    "deliveryQty": s.get("deliveryQty"),
                    "deliveryTurnoverCr": s.get("deliveryTurnoverCr"),
                    "surgeRatio": s.get("surgeRatio") or s.get("volumeSurgeX"),
                    "signal": s.get("signal") or s.get("category"),
                })
        return {
            "date": deliv.get("date") or trade_date,
            "summary": deliv.get("summary", {}),
            "topStocks": top_stocks,
        }
    except Exception as e:
        print(f"[SnapshotEngine] Delivery snapshot error: {e}")
        return {}


def build_mtf_snapshot(trade_date: str) -> dict:
    """Gathers MTF margin financing snapshot."""
    try:
        from server import build_mtf
        mtf = build_mtf({"date": trade_date})
        if not mtf or not isinstance(mtf, dict):
            return {}
        screened = mtf.get("stockScreener") or mtf.get("stocks") or []
        top_mtf = []
        for s in screened[:50]:
            if isinstance(s, dict):
                top_mtf.append({
                    "symbol": s.get("symbol"),
                    "financedAmountCr": s.get("financedAmountCr") or s.get("marginFundedCr"),
                    "changeCr": s.get("changeCr"),
                    "changePct": s.get("changePct"),
                    "category": s.get("category"),
                })
        return {
            "asOf": mtf.get("asOf") or trade_date,
            "summary": mtf.get("summary", {}),
            "dailyTotals": (mtf.get("dailyTotals") or [])[-10:],
            "topFundedStocks": top_mtf,
        }
    except Exception as e:
        print(f"[SnapshotEngine] MTF snapshot error: {e}")
        return {}


def build_breadth_snapshot(trade_date: str) -> dict:
    """Gathers market breadth, point contribution, and advance/decline stats across 14 market universes."""
    res = {}
    try:
        from server import get_cached_breadth_contribution
        target_universes = [
            "nifty50", "banknifty", "finnifty", "sensex", "midcpnifty",
            "niftyit", "niftyauto", "niftypharma", "niftymetal", "niftyfmcg",
            "niftyenergy", "niftymidcap100", "niftynext50"
        ]
        for idx in target_universes:
            try:
                data = get_cached_breadth_contribution(idx, trade_date)
                if data and isinstance(data, dict):
                    s = data.get("summary") or {}
                    b = data.get("breadthSummary") or {}
                    res[idx] = {
                        "ok": True,
                        "universe": idx,
                        "indexKey": data.get("indexKey") or idx,
                        "label": (data.get("indexInfo") or {}).get("name") or idx.upper(),
                        "indexInfo": data.get("indexInfo") or {},
                        "summary": s,
                        "breadthSummary": b,
                        "netPoints": s.get("netPoints", 0.0),
                        "supportingPoints": s.get("supportingPoints", 0.0),
                        "draggingPoints": s.get("draggingPoints", 0.0),
                        "advancers": s.get("supportingCount", 0),
                        "decliners": s.get("draggingCount", 0),
                        "total": s.get("totalStocks", 0),
                        "breadthPct": b.get("latestBreadth") or s.get("supportRatioPct") or 50.0,
                        "openBreadth": b.get("openBreadth", 50.0),
                        "breadthChange": b.get("change", 0.0),
                        "draggingDown": data.get("draggingDown", [])[:20],
                        "supportingUp": data.get("supportingUp", [])[:20],
                        "timeline": data.get("timeline", []),
                    }
            except Exception:
                pass
    except Exception as e:
        print(f"[SnapshotEngine] Breadth snapshot error: {e}")
    return res


def build_daily_market_snapshot(trade_date: str = "") -> dict:
    """
    Compiles complete multi-tool snapshot dictionary for a given trade date.
    Returns:
    {
      "trade_date": "YYYY-MM-DD",
      "options_data": {...},
      "straddle_data": {...},
      "open_interest_data": {...},
      "call_vs_put_data": {...},
      "smart_money_data": {...},
      "delivery_data": {...},
      "mtf_data": {...},
      "breadth_data": {...}
    }
    """
    t_date = trade_date.strip() or get_ist_today_str()

    options_snap = build_options_snapshot()
    straddle_snap = build_straddle_snapshot()
    smart_money_snap = build_smart_money_snapshot(t_date)
    delivery_snap = build_delivery_snapshot(t_date)
    mtf_snap = build_mtf_snapshot(t_date)
    breadth_snap = build_breadth_snapshot(t_date)

    # Call vs Put multi-instrument snapshot
    cvp_instruments = {}
    for k, inst in (options_snap.get("instruments") or {}).items():
        if "|" in k:
            pcr_val = float(inst.get("pcr") or 0.0)
            cvp_instruments[k] = {
                "underlying": inst.get("underlying") or k,
                "spotPrice": inst.get("spotPrice"),
                "pcr": pcr_val,
                "totalCallOi": inst.get("totalCeOi"),
                "totalPutOi": inst.get("totalPeOi"),
                "callOiChange": inst.get("totalCeOiChange"),
                "putOiChange": inst.get("totalPeOiChange"),
                "sentiment": "BULLISH" if pcr_val > 1.05 else ("BEARISH" if pcr_val < 0.85 else "NEUTRAL"),
            }

    call_vs_put_snap = {
        "pcr": options_snap.get("pcr"),
        "totalCallOi": options_snap.get("totalCeOi"),
        "totalPutOi": options_snap.get("totalPeOi"),
        "callOiChange": options_snap.get("totalCeOiChange"),
        "putOiChange": options_snap.get("totalPeOiChange"),
        "sentiment": "BULLISH" if (options_snap.get("pcr") or 0) > 1.05 else ("BEARISH" if (options_snap.get("pcr") or 0) < 0.85 else "NEUTRAL"),
        "instruments": cvp_instruments,
    }

    # Open Interest multi-instrument snapshot
    oi_instruments = {}
    for k, inst in (options_snap.get("instruments") or {}).items():
        if "|" in k:
            oi_instruments[k] = {
                "underlying": inst.get("underlying") or k,
                "spotPrice": inst.get("spotPrice"),
                "pcr": inst.get("pcr"),
                "maxPain": inst.get("maxPain"),
                "atmStrike": inst.get("atmStrike"),
                "totalCeOi": inst.get("totalCeOi"),
                "totalPeOi": inst.get("totalPeOi"),
                "totalCeOiChange": inst.get("totalCeOiChange"),
                "totalPeOiChange": inst.get("totalPeOiChange"),
                "strikesSummary": (inst.get("strikes") or [])[:20],
            }

    oi_snap = {
        "maxPain": options_snap.get("maxPain"),
        "atmStrike": options_snap.get("atmStrike"),
        "indiaVix": options_snap.get("indiaVix"),
        "strikesSummary": options_snap.get("strikes", [])[:20],
        "instruments": oi_instruments,
    }

    return {
        "trade_date": t_date,
        "options_data": options_snap,
        "straddle_data": straddle_snap,
        "open_interest_data": oi_snap,
        "call_vs_put_data": call_vs_put_snap,
        "smart_money_data": smart_money_snap,
        "delivery_data": delivery_snap,
        "mtf_data": mtf_snap,
        "breadth_data": breadth_snap,
    }


def capture_and_save_eod_snapshot(target_date: str = "") -> dict:
    """
    Main EOD Routine:
    1. Compiles full multi-tool snapshot.
    2. Upserts to Supabase table market_daily_snapshots.
    3. Purges records older than 90 days.
    """
    t0 = time.time()
    t_date = target_date.strip() or get_ist_today_str()
    print(f"[SnapshotEngine] Compiling EOD snapshot for {t_date}...")

    snapshot = build_daily_market_snapshot(t_date)
    save_res = supabase_engine.save_market_daily_snapshot(t_date, snapshot)

    # Auto-Purge older than 90 days
    purge_res = supabase_engine.purge_old_market_snapshots(retention_days=90)

    # Invalidate in-memory cache
    _SNAPSHOT_CACHE[t_date] = snapshot
    _SNAPSHOT_CACHE_TS[t_date] = time.time()

    elapsed_ms = round((time.time() - t0) * 1000, 1)
    print(f"[SnapshotEngine] Snapshot for {t_date} finished in {elapsed_ms}ms. Save: {save_res.get('ok')}, Purge: {purge_res.get('ok')}")

    return {
        "ok": save_res.get("ok", False),
        "trade_date": t_date,
        "latencyMs": elapsed_ms,
        "saveResult": save_res,
        "purgeResult": purge_res,
    }


def get_snapshot(trade_date: str) -> Optional[dict]:
    """
    Read-Through Cache:
    1. Returns from memory cache (0ms).
    2. If miss, loads from Supabase and caches in memory.
    """
    t_date = trade_date.strip()
    if not t_date:
        return None

    now = time.time()
    if t_date in _SNAPSHOT_CACHE and (now - _SNAPSHOT_CACHE_TS.get(t_date, 0)) < _CACHE_TTL:
        return _SNAPSHOT_CACHE[t_date]

    # Load from Supabase
    snap = supabase_engine.load_market_daily_snapshot(t_date)
    if snap:
        _SNAPSHOT_CACHE[t_date] = snap
        _SNAPSHOT_CACHE_TS[t_date] = now
        return snap
    return None


def get_calendar(days: int = 90) -> list[str]:
    """Returns list of all available historical snapshot dates in the last 90 days."""
    dates = supabase_engine.load_market_snapshots_calendar(days)
    today_str = get_ist_today_str()
    if today_str not in dates:
        dates.insert(0, today_str)
    return dates
