"""
seo_engine.py
Dynamic Full-Stack SEO & Metadata Injection Engine for TradersDesk.in.
Injects route-specific <title>, <meta description>, <link rel="canonical">,
Open Graph (og:title, og:desc, og:url), and Twitter Card meta tags into
server-rendered HTML responses, ensuring 100% crawlability for Googlebot,
Bing, and social unfurling bots for every platform URL.
"""

from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEO_CONFIG_FILE = ROOT / "seo_config.json"

DEFAULT_SEO_CONFIG = {
    "site_title": "TradersDesk.in | Institutional Derivatives, Options Greeks & Market Breadth Terminal",
    "meta_description": "TradersDesk.in — Institutional-grade Indian derivatives analytics, real-time Option Chain Pro, Black-Scholes Greeks (Delta, Gamma, Theta, Vega), ATM Straddles, Market Breadth & FII/DII Smart Money flow.",
    "keywords": "TradersDesk, tradersdesk.in, option chain, nifty option chain, bank nifty option chain, options greeks, max pain, pcr ratio, market breadth, fii dii activity, atm straddle, open interest analysis",
    "canonical_url": "https://tradersdesk.in/",
    "google_site_verification": "",
    "google_analytics_id": "",
    "og_title": "TradersDesk.in | Institutional Derivatives & Options Analytics Terminal",
    "og_description": "Sub-second Indian Option Chain Pro, Black-Scholes Greeks, Max Pain, ATM Straddles, and Live Market Breadth.",
    "author": "TradersDesk.in Quantitative Analytics",
    "sitemap_url": "https://tradersdesk.in/sitemap.xml",
    "robots_indexing": True
}

