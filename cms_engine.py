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

def get_navigation() -> Dict[str, Any]:
    if NAV_FILE.exists():
        try:
            with open(NAV_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"updatedAt": datetime.utcnow().isoformat() + "Z", "items": []}

def save_navigation(data: Dict[str, Any]) -> bool:
    data["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(NAV_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        # Attempt Supabase sync
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("navigation_master", data)
        except Exception:
            pass
        return True
    except Exception as exc:
        print(f"[CMS] Failed saving navigation: {exc}")
        return False

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
        is_active = (current_path == url)

        btn_classes = ["inst-nav-btn"]
        if is_highlight:
            btn_classes.append("inst-nav-btn-highlight")
        if is_active:
            btn_classes.append("active")

        if not has_dropdown:
            out.append(f'<div class="inst-nav-item">')
            badge_html = f'<span class="p2-badge p2-badge-{badge_color}">{html.escape(badge)}</span>' if badge else ""
            out.append(f'  <a href="{html.escape(url)}" class="{" ".join(btn_classes)}">')
            if icon:
                out.append(f'    <span class="inst-nav-icon">{html.escape(icon)}</span>')
            out.append(f'    <span class="nav-label">{html.escape(label)}</span>')
            if badge_html:
                out.append(f'    {badge_html}')
            out.append('  </a>')
            out.append('</div>')
        else:
            out.append(f'<div class="inst-nav-item has-dropdown">')
            out.append(f'  <a href="{html.escape(url)}" class="{" ".join(btn_classes)}">')
            if icon:
                out.append(f'    <span class="inst-nav-icon">{html.escape(icon)}</span>')
            out.append(f'    <span class="nav-label">{html.escape(label)}</span>')
            if badge:
                out.append(f'    <span class="p2-badge p2-badge-{badge_color}">{html.escape(badge)}</span>')
            out.append('    <span class="inst-nav-arrow">▾</span>')
            out.append('  </a>')

            # Render Dropdown Columns
            columns = item.get("columns", [])
            col_class = "inst-dropdown-md" if len(columns) >= 2 else "inst-dropdown-sm"
            out.append(f'  <div class="inst-dropdown {col_class}">')
            for col in columns:
                out.append('    <div class="inst-dropdown-col">')
                if col.get("header"):
                    out.append(f'      <span class="inst-dropdown-header">{html.escape(col["header"])}</span>')
                for sub in col.get("items", []):
                    if not sub.get("active", True):
                        continue
                    flag_attr = f' data-feature-flag="{html.escape(sub["featureFlag"])}"' if sub.get("featureFlag") else ""
                    sub_badge_html = f'<span class="p2-badge p2-badge-{sub.get("badgeColor","teal")}" style="margin-left:4px;">{html.escape(sub["badge"])}</span>' if sub.get("badge") else ""
                    out.append(f'      <a href="{html.escape(sub.get("url","#"))}" class="inst-dd-item"{flag_attr}>')
                    if sub.get("icon"):
                        out.append(f'        <span class="dd-icon">{html.escape(sub["icon"])}</span>')
                    out.append('        <div class="dd-text">')
                    out.append(f'          <span class="dd-title">{html.escape(sub.get("title",""))}{sub_badge_html}</span>')
                    if sub.get("subtitle"):
                        out.append(f'          <span class="dd-sub">{html.escape(sub["subtitle"])}</span>')
                    out.append('        </div>')
                    out.append('      </a>')
                out.append('    </div>')
            out.append('  </div>')
            out.append('</div>')

    out.append('</nav>')
    return "\n".join(out)


# ==============================================================================
# 3. DYNAMIC PAGES CMS ENGINE
# ==============================================================================

def list_pages() -> List[Dict[str, Any]]:
    if PAGES_FILE.exists():
        try:
            with open(PAGES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def get_page(slug: str) -> Optional[Dict[str, Any]]:
    clean_slug = slug.strip().lstrip("/").lower()
    for p in list_pages():
        if p.get("slug", "").strip().lower() == clean_slug:
            return p
    return None

def save_page(page_data: Dict[str, Any]) -> bool:
    pages = list_pages()
    slug = page_data.get("slug", "").strip().lstrip("/").lower()
    if not slug:
        return False

    page_data["slug"] = slug
    page_data["updatedAt"] = datetime.utcnow().isoformat() + "Z"

    idx = next((i for i, p in enumerate(pages) if p.get("slug", "").strip().lower() == slug), None)
    if idx is not None:
        pages[idx] = page_data
    else:
        if not page_data.get("id"):
            page_data["id"] = f"page_{int(datetime.utcnow().timestamp())}"
        pages.append(page_data)

    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(PAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(pages, f, indent=2)
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("cms_pages", pages)
        except Exception:
            pass
        return True
    except Exception as exc:
        print(f"[CMS] Failed saving page {slug}: {exc}")
        return False

def delete_page(slug: str) -> bool:
    clean_slug = slug.strip().lstrip("/").lower()
    pages = [p for p in list_pages() if p.get("slug", "").strip().lower() != clean_slug]
    try:
        with open(PAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(pages, f, indent=2)
        return True
    except Exception:
        return False


# ==============================================================================
# 4. BLOG & ARTICLE CMS ENGINE
# ==============================================================================

def list_posts(published_only: bool = True) -> List[Dict[str, Any]]:
    if POSTS_FILE.exists():
        try:
            with open(POSTS_FILE, "r", encoding="utf-8") as f:
                posts = json.load(f)
                if published_only:
                    return [p for p in posts if p.get("published", True)]
                return posts
        except Exception:
            pass
    return []

def get_post(slug: str) -> Optional[Dict[str, Any]]:
    clean_slug = slug.strip().lstrip("/").lower()
    for p in list_posts(published_only=False):
        if p.get("slug", "").strip().lower() == clean_slug:
            return p
    return None

def save_post(post_data: Dict[str, Any]) -> bool:
    posts = list_posts(published_only=False)
    slug = post_data.get("slug", "").strip().lstrip("/").lower()
    if not slug:
        slug = re.sub(r'[^a-z0-9]+', '-', post_data.get("title", "").lower()).strip('-')
    post_data["slug"] = slug

    if not post_data.get("publishedAt"):
        post_data["publishedAt"] = datetime.utcnow().strftime("%Y-%m-%d")

    idx = next((i for i, p in enumerate(posts) if p.get("slug", "").strip().lower() == slug), None)
    if idx is not None:
        posts[idx] = post_data
    else:
        if not post_data.get("id"):
            post_data["id"] = f"post_{int(datetime.utcnow().timestamp())}"
        posts.insert(0, post_data)

    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(POSTS_FILE, "w", encoding="utf-8") as f:
            json.dump(posts, f, indent=2)
        try:
            import supabase_engine
            supabase_engine.save_app_config_to_supabase("cms_posts", posts)
        except Exception:
            pass
        return True
    except Exception as exc:
        print(f"[CMS] Failed saving post {slug}: {exc}")
        return False

def delete_post(post_id: str) -> bool:
    posts = [p for p in list_posts(published_only=False) if p.get("id") != post_id and p.get("slug") != post_id]
    try:
        with open(POSTS_FILE, "w", encoding="utf-8") as f:
            json.dump(posts, f, indent=2)
        return True
    except Exception:
        return False


# ==============================================================================
# 5. SHELL TEMPLATE BUILDER FOR PAGES & BLOG
# ==============================================================================

def render_cms_shell(title: str, description: str, body_content: str, current_path: str = "/") -> str:
    """Wraps any page or blog post in the unified TradersDesk terminal template."""
    nav_html = render_navigation_html(current_path)

    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)} | TradersDesk</title>
  <meta name="description" content="{html.escape(description)}">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/page2.css">
  <style>
    .cms-container {{
      max-width: 1040px;
      margin: 32px auto;
      padding: 0 20px;
    }}
    .cms-card {{
      background: var(--adm-card, #0b1329);
      border: 1px solid var(--adm-border, rgba(255, 255, 255, 0.08));
      border-radius: 12px;
      padding: 36px 40px;
      color: #cbd5e1;
      line-height: 1.7;
    }}
    .cms-h1 {{ font-size: 28px; font-weight: 800; color: #f8fafc; margin: 0 0 16px 0; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px; }}
    .cms-h2 {{ font-size: 20px; font-weight: 700; color: #38bdf8; margin: 28px 0 12px 0; }}
    .cms-h3 {{ font-size: 16px; font-weight: 700; color: #cbd5e1; margin: 20px 0 10px 0; }}
    .cms-p {{ font-size: 14.5px; color: #94a3b8; margin-bottom: 16px; }}
    .cms-quote {{ border-left: 3px solid #38bdf8; background: rgba(56, 189, 248, 0.05); padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0; font-style: italic; color: #38bdf8; }}
    .cms-divider {{ border: 0; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 28px 0; }}
    .cms-list {{ padding-left: 20px; margin-bottom: 18px; }}
    .cms-list li {{ margin-bottom: 8px; font-size: 14px; color: #cbd5e1; }}
    .cms-code-block {{ background: #030712; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #38bdf8; margin: 18px 0; }}
    .cms-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13.5px; }}
    .cms-table th {{ background: rgba(255, 255, 255, 0.04); text-align: left; padding: 10px 14px; border: 1px solid rgba(255, 255, 255, 0.08); color: #f8fafc; font-weight: 700; }}
    .cms-table td {{ padding: 10px 14px; border: 1px solid rgba(255, 255, 255, 0.08); color: #cbd5e1; }}
    .cms-badge {{ display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }}
    .blog-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 24px; margin-top: 24px; }}
    .blog-card {{ background: #0b1329; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, border-color 0.2s; }}
    .blog-card:hover {{ transform: translateY(-3px); border-color: rgba(56, 189, 248, 0.4); }}
    .blog-card-img {{ width: 100%; height: 180px; object-fit: cover; background: #040814; }}
    .blog-card-body {{ padding: 20px; display: flex; flex-direction: column; flex: 1; }}
    .blog-card-title {{ font-size: 17px; font-weight: 700; color: #f8fafc; margin: 8px 0; text-decoration: none; line-height: 1.4; }}
    .blog-card-title:hover {{ color: #38bdf8; }}
    .blog-card-excerpt {{ font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 16px; flex: 1; }}
    .blog-card-meta {{ display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #64748b; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 12px; font-family: 'JetBrains Mono', monospace; }}
  </style>
</head>
<body class="page2-body theme-dark">
  <header class="page2-header">
    <div class="inst-nav-row">
      {nav_html}
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="themeToggleBtn" class="page2-theme-toggle-btn" type="button" onclick="document.body.classList.toggle('white-theme');">
          <span>🌙</span> <span>Mode</span>
        </button>
      </div>
    </div>
  </header>

  <main class="cms-container">
    {body_content}
  </main>

  <footer style="margin-top: 60px; padding: 30px 20px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; color: #64748b; font-size: 12px;">
    &copy; 2026 TradersDesk.in &bull; Real-Time Quantitative Analytics &bull; SEBI Compliance Notice: Educational & Research Only
  </footer>
  <script src="/js/site_announcement.js"></script>
  <script src="/js/dynamic_nav.js"></script>
</body>
</html>"""


def render_page_view(slug: str) -> Optional[str]:
    page = get_page(slug)
    if not page:
        return None

    raw = page.get("content", "")
    fmt = page.get("format", "markdown").lower()
    rendered_body = markdown_to_html(raw) if fmt == "markdown" else raw

    body_html = f"""<div class="cms-card">
      <div style="margin-bottom:12px;">
        <span class="cms-badge">Document &bull; {html.escape(page.get('updatedAt', '')[:10])}</span>
      </div>
      {rendered_body}
    </div>"""

    return render_cms_shell(
        title=page.get("title", "Page"),
        description=page.get("metaDescription", page.get("title", "")),
        body_content=body_html,
        current_path=f"/{slug}"
    )


def render_blog_index() -> str:
    posts = list_posts(published_only=True)
    cards = []
    for p in posts:
        slug = p.get("slug", "")
        img = p.get("coverImage") or "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80"
        cards.append(f"""<div class="blog-card">
          <img src="{html.escape(img)}" alt="{html.escape(p.get('title',''))}" class="blog-card-img" loading="lazy" />
          <div class="blog-card-body">
            <span class="cms-badge" style="align-self:flex-start;">{html.escape(p.get('category', 'Insights'))}</span>
            <a href="/blog/{html.escape(slug)}" class="blog-card-title">{html.escape(p.get('title',''))}</a>
            <p class="blog-card-excerpt">{html.escape(p.get('excerpt',''))}</p>
            <div class="blog-card-meta">
              <span>{html.escape(p.get('publishedAt', ''))}</span>
              <span>{html.escape(p.get('readTime', '4 min read'))}</span>
            </div>
          </div>
        </div>""")

    body_html = f"""<div>
      <div style="margin-bottom: 24px;">
        <h1 class="cms-h1">✍️ Market Research &amp; Quantitative Insights</h1>
        <p class="cms-p">In-depth technical analysis, market breadth dynamics, option Greeks calibration, and FII derivatives flow methodologies.</p>
      </div>
      <div class="blog-grid">
        {"".join(cards) if cards else '<div style="color:#64748b; padding:40px; text-align:center;">No published articles yet.</div>'}
      </div>
    </div>"""

    return render_cms_shell(
        title="Market Research & Quantitative Insights",
        description="Comprehensive options trading, market breadth, and F&O derivatives research articles.",
        body_content=body_html,
        current_path="/blog"
    )


def render_post_view(slug: str) -> Optional[str]:
    post = get_post(slug)
    if not post:
        return None

    raw = post.get("content", "")
    fmt = post.get("format", "markdown").lower()
    rendered_body = markdown_to_html(raw) if fmt == "markdown" else raw
    cover = f'<img src="{html.escape(post["coverImage"])}" style="width:100%; max-height:360px; object-fit:cover; border-radius:10px; margin-bottom:24px;" />' if post.get("coverImage") else ""

    body_html = f"""<article class="cms-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <a href="/blog" style="color:#38bdf8; text-decoration:none; font-size:13px; font-weight:600;">&larr; Back to All Articles</a>
        <span class="cms-badge">{html.escape(post.get('category', 'Insights'))}</span>
      </div>
      {cover}
      <div style="font-size:12.5px; color:#64748b; font-family:'JetBrains Mono', monospace; margin-bottom:18px;">
        <span>By {html.escape(post.get('author', 'Research Desk'))}</span> &bull; 
        <span>{html.escape(post.get('publishedAt', ''))}</span> &bull; 
        <span>{html.escape(post.get('readTime', '5 min read'))}</span>
      </div>
      {rendered_body}
    </article>"""

    return render_cms_shell(
        title=post.get("title", "Article"),
        description=post.get("excerpt", post.get("title", "")),
        body_content=body_html,
        current_path=f"/blog/{slug}"
    )


# ==============================================================================
# 5. PLATFORM SETTINGS (ANNOUNCEMENT BAR & MAINTENANCE MODE)
# ==============================================================================

SETTINGS_FILE = DATA_DIR / "platform_settings.json"

def get_platform_settings() -> Dict[str, Any]:
    """Loads platform settings (announcement bar, maintenance mode)."""
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
    if not SETTINGS_FILE.exists():
        save_platform_settings(default_settings)
        return default_settings
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "maintenance_mode" not in data:
                data["maintenance_mode"] = default_settings["maintenance_mode"]
            if "announcement_bar" not in data:
                data["announcement_bar"] = default_settings["announcement_bar"]
            return data
    except Exception:
        return default_settings

def save_platform_settings(settings: Dict[str, Any]) -> bool:
    """Saves platform settings to disk."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
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
