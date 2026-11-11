# -*- coding: utf-8 -*-
"""
Unified Exchange Market Calendar & Real-Time Market Status Engine
Single source of truth for NSE / NFO trading days, exchange holidays,
special trading sessions (e.g. Diwali Muhurat Trading), pre-open / closed states,
and last active trading session date resolution.

Data Sources (No-Auth Public APIs + Live Verification):
1. Upstox Public Holidays API: https://api.upstox.com/v2/market/holidays
2. Upstox Public Market Timings API: https://api.upstox.com/v2/market/timings/{YYYY-MM-DD}
3. NSE Official Market Status API: https://www.nseindia.com/api/marketStatus
4. Optional Upstox Market Status API (when UPSTOX_ACCESS_TOKEN is valid)
5. Local RAM + Disk JSON Cache + NSE Holiday Calendar Fallback
"""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

IST = timezone(timedelta(hours=5, minutes=30))

ROOT_DIR = Path(__file__).resolve().parent
CACHE_DIR = ROOT_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

HOLIDAYS_CACHE_FILE = CACHE_DIR / "exchange_holidays.json"
TIMINGS_CACHE_DIR = CACHE_DIR

_HOLIDAYS_RAM_TTL = 6 * 3600.0      # 6 hours
_TIMINGS_RAM_TTL_TODAY = 3600.0     # 1 hour for today (catches unscheduled closures)
_TIMINGS_RAM_TTL_OTHER = 24 * 3600.0
_LIVE_STATUS_RAM_TTL = 60.0         # 60 seconds for NSE/Upstox status probe

_LOCK = threading.RLock()
_HOLIDAYS_MEM: Dict[str, Any] = {"ts": 0.0, "data": {}}
_TIMINGS_MEM: Dict[str, Dict[str, Any]] = {}
_LIVE_STATUS_MEM: Dict[str, Any] = {"ts": 0.0, "data": {}}

NSE_FIXED_HOLIDAYS = {
    (1, 26): "Republic Day",
    (5, 1): "Maharashtra Day",
    (8, 15): "Independence Day",
    (10, 2): "Mahatma Gandhi Jayanti",
    (12, 25): "Christmas",
}

# Verified NSE / NFO 2026 Trading Holidays fallback (synced with exchange circular)
FALLBACK_NSE_HOLIDAYS: Dict[str, str] = {
    "2026-01-15": "Municipal Corporation Election - Maharashtra",
    "2026-01-26": "Republic Day",
    "2026-03-03": "Holi",
    "2026-03-26": "Shri Ram Navami",
    "2026-03-31": "Shri Mahavir Jayanti",
    "2026-04-03": "Good Friday",
    "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
    "2026-05-01": "Maharashtra Day",
    "2026-05-28": "Bakri Id",
    "2026-06-26": "Muharram",
    "2026-08-15": "Independence Day",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-02": "Mahatma Gandhi Jayanti",
    "2026-10-20": "Dussehra",
    "2026-11-10": "Diwali-Balipratipada",
    "2026-11-24": "Guru Nanak Jayanti",
    "2026-12-25": "Christmas",
}

# Legacy flat set export for backward compatibility
NSE_CALENDAR_HOLIDAYS = set(FALLBACK_NSE_HOLIDAYS.keys())


def now_ist() -> datetime:
    """Returns timezone-aware current datetime in Indian Standard Time (IST)."""
    return datetime.now(IST)


def _ms_to_ist_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(float(ms) / 1000.0, tz=IST)


def _fetch_json(url: str, headers: Dict[str, str], timeout: float = 3.0) -> Optional[dict]:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            data = json.loads(raw)
            return data if isinstance(data, dict) else None
    except Exception:
        return None


def _parse_upstox_holiday_list(items: list) -> Dict[str, dict]:
    parsed: Dict[str, dict] = {}
    for item in items or []:
        if not isinstance(item, dict):
            continue
        d_str = str(item.get("date") or "").strip()[:10]
        if not d_str:
            continue
        closed_ex = [str(x).upper() for x in (item.get("closed_exchanges") or [])]
        open_ex_raw = [x for x in (item.get("open_exchanges") or []) if isinstance(x, dict) and x.get("exchange")]
        open_ex_map = {str(x["exchange"]).upper(): x for x in open_ex_raw}
        parsed[d_str] = {
            "date": d_str,
            "description": str(item.get("description") or "").strip(),
            "holiday_type": str(item.get("holiday_type") or "").strip().upper(),
            "closed_exchanges": closed_ex,
            "open_exchanges": open_ex_map,
        }
    return parsed