# ── Complete Route-by-Route SEO Catalog ────────────────────────────────────────
SEO_ROUTES: dict[str, dict[str, str]] = {
    "/": {
        "title": "TradersDesk.in | Institutional Derivatives, Options Greeks & Market Breadth Terminal",
        "desc": "TradersDesk.in — Institutional-grade Indian derivatives analytics, real-time Options Chain Pro, Black-Scholes Greeks (Delta, Gamma, Theta, Vega), Max Pain, Multi-Strike OI, Market Breadth & FII/DII Smart Money positioning.",
        "keywords": "TradersDesk, tradersdesk.in, option chain, nifty option chain, bank nifty option chain, options greeks, max pain, pcr ratio, market breadth, fii dii activity, open interest analysis",
        "canonical": "https://tradersdesk.in/",
    },
    "/dashboard": {
        "title": "Institutional Trading Terminal Dashboard | TradersDesk",
        "desc": "Real-time market pulse dashboard tracking GIFT Nifty, India VIX, Nifty advance-decline, sector heatmaps, and institutional liquidity flows.",
        "keywords": "market dashboard, live nifty 50, india vix, market pulse, institutional terminal, gift nifty",
        "canonical": "https://tradersdesk.in/dashboard",
    },
    "/option-chain-pro": {
        "title": "Option Chain Pro - Live Option Greeks, PCR & Multi-Strike OI Scanner | TradersDesk",
        "desc": "Direct exchange streaming Option Chain Pro with real-time Option Greeks (Delta, Gamma, Theta, Vega, IV), ATM Straddles & dynamic weekly/monthly expiries across NSE.",
        "keywords": "option chain pro, nse option chain, live options greeks, delta, gamma, theta, vega, iv skew, pcr ratio, max pain, multi-strike oi",
        "canonical": "https://tradersdesk.in/option-chain-pro",
    },
    "/options": {
        "title": "Option Chain Pro - Live Option Greeks, PCR & Multi-Strike OI Scanner | TradersDesk",
        "desc": "Direct exchange streaming Option Chain Pro with real-time Option Greeks (Delta, Gamma, Theta, Vega, IV), ATM Straddles & dynamic weekly/monthly expiries across NSE.",
        "keywords": "option chain, options greeks, nse options, real time option chain, tradersdesk options",
        "canonical": "https://tradersdesk.in/option-chain-pro",
    },
    "/futures": {
        "title": "Futures Intelligence Desk - Live Open Interest, Buildup & MWPL Ban Tracker | TradersDesk",
        "desc": "Institutional futures desk tracking live Open Interest buildup, Long/Short unwinding, MWPL exposure, F&O ban period, and sector heatmaps across NSE F&O equities.",
        "keywords": "futures intelligence, live futures screener, open interest, cost of carry, futures basis, nse f&o",
        "canonical": "https://tradersdesk.in/futures",
    },
    "/futures/marketwatch": {
        "title": "Futures Marketwatch - Live F&O Contracts Screener | TradersDesk",
        "desc": "Real-time futures contracts screener, Open Interest volume, and basis premiums across NSE equities.",
        "keywords": "futures marketwatch, contracts matrix, ltp, volume leaders, futures oi",
        "canonical": "https://tradersdesk.in/futures/marketwatch",
    },
    "/futures/buildup": {
        "title": "Futures Buildup Quadrants - Long & Short Buildup Scanner | TradersDesk",
        "desc": "Real-time Long Buildup, Short Buildup, Short Covering, and Long Unwinding quadrants across NSE F&O equities and indices.",
        "keywords": "futures buildup, long buildup scanner, short buildup, short covering, long unwinding, f&o quadrant",
        "canonical": "https://tradersdesk.in/futures/buildup",
    },
    "/futures/heatmap": {
        "title": "Futures & Options Heatmap - Sector & Stock Heatmaps | TradersDesk",
        "desc": "Multi-sector institutional F&O heatmap visualizing price vs OI change clusters, sector momentum leadership, and contract basis.",
        "keywords": "f&o heatmap, sector heatmap, oi heatmap, stock momentum, price oi clusters",
        "canonical": "https://tradersdesk.in/futures/heatmap",
    },
    "/futures/heatmaps": {
        "title": "Futures & Options Heatmap - Sector & Stock Heatmaps | TradersDesk",
        "desc": "Multi-sector institutional F&O heatmap visualizing price vs OI change clusters, sector momentum leadership, and contract basis.",
        "keywords": "f&o heatmap, sector heatmap, oi heatmap, stock momentum",
        "canonical": "https://tradersdesk.in/futures/heatmap",
    },
    "/futures/indices": {
        "title": "Index Futures Intelligence Desk - Nifty, Bank Nifty & Fin Nifty | TradersDesk",
        "desc": "Deep-dive analysis into Index Futures contracts, rollover cost, cash-futures basis, and institutional positioning.",
        "keywords": "index futures, nifty futures, bank nifty futures, fin nifty futures, cash futures basis",
        "canonical": "https://tradersdesk.in/futures/indices",
    },
    "/futures/mwpl": {
        "title": "MWPL & F&O Ban Tracker Desk - Market-Wide Position Limit Radar | TradersDesk",
        "desc": "Real-time Market-Wide Position Limit (MWPL) utilization tracker and upcoming NSE F&O ban entries, alerts, and exit candidates.",
        "keywords": "mwpl tracker, f&o ban radar, market wide position limit, nse ban period, ban list",
        "canonical": "https://tradersdesk.in/futures/mwpl",
    },
    "/futures/rollover": {
        "title": "Futures Rollover Matrix - Expiry Rollover Tracker | TradersDesk",
        "desc": "Institutional expiry rollover matrix, rollover percentage, and rollover cost tracking across active expiries.",
        "keywords": "futures rollover matrix, expiry rollover, rollover percentage, rollover cost, nse expiry",
        "canonical": "https://tradersdesk.in/futures/rollover",
    },
    "/breadth": {
        "title": "Market Breadth & Point and Figure (PnF) Analytics Desk | TradersDesk",
        "desc": "Institutional Market Breadth engine with Point & Figure (PnF) column matrices, advance-decline ratios, and sector breadth momentum distribution.",
        "keywords": "market breadth, pnf breadth, point and figure, advance decline ratio, sector breadth, ad line, nse breadth",
        "canonical": "https://tradersdesk.in/breadth",
    },
    "/market-breadth": {
        "title": "Market Breadth & Point and Figure (PnF) Analytics Desk | TradersDesk",
        "desc": "Institutional Market Breadth engine with Point & Figure (PnF) column matrices, advance-decline ratios, and sector breadth momentum distribution.",
        "keywords": "market breadth, point and figure, pnf breadth, advance decline ratio, sector breadth, ad line",
        "canonical": "https://tradersdesk.in/breadth",
    },
    "/fii-dii": {
        "title": "FII / DII Smart Money Flow - Institutional Cash & Derivatives Positioning | TradersDesk",
        "desc": "Track institutional smart money flows, FII/DII net daily purchases, Index Futures long/short positioning, and Participant OI distribution.",
        "keywords": "fii dii data, institutional smart money, fii net flow, dii buying, index futures long short ratio, participant oi",
        "canonical": "https://tradersdesk.in/fii-dii",
    },
    "/smart-money": {
        "title": "FII / DII Smart Money Flow - Institutional Cash & Derivatives Positioning | TradersDesk",
        "desc": "Track institutional smart money flows, FII/DII net daily purchases, Index Futures long/short positioning, and options activity.",
        "keywords": "smart money flow, fii dii activity, institutional positioning",
        "canonical": "https://tradersdesk.in/fii-dii",
    },
    "/fii-dii-derivatives": {
        "title": "FII / DII Smart Money Flow - Institutional Derivatives Positioning | TradersDesk",
        "desc": "Track institutional smart money flows, FII/DII net daily purchases, Index Futures long/short positioning, and options activity.",
        "keywords": "fii derivatives, index futures positioning, participant oi",
        "canonical": "https://tradersdesk.in/fii-dii",
    },
    "/fii-dii-cash": {
        "title": "FII / DII Cash Market Flow - Historical Institutional Inflow & Outflow | TradersDesk",
        "desc": "Historical and intraday FII / DII cash market flow with monthly/annual totals, cumulative institutional liquidity charts, and market impact analysis.",
        "keywords": "fii dii cash market, institutional cash inflow, fii buying history, dii cash purchases",
        "canonical": "https://tradersdesk.in/fii-dii-cash",
    },
    "/mtf": {
        "title": "MTF Analytics - Margin Trading Facility Book & Stock Leverage Tracker | TradersDesk",
        "desc": "Comprehensive Margin Trading Facility (MTF) analytics tracking stock leverage, aggregate MTF loan exposure, daily financing trends, and category distribution.",
        "keywords": "mtf analytics, margin trading facility, stock leverage tracker, mtf book, sebi mtf data",
        "canonical": "https://tradersdesk.in/mtf",
    },
    "/mtf-analytics": {
        "title": "MTF Analytics - Margin Trading Facility Book & Stock Leverage Tracker | TradersDesk",
        "desc": "Comprehensive Margin Trading Facility (MTF) analytics tracking stock leverage, aggregate MTF loan exposure, daily financing trends, and category distribution.",
        "keywords": "mtf analytics, margin trading facility, stock leverage tracker, mtf book, sebi mtf data",
        "canonical": "https://tradersdesk.in/mtf",
    },
    "/mtf/overview": {
        "title": "MTF Overview - Aggregate Margin Trading Book & Fresh Exposure | TradersDesk",
        "desc": "Real-time overview of NSE & BSE Margin Trading Facility (MTF) loan book, daily fresh exposure, liquidated positions, and market pulse.",
        "keywords": "mtf overview, nse mtf book, bse mtf book, fresh mtf exposure, margin trading facility",
        "canonical": "https://tradersdesk.in/mtf/overview",
    },
    "/mtf/topstocks": {
        "title": "Top MTF Stocks Screener - Heavily Financed Securities Ranking | TradersDesk",
        "desc": "Screener ranking top equities by MTF funded book size, share of aggregate broker exposure, financed quantity, and concentration.",
        "keywords": "top mtf stocks, mtf screener, financed securities, mtf heavyweights, stock leverage",
        "canonical": "https://tradersdesk.in/mtf/topstocks",
    },
    "/mtf/retail": {
        "title": "Retail vs Institutional MTF Leverage Distribution | TradersDesk",
        "desc": "Segmentation of margin trading loan exposure into retail-heavy momentum scrips vs institutional bluechip anchors and speculative penny debt.",
        "keywords": "retail mtf leverage, institutional mtf book, speculative debt, mtf crowd sentiment",
        "canonical": "https://tradersdesk.in/mtf/retail",
    },
    "/mtf/movers": {
        "title": "MTF Movers & Short Squeeze Radar - Daily Leverage Surges | TradersDesk",
        "desc": "Track top daily surges and drops in MTF financing, short squeeze candidates, and rapid expansion in retail leverage.",
        "keywords": "mtf movers, short squeeze radar, leverage surge, margin expansion, rapid deleveraging",
        "canonical": "https://tradersdesk.in/mtf/movers",
    },
    "/mtf/sectors": {
        "title": "MTF Sector Breakdown - Industry Margin Exposure Heatmap | TradersDesk",
        "desc": "Sectoral allocation of Margin Trading Facility borrowing across Banking, IT, Auto, Energy, Metals, Pharma, and Infra.",
        "keywords": "mtf sector breakdown, industry leverage, banking mtf, auto mtf loan book",
        "canonical": "https://tradersdesk.in/mtf/sectors",
    },
    "/mtf/trend": {
        "title": "Historical MTF Leverage Trend & Multi-Session Growth | TradersDesk",
        "desc": "Historical multi-session trend of exchange MTF outstanding debt, systemic leverage expansion, and correlation with Nifty 50 spot.",
        "keywords": "mtf historical trend, multi-session leverage, mtf growth chart, systemic risk",
        "canonical": "https://tradersdesk.in/mtf/trend",
    },
    "/mtf/broker": {
        "title": "MTF Broker Desk - Brokerage Market Share & Lending Rates | TradersDesk",
        "desc": "Comparison of MTF broker terms, lending interest rates (Zerodha, Angel One, m.Stock, Dhan), and leverage guidelines.",
        "keywords": "mtf broker desk, mtf interest rate, zerodha mtf, angel one mtf, margin interest rate",
        "canonical": "https://tradersdesk.in/mtf/broker",
    },
    "/mtf/calculator": {
        "title": "Live MTF Leverage Calculator - Real-Time Margin & Carrying Cost | TradersDesk",
        "desc": "Real-time MTF margin calculator with live stock quote pre-fill, purchasing power simulation, daily interest carrying cost, and liquidation price.",
        "keywords": "mtf calculator, margin trading calculator, carrying cost calculator, mtf margin requirement, liquidation price",
        "canonical": "https://tradersdesk.in/mtf/calculator",
    },
    "/mtf/compare": {
        "title": "MTF Stock Comparison Desk - Head-to-Head Leverage Analytics | TradersDesk",
        "desc": "Compare two stocks head-to-head on MTF funded debt, historical leverage growth trends with interactive crosshair, and risk metrics.",
        "keywords": "mtf compare, stock leverage comparison, compare mtf book, head to head stock leverage",
        "canonical": "https://tradersdesk.in/mtf/compare",
    },
    "/compare": {
        "title": "MTF Stock Comparison Desk - Head-to-Head Leverage Analytics | TradersDesk",
        "desc": "Compare two stocks head-to-head on MTF funded debt, historical leverage growth trends with interactive crosshair, and risk metrics.",
        "keywords": "mtf compare, stock leverage comparison, compare mtf book",
        "canonical": "https://tradersdesk.in/compare",
    },
    "/delivery": {
        "title": "Delivery Analytics Desk - High Delivery Volume & Institutional Accumulation | TradersDesk",
        "desc": "Live delivery analytics detecting institutional accumulation, spike in delivery percentage, block deals, and high conviction cash volume.",
        "keywords": "delivery analytics, high delivery volume, institutional accumulation, delivery percentage spike, cash volume",
        "canonical": "https://tradersdesk.in/delivery",
    },
    "/delivery-analytics": {
        "title": "Delivery Analytics Desk - High Delivery Volume & Institutional Accumulation | TradersDesk",
        "desc": "Live delivery analytics detecting institutional accumulation, spike in delivery percentage, block deals, and high conviction cash volume.",
        "keywords": "delivery analytics, high delivery volume, institutional accumulation, delivery percentage spike, cash volume",
        "canonical": "https://tradersdesk.in/delivery",
    },
    "/delivery/scan": {
        "title": "Delivery Scanner - Institutional Cash Accumulation & Volume Shocks | TradersDesk",
        "desc": "Screen 1800+ NSE & BSE stocks for delivery volume shocks (>1.3x 5D avg), ultra-high delivery percentage (>60%), and institutional accumulation.",
        "keywords": "delivery scanner, institutional accumulation scanner, delivery volume shocks, nse cash delivery bhavcopy",
        "canonical": "https://tradersdesk.in/delivery/scan",
    },
    "/delivery/inspect": {
        "title": "Stock Delivery Inspector - Real-Time Delivery Breakdown & History | TradersDesk",
        "desc": "Deep security-wise delivery inspector with instant symbol search dropdown, multi-session delivery percentage trends, and institutional stance.",
        "keywords": "stock delivery inspector, security delivery position, delivery history chart, reliance delivery percentage",
        "canonical": "https://tradersdesk.in/delivery/inspect",
    },
    "/global-markets": {
        "title": "Global Markets Desk - GIFT Nifty & World Indices Macro Radar | TradersDesk",
        "desc": "Real-time GIFT Nifty, US markets (S&P 500, Nasdaq, Dow), Asian & European indices, Brent Crude, US 10Y Yield, and global macro pulse.",
        "keywords": "gift nifty, global markets, world indices, us markets, brent crude, dxy, macro pulse",
        "canonical": "https://tradersdesk.in/global-markets",
    },
    "/global": {
        "title": "Global Markets Desk - GIFT Nifty & World Indices Macro Radar | TradersDesk",
        "desc": "Real-time GIFT Nifty, US markets (S&P 500, Nasdaq, Dow), Asian & European indices, Brent Crude, US 10Y Yield, and global macro pulse.",
        "keywords": "global markets, gift nifty, world indices",
        "canonical": "https://tradersdesk.in/global-markets",
    },
    "/straddle": {
        "title": "Straddle Desk - Live Options Premium Decay, IV Crush & Greeks | TradersDesk",
        "desc": "Real-time Options Straddle chart tracking combined CE+PE premium decay, live intraday delta-neutral curves, IV crush, and synthetic futures.",
        "keywords": "options straddle, atm straddle chart, straddle decay, iv crush, delta neutral, combined premium, synthetic futures",
        "canonical": "https://tradersdesk.in/straddle",
    },
    "/atm-straddle": {
        "title": "Straddle Desk - Live Options Premium Decay, IV Crush & Greeks | TradersDesk",
        "desc": "Real-time Options Straddle chart tracking combined CE+PE premium decay, live intraday delta-neutral curves, IV crush, and synthetic futures.",
        "keywords": "options straddle, atm straddle chart, straddle decay, iv crush, delta neutral, combined premium, synthetic futures",
        "canonical": "https://tradersdesk.in/straddle",
    },
    "/breadth-contribution": {
        "title": "Breadth Contribution Desk - Point Contribution to Nifty & Sector Breakdown | TradersDesk",
        "desc": "Detailed stock-by-stock point contribution engine showing heavyweights driving Nifty 50, Bank Nifty, and sector rally or decline.",
        "keywords": "breadth contribution, nifty point contribution, heavyweight movers, reliance contribution, index movers",
        "canonical": "https://tradersdesk.in/breadth-contribution",
    },
    "/contribution": {
        "title": "Breadth Contribution Desk - Point Contribution to Nifty & Sector Breakdown | TradersDesk",
        "desc": "Detailed stock-by-stock point contribution engine showing heavyweights driving Nifty 50, Bank Nifty, and sector rally or decline.",
        "keywords": "breadth contribution, nifty point contribution, heavyweight movers",
        "canonical": "https://tradersdesk.in/breadth-contribution",
    },
    "/calendar-studio": {
        "title": "Calendar Spread Studio - Multi-Strike Calendar & Diagonal Engine | TradersDesk",
        "desc": "TradersDesk Institutional Calendar Spread Studio for time decay arbitrage, term structure visualization, and dynamic Greeks spread modeling.",
        "keywords": "calendar spread, options calendar, diagonal spread, time decay arbitrage, tradersdesk, options greeks, term structure",
        "canonical": "https://tradersdesk.in/calendar-studio",
    },
    "/calendar_studio.html": {
        "title": "Calendar Spread Studio - Multi-Strike Calendar & Diagonal Engine | TradersDesk",
        "desc": "TradersDesk Institutional Calendar Spread Studio for time decay arbitrage, term structure visualization, and dynamic Greeks spread modeling.",
        "keywords": "calendar spread, options calendar, diagonal spread, time decay arbitrage, tradersdesk, options greeks, term structure",
        "canonical": "https://tradersdesk.in/calendar-studio",
    },
    "/quant-tools": {
        "title": "Quantitative Trading Tools & Greeks Suite | TradersDesk",
        "desc": "Institutional-grade financial trading terminal with real-time analytics, Greeks model calculators, and volatility metrics.",
        "keywords": "quant tools, options calculator, black scholes calculator, volatility scanner",
        "canonical": "https://tradersdesk.in/quant-tools",
    },
    "/settings": {
        "title": "Terminal Settings & Broker Gateway | TradersDesk",
        "desc": "Configure trading terminal feeds, Upstox API credentials, Angel One integration, theme settings, and auto-refresh intervals.",
        "keywords": "terminal settings, broker gateway, smartapi config, upstox api config",
        "canonical": "https://tradersdesk.in/settings",
    },
    "/about": {
        "title": "Quantitative Model Methodologies & Architecture | TradersDesk",
        "desc": "Learn about TradersDesk's Black-Scholes Greeks engines, Point & Figure market breadth calculations, and institutional data pipelines.",
        "keywords": "about tradersdesk, quantitative models, black scholes engine, market breadth methodology",
        "canonical": "https://tradersdesk.in/about.html",
    },
    "/about.html": {
        "title": "Quantitative Model Methodologies & Architecture | TradersDesk",
        "desc": "Learn about TradersDesk's Black-Scholes Greeks engines, Point & Figure market breadth calculations, and institutional data pipelines.",
        "keywords": "about tradersdesk, quantitative models, black scholes engine, market breadth methodology",
        "canonical": "https://tradersdesk.in/about.html",
    },
    "/disclaimer": {
        "title": "SEBI Regulatory & Compliance Disclaimer | TradersDesk",
        "desc": "Important regulatory disclosures, SEBI compliance notices, and research terms for TradersDesk institutional analytics platform.",
        "keywords": "sebi disclaimer, regulatory disclosure, compliance notice, educational research only",
        "canonical": "https://tradersdesk.in/disclaimer.html",
    },
    "/disclaimer.html": {
        "title": "SEBI Regulatory & Compliance Disclaimer | TradersDesk",
        "desc": "Important regulatory disclosures, SEBI compliance notices, and research terms for TradersDesk institutional analytics platform.",
        "keywords": "sebi disclaimer, regulatory disclosure, compliance notice, educational research only",
        "canonical": "https://tradersdesk.in/disclaimer.html",
    },
    "/privacy": {
        "title": "Privacy Policy & Data Governance | TradersDesk",
        "desc": "TradersDesk privacy policy detailing data protection, broker credential safety, encryption standards, and user governance.",
        "keywords": "privacy policy, data governance, broker security, credential encryption",
        "canonical": "https://tradersdesk.in/privacy.html",
    },
    "/privacy.html": {
        "title": "Privacy Policy & Data Governance | TradersDesk",
        "desc": "TradersDesk privacy policy detailing data protection, broker credential safety, encryption standards, and user governance.",
        "keywords": "privacy policy, data governance, broker security, credential encryption",
        "canonical": "https://tradersdesk.in/privacy.html",
    },
    "/terms": {
        "title": "Terms of Institutional Service | TradersDesk",
        "desc": "Terms and conditions governing the use of the TradersDesk institutional market intelligence terminal and APIs.",
        "keywords": "terms of service, institutional terms, platform usage rules",
        "canonical": "https://tradersdesk.in/terms.html",
    },
    "/terms.html": {
        "title": "Terms of Institutional Service | TradersDesk",
        "desc": "Terms and conditions governing the use of the TradersDesk institutional market intelligence terminal and APIs.",
        "keywords": "terms of service, institutional terms, platform usage rules",
        "canonical": "https://tradersdesk.in/terms.html",
    },
}

