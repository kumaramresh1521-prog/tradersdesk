/**
 * Institutional Futures Intelligence Desk
 * Powered by Kotak Neo Derivatives Engine
 * Comprehensive real-time Stock & Index Futures analytics (200 instruments):
 * - Live All F&O Market Watch Matrix (193 Stocks + 7 Indices)
 * - Benchmark Index Futures Ribbon (Nifty, BankNifty, FinNifty, MidcpNifty, Sensex)
 * - 4-Quadrant Institutional Buildup (LB, SB, SC, LU) & Flow Heatmap
 * - Index Term Structure & Basis Spread Hub
 * - MWPL & F&O Ban Radar
 */

(function () {
  const state = {
    activeSubTab: 'matrix',
    sector: 'ALL',
    signal: 'ALL',
    search: '',
    sortBy: 'oiValueCr',
    sortDir: 'desc',
    autoRefreshSec: 5,
    countdownSec: 5,
    timerId: null,
    countdownTimer: null,
    isLoading: false,
    dashboardData: null,
    screenerData: null,
    buildupData: null,
    heatmapData: null,
    mwplData: null,
    rolloverData: null,
    rolloverSearch: '',
    rolloverSector: 'ALL',
    rolloverTier: 'ALL',
    rolloverSortBy: 'symbol',
    rolloverSortDir: 'asc',
    lastPrices: {},
    initialized: false
  };

  function fmtNum(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function fmtQty(q) {
    if (!q || isNaN(q)) return '--';
    const num = Number(q);
    if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return (num / 1000).toFixed(1) + ' k';
    return num.toLocaleString('en-IN');
  }

  function getSignalBadge(code, name) {
    const c = (code || '').toUpperCase();
    if (c === 'LB' || c.includes('LONG BUILD')) {
      return `<span class="fut-badge fut-badge-lb">🟢 LONG BUILDUP</span>`;
    } else if (c === 'SB' || c.includes('SHORT BUILD')) {
      return `<span class="fut-badge fut-badge-sb">🔴 SHORT BUILDUP</span>`;
    } else if (c === 'SC' || c.includes('SHORT COVER')) {
      return `<span class="fut-badge fut-badge-sc">🔵 SHORT COVERING</span>`;
    } else if (c === 'LU' || c.includes('LONG UNWIND')) {
      return `<span class="fut-badge fut-badge-lu">🟡 LONG UNWINDING</span>`;
    }
    return `<span class="fut-badge fut-badge-neutral">⚪ NEUTRAL</span>`;
  }

  // Metadata for each dedicated Futures Desk view
  const DESK_VIEW_META = {
    matrix: {
      title: "FUTURE MARKETWATCH",
      countBadge: "200 CONTRACTS",
      icon: "📊",
      desc: "Live institutional matrix, cash-futures spread, cost of carry & open interest analytics for all NSE F&O contracts.",
      showSearch: true
    },
    indices: {
      title: "INDEX TERM STRUCTURE & BASIS",
      countBadge: "7 INDICES",
      icon: "📈",
      desc: "Cash-futures basis spread, cost of carry & multi-expiry rollover term structure for benchmark indices.",
      showSearch: false
    },
    buildup: {
      title: "FUTURE BUILDUP QUADRANTS",
      countBadge: "4 QUADRANTS",
      icon: "⚡",
      desc: "Real-time institutional momentum classification: Long Buildup, Short Buildup, Short Covering & Long Unwinding.",
      showSearch: false
    },
    heatmap: {
      title: "FUTURE VISUAL HEATMAP",
      countBadge: "F&O SECTOR MAP",
      icon: "🗺️",
      desc: "Visual sector heatmap & momentum distribution mapped across all F&O market sectors.",
      showSearch: false
    },
    mwpl: {
      title: "MWPL & BAN RADAR",
      countBadge: "POSITION LIMIT RADAR",
      icon: "🚫",
      desc: "Market-Wide Position Limit tracker, current F&O ban list & 80%-95% pre-ban alert zone.",
      showSearch: false
    },
    rollover: {
      title: "HISTORICAL FUTURES ROLLOVER MATRIX",
      countBadge: "280+ CONTRACTS",
      icon: "🔄",
      desc: "Comprehensive monthly expiry rollover percentages, 3M/6M averages & institutional rollover velocity across all NSE F&O equities and indices.",
      showSearch: false
    }
  };

  // --- Sub-Tab Switching (Strict View Isolation) ---
  function switchSubTab(tabName) {
    // Aliases for compatibility
    if (tabName === 'dashboard' || tabName === 'screener' || tabName === 'marketwatch') tabName = 'matrix';
    if (tabName === 'termstructure' || tabName === 'basis') tabName = 'indices';

    state.activeSubTab = tabName;

    // Dynamically update header command bar for the active tool
    const meta = DESK_VIEW_META[tabName] || DESK_VIEW_META.matrix;
    const headingEl = document.getElementById('futDeskHeadingText');
    if (headingEl) headingEl.textContent = meta.title;
    const iconEl = document.getElementById('futDeskBrandIcon');
    if (iconEl) iconEl.textContent = meta.icon;
    const countEl = document.getElementById('futUniverseCountBadge');
    if (countEl) countEl.textContent = meta.countBadge;
    const descEl = document.getElementById('futDeskSubheading');
    if (descEl) descEl.textContent = meta.desc;
    const searchBox = document.getElementById('futSearchBoxWrapper');
    if (searchBox) searchBox.style.display = meta.showSearch ? 'flex' : 'none';

    document.querySelectorAll('.fut-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const views = ['matrix', 'indices', 'buildup', 'heatmap', 'mwpl', 'rollover'];
    views.forEach(v => {
      const el = document.getElementById(`futView_${v}`);
      if (el) {
        el.style.display = (v === tabName) ? 'block' : 'none';
      }
    });

    refreshCurrentSubTab();

    // Sync clean URL when navigating within Futures Desk
    try {
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/futures")) {
        const futSubUrl = tabName === "matrix" ? "/futures" : `/futures/${tabName}`;
        if (window.location.pathname !== futSubUrl && typeof history !== "undefined" && history.pushState) {
          history.pushState({ desk: "futures", subview: tabName }, document.title, futSubUrl);
        }
      }
    } catch (_) {}
  }

  async function refreshCurrentSubTab(forceRefresh = false) {
    const p1 = loadBenchmarkRibbon(forceRefresh);
    let p2;
    if (state.activeSubTab === 'matrix') p2 = loadMatrix(forceRefresh);
    else if (state.activeSubTab === 'indices') p2 = loadIndicesDetailView(forceRefresh);
    else if (state.activeSubTab === 'buildup') p2 = loadBuildupView(forceRefresh);
    else if (state.activeSubTab === 'heatmap') p2 = loadHeatmapView(forceRefresh);
    else if (state.activeSubTab === 'mwpl') p2 = loadMwpl(forceRefresh);
    else if (state.activeSubTab === 'rollover') p2 = loadRolloverMatrix(forceRefresh);
    await Promise.all([p1, p2]);
  }

  // --- Benchmark Index Ribbon ---
  async function loadBenchmarkRibbon(forceRefresh = false) {
    try {
      const url = forceRefresh ? `/api/futures/dashboard?refresh=true&_t=${Date.now()}` : '/api/futures/dashboard';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      state.dashboardData = data;

      // Update Macro Turnover & OI for Matrix
      const turnoverEl = document.getElementById('futKpiTurnover');
      if (turnoverEl && data.totalTurnoverCr) {
        turnoverEl.textContent = `₹${fmtNum(data.totalTurnoverCr, 1)} Cr`;
      }
      const oiEl = document.getElementById('futKpiOi');
      if (oiEl && data.totalOiCr) {
        oiEl.textContent = `₹${fmtNum(data.totalOiCr, 1)} Cr (${fmtQty(data.cumulativeOiContracts)})`;
      }

      // Also update Macro Turnover & OI for Buildup view
      const bTurnoverEl = document.getElementById('futBuildupKpiTurnover');
      if (bTurnoverEl && data.totalTurnoverCr) {
        bTurnoverEl.textContent = `₹${fmtNum(data.totalTurnoverCr, 1)} Cr`;
      }
      const bOiEl = document.getElementById('futBuildupKpiOi');
      if (bOiEl && data.totalOiCr) {
        bOiEl.textContent = `₹${fmtNum(data.totalOiCr, 1)} Cr (${fmtQty(data.cumulativeOiContracts)})`;
      }

      const sessionDateEl = document.getElementById('futSessionDateBadge');
      if (sessionDateEl && data.asOfDate) {
        const mode = data.isLive ? 'LIVE' : (data.sessionMode || 'EOD');
        sessionDateEl.textContent = `${mode} • ${data.asOfDate.toUpperCase()}`;
        if (data.isLive) {
          sessionDateEl.style.background = 'rgba(16,185,129,0.15)';
          sessionDateEl.style.color = '#10b981';
          sessionDateEl.style.borderColor = 'rgba(16,185,129,0.3)';
        } else {
          sessionDateEl.style.background = 'rgba(56,189,248,0.15)';
          sessionDateEl.style.color = '#38bdf8';
          sessionDateEl.style.borderColor = 'rgba(56,189,248,0.3)';
        }
      }

      // Sentiment Ratio Bar (Dual update for Matrix & Buildup)
      const counts = data.buildupCounts || {};
      const lb = counts.longBuildup || 0;
      const sb = counts.shortBuildup || 0;
      const sc = counts.shortCovering || 0;
      const lu = counts.longUnwinding || 0;
      const tot = (lb + sb + sc + lu) || 1;

      const ratioHtml = `
        <div style="width:${(lb/tot)*100}%; background:#10b981;" title="Longs: ${lb}"></div>
        <div style="width:${(sb/tot)*100}%; background:#ef4444;" title="Shorts: ${sb}"></div>
        <div style="width:${(sc/tot)*100}%; background:#3b82f6;" title="Short Covering: ${sc}"></div>
        <div style="width:${(lu/tot)*100}%; background:#f59e0b;" title="Long Unwinding: ${lu}"></div>
      `;
      const countHtml = `
        <span style="color:#10b981; font-weight:700;">🟢 ${lb}L</span> &bull; 
        <span style="color:#ef4444; font-weight:700;">🔴 ${sb}S</span> &bull; 
        <span style="color:#3b82f6; font-weight:700;">🔵 ${sc}SC</span> &bull; 
        <span style="color:#f59e0b; font-weight:700;">🟡 ${lu}LU</span>
      `;

      const rBar = document.getElementById('futBuildupRatioBar');
      if (rBar) rBar.innerHTML = ratioHtml;
      const cText = document.getElementById('futBuildupCountText');
      if (cText) cText.innerHTML = countHtml;

      const bRBar = document.getElementById('futBuildupQuadRatioBar');
      if (bRBar) bRBar.innerHTML = ratioHtml;
      const bCText = document.getElementById('futBuildupQuadCountText');
      if (bCText) bCText.innerHTML = countHtml;

      // Signal Pill Counts
      const elLb = document.getElementById('countLb'); if (elLb) elLb.textContent = lb;
      const elSb = document.getElementById('countSb'); if (elSb) elSb.textContent = sb;
      const elSc = document.getElementById('countSc'); if (elSc) elSc.textContent = sc;
      const elLu = document.getElementById('countLu'); if (elLu) elLu.textContent = lu;

      // Render Ribbon Cards (7 Major Indices)
      const grid = document.getElementById('futIndexCardsGrid');
      if (grid && data.indices) {
        grid.innerHTML = data.indices.map(idx => {
          const isPos = (idx.priceChangePct ?? idx.changePct ?? 0) >= 0;
          const color = isPos ? '#10b981' : '#ef4444';
          const sign = isPos ? '+' : '';
          const basisVal = idx.basis ?? 0;
          const basisSign = basisVal >= 0 ? '+' : '';
          const basisColor = basisVal >= 0 ? '#10b981' : '#ef4444';
          const basisType = basisVal >= 0 ? 'PREMIUM' : 'DISCOUNT';
          const prevLtp = state.lastPrices[idx.symbol];
          const changed = prevLtp !== undefined && prevLtp !== idx.futPrice;
          const flashCls = changed ? (idx.futPrice >= prevLtp ? 'tick-flash-up' : 'tick-flash-down') : '';
          state.lastPrices[idx.symbol] = idx.futPrice;

          return `
            <div class="fut-index-card ${flashCls}" onclick="window.futuresDesk.filterBySymbol('${idx.symbol}')" title="Click to filter matrix">
              <div class="fut-ic-top">
                <div>
                  <span class="fut-ic-sym">${idx.symbol} FUT</span>
                  <span class="fut-ic-exp">${idx.expiry || '27-Oct'}</span>
                </div>
                <span class="fut-badge ${isPos ? 'fut-badge-lb' : 'fut-badge-sb'}">${idx.buildupCode || (isPos ? 'LB' : 'SB')}</span>
              </div>
              <div class="fut-ic-ltp-row">
                <span class="fut-ic-ltp" style="color:${color}">₹${fmtNum(idx.futPrice || idx.ltp)}</span>
                <span class="fut-ic-chg" style="color:${color}">${sign}${fmtNum(idx.priceChange || idx.change)} (${sign}${fmtNum(idx.priceChangePct || idx.changePct)}%)</span>
              </div>
              <div class="fut-ic-stats">
                <div class="fut-ic-stat-item">
                  <span>Spot:</span>
                  <span class="fut-ic-stat-val">₹${fmtNum(idx.spotPrice)}</span>
                </div>
                <div class="fut-ic-stat-item">
                  <span>Spread:</span>
                  <span class="fut-ic-stat-val" style="color:${basisColor}">${basisSign}${fmtNum(basisVal, 1)} pts</span>
                </div>
                <div class="fut-ic-stat-item">
                  <span>Carry (CoC):</span>
                  <span class="fut-ic-stat-val" style="color:${basisColor}">${basisSign}${fmtNum(idx.coc || 7.2, 1)}%</span>
                </div>
                <div class="fut-ic-stat-item">
                  <span>Open Int:</span>
                  <span class="fut-ic-stat-val">${fmtQty(idx.oiContracts || idx.openInterest)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

    } catch (err) {
      console.warn('Futures ribbon load error:', err);
    }
  }

  // --- Sub-Tab 1: All F&O Market Watch Matrix ---
  async function loadMatrix(forceRefresh = false) {
    try {
      const q = new URLSearchParams({
        sector: state.sector,
        signal: state.signal,
        search: state.search,
        sortBy: state.sortBy,
        sortDir: state.sortDir
      });
      if (forceRefresh) {
        q.append('refresh', 'true');
        q.append('_t', Date.now());
      }

      const res = await fetch(`/api/futures/screener?${q.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      state.screenerData = json;

      const tb = document.getElementById('futMatrixTableBody');
      const countBadge = document.getElementById('tabCountMatrix');
      if (countBadge) countBadge.textContent = json.count || (json.data ? json.data.length : 0);

      if (!tb || !json.data) return;

      if (!json.data.length) {
        tb.innerHTML = `<tr><td colspan="14" style="text-align:center; padding:32px; color:#64748b; font-size:13px;">No F&O contracts matching filter criteria.</td></tr>`;
        return;
      }

      tb.innerHTML = json.data.map((r, i) => {
        const isPos = (r.priceChangePct ?? 0) >= 0;
        const color = isPos ? '#10b981' : '#ef4444';
        const sign = isPos ? '+' : '';

        const oiChg = r.oiChangePct ?? 0;
        const oiIsPos = oiChg >= 0;
        const oiColor = oiIsPos ? '#38bdf8' : '#f59e0b';
        const oiSign = oiIsPos ? '+' : '';

        const basisVal = r.basis ?? 0;
        const basisSign = basisVal >= 0 ? '+' : '';
        const basisColor = basisVal >= 0 ? '#10b981' : '#ef4444';

        const cocVal = r.coc ?? (r.basisPct ? r.basisPct * 24.3 : 0);
        const cocSign = cocVal >= 0 ? '+' : '';

        const prevPrice = state.lastPrices[r.symbol];
        const changed = prevPrice !== undefined && prevPrice !== r.futPrice;
        const flashCls = changed ? (r.futPrice >= prevPrice ? 'tick-flash-up' : 'tick-flash-down') : '';
        state.lastPrices[r.symbol] = r.futPrice;

        const tickArrow = r.tickDir === 'UP' ? '▲' : '▼';
        const tickColor = r.tickDir === 'UP' ? '#10b981' : '#ef4444';

        // Day range marker %
        const dLow = r.dayLow || (r.futPrice * 0.985);
        const dHigh = r.dayHigh || (r.futPrice * 1.015);
        const rangeSpan = Math.max(1, dHigh - dLow);
        const posPct = Math.min(100, Math.max(0, ((r.futPrice - dLow) / rangeSpan) * 100));

        // MWPL Bar
        const mwpl = r.mwplPct ?? 45.0;
        const mwplColor = mwpl >= 95 ? '#ef4444' : (mwpl >= 80 ? '#f59e0b' : '#10b981');

        return `
          <tr class="${flashCls}" onclick="window.futuresDesk.inspectContract('${r.symbol}')">
            <td style="color:#64748b; font-size:11px;">${i + 1}</td>
            <td>
              <div style="display:flex; align-items:center; gap:6px;">
                <strong style="color:var(--text-primary, #f8fafc); font-size:12.5px;">${r.symbol}</strong>
                ${r.isIndex ? '<span style="font-size:9px; background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4); padding:1px 4px; border-radius:3px; font-weight:800;">INDEX</span>' : ''}
                <span style="font-size:10px; color:#64748b;">${r.expiry || '27-Oct'}</span>
              </div>
              <div style="font-size:10px; color:var(--text-muted, #94a3b8); font-family:-apple-system,BlinkMacSystemFont,sans-serif;">${r.name || r.symbol}</div>
            </td>
            <td><span class="fut-sector-badge">${r.sector}</span></td>
            <td style="text-align:right; color:var(--text-muted, #94a3b8);">₹${fmtNum(r.spotPrice)}</td>
            <td style="text-align:right;">
              <span style="color:${color}; font-weight:800;">₹${fmtNum(r.futPrice)}</span>
              <span style="color:${tickColor}; font-size:9px; margin-left:2px;">${tickArrow}</span>
            </td>
            <td style="text-align:right; color:${color}; font-weight:700;">
              ${sign}${fmtNum(r.priceChangePct)}%
            </td>
            <td style="text-align:right; color:${basisColor}; font-weight:700;">
              ${basisSign}${fmtNum(basisVal, 1)} <span style="font-size:10px; opacity:0.8;">(${basisSign}${fmtNum(r.basisPct, 2)}%)</span>
            </td>
            <td style="text-align:right; color:${basisColor}; font-weight:700;">
              ${cocSign}${fmtNum(cocVal, 1)}%
            </td>
            <td style="text-align:right;">
              <span style="color:var(--text-primary, #f8fafc); font-weight:700;">${fmtQty(r.oiContracts)}</span>
              <span style="font-size:10px; color:#64748b; display:block;">${fmtNum(r.oiContracts)} lots</span>
            </td>
            <td style="text-align:right; color:${oiColor}; font-weight:700;">
              ${oiSign}${fmtNum(oiChg)}%
            </td>
            <td style="text-align:right; color:var(--text-secondary, #cbd5e1); font-weight:700;">
              ₹${fmtNum(r.oiValueCr, 1)} Cr
            </td>
            <td style="text-align:center;">
              <div class="fut-day-range" style="margin:0 auto;">
                <span>${fmtNum(dLow, 0)}</span>
                <div class="fut-dr-bar-wrap">
                  <div class="fut-dr-marker" style="left:${posPct}%;"></div>
                </div>
                <span>${fmtNum(dHigh, 0)}</span>
              </div>
            </td>
            <td style="text-align:center;">
              ${getSignalBadge(r.buildupCode, r.buildup)}
            </td>
            <td style="text-align:right;">
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                <span style="color:${mwplColor}; font-weight:700;">${fmtNum(mwpl, 1)}%</span>
                <div class="fut-mwpl-pbar" style="width:45px;">
                  <div class="fut-mwpl-pfill" style="width:${Math.min(100, mwpl)}%; background:${mwplColor};"></div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.warn('Matrix load error:', err);
    }
  }

  // --- Sub-Tab 3: Future Buildup Quadrants ---
  async function loadBuildupView(forceRefresh = false) {
    try {
      const url = forceRefresh ? `/api/futures/buildup?refresh=true&_t=${Date.now()}` : '/api/futures/buildup';
      const resB = await fetch(url);
      if (resB.ok) {
        const dataB = await resB.json();
        renderQuadrants(dataB);
      }
    } catch (err) {
      console.warn('Buildup view load error:', err);
    }
  }

  // --- Sub-Tab 4: Dedicated Visual Heatmap View ---
  async function loadHeatmapView(forceRefresh = false) {
    try {
      const url = forceRefresh 
        ? `/api/futures/heatmap?sector=${state.sector}&refresh=true&_t=${Date.now()}` 
        : `/api/futures/heatmap?sector=${state.sector}`;
      const resH = await fetch(url);
      if (resH.ok) {
        const dataH = await resH.json();
        renderHeatmap(dataH);
      }
    } catch (err) {
      console.warn('Heatmap view load error:', err);
    }
  }

  function renderQuadrants(data) {
    if (!data) return;

    const renderList = (elId, list, badgeCls) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (!list || !list.length) {
        el.innerHTML = '<div style="padding:14px; text-align:center; color:#64748b; font-size:11px;">No stocks in this quadrant</div>';
        return;
      }
      el.innerHTML = list.slice(0, 15).map(s => {
        const isPos = s.priceChangePct >= 0;
        const sign = isPos ? '+' : '';
        const color = isPos ? '#10b981' : '#ef4444';
        return `
          <div class="fut-quad-item" onclick="window.futuresDesk.inspectContract('${s.symbol}')">
            <div style="display:flex; align-items:center; gap:6px;">
              <strong style="color:var(--text-primary, #f8fafc); font-size:12px;">${s.symbol}</strong>
              <span style="font-size:9.5px; color:#64748b;">${s.sector}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="color:${color}; font-weight:700;">₹${fmtNum(s.futPrice)} (${sign}${fmtNum(s.priceChangePct)}%)</span>
              <span style="font-size:10.5px; color:#38bdf8; font-weight:700;">OI: +${fmtNum(s.oiChangePct)}%</span>
            </div>
          </div>
        `;
      }).join('');
    };

    renderList('futQuadLbList', data.longBuildup, 'fut-badge-lb');
    renderList('futQuadSbList', data.shortBuildup, 'fut-badge-sb');
    renderList('futQuadScList', data.shortCovering, 'fut-badge-sc');
    renderList('futQuadLuList', data.longUnwinding, 'fut-badge-lu');

    const cLb = document.getElementById('futQuadLbCount'); if (cLb) cLb.textContent = (data.longBuildup || []).length;
    const cSb = document.getElementById('futQuadSbCount'); if (cSb) cSb.textContent = (data.shortBuildup || []).length;
    const cSc = document.getElementById('futQuadScCount'); if (cSc) cSc.textContent = (data.shortCovering || []).length;
    const cLu = document.getElementById('futQuadLuCount'); if (cLu) cLu.textContent = (data.longUnwinding || []).length;
  }

  function renderHeatmap(data) {
    const grid = document.getElementById('futHeatmapGrid');
    if (!grid || !data || !data.tiles) return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.getAttribute('data-theme') === 'light';

    grid.innerHTML = data.tiles.map(tile => {
      const isPos = tile.changePct >= 0;
      let bg, border;

      if (isLight) {
        if (tile.changePct >= 1.5) {
          bg = 'rgba(16, 185, 129, 0.22)';
          border = '#10b981';
        } else if (tile.changePct > 0.2) {
          bg = 'rgba(16, 185, 129, 0.11)';
          border = '#34d399';
        } else if (tile.changePct <= -1.5) {
          bg = 'rgba(239, 68, 68, 0.22)';
          border = '#ef4444';
        } else if (tile.changePct < -0.2) {
          bg = 'rgba(239, 68, 68, 0.11)';
          border = '#f87171';
        } else {
          // Neutral tiles: sleek institutional light slate in Day Mode (NO black boxes)
          bg = '#f1f5f9';
          border = '#cbd5e1';
        }
      } else {
        if (tile.changePct >= 1.5) {
          bg = 'rgba(16, 185, 129, 0.4)';
          border = '#10b981';
        } else if (tile.changePct > 0.2) {
          bg = 'rgba(16, 185, 129, 0.2)';
          border = '#059669';
        } else if (tile.changePct <= -1.5) {
          bg = 'rgba(239, 68, 68, 0.4)';
          border = '#ef4444';
        } else if (tile.changePct < -0.2) {
          bg = 'rgba(239, 68, 68, 0.2)';
          border = '#dc2626';
        } else {
          bg = '#1e293b';
          border = '#334155';
        }
      }

      const symColor = isLight ? '#0f172a' : '#ffffff';
      const chgColor = isPos ? (isLight ? '#059669' : '#34d399') : (isLight ? '#dc2626' : '#f87171');
      const subPriceColor = isLight ? '#334155' : '#cbd5e1';
      const subOiColor = isLight ? '#64748b' : '#94a3b8';
      const oiVal = tile.oi ? fmtQty(tile.oi) : (tile.oiCr ? '₹' + fmtNum(tile.oiCr, 0) + 'Cr' : '--');

      return `
        <div class="fut-heatmap-tile" style="background:${bg}; border:1px solid ${border};" onclick="window.futuresDesk.inspectContract('${tile.symbol}')">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <strong style="font-size:11.5px; color:${symColor}; font-weight:800;">${tile.symbol}</strong>
            <span style="font-size:10px; color:${chgColor}; font-weight:800;">${isPos ? '+' : ''}${tile.changePct.toFixed(1)}%</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:10px; color:${subPriceColor}; margin-top:4px;">
            <span style="font-family:'JetBrains Mono',monospace;">₹${fmtNum(tile.price, 0)}</span>
            <span style="color:${subOiColor}; font-family:'JetBrains Mono',monospace;">OI: ${oiVal}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Sub-Tab 3: Index Term Structure & Basis ---
  async function loadIndicesDetailView(forceRefresh = false) {
    try {
      const url = forceRefresh ? `/api/futures/screener?sector=INDICES&refresh=true&_t=${Date.now()}` : '/api/futures/screener?sector=INDICES';
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      const container = document.getElementById('futIndicesDetailGrid');
      if (!container || !json.data) return;

      container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px;">
          ${json.data.map(idx => {
            const isPos = idx.priceChangePct >= 0;
            const sign = isPos ? '+' : '';
            const color = isPos ? '#10b981' : '#ef4444';
            const basisSign = idx.basis >= 0 ? '+' : '';
            const basisColor = idx.basis >= 0 ? '#10b981' : '#ef4444';

            return `
              <div class="fut-index-card" style="padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <div>
                    <h3 class="fut-idx-card-title">${idx.symbol} FUTURES</h3>
                    <span style="font-size:11px; color:var(--text-muted, #94a3b8);">${idx.name} &bull; Lot: ${idx.lot}</span>
                  </div>
                  <span class="fut-badge ${isPos ? 'fut-badge-lb' : 'fut-badge-sb'}" style="font-size:11px;">${idx.buildup}</span>
                </div>

                <div class="fut-idx-price-box" style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:14px; padding:10px 14px; border-radius:6px;">
                  <div>
                    <span style="font-size:10px; color:#64748b; display:block; text-transform:uppercase;">Futures LTP</span>
                    <strong style="font-size:20px; color:${color}; font-family:'JetBrains Mono',monospace;">₹${fmtNum(idx.futPrice)}</strong>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-size:10px; color:#64748b; display:block; text-transform:uppercase;">Spot Price</span>
                    <strong class="fut-idx-spot-num" style="font-size:16px; font-family:'JetBrains Mono',monospace;">₹${fmtNum(idx.spotPrice)}</strong>
                  </div>
                </div>

                <div class="fut-idx-grid-stats" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:11.5px; padding-top:12px;">
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted, #94a3b8);">Cash-Fut Basis:</span>
                    <strong style="color:${basisColor}; font-family:'JetBrains Mono',monospace;">${basisSign}${fmtNum(idx.basis, 1)} pts (${basisSign}${fmtNum(idx.basisPct, 2)}%)</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted, #94a3b8);">Cost of Carry:</span>
                    <strong style="color:${basisColor}; font-family:'JetBrains Mono',monospace;">${basisSign}${fmtNum(idx.coc, 1)}% p.a.</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted, #94a3b8);">Open Interest:</span>
                    <strong class="fut-idx-oi-num" style="font-family:'JetBrains Mono',monospace;">${fmtQty(idx.oiContracts)} (${fmtNum(idx.oiContracts)} lots)</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted, #94a3b8);">OI Change:</span>
                    <strong style="color:${idx.oiChangePct >= 0 ? '#38bdf8' : '#f59e0b'}; font-family:'JetBrains Mono',monospace;">${idx.oiChangePct >= 0 ? '+' : ''}${fmtNum(idx.oiChangePct)}%</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted, #94a3b8);">Rollover %:</span>
                    <strong style="color:#a855f7; font-family:'JetBrains Mono',monospace;">${fmtNum(idx.rolloverPct, 1)}%</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted, #94a3b8);">VWAP:</span>
                    <strong class="fut-idx-vwap-num" style="font-family:'JetBrains Mono',monospace;">₹${fmtNum(idx.vwap)}</strong>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      console.warn('Indices detail load error:', err);
    }
  }

  // --- Sub-Tab 4: MWPL & Ban Radar ---
  async function loadMwpl(forceRefresh = false) {
    try {
      const url = forceRefresh ? `/api/futures/mwpl?refresh=true&_t=${Date.now()}` : '/api/futures/mwpl';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      state.mwplData = data;

      // Ban Banner
      const banBox = document.getElementById('futMwplBanBanner');
      const bannedList = data.bannedStocks || data.banned || [];
      if (banBox) {
        if (bannedList.length > 0) {
          banBox.innerHTML = `
            <div style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:8px; padding:12px 16px;">
              <strong style="color:#ef4444; font-size:13px;">🚫 ${bannedList.length} Securities in Official F&O Ban Period (&gt;95% Limit)</strong>
              <p style="margin:4px 0 8px 0; font-size:11.5px; color:#fca5a5;">Exchange prohibited fresh position creation. Intraday squaring-off permitted only.</p>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${bannedList.map(s => `
                  <span class="fut-badge fut-badge-sb" style="font-size:11px; padding:4px 9px;">${s.symbol}: ${s.mwplPct}% MWPL</span>
                `).join('')}
              </div>
            </div>
          `;
        } else {
          banBox.innerHTML = `
            <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:10px 14px; font-size:12px; color:#34d399; display:flex; align-items:center; gap:8px;">
              <span style="font-size:15px;">✅</span>
              <span><strong>Zero Securities currently in F&O Ban.</strong> All ~200 NSE F&O contracts open for fresh trading positions.</span>
            </div>
          `;
        }
      }

      // Warning Alert List
      const alertBox = document.getElementById('futMwplAlertList');
      const alertList = data.alertStocks || data.alertZone || [];
      if (alertBox) {
        if (alertList.length > 0) {
          alertBox.innerHTML = alertList.map(s => `
            <div class="fut-alert-card" style="border:1px solid #f59e0b; border-radius:6px; padding:10px 12px; background:rgba(245,158,11,0.06);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong class="fut-alert-sym" style="font-size:13px; color:var(--text-primary, #f8fafc);">${s.symbol}</strong>
                <span style="color:#f59e0b; font-weight:800; font-family:'JetBrains Mono',monospace;">${s.mwplPct}%</span>
              </div>
              <div style="font-size:10.5px; color:var(--text-muted, #94a3b8); margin:4px 0;">Lot: ${s.lot || '--'} &bull; Headroom: ~${Math.max(50, Math.round((95 - s.mwplPct) * 120))} lots</div>
              <div class="fut-mwpl-pbar" style="margin-top:6px;">
                <div class="fut-mwpl-pfill" style="width:${s.mwplPct}%; background:#f59e0b;"></div>
              </div>
            </div>
          `).join('');
        } else {
          alertBox.innerHTML = `
            <div style="grid-column:1/-1; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px 16px; font-size:12px; color:var(--text-muted, #94a3b8);">
              🛡️ No securities currently in the 80%–95% pre-ban alert danger zone. All positions well within institutional position limits.
            </div>
          `;
        }
      }

      // Full MWPL Table
      const tb = document.getElementById('futMwplTableBody');
      const allStocks = data.allStocks || [];
      if (tb && allStocks.length > 0) {
        tb.innerHTML = allStocks.map((s, i) => {
          const mwpl = Number(s.mwplPct || 0);
          const col = mwpl >= 95 ? '#ef4444' : (mwpl >= 80 ? '#f59e0b' : '#10b981');
          const pr = s.price || s.futPrice || s.ltp || s.spotPrice || 0;
          const curOi = s.currentOi || s.openInterest || s.oiContracts || 0;
          const limOi = s.limitOi || (curOi && mwpl ? Math.round(curOi * 100 / mwpl) : '--');
          const st = s.status || s.mwplStatus || (mwpl >= 95 ? 'BANNED' : (mwpl >= 80 ? 'ALERT' : 'NORMAL'));
          return `
            <tr>
              <td style="color:#64748b;">${i + 1}</td>
              <td><strong style="color:var(--text-primary, #f8fafc);">${s.symbol}</strong></td>
              <td><span style="color:var(--text-muted, #94a3b8); font-size:11px;">${s.sector || 'F&O'}</span></td>
              <td style="text-align:right;">₹${fmtNum(pr)}</td>
              <td style="text-align:right;">${fmtQty(curOi)}</td>
              <td style="text-align:right; color:#94a3b8;">${typeof limOi === 'number' ? fmtQty(limOi) : limOi}</td>
              <td style="text-align:right; color:${col}; font-weight:800;">${fmtNum(mwpl, 1)}%</td>
              <td>
                <div class="fut-mwpl-pbar">
                  <div class="fut-mwpl-pfill" style="width:${Math.min(100, mwpl)}%; background:${col};"></div>
                </div>
              </td>
              <td style="text-align:center;">
                <span class="fut-badge ${st === 'BANNED' ? 'fut-badge-sb' : (st === 'ALERT' ? 'fut-badge-lu' : 'fut-badge-lb')}">${st}</span>
              </td>
            </tr>
          `;
        }).join('');
      }

    } catch (err) {
      console.warn('MWPL load error:', err);
    }
  }

  // --- Historical & Monthly Futures Rollover Matrix ---
  async function loadRolloverMatrix(forceRefresh = false) {
    const tbody = document.getElementById('futRolloverTableBody');
    const thead = document.getElementById('futRolloverTableHead');
    if (!tbody) return;

    if (!state.rolloverData || forceRefresh) {
      try {
        tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; color:#94a3b8;"><div class="spinner-small" style="margin-bottom:8px;"></div>Fetching Historical Rollover Matrix...</td></tr>`;
        const url = forceRefresh ? `/api/futures/rollover?refresh=true&_t=${Date.now()}` : '/api/futures/rollover';
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state.rolloverData = await res.json();
      } catch (err) {
        console.error('Error fetching rollover matrix:', err);
        tbody.innerHTML = `<tr><td colspan="17" style="text-align:center; padding:30px; color:#ef4444;">Failed to load Rollover Matrix (${err.message}). Click Refresh to retry.</td></tr>`;
        return;
      }
    }

    const data = state.rolloverData;
    if (!data || !data.ok) return;

    // Render Stats Strip
    const st = data.stats || {};
    const elAvg = document.getElementById('futRoAvgMarket');
    if (elAvg) elAvg.textContent = (st.avgMarketRollover ?? 86.5).toFixed(2) + '%';
    const elHigh = document.getElementById('futRoHighCount');
    if (elHigh) elHigh.textContent = st.highRolloverCount ?? '--';
    const elLow = document.getElementById('futRoLowCount');
    if (elLow) elLow.textContent = st.lowRolloverCount ?? '--';
    const elTot = document.getElementById('futRoTotalCount');
    if (elTot) elTot.textContent = st.totalTracked ?? (data.data ? data.data.length : '--');

    // Build Table Headers dynamically
    const months = data.months || [];
    if (thead) {
      let thHtml = `<th class="sticky-col sortable" data-sort="symbol">SYMBOL ${getSortIcon('symbol', state.rolloverSortBy, state.rolloverSortDir)}</th>`;
      months.forEach(m => {
        thHtml += `<th class="sortable text-right" data-sort="${m}">${m} ${getSortIcon(m, state.rolloverSortBy, state.rolloverSortDir)}</th>`;
      });
      thHtml += `<th class="sortable text-right" data-sort="avg3M">3M AVG ${getSortIcon('avg3M', state.rolloverSortBy, state.rolloverSortDir)}</th>`;
      thHtml += `<th class="sortable text-right" data-sort="currentRo">CURRENT ${getSortIcon('currentRo', state.rolloverSortBy, state.rolloverSortDir)}</th>`;
      thead.innerHTML = thHtml;

      // Attach sort handlers to new headers
      thead.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const col = th.dataset.sort;
          if (state.rolloverSortBy === col) {
            state.rolloverSortDir = state.rolloverSortDir === 'desc' ? 'asc' : 'desc';
          } else {
            state.rolloverSortBy = col;
            state.rolloverSortDir = (col === 'symbol') ? 'asc' : 'desc';
          }
          loadRolloverMatrix(false);
        };
      });
    }

    renderRolloverRows();
  }

  function getSortIcon(col, currentSort, currentDir) {
    if (col !== currentSort) return '<span class="sort-carat" style="opacity:0.3; margin-left:3px;">⇅</span>';
    return currentDir === 'desc' ? '<span class="sort-carat" style="color:#38bdf8; margin-left:3px;">▼</span>' : '<span class="sort-carat" style="color:#38bdf8; margin-left:3px;">▲</span>';
  }

  function renderRolloverRows() {
    const tbody = document.getElementById('futRolloverTableBody');
    if (!tbody || !state.rolloverData) return;

    let rows = state.rolloverData.data || [];
    const months = state.rolloverData.months || [];

    // Filter by search
    const q = (state.rolloverSearch || '').trim().toUpperCase();
    if (q) {
      rows = rows.filter(r => r.symbol.toUpperCase().includes(q) || (r.name && r.name.toUpperCase().includes(q)));
    }

    // Filter by sector
    if (state.rolloverSector && state.rolloverSector !== 'ALL') {
      const secU = state.rolloverSector.toUpperCase();
      if (secU === 'INDICES') {
        rows = rows.filter(r => r.isIndex);
      } else {
        rows = rows.filter(r => (r.sector || '').toUpperCase() === secU);
      }
    }

    // Filter by tier
    const latestMonth = (months && months[0]) || 'SEP 2026';
    if (state.rolloverTier === 'HIGH') {
      rows = rows.filter(r => {
        const v = (r.rollovers && typeof r.rollovers[latestMonth] === 'number') ? r.rollovers[latestMonth] : r.currentRo;
        return typeof v === 'number' && v >= 90.0;
      });
    } else if (state.rolloverTier === 'NORMAL') {
      rows = rows.filter(r => {
        const v = (r.rollovers && typeof r.rollovers[latestMonth] === 'number') ? r.rollovers[latestMonth] : r.currentRo;
        return typeof v === 'number' && v >= 75.0 && v < 90.0;
      });
    } else if (state.rolloverTier === 'LOW') {
      rows = rows.filter(r => {
        const v = (r.rollovers && typeof r.rollovers[latestMonth] === 'number') ? r.rollovers[latestMonth] : r.currentRo;
        return typeof v === 'number' && v < 75.0;
      });
    }

    // Sort
    const col = state.rolloverSortBy || 'symbol';
    const isDesc = state.rolloverSortDir === 'desc';
    rows = [...rows].sort((a, b) => {
      let vA, vB;
      if (col === 'symbol') {
        vA = a.symbol;
        vB = b.symbol;
        return isDesc ? vB.localeCompare(vA) : vA.localeCompare(vB);
      } else if (col === 'avg3M' || col === 'avg6M' || col === 'currentRo') {
        vA = Number(a[col]) || 0;
        vB = Number(b[col]) || 0;
      } else {
        // month column
        vA = a.rollovers ? a.rollovers[col] : null;
        vB = b.rollovers ? b.rollovers[col] : null;
        if (typeof vA !== 'number') vA = -1;
        if (typeof vB !== 'number') vB = -1;
      }
      return isDesc ? (vB - vA) : (vA - vB);
    });

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${months.length + 3}" style="text-align:center; padding:30px; color:#94a3b8;">No F&amp;O symbols found matching filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      let cells = '';
      // Sticky symbol cell
      cells += `
        <td class="sticky-col ro-sym-cell" onclick="window.futuresDesk.filterBySymbol('${r.symbol}')" title="Click to inspect ${r.symbol}">
          <div class="ro-sym-name">${r.symbol}</div>
          <div class="ro-sym-sector">${r.sector}</div>
        </td>
      `;

      // Monthly cells
      months.forEach(m => {
        const v = r.rollovers ? r.rollovers[m] : null;
        if (v === '-' || v === null || v === undefined) {
          cells += `<td class="ro-val-cell ro-dash">-</td>`;
        } else {
          const num = Number(v);
          let cls = 'ro-val-cell';
          if (num >= 90.0) cls += ' ro-high';
          else if (num >= 80.0) cls += ' ro-good';
          else if (num < 75.0) cls += ' ro-low';
          cells += `<td class="${cls}">${num.toFixed(4)}</td>`;
        }
      });

      // 3M AVG
      const a3 = Number(r.avg3M || 0);
      let a3Cls = 'ro-val-cell ro-avg';
      if (a3 >= 90.0) a3Cls += ' ro-high';
      else if (a3 < 75.0) a3Cls += ' ro-low';
      cells += `<td class="${a3Cls}">${a3 > 0 ? a3.toFixed(4) : '-'}</td>`;

      // CURRENT
      const cr = Number(r.currentRo || 0);
      cells += `<td class="ro-val-cell ro-curr" style="color:#38bdf8; font-weight:700;">${cr > 0 ? cr.toFixed(2) + '%' : '-'}</td>`;

      return `<tr>${cells}</tr>`;
    }).join('');
  }

  function exportRolloverCsv() {
    if (!state.rolloverData || !state.rolloverData.data) {
      alert('Rollover data not loaded yet.');
      return;
    }
    const months = state.rolloverData.months || [];
    const headers = ['SYMBOL', 'SECTOR', ...months, '3M_AVG', 'CURRENT_RO_PCT'];
    const csvRows = [headers.join(',')];

    state.rolloverData.data.forEach(r => {
      const row = [
        r.symbol,
        `"${r.sector || ''}"`,
        ...months.map(m => {
          const v = r.rollovers ? r.rollovers[m] : '-';
          return v;
        }),
        r.avg3M ?? '',
        r.currentRo ?? ''
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NSE_Futures_Rollover_Matrix_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Auto-Refresh Engine ---
  function setAutoRefresh(seconds) {
    state.autoRefreshSec = seconds;
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }

    const badge = document.getElementById('futAutoRefreshBadge');
    const cdText = document.getElementById('futCountdownText');

    if (seconds <= 0) {
      if (badge) {
        badge.style.opacity = '0.5';
        badge.style.borderColor = 'rgba(255,255,255,0.1)';
        badge.style.color = '#94a3b8';
      }
      if (cdText) cdText.textContent = 'OFF';
      return;
    }

    if (badge) {
      badge.style.opacity = '1';
      badge.style.borderColor = 'rgba(16,185,129,0.3)';
      badge.style.color = '#10b981';
    }

    state.countdownSec = seconds;
    if (cdText) cdText.textContent = state.countdownSec + 's';

    state.countdownTimer = setInterval(() => {
      state.countdownSec -= 1;
      if (state.countdownSec <= 0) {
        state.countdownSec = seconds;
        refreshCurrentSubTab();
        if (badge) {
          badge.classList.remove('tick-flash-up');
          void badge.offsetWidth;
          badge.classList.add('tick-flash-up');
          setTimeout(() => badge.classList.remove('tick-flash-up'), 800);
        }
      }
      if (cdText) cdText.textContent = state.countdownSec + 's';
    }, 1000);
  }

  function filterBySymbol(sym) {
    const sInput = document.getElementById('futSearchInput');
    if (sInput) {
      sInput.value = sym;
      state.search = sym.toUpperCase();
      switchSubTab('matrix');
    }
  }

  function inspectContract(sym) {
    // Quick search focus or popup
    filterBySymbol(sym);
  }

  // --- Initialization ---
  function init() {
    if (state.initialized) {
      refreshCurrentSubTab();
      return;
    }
    state.initialized = true;

    // Subtab Button Listeners
    document.querySelectorAll('.fut-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) switchSubTab(tab);
      });
    });

    // Sector Filter Pills
    document.querySelectorAll('.fut-sec-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.fut-sec-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.sector = pill.dataset.sector || 'ALL';
        refreshCurrentSubTab();
      });
    });

    // Signal Filter Pills
    document.querySelectorAll('.fut-sig-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.fut-sig-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.signal = pill.dataset.signal || 'ALL';
        refreshCurrentSubTab();
      });
    });

    // Search Input Listener
    const searchInput = document.getElementById('futSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.search = e.target.value.trim().toUpperCase();
        if (state.activeSubTab === 'matrix') {
          loadMatrix();
        }
      });
    }

    // Refresh Button
    const refBtn = document.getElementById('futBtnRefresh');
    if (refBtn) {
      refBtn.addEventListener('click', async () => {
        if (state.isManualRefreshing) return;
        state.isManualRefreshing = true;
        const origHtml = refBtn.innerHTML;
        refBtn.disabled = true;
        refBtn.style.opacity = '0.75';
        refBtn.innerHTML = '<span style="display:inline-block; animation: futRotate 0.8s linear infinite;">🔄</span> Refreshing...';

        try {
          const syncP = fetch('/api/futures/sync-bhavcopy?today=1').catch(() => null);
          await refreshCurrentSubTab(true);
          await syncP;
          await loadBenchmarkRibbon(true);
          refBtn.innerHTML = '✅ Updated!';
        } catch (err) {
          console.warn('Manual refresh error:', err);
          refBtn.innerHTML = '⚠️ Error';
        } finally {
          setTimeout(() => {
            refBtn.innerHTML = origHtml;
            refBtn.disabled = false;
            refBtn.style.opacity = '1';
            state.isManualRefreshing = false;
          }, 1200);
        }
      });
    }

    // Auto-Refresh Select
    const autoRefSelect = document.getElementById('futAutoRefreshSelect');
    if (autoRefSelect) {
      autoRefSelect.value = "5";
      autoRefSelect.addEventListener('change', (e) => {
        setAutoRefresh(Number(e.target.value) || 0);
      });
    }

    // Sorting in Matrix Table
    document.querySelectorAll('#futMatrixTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (state.sortBy === col) {
          state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
          state.sortBy = col;
          state.sortDir = 'desc';
        }
        loadMatrix();
      });
    });

    // Rollover Search Input Listener
    const roSearchInput = document.getElementById('futRolloverSearch');
    const roClearBtn = document.getElementById('futRolloverClearSearch');
    if (roSearchInput) {
      roSearchInput.addEventListener('input', (e) => {
        state.rolloverSearch = e.target.value.trim().toUpperCase();
        if (roClearBtn) roClearBtn.style.display = state.rolloverSearch ? 'block' : 'none';
        renderRolloverRows();
      });
    }
    if (roClearBtn && roSearchInput) {
      roClearBtn.addEventListener('click', () => {
        roSearchInput.value = '';
        state.rolloverSearch = '';
        roClearBtn.style.display = 'none';
        renderRolloverRows();
      });
    }

    // Rollover Sector Dropdown
    const roSectorSelect = document.getElementById('futRolloverSectorSelect');
    if (roSectorSelect) {
      roSectorSelect.addEventListener('change', (e) => {
        state.rolloverSector = e.target.value || 'ALL';
        renderRolloverRows();
      });
    }

    // Rollover Tier Dropdown
    const roTierSelect = document.getElementById('futRolloverTierSelect');
    if (roTierSelect) {
      roTierSelect.addEventListener('change', (e) => {
        state.rolloverTier = e.target.value || 'ALL';
        renderRolloverRows();
      });
    }

    // Rollover Export CSV Button
    const roExportBtn = document.getElementById('futRoExportCsvBtn');
    if (roExportBtn) {
      roExportBtn.addEventListener('click', () => {
        exportRolloverCsv();
      });
    }

    // Rollover Refresh Button
    const roRefBtn = document.getElementById('futRoRefreshBtn');
    if (roRefBtn) {
      roRefBtn.addEventListener('click', () => {
        loadRolloverMatrix(true);
      });
    }

    // Rollover Sync Bhavcopy Button
    const roSyncBtn = document.getElementById('futRoSyncBhavBtn');
    if (roSyncBtn) {
      roSyncBtn.addEventListener('click', async () => {
        roSyncBtn.disabled = true;
        const origText = roSyncBtn.innerHTML;
        roSyncBtn.innerHTML = '⏳ Syncing...';
        try {
          const res = await fetch('/api/futures/sync-bhavcopy');
          const data = await res.json();
          if (data && data.ok) {
            alert(`[SUCCESS] Official NSE FO Bhavcopy synced successfully!\nDate: ${data.dateDisplay || data.date}\nTotal Symbols: ${data.totalSymbols}\nSource: ${data.source}`);
            loadRolloverMatrix(true);
          } else {
            alert(`Sync notice: ${data.message || 'No newer Bhavcopy found'}`);
          }
        } catch (err) {
          alert('Error syncing Bhavcopy: ' + err.message);
        } finally {
          roSyncBtn.disabled = false;
          roSyncBtn.innerHTML = origText;
        }
      });
    }

    // Benchmark Index Futures Strip Toggle
    const idxHeader = document.getElementById('futIndexStripHeader');
    if (idxHeader) {
      idxHeader.addEventListener('click', toggleFutIndexStrip);
    }

    // Start 5s Live Auto-Refresh Immediately
    setAutoRefresh(5);

    // Initial View (Detect subview from URL pathname if specified)
    const initPath = (window.location.pathname || '').toLowerCase();
    if (initPath.includes('/rollover')) {
      state.activeSubTab = 'rollover';
    } else if (initPath.includes('/buildup')) {
      state.activeSubTab = 'buildup';
    } else if (initPath.includes('/heatmap')) {
      state.activeSubTab = 'heatmap';
    } else if (initPath.includes('/mwpl')) {
      state.activeSubTab = 'mwpl';
    } else if (initPath.includes('/indices')) {
      state.activeSubTab = 'indices';
    }
    switchSubTab(state.activeSubTab);
  }

  function toggleFutIndexStrip() {
    const grid = document.getElementById('futIndexCardsGrid');
    const icon = document.getElementById('futIndexStripIcon');
    const badge = document.getElementById('futIndexStripBadge');
    const header = document.getElementById('futIndexStripHeader');
    if (!grid) return;
    const isHidden = window.getComputedStyle(grid).display === 'none' || grid.style.display === 'none';
    if (isHidden) {
      grid.style.display = 'grid';
      if (icon) {
        icon.textContent = '▼';
        icon.style.color = '#10b981';
      }
      if (badge) {
        badge.textContent = 'COLLAPSE';
        badge.style.color = '#10b981';
        badge.style.borderColor = 'rgba(16,185,129,0.3)';
        badge.style.background = 'rgba(16,185,129,0.12)';
      }
      if (header) header.style.marginBottom = '10px';
    } else {
      grid.style.display = 'none';
      if (icon) {
        icon.textContent = '▶';
        icon.style.color = '#38bdf8';
      }
      if (badge) {
        badge.textContent = 'CLICK TO EXPAND';
        badge.style.color = '#38bdf8';
        badge.style.borderColor = 'rgba(56,189,248,0.3)';
        badge.style.background = 'rgba(56,189,248,0.12)';
      }
      if (header) header.style.marginBottom = '0px';
    }
  }

  window.toggleFutIndexStrip = toggleFutIndexStrip;

  // Export to global scope
  window.futuresDesk = {
    init,
    toggleFutIndexStrip,
    switchSubTab,
    refreshCurrentSubTab,
    filterBySymbol,
    inspectContract,
    loadBenchmarkRibbon,
    loadMatrix,
    loadBuildupView,
    loadHeatmapView,
    loadIndicesDetailView,
    loadMwpl,
    loadRolloverMatrix,
    exportRolloverCsv
  };

  // Auto-init on load if panel is active
  document.addEventListener('DOMContentLoaded', () => {
    const p = document.getElementById('panelFutures');
    if (p && (p.classList.contains('active') || p.style.display !== 'none')) {
      init();
    }
  });
})();
