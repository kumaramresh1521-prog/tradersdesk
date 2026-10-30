/**
 * ============================================================================
 * 🌐 TRADERSDESK DYNAMIC NAVIGATION & REAL-TIME CMS SYNC
 * ============================================================================
 * Synchronizes Header Mega-Menu and Mobile 6-Dot Drawer in real time
 * with the Admin Panel Navigation Builder and Feature Flags.
 * Any added tool, custom page, submenu, or flag toggle appears instantly.
 */

(function() {
  "use strict";

  async function syncDynamicNavigation() {
    try {
      if (window.location.pathname.startsWith('/admin')) return;

      const [navRes, flagsRes] = await Promise.all([
        fetch('/api/navigation').catch(() => null),
        fetch('/api/feature-flags').catch(() => null)
      ]);

      if (!navRes || !navRes.ok) return;
      const navData = await navRes.json();
      const flagsData = (flagsRes && flagsRes.ok) ? await flagsRes.json() : { flags: {} };
      const flags = flagsData.flags || {};

      if (!navData || !Array.isArray(navData.items) || navData.items.length === 0) return;

      const currentPath = window.location.pathname;

      // ── 1. RENDER DESKTOP MEGA-MENU NAVIGATION (#mainInstNav) ──
      const navContainer = document.getElementById('mainInstNav') || document.querySelector('.inst-nav');
      if (navContainer) {
        let navHtml = '';

        navData.items.forEach(item => {
          if (item.active === false) return;

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
            const rawColumns = item.columns || [];
            const activeColumns = [];

            rawColumns.forEach(col => {
              const activeSubs = (col.items || []).filter(sub => {
                if (sub.active === false) return false;
                if (sub.featureFlag && flags[sub.featureFlag] === false) return false;
                if (sub.url === '/futures/future-intraday' && flags.futures_future_intraday === false) return false;
                if (sub.url === '/futures/future-vs-oi' && flags.futures_future_vs_oi === false) return false;
                return true;
              });
              if (activeSubs.length > 0) {
                activeColumns.push({ header: col.header || col.title || '', items: activeSubs });
              }
            });

            const colClass = activeColumns.length >= 2 ? 'inst-dropdown-md' : 'inst-dropdown-sm';
            const singleClass = activeColumns.length === 1 ? ' is-single-col' : '';

            let colsHtml = '';
            activeColumns.forEach(col => {
              let itemsHtml = '';
              col.items.forEach(sub => {
                const subBadge = sub.badge ? `<span class="p2-badge p2-badge-${sub.badgeColor || 'teal'}" style="margin-left:4px;">${escapeText(sub.badge)}</span>` : '';
                const flagAttr = sub.featureFlag ? ` data-feature-flag="${escapeText(sub.featureFlag)}"` : '';
                const subDesc = sub.subtitle || sub.sub || '';

                itemsHtml += `
                  <a href="${encodeURI(sub.url || '#')}" class="inst-dd-item"${flagAttr}>
                    ${sub.icon ? `<span class="dd-icon">${escapeText(sub.icon)}</span>` : ''}
                    <div class="dd-text">
                      <span class="dd-title">${escapeText(sub.title || '')}${subBadge}</span>
                      ${subDesc ? `<span class="dd-sub">${escapeText(subDesc)}</span>` : ''}
                    </div>
                  </a>
                `;
              });

              colsHtml += `
                <div class="inst-dropdown-col">
                  ${col.header ? `<span class="inst-dropdown-header">${escapeText(col.header)}</span>` : ''}
                  ${itemsHtml}
                </div>
              `;
            });

            navHtml += `
              <div class="inst-nav-item has-dropdown">
                <a href="${encodeURI(item.url || '#')}" class="${btnClass}">
                  ${iconHtml}
                  <span class="nav-label">${escapeText(item.label || '')}</span>
                  ${badgeHtml}
                  <span class="inst-nav-arrow">▾</span>
                </a>
                <div class="inst-dropdown ${colClass}${singleClass}">
                  ${colsHtml}
                </div>
              </div>
            `;
          }
        });

        if (navHtml) {
          navContainer.innerHTML = navHtml;
        }
      }

      // ── 2. SYNC MOBILE 6-DOT APP LAUNCHER MODAL (#mobileDotMenuModal) ──
      const dotContent = document.querySelector('.dot-menu-content');
      if (dotContent) {
        let dotSectionsHtml = '';

        navData.items.forEach(item => {
          if (item.active === false) return;
          const hasDd = Boolean(item.hasDropdown);

          if (!hasDd) {
            dotSectionsHtml += `
              <div class="dot-menu-section">
                <a href="${encodeURI(item.url || '#')}" class="dot-menu-main-item">
                  <div class="dot-menu-item-left">
                    <span class="dot-menu-item-icon">${escapeText(item.icon || '⬛')}</span>
                    <div>
                      <div class="dot-menu-item-title">${escapeText(item.label || '')}</div>
                      ${item.badge ? `<span class="p2-badge p2-badge-${item.badgeColor || 'teal'}">${escapeText(item.badge)}</span>` : ''}
                    </div>
                  </div>
                  <span class="dot-menu-arrow">→</span>
                </a>
              </div>
            `;
          } else {
            let subItemsHtml = '';
            (item.columns || []).forEach(col => {
              (col.items || []).forEach(sub => {
                if (sub.active === false) return false;
                if (sub.featureFlag && flags[sub.featureFlag] === false) return false;
                if (sub.url === '/futures/future-intraday' && flags.futures_future_intraday === false) return false;
                if (sub.url === '/futures/future-vs-oi' && flags.futures_future_vs_oi === false) return false;

                const subBadge = sub.badge ? `<span class="p2-badge p2-badge-${sub.badgeColor || 'teal'}" style="font-size:9.5px; margin-left:3px;">${escapeText(sub.badge)}</span>` : '';
                const flagAttr = sub.featureFlag ? ` data-feature-flag="${escapeText(sub.featureFlag)}"` : '';
                const subDesc = sub.subtitle || sub.sub || '';

                subItemsHtml += `
                  <a href="${encodeURI(sub.url || '#')}" class="dot-sub-item"${flagAttr}>
                    <span class="dot-sub-icon">${escapeText(sub.icon || '⚡')}</span>
                    <div class="dot-sub-text">
                      <div class="dot-sub-title">${escapeText(sub.title || '')} ${subBadge}</div>
                      ${subDesc ? `<div class="dot-sub-desc">${escapeText(subDesc)}</div>` : ''}
                    </div>
                  </a>
                `;
              });
            });

            dotSectionsHtml += `
              <div class="dot-menu-section">
                <div class="dot-menu-section-header">
                  <span class="dot-section-icon">${escapeText(item.icon || '⚡')}</span>
                  <span class="dot-section-title">${escapeText(item.label || '')}</span>
                  ${item.badge ? `<span class="p2-badge p2-badge-${item.badgeColor || 'teal'}" style="font-size:10px;">${escapeText(item.badge)}</span>` : ''}
                </div>
                <div class="dot-sub-grid">
                  ${subItemsHtml}
                </div>
              </div>
            `;
          }
        });

        if (dotSectionsHtml) {
          dotContent.innerHTML = dotSectionsHtml;
        }
      }

    } catch (err) {
      console.warn("Dynamic Navigation Sync Notice:", err);
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

  window.syncDynamicNavigation = syncDynamicNavigation;
})();
