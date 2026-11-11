from __future__ import annotations

import json
import logging
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import market_calendar

logger = logging.getLogger("fii_dii_engine")

ROOT_DIR = Path(__file__).resolve().parent
HISTORY_FILE = ROOT_DIR / "data" / "fii_dii_cash_history.json"
IST = timezone(timedelta(hours=5, minutes=30))

_FII_DII_IN_MEMORY_CACHE: Dict[str, Any] = {
    "data": None,
    "timestamp": 0.0,
}
_LAST_AUTO_SYNC_DATE = ""
_LAST_NSE_FETCH_ATTEMPT_TS = 0.0
_YAHOO_NIFTY_CACHE: Dict[str, Any] = {"data": {}, "ts": 0.0}


def now_ist() -> datetime:
    return market_calendar.now_ist()


def _parse_cash_date(date_str: str) -> Optional[date]:
    raw = str(date_str or "").strip()
    if not raw:
        return None
    for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%d %b %Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except Exception:
            continue
    return None


def _expected_latest_fii_dii_date(now_dt: Optional[datetime] = None) -> date:
    """
    Returns the most recent trading session date whose official provisional
    FII/DII cash market figure is expected to be published on NSE.
    Provisional EOD figures are typically published after 17:30 IST on trading days.
    """
    dt = now_dt or now_ist()
    today = dt.date()
    if market_calendar.is_trading_day(today) and (dt.hour > 17 or (dt.hour == 17 and dt.minute >= 30)):
        return today
    return market_calendar.get_last_trading_date(today - timedelta(days=1))


def fetch_live_fii_dii_from_nse() -> Optional[Dict[str, Any]]:
    """
    Safely fetches today's provisional FII and DII cash market trading activity from NSE India API.
    Uses browser-emulated cookies and headers to prevent 403 blocks.
    """
    try:
        from nselib.libutil import nse_urlfetch

        url = "https://www.nseindia.com/api/fiidiiTradeReact"
        res = nse_urlfetch(url)
        if res.status_code != 200:
            logger.warning(f"NSE FII/DII API returned HTTP {res.status_code}")
            return None

        raw_list = res.json()
        if not isinstance(raw_list, list) or len(raw_list) == 0:
            return None

        fii_data = {}
        dii_data = {}
        common_date = ""

        for item in raw_list:
            cat = str(item.get("category", "")).upper()
            d_str = str(item.get("date", "")).strip()
            if d_str:
                common_date = d_str

            def _flt(v: Any) -> float:
                try:
                    return round(float(str(v).replace(",", "")), 2)
                except Exception:
                    return 0.0

            if "FII" in cat or "FPI" in cat:
                fii_data = {
                    "buy": _flt(item.get("buyValue")),
                    "sell": _flt(item.get("sellValue")),
                    "net": _flt(item.get("netValue")),
                }
            elif "DII" in cat:
                dii_data = {
                    "buy": _flt(item.get("buyValue")),
                    "sell": _flt(item.get("sellValue")),
                    "net": _flt(item.get("netValue")),
                }

        if not fii_data and not dii_data:
            return None

        fii_net = fii_data.get("net", 0.0)
        dii_net = dii_data.get("net", 0.0)
        total_net = round(fii_net + dii_net, 2)

        return {
            "date": common_date,
            "fiiBuy": fii_data.get("buy", 0.0),
            "fiiSell": fii_data.get("sell", 0.0),
            "fiiNet": fii_net,
            "diiBuy": dii_data.get("buy", 0.0),
            "diiSell": dii_data.get("sell", 0.0),
            "diiNet": dii_net,
            "totalNet": total_net,
        }
    except Exception as exc:
        logger.error(f"Error fetching FII/DII from NSE: {exc}")
        return None


