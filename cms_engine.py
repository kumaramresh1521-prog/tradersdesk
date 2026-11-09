import json
import re
import html
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
NAV_FILE = DATA_DIR / "navigation_master.json"
PAGES_FILE = DATA_DIR / "cms_pages.json"
POSTS_FILE = DATA_DIR / "cms_posts.json"
TEMPLATES_DIR = ROOT_DIR / "templates"
BLOG_PORTAL_TEMPLATE = TEMPLATES_DIR / "blog_portal.html"
BLOG_ARTICLE_TEMPLATE = TEMPLATES_DIR / "blog_article.html"
BLOG_STYLES_TEMPLATE = TEMPLATES_DIR / "blog_styles.css"

# ==============================================================================
# 1. MARKDOWN TO HTML PARSER (Zero-dependency, clean GFM subset)
# ==============================================================================

def markdown_to_html(md_text: str) -> str:
    """Converts a standard GFM Markdown string into safe, styled institutional HTML."""
    if not md_text:
        return ""

    lines = md_text.splitlines()
    html_lines = []
    in_code_block = False
    code_lang = ""
    in_table = False
    table_rows = []
    in_list = False

    def close_table():
        nonlocal in_table, table_rows, html_lines
        if in_table and table_rows:
            html_lines.append('<div class="table-responsive"><table class="cms-table">')
            for r_idx, row in enumerate(table_rows):
                cols = [c.strip() for c in row.split('|')[1:-1]]
                if r_idx == 0:
                    html_lines.append('<thead><tr>' + ''.join(f'<th>{html.escape(c)}</th>' for c in cols) + '</tr></thead><tbody>')
                elif r_idx == 1 and all(set(c).issubset({'-', ':', ' '}) for c in cols):
                    continue
                else:
                    html_lines.append('<tr>' + ''.join(f'<td>{inline_md(c)}</td>' for c in cols) + '</tr>')
            html_lines.append('</tbody></table></div>')
            table_rows = []
            in_table = False

    def close_list():
        nonlocal in_list, html_lines
        if in_list:
            html_lines.append('</ul>')
            in_list = False

    def inline_md(text: str) -> str:
        # Bold **text**
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        # Italic *text*
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        # Inline code `code`
        text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
        # Links [text](url)
        text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', text)
        return text

    for line in lines:
        stripped = line.strip()

        # Fenced code block
        if stripped.startswith("```"):
            if in_code_block:
                html_lines.append('</code></pre>')
                in_code_block = False
            else:
                close_table()
                close_list()
                code_lang = stripped[3:].strip()
                html_lines.append(f'<pre class="cms-code-block"><code class="language-{code_lang}">')
                in_code_block = True
            continue

        if in_code_block:
            html_lines.append(html.escape(line))
            continue

        # Tables
        if stripped.startswith("|") and stripped.endswith("|"):
            close_list()
            in_table = True
            table_rows.append(stripped)
            continue
        elif in_table:
            close_table()

        # Unordered lists
        if stripped.startswith("- ") or stripped.startswith("* "):
            if not in_list:
                html_lines.append('<ul class="cms-list">')
                in_list = True
            item_text = stripped[2:].strip()
            html_lines.append(f'<li>{inline_md(item_text)}</li>')
            continue
        elif in_list:
            close_list()

        # Horizontal Rule
        if stripped in ("---", "***", "___"):
            close_table()
            close_list()
            html_lines.append('<hr class="cms-divider" />')
            continue

        # Blockquote
        if stripped.startswith(">"):
            quote_text = stripped[1:].strip()
            html_lines.append(f'<blockquote class="cms-quote">{inline_md(quote_text)}</blockquote>')
            continue

        # Headers
        if stripped.startswith("# "):
            html_lines.append(f'<h1 class="cms-h1">{inline_md(stripped[2:])}</h1>')
            continue
        if stripped.startswith("## "):
            html_lines.append(f'<h2 class="cms-h2">{inline_md(stripped[3:])}</h2>')
            continue
        if stripped.startswith("### "):
            html_lines.append(f'<h3 class="cms-h3">{inline_md(stripped[4:])}</h3>')
            continue
        if stripped.startswith("#### "):
            html_lines.append(f'<h4 class="cms-h4">{inline_md(stripped[5:])}</h4>')
            continue

        # Regular Paragraph
        if stripped:
            html_lines.append(f'<p class="cms-p">{inline_md(stripped)}</p>')

    close_table()
    close_list()
    return "\n".join(html_lines)


# ==============================================================================
# 2. MASTER NAVIGATION ENGINE
# ==============================================================================

_NAV_CACHE: Optional[Dict[str, Any]] = None
_FOOTER_CACHE: Optional[dict] = None
_PAGES_CACHE: Optional[List[Dict[str, Any]]] = None
_POSTS_CACHE: Optional[List[Dict[str, Any]]] = None
_SETTINGS_CACHE: Optional[Dict[str, Any]] = None
_ADS_CACHE: Optional[dict] = None

def reload_cms_caches() -> None:
    """Flushes all in-memory CMS caches so subsequent reads fetch freshly synced cloud/disk states."""
    global _NAV_CACHE, _FOOTER_CACHE, _PAGES_CACHE, _POSTS_CACHE, _SETTINGS_CACHE, _ADS_CACHE
    _NAV_CACHE = None
    _FOOTER_CACHE = None
    _PAGES_CACHE = None
    _POSTS_CACHE = None
    _SETTINGS_CACHE = None
    _ADS_CACHE = None

def get_navigation() -> Dict[str, Any]:
    global _NAV_CACHE
    if _NAV_CACHE is not None and isinstance(_NAV_CACHE, dict) and _NAV_CACHE.get("items"):
        return _NAV_CACHE

    if NAV_FILE.exists():
        try:
            with open(NAV_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict) and d.get("items"):
                    _NAV_CACHE = d
                    return _NAV_CACHE
        except Exception:
            pass
    try:
        import supabase_engine
        cloud_nav = supabase_engine.load_app_config_from_supabase("navigation_master")
        if isinstance(cloud_nav, dict) and cloud_nav.get("items"):
            _NAV_CACHE = cloud_nav
            try:
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                with open(NAV_FILE, "w", encoding="utf-8") as f:
                    json.dump(cloud_nav, f, indent=2)
                with open(DATA_DIR / "navigation.json", "w", encoding="utf-8") as f:
                    json.dump(cloud_nav, f, indent=2)
            except Exception:
                pass
            return cloud_nav
    except Exception:
        pass
    _NAV_CACHE = {"updatedAt": datetime.utcnow().isoformat() + "Z", "items": []}
    return _NAV_CACHE

