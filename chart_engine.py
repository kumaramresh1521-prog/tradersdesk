# -*- coding: utf-8 -*-
"""
TradersDesk Institutional Technical Chart Engine
Provides high-performance symbol lookup, quote snapshots, and historical OHLCV/OI data.
"""

import os
import json
import csv
import time
from typing import Dict, List, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MASTER_FO_PATH = os.path.join(DATA_DIR, "fo_bhav_eod_master.json")
LATEST_ROLLOVER_PATH = os.path.join(DATA_DIR, "latest_fo_bhav_rollover.json")
DELIVERY_DIR = os.path.join(DATA_DIR, "delivery")

# Top Popular Symbols
POPULAR_SYMBOLS = [
    {"symbol": "NIFTY", "name": "Nifty 50", "tv": "NSE:NIFTY", "isIndex": True, "category": "INDEX"},
    {"symbol": "BANKNIFTY", "name": "Nifty Bank", "tv": "NSE:BANKNIFTY", "isIndex": True, "category": "INDEX"},
    {"symbol": "FINNIFTY", "name": "Nifty Financial Services", "tv": "NSE:FINNIFTY", "isIndex": True, "category": "INDEX"},
    {"symbol": "MIDCPNIFTY", "name": "Nifty Midcap Select", "tv": "NSE:MIDCPNIFTY", "isIndex": True, "category": "INDEX"},
    {"symbol": "SENSEX", "name": "BSE Sensex 30", "tv": "BSE:SENSEX", "isIndex": True, "category": "INDEX"},
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "tv": "NSE:RELIANCE", "isIndex": False, "category": "ENERGY"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd", "tv": "NSE:HDFCBANK", "isIndex": False, "category": "FINANCE"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd", "tv": "NSE:ICICIBANK", "isIndex": False, "category": "FINANCE"},
    {"symbol": "TCS", "name": "Tata Consultancy Services", "tv": "NSE:TCS", "isIndex": False, "category": "IT"},
    {"symbol": "INFY", "name": "Infosys Ltd", "tv": "NSE:INFY", "isIndex": False, "category": "IT"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd", "tv": "NSE:TATAMOTORS", "isIndex": False, "category": "AUTO"},
    {"symbol": "SBIN", "name": "State Bank of India", "tv": "NSE:SBIN", "isIndex": False, "category": "FINANCE"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd", "tv": "NSE:BHARTIARTL", "isIndex": False, "category": "TELECOM"},
    {"symbol": "ITC", "name": "ITC Ltd", "tv": "NSE:ITC", "isIndex": False, "category": "FMCG"},
    {"symbol": "LICI", "name": "Life Insurance Corp", "tv": "NSE:LICI", "isIndex": False, "category": "FINANCE"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank", "tv": "NSE:KOTAKBANK", "isIndex": False, "category": "FINANCE"},
    {"symbol": "LT", "name": "Larsen & Toubro Ltd", "tv": "NSE:LT", "isIndex": False, "category": "CAPITAL GOODS"},
    {"symbol": "AXISBANK", "name": "Axis Bank Ltd", "tv": "NSE:AXISBANK", "isIndex": False, "category": "FINANCE"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India", "tv": "NSE:MARUTI", "isIndex": False, "category": "AUTO"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd", "tv": "NSE:BAJFINANCE", "isIndex": False, "category": "FINANCE"},
]

class ChartEngine:
    def __init__(self):
        self._cached_symbols = None
        self._fo_data = None
        self._rollover_data = None
        self._last_load = 0
        self._load_metadata()

    def _load_metadata(self):
        symbols_map = {}
        # 1. Start with popular
        for item in POPULAR_SYMBOLS:
            symbols_map[item["symbol"]] = item

        # 2. Add F&O symbols from master
        try:
            if os.path.exists(MASTER_FO_PATH):
                with open(MASTER_FO_PATH, "r", encoding="utf-8") as f:
                    master = json.load(f)
                    sym_dict = master.get("symbols_data", {})
                    for sym in sym_dict.keys():
                        if sym not in symbols_map:
                            is_idx = sym in ("NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY")
                            symbols_map[sym] = {
                                "symbol": sym,
                                "name": f"{sym} F&O Underlying",
                                "tv": f"NSE:{sym}",
                                "isIndex": is_idx,
                                "category": "F&O DERIVATIVES"
                            }
        except Exception as e:
            print("ChartEngine load master warning:", e)

        # 3. Add cash delivery symbols from latest bhavcopy if available
        try:
            if os.path.exists(DELIVERY_DIR):
                csv_files = [f for f in os.listdir(DELIVERY_DIR) if f.startswith("sec_bhavdata_full") and f.endswith(".csv")]
                if csv_files:
                    latest_csv = sorted(csv_files)[-1]
                    csv_path = os.path.join(DELIVERY_DIR, latest_csv)
                    with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            series = (row.get(" SERIES") or row.get("SERIES") or "").strip()
                            if series in ("EQ", "BE", "SM"):
                                sym = (row.get("SYMBOL") or row.get(" SYMBOL") or "").strip()
                                if sym and sym not in symbols_map:
                                    symbols_map[sym] = {
                                        "symbol": sym,
                                        "name": f"{sym} Equity",
                                        "tv": f"NSE:{sym}",
                                        "isIndex": False,
                                        "category": "EQUITY CASH"
                                    }
        except Exception as e:
            print("ChartEngine load cash bhav warning:", e)

        self._cached_symbols = list(symbols_map.values())
        self._last_load = time.time()
        print(f"[ChartEngine] Indexed {len(self._cached_symbols)} global symbols.")

    def get_symbols(self, query: str = "") -> List[Dict[str, Any]]:
        if not self._cached_symbols:
            self._load_metadata()
        q = (query or "").strip().upper()
        if not q:
            return self._cached_symbols[:80]
        exact_matches = []
        prefix_matches = []
        contains_matches = []
        for s in self._cached_symbols:
            sym = s["symbol"].upper()
            name = s["name"].upper()
            if sym == q:
                exact_matches.append(s)
            elif sym.startswith(q):
                prefix_matches.append(s)
            elif q in sym or q in name:
                contains_matches.append(s)
        results = exact_matches + prefix_matches + contains_matches
        return results[:50]

    def get_symbol_quote(self, symbol: str) -> Dict[str, Any]:
        """Returns snapshot quote and derivatives summary for symbol."""
        sym = (symbol or "NIFTY").upper().strip()
        # Clean symbol if prefixed by NSE:
        if ":" in sym:
            sym = sym.split(":")[-1]

        # Defaults
        quote = {
            "symbol": sym,
            "tv_symbol": f"NSE:{sym}",
            "ltp": 0.0,
            "change": 0.0,
            "change_pct": 0.0,
            "open": 0.0,
            "high": 0.0,
            "low": 0.0,
            "prev_close": 0.0,
            "volume": 0,
            "avg_volume": 0,
            "delivery_pct": 0.0,
            "future_oi": 0,
            "oi_change_pct": 0.0,
            "buildup": "Neutral",
            "rollover_pct": 0.0,
            "pcr": 1.0,
            "max_pain": 0.0,
            "isIndex": sym in ("NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX")
        }

        # Check F&O Master
        try:
            if os.path.exists(MASTER_FO_PATH):
                with open(MASTER_FO_PATH, "r", encoding="utf-8") as f:
                    master = json.load(f)
                    sym_dict = master.get("symbols_data", {})
                    rows = sym_dict.get(sym)
                    if rows and len(rows) > 0:
                        last_row = rows[-1]
                        prev_row = rows[-2] if len(rows) > 1 else last_row
                        c = float(last_row.get("c", 0.0))
                        prev_c = float(prev_row.get("c", c))
                        chg = round(c - prev_c, 2)
                        chg_pct = round((chg / prev_c * 100), 2) if prev_c else 0.0
                        quote["ltp"] = c
                        quote["change"] = chg
                        quote["change_pct"] = chg_pct
                        quote["open"] = float(last_row.get("o", c))
                        quote["high"] = float(last_row.get("h", c))
                        quote["low"] = float(last_row.get("l", c))
                        quote["prev_close"] = prev_c
                        quote["volume"] = int(last_row.get("v", 0))
                        quote["future_oi"] = int(last_row.get("oi", 0))
                        prev_oi = int(prev_row.get("oi", quote["future_oi"]))
                        oi_diff = quote["future_oi"] - prev_oi
                        quote["oi_change_pct"] = round((oi_diff / prev_oi * 100), 2) if prev_oi else 0.0

                        # Buildup logic
                        if chg >= 0 and oi_diff >= 0:
                            quote["buildup"] = "Long Buildup"
                        elif chg < 0 and oi_diff >= 0:
                            quote["buildup"] = "Short Buildup"
                        elif chg >= 0 and oi_diff < 0:
                            quote["buildup"] = "Short Covering"
                        else:
                            quote["buildup"] = "Long Unwinding"
        except Exception as e:
            print("Quote F&O read error:", e)

        # Check Rollover data if available
        try:
            if os.path.exists(LATEST_ROLLOVER_PATH):
                with open(LATEST_ROLLOVER_PATH, "r", encoding="utf-8") as f:
                    ro_data = json.load(f)
                    matrix = ro_data.get("matrix", []) if isinstance(ro_data, dict) else ro_data
                    for r in matrix:
                        if r.get("symbol") == sym:
                            quote["rollover_pct"] = float(r.get("rollover_pct", 0.0))
                            quote["pcr"] = float(r.get("pcr", quote["pcr"]))
                            quote["max_pain"] = float(r.get("max_pain", 0.0))
                            break
        except Exception as e:
            pass

        return quote

    def get_symbol_history(self, symbol: str) -> Dict[str, Any]:
        """Returns historical daily candles with OHLCV and OI for charting."""
        sym = (symbol or "NIFTY").upper().strip()
        if ":" in sym:
            sym = sym.split(":")[-1]

        bars = []
        # Check F&O master first
        try:
            if os.path.exists(MASTER_FO_PATH):
                with open(MASTER_FO_PATH, "r", encoding="utf-8") as f:
                    master = json.load(f)
                    sym_dict = master.get("symbols_data", {})
                    rows = sym_dict.get(sym, [])
                    prev_c = None
                    prev_oi = None
                    for r in rows:
                        d_str = str(r.get("date", ""))
                        # Format YYYYMMDD to YYYY-MM-DD
                        if len(d_str) == 8:
                            d_fmt = f"{d_str[:4]}-{d_str[4:6]}-{d_str[6:]}"
                        else:
                            d_fmt = d_str
                        o = float(r.get("o", 0.0))
                        h = float(r.get("h", 0.0))
                        l = float(r.get("l", 0.0))
                        c = float(r.get("c", 0.0))
                        v = int(r.get("v", 0))
                        oi = int(r.get("oi", 0))

                        # Buildup
                        p_diff = (c - prev_c) if prev_c is not None else 0
                        oi_diff = (oi - prev_oi) if prev_oi is not None else 0
                        if p_diff >= 0 and oi_diff >= 0:
                            buildup = "Long Buildup"
                        elif p_diff < 0 and oi_diff >= 0:
                            buildup = "Short Buildup"
                        elif p_diff >= 0 and oi_diff < 0:
                            buildup = "Short Covering"
                        else:
                            buildup = "Long Unwinding"

                        bars.append({
                            "time": d_fmt,
                            "open": o,
                            "high": h,
                            "low": l,
                            "close": c,
                            "volume": v,
                            "oi": oi,
                            "oi_change": oi_diff,
                            "buildup": buildup
                        })
                        prev_c = c
                        prev_oi = oi
        except Exception as e:
            print("History load error:", e)

        return {
            "ok": True,
            "symbol": sym,
            "tv_symbol": f"NSE:{sym}",
            "count": len(bars),
            "bars": bars
        }

chart_engine = ChartEngine()
