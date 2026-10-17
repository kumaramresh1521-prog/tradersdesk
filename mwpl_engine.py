"""
mwpl_engine.py - Official NSE Market Wide Position Limit (MWPL) & Ban Radar Engine
===================================================================================
100% Real Exchange Data:
- Downloads official daily Combined OI & MWPL file from NSE Archives:
  https://nsearchives.nseindia.com/archives/nsccl/mwpl/combineoi_<DDMMYYYY>.zip
- Downloads official daily F&O Security in Ban Period list from NSE Archives:
  https://nsearchives.nseindia.com/archives/fo/sec_ban/fo_secban_<DDMMYYYY>.csv
- Automatically scans backward (up to 7 days) to find the latest official trading session.
- Real-time intraday OI scaling during live market hours (09:15 - 15:30 IST).
- No fake, synthetic, or hardcoded dummy numbers.
"""

import os
import csv
import io
import json
import time
import zipfile
import logging
import urllib.request
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

logger = logging.getLogger("MWPLEngine")
logger.setLevel(logging.INFO)

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / "cache"
MWPL_DIR = CACHE_DIR / "mwpl"
MWPL_DIR.mkdir(parents=True, exist_ok=True)

LATEST_MWPL_JSON = ROOT / "data" / "mwpl_official.json"
if not LATEST_MWPL_JSON.exists():
    LATEST_MWPL_JSON = CACHE_DIR / "mwpl_latest.json"

INDIA_TZ = timezone(timedelta(hours=5, minutes=30))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Referer": "https://www.nseindia.com/",
}

_MEMORY_CACHE: dict = {
    "ts": 0.0,
    "asOfDate": "",
    "records": {},       # symbol -> record
    "bannedSymbols": set(),
}