def save_navigation(data: Any) -> bool:
    global _NAV_CACHE
    if isinstance(data, list):
        data = {"items": data}
    elif isinstance(data, dict):
        if "items" not in data and "navigation" in data and isinstance(data["navigation"], list):
            data = {"items": data["navigation"]}
    if not isinstance(data, dict):
        data = {"items": []}
    data["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    _NAV_CACHE = data
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(NAV_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        try:
            with open(DATA_DIR / "navigation.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("navigation_master", data)
        except Exception as se:
            print(f"[CMS] Supabase navigation sync note: {se}")
        return True
    except Exception as exc:
        print(f"[CMS] Failed saving navigation: {exc}")
        return False

DESK_ONCLICK_MAP = {
    "/": "return window.instNavClick(event, 'dashboard')",
    "/dashboard": "return window.instNavClick(event, 'dashboard')",
    "/futures": "return window.instNavClick(event, 'futures', 'matrix')",
    "/futures/marketwatch": "return window.instNavClick(event, 'futures', 'matrix')",
    "/futures/open-interest": "if(window.instNavClick){return window.instNavClick(event, 'futures', 'openInterest');}",
    "/futures/future-intraday": "if(window.instNavClick){return window.instNavClick(event, 'futures', 'futureIntraday');}",
    "/futures/future-vs-oi": "if(window.instNavClick){return window.instNavClick(event, 'futures', 'futureVsOi');}",
    "/futures/buildup": "if(window.instNavClick){return window.instNavClick(event, 'futures', 'buildup');}",
    "/futures/heatmap": "if(window.instNavClick){return window.instNavClick(event, 'futures', 'heatmap');}",
    "/futures/indices": "if(window.instNavClick){return window.instNavClick(event, 'futures', 'indices');}",
    "/futures/mwpl": "if(window.instNavClick){return window.instNavClick(event, 'futures', 'mwpl');}",
    "/option-chain-pro": "if(window.instNavClick){return window.instNavClick(event, 'upstoxChain');}",
    "/options": "if(window.instNavClick){return window.instNavClick(event, 'upstoxChain');}",
    "/fii-dii": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'cash');}",
    "/fii-dii/cash": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'cash');}",
    "/fii-dii-cash": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'cash');}",
    "/fii-dii/derivatives": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'derivatives');}",
    "/fii-dii-derivatives": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'derivatives');}",
    "/fii-dii/participant-oi": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'oi');}",
    "/fii-dii/oi": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'oi');}",
    "/fii-dii#oi": "if(window.instNavClick){return window.instNavClick(event, 'smartmoney', 'oi');}",
    "/delivery": "return window.instNavClick(event, 'delivery')",
    "/mtf": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'overview');}",
    "/mtf/overview": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'overview');}",
    "/mtf/topstocks": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'topstocks');}",
    "/mtf/retail": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'retail');}",
    "/mtf/movers": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'movers');}",
    "/mtf/sectors": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'sectors');}",
    "/mtf/trend": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'trend');}",
    "/mtf/broker": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'broker');}",
    "/mtf/brokers": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'broker');}",
    "/mtf/global": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'global');}",
    "/mtf/calculator": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'calculator');}",
    "/mtf/compare": "if(window.instNavClick){return window.instNavClick(event, 'mtf', 'compare');}",
}

def get_canonical_btn_id(item_id: str, url: str) -> str:
    u = (url or '').lower().rstrip('/')
    i = (item_id or '').lower()
    if i == 'nav_dashboard' or u in ('', '/'): return 'navDashboard'
    if i == 'nav_futures' or u.startswith('/futures'): return 'navFutures'
    if i == 'nav_options' or u.startswith('/option'): return 'navOptions'
    if i == 'nav_charts' or u.startswith('/chart'): return 'navCharts'
    if i == 'nav_fiidii' or u.startswith('/fii') or u.startswith('/smart'): return 'navFiiDii'
    if i == 'nav_delivery' or u.startswith('/delivery'): return 'navDelivery'
    if i == 'nav_mtf' or u.startswith('/mtf'): return 'navMtf'
    if i == 'nav_blog' or u.startswith('/blog'): return 'navBlog'
    return item_id or ''

def render_navigation_html(current_path: str = "/") -> str:
    """Renders the exact institutional header navigation HTML dynamically."""
    nav_data = get_navigation()
    items = nav_data.get("items", [])
    out = ['<nav class="inst-nav" aria-label="Main Navigation" id="mainInstNav">']

    for item in items:
        if not item.get("active", True):
            continue

        item_id = item.get("id", "")
        label = item.get("label", "")
        url = item.get("url", "#")
        icon = item.get("icon", "")
        has_dropdown = item.get("hasDropdown", False)
        badge = item.get("badge", "")
        badge_color = item.get("badgeColor", "teal")
        is_highlight = item.get("highlight", False)
        is_active = (current_path == url or (url != "/" and current_path.startswith(url)))

        btn_classes = ["inst-nav-btn"]
        if is_highlight:
            btn_classes.append("inst-nav-btn-highlight")
        if is_active:
            btn_classes.append("active")

        canonical_id = get_canonical_btn_id(item_id, url)
        id_attr = f' id="{canonical_id}"' if canonical_id else ""
        onclick_code = DESK_ONCLICK_MAP.get(url, "")
        onclick_attr = f' onclick="{onclick_code}"' if onclick_code else ""

        if not has_dropdown:
            out.append(f'<div class="inst-nav-item">')
            badge_html = f'<span class="p2-badge p2-badge-{badge_color}">{html.escape(badge)}</span>' if badge else ""
            out.append(f'  <a href="{html.escape(url)}"{id_attr} class="{" ".join(btn_classes)}"{onclick_attr}>')
            if icon:
                out.append(f'    <span class="inst-nav-icon">{html.escape(icon)}</span>')
            out.append(f'    <span class="nav-label">{html.escape(label)}</span>')
            if badge_html:
                out.append(f'    {badge_html}')
            out.append('  </a>')
            out.append('</div>')
        else:
            out.append(f'<div class="inst-nav-item has-dropdown">')
            out.append(f'  <a href="{html.escape(url)}"{id_attr} class="{" ".join(btn_classes)}"{onclick_attr}>')
            if icon:
                out.append(f'    <span class="inst-nav-icon">{html.escape(icon)}</span>')
            out.append(f'    <span class="nav-label">{html.escape(label)}</span>')
            if badge:
                out.append(f'    <span class="p2-badge p2-badge-{badge_color}">{html.escape(badge)}</span>')
            out.append('    <span class="inst-nav-arrow">▾</span>')
            out.append('  </a>')

            # Render Dropdown Columns (Systematic Zero-Empty-Space Filter)
            raw_columns = item.get("columns", [])
            active_columns = []
            for col in raw_columns:
                active_subs = [sub for sub in col.get("items", []) if sub.get("active", True)]
                if active_subs:
                    active_columns.append((col, active_subs))

            col_class = "inst-dropdown-md" if len(active_columns) >= 2 else "inst-dropdown-sm"
            is_single = " is-single-col" if len(active_columns) == 1 else ""
            out.append(f'  <div class="inst-dropdown {col_class}{is_single}">')
            for col, active_subs in active_columns:
                out.append('    <div class="inst-dropdown-col">')
                header_text = col.get("header") or col.get("title") or ""
                if header_text:
                    out.append(f'      <span class="inst-dropdown-header">{html.escape(header_text)}</span>')
                for sub in active_subs:
                    sub_url = sub.get("url", "#")
                    flag_attr = f' data-feature-flag="{html.escape(sub["featureFlag"])}"' if sub.get("featureFlag") else ""
                    sub_badge_html = f'<span class="p2-badge p2-badge-{sub.get("badgeColor","teal")}" style="margin-left:4px;">{html.escape(sub["badge"])}</span>' if sub.get("badge") else ""
                    sub_desc = sub.get("subtitle") or sub.get("sub") or ""
                    sub_onclick = DESK_ONCLICK_MAP.get(sub_url, "")
                    sub_onclick_attr = f' onclick="{sub_onclick}"' if sub_onclick else ""
                    out.append(f'      <a href="{html.escape(sub_url)}" class="inst-dd-item"{flag_attr}{sub_onclick_attr}>')
                    if sub.get("icon"):
                        out.append(f'        <span class="dd-icon">{html.escape(sub["icon"])}</span>')
                    out.append('        <div class="dd-text">')
                    out.append(f'          <span class="dd-title">{html.escape(sub.get("title",""))}{sub_badge_html}</span>')
                    if sub_desc:
                        out.append(f'          <span class="dd-sub">{html.escape(sub_desc)}</span>')
                    out.append('        </div>')
                    out.append('      </a>')
                out.append('    </div>')
            out.append('  </div>')
            out.append('</div>')

    out.append("""  <!-- Preserved hidden tabs for backward JS compatibility -->
  <button id="navUpstoxChain" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Option Chain Pro</button>
  <button id="navBreadthContrib" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Breadth Contrib</button>
  <button id="navBreadth" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Market Breadth</button>
  <button id="tabBreadth" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Breadth</button>
  <button id="tabOptions" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Options</button>
  <button id="tabSmartMoney" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Smart Money</button>
  <button id="tabDelivery" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Delivery</button>
  <button id="tabMtf" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">MTF</button>
  <button id="tabTools" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Tools</button>
  <button id="tabSettings" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Settings</button>""")
    out.append('</nav>')
    return "\n".join(out)


