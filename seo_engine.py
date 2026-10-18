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
NON_INDEXABLE_PATHS = frozenset({
    "/admin", "/admin.html", "/settings", "/page2", "/page2.html",
    "/calendar_studio", "/calendar_studio.html",
})
SITEMAP_EXCLUDED_PATHS = frozenset({
    # Legacy aliases that 301 to their canonical destination.
    "/fii-dii-cash", "/fii-dii-derivatives", "/fii-dii/cash", "/fii-dii/derivatives",
})

DEFAULT_SEO_CONFIG = {
    "site_title": "TradersDesk.in | Institutional Derivatives, Options Greeks & Market Breadth Terminal",
    "meta_description": "TradersDesk.in — Institutional-grade Indian derivatives analytics, real-time Option Chain Pro, Black-Scholes Greeks (Delta, Gamma, Theta, Vega), ATM Straddles, Market Breadth & FII/DII Smart Money flow.",
    "keywords": "TradersDesk, tradersdesk.in, option chain, nifty option chain, bank nifty option chain, options greeks, max pain, pcr ratio, market breadth, fii dii activity, atm straddle, open interest analysis",
    "canonical_url": "https://tradersdesk.in/",
    "google_site_verification": "",
    "google_analytics_id": "G-Y0MDT0BZD8",
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
        "canonical": "https://tradersdesk.in/about",
    },
    "/about.html": {
        "title": "Quantitative Model Methodologies & Architecture | TradersDesk",
        "desc": "Learn about TradersDesk's Black-Scholes Greeks engines, Point & Figure market breadth calculations, and institutional data pipelines.",
        "keywords": "about tradersdesk, quantitative models, black scholes engine, market breadth methodology",
        "canonical": "https://tradersdesk.in/about",
    },
    "/disclaimer": {
        "title": "SEBI Regulatory & Compliance Disclaimer | TradersDesk",
        "desc": "Important regulatory disclosures, SEBI compliance notices, and research terms for TradersDesk institutional analytics platform.",
        "keywords": "sebi disclaimer, regulatory disclosure, compliance notice, educational research only",
        "canonical": "https://tradersdesk.in/disclaimer",
    },
    "/disclaimer.html": {
        "title": "SEBI Regulatory & Compliance Disclaimer | TradersDesk",
        "desc": "Important regulatory disclosures, SEBI compliance notices, and research terms for TradersDesk institutional analytics platform.",
        "keywords": "sebi disclaimer, regulatory disclosure, compliance notice, educational research only",
        "canonical": "https://tradersdesk.in/disclaimer",
    },
    "/privacy": {
        "title": "Privacy Policy & Data Governance | TradersDesk",
        "desc": "TradersDesk privacy policy detailing data protection, broker credential safety, encryption standards, and user governance.",
        "keywords": "privacy policy, data governance, broker security, credential encryption",
        "canonical": "https://tradersdesk.in/privacy",
    },
    "/privacy.html": {
        "title": "Privacy Policy & Data Governance | TradersDesk",
        "desc": "TradersDesk privacy policy detailing data protection, broker credential safety, encryption standards, and user governance.",
        "keywords": "privacy policy, data governance, broker security, credential encryption",
        "canonical": "https://tradersdesk.in/privacy",
    },
    "/terms": {
        "title": "Terms of Institutional Service | TradersDesk",
        "desc": "Terms and conditions governing the use of the TradersDesk institutional market intelligence terminal and APIs.",
        "keywords": "terms of service, institutional terms, platform usage rules",
        "canonical": "https://tradersdesk.in/terms",
    },
    "/terms.html": {
        "title": "Terms of Institutional Service | TradersDesk",
        "desc": "Terms and conditions governing the use of the TradersDesk institutional market intelligence terminal and APIs.",
        "keywords": "terms of service, institutional terms, platform usage rules",
        "canonical": "https://tradersdesk.in/terms",
    },
    "/contact": {
        "title": "Contact Us & Trader Support | TradersDesk.in",
        "desc": "Get in touch with the TradersDesk quantitative analytics team. Trader support, data bug reports, feature requests & API partnerships.",
        "keywords": "contact tradersdesk, trader support, trading terminal feedback, nse api support",
        "canonical": "https://tradersdesk.in/contact",
    },
    "/contact.html": {
        "title": "Contact Us & Trader Support | TradersDesk.in",
        "desc": "Get in touch with the TradersDesk quantitative analytics team. Trader support, data bug reports, feature requests & API partnerships.",
        "keywords": "contact tradersdesk, trader support, trading terminal feedback, nse api support",
        "canonical": "https://tradersdesk.in/contact",
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
            if not merged.get("google_analytics_id"):
                merged["google_analytics_id"] = "G-Y0MDT0BZD8"
            return merged
        except Exception:
            pass
    # Backup cache fallback
    try:
        cache_backup = ROOT / "cache" / "seo_config_backup.json"
        if cache_backup.exists():
            data = json.loads(cache_backup.read_text(encoding="utf-8"))
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
        try:
            cache_backup = ROOT / "cache" / "seo_config_backup.json"
            cache_backup.parent.mkdir(parents=True, exist_ok=True)
            cache_backup.write_text(json.dumps(current, indent=2), encoding="utf-8")
        except Exception:
            pass
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

    # A saved catalog must never be allowed to re-index an internal route.
    for protected_path in NON_INDEXABLE_PATHS:
        if protected_path in routes:
            routes[protected_path]["robots"] = "noindex, nofollow, noarchive"

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
    """Generates a clean, valid XML sitemap based on all active indexed SEO routes with strict canonical deduplication."""
    try:
        all_r = load_all_seo_routes()
        lines = ['<?xml version="1.0" encoding="UTF-8"?>']
        lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
        # Sort routes: root first, then by priority desc
        sorted_routes = sorted(all_r.values(), key=lambda x: (0 if x["path"] == "/" else 1, -float(x.get("priority", 0.5))))
        
        seen_canonicals = set()
        count = 0
        for r in sorted_routes:
            route_path = (r.get("path") or "").rstrip("/") or "/"
            # Internal/admin and explicit noindex pages must never leak into the
            # public sitemap, even if an old saved SEO catalog says otherwise.
            if route_path in NON_INDEXABLE_PATHS or route_path in SITEMAP_EXCLUDED_PATHS or "noindex" in r.get("robots", "").lower():
                continue
            canonical = (r.get("canonical") or f"https://tradersdesk.in{r['path'] if r['path'] != '/' else ''}").rstrip("/")
            if canonical == "https://tradersdesk.in":
                canonical = "https://tradersdesk.in/"
            if canonical in seen_canonicals:
                continue
            seen_canonicals.add(canonical)
            prio = r.get("priority", "0.8")
            freq = r.get("changefreq", "daily")
            lines.append("  <url>")
            lines.append(f"    <loc>{canonical}</loc>")
            last_updated = str(r.get("last_updated", "")).strip()
            lastmod_match = re.match(r"^\d{4}-\d{2}-\d{2}", last_updated)
            if lastmod_match:
                lines.append(f"    <lastmod>{lastmod_match.group(0)}</lastmod>")
            lines.append(f"    <changefreq>{freq}</changefreq>")
            lines.append(f"    <priority>{prio}</priority>")
            lines.append("  </url>")
            count += 1
            
        lines.append("</urlset>")
        sitemap_path = ROOT / "public" / "sitemap.xml"
        sitemap_path.write_text("\n".join(lines), encoding="utf-8")
        return True, f"Successfully rebuilt sitemap.xml with {count} unique indexed URLs!"
    except Exception as e:
        return False, f"Failed to rebuild sitemap: {e}"

def get_seo_meta_for_path(path: str) -> dict:
    all_r = load_all_seo_routes()
    clean = ("/" + path.strip("/")).lower() if path.strip("/") else "/"
    if clean in NON_INDEXABLE_PATHS:
        base = all_r.get(clean, {}).copy()
        base["robots"] = "noindex, nofollow, noarchive"
        return base
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

# ── Dynamic Real-Time Market Snapshot & Live SEO Prerender Engine ─────────────
_LIVE_SEO_SNAPSHOT_CACHE: dict = {
    "ts": 0.0,
    "data": None
}

def get_live_seo_market_snapshot(force_refresh: bool = False) -> dict:
    """
    Retrieves the latest live/EOD market metrics with an in-memory TTL of 60 seconds.
    Reads from FII/DII cash flow, official Bhavcopy master, and derivatives positioning.
    Sub-millisecond execution ensures zero slowdown for web crawlers and visitors.
    """
    global _LIVE_SEO_SNAPSHOT_CACHE
    now = time.time()
    if not force_refresh and _LIVE_SEO_SNAPSHOT_CACHE.get("data") and (now - _LIVE_SEO_SNAPSHOT_CACHE.get("ts", 0.0) < 60.0):
        return _LIVE_SEO_SNAPSHOT_CACHE["data"]

    snapshot = {
        "date": "16-Oct-2026",
        "date_iso": "2026-10-16",
        "nifty_spot": 23146.15,
        "nifty_change": 148.80,
        "nifty_pct": 0.65,
        "nifty_trend": "BULLISH",
        "banknifty_spot": 55918.00,
        "banknifty_change": 58.60,
        "banknifty_pct": 0.10,
        "fii_net_cash": 1165.92,
        "dii_net_cash": -3661.28,
        "total_net_cash": -2495.36,
        "fii_index_fut_contracts": 6828,
        "fii_index_fut_cr": 1024.71,
        "top_gainers": [
            {"symbol": "TECHM", "close": 1774.60, "change": 131.30, "pct": 7.99, "buildup": "Short Covering"},
            {"symbol": "WIPRO", "close": 185.62, "change": 11.68, "pct": 6.71, "buildup": "Long Buildup"},
            {"symbol": "KPITTECH", "close": 557.65, "change": 26.70, "pct": 5.03, "buildup": "Long Buildup"},
            {"symbol": "TCS", "close": 2464.30, "change": 95.20, "pct": 4.02, "buildup": "Long Buildup"},
            {"symbol": "INFY", "close": 1164.85, "change": 45.00, "pct": 4.02, "buildup": "Long Buildup"},
        ],
        "top_losers": [
            {"symbol": "NUVAMA", "close": 1810.30, "change": -112.10, "pct": -5.83, "buildup": "Long Unwinding"},
            {"symbol": "LTF", "close": 250.30, "change": -10.65, "pct": -4.08, "buildup": "Short Buildup"},
            {"symbol": "ANGELONE", "close": 300.85, "change": -12.35, "pct": -3.94, "buildup": "Long Unwinding"},
        ],
        "active_expiry": "27-Oct-2026",
        "last_synced_at": time.strftime("%Y-%m-%d %H:%M:%S IST")
    }

    # 1. Read FII / DII Cash History
    fii_file = ROOT / "data" / "fii_dii_cash_history.json"
    if fii_file.exists():
        try:
            fd = json.loads(fii_file.read_text(encoding="utf-8"))
            daily = fd.get("daily", [])
            if daily:
                last_d = daily[0]
                snapshot["date"] = str(last_d.get("date", snapshot["date"]))
                snapshot["nifty_spot"] = float(last_d.get("niftyClose", snapshot["nifty_spot"]))
                snapshot["nifty_change"] = float(last_d.get("niftyChange", snapshot["nifty_change"]))
                snapshot["nifty_pct"] = float(last_d.get("niftyPct", snapshot["nifty_pct"]))
                snapshot["nifty_trend"] = "BULLISH" if snapshot["nifty_change"] >= 0 else "BEARISH"
                snapshot["fii_net_cash"] = float(last_d.get("fiiNet", snapshot["fii_net_cash"]))
                snapshot["dii_net_cash"] = float(last_d.get("diiNet", snapshot["dii_net_cash"]))
                snapshot["total_net_cash"] = float(last_d.get("totalNet", snapshot["total_net_cash"]))
        except Exception:
            pass

    # 2. Read Bhavcopy master for Bank Nifty & Top Gainers
    bhav_file = ROOT / "cache" / "fo_bhav_eod_master.json"
    if bhav_file.exists():
        try:
            bd = json.loads(bhav_file.read_text(encoding="utf-8"))
            sd = bd.get("symbols_data", {})
            bn = sd.get("BANKNIFTY", [])
            if bn:
                last_bn = bn[-1]
                snapshot["banknifty_spot"] = float(last_bn.get("c", snapshot["banknifty_spot"]))
                if len(bn) > 1:
                    prev_bn = bn[-2].get("c", snapshot["banknifty_spot"])
                    snapshot["banknifty_change"] = round(snapshot["banknifty_spot"] - prev_bn, 2)
                    snapshot["banknifty_pct"] = round((snapshot["banknifty_change"] / prev_bn) * 100.0, 2) if prev_bn else 0.0

            gainers = []
            for sym, recs in sd.items():
                if len(recs) >= 2 and not recs[-1].get("isIndex"):
                    r1, r2 = recs[-2], recs[-1]
                    c1, c2 = r1.get("c", 0), r2.get("c", 0)
                    oi1, oi2 = r1.get("oi", 0), r2.get("oi", 0)
                    if c1 > 0:
                        chg = round(c2 - c1, 2)
                        pct = round((chg / c1) * 100, 2)
                        d_oi = oi2 - oi1
                        buildup = "Long Buildup" if (chg > 0 and d_oi > 0) else ("Short Covering" if (chg > 0 and d_oi <= 0) else ("Short Buildup" if (chg < 0 and d_oi > 0) else "Long Unwinding"))
                        gainers.append({"symbol": sym, "close": c2, "change": chg, "pct": pct, "buildup": buildup, "oi": oi2})
            if gainers:
                gainers.sort(key=lambda x: x["pct"], reverse=True)
                snapshot["top_gainers"] = gainers[:5]
                snapshot["top_losers"] = gainers[-5:]
        except Exception:
            pass

    # 3. Read Derivatives flow
    deriv_file = ROOT / "data" / "fii_dii_derivatives_flow.json"
    if deriv_file.exists():
        try:
            dd = json.loads(deriv_file.read_text(encoding="utf-8"))
            raw = dd.get("fiiStats", {}).get("raw", {})
            idx_fut = raw.get("INDEX FUTURES", {})
            if idx_fut:
                snapshot["fii_index_fut_contracts"] = int(idx_fut.get("netContracts", snapshot["fii_index_fut_contracts"]))
                snapshot["fii_index_fut_cr"] = float(idx_fut.get("netCr", snapshot["fii_index_fut_cr"]))
        except Exception:
            pass

    # 4. Check in-memory live futures cache if active
    try:
        import futures_engine
        live_cache = getattr(futures_engine, "_FUTURES_CACHE", {})
        if live_cache and live_cache.get("indices"):
            for idx in live_cache.get("indices", []):
                sym = idx.get("symbol")
                if sym == "NIFTY":
                    sp = float(idx.get("spotPrice") or idx.get("ltp") or 0.0)
                    if sp > 0:
                        snapshot["nifty_spot"] = sp
                        snapshot["nifty_change"] = float(idx.get("priceChange") or 0.0)
                        snapshot["nifty_pct"] = float(idx.get("priceChangePct") or 0.0)
                elif sym == "BANKNIFTY":
                    bsp = float(idx.get("spotPrice") or idx.get("ltp") or 0.0)
                    if bsp > 0:
                        snapshot["banknifty_spot"] = bsp
                        snapshot["banknifty_change"] = float(idx.get("priceChange") or 0.0)
                        snapshot["banknifty_pct"] = float(idx.get("priceChangePct") or 0.0)
            if live_cache.get("topGainers"):
                snapshot["top_gainers"] = [
                    {"symbol": g.get("symbol", ""), "close": float(g.get("ltp") or g.get("spotPrice") or 0.0), "change": float(g.get("priceChange") or 0.0), "pct": float(g.get("priceChangePct") or 0.0), "buildup": g.get("buildup", "Long Buildup")}
                    for g in live_cache.get("topGainers", [])[:5]
                ]
    except Exception:
        pass

    _LIVE_SEO_SNAPSHOT_CACHE["ts"] = time.time()
    _LIVE_SEO_SNAPSHOT_CACHE["data"] = snapshot
    return snapshot

def sync_dynamic_seo_snapshot() -> dict:
    """Forces an immediate refresh of the dynamic SEO market snapshot and updates disk caches."""
    snap = get_live_seo_market_snapshot(force_refresh=True)
    rebuild_sitemap_xml()
    return snap

def get_dynamic_meta_for_path(path: str, snapshot: dict) -> dict:
    """
    Enriches route-specific meta tags dynamically with today's live/EOD figures,
    ensuring search engines index rich keywords, live prices, and institutional figures.
    """
    base_meta = get_seo_meta_for_path(path).copy()
    clean_p = ("/" + path.strip("/")).lower() if path.strip("/") else "/"

    nifty_spot = snapshot.get("nifty_spot", 23146.15)
    nifty_chg = snapshot.get("nifty_change", 148.80)
    nifty_pct = snapshot.get("nifty_pct", 0.65)
    sign = "+" if nifty_chg >= 0 else ""
    nifty_str = f"NIFTY {nifty_spot:,.2f} ({sign}{nifty_chg:.2f} / {sign}{nifty_pct:.2f}%)"
    date_str = snapshot.get("date", "16-Oct-2026")
    fii_net = snapshot.get("fii_net_cash", 1165.92)
    dii_net = snapshot.get("dii_net_cash", -3661.28)

    top_gainers = snapshot.get("top_gainers", [])
    top_gainers_summary = ", ".join(f"{g['symbol']} (+{g['pct']:.1f}%)" for g in top_gainers[:3]) if top_gainers else "TECHM (+8.0%), WIPRO (+6.7%), TCS (+4.0%)"

    if clean_p in ("/", "/dashboard"):
        base_meta["title"] = f"TradersDesk | NIFTY {nifty_spot:,.0f} ({sign}{nifty_pct:.1f}%) | Derivatives Terminal"
        base_meta["desc"] = f"Live Indian derivatives terminal: Option Chain Pro with Greeks, Max Pain, PCR, Market Breadth & FII/DII Smart Money flow on NSE ({date_str})."
    elif clean_p.startswith("/futures"):
        base_meta["title"] = "Futures Intelligence Desk - Live OI Buildup & Ban Radar | TradersDesk"
        base_meta["desc"] = f"Track real-time NSE Open Interest buildup, Long & Short unwinding, Cost of Carry, and MWPL Ban radar across all F&O equities ({date_str})."
    elif clean_p.startswith("/fii") or clean_p.startswith("/smart-money"):
        base_meta["title"] = "FII DII Smart Money Flow | Participant Derivatives Positioning | TradersDesk"
        base_meta["desc"] = f"Real-time institutional cash market buying/selling, participant derivatives open interest, and historical flow charts on NSE ({date_str})."
    elif clean_p.startswith("/option") or clean_p.startswith("/straddle"):
        atm_strike = int(round(nifty_spot / 50.0) * 50)
        base_meta["title"] = "Option Chain Pro - Live Option Greeks, PCR & Max Pain | TradersDesk"
        base_meta["desc"] = f"Streaming Option Chain Pro for Nifty & Bank Nifty with real-time Delta, Gamma, Theta, Vega, IV Skew, PCR, and Max Pain strikes ({date_str})."
    elif clean_p.startswith("/delivery"):
        base_meta["title"] = "Cash Delivery Analytics - Volume Shocks & Accumulation | TradersDesk"
        base_meta["desc"] = f"Screen 1800+ NSE & BSE equities for high-conviction delivery percentage spikes (>60%) and institutional accumulation on {date_str}."
    elif clean_p.startswith("/mtf") or clean_p.startswith("/compare"):
        base_meta["title"] = "MTF Analytics - Margin Trading Facility Book & Stock Leverage | TradersDesk"
        base_meta["desc"] = f"Comprehensive Margin Trading Facility (MTF) loan book analytics, category leverage distribution, and SEBI regulatory disclosures ({date_str})."
    elif clean_p.startswith("/breadth") or clean_p.startswith("/contribution"):
        base_meta["title"] = "Market Breadth Pro - Point & Figure Advance-Decline Engine | TradersDesk"
        base_meta["desc"] = f"Institutional Indian market breadth with Point & Figure (PnF) matrices, advance-decline momentum, and heavyweight point contribution."
    elif clean_p.startswith("/global"):
        base_meta["title"] = "Global Markets Desk - GIFT Nifty & World Indices Macro Radar | TradersDesk"
        base_meta["desc"] = f"Real-time GIFT Nifty, US markets (S&P 500, Nasdaq), Asian & European indices, Brent Crude, US 10Y Yield, and global macro pulse."

    base_meta["og_title"] = base_meta["title"]
    base_meta["og_desc"] = base_meta["desc"]
    return base_meta

def generate_dynamic_json_ld(path: str, snapshot: dict) -> str:
    """Generates structured Schema.org JSON-LD graph with WebApplication, FinancialService, Dataset, Breadcrumbs & FAQs."""
    clean_p = ("/" + path.strip("/")).lower() if path != "/" else "/"
    canonical = f"https://tradersdesk.in{clean_p if clean_p != '/' else ''}"

    segments = [s for s in clean_p.strip("/").split("/") if s]
    breadcrumb_items = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://tradersdesk.in/"}
    ]
    cur_path = ""
    for idx, seg in enumerate(segments):
        cur_path += "/" + seg
        breadcrumb_items.append({
            "@type": "ListItem",
            "position": idx + 2,
            "name": seg.replace("-", " ").replace("_", " ").title(),
            "item": f"https://tradersdesk.in{cur_path}"
        })

    date_iso = snapshot.get("date_iso", "2026-10-16")
    nifty = snapshot.get("nifty_spot", 23146.15)
    fii = snapshot.get("fii_net_cash", 1165.92)

    schema_graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebApplication",
                "@id": f"{canonical}#webapp",
                "name": "TradersDesk.in",
                "url": canonical,
                "applicationCategory": "FinanceApplication",
                "operatingSystem": "All",
                "description": "Institutional-grade Indian stock market derivatives terminal, real-time Options Chain Pro with Greeks, and Market Breadth."
            },
            {
                "@type": "FinancialService",
                "@id": f"{canonical}#service",
                "name": "TradersDesk Quantitative Intelligence",
                "url": canonical,
                "serviceType": "Quantitative Market Research & Analytics Desk",
                "areaServed": "IN",
                "disclaimer": "Educational and quantitative research platform. Not a SEBI registered investment advisor."
            },
            {
                "@type": "Dataset",
                "@id": f"{canonical}#dataset",
                "name": f"Indian Equity Derivatives Market Analytics ({snapshot.get('date', '16-Oct-2026')})",
                "description": f"Real-time exchange dataset covering Nifty 50 ({nifty:,.2f}), Bank Nifty, Open Interest buildup, FII net cash (₹{fii:+,.1f} Cr), and Black-Scholes Greeks.",
                "temporalCoverage": date_iso,
                "spatialCoverage": "IN",
                "variableMeasured": [
                    "Nifty 50 Index Spot",
                    "Bank Nifty Index Spot",
                    "Open Interest Buildup",
                    "Black-Scholes Delta Gamma Theta Vega",
                    "FII/DII Net Cash Market Flow",
                    "Margin Trading Facility (MTF) Exposure"
                ]
            },
            {
                "@type": "BreadcrumbList",
                "@id": f"{canonical}#breadcrumbs",
                "itemListElement": breadcrumb_items
            },
            {
                "@type": "FAQPage",
                "@id": f"{canonical}#faq",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "What is Open Interest (OI) buildup in NSE futures trading?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "Open Interest buildup categorizes futures contracts into four institutional quadrants: Long Buildup (Price Up, OI Up), Short Buildup (Price Down, OI Up), Short Covering (Price Up, OI Down), and Long Unwinding (Price Down, OI Down)."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How does Option Chain Pro calculate Black-Scholes Greeks?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "TradersDesk computes Delta, Gamma, Theta, Vega, and Rho using the Black-Scholes-Merton model with real-time implied volatility (IV) inversion across all active weekly and monthly expiries."
                        }
                    },
                    {
                        "@type": "Question",
                        "name": "How are FII and DII smart money cash flows calculated?",
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": "FII and DII daily activity is aggregated from official National Stock Exchange of India (NSE) gross buy and sell value disclosures, producing the net daily cash flow in ₹ Crores."
                        }
                    }
                ]
            }
        ]
    }
    return json.dumps(schema_graph, indent=2)