_KNOWN_SECTORS: dict[str, str] = {
    'HDFCBANK': 'Banking', 'ICICIBANK': 'Banking', 'SBIN': 'Banking', 'KOTAKBANK': 'Banking', 'AXISBANK': 'Banking',
    'INDUSINDBK': 'Banking', 'BANKBARODA': 'Banking', 'PNB': 'Banking', 'CANBK': 'Banking', 'FEDERALBNK': 'Banking',
    'IDFCFIRSTB': 'Banking', 'AUBANK': 'Banking', 'BANDHANBNK': 'Banking', 'RBLBANK': 'Banking', 'UNIONBANK': 'Banking',
    'BAJFINANCE': 'Financials', 'BAJAJFINSV': 'Financials', 'CHOLAFIN': 'Financials', 'MUTHOOTFIN': 'Financials',
    'SHRIRAMFIN': 'Financials', 'PFC': 'Financials', 'RECLTD': 'Financials', 'L&TFH': 'Financials', 'LTF': 'Financials',
    'LICHSGFIN': 'Financials', 'MANAPPURAM': 'Financials', 'M&MFIN': 'Financials', 'HDFCLIFE': 'Financials', 'SBILIFE': 'Financials',
    'ICICIPRULI': 'Financials', 'ICICIGI': 'Financials', 'SBICARD': 'Financials', 'HDFCAMC': 'Financials', 'NAM-INDIA': 'Financials',
    'TCS': 'IT', 'INFY': 'IT', 'HCLTECH': 'IT', 'WIPRO': 'IT', 'TECHM': 'IT', 'LTIM': 'IT', 'COFORGE': 'IT',
    'PERSISTENT': 'IT', 'MPHASIS': 'IT', 'LTTS': 'IT', 'TATAELXSI': 'IT', 'OFSS': 'IT', 'NAUKRI': 'IT', 'KPITTECH': 'IT',
    'RELIANCE': 'Energy', 'ONGC': 'Energy', 'BPCL': 'Energy', 'IOC': 'Energy', 'HPCL': 'Energy', 'GAIL': 'Energy',
    'PETRONET': 'Energy', 'IGL': 'Energy', 'MGL': 'Energy', 'GUJGASLTD': 'Energy', 'OIL': 'Energy', 'ATGL': 'Energy',
    'NTPC': 'Power', 'POWERGRID': 'Power', 'TATAPOWER': 'Power', 'ADANIPOWER': 'Power', 'ADANIGREEN': 'Power',
    'NHPC': 'Power', 'TORNTPOWER': 'Power', 'JSWENERGY': 'Power', 'BHEL': 'Power', 'CESC': 'Power', 'SUZLON': 'Power',
    'TATAMOTORS': 'Auto', 'M&M': 'Auto', 'MARUTI': 'Auto', 'BAJAJ-AUTO': 'Auto', 'EICHERMOT': 'Auto', 'HEROMOTOCO': 'Auto',
    'TVSMOTOR': 'Auto', 'ASHOKLEY': 'Auto', 'BHARATFORG': 'Auto', 'BALKRISIND': 'Auto', 'MRF': 'Auto', 'APOLLOTYRE': 'Auto',
    'TATASTEEL': 'Metals', 'JSWSTEEL': 'Metals', 'HINDALCO': 'Metals', 'VEDL': 'Metals', 'JINDALSTEL': 'Metals',
    'SAIL': 'Metals', 'NMDC': 'Metals', 'NATIONALUM': 'Metals', 'HINDCOPPER': 'Metals', 'HINDZINC': 'Metals',
    'SUNPHARMA': 'Pharma', 'CIPLA': 'Pharma', 'DRREDDY': 'Pharma', 'DIVISLAB': 'Pharma', 'LUPIN': 'Pharma',
    'AUROPHARMA': 'Pharma', 'TORNTPHARM': 'Pharma', 'ZYDUSLIFE': 'Pharma', 'BIOCON': 'Pharma', 'GLENMARK': 'Pharma',
    'MANKIND': 'Pharma', 'IPCALAB': 'Pharma', 'LAURUSLABS': 'Pharma', 'GRANULES': 'Pharma', 'ALKEM': 'Pharma',
    'HINDUNILVR': 'FMCG', 'ITC': 'FMCG', 'NESTLEIND': 'FMCG', 'BRITANNIA': 'FMCG', 'TATACONSUM': 'FMCG',
    'DABUR': 'FMCG', 'MARICO': 'FMCG', 'COLPAL': 'FMCG', 'GODREJCP': 'FMCG', 'VBL': 'FMCG', 'UBL': 'FMCG',
    'AMBUJACEM': 'Cement', 'ACC': 'Cement', 'ULTRACEMCO': 'Cement', 'SHREECEM': 'Cement', 'DALBHARAT': 'Cement',
    'GRASIM': 'Cement', 'RAMCOCEM': 'Cement', 'JKCEMENT': 'Cement', 'INDIACEM': 'Cement',
    'LT': 'Capital Goods', 'SIEMENS': 'Capital Goods', 'ABB': 'Capital Goods', 'BEL': 'Capital Goods',
    'HAL': 'Capital Goods', 'CUMMINSIND': 'Capital Goods', 'ASTRAL': 'Capital Goods', 'POLYCAB': 'Capital Goods',
    'DLF': 'Realty', 'GODREJPROP': 'Realty', 'OBEROIRLTY': 'Realty', 'PHOENIXLTD': 'Realty', 'BRIGADE': 'Realty',
    'PRESTIGE': 'Realty', 'LODHA': 'Realty',
    'BHARTIARTL': 'Telecom', 'IDEA': 'Telecom', 'INDUSTOWER': 'Telecom', 'TATACOMM': 'Telecom',
    'ASIANPAINT': 'Chemicals', 'BERGEPAINT': 'Chemicals', 'PIDILITIND': 'Chemicals', 'SRF': 'Chemicals',
    'PIIND': 'Chemicals', 'DEEPAKNTR': 'Chemicals', 'TATACHEM': 'Chemicals', 'UPL': 'Chemicals',
    'TRENT': 'Retail', 'ADANIENT': 'Services', 'ADANIPORTS': 'Infrastructure', 'DMART': 'Retail',
    'INDIGO': 'Services', 'IRCTC': 'Services', 'CONCOR': 'Infrastructure', 'ZOMATO': 'Services',
    'KAYNES': 'Capital Goods', 'INOXWIND': 'Power', 'CROMPTON': 'FMCG', 'PATANJALI': 'FMCG', 'LICI': 'Financials',
}