# ==============================================================================
# 2.5 DYNAMIC FOOTER ENGINE (Real-Time Admin Sync with Left Brand Logo Column)
# ==============================================================================

FOOTER_FILE = DATA_DIR / "footer_links.json"

DEFAULT_FOOTER_DATA = {
    "ok": True,
    "columns": [
        {
            "id": "col1",
            "title": "🏛️ Institutional Desks",
            "links": [
                {"label": "Breadth & Contribution", "url": "/breadth-contribution", "type": "link", "target": "_self"},
                {"label": "FII & DII Smart Money", "url": "/fii-dii", "type": "inst", "target": "smartMoney"},
                {"label": "Cash Delivery Absorption", "url": "/delivery", "type": "inst", "target": "delivery"},
                {"label": "MTF Margin Trading Book", "url": "/mtf", "type": "inst", "target": "mtf"},
                {"label": "Open Interest Desk", "url": "/open-interest/nifty", "type": "link", "target": "_self"},
                {"label": "Institutional Dashboard", "url": "/dashboard", "type": "inst", "target": "dashboard"}
            ]
        },
        {
            "id": "col2",
            "title": "⚡ Derivatives & Options",
            "links": [
                {"label": "Option Chain Pro", "url": "/option-chain-pro", "type": "inst", "target": "upstoxChain"},
                {"label": "Future Marketwatch Matrix", "url": "/futures", "type": "inst", "target": "futures:matrix"},
                {"label": "Future Buildup Quadrants", "url": "/futures/buildup", "type": "inst", "target": "futures:buildup"},
                {"label": "Future Open Interest & Buildup", "url": "/futures/open-interest", "type": "inst", "target": "futures:openInterest"},
                {"label": "Futures Sector Heatmap", "url": "/futures/heatmap", "type": "inst", "target": "futures:heatmap"},
                {"label": "Straddle Analytics Engine", "url": "/straddle", "type": "link", "target": "_self"},
                {"label": "Call vs Put Premium", "url": "/call-vs-put-premium", "type": "link", "target": "_self"},
                {"label": "MWPL & Ban Radar", "url": "/futures/mwpl", "type": "inst", "target": "futures:mwpl"},
                {"label": "Historical Rollover Matrix", "url": "/futures/rollover", "type": "link", "target": "_self"}
            ]
        },
        {
            "id": "col3",
            "title": "📊 Market Analytics & Tools",
            "links": [
                {"label": "Breadth & Net Contribution", "url": "/breadth-contribution", "type": "link", "target": "_self"},
                {"label": "NSE Trading Holiday Calendar", "url": "/calendar_studio.html", "type": "link", "target": "_self"},
                {"label": "Participant OI Matrix", "url": "/fii-dii#oi", "type": "inst", "target": "smartMoney:oi"},
                {"label": "F&O Sector Visual Heatmap", "url": "/futures/heatmap", "type": "inst", "target": "futures:heatmap"},
                {"label": "Real-Time Options Greeks", "url": "/option-chain-pro", "type": "inst", "target": "upstoxChain"},
                {"label": "Stock Delivery Accumulation", "url": "/delivery", "type": "inst", "target": "delivery"},
                {"label": "Historical Technical Charts", "url": "/chart", "type": "link", "target": "_self"}
            ]
        },
        {
            "id": "col4",
            "title": "🛡️ Regulatory & Compliance",
            "links": [
                {"label": "SEBI Regulatory Disclaimer", "url": "/disclaimer", "type": "link", "target": "_self"},
                {"label": "Privacy & Data Governance", "url": "/privacy", "type": "link", "target": "_self"},
                {"label": "Terms of Institutional Service", "url": "/terms", "type": "link", "target": "_self"},
                {"label": "Quantitative Model Architecture", "url": "/about", "type": "link", "target": "_self"},
                {"label": "Contact & Trader Support", "url": "/contact", "type": "link", "target": "_self"},
                {"label": "NSE Official Regulatory Archive ↗", "url": "https://www.nseindia.com", "type": "link", "target": "_blank"}
            ]
        }
    ]
}

def get_footer_links_data() -> dict:
    """Loads footer configuration from in-memory cache, data/footer_links.json, Supabase cloud, repository root, or defaults."""
    global _FOOTER_CACHE
    if _FOOTER_CACHE is not None and isinstance(_FOOTER_CACHE, dict) and _FOOTER_CACHE.get("columns"):
        return _FOOTER_CACHE

    if FOOTER_FILE.exists():
        try:
            with open(FOOTER_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict) and d.get("columns"):
                    _FOOTER_CACHE = d
                    return _FOOTER_CACHE
        except Exception:
            pass
    try:
        import supabase_engine
        cloud_d = supabase_engine.load_app_config_from_supabase("footer_links")
        if isinstance(cloud_d, dict) and cloud_d.get("columns"):
            _FOOTER_CACHE = cloud_d
            try:
                DATA_DIR.mkdir(parents=True, exist_ok=True)
                with open(FOOTER_FILE, "w", encoding="utf-8") as f:
                    json.dump(cloud_d, f, indent=2)
            except Exception:
                pass
            return cloud_d
    except Exception:
        pass
    rf = ROOT_DIR / "footer_links.json"
    if rf.exists():
        try:
            with open(rf, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict) and d.get("columns"):
                    _FOOTER_CACHE = d
                    return _FOOTER_CACHE
        except Exception:
            pass
    _FOOTER_CACHE = DEFAULT_FOOTER_DATA
    return _FOOTER_CACHE

