"""
Builds official EOD PCR (Put-Call Ratio) and Black-Scholes ATM IV (Implied Volatility)
for all symbols across all historical NSE F&O Bhavcopy files.
Saves to data/fo_pcr_iv_master.json and updates data/fo_bhav_eod_master.json.
"""
import os
import csv
import math
import glob
import json
import time
import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FO_BHAV_DIR = ROOT / "cache" / "fo_bhav"
PCR_IV_MASTER_FILE = ROOT / "data" / "fo_pcr_iv_master.json"
FO_BHAV_MASTER_FILE = ROOT / "data" / "fo_bhav_eod_master.json"

def bs_call_price(S, K, T, r, sigma):
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    cumnorm_d1 = 0.5 * (1.0 + math.erf(d1 / math.sqrt(2.0)))
    cumnorm_d2 = 0.5 * (1.0 + math.erf(d2 / math.sqrt(2.0)))
    return S * cumnorm_d1 - K * math.exp(-r * T) * cumnorm_d2

def implied_vol(price, S, K, T, r=0.07, is_call=True):
    if price <= 0.05 or T <= 0 or S <= 0 or K <= 0:
        return None
    intrinsic = max(0.0, S - K) if is_call else max(0.0, K - S)
    if price <= intrinsic:
        return None
    low, high = 0.03, 2.5
    for _ in range(22):
        mid = (low + high) / 2.0
        p = bs_call_price(S, K, T, r, mid) if is_call else (bs_call_price(S, K, T, r, mid) - S + K * math.exp(-r * T))
        if abs(p - price) < 0.08:
            return round(mid * 100.0, 1)
        if p > price:
            high = mid
        else:
            low = mid
    return round(mid * 100.0, 1)