def get_exchange_holidays(force_refresh: bool = False, allow_network: bool = True) -> Dict[str, dict]:
    """
    Returns dict mapping YYYY-MM-DD -> exchange holiday/special-timing metadata.
    Uses RAM cache (6h), disk cache (cache/exchange_holidays.json), Upstox public
    /v2/market/holidays API, and FALLBACK_NSE_HOLIDAYS.
    """
    now_ts = time.time()
    with _LOCK:
        if not force_refresh and _HOLIDAYS_MEM["data"] and (now_ts - _HOLIDAYS_MEM["ts"]) < _HOLIDAYS_RAM_TTL:
            return _HOLIDAYS_MEM["data"]

    # Check disk cache before hitting network unless force_refresh
    disk_data: Dict[str, dict] = {}
    disk_fresh = False
    if HOLIDAYS_CACHE_FILE.exists():
        try:
            raw_disk = json.loads(HOLIDAYS_CACHE_FILE.read_text(encoding="utf-8"))
            fetched_at = float(raw_disk.get("fetched_at") or 0.0)
            items = raw_disk.get("raw_list") or []
            disk_data = _parse_upstox_holiday_list(items)
            if not disk_data and isinstance(raw_disk.get("by_date"), dict):
                disk_data = raw_disk["by_date"]
            if disk_data and (now_ts - fetched_at) < _HOLIDAYS_RAM_TTL:
                disk_fresh = True
        except Exception:
            disk_data = {}

    if disk_fresh and not force_refresh:
        with _LOCK:
            _HOLIDAYS_MEM["ts"] = now_ts
            _HOLIDAYS_MEM["data"] = disk_data
        return disk_data

    # Fetch live Upstox Public Market Holidays API (Zero auth required)
    if allow_network:
        headers = {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        }
        payload = _fetch_json("https://api.upstox.com/v2/market/holidays", headers=headers, timeout=3.5)
        if payload and payload.get("status") == "success" and isinstance(payload.get("data"), list):
            raw_list = payload["data"]
            parsed = _parse_upstox_holiday_list(raw_list)
            if parsed:
                try:
                    HOLIDAYS_CACHE_FILE.write_text(
                        json.dumps({"fetched_at": now_ts, "source": "UPSTOX_PUBLIC", "raw_list": raw_list}, indent=2),
                        encoding="utf-8",
                    )
                except Exception:
                    pass
                with _LOCK:
                    _HOLIDAYS_MEM["ts"] = now_ts
                    _HOLIDAYS_MEM["data"] = parsed
                return parsed

    if disk_data:
        with _LOCK:
            _HOLIDAYS_MEM["ts"] = now_ts
            _HOLIDAYS_MEM["data"] = disk_data
        return disk_data

    # Fallback map when completely offline and uncached
    fallback_parsed: Dict[str, dict] = {}
    for d_str, desc in FALLBACK_NSE_HOLIDAYS.items():
        fallback_parsed[d_str] = {
            "date": d_str,
            "description": desc,
            "holiday_type": "TRADING_HOLIDAY",
            "closed_exchanges": ["NSE", "NFO", "BSE", "BFO"],
            "open_exchanges": {},
        }
    with _LOCK:
        _HOLIDAYS_MEM["ts"] = now_ts
        _HOLIDAYS_MEM["data"] = fallback_parsed
    return fallback_parsed