import time

SEO_ROUTES_FILE = ROOT / "seo_routes.json"

def _detect_category(path: str) -> str:
    p = path.lower()
    if p in ("/", "/dashboard"):
        return "dashboard"
    if "/futures" in p or p.startswith("/futures"):
        return "futures"
    if "option" in p or "straddle" in p:
        return "options"
    if "/mtf" in p or p.startswith("/mtf") or "/compare" in p:
        return "mtf"
    if "/delivery" in p or p.startswith("/delivery"):
        return "delivery"
    if "/breadth" in p or p.startswith("/breadth") or "/contribution" in p:
        return "breadth"
    if "global" in p:
        return "global"
    if "fii" in p or "smart-money" in p:
        return "smart-money"
    if any(k in p for k in ("about", "privacy", "terms", "disclaimer")):
        return "legal"
    return "tools"

def load_seo_config() -> dict:
    if SEO_CONFIG_FILE.exists():
        try:
            data = json.loads(SEO_CONFIG_FILE.read_text(encoding="utf-8"))
            merged = DEFAULT_SEO_CONFIG.copy()
            merged.update(data)
            return merged
        except Exception:
            pass
    return DEFAULT_SEO_CONFIG.copy()

def save_seo_config(updates: dict) -> bool:
    try:
        current = load_seo_config()
        current.update(updates)
        SEO_CONFIG_FILE.write_text(json.dumps(current, indent=2), encoding="utf-8")
        apply_seo_to_index_html(current)
        return True
    except Exception as e:
        print(f"[SEO Engine] Error saving config: {e}")
        return False