def set_footer_cache(data: dict) -> None:
    global _FOOTER_CACHE
    _FOOTER_CACHE = data

def render_footer_html(current_path: str = "/") -> str:
    """Renders the complete, unified institutional footer with Left Brand Logo Column."""
    footer_data = get_footer_links_data()
    columns = footer_data.get("columns", [])
    col_colors = {
        "col1": "#38bdf8",
        "col2": "#a78bfa",
        "col3": "#34d399",
        "col4": "#f59e0b"
    }

    cols_html = []
    for c_idx, col in enumerate(columns):
        cid = col.get("id", f"col{c_idx+1}")
        color = col_colors.get(cid, "#38bdf8")
        title = col.get("title", f"Column {c_idx+1}")
        links = col.get("links", [])
        
        links_markup = []
        for lnk in links:
            lbl = html.escape(lnk.get("label", ""))
            url = html.escape(lnk.get("url", "#"))
            target = lnk.get("target", "_self")
            target_attr = ' target="_blank" rel="noopener"' if target == "_blank" else ''
            onclick_attr = f' onclick="if(typeof navigateDesk===\'function\'){{ return navigateDesk(\'\', \'\', \'{url}\', event); }}"' if target != "_blank" else ''
            links_markup.append(f'        <a href="{url}"{target_attr}{onclick_attr}>{lbl}</a>')
        
        joined_links = "\n".join(links_markup)
        cols_html.append(f"""      <div class="footer-link-group" data-col="{html.escape(cid)}">
        <h4 style="color:{color};">{html.escape(title)}</h4>
        <div class="footer-links-list">
{joined_links}
        </div>
      </div>""")

    joined_cols = "\n".join(cols_html)

    return f"""<footer class="terminal-footer">
  <div class="footer-layout-wrapper">
    <!-- Brand Column on the Left with Logo -->
    <div class="footer-brand-col">
      <a href="/" class="footer-brand-logo" title="TradersDesk.in • Institutional Quant &amp; Derivatives Terminal">
        <img src="/tradersdesk_header.svg" alt="TradersDesk.in" width="168" height="28" class="inst-brand-logo-img inst-brand-logo-dark" style="height:28px !important; width:auto !important; max-height:28px !important;" onerror="this.style.display='none'; document.getElementById('footerBrandFallback').style.display='inline-flex';" />
        <img src="/tradersdesk_header_light.svg" alt="TradersDesk.in" width="168" height="28" class="inst-brand-logo-img inst-brand-logo-light" style="height:28px !important; width:auto !important; max-height:28px !important;" onerror="this.style.display='none'; document.getElementById('footerBrandFallback').style.display='inline-flex';" />
        <div class="inst-brand-fallback-text" id="footerBrandFallback" style="display:none; align-items:center; font-size:18px; font-weight:800; letter-spacing:-0.3px;">
          <span class="fallback-traders">Traders</span><span class="fallback-desk">Desk</span><span style="background:#10b981; color:#030712; font-family:'JetBrains Mono', monospace; font-size:11px; font-weight:900; padding:1.5px 5px; border-radius:4px; margin-left:5px;">.in</span>
        </div>
      </a>
      <p class="footer-brand-desc">
        Institutional-grade quantitative analytics, real-time market breadth, options Greeks &amp; derivatives intelligence terminal for Indian equities and indices.
      </p>
      <div class="footer-brand-badges">
        <span class="p2-badge p2-badge-teal">NSE • BSE • MCX</span>
        <span class="p2-badge p2-badge-blue">Live Derivatives</span>
      </div>
      <div class="footer-system-status">
        <span class="footer-status-dot"></span>
        <span>Black-Scholes &bull; Quant Architecture</span>
      </div>
    </div>

    <!-- 4-Column Navigation Links Grid -->
    <div class="footer-four-columns" id="footerFourColumnsGrid">
{joined_cols}
    </div>
  </div>

  <!-- Bottom Regulatory & Copyright Row -->
  <div class="footer-bottom">
    <div class="footer-copy-text">
      &copy; 2026 TradersDesk.in &bull; Black-Scholes Mathematically Certified &bull; Real-Time Indian Equities &amp; Derivatives Terminal
    </div>
    <div class="footer-sebi-text">
      SEBI Compliance Notice: Strictly for educational, quantitative research &amp; institutional market analysis only. Not investment advice.
    </div>
  </div>
</footer>"""


# ==============================================================================
# 3. DYNAMIC PAGES CMS ENGINE
# ==============================================================================

def list_pages() -> List[Dict[str, Any]]:
    global _PAGES_CACHE
    if _PAGES_CACHE is not None and isinstance(_PAGES_CACHE, list):
        return _PAGES_CACHE

    pages = []
    if PAGES_FILE.exists():
        try:
            with open(PAGES_FILE, "r", encoding="utf-8") as f:
                pages = json.load(f)
        except Exception:
            pages = []
    if not pages:
        try:
            import supabase_engine
            cloud_pages = supabase_engine.load_app_config_from_supabase("cms_pages")
            if isinstance(cloud_pages, list) and cloud_pages:
                pages = cloud_pages
                try:
                    DATA_DIR.mkdir(parents=True, exist_ok=True)
                    with open(PAGES_FILE, "w", encoding="utf-8") as f:
                        json.dump(cloud_pages, f, indent=2)
                except Exception:
                    pass
        except Exception:
            pass
    _PAGES_CACHE = pages if isinstance(pages, list) else []
    return _PAGES_CACHE

def get_page(slug: str) -> Optional[Dict[str, Any]]:
    clean_slug = slug.strip().lstrip("/").lower()
    for p in list_pages():
        if p.get("slug", "").strip().lower() == clean_slug:
            return p
    return None