def get_holiday_info(d: Optional[date] = None, exchange: str = "NFO", allow_network: bool = True) -> Optional[dict]:
    """
    Returns holiday record ONLY if exchange (default NFO/NSE) is closed on date `d`
    for an exchange holiday. Returns None for normal days or special trading sessions
    where NSE/NFO is open (e.g. Muhurat Trading).
    """
    if d is None:
        d = now_ist().date()
    d_str = d.isoformat()
    ex_u = exchange.upper().strip() or "NFO"

    holidays = get_exchange_holidays(allow_network=allow_network)
    rec = holidays.get(d_str)
    if rec:
        h_type = rec.get("holiday_type", "")
        closed_ex = rec.get("closed_exchanges") or []
        open_ex = rec.get("open_exchanges") or {}
        if h_type == "SPECIAL_TIMING" and (ex_u in open_ex or "NSE" in open_ex):
            return None
        if ex_u in closed_ex or "NSE" in closed_ex or (h_type == "TRADING_HOLIDAY" and ex_u not in open_ex and "NSE" not in open_ex):
            return {
                "date": d_str,
                "description": rec.get("description") or "Exchange Holiday",
                "holiday_type": h_type or "TRADING_HOLIDAY",
                "is_closed": True,
            }

    # Check static fallback / fixed holidays too (e.g. future years fixed dates)
    if d_str in FALLBACK_NSE_HOLIDAYS and d_str not in holidays:
        return {
            "date": d_str,
            "description": FALLBACK_NSE_HOLIDAYS[d_str],
            "holiday_type": "TRADING_HOLIDAY",
            "is_closed": True,
        }
    fixed_desc = NSE_FIXED_HOLIDAYS.get((d.month, d.day))
    if fixed_desc and (not rec or rec.get("holiday_type") != "SPECIAL_TIMING"):
        return {
            "date": d_str,
            "description": fixed_desc,
            "holiday_type": "TRADING_HOLIDAY",
            "is_closed": True,
        }
    return None


def get_special_timing_info(d: Optional[date] = None, exchange: str = "NFO", allow_network: bool = True) -> Optional[dict]:
    """Returns special trading session details (e.g. Muhurat Trading) if NSE/NFO is open with special timings on `d`."""
    if d is None:
        d = now_ist().date()
    d_str = d.isoformat()
    ex_u = exchange.upper().strip() or "NFO"
    holidays = get_exchange_holidays(allow_network=allow_network)
    rec = holidays.get(d_str)
    if rec and rec.get("holiday_type") == "SPECIAL_TIMING":
        open_ex = rec.get("open_exchanges") or {}
        ex_slot = open_ex.get(ex_u) or open_ex.get("NSE")
        if ex_slot and ex_slot.get("start_time") and ex_slot.get("end_time"):
            s_dt = _ms_to_ist_dt(ex_slot["start_time"])
            e_dt = _ms_to_ist_dt(ex_slot["end_time"])
            return {
                "date": d_str,
                "description": rec.get("description") or "Special Trading Session",
                "start_ms": int(ex_slot["start_time"]),
                "end_ms": int(ex_slot["end_time"]),
                "start_dt": s_dt,
                "end_dt": e_dt,
            }
    return None


