import sys
from pathlib import Path

footer_html = """
      <!-- Institutional Footer with Legal & Compliance Links (Strict 4-Column Layout) -->
      <footer class="terminal-footer">
        <div class="footer-four-columns" id="footerFourColumnsGrid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:24px; margin-bottom:30px;">
          <!-- Column 1: Institutional Desks -->
          <div class="footer-link-group" data-col="col1">
            <h4 style="display:flex; align-items:center; gap:6px; color:#38bdf8; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">
              🏛️ Institutional Desks
            </h4>
            <div class="footer-links-list" style="display:flex; flex-direction:column; gap:8px;">
              <a href="/breadth">Market Breadth Pro</a>
              <a href="/fii-dii">FII &amp; DII Smart Money</a>
              <a href="/delivery">Cash Delivery Absorption</a>
              <a href="/mtf">MTF Margin Trading Book</a>
              <a href="/global-markets">Global Markets Desk</a>
              <a href="/dashboard">Institutional Dashboard</a>
            </div>
          </div>

          <!-- Column 2: Derivatives & Options Suite -->
          <div class="footer-link-group" data-col="col2">
            <h4 style="display:flex; align-items:center; gap:6px; color:#a78bfa; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">
              ⚡ Derivatives &amp; Options
            </h4>
            <div class="footer-links-list" style="display:flex; flex-direction:column; gap:8px;">
              <a href="/option-chain-pro">Option Chain Pro</a>
              <a href="/futures">Future Marketwatch Matrix</a>
              <a href="/straddle">Straddle Analytics Engine</a>
              <a href="/futures/buildup">Future Buildup Quadrants</a>
              <a href="/futures/mwpl">MWPL &amp; Ban Radar</a>
              <a href="/futures/rollover">Historical Rollover Matrix</a>
            </div>
          </div>

          <!-- Column 3: Advanced Analytics & Tools -->
          <div class="footer-link-group" data-col="col3">
            <h4 style="display:flex; align-items:center; gap:6px; color:#34d399; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">
              📊 Market Analytics &amp; Tools
            </h4>
            <div class="footer-links-list" style="display:flex; flex-direction:column; gap:8px;">
              <a href="/breadth-contribution">Breadth &amp; Net Contribution</a>
              <a href="/calendar_studio.html">NSE Trading Holiday Calendar</a>
              <a href="/fii-dii#oi">Participant OI Matrix</a>
              <a href="/futures/heatmap">F&amp;O Sector Visual Heatmap</a>
              <a href="/option-chain-pro">Real-Time Options Greeks</a>
              <a href="/delivery">Stock Delivery Drilldown</a>
            </div>
          </div>

          <!-- Column 4: Regulatory, Compliance & Governance -->
          <div class="footer-link-group" data-col="col4">
            <h4 style="display:flex; align-items:center; gap:6px; color:#f59e0b; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">
              🛡️ Regulatory &amp; Compliance
            </h4>
            <div class="footer-links-list" style="display:flex; flex-direction:column; gap:8px;">
              <a href="/disclaimer.html">SEBI Regulatory Disclaimer</a>
              <a href="/privacy.html">Privacy &amp; Data Governance</a>
              <a href="/terms.html">Terms of Institutional Service</a>
              <a href="/about.html">Quantitative Model Methodologies</a>
              <a href="https://www.nseindia.com" target="_blank" rel="noopener">NSE Official Regulatory Archive ↗</a>
              <a href="/admin.html">Platform Administration 🔒</a>
            </div>
          </div>
        </div>

        <div class="footer-bottom" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.08); font-size:11.5px; color:#64748b;">
          <span>&copy; 2026 TradersDesk.in &bull; Real-Time Indian Equities Terminal</span>
          <span>SEBI Compliance Notice: Educational &amp; Quantitative Analytics Research Only</span>
        </div>
      </footer>
"""

footer_css = """
/* Institutional Standard Terminal Footer Styles */
.terminal-footer {
  margin-top: 40px;
  padding: 40px 24px 24px 24px;
  background: var(--bg-card, #0b1329);
  border-top: 1px solid var(--border-default, rgba(255,255,255,0.08));
  border-radius: 12px 12px 0 0;
  max-width: 1440px;
  margin-left: auto;
  margin-right: auto;
}
[data-theme="dark"] .terminal-footer {
  background: #0d121d !important;
  border-color: #1e293b !important;
}
.terminal-footer a {
  color: var(--text-muted, #94a3b8);
  text-decoration: none;
  font-size: 12.5px;
  transition: color 0.15s ease;
}
.terminal-footer a:hover {
  color: #38bdf8 !important;
}
@media (max-width: 768px) {
  .terminal-footer {
    padding: 24px 16px 16px !important;
  }
}
"""

p2_css_path = Path("public/page2.css")
p2_css_content = p2_css_path.read_text(encoding="utf-8")
if ".terminal-footer" not in p2_css_content:
    p2_css_path.write_text(p2_css_content + "\n" + footer_css, encoding="utf-8")
    print("Added footer styles to page2.css")

target_files = [
    "public/page2.html",
    "public/futures_rollover.html",
    "public/about.html",
    "public/disclaimer.html",
    "public/privacy.html",
    "public/terms.html",
    "public/calendar_studio.html"
]

for fp_str in target_files:
    p = Path(fp_str)
    if not p.exists():
        print(f"Missing: {fp_str}")
        continue
    content = p.read_text(encoding="utf-8")
    if '<footer class="terminal-footer"' in content or 'id="footerFourColumnsGrid"' in content:
        print(f"Already has footer: {fp_str}")
        continue
    
    if "</body>" in content:
        if '<div id="mobileDotMenuModal"' in content:
            new_content = content.replace('<div id="mobileDotMenuModal"', footer_html + '\n    <div id="mobileDotMenuModal"', 1)
        else:
            new_content = content.replace('</body>', footer_html + '\n</body>', 1)
        p.write_text(new_content, encoding="utf-8")
        print(f"Added footer to: {fp_str}")
    else:
        print(f"No </body> in {fp_str}")