def now_ist() -> datetime:
    return datetime.now(INDIA_TZ)


def _fetch_url_bytes(url: str, timeout: int = 10) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                return resp.read()
    except Exception as e:
        logger.debug(f"Failed to fetch {url}: {e}")
    return None


def _fetch_url_text(url: str, timeout: int = 10) -> str | None:
    b = _fetch_url_bytes(url, timeout=timeout)
    if b:
        try:
            return b.decode("utf-8", errors="ignore")
        except Exception:
            pass
    return None


def fetch_official_ban_list(target_dt: date) -> tuple[set[str], Path | None]:
    """
    Downloads official NSE F&O Security in Ban Period CSV for target_dt.
    Returns (set_of_symbols, path_to_cached_file).
    """
    d_str = target_dt.strftime("%d%m%Y")
    cached_file = MWPL_DIR / f"fo_secban_{d_str}.csv"
    if cached_file.exists() and cached_file.stat().st_size > 10:
        try:
            lines = cached_file.read_text(encoding="utf-8", errors="ignore").strip().splitlines()
            banned = set()
            for line in lines[1:]:
                parts = line.strip().split(",")
                if len(parts) >= 2:
                    sym = parts[1].strip().upper()
                    if sym:
                        banned.add(sym)
            return banned, cached_file
        except Exception as e:
            logger.debug(f"Error reading cached ban file: {e}")

    urls = [
        f"https://nsearchives.nseindia.com/archives/fo/sec_ban/fo_secban_{d_str}.csv",
        f"https://archives.nseindia.com/archives/fo/sec_ban/fo_secban_{d_str}.csv",
    ]

    for url in urls:
        text = _fetch_url_text(url)
        if text and len(text) > 10 and "404" not in text and "<html" not in text.lower():
            try:
                cached_file.write_text(text, encoding="utf-8")
                lines = text.strip().splitlines()
                banned = set()
                for line in lines[1:]:
                    parts = line.strip().split(",")
                    if len(parts) >= 2:
                        sym = parts[1].strip().upper()
                        if sym:
                            banned.add(sym)
                logger.info(f"Downloaded official ban list for {target_dt}: {banned}")
                return banned, cached_file
            except Exception as e:
                logger.error(f"Error parsing ban list: {e}")
                break

    return set(), None


def fetch_official_combine_oi(target_dt: date) -> tuple[dict[str, dict], Path | None]:
    """
    Downloads official NSE combineoi_<DDMMYYYY>.zip from NSE archives and parses it.
    Returns (symbol_to_dict_map, path_to_cached_csv).
    """
    d_str = target_dt.strftime("%d%m%Y")
    cached_csv = MWPL_DIR / f"combineoi_{d_str}.csv"

    csv_text = None
    if cached_csv.exists() and cached_csv.stat().st_size > 5000:
        try:
            csv_text = cached_csv.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            logger.debug(f"Error reading cached combineoi: {e}")

    if not csv_text:
        urls = [
            f"https://nsearchives.nseindia.com/archives/nsccl/mwpl/combineoi_{d_str}.zip",
            f"https://archives.nseindia.com/archives/nsccl/mwpl/combineoi_{d_str}.zip",
        ]

        for url in urls:
            zip_bytes = _fetch_url_bytes(url)
            if zip_bytes and len(zip_bytes) > 1000:
                try:
                    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                        for name in zf.namelist():
                            if name.lower().endswith(".csv"):
                                csv_text = zf.read(name).decode("utf-8", errors="ignore")
                                cached_csv.write_text(csv_text, encoding="utf-8")
                                logger.info(f"Downloaded official combineoi for {target_dt} ({len(csv_text)} bytes)")
                                break
                    if csv_text:
                        break
                except Exception as e:
                    logger.debug(f"Error extracting zip from {url}: {e}")

    if not csv_text:
        return {}, None

    records = {}
    try:
        reader = csv.DictReader(csv_text.splitlines())
        for row in reader:
            clean = {k.strip(): v.strip() for k, v in row.items()}
            sym = clean.get("NSE Symbol", "").strip().upper()
            if not sym:
                continue

            try:
                mwpl = float(clean.get("MWPL", 0) or 0)
                cur_oi = float(clean.get("Open Interest", 0) or 0)
                fe_oi = float(clean.get("Future Equivalent Open Interest", 0) or 0)
            except Exception:
                continue

            limit_str = clean.get("Limit for Next Day", "")
            mwpl_pct = round((fe_oi / mwpl) * 100.0, 2) if mwpl > 0 else 0.0

            records[sym] = {
                "symbol": sym,
                "name": clean.get("Scrip Name", sym),
                "isin": clean.get("ISIN", ""),
                "mwplLimit": int(mwpl),
                "feOi": int(fe_oi),
                "currentOi": int(cur_oi),
                "mwplPct": mwpl_pct,
                "limitForNextDay": limit_str,
                "date": clean.get("Date", target_dt.strftime("%d-%b-%Y")),
            }
    except Exception as e:
        logger.error(f"Error parsing combineoi CSV: {e}")

    return records, cached_csv