def get_market_timings(
    d: Optional[date] = None,
    exchange: str = "NFO",
    force_refresh: bool = False,
    allow_network: bool = True,
) -> dict:
    """
    Returns authoritative trading session timings for date `d` & `exchange` (`NSE` or `NFO`).
    Queries Upstox Public `/v2/market/timings/{YYYY-MM-DD}` with RAM & disk cache and
    automatic fallback to exchange holiday calendar + standard NSE/NFO timings.
    """
    if d is None:
        d = now_ist().date()
    d_str = d.isoformat()
    ex_u = exchange.upper().strip() or "NFO"
    cache_key = f"{d_str}:{ex_u}"
    today_str = now_ist().date().isoformat()
    ttl = _TIMINGS_RAM_TTL_TODAY if d_str == today_str else _TIMINGS_RAM_TTL_OTHER
    now_ts = time.time()

    with _LOCK:
        mem_entry = _TIMINGS_MEM.get(cache_key)
        if not force_refresh and mem_entry and (now_ts - mem_entry["ts"]) < ttl:
            return mem_entry["data"]

    # Check Upstox raw timings disk cache for date `d_str`
    disk_file = TIMINGS_CACHE_DIR / f"market_timings_{d_str}.json"
    raw_timings_list: Optional[list] = None
    timings_source = "FALLBACK_CALENDAR"

    if not force_refresh and disk_file.exists():
        try:
            d_json = json.loads(disk_file.read_text(encoding="utf-8"))
            if (now_ts - float(d_json.get("fetched_at") or 0.0)) < ttl and isinstance(d_json.get("data"), list):
                raw_timings_list = d_json["data"]
                timings_source = "UPSTOX_TIMINGS_CACHE"
        except Exception:
            raw_timings_list = None

    if raw_timings_list is None and allow_network:
        headers = {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        }
        payload = _fetch_json(f"https://api.upstox.com/v2/market/timings/{d_str}", headers=headers, timeout=3.0)
        if payload and payload.get("status") == "success" and isinstance(payload.get("data"), list):
            raw_timings_list = payload["data"]
            timings_source = "UPSTOX_TIMINGS_API"
            try:
                disk_file.write_text(
                    json.dumps({"fetched_at": now_ts, "date": d_str, "data": raw_timings_list}, indent=2),
                    encoding="utf-8",
                )
            except Exception:
                pass

    # If Upstox Timings API succeeded, parse exchange entry directly
    if raw_timings_list is not None:
        by_ex = {str(x.get("exchange") or "").upper(): x for x in raw_timings_list if isinstance(x, dict) and x.get("exchange")}
        ex_entry = by_ex.get(ex_u) or (by_ex.get("NSE") if ex_u == "NFO" else None)
        if ex_entry and ex_entry.get("start_time") and ex_entry.get("end_time"):
            s_dt = _ms_to_ist_dt(ex_entry["start_time"])
            e_dt = _ms_to_ist_dt(ex_entry["end_time"])
            res = {
                "date": d_str,
                "exchange": ex_u,
                "is_trading_day": True,
                "start_ms": int(ex_entry["start_time"]),
                "end_ms": int(ex_entry["end_time"]),
                "start_dt": s_dt,
                "end_dt": e_dt,
                "start_str": s_dt.strftime("%H:%M"),
                "end_str": e_dt.strftime("%H:%M"),
                "source": timings_source,
            }
            with _LOCK:
                _TIMINGS_MEM[cache_key] = {"ts": now_ts, "data": res}
            return res

        # Upstox returned valid list, and NSE/NFO are absent -> Exchange is CLOSED today
        res = {
            "date": d_str,
            "exchange": ex_u,
            "is_trading_day": False,
            "start_ms": None,
            "end_ms": None,
            "start_dt": None,
            "end_dt": None,
            "start_str": None,
            "end_str": None,
            "source": timings_source,
        }
        with _LOCK:
            _TIMINGS_MEM[cache_key] = {"ts": now_ts, "data": res}
        return res

    # Network unavailable: derive from Holiday API cache / Special Timing / Fallback calendar
    special = get_special_timing_info(d, exchange=ex_u, allow_network=allow_network)
    if special:
        res = {
            "date": d_str,
            "exchange": ex_u,
            "is_trading_day": True,
            "start_ms": special["start_ms"],
            "end_ms": special["end_ms"],
            "start_dt": special["start_dt"],
            "end_dt": special["end_dt"],
            "start_str": special["start_dt"].strftime("%H:%M"),
            "end_str": special["end_dt"].strftime("%H:%M"),
            "source": "SPECIAL_TIMING_CALENDAR",
        }
        return res

    holiday = get_holiday_info(d, exchange=ex_u, allow_network=allow_network)
    if holiday or d.weekday() >= 5:
        return {
            "date": d_str,
            "exchange": ex_u,
            "is_trading_day": False,
            "start_ms": None,
            "end_ms": None,
            "start_dt": None,
            "end_dt": None,
            "start_str": None,
            "end_str": None,
            "source": "FALLBACK_CALENDAR",
        }

    # Standard regular weekday session timings in IST
    s_dt = datetime(d.year, d.month, d.day, 9, 15, 0, tzinfo=IST)
    end_min = 40 if ex_u in ("NFO", "BFO") else 30
    e_dt = datetime(d.year, d.month, d.day, 15, end_min, 0, tzinfo=IST)
    return {
        "date": d_str,
        "exchange": ex_u,
        "is_trading_day": True,
        "start_ms": int(s_dt.timestamp() * 1000),
        "end_ms": int(e_dt.timestamp() * 1000),
        "start_dt": s_dt,
        "end_dt": e_dt,
        "start_str": s_dt.strftime("%H:%M"),
        "end_str": e_dt.strftime("%H:%M"),
        "source": "FALLBACK_CALENDAR",
    }