def save_page(page_data: Dict[str, Any]) -> bool:
    global _PAGES_CACHE
    pages = list(list_pages())
    slug = page_data.get("slug", "").strip().lstrip("/").lower()
    if not slug:
        return False

    page_data["slug"] = slug
    is_draft = (page_data.get("status", "").lower() == "draft")
    page_data["published"] = not is_draft
    if not is_draft:
        page_data["status"] = "published"
    page_data["updatedAt"] = datetime.utcnow().isoformat() + "Z"

    idx = next((i for i, p in enumerate(pages) if p.get("slug", "").strip().lower() == slug), None)
    if idx is not None:
        pages[idx] = page_data
    else:
        if not page_data.get("id"):
            page_data["id"] = f"page_{int(datetime.utcnow().timestamp())}"
        pages.append(page_data)

    _PAGES_CACHE = pages
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(PAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(pages, f, indent=2)
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("cms_pages", pages)
        except Exception as se:
            print(f"[CMS] Supabase pages sync note: {se}")
        return True
    except Exception as exc:
        print(f"[CMS] Failed saving page {slug}: {exc}")
        return False

def delete_page(slug: str) -> bool:
    global _PAGES_CACHE
    clean_slug = slug.strip().lstrip("/").lower()
    pages = [p for p in list_pages() if p.get("slug", "").strip().lower() != clean_slug]
    _PAGES_CACHE = pages
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(PAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(pages, f, indent=2)
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("cms_pages", pages)
        except Exception as se:
            print(f"[CMS] Supabase pages delete note: {se}")
        return True
    except Exception as exc:
        print(f"[CMS] Failed deleting page {slug}: {exc}")
        return False

# ==============================================================================
# 4. BLOG & ARTICLE CMS ENGINE
# ==============================================================================

def list_posts(published_only: bool = True) -> List[Dict[str, Any]]:
    global _POSTS_CACHE
    if _POSTS_CACHE is None or not isinstance(_POSTS_CACHE, list):
        posts = []
        if POSTS_FILE.exists():
            try:
                with open(POSTS_FILE, "r", encoding="utf-8") as f:
                    posts = json.load(f)
            except Exception:
                posts = []
        if not posts:
            try:
                import supabase_engine
                cloud_posts = supabase_engine.load_app_config_from_supabase("cms_posts")
                if isinstance(cloud_posts, list) and cloud_posts:
                    posts = cloud_posts
                    try:
                        DATA_DIR.mkdir(parents=True, exist_ok=True)
                        with open(POSTS_FILE, "w", encoding="utf-8") as f:
                            json.dump(cloud_posts, f, indent=2)
                    except Exception:
                        pass
            except Exception:
                pass
        _POSTS_CACHE = posts if isinstance(posts, list) else []

    all_p = _POSTS_CACHE or []
    if published_only:
        return [
            p for p in all_p 
            if p.get("published") is not False 
            and (p.get("status") or "published").lower() != "draft"
        ]
    return all_p

def get_post(slug: str) -> Optional[Dict[str, Any]]:
    clean_slug = slug.strip().lstrip("/").lower()
    for p in list_posts(published_only=False):
        if p.get("slug", "").strip().lower() == clean_slug:
            return p
    return None

def save_post(post_data: Dict[str, Any]) -> bool:
    global _POSTS_CACHE
    posts = list(list_posts(published_only=False))
    slug = post_data.get("slug", "").strip().lstrip("/").lower()
    if not slug:
        slug = re.sub(r'[^a-z0-9]+', '-', post_data.get("title", "").lower()).strip('-')
    post_data["slug"] = slug
    is_draft = (post_data.get("status", "").lower() == "draft")
    post_data["published"] = not is_draft
    if not is_draft:
        post_data["status"] = "published"

    if not post_data.get("publishedAt"):
        post_data["publishedAt"] = datetime.utcnow().strftime("%Y-%m-%d")

    idx = next((i for i, p in enumerate(posts) if p.get("slug", "").strip().lower() == slug), None)
    if idx is not None:
        posts[idx] = post_data
    else:
        if not post_data.get("id"):
            post_data["id"] = f"post_{int(datetime.utcnow().timestamp())}"
        posts.insert(0, post_data)

    _POSTS_CACHE = posts
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(POSTS_FILE, "w", encoding="utf-8") as f:
            json.dump(posts, f, indent=2)
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("cms_posts", posts)
        except Exception as se:
            print(f"[CMS] Supabase post sync note: {se}")
        return True
    except Exception as exc:
        print(f"[CMS] Failed saving post {slug}: {exc}")
        return False

def delete_post(post_id: str) -> bool:
    global _POSTS_CACHE
    posts = [p for p in list_posts(published_only=False) if p.get("id") != post_id and p.get("slug") != post_id]
    _POSTS_CACHE = posts
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(POSTS_FILE, "w", encoding="utf-8") as f:
            json.dump(posts, f, indent=2)
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("cms_posts", posts)
        except Exception as se:
            print(f"[CMS] Supabase post delete note: {se}")
        return True
    except Exception as exc:
        print(f"[CMS] Failed deleting post {post_id}: {exc}")
        return False

# ==============================================================================
# 5. SHELL TEMPLATE BUILDER FOR PAGES & BLOG
# ==============================================================================

TEMPLATE_FILE = ROOT_DIR / "templates" / "cms_shell.html"

def render_cms_shell(
    title: str,
    description: str,
    body_content: str,
    current_path: str = "/",
    custom_css: str = "",
    canonical_url: str = "",
    robots_meta: str = "index, follow",
    keywords: str = "",
    is_draft: bool = False
) -> str:
    """Wraps any page or blog post in the unified TradersDesk terminal template."""
    nav_html = render_navigation_html(current_path)
    canon = canonical_url.strip() if canonical_url else f"https://tradersdesk.in{current_path}"
    robots = robots_meta.strip() if robots_meta else "index, follow"

    draft_banner = """<div style="background:#eab308; color:#0f172a; padding:10px 16px; text-align:center; font-weight:800; font-size:12.5px; font-family:'JetBrains Mono', monospace; border-bottom:2px solid #ca8a04; letter-spacing:0.5px;">
    &#x26A0;&#xFE0F; DRAFT PREVIEW MODE &mdash; This document is saved as a draft and is hidden from public indexing.
  </div>""" if is_draft else ""

    custom_style_block = f"<style>{custom_css}</style>" if custom_css.strip() else ""
    keywords_tag = f'<meta name="keywords" content="{html.escape(keywords)}">' if keywords.strip() else ""
    og_type = "article" if "/blog/" in current_path else "website"

    template = ""
    if TEMPLATE_FILE.exists():
        template = TEMPLATE_FILE.read_text(encoding="utf-8")
    
    if not template:
        template = "<html><head><title><!-- CMS_HEAD_TITLE --></title></head><body><header><!-- CMS_NAV_HTML --></header><main><!-- CMS_BODY_CONTENT --></main></body></html>"

    ads = get_ads_config()
    ads_header_script = ""
    if ads.get("enabled") and ads.get("adsense_client_id"):
        cid = html.escape(ads["adsense_client_id"].strip())
        ads_header_script = f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={cid}" crossorigin="anonymous"></script>'

    footer_ad = build_cms_ad_slot("footer_banner", "Advertisement", "24px auto 16px auto")
    if footer_ad:
        body_content = body_content + footer_ad

    clean_head_title = title.strip()
    if clean_head_title.endswith("| TradersDesk"):
        clean_head_title = clean_head_title[:-len("| TradersDesk")].strip()
    elif clean_head_title.endswith("| TradersDesk.in"):
        clean_head_title = clean_head_title[:-len("| TradersDesk.in")].strip()

    replacements = {
        "<!-- CMS_HEAD_TITLE -->": html.escape(clean_head_title),
        "<!-- CMS_META_DESC -->": html.escape(description),
        "<!-- CMS_KEYWORDS -->": keywords_tag + ads_header_script,
        "<!-- CMS_ROBOTS -->": html.escape(robots),
        "<!-- CMS_CANONICAL -->": html.escape(canon),
        "<!-- CMS_OG_TYPE -->": og_type,
        "<!-- CMS_CUSTOM_STYLE -->": custom_style_block,
        "<!-- CMS_DRAFT_BANNER -->": draft_banner,
        "<!-- CMS_NAV_HTML -->": nav_html,
        "<!-- CMS_BODY_CONTENT -->": body_content,
    }

    html_out = template
    for placeholder, val in replacements.items():
        html_out = html_out.replace(placeholder, val)

    return html_out


def render_page_view(slug: str, is_preview: bool = False) -> Optional[str]:
    page = get_page(slug)
    if not page:
        return None

    status = (page.get("status") or ("published" if page.get("published", True) else "draft")).lower()
    if status == "draft" and not is_preview:
        return None

    raw = page.get("content", "")
    fmt = page.get("format", "markdown").lower()
    rendered_body = markdown_to_html(raw) if fmt == "markdown" else raw

    draft_tag = '<span style="background:rgba(234,179,8,0.2); color:#eab308; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:700;">DRAFT</span>' if status == "draft" else ""

    body_html = f"""<div class="cms-card">
      <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span class="cms-badge">Document &bull; {html.escape(page.get('updatedAt', '')[:10])}</span>
        {draft_tag}
      </div>
      {rendered_body}
    </div>"""

    return render_cms_shell(
        title=page.get("seoTitle") or page.get("title", "Page"),
        description=page.get("metaDescription", page.get("title", "")),
        body_content=body_html,
        current_path=f"/{slug}",
        custom_css=page.get("customCss", ""),
        canonical_url=page.get("canonicalUrl", ""),
        robots_meta=page.get("robotsMeta", "index, follow"),
        keywords=page.get("focusKeyword", ""),
        is_draft=(status == "draft")
    )


def render_blog_index() -> str:
    posts = list_posts(published_only=True)
    all_categories = sorted(list(set([p.get("category", "General") for p in posts if p.get("category")])))

    featured_post = posts[0] if posts else None
    trending_posts = posts[1:4] if len(posts) > 1 else (posts[:1] if posts else [])

    cat_pills = ['<button type="button" class="blog-cat-pill active" data-category="ALL" onclick="filterBlogCategory(\'ALL\', this)">All Topics <span class="cat-pill-count">' + str(len(posts)) + '</span></button>']
    for cat in all_categories:
        count = sum(1 for p in posts if p.get("category") == cat)
        cat_pills.append('<button type="button" class="blog-cat-pill" data-category="' + html.escape(cat) + '" onclick="filterBlogCategory(\'' + html.escape(cat) + '\', this)">' + html.escape(cat) + ' <span class="cat-pill-count">' + str(count) + '</span></button>')

    ticker_headline = posts[0].get("title", "Market Insights") if posts else "Latest Quantitative Research"
    ticker_slug = posts[0].get("slug", "") if posts else ""

    featured_html = ""
    if featured_post:
        f_slug = featured_post.get("slug", "")
        f_img = featured_post.get("coverImage") or "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80"
        f_cat = featured_post.get("category", "Market Research")
        f_title = featured_post.get("title", "")
        f_excerpt = featured_post.get("excerpt", "")
        f_date = featured_post.get("publishedAt", "")
        f_read = featured_post.get("readTime", "5 min read")
        f_author = featured_post.get("author", "TradersDesk Research")

        featured_html = f"""<div class="blog-featured-card" onclick="window.location.href='/blog/{html.escape(f_slug)}'">
          <div class="blog-featured-img-wrap">
            <img src="{html.escape(f_img)}" alt="{html.escape(f_title)}" class="blog-featured-img" loading="eager" />
            <div class="blog-featured-img-overlay"></div>
            <span class="blog-cat-badge">{html.escape(f_cat)}</span>
          </div>
          <div class="blog-featured-body">
            <div class="blog-meta-strip">
              <span>📅 {html.escape(f_date)}</span>
              <span>•</span>
              <span>⏱️ {html.escape(f_read)}</span>
            </div>
            <h2 class="blog-featured-title">
              <a href="/blog/{html.escape(f_slug)}" onclick="event.stopPropagation()">{html.escape(f_title)}</a>
            </h2>
            <p class="blog-featured-excerpt">{html.escape(f_excerpt)}</p>
            <div class="blog-featured-footer">
              <div class="blog-author-pill">
                <span class="author-avatar">TD</span>
                <span class="author-name">{html.escape(f_author)}</span>
              </div>
              <a href="/blog/{html.escape(f_slug)}" class="blog-read-btn" onclick="event.stopPropagation()">
                Read Full Story <span>&rarr;</span>
              </a>
            </div>
          </div>
        </div>"""

    trending_items = []
    for i, p in enumerate(trending_posts):
        t_slug = p.get("slug", "")
        t_cat = p.get("category", "Insights")
        t_title = p.get("title", "")
        t_read = p.get("readTime", "5 min")
        trending_items.append(f"""<a href="/blog/{html.escape(t_slug)}" class="blog-trending-item">
          <span class="trending-rank">0{i+1}</span>
          <div class="trending-info">
            <span class="trending-cat">{html.escape(t_cat)}</span>
            <h4 class="trending-title">{html.escape(t_title)}</h4>
            <span class="trending-meta">⏱️ {html.escape(t_read)}</span>
          </div>
        </a>""")

    trending_html = f"""<div class="blog-trending-card">
      <div class="trending-card-header">
        <h3 class="trending-card-title">🔥 Top Trending Today</h3>
        <span class="trending-live-dot">LIVE</span>
      </div>
      <div class="trending-list">
        {''.join(trending_items) if trending_items else '<div style="color:var(--text-muted); font-size:12px;">No trending items</div>'}
      </div>
      <a href="/option-chain-pro" class="trending-terminal-cta">
        <span>⚡ Open Options Greeks Desk</span>
        <span>&rarr;</span>
      </a>
    </div>"""

    cards = []
    for p in posts:
        slug = p.get("slug", "")
        img = p.get("coverImage") or "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80"
        cat = p.get("category", "Insights")
        title = p.get("title", "")
        excerpt = p.get("excerpt", "")
        date = p.get("publishedAt", "")
        read = p.get("readTime", "5 min read")
        author = p.get("author", "Research Desk")

        cards.append(f"""<div class="blog-grid-card" data-category="{html.escape(cat)}" data-title="{html.escape(title.lower())}" data-excerpt="{html.escape(excerpt.lower())}" data-date="{html.escape(date)}" onclick="window.location.href='/blog/{html.escape(slug)}'">
          <div class="blog-card-media">
            <img src="{html.escape(img)}" alt="{html.escape(title)}" class="blog-card-thumbnail" loading="lazy" />
            <span class="blog-cat-badge">{html.escape(cat)}</span>
          </div>
          <div class="blog-card-content">
            <div class="blog-meta-strip">
              <span>{html.escape(date)}</span>
              <span>•</span>
              <span>{html.escape(read)}</span>
            </div>
            <h3 class="blog-card-h3">
              <a href="/blog/{html.escape(slug)}" onclick="event.stopPropagation()">{html.escape(title)}</a>
            </h3>
            <p class="blog-card-summary">{html.escape(excerpt)}</p>
            <div class="blog-card-bottom">
              <div class="blog-author-pill">
                <span class="author-avatar-sm">TD</span>
                <span class="author-name-sm">{html.escape(author)}</span>
              </div>
              <span class="blog-arrow-link">&rarr;</span>
            </div>
          </div>
        </div>""")

    cards_html = "".join(cards) if cards else '<div style="color:var(--text-muted); padding:40px; text-align:center;">No published articles yet.</div>'
    pills_html = "".join(cat_pills)

    portal_template = ""
    if BLOG_PORTAL_TEMPLATE.exists():
        portal_template = BLOG_PORTAL_TEMPLATE.read_text(encoding="utf-8")

    body_html = portal_template
    body_html = body_html.replace("<!-- TICKER_HEADLINE -->", html.escape(ticker_headline))
    body_html = body_html.replace("<!-- TICKER_SLUG -->", html.escape(ticker_slug))
    body_html = body_html.replace("<!-- PILLS_HTML -->", pills_html)
    body_html = body_html.replace("<!-- FEATURED_HTML -->", featured_html)
    body_html = body_html.replace("<!-- TRENDING_HTML -->", trending_html)
    body_html = body_html.replace("<!-- CARDS_HTML -->", cards_html)
    body_html = body_html.replace("<!-- TOTAL_COUNT -->", str(len(posts)))

    custom_css = ""
    if BLOG_STYLES_TEMPLATE.exists():
        custom_css = BLOG_STYLES_TEMPLATE.read_text(encoding="utf-8")

    blog_meta = {}
    try:
        import seo_engine
        blog_meta = seo_engine.get_seo_meta_for_path("/blog")
    except Exception:
        pass
    b_title = blog_meta.get("title") or "Options & Derivatives Trading Blog — NSE Market Analysis | TradersDesk"
    b_desc = blog_meta.get("desc") or "In-depth articles on NSE derivatives trading, options strategies, MTF leverage analysis, FII/DII institutional flows, market breadth, and Indian stock market analytics."
    b_kw = blog_meta.get("keywords") or "options trading blog india, derivatives strategy nse, mtf trading blog, fii dii analysis blog, nse market analysis"

    return render_cms_shell(
        title=b_title,
        description=b_desc,
        body_content=body_html,
        current_path="/blog",
        keywords=b_kw,
        custom_css=custom_css
    )


def get_ads_config() -> dict:
    global _ADS_CACHE
    if _ADS_CACHE is not None and isinstance(_ADS_CACHE, dict):
        return _ADS_CACHE

    p = DATA_DIR / "ads_config.json"
    if p.exists():
        try:
            with open(p, "r", encoding="utf-8") as f:
                _ADS_CACHE = json.load(f)
                return _ADS_CACHE
        except Exception:
            pass
    try:
        import supabase_engine
        cloud_ads = supabase_engine.load_app_config_from_supabase("ads_config")
        if isinstance(cloud_ads, dict) and cloud_ads:
            _ADS_CACHE = cloud_ads
            try:
                p.parent.mkdir(parents=True, exist_ok=True)
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(cloud_ads, f, indent=2)
            except Exception:
                pass
            return _ADS_CACHE
    except Exception:
        pass
    _ADS_CACHE = {"enabled": False, "slots": {}}
    return _ADS_CACHE

def set_ads_config(cfg: dict) -> None:
    global _ADS_CACHE
    _ADS_CACHE = cfg


def build_cms_ad_slot(slot_key: str, label: str = "Sponsored Advertisement", margin: str = "24px 0") -> str:
    ads = get_ads_config()
    if not ads.get("enabled", False):
        return ""
    slots = ads.get("slots", {})
    slot = slots.get(slot_key, {})
    if not slot.get("enabled", False):
        return ""

    custom_html = (slot.get("custom_html") or "").strip()
    slot_id = (slot.get("slot_id") or "").strip()
    client_id = (ads.get("adsense_client_id") or "").strip()
    test_mode = ads.get("test_mode", False)

    if custom_html:
        inner = custom_html
    elif slot_id and client_id:
        inner = f"""<ins class="adsbygoogle"
             style="display:block; text-align:center;"
             data-ad-layout="in-article"
             data-ad-format="fluid"
             data-ad-client="{html.escape(client_id)}"
             data-ad-slot="{html.escape(slot_id)}"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>"""
    elif test_mode:
        inner = f"""<div style="background:linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(15,23,42,0.4) 100%); border:1px dashed rgba(56,189,248,0.35); border-radius:8px; padding:18px 20px; text-align:center;">
          <div style="font-size:10px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">PROMOTED &bull; SPONSORED INSIGHT</div>
          <div style="font-size:14px; font-weight:700; color:var(--text-bright, #f8fafc); margin-bottom:4px;">Elevate Your Trading Strategy with Next-Gen Quantitative Tools</div>
          <div style="font-size:12px; color:#94a3b8;">Direct exchange analytics, Options Greeks, and MTF leveraged intelligence &mdash; Zero latency.</div>
        </div>"""
    else:
        return ""

    return f"""<div class="ad-slot-container ad-slot-{slot_key}" style="margin:{margin}; text-align:center; overflow:hidden;">
      <div style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#64748b; margin-bottom:6px;">{label}</div>
      {inner}
    </div>"""

def render_post_view(slug: str, is_preview: bool = False) -> Optional[str]:
    post = get_post(slug)
    if not post:
        return None

    status = (post.get("status") or ("published" if post.get("published", True) else "draft")).lower()
    if status == "draft" and not is_preview:
        return None

    raw = post.get("content", "")
    fmt = post.get("format", "markdown").lower()
    rendered_body = markdown_to_html(raw) if fmt == "markdown" else raw

    ad_top = build_cms_ad_slot("blog_top", "Advertisement", "16px 0 24px 0")
    ad_mid = build_cms_ad_slot("blog_mid", "Sponsored Content", "28px 0")
    ad_bottom = build_cms_ad_slot("blog_bottom", "Advertisement", "28px 0 16px 0")

    if ad_mid and "</p>" in rendered_body:
        parts = rendered_body.split("</p>")
        if len(parts) >= 3:
            parts[1] = parts[1] + "</p>" + ad_mid
            rendered_body = "".join([p + ("</p>" if i < len(parts)-1 and i != 1 else "") for i, p in enumerate(parts)])
        else:
            rendered_body = rendered_body + ad_mid
    elif ad_mid:
        rendered_body = rendered_body + ad_mid

    cover_img = post.get("coverImage")
    cover_html = f'<div class="post-cover-wrapper"><img src="{html.escape(cover_img)}" alt="{html.escape(post.get("title",""))}" class="post-cover-image" /></div>' if cover_img else ""

    p_title = post.get("title", "Article")
    p_cat = post.get("category", "Quantitative Research")
    p_author = post.get("author", "TradersDesk Quantitative Research Desk")
    p_date = post.get("publishedAt", "")
    p_read = post.get("readTime", "5 min read")
    p_excerpt = post.get("excerpt", "")

    other_posts = [p for p in list_posts(published_only=True) if p.get("slug") != slug][:2]
    related_cards = []
    for op in other_posts:
        related_cards.append(f"""<a href="/blog/{html.escape(op.get('slug',''))}" class="related-post-card">
          <span class="related-cat">{html.escape(op.get('category','Research'))}</span>
          <h4 class="related-title">{html.escape(op.get('title',''))}</h4>
          <span class="related-meta">⏱️ {html.escape(op.get('readTime','5 min'))}</span>
        </a>""")

    related_section_html = ""
    if related_cards:
        related_section_html = f"""<div class="related-insights-section">
        <h3 class="related-section-title">Related Market Research &amp; Guides</h3>
        <div class="related-grid">
          {''.join(related_cards)}
        </div>
      </div>"""

    lead_excerpt_html = f'<p class="article-lead-excerpt">{html.escape(p_excerpt)}</p>' if p_excerpt else ''

    article_template = ""
    if BLOG_ARTICLE_TEMPLATE.exists():
        article_template = BLOG_ARTICLE_TEMPLATE.read_text(encoding="utf-8")

    body_html = article_template
    body_html = body_html.replace("<!-- ARTICLE_CAT -->", html.escape(p_cat))
    body_html = body_html.replace("<!-- ARTICLE_TITLE -->", html.escape(p_title))
    body_html = body_html.replace("<!-- ARTICLE_EXCERPT_HTML -->", lead_excerpt_html)
    body_html = body_html.replace("<!-- ARTICLE_AUTHOR -->", html.escape(p_author))
    body_html = body_html.replace("<!-- ARTICLE_DATE -->", html.escape(p_date))
    body_html = body_html.replace("<!-- ARTICLE_READ_TIME -->", html.escape(p_read))
    body_html = body_html.replace("<!-- ARTICLE_COVER_HTML -->", cover_html)
    body_html = body_html.replace("<!-- AD_TOP -->", ad_top or "")
    body_html = body_html.replace("<!-- ARTICLE_BODY -->", rendered_body)
    body_html = body_html.replace("<!-- AD_BOTTOM -->", ad_bottom or "")
    body_html = body_html.replace("<!-- RELATED_SECTION_HTML -->", related_section_html)

    custom_css = ""
    if BLOG_STYLES_TEMPLATE.exists():
        custom_css = BLOG_STYLES_TEMPLATE.read_text(encoding="utf-8")

    if post.get("customCss"):
        custom_css = custom_css + "\n" + post.get("customCss", "")

    return render_cms_shell(
        title=post.get("seoTitle") or post.get("title", "Article"),
        description=post.get("metaDescription") or post.get("excerpt", post.get("title", "")),
        body_content=body_html,
        current_path=f"/blog/{slug}",
        custom_css=custom_css,
        canonical_url=post.get("canonicalUrl", ""),
        robots_meta=post.get("robotsMeta", "index, follow"),
        keywords=post.get("focusKeyword", ""),
        is_draft=(status == "draft")
    )


# ==============================================================================
# 5. PLATFORM SETTINGS (ANNOUNCEMENT BAR & MAINTENANCE MODE)
# ==============================================================================

SETTINGS_FILE = DATA_DIR / "platform_settings.json"

def get_platform_settings() -> Dict[str, Any]:
    """Loads platform settings (announcement bar, maintenance mode)."""
    global _SETTINGS_CACHE
    if _SETTINGS_CACHE is not None and isinstance(_SETTINGS_CACHE, dict):
        return _SETTINGS_CACHE

    default_settings = {
        "maintenance_mode": {
            "enabled": False,
            "title": "Scheduled Maintenance & Settlement",
            "message": "Market Data & Analytics Terminal is undergoing scheduled settlement processing. Live streaming and analysis will resume shortly."
        },
        "announcement_bar": {
            "enabled": True,
            "type": "info",
            "badge": "NEW",
            "text": "⚡ Live Institutional Derivatives Flow & Option Chain matrix is now active across all indices.",
            "link_text": "Read Handbook →",
            "link_url": "/trading-handbook"
        }
    }
    
    settings = None
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                settings = json.load(f)
        except Exception:
            settings = None

    if not settings:
        try:
            import supabase_engine
            cloud_s = supabase_engine.load_app_config_from_supabase("platform_settings")
            if isinstance(cloud_s, dict) and cloud_s:
                settings = cloud_s
        except Exception:
            pass

    if not settings:
        settings = default_settings

    if "maintenance_mode" not in settings:
        settings["maintenance_mode"] = default_settings["maintenance_mode"]
    if "announcement_bar" not in settings:
        settings["announcement_bar"] = default_settings["announcement_bar"]

    _SETTINGS_CACHE = settings
    return _SETTINGS_CACHE

def save_platform_settings(settings: Dict[str, Any]) -> bool:
    """Saves platform settings to disk, cache, and Supabase cloud."""
    global _SETTINGS_CACHE
    try:
        _SETTINGS_CACHE = settings
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("platform_settings", settings)
        except Exception as se:
            print(f"[CMS] Supabase platform settings sync note: {se}")
        return True
    except Exception as exc:
        print(f"[CMS] Failed saving platform settings: {exc}")
        return False


def render_maintenance_page(title: Optional[str] = None, message: Optional[str] = None) -> str:
    """Renders institutional dark maintenance mode page."""
    st = get_platform_settings().get("maintenance_mode", {})
    t = title or st.get("title", "Scheduled System Maintenance")
    m = message or st.get("message", "Market Data & Analytics Terminal is undergoing scheduled settlement processing. Live streaming and analysis will resume shortly.")
    
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(t)} | TradersDesk</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/styles.css">
  <style>
    body {{
      background: #020617;
      color: #f8fafc;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
    }}
    .m-box {{
      max-width: 600px;
      width: 100%;
      background: #0b1329;
      border: 1px solid rgba(56, 189, 248, 0.3);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      border-radius: 16px;
      padding: 40px;
      text-align: center;
    }}
    .m-badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 999px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }}
    .m-title {{
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 14px 0;
      color: #fff;
    }}
    .m-desc {{
      color: #94a3b8;
      font-size: 14.5px;
      line-height: 1.7;
      margin: 0 0 28px 0;
    }}
    .m-status {{
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      justify-content: space-around;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #38bdf8;
    }}
    .m-dot {{
      width: 8px;
      height: 8px;
      background: #fbbf24;
      border-radius: 50%;
      display: inline-block;
      animation: pulse 1.5s infinite;
    }}
    @keyframes pulse {{
      0%, 100% {{ opacity: 1; transform: scale(1); }}
      50% {{ opacity: 0.4; transform: scale(0.85); }}
    }}
  </style>
</head>
<body>
  <div class="m-box">
    <div class="m-badge">
      <span class="m-dot"></span> System Maintenance
    </div>
    <h1 class="m-title">{html.escape(t)}</h1>
    <p class="m-desc">{html.escape(m)}</p>
    <div class="m-status">
      <div>SYSTEM: <span style="color:#34d399;">ONLINE</span></div>
      <div>CORE DESK: <span style="color:#fbbf24;">SETTLING</span></div>
      <div>EOD SYNC: <span style="color:#38bdf8;">RUNNING</span></div>
    </div>
  </div>
</body>
</html>"""