def apply_seo_to_index_html(config: dict) -> bool:
    index_file = ROOT / "public" / "index.html"
    if not index_file.exists():
        return False
    try:
        content = index_file.read_text(encoding="utf-8")
        if "<title>" in content and "</title>" in content:
            pre = content.split("<title>")[0]
            post = content.split("</title>")[1]
            content = f"{pre}<title>{config['site_title']}</title>{post}"
        index_file.write_text(content, encoding="utf-8")
        return True
    except Exception as e:
        print(f"[SEO Engine] Error updating index.html: {e}")
        return False

def load_all_seo_routes() -> dict[str, dict]:
    """Loads all SEO route configurations from disk or initializes them from default catalog."""
    routes: dict[str, dict] = {}
    
    # 1. Base from built-in SEO_ROUTES
    for path, meta in SEO_ROUTES.items():
        clean_p = ("/" + path.strip("/")).lower() if path != "/" else "/"
        routes[clean_p] = {
            "path": clean_p,
            "title": meta.get("title", ""),
            "desc": meta.get("desc", ""),
            "keywords": meta.get("keywords", ""),
            "canonical": meta.get("canonical", f"https://tradersdesk.in{clean_p if clean_p != '/' else ''}"),
            "og_title": meta.get("title", ""),
            "og_desc": meta.get("desc", ""),
            "robots": "index, follow",
            "category": _detect_category(clean_p),
            "priority": "1.0" if clean_p == "/" else ("0.9" if clean_p in ("/futures", "/option-chain-pro", "/global-markets", "/mtf", "/breadth") else "0.8"),
            "changefreq": "always" if clean_p in ("/", "/futures", "/option-chain-pro", "/global-markets") else "daily",
            "custom": False,
            "last_updated": "2026-10-10 07:00:00 IST"
        }
    
    # 2. Overlay disk persistence if exists
    if SEO_ROUTES_FILE.exists():
        try:
            disk_data = json.loads(SEO_ROUTES_FILE.read_text(encoding="utf-8"))
            if isinstance(disk_data, dict):
                for k, v in disk_data.items():
                    clean_k = ("/" + k.strip("/")).lower() if k != "/" else "/"
                    if clean_k in routes:
                        routes[clean_k].update(v)
                    else:
                        v["path"] = clean_k
                        if "category" not in v:
                            v["category"] = _detect_category(clean_k)
                        routes[clean_k] = v
        except Exception as e:
            print(f"[SEO Engine] Error loading seo_routes.json: {e}")
    else:
        # Write initial file
        try:
            SEO_ROUTES_FILE.write_text(json.dumps(routes, indent=2), encoding="utf-8")
        except Exception:
            pass

    return routes