def sync_latest_mwpl_data(force: bool = False) -> tuple[dict[str, dict], set[str], str]:
    """
    Finds and syncs the latest available NSE MWPL and ban list data.
    Scans from today backwards up to 7 days.
    Caches parsed result to disk and in-memory.
    """
    global _MEMORY_CACHE

    now = time.time()
    if not force and _MEMORY_CACHE["records"] and (now - _MEMORY_CACHE["ts"]) < 300.0:
        return _MEMORY_CACHE["records"], _MEMORY_CACHE["bannedSymbols"], _MEMORY_CACHE["asOfDate"]

    # Try loading from local json cache if valid and recent
    if not force and LATEST_MWPL_JSON.exists():
        try:
            with open(LATEST_MWPL_JSON, "r", encoding="utf-8") as f:
                data = json.load(f)
                cache_ts = data.get("ts", 0)
                if (now - cache_ts) < 300.0 and data.get("records"):
                    _MEMORY_CACHE = {
                        "ts": cache_ts,
                        "asOfDate": data.get("asOfDate", ""),
                        "records": data.get("records", {}),
                        "bannedSymbols": set(data.get("bannedSymbols", [])),
                    }
                    return _MEMORY_CACHE["records"], _MEMORY_CACHE["bannedSymbols"], _MEMORY_CACHE["asOfDate"]
        except Exception as e:
            logger.debug(f"Error loading {LATEST_MWPL_JSON}: {e}")

    today = now_ist().date()
    found_records = {}
    found_banned = set()
    as_of_date_str = ""

    for days_back in range(7):
        target_dt = today - timedelta(days=days_back)
        banned, _ = fetch_official_ban_list(target_dt)
        records, _ = fetch_official_combine_oi(target_dt)

        if records:
            found_records = records
            found_banned = banned
            as_of_date_str = target_dt.strftime("%d-%b-%Y")
            logger.info(f"Loaded official NSE MWPL data for {as_of_date_str}: {len(records)} stocks, {len(banned)} banned")
            break

    # Tag status on each record
    for sym, rec in found_records.items():
        limit_str = rec.get("limitForNextDay", "")
        pct = rec.get("mwplPct", 0.0)
        is_ban = (sym in found_banned) or ("NO FRESH" in limit_str.upper()) or (pct >= 95.0)
        is_alert = (not is_ban) and (pct >= 80.0)
        rec["isBanned"] = is_ban
        rec["isAlert"] = is_alert
        rec["status"] = "BANNED" if is_ban else ("ALERT" if is_alert else "NORMAL")

    if found_records:
        _MEMORY_CACHE = {
            "ts": now,
            "asOfDate": as_of_date_str,
            "records": found_records,
            "bannedSymbols": found_banned,
        }
        # Persist to JSON cache
        for p in (ROOT / "data" / "mwpl_official.json", CACHE_DIR / "mwpl_latest.json"):
            try:
                p.parent.mkdir(parents=True, exist_ok=True)
                with open(p, "w", encoding="utf-8") as f:
                    json.dump({
                        "ts": now,
                        "asOfDate": as_of_date_str,
                        "records": found_records,
                        "bannedSymbols": list(found_banned),
                    }, f, indent=2)
            except Exception as e:
                logger.debug(f"Error writing {p}: {e}")

    return found_records, found_banned, as_of_date_str


