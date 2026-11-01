/**
 * ============================================================================
 * 🌐 TRADERSDESK DYNAMIC NAVIGATION & REAL-TIME CMS SYNC
 * ============================================================================
 * Synchronizes Header Mega-Menu and Mobile 6-Dot Drawer in real time
 * with the Admin Panel Navigation Builder and Feature Flags.
 * Any added tool, custom page, submenu, or flag toggle appears instantly.
 * Provides resilient client-side delegated routing and canonical element IDs.
 */

(function() {
  "use strict";

  const DESK_ONCLICK_MAP = {
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
    "/fii-dii": "return window.instNavClick(event, 'smartmoney')",
    "/fii-dii#oi": "return window.instNavClick(event, 'smartmoney', 'oi')",
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
  };

  function getCanonicalBtnId(item) {
    if (!item) return '';
    const id = item.id || '';
    const u = (item.url || '').toLowerCase().replace(/\/$/, '') || '/';
    if (id === 'nav_dashboard' || u === '/' || u === '/dashboard') return 'navDashboard';
    if (id === 'nav_futures' || u.startsWith('/futures')) return 'navFutures';
    if (id === 'nav_options' || u.startsWith('/option')) return 'navOptions';
    if (id === 'nav_charts' || u.startsWith('/chart')) return 'navCharts';
    if (id === 'nav_fiidii' || u.startsWith('/fii') || u.startsWith('/smart')) return 'navFiiDii';
    if (id === 'nav_delivery' || u.startsWith('/delivery')) return 'navDelivery';
    if (id === 'nav_mtf' || u.startsWith('/mtf')) return 'navMtf';
    if (id === 'nav_blog' || u.startsWith('/blog')) return 'navBlog';
    return id || '';
  }

  function getRouteMapping(rawUrl) {
    if (!rawUrl) return null;
    const url = rawUrl.trim();
    const clean = url.split('?')[0].split('#')[0].toLowerCase().replace(/\/$/, '') || '/';
    
    if (clean === '/' || clean === '/dashboard') return { desk: 'dashboard', subview: null };
    if (clean === '/futures') return { desk: 'futures', subview: 'matrix' };
    if (clean === '/futures/marketwatch') return { desk: 'futures', subview: 'matrix' };
    if (clean === '/futures/open-interest' || clean === '/futures/oi') return { desk: 'futures', subview: 'openInterest' };
    if (clean === '/futures/future-intraday' || clean === '/futures/intraday') return { desk: 'futures', subview: 'futureIntraday' };
    if (clean === '/futures/future-vs-oi' || clean === '/futures/price-vs-oi') return { desk: 'futures', subview: 'futureVsOi' };
    if (clean === '/futures/buildup') return { desk: 'futures', subview: 'buildup' };
    if (clean === '/futures/heatmap' || clean === '/futures/heatmaps') return { desk: 'futures', subview: 'heatmap' };
    if (clean === '/futures/indices') return { desk: 'futures', subview: 'indices' };
    if (clean === '/futures/mwpl') return { desk: 'futures', subview: 'mwpl' };
    if (clean === '/futures/rollover') return { desk: 'futures', subview: 'rollover' };
    if (clean === '/option-chain-pro' || clean === '/option-chain' || clean === '/options') return { desk: 'upstoxChain', subview: null };
    if (clean === '/fii-dii' || clean === '/smart-money' || clean === '/smartmoney') {
      if (url.includes('#oi')) return { desk: 'smartMoney', subview: 'oi' };
      return { desk: 'smartMoney', subview: null };
    }
    if (clean === '/fii-dii/cash') return { desk: 'smartMoney', subview: 'cash' };
    if (clean === '/fii-dii/derivatives') return { desk: 'smartMoney', subview: 'derivatives' };
    if (clean === '/delivery' || clean === '/delivery-analytics') return { desk: 'delivery', subview: null };
    if (clean.startsWith('/delivery/')) return { desk: 'delivery', subview: clean.replace('/delivery/', '') };
    if (clean === '/mtf' || clean === '/mtf-analytics') return { desk: 'mtf', subview: null };
    if (clean.startsWith('/mtf/')) return { desk: 'mtf', subview: clean.replace('/mtf/', '') };
    if (clean === '/tools' || clean === '/quant-tools') return { desk: 'tools', subview: null };
    if (clean === '/settings') return { desk: 'settings', subview: null };
    return null;
  }

  function getPanelIdForDesk(desk) {
    if (!desk) return null;
    const d = desk.toLowerCase();
    if (d === 'dashboard') return 'panelDashboard';
    if (d === 'futures') return 'panelFutures';
    if (d === 'upstoxchain' || d === 'options') return 'panelUpstoxChain';
    if (d === 'smartmoney' || d === 'fiidii') return 'panelSmartMoney';
    if (d === 'delivery') return 'panelDelivery';
    if (d === 'mtf') return 'panelMtf';
    if (d === 'breadth') return 'panelBreadth';
    if (d === 'tools') return 'panelTools';
    if (d === 'settings') return 'panelSettings';
    return null;
  }

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

          const btnId = getCanonicalBtnId(item);
          const idAttr = btnId ? ` id="${btnId}"` : '';
          const topOnclick = DESK_ONCLICK_MAP[item.url] ? ` onclick="${DESK_ONCLICK_MAP[item.url]}"` : '';

          const badgeHtml = (item.badge && !/^(PRO|NEW|LIVE|OI|F&O|HOT|BETA)$/i.test(item.badge.trim())) ? `<span class="p2-badge p2-badge-${item.badgeColor || 'teal'}">${escapeText(item.badge)}</span>` : '';
          const iconHtml = item.icon ? `<span class="inst-nav-icon">${escapeText(item.icon)}</span>` : '';

          if (!hasDd) {
            navHtml += `
              <div class="inst-nav-item">
                <a href="${encodeURI(item.url || '#')}"${idAttr} class="${btnClass}"${topOnclick}>
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
                const subBadge = (sub.badge && !/^(PRO|NEW|LIVE|OI|F&O|HOT|BETA)$/i.test(sub.badge.trim())) ? `<span class="p2-badge p2-badge-${sub.badgeColor || 'teal'}" style="margin-left:4px;">${escapeText(sub.badge)}</span>` : '';
                const flagAttr = sub.featureFlag ? ` data-feature-flag="${escapeText(sub.featureFlag)}"` : '';
                const subDesc = sub.subtitle || sub.sub || '';
                const subOnclick = DESK_ONCLICK_MAP[sub.url] ? ` onclick="${DESK_ONCLICK_MAP[sub.url]}"` : '';

                itemsHtml += `
                  <a href="${encodeURI(sub.url || '#')}" class="inst-dd-item"${flagAttr}${subOnclick}>
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
                <a href="${encodeURI(item.url || '#')}"${idAttr} class="${btnClass}"${topOnclick}>
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

                const compatHtml = `
          <button id="navUpstoxChain" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Option Chain Pro</button>
          <button id="navBreadthContrib" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Breadth Contrib</button>
          <button id="navBreadth" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Market Breadth</button>
          <button id="tabBreadth" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Breadth</button>
          <button id="tabOptions" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Options</button>
          <button id="tabSmartMoney" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Smart Money</button>
          <button id="tabDelivery" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Delivery</button>
          <button id="tabMtf" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">MTF</button>
          <button id="tabTools" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Tools</button>
          <button id="tabSettings" class="tab-btn inst-hidden-tab" type="button" style="display:none!important">Settings</button>
        `;
        if (navHtml) {
          navContainer.innerHTML = navHtml + compatHtml;
        }
      }

      // ── 2. SYNC MOBILE 6-DOT APP LAUNCHER MODAL (#mobileDotMenuModal) ──
      const dotContent = document.querySelector('.dot-menu-content');
      if (dotContent) {
        let dotSectionsHtml = '';

        navData.items.forEach(item => {
          if (item.active === false) return;
          const hasDd = Boolean(item.hasDropdown);
          const topOnclick = DESK_ONCLICK_MAP[item.url] ? ` onclick="${DESK_ONCLICK_MAP[item.url]}"` : '';

          if (!hasDd) {
            dotSectionsHtml += `
              <div class="dot-menu-section">
                <a href="${encodeURI(item.url || '#')}" class="dot-menu-main-item"${topOnclick}>
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

                const subBadge = (sub.badge && !/^(PRO|NEW|LIVE|OI|F&O|HOT|BETA)$/i.test(sub.badge.trim())) ? `<span class="p2-badge p2-badge-${sub.badgeColor || 'teal'}" style="margin-left:4px;">${escapeText(sub.badge)}</span>` : '';
                const flagAttr = sub.featureFlag ? ` data-feature-flag="${escapeText(sub.featureFlag)}"` : '';
                const subDesc = sub.subtitle || sub.sub || '';
                const subOnclick = DESK_ONCLICK_MAP[sub.url] ? ` onclick="${DESK_ONCLICK_MAP[sub.url]}"` : '';

                subItemsHtml += `
                  <a href="${encodeURI(sub.url || '#')}" class="dot-sub-item"${flagAttr}${subOnclick}>
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
                  ${(item.badge && !/^(PRO|NEW|LIVE|OI|F&O|HOT|BETA)$/i.test(item.badge.trim())) ? `<span class="p2-badge p2-badge-${item.badgeColor || 'teal'}" style="font-size:10px;">${escapeText(item.badge)}</span>` : ''}
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

  // Delegated click interceptor for instantaneous SPA navigation
  document.addEventListener('click', function(e) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // Allow new tab
    const link = e.target.closest('#mainInstNav a, .dot-menu-content a, #mobileBottomNav a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('http') || href.startsWith('javascript:')) return;

    // Check if target is an in-app panel available in the current DOM
    const route = getRouteMapping(href);
    if (route) {
      const panelId = getPanelIdForDesk(route.desk);
      if (panelId && document.getElementById(panelId) && typeof window.instNav === 'function') {
        e.preventDefault();
        if (typeof window.closeAllMobileDropdowns === 'function') window.closeAllMobileDropdowns();
        if (typeof window.closeMobileDotMenu === 'function') window.closeMobileDotMenu();
        window.instNav(route.desk, route.subview, true, true);
        return false;
      }
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDynamicNavigation);
  } else {
    syncDynamicNavigation();
  }

  window.syncDynamicNavigation = syncDynamicNavigation;
})();