def fetch_live_exchange_status(force_refresh: bool = False, allow_network: bool = True) -> dict:
    """
    Probes NSE Official /api/marketStatus (and Upstox /v2/market/status/NSE if token configured)
    with a 60-second RAM cache so normal endpoints suffer zero latency overhead.
    """
    now_ts = time.time()
    with _LOCK:
        if not force_refresh and _LIVE_STATUS_MEM["data"] and (now_ts - _LIVE_STATUS_MEM["ts"]) < _LIVE_STATUS_RAM_TTL:
            return _LIVE_STATUS_MEM["data"]

    result = {
        "checked_at": now_ts,
        "nse_ok": False,
        "nse_market_open": None,
        "nse_trade_date": None,
        "nse_trade_date_raw": "",
        "nse_message": "",
        "upstox_status": None,
    }

    if not allow_network:
        return result

    # 1. NSE Official Market Status API (Public, browser headers)
    nse_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.nseindia.com/",
    }
    nse_data = _fetch_json("https://www.nseindia.com/api/marketStatus", headers=nse_headers, timeout=2.5)
    if nse_data and isinstance(nse_data.get("marketState"), list):
        for m in nse_data["marketState"]:
            if str(m.get("market") or "").strip().lower() == "capital market":
                msg = str(m.get("marketStatusMessage") or "").strip()
                raw_td = str(m.get("tradeDate") or "").strip()
                parsed_td = None
                if raw_td:
                    try:
                        parsed_td = datetime.strptime(raw_td[:11], "%d-%b-%Y").date().isoformat()
                    except Exception:
                        parsed_td = None
                msg_low = msg.lower()
                is_open_flag = ("open" in msg_low) and ("closed" not in msg_low) and ("close" not in msg_low)
                result["nse_ok"] = True
                result["nse_market_open"] = is_open_flag
                result["nse_trade_date"] = parsed_td
                result["nse_trade_date_raw"] = raw_td
                result["nse_message"] = msg
                break

    # 2. Optional Upstox Authenticated Market Status (only if token present)
    token = (os.getenv("UPSTOX_ACCESS_TOKEN") or "").strip()
    if token:
        up_headers = {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
            "Authorization": f"Bearer {token}",
        }
        up_data = _fetch_json("https://api.upstox.com/v2/market/status/NSE", headers=up_headers, timeout=2.0)
        if up_data and up_data.get("status") == "success" and isinstance(up_data.get("data"), dict):
            result["upstox_status"] = str(up_data["data"].get("status") or "").upper()

    with _LOCK:
        _LIVE_STATUS_MEM["ts"] = now_ts
        _LIVE_STATUS_MEM["data"] = result
    return result


def is_market_holiday(d: Optional[date] = None, exchange: str = "NFO", allow_network: bool = True) -> bool:
    """
    Returns True if exchange is CLOSED all day on date `d` (weekend, official holiday,
    or omitted from Upstox Exchange Timings API). Returns False on regular trading days
    and special trading sessions (e.g. Diwali Muhurat Trading).
    """
    if d is None:
        d = now_ist().date()
    timings = get_market_timings(d, exchange=exchange, allow_network=allow_network)
    if timings and timings.get("source", "").startswith("UPSTOX_TIMINGS"):
        return not bool(timings.get("is_trading_day"))
    special = get_special_timing_info(d, exchange=exchange, allow_network=allow_network)
    if special:
        return False
    if d.weekday() >= 5:
        return True
    return get_holiday_info(d, exchange=exchange, allow_network=allow_network) is not None


def is_trading_day(d: Optional[date] = None, exchange: str = "NFO", allow_network: bool = True) -> bool:
    """Returns True ONLY if NSE/NFO conducts trading on date `d`."""
    return not is_market_holiday(d, exchange=exchange, allow_network=allow_network)