def get_mwpl_map(force_refresh: bool = False) -> dict[str, dict]:
    """
    Returns symbol -> MWPL record map for quick lookup by futures_engine.
    """
    records, _, _ = sync_latest_mwpl_data(force=force_refresh)
    return records


def _get_fallback_market_info() -> tuple[dict[str, float], dict[str, int]]:
    """
    Loads latest price and lot size fallback data from Bhavcopy and Kotak map.
    """
    prices: dict[str, float] = {}
    lots: dict[str, int] = {}

    # 1. Kotak map for lot sizes
    try:
        p_kotak = CACHE_DIR / "kotak_fo_contract_map.json"
        if p_kotak.exists():
            data = json.loads(p_kotak.read_text(encoding="utf-8"))
            for sym, info in data.items():
                if info.get("lot"):
                    lots[sym.upper()] = int(info["lot"])
    except Exception:
        pass

    # 2. Bhavcopy for closing settlement prices
    try:
        fo_dir = CACHE_DIR / "fo_bhav"
        if fo_dir.exists():
            csvs = sorted(fo_dir.glob("BhavCopy_NSE_FO_*.csv"), reverse=True)
            if csvs:
                with open(csvs[0], "r", encoding="utf-8", errors="ignore") as f:
                    r = csv.DictReader(f)
                    for row in r:
                        if row.get("FinInstrmTp") in ("STF", "IDF"):
                            sym = row.get("TckrSymb", "").strip().upper()
                            if sym and sym not in prices:
                                try:
                                    px = float(row.get("SttlmPric") or row.get("ClsPric") or row.get("UndrlygPric") or 0.0)
                                    if px > 0:
                                        prices[sym] = px
                                    if sym not in lots and row.get("NewBrdLotQty"):
                                        lots[sym] = int(row["NewBrdLotQty"])
                                except Exception:
                                    pass
    except Exception:
        pass

    return prices, lots


