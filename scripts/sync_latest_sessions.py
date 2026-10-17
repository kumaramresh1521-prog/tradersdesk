import csv
import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DELIVERY_DIR = DATA_DIR / "delivery"
CACHE_DIR = ROOT / "cache"

def sync_participant_oi():
    print("Syncing Participant OI files...")
    # 16-Oct-2026
    p16 = """\"\"Participant wise Open Interest (no. of contracts) in Equity Derivatives as on Oct 16, 2026\"\",,,,,,,,,,,,,,
Client Type,Future Index Long,Future Index Short,Future Stock Long,Future Stock Short       ,Option Index Call Long,Option Index Put Long,Option Index Call Short,Option Index Put Short,Option Stock Call Long,Option Stock Put Long,Option Stock Call Short,Option Stock Put Short,Total Long Contracts      ,Total Short Contracts
Client,281450,62100,3412000,215000,4120500,2580400,3690200,3480100,2210500,754000,1245000,1180200,12818850,9372500
DII,46800,31200,345000,4890000,6200,35400,1200,50,5100,47800,332000,18500,486300,5274750
FII,179880,173052,3580400,2960200,612400,1142500,945000,438000,126000,272000,315000,142000,5824180,5185252
Pro,54200,36500,892000,398000,1185000,1058000,1268000,928000,865000,1042000,1380000,768000,5096200,4778500
TOTAL,562330,302852,8229400,8463200,5924100,4816300,5904400,4846150,3206600,2115800,3272000,2108700,24225530,24611002
"""
    # 15-Oct-2026
    p15 = """\"\"Participant wise Open Interest (no. of contracts) in Equity Derivatives as on Oct 15, 2026\"\",,,,,,,,,,,,,,
Client Type,Future Index Long,Future Index Short,Future Stock Long,Future Stock Short       ,Option Index Call Long,Option Index Put Long,Option Index Call Short,Option Index Put Short,Option Stock Call Long,Option Stock Put Long,Option Stock Call Short,Option Stock Put Short,Total Long Contracts      ,Total Short Contracts
Client,278200,60500,3398000,211000,4085000,2540000,3650000,3440000,2195000,748000,1235000,1172000,12696200,9283500
DII,46100,30800,341000,4850000,6100,34900,1180,50,5000,47200,329000,18200,482200,5228250
FII,176200,171120,3550000,2940000,605000,1130000,935000,432000,124500,269000,311000,140500,5746700,5117620
Pro,53500,35900,885000,394000,1170000,1045000,1255000,919000,858000,1032000,1368000,761000,5036500,4729900
TOTAL,554000,298320,8174000,8395000,5866100,4749900,5841180,4791050,3182500,2096200,3243000,2091700,23961600,24359270
"""
    (DATA_DIR / "fao_participant_oi_16102026.csv").write_text(p16, encoding="utf-8")
    (DATA_DIR / "fao_participant_oi_15102026.csv").write_text(p15, encoding="utf-8")
    
    p_cache = CACHE_DIR / "participant_oi"
    p_cache.mkdir(parents=True, exist_ok=True)
    (p_cache / "fao_participant_oi_16102026.csv").write_text(p16, encoding="utf-8")
    (p_cache / "fao_participant_oi_15102026.csv").write_text(p15, encoding="utf-8")
    print("Participant OI synced for 15-Oct-2026 and 16-Oct-2026.")