def build_pcr_iv_master():
    csv_files = sorted(FO_BHAV_DIR.glob("BhavCopy_NSE_FO_*.csv")) if FO_BHAV_DIR.exists() else []
    print(f"[build_pcr_iv_master] Found {len(csv_files)} F&O Bhavcopy files.")
    t0 = time.time()

    # symbol -> date -> {pcr, iv, pe_oi, ce_oi}
    master_by_sym = {}

    for idx, fpath in enumerate(csv_files):
        dt_str = fpath.stem.replace("BhavCopy_NSE_FO_", "")
        try:
            dt = datetime.date(int(dt_str[:4]), int(dt_str[4:6]), int(dt_str[6:8]))
        except Exception:
            continue

        sym_fut = {}
        sym_opts = {}

        with open(fpath, "r", encoding="utf-8", errors="ignore") as fp:
            reader = csv.DictReader(fp)
            for r in reader:
                sym = (r.get("TckrSymb") or "").strip().upper()
                if not sym:
                    continue
                tp = (r.get("FinInstrmTp") or "").strip().upper()

                if tp in ("STF", "IDF", "FUTSTK", "FUTIDX"):
                    try:
                        c = float(r.get("ClsPric") or r.get("LastPric") or 0.0)
                        xpry = (r.get("XpryDt") or "").strip().replace("-", "")
                        if c > 0 and xpry:
                            if sym not in sym_fut:
                                sym_fut[sym] = []
                            sym_fut[sym].append((xpry, c))
                    except Exception:
                        pass
                elif tp in ("STO", "IDO", "OPTSTK", "OPTIDX"):
                    try:
                        oi = int(float(r.get("OpnIntrst") or 0))
                        ot = (r.get("OptnTp") or "").strip().upper()
                        k = float(r.get("StrkPric") or 0)
                        xpry = (r.get("XpryDt") or "").strip()
                        px = float(r.get("ClsPric") or r.get("SttlmPric") or 0)
                        und = float(r.get("UndrlygPric") or 0)

                        if sym not in sym_opts:
                            sym_opts[sym] = {"pe_oi": 0, "ce_oi": 0, "contracts": [], "und": und}
                        if und > 0 and sym_opts[sym]["und"] == 0:
                            sym_opts[sym]["und"] = und
                        if ot == "PE":
                            sym_opts[sym]["pe_oi"] += oi
                        elif ot == "CE":
                            sym_opts[sym]["ce_oi"] += oi
                        sym_opts[sym]["contracts"].append((xpry, ot, k, px))
                    except Exception:
                        pass

        dt_dash = f"{dt_str[:4]}-{dt_str[4:6]}-{dt_str[6:8]}"

        for sym, opt_info in sym_opts.items():
            pe = opt_info["pe_oi"]
            ce = opt_info["ce_oi"]
            pcr = round(pe / ce, 2) if ce > 0 else 1.0

            spot = opt_info["und"]
            if spot <= 0 and sym in sym_fut and sym_fut[sym]:
                sym_fut[sym].sort(key=lambda x: x[0])
                near_c = next((x[1] for x in sym_fut[sym] if x[0] >= dt_str), sym_fut[sym][0][1])
                spot = near_c

            final_iv = None
            if spot > 0:
                contracts = opt_info["contracts"]
                expiries = sorted(list(set(c[0] for c in contracts if c[0] >= dt_dash)))
                chosen_exp = None
                for exp in expiries:
                    try:
                        d = datetime.datetime.strptime(exp, "%Y-%m-%d").date()
                        if (d - dt).days >= 2:
                            chosen_exp = exp
                            break
                    except Exception:
                        pass
                if not chosen_exp and expiries:
                    chosen_exp = expiries[0]

                if chosen_exp:
                    try:
                        exp_d = datetime.datetime.strptime(chosen_exp, "%Y-%m-%d").date()
                        dte = max(1, (exp_d - dt).days)
                        T = dte / 365.0
                        sub = [c for c in contracts if c[0] == chosen_exp]
                        strikes = sorted(list(set(c[2] for c in sub)))
                        if strikes:
                            atm_k = min(strikes, key=lambda k: abs(k - spot))
                            ce_c = next((c for c in sub if c[2] == atm_k and c[1] == "CE"), None)
                            pe_c = next((c for c in sub if c[2] == atm_k and c[1] == "PE"), None)
                            ce_px = ce_c[3] if ce_c else 0
                            pe_px = pe_c[3] if pe_c else 0

                            civ = implied_vol(ce_px, spot, atm_k, T, is_call=True)
                            piv = implied_vol(pe_px, spot, atm_k, T, is_call=False)
                            iv_cands = [v for v in (civ, piv) if v and 5.0 <= v <= 120.0]
                            if iv_cands:
                                final_iv = round(sum(iv_cands) / len(iv_cands), 1)
                    except Exception:
                        pass

            if sym not in master_by_sym:
                master_by_sym[sym] = {}
            master_by_sym[sym][dt_str] = {
                "pcr": pcr,
                "iv": final_iv,
                "pe_oi": pe,
                "ce_oi": ce
            }

        if (idx + 1) % 15 == 0 or idx == len(csv_files) - 1:
            print(f"[build_pcr_iv_master] Processed {idx + 1}/{len(csv_files)} files...")

    # Save to data/fo_pcr_iv_master.json
    PCR_IV_MASTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PCR_IV_MASTER_FILE, "w", encoding="utf-8") as f:
        json.dump(master_by_sym, f, indent=1)
    print(f"[build_pcr_iv_master] Saved {len(master_by_sym)} symbols to {PCR_IV_MASTER_FILE}")

    # Now update data/fo_bhav_eod_master.json and cache/fo_bhav_eod_master.json
    for master_path in (FO_BHAV_MASTER_FILE, ROOT / "cache" / "fo_bhav_eod_master.json"):
        if master_path.exists():
            try:
                with open(master_path, "r", encoding="utf-8") as f:
                    master_data = json.load(f)
                symbols_data = master_data.get("symbols_data", {})
                updated_count = 0
                for sym, sessions in symbols_data.items():
                    sym_dict = master_by_sym.get(sym, {})
                    for s in sessions:
                        d_str = s.get("date")
                        if d_str and d_str in sym_dict:
                            rec = sym_dict[d_str]
                            s["pcr"] = rec["pcr"]
                            if rec["iv"] is not None:
                                s["iv"] = rec["iv"]
                            updated_count += 1
                with open(master_path, "w", encoding="utf-8") as f:
                    json.dump(master_data, f)
                print(f"[build_pcr_iv_master] Updated {updated_count} session records in {master_path}")
            except Exception as e:
                print(f"[build_pcr_iv_master] Error updating {master_path}:", e)

    t1 = time.time()
    print(f"[build_pcr_iv_master] Finished successfully in {t1 - t0:.2f}s!")

if __name__ == "__main__":
    build_pcr_iv_master()
