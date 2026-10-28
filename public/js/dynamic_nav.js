/**
 * TradersDesk Dynamic Navigation Sync
 * Reflects Master Navigation and Feature Flags from Admin Panel dynamically.
 */
(function() {
  async function syncDynamicNavigation() {
    try {
      if (window.location.pathname.startsWith('/admin')) return;

      const navContainer = document.querySelector('.inst-nav') || document.querySelector('.inst-nav-pills') || document.getElementById('mainInstNav');
      if (!navContainer) return;

      const [navRes, flagsRes] = await Promise.all([
        fetch('/api/navigation').catch(() => null),
        fetch('/api/feature-flags').catch(() => null)
      ]);

      if (!navRes || !navRes.ok) return;
      const navData = await navRes.json();
      const flagsData = (flagsRes && flagsRes.ok) ? await flagsRes.json() : { flags: {} };
      const flags = flagsData.flags || {};

      const currentPath = window.location.pathname;

      if (!navData || !Array.isArray(navData.items) || navData.items.length === 0) return;

      let navHtml = '';

      navData.items.forEach(item => {
        if (item.active === false) return;

        // Check feature flag if applicable
        if (item.id === 'nav_futures' && flags.futures_future_intraday === false && flags.futures_future_vs_oi === false) {
          // If all sub-features of futures are off, filter or keep base
        }

        const isHighlight = Boolean(item.highlight);
        const hasDd = Boolean(item.hasDropdown);
        const isActive = (currentPath === item.url || (item.url !== '/' && currentPath.startsWith(item.url)));

        let btnClass = 'inst-nav-btn';
        if (isHighlight) btnClass += ' inst-nav-btn-highlight';
        if (isActive) btnClass += ' active';

        const badgeHtml = item.badge ? `<span class="p2-badge p2-badge-${item.badgeColor || 'teal'}">${escapeText(item.badge)}</span>` : '';
        const iconHtml = item.icon ? `<span class="inst-nav-icon">${escapeText(item.icon)}</span>` : '';

        if (!hasDd) {
          navHtml += `
            <div class="inst-nav-item">
              <a href="${encodeURI(item.url || '#')}" class="${btnClass}">
                ${iconHtml}
                <span class="nav-label">${escapeText(item.label || '')}</span>
                ${badgeHtml}
              </a>
            </div>
          `;
        } else {
          let colsHtml = '';
          (item.columns || []).forEach(col => {
            let itemsHtml = '';
            (col.items || []).forEach(sub => {
              // Feature flag filter
              if (sub.flagKey && flags[sub.flagKey] === false) return;
              if (sub.url === '/futures/future-intraday' && flags.futures_future_intraday === false) return;
              if (sub.url === '/futures/future-vs-oi' && flags.futures_future_vs_oi === false) return;

              const subBadge = sub.badge ? `<span class="p2-badge p2-badge-${sub.badgeColor || 'teal'}">${escapeText(sub.badge)}</span>` : '';
              itemsHtml += `
                <a href="${encodeURI(sub.url || '#')}" class="inst-dd-item">
                  <span class="dd-icon">${escapeText(sub.icon || '⚡')}</span>
                  <div class="dd-text">
                    <div class="dd-title">${escapeText(sub.title || '')} ${subBadge}</div>
                    ${sub.sub ? `<div class="dd-sub">${escapeText(sub.sub)}</div>` : ''}
                  </div>
                </a>
              `;
            });

            if (itemsHtml) {
              colsHtml += `
                <div class="inst-dd-col">
                  ${col.title ? `<div class="inst-dd-header">${escapeText(col.title)}</div>` : ''}
                  ${itemsHtml}
                </div>
              `;
            }
          });

          navHtml += `
            <div class="inst-nav-item inst-dropdown">
              <button type="button" class="${btnClass}">
                ${iconHtml}
                <span class="nav-label">${escapeText(item.label || '')}</span>
                ${badgeHtml}
                <span class="inst-arrow">▼</span>
              </button>
              <div class="inst-dd-menu">
                <div class="inst-dd-grid">
                  ${colsHtml}
                </div>
              </div>
            </div>
          `;
        }
      });

      if (navHtml) {
        navContainer.innerHTML = navHtml;
      }
    } catch(e) {
      console.warn("Dynamic navigation sync notice:", e);
    }
  }

  function escapeText(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDynamicNavigation);
  } else {
    syncDynamicNavigation();
  }
})();