def save_all_seo_routes(routes: dict[str, dict]) -> bool:
    try:
        SEO_ROUTES_FILE.write_text(json.dumps(routes, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        print(f"[SEO Engine] Error saving seo_routes.json: {e}")
        return False

def save_single_seo_route(route_data: dict) -> tuple[bool, str]:
    try:
        raw_path = (route_data.get("path") or "").strip()
        if not raw_path:
            return False, "Path cannot be empty"
        clean_p = ("/" + raw_path.strip("/")).lower() if raw_path != "/" else "/"
        
        all_r = load_all_seo_routes()
        existing = all_r.get(clean_p, {})
        
        updated_entry = {
            "path": clean_p,
            "title": route_data.get("title", existing.get("title", "")).strip(),
            "desc": route_data.get("desc", existing.get("desc", "")).strip(),
            "keywords": route_data.get("keywords", existing.get("keywords", "")).strip(),
            "canonical": route_data.get("canonical", existing.get("canonical", f"https://tradersdesk.in{clean_p if clean_p != '/' else ''}")).strip(),
            "og_title": route_data.get("og_title", route_data.get("title", existing.get("og_title", ""))).strip(),
            "og_desc": route_data.get("og_desc", route_data.get("desc", existing.get("og_desc", ""))).strip(),
            "robots": route_data.get("robots", existing.get("robots", "index, follow")).strip(),
            "category": route_data.get("category", existing.get("category", _detect_category(clean_p))),
            "priority": str(route_data.get("priority", existing.get("priority", "0.8"))),
            "changefreq": str(route_data.get("changefreq", existing.get("changefreq", "daily"))),
            "custom": route_data.get("custom", existing.get("custom", True)),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S IST")
        }
        all_r[clean_p] = updated_entry
        ok = save_all_seo_routes(all_r)
        if ok:
            return True, f"Route {clean_p} SEO saved successfully!"
        return False, "Failed to write route data to disk"
    except Exception as e:
        return False, str(e)

def delete_single_seo_route(path: str) -> tuple[bool, str]:
    try:
        clean_p = ("/" + path.strip("/")).lower() if path != "/" else "/"
        all_r = load_all_seo_routes()
        if clean_p not in all_r:
            return False, f"Route {clean_p} not found"
        del all_r[clean_p]
        save_all_seo_routes(all_r)
        return True, f"Route {clean_p} removed from SEO catalog"
    except Exception as e:
        return False, str(e)

def auto_discover_pages() -> tuple[list[dict], int]:
    """Scans public directory for any html files and identifies unmapped pages."""
    all_r = load_all_seo_routes()
    discovered = []
    pub_dir = ROOT / "public"
    
    if pub_dir.exists():
        for html_file in pub_dir.glob("*.html"):
            fname = html_file.name.lower()
            if fname.endswith(".bak") or fname.startswith("test_"):
                continue
            
            # Form path candidates
            base_name = html_file.stem
            route_paths = [f"/{base_name}"]
            if base_name == "index":
                route_paths = ["/"]
            elif base_name != "admin":
                route_paths.append(f"/{fname}")
            
            for rp in route_paths:
                clean_rp = rp.lower()
                if clean_rp not in all_r:
                    # Parse title and desc from html if possible
                    title = f"{base_name.replace('_', ' ').replace('-', ' ').title()} | TradersDesk"
                    desc = f"Institutional analytics and trading intelligence for {base_name.replace('_', ' ')} on TradersDesk.in."
                    try:
                        content = html_file.read_text(encoding="utf-8", errors="ignore")
                        t_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
                        if t_match:
                            parsed_t = t_match.group(1).strip()
                            if parsed_t:
                                title = parsed_t
                        d_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', content, re.IGNORECASE)
                        if d_match:
                            parsed_d = d_match.group(1).strip()
                            if parsed_d:
                                desc = parsed_d
                    except Exception:
                        pass
                    
                    new_item = {
                        "path": clean_rp,
                        "title": title,
                        "desc": desc,
                        "keywords": f"{base_name}, tradersdesk, indian stock market, nse analytics",
                        "canonical": f"https://tradersdesk.in{clean_rp if clean_rp != '/' else ''}",
                        "og_title": title,
                        "og_desc": desc,
                        "robots": "index, follow",
                        "category": _detect_category(clean_rp),
                        "priority": "0.7",
                        "changefreq": "weekly",
                        "custom": True,
                        "last_updated": time.strftime("%Y-%m-%d %H:%M:%S IST")
                    }
                    all_r[clean_rp] = new_item
                    discovered.append(new_item)
    
    if discovered:
        save_all_seo_routes(all_r)
    return discovered, len(all_r)

def rebuild_sitemap_xml() -> tuple[bool, str]:
    """Generates a clean, valid XML sitemap based on all active indexed SEO routes."""
    try:
        all_r = load_all_seo_routes()
        lines = ['<?xml version="1.0" encoding="UTF-8"?>']
        lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
        today = time.strftime("%Y-%m-%d")
        
        # Sort routes: root first, then by priority desc
        sorted_routes = sorted(all_r.values(), key=lambda x: (0 if x["path"] == "/" else 1, -float(x.get("priority", 0.5))))
        
        count = 0
        for r in sorted_routes:
            # Skip noindex
            if "noindex" in r.get("robots", "").lower():
                continue
            canonical = r.get("canonical") or f"https://tradersdesk.in{r['path'] if r['path'] != '/' else ''}"
            prio = r.get("priority", "0.8")
            freq = r.get("changefreq", "daily")
            lines.append("  <url>")
            lines.append(f"    <loc>{canonical}</loc>")
            lines.append(f"    <lastmod>{today}</lastmod>")
            lines.append(f"    <changefreq>{freq}</changefreq>")
            lines.append(f"    <priority>{prio}</priority>")
            lines.append("  </url>")
            count += 1
            
        lines.append("</urlset>")
        sitemap_path = ROOT / "public" / "sitemap.xml"
        sitemap_path.write_text("\n".join(lines), encoding="utf-8")
        return True, f"Successfully rebuilt sitemap.xml with {count} indexed URLs!"
    except Exception as e:
        return False, f"Failed to rebuild sitemap: {e}"

def get_seo_meta_for_path(path: str) -> dict:
    all_r = load_all_seo_routes()
    clean = ("/" + path.strip("/")).lower() if path.strip("/") else "/"
    if clean in all_r:
        return all_r[clean]
    # Check prefixes
    for prefix in sorted(all_r.keys(), key=len, reverse=True):
        if prefix != "/" and clean.startswith(prefix):
            return all_r[prefix]
    return all_r.get("/", {
        "title": DEFAULT_SEO_CONFIG["site_title"],
        "desc": DEFAULT_SEO_CONFIG["meta_description"],
        "keywords": DEFAULT_SEO_CONFIG["keywords"],
        "canonical": DEFAULT_SEO_CONFIG["canonical_url"],
        "robots": "index, follow"
    })

def inject_seo_metadata(html: str, path: str) -> str:
    """
    Dynamically injects dedicated route-specific SEO tags into HTML before serving:
    <title>, <meta description>, <meta keywords>, <link rel="canonical">,
    OpenGraph (og:title, og:description, og:url), Twitter Card (twitter:title, twitter:desc),
    and robots tag + Google Verification.
    """
    global_cfg = load_seo_config()
    meta = get_seo_meta_for_path(path)
    title = meta.get("title") or global_cfg["site_title"]
    desc = meta.get("desc") or global_cfg["meta_description"]
    keywords = meta.get("keywords") or global_cfg["keywords"]
    canonical = meta.get("canonical") or global_cfg["canonical_url"]
    robots_rule = meta.get("robots", "index, follow")

    if not global_cfg.get("robots_indexing", True):
        robots_rule = "noindex, nofollow"

    # 1. Update <title>
    html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html, count=1, flags=re.DOTALL | re.IGNORECASE)

    # 2. Update meta description
    if re.search(r'<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta name="description" content="{desc}">', html, count=1, flags=re.IGNORECASE)
    elif re.search(r'<meta\s+content=["\'].*?["\']\s+name=["\']description["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+content=["\'].*?["\']\s+name=["\']description["\']\s*/?>',
                      f'<meta name="description" content="{desc}">', html, count=1, flags=re.IGNORECASE)

    # 3. Update meta keywords
    if re.search(r'<meta\s+name=["\']keywords["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']keywords["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta name="keywords" content="{keywords}">', html, count=1, flags=re.IGNORECASE)

    # 4. Update canonical link
    if re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<link\s+rel=["\']canonical["\']\s+href=["\'].*?["\']\s*/?>',
                      f'<link rel="canonical" href="{canonical}">', html, count=1, flags=re.IGNORECASE)

    # 5. Update robots tag
    if re.search(r'<meta\s+name=["\']robots["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']robots["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta name="robots" content="{robots_rule}">', html, count=1, flags=re.IGNORECASE)
    elif "<head>" in html:
        html = html.replace("<head>", f'<head>\n  <meta name="robots" content="{robots_rule}">', 1)

    # 6. Update OpenGraph tags
    if re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+property=["\']og:title["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta property="og:title" content="{title}">', html, count=1, flags=re.IGNORECASE)
    if re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+property=["\']og:description["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta property="og:description" content="{desc}">', html, count=1, flags=re.IGNORECASE)
    if re.search(r'<meta\s+property=["\']og:url["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+property=["\']og:url["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta property="og:url" content="{canonical}">', html, count=1, flags=re.IGNORECASE)

    # 7. Update Twitter Card tags
    if re.search(r'<meta\s+name=["\']twitter:title["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']twitter:title["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta name="twitter:title" content="{title}">', html, count=1, flags=re.IGNORECASE)
    if re.search(r'<meta\s+name=["\']twitter:description["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']twitter:description["\']\s+content=["\'].*?["\']\s*/?>',
                      f'<meta name="twitter:description" content="{desc}">', html, count=1, flags=re.IGNORECASE)

    # 8. Google Site Verification
    g_verify = global_cfg.get("google_site_verification", "").strip()
    if g_verify:
        if "google-site-verification" in html:
            html = re.sub(r'<meta\s+name=["\']google-site-verification["\']\s+content=["\'].*?["\']\s*/?>',
                          f'<meta name="google-site-verification" content="{g_verify}">', html, count=1, flags=re.IGNORECASE)
        elif "<head>" in html:
            html = html.replace("<head>", f'<head>\n  <meta name="google-site-verification" content="{g_verify}">', 1)

    # 9. Google Analytics 4 (GA4) / GTM Script Injection
    import os
    ga_id = (global_cfg.get("google_analytics_id", "") or os.getenv("GOOGLE_ANALYTICS_ID", "")).strip()
    if ga_id:
        if ga_id not in html and "googletagmanager.com/gtag/js" not in html:
            ga_snippet = (
                f'\n  <!-- Google tag (gtag.js) -->\n'
                f'  <script async src="https://www.googletagmanager.com/gtag/js?id={ga_id}"></script>\n'
                f'  <script>\n'
                f'    window.dataLayer = window.dataLayer || [];\n'
                f'    function gtag(){{dataLayer.push(arguments);}}\n'
                f'    gtag("js", new Date());\n'
                f'    gtag("config", "{ga_id}");\n'
                f'  </script>'
            )
            if "<head>" in html:
                html = html.replace("<head>", f'<head>{ga_snippet}', 1)
            elif "<HEAD>" in html:
                html = html.replace("<HEAD>", f'<HEAD>{ga_snippet}', 1)

    return html


