/**
 * TradersDesk Global Announcement Banner & Ticker
 * Managed dynamically in real-time from the Platform Admin Panel.
 */
(function() {
  async function initAnnouncement() {
    try {
      if (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/desk-ops-console')) return;

      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      const ann = data && data.settings ? data.settings.announcement_bar : null;
      if (!ann || !ann.enabled || !ann.text) return;

      // Check if user dismissed this specific announcement in the current session
      const cacheKey = 'ann_dismissed_' + btoa(encodeURIComponent(ann.text)).slice(0, 16);
      if (sessionStorage.getItem(cacheKey)) return;

      // Inject Banner CSS
      if (!document.getElementById('siteAnnouncementStyles')) {
        const style = document.createElement('style');
        style.id = 'siteAnnouncementStyles';
        style.textContent = `
          .site-ann-banner {
            width: 100%;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 9999;
            box-sizing: border-box;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            animation: slideDownAnn 0.3s ease-out;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          @keyframes slideDownAnn {
            from { opacity: 0; transform: translateY(-100%); }
            to { opacity: 1; transform: translateY(0); }
          }
          .site-ann-banner.type-info {
            background: linear-gradient(90deg, #07152f, #0d2347, #07152f);
            border-bottom-color: rgba(56, 189, 248, 0.3);
            color: #e0f2fe;
          }
          .site-ann-banner.type-alert {
            background: linear-gradient(90deg, #241403, #381f05, #241403);
            border-bottom-color: rgba(245, 158, 11, 0.35);
            color: #fef3c7;
          }
          .site-ann-banner.type-danger {
            background: linear-gradient(90deg, #260707, #3d0e0e, #260707);
            border-bottom-color: rgba(239, 68, 68, 0.4);
            color: #fee2e2;
          }
          .site-ann-banner.type-success {
            background: linear-gradient(90deg, #032014, #083321, #032014);
            border-bottom-color: rgba(16, 185, 129, 0.35);
            color: #d1fae5;
          }
          .site-ann-inner {
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 1300px;
            width: 100%;
            justify-content: center;
          }
          .site-ann-badge {
            font-size: 10.5px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 4px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            background: rgba(255, 255, 255, 0.15);
            color: #fff;
          }
          .site-ann-banner.type-info .site-ann-badge { background: #0284c7; }
          .site-ann-banner.type-alert .site-ann-badge { background: #d97706; }
          .site-ann-banner.type-danger .site-ann-badge { background: #dc2626; }
          .site-ann-banner.type-success .site-ann-badge { background: #059669; }
          .site-ann-text {
            color: inherit;
          }
          .site-ann-link {
            color: inherit;
            text-decoration: underline;
            text-underline-offset: 3px;
            font-weight: 700;
            margin-left: 4px;
            transition: opacity 0.15s;
          }
          .site-ann-link:hover {
            opacity: 0.8;
          }
          .site-ann-close {
            position: absolute;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            font-size: 20px;
            line-height: 1;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
          }
          .site-ann-close:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.1);
          }
        `;
        document.head.appendChild(style);
      }

      // Create banner element
      const banner = document.createElement('div');
      banner.id = 'siteGlobalAnnouncement';
      banner.className = 'site-ann-banner type-' + (ann.type || 'info');

      let linkHtml = '';
      if (ann.link_text && ann.link_url) {
        linkHtml = `<a href="${encodeURI(ann.link_url)}" class="site-ann-link">${escapeText(ann.link_text)}</a>`;
      }

      banner.innerHTML = `
        <div class="site-ann-inner">
          ${ann.badge ? `<span class="site-ann-badge">${escapeText(ann.badge)}</span>` : ''}
          <span class="site-ann-text">${escapeText(ann.text)}</span>
          ${linkHtml}
        </div>
        <button type="button" class="site-ann-close" title="Dismiss Alert">&times;</button>
      `;

      banner.querySelector('.site-ann-close').addEventListener('click', function() {
        banner.remove();
        sessionStorage.setItem(cacheKey, 'true');
      });

      document.body.prepend(banner);
    } catch(e) {
      console.warn("Announcement loader notice:", e);
    }
  }

  function escapeText(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnnouncement);
  } else {
    initAnnouncement();
  }
})();