def build_semantic_crawler_html(path: str, snapshot: dict = None) -> str:
    """Builds a rich semantic HTML summary with real stocks and numbers for web crawlers."""
    if not snapshot:
        snapshot = get_live_seo_market_snapshot()
    clean_p = ("/" + path.strip("/")).lower() if path != "/" else "/"
    date_str = snapshot.get("date", "16-Oct-2026")
    nifty = snapshot.get("nifty_spot", 23146.15)
    nifty_chg = snapshot.get("nifty_change", 148.80)
    nifty_pct = snapshot.get("nifty_pct", 0.65)
    bn = snapshot.get("banknifty_spot", 55918.00)
    bn_chg = snapshot.get("banknifty_change", 58.60)
    bn_pct = snapshot.get("banknifty_pct", 0.10)
    fii = snapshot.get("fii_net_cash", 1165.92)
    dii = snapshot.get("dii_net_cash", -3661.28)
    total_net = snapshot.get("total_net_cash", -2495.36)
    fii_fut_cr = snapshot.get("fii_index_fut_cr", 1024.71)
    fii_fut_contracts = snapshot.get("fii_index_fut_contracts", 6828)
    top_gainers = snapshot.get("top_gainers", [])

    gainers_rows = "".join(
        f"<tr><td style='padding:6px 10px; font-weight:700; color:#f1f5f9;'>{g['symbol']}</td><td style='padding:6px 10px;'>₹{g['close']:,.2f}</td><td style='padding:6px 10px; color:#10b981; font-weight:700;'>+{g['pct']:.2f}%</td><td style='padding:6px 10px; color:#38bdf8;'>{g.get('buildup', 'Long Buildup')}</td></tr>"
        for g in top_gainers[:5]
    )

    if "future" in clean_p:
        context_block = """
        <div style="margin-top:16px; padding:16px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
          <h3 style="font-size:14px; color:#38bdf8; margin:0 0 8px;">📊 Futures Intelligence &amp; Open Interest (OI) Analysis</h3>
          <p style="margin:0 0 6px; font-size:12.5px; line-height:1.6;">TradersDesk tracks real-time Open Interest (OI) buildup across all 220+ National Stock Exchange (NSE) equity and index derivatives contracts. Categorized dynamically into institutional quadrants: Long Buildup (expansion in price &amp; OI), Short Buildup (contraction in price with OI surge), Short Covering (bullish rally with OI reduction), and Long Unwinding (profit booking with OI decay). Live tracking also covers Cost of Carry (CoC), Cash-Futures Basis, and Market-Wide Position Limit (MWPL) F&amp;O ban thresholds.</p>
        </div>
        """
    elif "option" in clean_p or "straddle" in clean_p:
        context_block = """
        <div style="margin-top:16px; padding:16px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
          <h3 style="font-size:14px; color:#38bdf8; margin:0 0 8px;">⚡ Option Chain Pro &amp; Black-Scholes Greeks Engine</h3>
          <p style="margin:0 0 6px; font-size:12.5px; line-height:1.6;">Direct exchange streaming Option Chain Pro for Nifty 50, Bank Nifty, and NSE single-stock options. High-speed mathematical modeling calculates first and second-order Black-Scholes Greeks: Delta (price sensitivity), Gamma (delta acceleration), Theta (daily time decay), Vega (volatility risk), and Rho. Integrated with real-time Put-Call Ratio (PCR), Max Pain strike calculation, IV Skew curves, and ATM Straddle decay charts.</p>
        </div>
        """
    elif "fii" in clean_p or "smart" in clean_p:
        context_block = """
        <div style="margin-top:16px; padding:16px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
          <h3 style="font-size:14px; color:#38bdf8; margin:0 0 8px;">🏛️ Institutional Smart Money (FII / DII) Flow Radar</h3>
          <p style="margin:0 0 6px; font-size:12.5px; line-height:1.6;">Comprehensive tracking of Foreign Institutional Investors (FII) and Domestic Institutional Investors (DII) cash market buying and selling flows, along with proprietary participant derivatives open interest. Visualizes daily net purchases, cumulative multi-session trends, and Index Futures long/short positioning to gauge big-money sentiment before market open.</p>
        </div>
        """
    elif "mtf" in clean_p:
        context_block = """
        <div style="margin-top:16px; padding:16px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
          <h3 style="font-size:14px; color:#38bdf8; margin:0 0 8px;">📈 Margin Trading Facility (MTF) &amp; Leverage Book</h3>
          <p style="margin:0 0 6px; font-size:12.5px; line-height:1.6;">SEBI-compliant Margin Trading Facility (MTF) analytics tracking exchange aggregate leverage debt, retail vs institutional financed securities, stock leverage surges, and short squeeze candidates across Indian capital markets.</p>
        </div>
        """
    elif "delivery" in clean_p:
        context_block = """
        <div style="margin-top:16px; padding:16px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
          <h3 style="font-size:14px; color:#38bdf8; margin:0 0 8px;">📦 Cash Delivery Analytics &amp; Institutional Accumulation</h3>
          <p style="margin:0 0 6px; font-size:12.5px; line-height:1.6;">Filters over 1,800 NSE and BSE equities for high-conviction delivery spikes (>1.3x 5-day average), delivery percentage surges (>60%), and institutional volume absorption in the cash segment.</p>
        </div>
        """
    else:
        context_block = """
        <div style="margin-top:16px; padding:16px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
          <h3 style="font-size:14px; color:#38bdf8; margin:0 0 8px;">🌐 Institutional Financial Derivatives &amp; Market Intelligence</h3>
          <p style="margin:0 0 6px; font-size:12.5px; line-height:1.6;">TradersDesk.in delivers sub-second derivatives analytics, Option Chain Pro, Point &amp; Figure market breadth, FII/DII institutional positioning, and Margin Trading Facility (MTF) loan book intelligence for active Indian equity and derivatives market participants.</p>
        </div>
        """

    return f"""
    <!-- Dedicated Dynamic Live SEO & Crawler Overview Section (Compliant, No Cloaking) -->
    <section id="seoDynamicCrawlContent" class="seo-crawler-content" aria-label="Live Market Intelligence Summary" style="max-width:1440px; margin:24px auto 16px; padding:20px; background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#94a3b8; font-size:12px;">
      <header style="margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="font-size:17px; font-weight:800; color:#f1f5f9; margin:0 0 4px;">TradersDesk.in Live Market Intelligence &amp; Quantitative Terminal</h2>
          <span style="font-size:12px; color:#64748b;">Live Exchange Data Snapshot • Market Session: <b style="color:#cbd5e1;">{date_str}</b></span>
        </div>
        <div style="display:flex; gap:12px; font-family:'JetBrains Mono',monospace; font-size:12px;">
          <span>NIFTY 50: <b style="color:{'#10b981' if nifty_chg >= 0 else '#ef4444'};">{nifty:,.2f} ({'+' if nifty_chg>=0 else ''}{nifty_chg:.2f} / {'+' if nifty_pct>=0 else ''}{nifty_pct:.2f}%)</b></span>
          <span>BANK NIFTY: <b style="color:{'#10b981' if bn_chg >= 0 else '#ef4444'};">{bn:,.2f} ({'+' if bn_chg>=0 else ''}{bn_chg:.2f} / {'+' if bn_pct>=0 else ''}{bn_pct:.2f}%)</b></span>
        </div>
      </header>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:16px;">
        <div style="background:rgba(255,255,255,0.02); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
          <h3 style="font-size:12.5px; font-weight:700; color:#cbd5e1; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.5px;">🏛️ Institutional Cash Market Activity (NSE)</h3>
          <p style="margin:0 0 4px; font-size:12px;"><b>FII Net Cash:</b> <span style="color:{'#10b981' if fii>=0 else '#ef4444'}; font-weight:700;">₹{fii:+,.2f} Cr</span></p>
          <p style="margin:0 0 4px; font-size:12px;"><b>DII Net Cash:</b> <span style="color:{'#10b981' if dii>=0 else '#ef4444'}; font-weight:700;">₹{dii:+,.2f} Cr</span></p>
          <p style="margin:0 0 4px; font-size:12px;"><b>Total Institutional Net:</b> <span style="color:{'#10b981' if total_net>=0 else '#ef4444'}; font-weight:700;">₹{total_net:+,.2f} Cr</span></p>
          <p style="margin:0; font-size:11px; color:#64748b;">Official daily disclosure published by the National Stock Exchange of India.</p>
        </div>

        <div style="background:rgba(255,255,255,0.02); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
          <h3 style="font-size:12.5px; font-weight:700; color:#cbd5e1; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.5px;">⚡ Institutional Derivatives Flow</h3>
          <p style="margin:0 0 4px; font-size:12px;"><b>FII Index Futures Net:</b> <span style="color:{'#10b981' if fii_fut_cr>=0 else '#ef4444'}; font-weight:700;">₹{fii_fut_cr:+,.2f} Cr</span></p>
          <p style="margin:0 0 4px; font-size:12px;"><b>FII Index Contracts:</b> <span style="color:#f1f5f9; font-weight:700;">{fii_fut_contracts:+,} Net</span></p>
          <p style="margin:0; font-size:11px; color:#64748b;">Participant volume &amp; open interest positioning across Nifty and Bank Nifty futures.</p>
        </div>

        <div style="background:rgba(255,255,255,0.02); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
          <h3 style="font-size:12.5px; font-weight:700; color:#cbd5e1; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.5px;">📈 Top Session Buildup Leaders</h3>
          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:4px;">
            <thead>
              <tr style="color:#64748b; font-size:11px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <th style="text-align:left; padding:4px 0;">SYMBOL</th>
                <th style="text-align:left; padding:4px 0;">LTP</th>
                <th style="text-align:left; padding:4px 0;">CHG %</th>
                <th style="text-align:left; padding:4px 0;">BUILDUP</th>
              </tr>
            </thead>
            <tbody>
              {gainers_rows}
            </tbody>
          </table>
        </div>
      </div>

      {context_block}
    </section>
    <noscript>
      <div style="background:#1e293b; color:#f1f5f9; padding:20px; margin:20px auto; max-width:1440px; border-radius:8px; text-align:center;">
        <h3 style="margin:0 0 8px;">TradersDesk.in Quantitative Analytics Terminal</h3>
        <p style="margin:0; font-size:13px; color:#94a3b8;">You are viewing the pre-rendered dynamic snapshot for Session {date_str}. JavaScript is required for live WebSocket streaming, interactive charts, and real-time Option Greeks.</p>
      </div>
    </noscript>
    """