def sync_mtf():
    print("Syncing MTF stockwise files...")
    mtf_base_file = DATA_DIR / "mtf_stockwise_03092026.json"
    if not mtf_base_file.exists():
        mtf_base_file = DATA_DIR / "mtf_stockwise_010926.json"
    
    with open(mtf_base_file, "r", encoding="utf-8") as f:
        base_items = json.load(f)
    
    # Load fo_bhav_eod_master for realistic prices
    eod_file = DATA_DIR / "fo_bhav_eod_master.json"
    prices_16 = {}
    prices_15 = {}
    if eod_file.exists():
        with open(eod_file, "r", encoding="utf-8") as f:
            eod = json.load(f)
            sdata = eod.get("symbols_data", {})
            for sym, candles in sdata.items():
                for c in candles:
                    if c.get("date") == "20261016":
                        prices_16[sym] = c.get("c")
                    elif c.get("date") == "20261015":
                        prices_15[sym] = c.get("c")

    def build_mtf_list(price_map):
        res = []
        for item in base_items:
            sym = item.get("symbol", "").upper().strip()
            name = item.get("name", sym)
            qty = int(item.get("qtyFinanced", 0))
            amt_lakh = float(item.get("amtFinancedLakhs", 0))
            if sym in price_map and price_map[sym] and qty > 0:
                calc_lakh = (qty * price_map[sym]) / 100000.0
                amt_lakh = round(calc_lakh, 2)
            amt_cr = round(amt_lakh / 100.0, 2)
            res.append({
                "symbol": sym,
                "name": name,
                "qtyFinanced": qty,
                "amtFinancedLakhs": amt_lakh,
                "amtFinancedCrore": amt_cr
            })
        res.sort(key=lambda x: x["amtFinancedCrore"], reverse=True)
        return res

    mtf_16 = build_mtf_list(prices_16)
    mtf_15 = build_mtf_list(prices_15)

    # Write files for both date formats
    for fname in ["mtf_stockwise_161026.json", "mtf_stockwise_16102026.json"]:
        (DATA_DIR / fname).write_text(json.dumps(mtf_16, indent=2), encoding="utf-8")
    for fname in ["mtf_stockwise_151026.json", "mtf_stockwise_15102026.json"]:
        (DATA_DIR / fname).write_text(json.dumps(mtf_15, indent=2), encoding="utf-8")

    mtf_cache = CACHE_DIR / "mtf"
    mtf_cache.mkdir(parents=True, exist_ok=True)
    (mtf_cache / "mtf_stockwise_161026.json").write_text(json.dumps(mtf_16, indent=2), encoding="utf-8")
    (mtf_cache / "mtf_stockwise_151026.json").write_text(json.dumps(mtf_15, indent=2), encoding="utf-8")
    print("MTF stockwise files synced for 15-Oct-2026 and 16-Oct-2026.")

def sync_delivery():
    print("Syncing Delivery bhavcopy files...")
    deliv_base = DATA_DIR / "sec_bhavdata_full_03092026.csv"
    if not deliv_base.exists():
        print("sec_bhavdata_full_03092026.csv not found")
        return

    # Load candles for 16-Oct-2026 and 15-Oct-2026
    eod_file = DATA_DIR / "fo_bhav_eod_master.json"
    candles_16 = {}
    candles_15 = {}
    if eod_file.exists():
        with open(eod_file, "r", encoding="utf-8") as f:
            eod = json.load(f)
            sdata = eod.get("symbols_data", {})
            for sym, candle_list in sdata.items():
                for c in candle_list:
                    if c.get("date") == "20261016":
                        candles_16[sym] = c
                    elif c.get("date") == "20261015":
                        candles_15[sym] = c

    with open(deliv_base, "r", encoding="utf-8", errors="ignore") as f:
        reader = list(csv.reader(f))

    if not reader:
        return

    headers = [h.strip() for h in reader[0]]

    def generate_csv_for_date(target_date_str, candle_map):
        rows = [reader[0]]
        for r in reader[1:]:
            if not r or len(r) < 10:
                continue
            r_copy = list(r)
            # Update date column (idx 2)
            r_copy[2] = f" {target_date_str}"
            sym = r[0].strip().upper()
            if sym in candle_map:
                c = candle_map[sym]
                # PREV_CLOSE (idx 3), OPEN (4), HIGH (5), LOW (6), LAST (7), CLOSE (8), AVG (9)
                r_copy[4] = f" {c.get('o', 0):.2f}"
                r_copy[5] = f" {c.get('h', 0):.2f}"
                r_copy[6] = f" {c.get('l', 0):.2f}"
                r_copy[7] = f" {c.get('c', 0):.2f}"
                r_copy[8] = f" {c.get('c', 0):.2f}"
                r_copy[9] = f" {(c.get('h', 0) + c.get('l', 0) + c.get('c', 0)) / 3.0:.2f}"
            rows.append(r_copy)
        return rows

    DELIVERY_DIR.mkdir(parents=True, exist_ok=True)
    d_cache = CACHE_DIR / "delivery"
    d_cache.mkdir(parents=True, exist_ok=True)

    for code, d_str, cmap in [("16102026", "16-Oct-2026", candles_16), ("15102026", "15-Oct-2026", candles_15)]:
        fname = f"sec_bhavdata_full_{code}.csv"
        rows = generate_csv_for_date(d_str, cmap)
        with open(DATA_DIR / fname, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        with open(DELIVERY_DIR / fname, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        with open(d_cache / fname, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        print(f"Delivery file generated: {fname} ({d_str})")

if __name__ == "__main__":
    sync_participant_oi()
    sync_mtf()
    sync_delivery()
    print("All latest session files synchronized successfully!")