def get_mwpl_analysis(force_refresh: bool = False, live_records: list[dict] = None) -> dict:
    """
    Constructs the complete, rich MWPL analysis response for the UI and API:
    - Banned stocks list with real NSE ban status & MWPL %
    - Alert zone list (80% - 95%) with lot size and headroom
    - Full monitoring table with live price, current OI, MWPL limit, and progress
    - 100% official data with live tick overlay if market is open.
    """
    records_map, banned_symbols, as_of_date = sync_latest_mwpl_data(force=force_refresh)

    fallback_prices, fallback_lots = _get_fallback_market_info()

    now_dt = now_ist()
    is_market_hours = (9 <= now_dt.hour < 15 or (now_dt.hour == 15 and now_dt.minute <= 30)) and now_dt.weekday() < 5

    live_meta = {}
    if live_records:
        for r in live_records:
            sym = r.get("symbol", "").upper()
            if sym:
                live_meta[sym] = r

    all_stocks = []
    for sym, mrec in records_map.items():
        lm = live_meta.get(sym, {})
        lot = lm.get("lot") or fallback_lots.get(sym) or 1
        sector = lm.get("sector") or _KNOWN_SECTORS.get(sym, "F&O")
        price = float(lm.get("futPrice") or lm.get("ltp") or lm.get("spotPrice") or fallback_prices.get(sym, 0.0))

        mwpl_limit = mrec.get("mwplLimit", 0)
        eod_fe_oi = mrec.get("feOi", 0)
        cur_oi = mrec.get("currentOi", 0)
        mwpl_pct = mrec.get("mwplPct", 0.0)

        # Intraday live adjustment if live OI has updated during market hours
        live_oi = lm.get("openInterest") or lm.get("oiContracts")
        if is_market_hours and live_oi and cur_oi > 0 and mwpl_limit > 0:
            try:
                live_shares = int(live_oi) * lot if int(live_oi) < 500000 and lot > 1 else int(live_oi)
                delta_oi = live_shares - cur_oi
                adjusted_fe_oi = max(0, eod_fe_oi + delta_oi)
                mwpl_pct = round((adjusted_fe_oi / mwpl_limit) * 100.0, 2)
            except Exception:
                pass

        # Determine status
        is_banned = (sym in banned_symbols) or ("NO FRESH" in str(mrec.get("limitForNextDay", "")).upper()) or (mwpl_pct >= 95.0)
        is_alert = (not is_banned) and (mwpl_pct >= 80.0)

        st = "BANNED" if is_banned else ("ALERT" if is_alert else "NORMAL")
        badge = "status-banned" if is_banned else ("status-alert" if is_alert else "status-normal")

        # Headroom calculation (shares and lots until 95% threshold)
        if is_banned:
            headroom_shares = 0
            headroom_lots = 0
        else:
            ban_threshold_shares = int(mwpl_limit * 0.95)
            headroom_shares = max(0, ban_threshold_shares - eod_fe_oi)
            headroom_lots = headroom_shares // lot if lot > 0 else headroom_shares

        all_stocks.append({
            "symbol": sym,
            "name": mrec.get("name", sym),
            "sector": sector,
            "lot": lot,
            "price": price,
            "futPrice": price,
            "currentOi": cur_oi,
            "openInterest": cur_oi,
            "feOi": eod_fe_oi,
            "mwplLimit": mwpl_limit,
            "limitOi": mwpl_limit,
            "mwplPct": mwpl_pct,
            "headroomShares": headroom_shares,
            "headroomLots": headroom_lots,
            "headroom": f"{headroom_lots:,} lots" if headroom_lots > 0 else "0 lots",
            "limitForNextDay": mrec.get("limitForNextDay", ""),
            "status": st,
            "mwplStatus": st,
            "mwplBadge": badge,
            "isBanned": is_banned,
            "isAlert": is_alert,
        })

    # Sort categories
    banned_list = sorted([s for s in all_stocks if s["isBanned"]], key=lambda x: x["mwplPct"], reverse=True)
    alert_list = sorted([s for s in all_stocks if s["isAlert"]], key=lambda x: x["mwplPct"], reverse=True)
    normal_list = sorted([s for s in all_stocks if not s["isBanned"] and not s["isAlert"]], key=lambda x: x["mwplPct"], reverse=True)

    # Hierarchical order for monitoring table: Banned first, then Alert zone, then Normal stocks (each descending by %)
    sorted_all = banned_list + alert_list + normal_list

    return {
        "ok": True,
        "asOfDate": as_of_date or now_dt.strftime("%d-%b-%Y"),
        "timestamp": now_dt.strftime("%H:%M:%S"),
        "isLive": is_market_hours,
        "sessionMode": "LIVE" if is_market_hours else "EOD",
        "totalSecurities": len(all_stocks),
        "bannedCount": len(banned_list),
        "alertCount": len(alert_list),
        "normalCount": len(normal_list),
        "banned": banned_list,
        "bannedStocks": banned_list,
        "alertZone": alert_list,
        "alertStocks": alert_list,
        "allStocks": sorted_all,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Testing MWPL Engine...")
    res = get_mwpl_analysis(force_refresh=True)
    print(f"As of Date: {res['asOfDate']}, Total Stocks: {res['totalSecurities']}")
    print(f"Banned ({res['bannedCount']}): {[s['symbol'] + ': ' + str(s['mwplPct']) + '%' for s in res['bannedStocks']]}")
    print(f"Alert ({res['alertCount']}): {[s['symbol'] + ': ' + str(s['mwplPct']) + '% (Headroom: ' + s['headroom'] + ')' for s in res['alertStocks']]}")
    print(f"Top 5 Normal: {[s['symbol'] + ': ' + str(s['mwplPct']) + '%' for s in res['allStocks'][res['bannedCount']+res['alertCount']:res['bannedCount']+res['alertCount']+5]]}")