def clean_dynamic_html_body(html: str, path: str, snapshot: dict) -> str:
    """
    Substitutes 'Loading...' placeholders, populates initial KPI values,
    pre-activates route-relevant tab panels for crawlers, and injects crawler semantic HTML.
    """
    clean_p = ("/" + path.strip("/")).lower() if path != "/" else "/"
    date_str = snapshot.get("date", "16-Oct-2026")
    nifty = snapshot.get("nifty_spot", 23146.15)
    bn = snapshot.get("banknifty_spot", 55918.00)

    # 1. Substitute static Loading placeholders with rich keywords (Fast literal replace)
    static_replacements = [
        ('Loading multi-session EOD data...', f'NSE Derivatives Multi-Session Institutional EOD Data ({date_str})'),
        ('>Loading Expiries...<', '>Active Weekly &amp; Monthly Expiries<'),
        ('>Loading expiries...<', '>Active Weekly &amp; Monthly Expiries<'),
        ('Loading Volatility Regime Analysis...', 'India Volatility Index (VIX) &amp; Options Regime Analytics'),
        ('Loading strategy...', 'Quantitative Options Volatility &amp; Delta-Neutral Strategy Matrix'),
        ('Loading F&amp;O Stock Volatility Screener...', 'Institutional F&amp;O Volatility &amp; Greeks Screener'),
        ('Loading sessions...', 'Live &amp; Historical Trading Sessions'),
        ('>Loading Sessions...<', '>Live &amp; Historical Trading Sessions<'),
        ('Loading trend data...', 'Multi-Session Systemic MTF Trend Data'),
        ('Loading official NSE stockwise disclosure...', f'Official NSE Stockwise MTF Leverage &amp; Financing Disclosure ({date_str})'),
        ('Loading retail leaders...', 'High Retail Margin Trading Exposure Stocks'),
        ('Loading institutional anchors...', 'Institutional Bluechip MTF Anchor Equities'),
        ('Loading classification analysis...', 'NSE Equity Leverage Classification &amp; Heavyweight Distribution'),
        ('Loading heatmap...', 'Sectoral Margin Trading &amp; Leverage Heatmap'),
        ('Loading sectors...', 'Sectoral Margin Trading &amp; Derivatives Exposure Distribution'),
        ('Loading historical data from mtf.trading...', 'Historical Exchange MTF Loan Book &amp; Systemic Leverage Trend'),
        ('Loading global comparison...', 'Global Benchmark Margin Trading &amp; Leverage Comparison'),
        ('Loading Stock A metrics...', 'Select Stock A for Comparative Leverage &amp; OI Analytics'),
        ('Loading Stock B metrics...', 'Select Stock B for Comparative Leverage &amp; OI Analytics'),
        ('Loading history...', 'Comparative Multi-Session Leverage History'),
        ('Loading session history...', 'Session-by-Session MTF Loan Book Evolution'),
        ('Loading absorption data...', 'Institutional Cash Delivery Absorption &amp; Volume Shock Radar'),
        ('Loading volatility analysis...', 'Implied Volatility (IV) Skew &amp; Statistical Dispersion Analysis'),
        ('>Loading...</span>', f'>{date_str} EOD Synced</span>'),
        ('Loading dates...', f'Active NSE Sessions ({date_str})'),
        ('<div class="dash-kpi-val" id="dashKpiNifty">--</div>', f'<div class="dash-kpi-val" id="dashKpiNifty">{nifty:,.2f}</div>'),
        ('<div class="dash-kpi-val" id="dashKpiBankNifty">--</div>', f'<div class="dash-kpi-val" id="dashKpiBankNifty">{bn:,.2f}</div>')
    ]

    for pat, rep in static_replacements:
        html = html.replace(pat, rep)

    regex_replacements = [
        (re.compile(r'[\u23f3\s]*Loading 260\+ F&amp;O instruments\.\.\.', re.IGNORECASE), '220+ NSE &amp; BSE F&amp;O Instruments Tracked Live'),
        (re.compile(r'[\u23f3\s]*Loading live Option Chain Pro\.\.\.', re.IGNORECASE), 'Streaming Option Chain Pro with Greeks, PCR &amp; Max Pain'),
        (re.compile(r'<tr><td colspan=["\']?7["\']?[^>]*>Loading\.\.\.</td></tr>', re.IGNORECASE), '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Official NSE Stockwise MTF Exposure Matrix</td></tr>'),
        (re.compile(r'<tr><td colspan=["\']?9["\']?[^>]*>Loading\.\.\.</td></tr>', re.IGNORECASE), '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px;">Institutional MTF Leverage &amp; Classification Radar</td></tr>'),
        (re.compile(r'<tr><td colspan=["\']?4["\']?[^>]*>Loading\.\.\.</td></tr>', re.IGNORECASE), '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;">Institutional MTF Top Movers &amp; Squeeze Radar</td></tr>'),
        (re.compile(r'<tr><td colspan=["\']?6["\']?[^>]*>Loading\.\.\.</td></tr>', re.IGNORECASE), '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px;">Broker MTF Leverage &amp; Regulatory Benchmark Matrix</td></tr>'),
        (re.compile(r'NIFTY 50\s*•\s*Loading\.\.\.', re.IGNORECASE), f'NIFTY 50 • {nifty:,.2f}')
    ]
    for r_pat, rep in regex_replacements:
        html = r_pat.sub(rep, html)

    # 2. Pre-fill initial KPI values
    html = re.sub(r'<div class="dash-kpi-val" id="dashKpiNifty">--</div>', f'<div class="dash-kpi-val" id="dashKpiNifty">{nifty:,.2f}</div>', html)
    html = re.sub(r'<div class="dash-kpi-val" id="dashKpiBankNifty">--</div>', f'<div class="dash-kpi-val" id="dashKpiBankNifty">{bn:,.2f}</div>', html)

    # 3. Pre-activate route panel on server render for search engines
    route_panel_map = {
        "/": "panelDashboard",
        "/dashboard": "panelDashboard",
        "/futures": "panelFutures",
        "/global-markets": "panelGlobalMarkets",
        "/global": "panelGlobalMarkets",
        "/option-chain-pro": "panelUpstoxChain",
        "/options": "panelUpstoxChain",
        "/fii-dii": "panelSmartMoney",
        "/smart-money": "panelSmartMoney",
        "/delivery": "panelDelivery",
        "/mtf": "panelMtf",
        "/breadth": "panelBreadth"
    }

    target_panel = route_panel_map.get(clean_p)
    if not target_panel:
        for pfx, pnl in (("/futures", "panelFutures"), ("/delivery", "panelDelivery"), ("/mtf", "panelMtf"), ("/option", "panelUpstoxChain"), ("/fii", "panelSmartMoney"), ("/breadth", "panelBreadth"), ("/global", "panelGlobalMarkets")):
            if clean_p.startswith(pfx):
                target_panel = pnl
                break

    if target_panel and target_panel != "panelDashboard":
        # Remove active from panelDashboard and hide it
        html = re.sub(r'(id=["\']panelDashboard["\'][^>]*class=["\'][^"\']*)\bactive\b([^"\']*["\'])', r'\1\2 style="display:none;"', html)
        html = html.replace('class="tab-panel inst-dashboard-panel "', 'class="tab-panel inst-dashboard-panel"')

        # Add active and block display to target panel
        def _activate_panel(m):
            tag = m.group(0)
            tag = re.sub(r'style=["\'][^"\']*display\s*:\s*none[^"\']*["\']', '', tag)
            if 'class="' in tag:
                tag = re.sub(r'class=["\']([^"\']*)["\']', r'class="\1 active" style="display:block;"', tag)
            elif "class='" in tag:
                tag = re.sub(r"class=[']([^']*)[']", r'class="\1 active" style="display:block;"', tag)
            else:
                tag = tag.replace('>', ' class="tab-panel active" style="display:block;">')
            return tag

        html = re.sub(rf'<div[^>]*id=["\']{target_panel}["\'][^>]*>', _activate_panel, html, count=1)

    # 4. Desk-specific <h1> injection for 100% on-page heading alignment
    desk_h1_map = {
        "panelUpstoxChain": "Option Chain Pro &amp; Real-Time Option Greeks Terminal",
        "panelFutures": "Futures Intelligence &amp; Open Interest (OI) Buildup Desk",
        "panelSmartMoney": "Institutional Smart Money Flow &amp; Participant OI Radar",
        "panelDelivery": "Cash Delivery Volume Absorption &amp; Accumulation Scanner",
        "panelMtf": "Margin Trading Facility (MTF) &amp; Systemic Leverage Book",
        "panelBreadth": "Market Breadth &amp; Point and Figure Analytics Desk",
        "panelGlobalMarkets": "Real-Time Global Markets &amp; World Indices Macro Radar",
    }
    target_h1 = desk_h1_map.get(target_panel)
    if target_h1:
        html = re.sub(r'<h1[^>]*>.*?</h1>', f'<h1>{target_h1}</h1>', html, count=1, flags=re.DOTALL | re.IGNORECASE)

    return html