def _dedupe_and_sort_daily(daily_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_date: Dict[date, Dict[str, Any]] = {}
    fallback_rows: List[Dict[str, Any]] = []
    for row in daily_list or []:
        if not isinstance(row, dict):
            continue
        d_str = str(row.get("date") or row.get("period") or "").strip()
        d_obj = _parse_cash_date(d_str)
        if not d_obj:
            fallback_rows.append(row)
            continue
        norm_str = d_obj.strftime("%d-%b-%Y")
        cleaned = dict(row)
        cleaned["date"] = norm_str
        cleaned["period"] = norm_str
        if d_obj not in by_date:
            by_date[d_obj] = cleaned
    ordered = [by_date[k] for k in sorted(by_date.keys(), reverse=True)]
    ordered.extend(fallback_rows)
    return ordered


def _rebuild_period_rollups(history: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rebuilds weekly buckets and enriches monthly/yearly entries with complete
    Buy/Sell/Net & Nifty 50 close metrics without disturbing older pre-daily seed data.
    """
    daily_list = _dedupe_and_sort_daily(history.get("daily") or [])
    history["daily"] = daily_list

    parsed_daily: List[Tuple[date, Dict[str, Any]]] = []
    for row in daily_list:
        d_obj = _parse_cash_date(row.get("date") or row.get("period") or "")
        if d_obj:
            parsed_daily.append((d_obj, row))

    # --- 1. Weekly Rollups (Monday-Sunday trading weeks) ---
    week_buckets: Dict[date, List[Tuple[date, Dict[str, Any]]]] = {}
    for d_obj, row in parsed_daily:
        wk_start = d_obj - timedelta(days=d_obj.weekday())
        week_buckets.setdefault(wk_start, []).append((d_obj, row))

    weekly_list: List[Dict[str, Any]] = []
    sorted_weeks = sorted(week_buckets.keys())  # oldest -> newest to compute prev_close accurately
    prev_wk_close: Optional[float] = None
    for wk_start in sorted_weeks:
        wk_rows = sorted(week_buckets[wk_start], key=lambda x: x[0])
        d_first, r_first = wk_rows[0]
        d_last, r_last = wk_rows[-1]
        if d_first == d_last:
            wk_label = d_last.strftime("%d %b %Y")
        elif d_first.month == d_last.month and d_first.year == d_last.year:
            wk_label = f"{d_first.strftime('%d')}–{d_last.strftime('%d %b %Y')}"
        elif d_first.year == d_last.year:
            wk_label = f"{d_first.strftime('%d %b')}–{d_last.strftime('%d %b %Y')}"
        else:
            wk_label = f"{d_first.strftime('%d %b %y')}–{d_last.strftime('%d %b %y')}"

        fii_buy = round(sum(float(r.get("fiiBuy") or 0.0) for _, r in wk_rows), 2)
        fii_sell = round(sum(float(r.get("fiiSell") or 0.0) for _, r in wk_rows), 2)
        fii_net = round(sum(float(r.get("fiiNet") or 0.0) for _, r in wk_rows), 2)
        dii_buy = round(sum(float(r.get("diiBuy") or 0.0) for _, r in wk_rows), 2)
        dii_sell = round(sum(float(r.get("diiSell") or 0.0) for _, r in wk_rows), 2)
        dii_net = round(sum(float(r.get("diiNet") or 0.0) for _, r in wk_rows), 2)
        tot_net = round(fii_net + dii_net, 2)

        nifty_close = round(float(r_last.get("niftyClose") or 0.0), 2)
        base_close = prev_wk_close
        if (base_close is None or base_close <= 0) and float(r_first.get("niftyClose") or 0.0) > 0:
            base_close = float(r_first.get("niftyClose") or 0.0) - float(r_first.get("niftyChange") or 0.0)
        if nifty_close > 0 and base_close and base_close > 0:
            nifty_chg = round(nifty_close - base_close, 2)
            nifty_pct = round((nifty_chg / base_close) * 100.0, 2)
        else:
            nifty_chg = round(sum(float(r.get("niftyChange") or 0.0) for _, r in wk_rows), 2)
            nifty_pct = round(sum(float(r.get("niftyPct") or 0.0) for _, r in wk_rows), 2)
        if nifty_close > 0:
            prev_wk_close = nifty_close

        weekly_list.append({
            "period": wk_label,
            "date": d_last.strftime("%d-%b-%Y"),
            "weekStart": wk_start.isoformat(),
            "sessions": len(wk_rows),
            "niftyClose": nifty_close,
            "niftyChange": nifty_chg,
            "niftyPct": nifty_pct,
            "totalNet": tot_net,
            "fiiNet": fii_net,
            "diiNet": dii_net,
            "fiiBuy": fii_buy,
            "fiiSell": fii_sell,
            "diiBuy": dii_buy,
            "diiSell": dii_sell,
        })
    weekly_list.reverse()
    history["weekly"] = weekly_list

    # --- 2. Monthly Enrichments ---
    month_buckets: Dict[Tuple[int, int], List[Tuple[date, Dict[str, Any]]]] = {}
    for d_obj, row in parsed_daily:
        month_buckets.setdefault((d_obj.year, d_obj.month), []).append((d_obj, row))

    monthly_existing: List[Dict[str, Any]] = [dict(m) for m in (history.get("monthly") or []) if isinstance(m, dict)]
    monthly_by_label: Dict[str, Dict[str, Any]] = {}
    for m in monthly_existing:
        lbl = str(m.get("period") or "").strip()
        if lbl and lbl not in monthly_by_label:
            monthly_by_label[lbl] = m

    sorted_months = sorted(month_buckets.keys())  # oldest -> newest
    prev_m_close: Optional[float] = None
    for ym in sorted_months:
        m_rows = sorted(month_buckets[ym], key=lambda x: x[0])
        d_first, r_first = m_rows[0]
        d_last, r_last = m_rows[-1]
        m_label = d_last.strftime("%b %Y")

        fii_buy = round(sum(float(r.get("fiiBuy") or 0.0) for _, r in m_rows), 2)
        fii_sell = round(sum(float(r.get("fiiSell") or 0.0) for _, r in m_rows), 2)
        fii_net_calc = round(sum(float(r.get("fiiNet") or 0.0) for _, r in m_rows), 2)
        dii_buy = round(sum(float(r.get("diiBuy") or 0.0) for _, r in m_rows), 2)
        dii_sell = round(sum(float(r.get("diiSell") or 0.0) for _, r in m_rows), 2)
        dii_net_calc = round(sum(float(r.get("diiNet") or 0.0) for _, r in m_rows), 2)
        tot_net_calc = round(fii_net_calc + dii_net_calc, 2)

        nifty_close = round(float(r_last.get("niftyClose") or 0.0), 2)
        base_close = prev_m_close
        if (base_close is None or base_close <= 0) and float(r_first.get("niftyClose") or 0.0) > 0:
            base_close = float(r_first.get("niftyClose") or 0.0) - float(r_first.get("niftyChange") or 0.0)
        if nifty_close > 0 and base_close and base_close > 0:
            nifty_chg = round(nifty_close - base_close, 2)
            nifty_pct = round((nifty_chg / base_close) * 100.0, 2)
        else:
            nifty_chg = round(sum(float(r.get("niftyChange") or 0.0) for _, r in m_rows), 2)
            nifty_pct = round(sum(float(r.get("niftyPct") or 0.0) for _, r in m_rows), 2)
        if nifty_close > 0:
            prev_m_close = nifty_close

        existing = monthly_by_label.get(m_label)
        # Recompute net figures strictly from daily for Sep 2026+ or brand-new months; keep Aug 2026 seed nets if present
        use_calc_nets = (existing is None) or (ym >= (2026, 9))
        entry = dict(existing) if existing else {"period": m_label}
        entry["period"] = m_label
        entry["sessions"] = len(m_rows)
        entry["fiiBuy"] = fii_buy
        entry["fiiSell"] = fii_sell
        entry["diiBuy"] = dii_buy
        entry["diiSell"] = dii_sell
        if use_calc_nets:
            entry["fiiNet"] = fii_net_calc
            entry["diiNet"] = dii_net_calc
            entry["totalNet"] = tot_net_calc
        entry["niftyClose"] = nifty_close
        entry["niftyChange"] = nifty_chg
        entry["niftyPct"] = nifty_pct
        monthly_by_label[m_label] = entry

    def _month_sort_key(item: Dict[str, Any]) -> Tuple[int, int]:
        try:
            dt_m = datetime.strptime(str(item.get("period") or ""), "%b %Y")
            return (dt_m.year, dt_m.month)
        except Exception:
            return (0, 0)

    history["monthly"] = sorted(monthly_by_label.values(), key=_month_sort_key, reverse=True)

    # --- 3. Enrich latest year with latest Nifty close if missing ---
    yearly_list = [dict(y) for y in (history.get("yearly") or []) if isinstance(y, dict)]
    if parsed_daily and yearly_list:
        latest_yr = str(parsed_daily[0][0].year)
        latest_close = round(float(parsed_daily[0][1].get("niftyClose") or 0.0), 2)
        for y in yearly_list:
            if str(y.get("period") or "") == latest_yr and latest_close > 0:
                y["niftyClose"] = latest_close
    history["yearly"] = yearly_list
    return history


def load_fii_dii_history() -> Dict[str, Any]:
    """Loads historical FII/DII cash records from JSON file."""
    if not HISTORY_FILE.exists():
        return {"yearly": [], "monthly": [], "weekly": [], "daily": [], "lastUpdated": ""}
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            for d in data.get("daily", [])[:5]:
                d_date = d.get("date") or d.get("period")
                if d_date:
                    bench = get_nifty_benchmark_for_date(d_date)
                    if bench.get("close", 0) > 0 and abs(float(d.get("niftyClose") or 0) - bench["close"]) > 0.05:
                        d["niftyClose"] = bench["close"]
                        d["niftyChange"] = bench["change"]
                        d["niftyPct"] = bench["pct"]
            return _rebuild_period_rollups(data)
    except Exception:
        return {"yearly": [], "monthly": [], "weekly": [], "daily": [], "lastUpdated": ""}


def save_fii_dii_history(data: Dict[str, Any]) -> None:
    """Saves updated FII/DII cash records safely."""
    try:
        HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as exc:
        logger.error(f"Failed to save FII/DII history file: {exc}")


def _fetch_yahoo_nifty_map() -> Dict[str, Dict[str, float]]:
    now_ts = time.time()
    if _YAHOO_NIFTY_CACHE.get("data") and (now_ts - _YAHOO_NIFTY_CACHE.get("ts", 0.0)) < 600.0:
        return _YAHOO_NIFTY_CACHE["data"]
    out: Dict[str, Dict[str, float]] = {}
    try:
        import urllib.request
        url = "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=1mo&interval=1d"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=4.0) as r:
            yd = json.loads(r.read().decode())
        res0 = yd["chart"]["result"][0]
        tss = res0.get("timestamp") or []
        closes = res0["indicators"]["quote"][0]["close"] or []
        pts: List[Tuple[str, float]] = []
        for ts, c in zip(tss, closes):
            if c is None:
                continue
            d_ymd = datetime.fromtimestamp(int(ts), tz=IST).strftime("%Y-%m-%d")
            pts.append((d_ymd, round(float(c), 2)))
        for idx, (d_ymd, c_val) in enumerate(pts):
            prev_c = pts[idx - 1][1] if idx > 0 else c_val
            chg = round(c_val - prev_c, 2)
            pct = round((chg / prev_c) * 100.0, 2) if prev_c > 0 else 0.0
            out[d_ymd] = {"close": c_val, "change": chg, "pct": pct}
        if out:
            _YAHOO_NIFTY_CACHE["data"] = out
            _YAHOO_NIFTY_CACHE["ts"] = now_ts
    except Exception:
        pass
    return out


def get_nifty_benchmark_for_date(date_str: str) -> Dict[str, float]:
    """
    Resolves the exact official NSE Nifty 50 closing price, net point change,
    and percentage change for a given date from fo_bhav_eod_master.json,
    falling back to date-matched Yahoo finance or live Upstox index quotes.
    """
    target_d = _parse_cash_date(date_str)
    norm_target = target_d.strftime("%Y%m%d") if target_d else date_str.replace("-", "")
    norm_ymd = target_d.strftime("%Y-%m-%d") if target_d else ""

    master_path = ROOT_DIR / "data" / "fo_bhav_eod_master.json"
    if master_path.exists():
        try:
            with open(master_path, "r", encoding="utf-8") as f:
                mdata = json.load(f)
            nifty_rows = mdata.get("symbols_data", {}).get("NIFTY", [])
            if nifty_rows:
                for idx, r in enumerate(nifty_rows):
                    r_date = str(r.get("date", "")).replace("-", "")
                    if r_date == norm_target:
                        c = float(r.get("c", 0.0))
                        prev_c = float(nifty_rows[idx - 1].get("c", c)) if idx > 0 else c
                        chg = round(c - prev_c, 2)
                        pct = round((chg / prev_c) * 100.0, 2) if prev_c > 0 else 0.0
                        return {"close": c, "change": chg, "pct": pct}
        except Exception as e:
            logger.warning(f"Error reading fo_bhav_eod_master for Nifty benchmark: {e}")

    if norm_ymd:
        ymap = _fetch_yahoo_nifty_map()
        if norm_ymd in ymap:
            return ymap[norm_ymd]

    if target_d == now_ist().date():
        try:
            import upstox_engine
            spot, prev_c, chg = upstox_engine.get_real_spot_price("NSE_INDEX|Nifty 50")
            if spot and spot > 5000:
                pct = round((chg / prev_c) * 100.0, 2) if prev_c > 0 else 0.0
                return {"close": round(float(spot), 2), "change": round(float(chg), 2), "pct": pct}
        except Exception:
            pass

    return {"close": 0.0, "change": 0.0, "pct": 0.0}


def sync_fii_dii_history(
    force: bool = False,
    nifty_close: Optional[float] = None,
    nifty_change: Optional[float] = None,
    nifty_pct: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Checks if the latest expected trading day's FII/DII record is already in history.
    Auto-catches up missed previous trading sessions anytime on demand or post-17:30 IST.
    Merges smoothly into daily, weekly, monthly, and yearly structures.
    """
    global _FII_DII_IN_MEMORY_CACHE, _LAST_AUTO_SYNC_DATE, _LAST_NSE_FETCH_ATTEMPT_TS

    now = now_ist()
    history = load_fii_dii_history()
    daily_list = history.get("daily", [])

    expected_date = _expected_latest_fii_dii_date(now)
    expected_str = expected_date.strftime("%d-%b-%Y")
    has_expected = any(
        _parse_cash_date(str(d.get("date") or d.get("period") or "")) == expected_date
        for d in daily_list[:5]
    )

    latest_rec_date = daily_list[0].get("date") if daily_list else ""
    market_meta = {
        "latestRecordDate": latest_rec_date,
        "expectedLatestDate": expected_str,
        "isUpToDate": has_expected,
    }

    if has_expected and not force:
        history.update(market_meta)
        history["ok"] = True
        return history

    now_ts = time.time()
    if not force and (now_ts - _LAST_NSE_FETCH_ATTEMPT_TS) < 180.0:
        history.update(market_meta)
        history["ok"] = True
        return history

    _LAST_NSE_FETCH_ATTEMPT_TS = now_ts
    live_rec = fetch_live_fii_dii_from_nse()
    if not live_rec:
        history.update(market_meta)
        history["ok"] = True
        return history

    rec_date_obj = _parse_cash_date(live_rec.get("date") or "") or expected_date
    # Reject invalid holiday/future provisional records if NSE somehow stamped a non-trading date
    if not market_calendar.is_trading_day(rec_date_obj):
        rec_date_obj = market_calendar.get_last_trading_date(rec_date_obj)
    rec_date = rec_date_obj.strftime("%d-%b-%Y")

    existing_idx = next(
        (i for i, d in enumerate(daily_list) if _parse_cash_date(str(d.get("date") or d.get("period") or "")) == rec_date_obj),
        None,
    )
    prev_entry = dict(daily_list[existing_idx]) if existing_idx is not None else None

    # Resolve Nifty 50 Benchmark Close values for rec_date
    bench = get_nifty_benchmark_for_date(rec_date)
    if bench.get("close", 0) > 5000:
        nifty_close = bench["close"]
        nifty_change = bench["change"]
        nifty_pct = bench["pct"]
    elif nifty_close is None or nifty_close <= 5000:
        if prev_entry and float(prev_entry.get("niftyClose") or 0) > 5000:
            nifty_close = float(prev_entry["niftyClose"])
            nifty_change = float(prev_entry.get("niftyChange") or 0.0)
            nifty_pct = float(prev_entry.get("niftyPct") or 0.0)
        elif daily_list and float(daily_list[0].get("niftyClose") or 0) > 5000:
            nifty_close = float(daily_list[0]["niftyClose"])
            nifty_change = 0.0
            nifty_pct = 0.0
        else:
            nifty_close = 0.0
            nifty_change = 0.0
            nifty_pct = 0.0
    elif daily_list and (nifty_change is None or nifty_change == 0.0):
        prev_c = float(daily_list[0].get("niftyClose") or 0.0)
        if prev_c > 0 and nifty_close and prev_entry is None:
            nifty_change = round(float(nifty_close) - prev_c, 2)
            nifty_pct = round((nifty_change / prev_c) * 100.0, 2)

    new_daily_entry = {
        "period": rec_date,
        "date": rec_date,
        "niftyClose": round(float(nifty_close or 0.0), 2),
        "niftyChange": round(float(nifty_change or 0.0), 2),
        "niftyPct": round(float(nifty_pct or 0.0), 2),
        "totalNet": live_rec["totalNet"],
        "fiiNet": live_rec["fiiNet"],
        "diiNet": live_rec["diiNet"],
        "fiiBuy": live_rec["fiiBuy"],
        "fiiSell": live_rec["fiiSell"],
        "diiBuy": live_rec["diiBuy"],
        "diiSell": live_rec["diiSell"],
    }

    changed = (prev_entry is None) or any(
        prev_entry.get(k) != new_daily_entry.get(k)
        for k in ("fiiBuy", "fiiSell", "fiiNet", "diiBuy", "diiSell", "diiNet", "totalNet", "niftyClose")
    )

    if existing_idx is not None:
        daily_list[existing_idx] = new_daily_entry
    else:
        daily_list.insert(0, new_daily_entry)

    # Apply incremental delta to yearly entry when record is newly inserted or changed
    if changed:
        yr_str = str(rec_date_obj.year)
        yearly_list = history.get("yearly", [])
        old_fii_net = float(prev_entry.get("fiiNet") or 0.0) if prev_entry else 0.0
        old_dii_net = float(prev_entry.get("diiNet") or 0.0) if prev_entry else 0.0
        old_fii_buy = float(prev_entry.get("fiiBuy") or 0.0) if prev_entry else 0.0
        old_fii_sell = float(prev_entry.get("fiiSell") or 0.0) if prev_entry else 0.0
        old_dii_buy = float(prev_entry.get("diiBuy") or 0.0) if prev_entry else 0.0
        old_dii_sell = float(prev_entry.get("diiSell") or 0.0) if prev_entry else 0.0

        y_idx = next((i for i, y in enumerate(yearly_list) if str(y.get("period") or "") == yr_str), None)
        if y_idx is not None:
            y_row = dict(yearly_list[y_idx])
            y_row["fiiNet"] = round(float(y_row.get("fiiNet") or 0.0) + (new_daily_entry["fiiNet"] - old_fii_net), 2)
            y_row["diiNet"] = round(float(y_row.get("diiNet") or 0.0) + (new_daily_entry["diiNet"] - old_dii_net), 2)
            y_row["totalNet"] = round(y_row["fiiNet"] + y_row["diiNet"], 2)
            y_row["fiiBuy"] = round(float(y_row.get("fiiBuy") or 0.0) + (new_daily_entry["fiiBuy"] - old_fii_buy), 2)
            y_row["fiiSell"] = round(float(y_row.get("fiiSell") or 0.0) + (new_daily_entry["fiiSell"] - old_fii_sell), 2)
            y_row["diiBuy"] = round(float(y_row.get("diiBuy") or 0.0) + (new_daily_entry["diiBuy"] - old_dii_buy), 2)
            y_row["diiSell"] = round(float(y_row.get("diiSell") or 0.0) + (new_daily_entry["diiSell"] - old_dii_sell), 2)
            yearly_list[y_idx] = y_row
        else:
            yearly_list.insert(0, {
                "period": yr_str,
                "fiiNet": new_daily_entry["fiiNet"],
                "diiNet": new_daily_entry["diiNet"],
                "totalNet": new_daily_entry["totalNet"],
                "fiiBuy": new_daily_entry["fiiBuy"],
                "fiiSell": new_daily_entry["fiiSell"],
                "diiBuy": new_daily_entry["diiBuy"],
                "diiSell": new_daily_entry["diiSell"],
            })
        history["yearly"] = yearly_list

    history["daily"] = daily_list
    history = _rebuild_period_rollups(history)
    if changed or not history.get("lastUpdated"):
        history["lastUpdated"] = now.strftime("%d-%b-%Y %H:%M IST")
        save_fii_dii_history(history)

    _LAST_AUTO_SYNC_DATE = rec_date
    _FII_DII_IN_MEMORY_CACHE["data"] = history
    _FII_DII_IN_MEMORY_CACHE["timestamp"] = time.time()

    has_expected_after = any(
        _parse_cash_date(str(d.get("date") or d.get("period") or "")) == expected_date
        for d in (history.get("daily") or [])[:5]
    )
    history["latestRecordDate"] = (history.get("daily") or [{}])[0].get("date", "")
    history["expectedLatestDate"] = expected_str
    history["isUpToDate"] = has_expected_after
    history["ok"] = True
    return history


def get_fii_dii_data(force_refresh: bool = False, nifty_close: Optional[float] = None, nifty_change: Optional[float] = None, nifty_pct: Optional[float] = None) -> Dict[str, Any]:
    """Returns cached FII/DII data or triggers refresh if requested or behind expected session."""
    global _FII_DII_IN_MEMORY_CACHE
    now_ts = time.time()
    if not force_refresh:
        cached = _FII_DII_IN_MEMORY_CACHE.get("data")
        if cached and (now_ts - _FII_DII_IN_MEMORY_CACHE.get("timestamp", 0.0)) < 60.0:
            expected_str = _expected_latest_fii_dii_date().strftime("%d-%b-%Y")
            if cached.get("latestRecordDate") == expected_str or (now_ts - _LAST_NSE_FETCH_ATTEMPT_TS) < 180.0:
                return cached

    # Check if we should sync
    data = sync_fii_dii_history(force=force_refresh, nifty_close=nifty_close, nifty_change=nifty_change, nifty_pct=nifty_pct)
    _FII_DII_IN_MEMORY_CACHE["data"] = data
    _FII_DII_IN_MEMORY_CACHE["timestamp"] = time.time()
    return data


def _background_fii_dii_loop():
    """Background loop: catches up missed FII/DII sessions at startup and polls every 5m post-17:30 IST on trading days."""
    time.sleep(8)
    while True:
        try:
            now = now_ist()
            today = now.date()
            today_str = today.strftime("%d-%b-%Y")
            expected_date = _expected_latest_fii_dii_date(now)
            expected_str = expected_date.strftime("%d-%b-%Y")

            res = sync_fii_dii_history(force=False)
            latest_got = (res.get("daily") or [{}])[0].get("date", "")
            global _LAST_AUTO_SYNC_DATE
            if latest_got == expected_str:
                _LAST_AUTO_SYNC_DATE = latest_got

            # Active NSE provisional publish window on trading days (17:30 - 23:45 IST) -> check every 5 minutes until captured
            if market_calendar.is_trading_day(today) and ((now.hour == 17 and now.minute >= 30) or (18 <= now.hour <= 23)):
                if latest_got != today_str:
                    time.sleep(300)
                    continue
        except Exception as exc:
            logger.error(f"FII/DII background loop error: {exc}")

        time.sleep(900)


def start_fii_dii_background_worker():
    """Starts the background worker thread."""
    t = threading.Thread(target=_background_fii_dii_loop, daemon=True, name="FiiDiiSyncWorker")
    t.start()


# ==============================================================================
# ⚡ Official FII Derivatives Statistics & Participant Volume Parsers
# ==============================================================================
DERIVATIVES_FLOW_CACHE_FILE = ROOT_DIR / "data" / "fii_dii_derivatives_flow.json"


def fetch_live_fii_derivatives_stats(dt: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """
    Fetches official EOD FII Derivatives Statistics from NSE archives:
    https://archives.nseindia.com/content/fo/fii_stats_DD-Mon-YYYY.xls
    Returns parsed ₹ Crores turnover and contracts for Futures & Options.
    """
    try:
        import io
        import pandas as pd
        import urllib.request

        target_dt = dt or now_ist()
        date_str = target_dt.strftime("%d-%b-%Y")
        url = f"https://archives.nseindia.com/content/fo/fii_stats_{date_str}.xls"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Referer": "https://www.nseindia.com/"
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            content = resp.read()

        df = pd.read_excel(io.BytesIO(content), header=None)

        import math

        def _clean_num(val: Any) -> float:
            try:
                if pd.isna(val):
                    return 0.0
                s = str(val).replace(",", "").strip()
                if not s or s.lower() in ("nan", "none", "null", "-", "--"):
                    return 0.0
                v = float(s)
                if math.isnan(v) or math.isinf(v):
                    return 0.0
                return round(v, 2)
            except Exception:
                return 0.0

        def _clean_int(val: Any) -> int:
            try:
                if pd.isna(val):
                    return 0
                s = str(val).replace(",", "").strip()
                if not s or s.lower() in ("nan", "none", "null", "-", "--"):
                    return 0
                v = float(s)
                if math.isnan(v) or math.isinf(v):
                    return 0
                return int(v)
            except Exception:
                return 0

        parsed: Dict[str, Any] = {
            "date": date_str,
            "raw": {},
            "indices": [],
        }

        index_names = {
            "NIFTY": "NIFTY 50",
            "BANKNIFTY": "BANK NIFTY",
            "MIDCPNIFTY": "MIDCAP NIFTY",
            "FINNIFTY": "FIN NIFTY",
            "NIFTYNXT50": "NIFTY NEXT 50",
        }

        rows_map = {}
        for _, r in df.iterrows():
            lbl = str(r[0]).strip()
            if not lbl or lbl == "nan":
                continue
            rows_map[lbl] = {
                "buyContracts": _clean_int(r[1]),
                "buyCr": _clean_num(r[2]),
                "sellContracts": _clean_int(r[3]),
                "sellCr": _clean_num(r[4]),
                "oiContracts": _clean_int(r[5]) if len(r) > 5 else 0,
                "oiCr": _clean_num(r[6]) if len(r) > 6 else 0.0,
            }
            rows_map[lbl]["netContracts"] = rows_map[lbl]["buyContracts"] - rows_map[lbl]["sellContracts"]
            rows_map[lbl]["netCr"] = round(rows_map[lbl]["buyCr"] - rows_map[lbl]["sellCr"], 2)

        parsed["raw"] = rows_map
        parsed["indexFutures"] = rows_map.get("INDEX FUTURES", {})
        parsed["stockFutures"] = rows_map.get("STOCK FUTURES", {})
        parsed["indexOptions"] = rows_map.get("INDEX OPTIONS", {})
        parsed["stockOptions"] = rows_map.get("STOCK OPTIONS", {})

        idx_f = parsed["indexFutures"]
        stk_f = parsed["stockFutures"]
        parsed["totalFutures"] = {
            "buyCr": round(idx_f.get("buyCr", 0) + stk_f.get("buyCr", 0), 2),
            "sellCr": round(idx_f.get("sellCr", 0) + stk_f.get("sellCr", 0), 2),
            "netCr": round(idx_f.get("netCr", 0) + stk_f.get("netCr", 0), 2),
            "buyContracts": idx_f.get("buyContracts", 0) + stk_f.get("buyContracts", 0),
            "sellContracts": idx_f.get("sellContracts", 0) + stk_f.get("sellContracts", 0),
            "netContracts": idx_f.get("netContracts", 0) + stk_f.get("netContracts", 0),
        }

        idx_o = parsed["indexOptions"]
        stk_o = parsed["stockOptions"]
        parsed["totalOptions"] = {
            "buyCr": round(idx_o.get("buyCr", 0) + stk_o.get("buyCr", 0), 2),
            "sellCr": round(idx_o.get("sellCr", 0) + stk_o.get("sellCr", 0), 2),
            "netCr": round(idx_o.get("netCr", 0) + stk_o.get("netCr", 0), 2),
            "buyContracts": idx_o.get("buyContracts", 0) + stk_o.get("buyContracts", 0),
            "sellContracts": idx_o.get("sellContracts", 0) + stk_o.get("sellContracts", 0),
            "netContracts": idx_o.get("netContracts", 0) + stk_o.get("netContracts", 0),
        }

        for k, displayName in index_names.items():
            fut_k = f"{k} FUTURES"
            opt_k = f"{k} OPTIONS"
            f_row = rows_map.get(fut_k, {})
            o_row = rows_map.get(opt_k, {})
            if f_row or o_row:
                f_net = f_row.get("netCr", 0.0)
                o_net = o_row.get("netCr", 0.0)
                tot_net = round(f_net + o_net, 2)
                parsed["indices"].append({
                    "symbol": k,
                    "name": displayName,
                    "futBuyCr": f_row.get("buyCr", 0.0),
                    "futSellCr": f_row.get("sellCr", 0.0),
                    "futNetCr": f_net,
                    "futBuyContracts": f_row.get("buyContracts", 0),
                    "futSellContracts": f_row.get("sellContracts", 0),
                    "futNetContracts": f_row.get("netContracts", 0),
                    "optBuyCr": o_row.get("buyCr", 0.0),
                    "optSellCr": o_row.get("sellCr", 0.0),
                    "optNetCr": o_net,
                    "optBuyContracts": o_row.get("buyContracts", 0),
                    "optSellContracts": o_row.get("sellContracts", 0),
                    "optNetContracts": o_row.get("netContracts", 0),
                    "totalNetCr": tot_net,
                })

        return parsed
    except Exception as exc:
        logger.error(f"Error fetching/parsing fii_stats: {exc}")
        return None


def fetch_live_participant_vol(dt: Optional[datetime] = None) -> Optional[List[Dict[str, Any]]]:
    """
    Fetches participant wise trading volume from NSE:
    https://archives.nseindia.com/content/nsccl/fao_participant_vol_DDMMYYYY.csv
    Returns list of records for FII, DII, Client, Pro.
    """
    try:
        import urllib.request

        target_dt = dt or now_ist()
        d_str = target_dt.strftime("%d%m%Y")
        url = f"https://archives.nseindia.com/content/nsccl/fao_participant_vol_{d_str}.csv"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Referer": "https://www.nseindia.com/"
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            content = resp.read()

        lines = content.decode("utf-8", errors="ignore").strip().splitlines()
        data_lines = [l for l in lines if l.strip() and not l.startswith('""') and not l.startswith('"Participant')]
        if len(data_lines) < 2:
            return None

        headers = [h.strip() for h in data_lines[0].split(',')]
        rows = []

        def _to_int(v: Any) -> int:
            try:
                return int(float(str(v).replace(",", "").strip()))
            except Exception:
                return 0

        for l in data_lines[1:]:
            cols = [c.strip() for c in l.split(',')]
            if len(cols) < len(headers):
                continue
            r_dict = dict(zip(headers, cols))
            c_type = str(r_dict.get("Client Type", "")).strip()
            if not c_type:
                continue

            ce_buy = _to_int(r_dict.get("Option Index Call Long"))
            ce_sell = _to_int(r_dict.get("Option Index Call Short"))
            pe_buy = _to_int(r_dict.get("Option Index Put Long"))
            pe_sell = _to_int(r_dict.get("Option Index Put Short"))
            fut_idx_buy = _to_int(r_dict.get("Future Index Long"))
            fut_idx_sell = _to_int(r_dict.get("Future Index Short"))
            fut_stk_buy = _to_int(r_dict.get("Future Stock Long"))
            fut_stk_sell = _to_int(r_dict.get("Future Stock Short"))

            # Derive action summary
            ce_net = ce_buy - ce_sell
            pe_net = pe_buy - pe_sell
            action_tag = "NEUTRAL"
            if ce_net > 5000 and pe_net < -5000:
                action_tag = "BULLISH_BIAS"
            elif pe_net > 5000 and ce_net < -5000:
                action_tag = "BEARISH_HEDGE"
            elif ce_net > 5000 and pe_net > 5000:
                action_tag = "VOLATILITY_BUY"
            elif ce_net < -5000 and pe_net < -5000:
                action_tag = "PREMIUM_SELLER"

            rows.append({
                "type": c_type.upper(),
                "label": "CLIENT (Retail)" if c_type.upper() == "CLIENT" else ("PRO (Prop Desks)" if c_type.upper() == "PRO" else c_type.upper()),
                "callBuy": ce_buy,
                "callSell": ce_sell,
                "callNet": ce_net,
                "putBuy": pe_buy,
                "putSell": pe_sell,
                "putNet": pe_net,
                "futIdxBuy": fut_idx_buy,
                "futIdxSell": fut_idx_sell,
                "futIdxNet": fut_idx_buy - fut_idx_sell,
                "futStkBuy": fut_stk_buy,
                "futStkSell": fut_stk_sell,
                "futStkNet": fut_stk_buy - fut_stk_sell,
                "actionTag": action_tag,
            })

        return rows
    except Exception as exc:
        logger.error(f"Error fetching fao_participant_vol: {exc}")
        return None


def get_fii_derivatives_flow(target_date: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Returns complete F&O flow data (FII statistics + Participant volumes).
    Uses local cache if fresh. Never blocks request if remote fetch times out.
    """
    cache_dir = ROOT_DIR / "data" / "derivatives_flow"
    if target_date is None:
        now = now_ist()
        date_key = now.strftime("%Y-%m-%d")
        date_file = cache_dir / f"derivatives_flow_{date_key}.json"
        if not date_file.exists() and (not market_calendar.is_trading_day(now.date()) or now.hour < 16):
            candidates = sorted(cache_dir.glob("derivatives_flow_*.json"), reverse=True)
            if candidates:
                latest_f = candidates[0]
                date_key = latest_f.stem.replace("derivatives_flow_", "")
                try:
                    now = datetime.strptime(date_key, "%Y-%m-%d")
                except Exception:
                    pass
    else:
        now = target_date
        date_key = now.strftime("%Y-%m-%d")

    date_file = cache_dir / f"derivatives_flow_{date_key}.json"
    if date_file.exists():
        try:
            with open(date_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if cached.get("ok"):
                    cached.setdefault("quality", "official_regulatory")
                    cached.setdefault("source", "NSE Official Derivatives Archive (fao_participant_vol & fii_stats)")
                    cached.setdefault("coverage", "All 4 Market Participants (Client, DII, FII, Pro)")
                    cached.setdefault("isSimulated", False)
                    return cached
        except Exception:
            pass

    # Check legacy cache file
    if DERIVATIVES_FLOW_CACHE_FILE.exists():
        try:
            with open(DERIVATIVES_FLOW_CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if cached.get("dateKey") == date_key and cached.get("ok"):
                    cached.setdefault("quality", "official_regulatory")
                    cached.setdefault("source", "NSE Official Derivatives Archive (fao_participant_vol & fii_stats)")
                    cached.setdefault("coverage", "All 4 Market Participants (Client, DII, FII, Pro)")
                    cached.setdefault("isSimulated", False)
                    return cached
        except Exception:
            pass

    # Attempt fetch safely
    fii_stats = None
    part_vol = None
    try:
        fii_stats = fetch_live_fii_derivatives_stats(now)
    except Exception:
        pass
    try:
        part_vol = fetch_live_participant_vol(now)
    except Exception:
        pass

    if fii_stats or part_vol:
        result = {
            "ok": True,
            "quality": "official_regulatory",
            "source": "NSE Official Derivatives Archive (fao_participant_vol & fii_stats)",
            "asOf": now.strftime("%d %b %Y"),
            "coverage": "All 4 Market Participants (Client, DII, FII, Pro)",
            "isSimulated": False,
            "date": now.strftime("%d %b %Y"),
            "dateKey": date_key,
            "fiiStats": fii_stats or {},
            "participantVol": part_vol or [],
            "indices": (fii_stats.get("indices", []) if fii_stats else []),
            "lastUpdated": now.strftime("%d-%b-%Y %H:%M IST"),
        }
        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            with open(date_file, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
            with open(DERIVATIVES_FLOW_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
        except Exception:
            pass
        return result

    # Fallback to last known cache so request never fails or hangs
    if DERIVATIVES_FLOW_CACHE_FILE.exists():
        try:
            with open(DERIVATIVES_FLOW_CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if cached.get("ok"):
                    cached["quality"] = "cached"
                    cached["source"] = "NSE Official Derivatives Archive (Cached)"
                    cached["isSimulated"] = False
                    # Cache under requested date so we don't retry remote fetch again
                    try:
                        cache_dir.mkdir(parents=True, exist_ok=True)
                        with open(date_file, "w", encoding="utf-8") as df_out:
                            json.dump(cached, df_out, indent=2)
                    except Exception:
                        pass
                    return cached
        except Exception:
            pass

    fallback_obj = {
        "ok": False,
        "quality": "failed",
        "source": "Unavailable",
        "isSimulated": False,
        "date": now.strftime("%d %b %Y"),
        "dateKey": date_key,
        "fiiStats": {},
        "participantVol": [],
        "indices": [],
        "lastUpdated": now.strftime("%d-%b-%Y %H:%M IST"),
    }
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(date_file, "w", encoding="utf-8") as df_out:
            json.dump(fallback_obj, df_out, indent=2)
    except Exception:
        pass
    return fallback_obj