def is_market_open(
    now_dt: Optional[datetime] = None,
    exchange: str = "NFO",
    check_live_api: bool = True,
    allow_network: bool = True,
) -> bool:
    """
    Returns True ONLY when the exchange market session is actively open right now in IST.
    Returns False on all weekends, exchange holidays, pre-open hours, and post-close hours.
    """
    is_simulated = now_dt is not None
    if now_dt is None:
        now_dt = now_ist()
    elif now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=IST)
    else:
        now_dt = now_dt.astimezone(IST)

    d = now_dt.date()
    timings = get_market_timings(d, exchange=exchange, allow_network=allow_network)
    if not timings or not timings.get("is_trading_day"):
        return False

    s_dt = timings.get("start_dt")
    e_dt = timings.get("end_dt")
    if not s_dt or not e_dt:
        return False

    if not (s_dt <= now_dt <= e_dt):
        return False

    # Cross-check live exchange API when querying real wall-clock time
    if check_live_api and not is_simulated and allow_network:
        live = fetch_live_exchange_status(allow_network=True)
        up_st = live.get("upstox_status") or ""
        if up_st and any(tok in up_st for tok in ("CLOSE", "HOLIDAY", "PRE_OPEN")):
            return False
        # If NSE officially reports today's tradeDate AND says Normal Market has Closed (e.g. early halt/closure before 15:30)
        if live.get("nse_ok") and live.get("nse_trade_date") == d.isoformat() and live.get("nse_market_open") is False:
            # Wait: between 15:30 and 15:40, NSE Capital Market closes at 15:30 while NFO closing tick settles until 15:40.
            # Only veto NSE spot cleanly or after 15:40.
            if exchange.upper() == "NSE" or now_dt > datetime(d.year, d.month, d.day, 15, 30, 0, tzinfo=IST):
                return False
            if now_dt < datetime(d.year, d.month, d.day, 15, 29, 0, tzinfo=IST) and "closed" in live.get("nse_message", "").lower():
                return False

    return True


def has_market_opened_on_date(
    now_dt: Optional[datetime] = None,
    exchange: str = "NFO",
    allow_network: bool = True,
) -> bool:
    """
    Returns True if `now_dt.date()` is a trading day AND the session open time
    has already started (or finished for the day). False on holidays, weekends, and pre-open.
    """
    if now_dt is None:
        now_dt = now_ist()
    elif now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=IST)
    else:
        now_dt = now_dt.astimezone(IST)

    d = now_dt.date()
    timings = get_market_timings(d, exchange=exchange, allow_network=allow_network)
    if not timings or not timings.get("is_trading_day") or not timings.get("start_dt"):
        return False
    return now_dt >= timings["start_dt"]


def get_last_trading_date(
    ref_date: Optional[date] = None,
    now_dt: Optional[datetime] = None,
    include_today_if_opened: bool = True,
    exchange: str = "NFO",
    allow_network: bool = True,
) -> date:
    """
    Returns the most recent active NSE/NFO trading date <= ref_date (or today IST).
    On weekends, holidays, or pre-open (<09:15 IST), rolls back automatically
    to the last trading day on which exchange trading occurred.
    """
    is_simulated = (now_dt is not None or ref_date is not None)
    if now_dt is None:
        now_dt = now_ist()
    elif now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=IST)
    else:
        now_dt = now_dt.astimezone(IST)

    today_d = now_dt.date()
    cursor = ref_date or today_d

    if cursor > today_d:
        cursor = today_d

    # If cursor is today and today's session hasn't opened yet (pre-open or holiday), step back 1 day first
    if cursor == today_d:
        if include_today_if_opened:
            if not has_market_opened_on_date(now_dt=now_dt, exchange=exchange, allow_network=allow_network):
                cursor = cursor - timedelta(days=1)
        else:
            cursor = cursor - timedelta(days=1)

    for _ in range(30):
        if is_trading_day(cursor, exchange=exchange, allow_network=allow_network):
            return cursor
        cursor = cursor - timedelta(days=1)

    # Extra cross-check fallback
    if not is_simulated and allow_network:
        live = fetch_live_exchange_status(allow_network=True)
        if live.get("nse_trade_date"):
            try:
                return date.fromisoformat(live["nse_trade_date"])
            except Exception:
                pass
    return cursor