def inject_seo_metadata(html: str, path: str) -> str:
    """
    Main Dynamic SEO Server-Side Injection Pipeline.
    Injects dynamic live market metadata, enriched title & description,
    Schema.org JSON-LD structured data, Open Graph / Twitter tags,
    Google Site Verification, GA4, and eliminates 'Loading...' placeholders.
    """
    global_cfg = load_seo_config()
    snapshot = get_live_seo_market_snapshot()
    meta = get_dynamic_meta_for_path(path, snapshot)

    title = meta.get("title") or global_cfg["site_title"]
    desc = meta.get("desc") or global_cfg["meta_description"]
    keywords = meta.get("keywords") or global_cfg["keywords"]
    canonical = meta.get("canonical") or global_cfg["canonical_url"]
    robots_rule = meta.get("robots", "index, follow")

    if not global_cfg.get("robots_indexing", True):
        robots_rule = "noindex, nofollow"

    # 1. Update <title>
    html = re.sub(r'<title>.*?</title>', lambda _: f'<title>{title}</title>', html, count=1, flags=re.DOTALL | re.IGNORECASE)

    # 2. Update meta description
    if re.search(r'<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta name="description" content="{desc}">', html, count=1, flags=re.IGNORECASE)
    elif re.search(r'<meta\s+content=["\'].*?["\']\s+name=["\']description["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+content=["\'].*?["\']\s+name=["\']description["\']\s*/?>',
                      lambda _: f'<meta name="description" content="{desc}">', html, count=1, flags=re.IGNORECASE)

    # 3. Update meta keywords
    if re.search(r'<meta\s+name=["\']keywords["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']keywords["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta name="keywords" content="{keywords}">', html, count=1, flags=re.IGNORECASE)

    # 4. Update canonical link
    if re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<link\s+rel=["\']canonical["\']\s+href=["\'].*?["\']\s*/?>',
                      lambda _: f'<link rel="canonical" href="{canonical}">', html, count=1, flags=re.IGNORECASE)

    # 5. Update robots tag
    if re.search(r'<meta\s+name=["\']robots["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']robots["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta name="robots" content="{robots_rule}">', html, count=1, flags=re.IGNORECASE)
    elif "<head>" in html:
        html = html.replace("<head>", f'<head>\n  <meta name="robots" content="{robots_rule}">', 1)

    # 6. Update OpenGraph tags
    if re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+property=["\']og:title["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta property="og:title" content="{title}">', html, count=1, flags=re.IGNORECASE)
    if re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+property=["\']og:description["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta property="og:description" content="{desc}">', html, count=1, flags=re.IGNORECASE)
    if re.search(r'<meta\s+property=["\']og:url["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+property=["\']og:url["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta property="og:url" content="{canonical}">', html, count=1, flags=re.IGNORECASE)

    # 7. Update Twitter Card tags
    if re.search(r'<meta\s+name=["\']twitter:title["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']twitter:title["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta name="twitter:title" content="{title}">', html, count=1, flags=re.IGNORECASE)
    if re.search(r'<meta\s+name=["\']twitter:description["\']\s+content=["\'].*?["\']\s*/?>', html, re.IGNORECASE):
        html = re.sub(r'<meta\s+name=["\']twitter:description["\']\s+content=["\'].*?["\']\s*/?>',
                      lambda _: f'<meta name="twitter:description" content="{desc}">', html, count=1, flags=re.IGNORECASE)

    # 8. Google Site Verification
    g_verify = global_cfg.get("google_site_verification", "").strip()
    if "<script" in g_verify.lower() or "<!--" in g_verify or "googletagmanager" in g_verify.lower():
        extracted_ga = re.search(r'G-[A-Z0-9]{8,14}', g_verify)
        if extracted_ga and not global_cfg.get("google_analytics_id"):
            global_cfg["google_analytics_id"] = extracted_ga.group(0)
        m_c = re.search(r'content=["\']([a-zA-Z0-9_-]{20,60})["\']', g_verify)
        g_verify = m_c.group(1) if m_c else ""

    if g_verify:
        if "google-site-verification" in html:
            html = re.sub(r'<meta\s+name=["\']google-site-verification["\']\s+content=["\'].*?["\']\s*/?>',
                          lambda _: f'<meta name="google-site-verification" content="{g_verify}">', html, count=1, flags=re.IGNORECASE)
        elif "<head>" in html:
            html = html.replace("<head>", f'<head>\n  <meta name="google-site-verification" content="{g_verify}">', 1)

    # 9. Google Analytics 4 (GA4) / GTM Script Injection
    import os
    ga_id = (global_cfg.get("google_analytics_id", "") or os.getenv("GOOGLE_ANALYTICS_ID", "G-Y0MDT0BZD8")).strip()
    if ga_id:
        if f"id={ga_id}" not in html:
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

    # 10. Inject Dynamic Schema.org JSON-LD
    dynamic_json_ld = generate_dynamic_json_ld(path, snapshot)
    json_ld_script = f'\n  <!-- Structured Data: Dynamic Schema.org JSON-LD -->\n  <script type="application/ld+json">\n{dynamic_json_ld}\n  </script>'

    if re.search(r'<script\s+type=["\']application/ld\+json["\']>.*?</script>', html, re.DOTALL | re.IGNORECASE):
        html = re.sub(r'<script\s+type=["\']application/ld\+json["\']>.*?</script>', lambda _: json_ld_script, html, count=1, flags=re.DOTALL | re.IGNORECASE)
    elif "</head>" in html:
        html = html.replace("</head>", f"{json_ld_script}\n</head>", 1)

    # 11. Body Cleaning: Eliminate 'Loading...' placeholders & Inject Crawler Prerender
    html = clean_dynamic_html_body(html, path, snapshot)

    return html

def get_crawler_inspection_preview(path: str) -> dict:
    """Helper for the Admin Panel command to inspect exact crawler output."""
    clean_p = ("/" + path.strip("/")).lower() if path.strip("/") else "/"
    index_file = ROOT / "public" / "index.html"
    raw_html = index_file.read_text(encoding="utf-8") if index_file.exists() else "<html><body></body></html>"
    snapshot = get_live_seo_market_snapshot()
    processed_html = inject_seo_metadata(raw_html, clean_p)

    # Extract title
    t_match = re.search(r'<title>(.*?)</title>', processed_html, re.DOTALL | re.IGNORECASE)
    title = t_match.group(1).strip() if t_match else ""

    # Extract description
    d_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', processed_html, re.IGNORECASE)
    desc = d_match.group(1).strip() if d_match else ""

    # Check remaining Loading placeholders
    loading_matches = re.findall(r'[^<>\n\r]{0,30}loading[^<>\n\r]{0,30}', processed_html, re.IGNORECASE)
    # Exclude element IDs like id="mtaChartLoading"
    user_loading = [m.strip() for m in loading_matches if 'id=' not in m.lower()]

    return {
        "path": clean_p,
        "title": title,
        "desc": desc,
        "canonical": f"https://tradersdesk.in{clean_p if clean_p != '/' else ''}",
        "snapshot": snapshot,
        "loadingPlaceholdersCount": len(user_loading),
        "zeroLoadingGuaranteed": len(user_loading) == 0,
        "htmlLength": len(processed_html),
        "hasStructuredData": "application/ld+json" in processed_html,
        "hasCrawlerSection": "id=\"seoDynamicCrawlContent\"" in processed_html
    }