def get_market_status_summary(
    now_dt: Optional[datetime] = None,
    exchange: str = "NFO",
    allow_network: bool = True,
) -> dict:
    """
    Builds unified exchange status summary consumed by server health/status APIs,
    Futures Desk, Intraday Analytics, PVO, Technical Charts, and frontend headers.
    """
    is_simulated = now_dt is not None
    if now_dt is None:
        now_dt = now_ist()
    elif now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=IST)
    else:
        now_dt = now_dt.astimezone(IST)

    today_d = now_dt.date()
    today_iso = today_d.isoformat()
    timings = get_market_timings(today_d, exchange=exchange, allow_network=allow_network)
    holiday = get_holiday_info(today_d, exchange=exchange, allow_network=allow_network)
    special = get_special_timing_info(today_d, exchange=exchange, allow_network=allow_network)
    live_probe = fetch_live_exchange_status(allow_network=allow_network) if not is_simulated else {}

    is_weekend = (today_d.weekday() >= 5) and not bool(special)
    is_hol = (holiday is not None) or (not timings.get("is_trading_day") and not is_weekend)
    is_trad_day = bool(timings.get("is_trading_day")) and not is_hol
    is_open_now = is_market_open(now_dt=now_dt, exchange=exchange, check_live_api=not is_simulated, allow_network=allow_network)

    holiday_name = ""
    if holiday:
        holiday_name = holiday.get("description") or "Exchange Holiday"
    elif is_hol and not is_weekend:
        holiday_name = "Exchange Trading Holiday"
    elif is_weekend:
        holiday_name = today_d.strftime("%A")

    last_td = get_last_trading_date(
        ref_date=today_d,
        now_dt=now_dt,
        include_today_if_opened=True,
        exchange=exchange,
        allow_network=allow_network,
    )

    s_dt = timings.get("start_dt")
    e_dt = timings.get("end_dt")

    if is_open_now:
        status_code = "LIVE"
        if special:
            status_text = f"LIVE SPECIAL ({special['description']} • {now_dt.strftime('%H:%M')} IST)"
        else:
            status_text = f"LIVE ({now_dt.strftime('%H:%M')} IST)"
    elif is_hol and not is_weekend:
        status_code = "HOLIDAY"
        status_text = f"MARKET HOLIDAY • {holiday_name}" if holiday_name else "MARKET HOLIDAY"
    elif is_weekend:
        status_code = "WEEKEND"
        status_text = f"WEEKEND CLOSED • {today_d.strftime('%A')}"
    elif is_trad_day and s_dt and now_dt < s_dt:
        status_code = "PRE_OPEN"
        status_text = f"PRE-OPEN (Opens {s_dt.strftime('%H:%M')} IST)"
    else:
        status_code = "CLOSED"
        end_lbl = e_dt.strftime("%H:%M") if e_dt else "15:40"
        status_text = f"CLOSED (EOD {end_lbl} IST)"

    mkt_hours = f"{timings['start_str']} - {timings['end_str']} IST" if timings.get("start_str") and timings.get("end_str") else "CLOSED TODAY"

    return {
        "ok": True,
        "isOpen": is_open_now,
        "isLive": is_open_now,
        "isTradingDay": is_trad_day,
        "isHoliday": is_hol,
        "isWeekend": is_weekend,
        "isSpecialSession": bool(special),
        "holidayName": holiday_name,
        "statusCode": status_code,
        "statusText": status_text,
        "sessionMode": "LIVE" if is_open_now else status_code,
        "todayDate": today_iso,
        "todayDisplay": today_d.strftime("%d-%b-%Y"),
        "lastTradingDate": last_td.isoformat(),
        "lastTradingDateYmd": last_td.strftime("%Y%m%d"),
        "lastTradingDateDisplay": last_td.strftime("%d-%b-%Y"),
        "marketHours": mkt_hours,
        "openTimeIst": timings.get("start_str"),
        "closeTimeIst": timings.get("end_str"),
        "istNow": now_dt.isoformat(),
        "istTimeStr": now_dt.strftime("%H:%M IST"),
        "source": timings.get("source", "UPSTOX_API"),
        "nseApiTradeDate": live_probe.get("nse_trade_date"),
        "nseApiMessage": live_probe.get("nse_message", ""),
        "upstoxStatus": live_probe.get("upstox_status"),
    }
