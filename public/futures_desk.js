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
    moversCategory: 'all',
    moversLimit: 5,
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
    openInterest: {
      title: "FUTURE OPEN INTEREST & BUILDUP",
      countBadge: "260+ CONTRACTS",
      icon: "⚡",
      desc: "Interactive EOD & real-time multi-panel futures chart, open interest buildup dynamics & option chain max pain.",
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
    if (tabName === 'openinterest' || tabName === 'open-interest' || tabName === 'oi' || tabName === 'future-oi' || tabName === 'future-open-interest') tabName = 'openInterest';

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

    const views = ['matrix', 'openInterest', 'indices', 'buildup', 'heatmap', 'mwpl', 'rollover'];
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
        const futSubUrl = tabName === "matrix" ? "/futures" : (tabName === "openInterest" ? "/futures/open-interest" : `/futures/${tabName}`);
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
    else if (state.activeSubTab === 'openInterest') p2 = loadFutureOpenInterestView(forceRefresh);
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

      // Render Opstra-Style Market Movers & Buzzers
      renderFuturesMovers(data.marketMovers || {});

    } catch (err) {
      console.warn('Futures ribbon load error:', err);
    }
  }

  // --- Opstra-Style Derivatives Buzzers & Movers Matrix Definitions ---
  const MOVER_CARDS_DEF = [
    {
      id: 'gainers',
      cat: 'price',
      title: 'Top Price Gainers',
      icon: '🚀',
      badge: 'BULLISH',
      badgeCls: 'fut-card-badge-bull',
      borderAccent: '#10b981',
      dataKey: 'topGainers',
      metricHeader: 'Day Chg %',
      renderMetric: (r) => {
        const chg = r.priceChangePct ?? r.changePct ?? 0;
        return `<span class="fut-mover-val-pill fut-pill-pos">+${fmtNum(chg)}%</span>`;
      },
      renderSub: (r) => `₹${fmtNum(r.volumeValueCr, 1)} Cr Vol`
    },
    {
      id: 'losers',
      cat: 'price',
      title: 'Top Price Losers',
      icon: '🔻',
      badge: 'BEARISH',
      badgeCls: 'fut-card-badge-bear',
      borderAccent: '#ef4444',
      dataKey: 'topLosers',
      metricHeader: 'Day Chg %',
      renderMetric: (r) => {
        const chg = r.priceChangePct ?? r.changePct ?? 0;
        return `<span class="fut-mover-val-pill fut-pill-neg">${fmtNum(chg)}%</span>`;
      },
      renderSub: (r) => `₹${fmtNum(r.volumeValueCr, 1)} Cr Vol`
    },
    {
      id: 'oiGainers',
      cat: 'oi',
      title: 'Top OI Gainers',
      icon: '🟢',
      badge: 'OI SPIKE',
      badgeCls: 'fut-card-badge-oi-up',
      borderAccent: '#06b6d4',
      dataKey: 'topOiGainers',
      metricHeader: 'OI Surge %',
      renderMetric: (r) => {
        const chg = r.oiChangePct ?? 0;
        const sign = chg >= 0 ? '+' : '';
        return `<span class="fut-mover-val-pill fut-pill-pos">${sign}${fmtNum(chg)}%</span>`;
      },
      renderSub: (r) => `₹${fmtNum(r.oiValueCr, 0)} Cr OI`
    },
    {
      id: 'oiLosers',
      cat: 'oi',
      title: 'Top OI Losers',
      icon: '🔴',
      badge: 'UNWINDING',
      badgeCls: 'fut-card-badge-oi-down',
      borderAccent: '#f59e0b',
      dataKey: 'topOiLosers',
      metricHeader: 'OI Drop %',
      renderMetric: (r) => {
        const chg = r.oiChangePct ?? 0;
        return `<span class="fut-mover-val-pill fut-pill-warn">${fmtNum(chg)}%</span>`;
      },
      renderSub: (r) => `₹${fmtNum(r.oiValueCr, 0)} Cr OI`
    },
    {
      id: 'volume',
      cat: 'volume',
      title: 'Top Volume Buzzers',
      icon: '⚡',
      badge: 'SURGE',
      badgeCls: 'fut-card-badge-vol',
      borderAccent: '#3b82f6',
      dataKey: 'topVolumeBuzzers',
      metricHeader: 'Turnover',
      renderMetric: (r) => {
        const volCr = r.volumeValueCr ?? 0;
        return `<span class="fut-mover-val-pill fut-pill-blue">₹${fmtNum(volCr, 1)} Cr</span>`;
      },
      renderSub: (r) => `${fmtQty(r.volumeContracts)} Lots`
    },
    {
      id: 'ivGainers',
      cat: 'iv',
      title: 'Top IV Gainers',
      icon: '🌊',
      badge: 'VOL SPIKE',
      badgeCls: 'fut-card-badge-iv-up',
      borderAccent: '#a855f7',
      dataKey: 'topIvGainers',
      metricHeader: 'IV / IV Chg',
      renderMetric: (r) => {
        const ivChg = r.ivChangePct ?? 0;
        const sign = ivChg >= 0 ? '+' : '';
        return `<span class="fut-mover-val-pill fut-pill-purple">IV ${fmtNum(r.iv || 0, 1)}% (${sign}${fmtNum(ivChg, 1)}%)</span>`;
      },
      renderSub: (r) => {
        const chg = r.priceChangePct ?? 0;
        const sign = chg >= 0 ? '+' : '';
        return `${sign}${fmtNum(chg, 1)}% Price`;
      }
    },
    {
      id: 'ivLosers',
      cat: 'iv',
      title: 'Top IV Losers',
      icon: '📉',
      badge: 'VOL CRUSH',
      badgeCls: 'fut-card-badge-iv-down',
      borderAccent: '#14b8a6',
      dataKey: 'topIvLosers',
      metricHeader: 'IV / IV Crush',
      renderMetric: (r) => {
        const ivChg = r.ivChangePct ?? 0;
        return `<span class="fut-mover-val-pill fut-pill-teal">IV ${fmtNum(r.iv || 0, 1)}% (${fmtNum(ivChg, 1)}%)</span>`;
      },
      renderSub: (r) => {
        const chg = r.priceChangePct ?? 0;
        const sign = chg >= 0 ? '+' : '';
        return `${sign}${fmtNum(chg, 1)}% Price`;
      }
    }
  ];

  function renderFuturesMovers(moversData) {
    const grid = document.getElementById('futMoversGrid');
    if (!grid) return;
    if (!moversData || Object.keys(moversData).length === 0) {
      if (state.dashboardData && state.dashboardData.marketMovers) {
        moversData = state.dashboardData.marketMovers;
      } else {
        return;
      }
    }

    const currentCat = state.moversCategory || 'all';
    const limit = state.moversLimit || 5;

    // Filter cards by category
    const activeDefs = MOVER_CARDS_DEF.filter(d => {
      if (currentCat === 'all') return true;
      return d.cat === currentCat;
    });

    // Update grid column class based on active category
    grid.className = `fut-movers-grid cat-${currentCat}`;

    grid.innerHTML = activeDefs.map(def => {
      const items = (moversData[def.dataKey] || []).slice(0, limit);
      
      let rowsHtml = '';
      if (items.length === 0) {
        rowsHtml = `<div class="fut-mover-empty">No active contracts found for this scan.</div>`;
      } else {
        rowsHtml = items.map((r, idx) => {
          const rank = idx + 1;
          const pChg = r.priceChangePct ?? r.changePct ?? 0;
          const bCode = r.buildupCode || (pChg >= 0 ? 'LB' : 'SB');
          const bBadgeCls = bCode === 'LB' ? 'fut-badge-lb' : (bCode === 'SB' ? 'fut-badge-sb' : (bCode === 'SC' ? 'fut-badge-sc' : 'fut-badge-lu'));
          const sec = r.sector && r.sector !== 'Others' ? r.sector : '';

          return `
            <div class="fut-mover-row" onclick="window.futuresDesk.filterBySymbol('${r.symbol}')" title="Click to inspect ${r.symbol} in Master Matrix">
              <span class="fut-mover-rank">${rank}</span>
              <div class="fut-mover-sym-col">
                <span class="fut-mover-sym">${r.symbol}</span>
                ${sec ? `<span class="fut-mover-sec">${sec}</span>` : ''}
              </div>
              <div class="fut-mover-ltp-col">
                <span class="fut-mover-ltp">₹${fmtNum(r.futPrice || r.ltp)}</span>
              </div>
              <div class="fut-mover-metric-col">
                ${def.renderMetric(r)}
                <span class="fut-mover-metric-sub">${def.renderSub(r)}</span>
              </div>
              <div class="fut-mover-tag-col">
                <span class="fut-badge ${bBadgeCls}" style="padding:2px 5px; font-size:9px;">${bCode}</span>
              </div>
            </div>
          `;
        }).join('');
      }

      return `
        <div class="fut-mover-card" style="border-top: 3px solid ${def.borderAccent};">
          <div class="fut-mover-card-head">
            <div class="fut-mover-card-title-box">
              <span class="fut-mover-card-icon">${def.icon}</span>
              <div>
                <span class="fut-mover-card-title">${def.title}</span>
                <span class="fut-mover-card-sub">${items.length} Active Contracts</span>
              </div>
            </div>
            <span class="fut-card-badge ${def.badgeCls}">${def.badge}</span>
          </div>
          <div class="fut-mover-card-cols-hdr">
            <span style="width:18px;">#</span>
            <span style="flex:1.2;">Contract</span>
            <span style="flex:1; text-align:right;">LTP (₹)</span>
            <span style="flex:1.4; text-align:right;">${def.metricHeader}</span>
            <span style="width:28px; text-align:center;">Flow</span>
          </div>
          <div class="fut-mover-rows-wrap">
            ${rowsHtml}
          </div>
        </div>
      `;
    }).join('');
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

  // --- Sub-Tab 3: Future Buildup Quadrants & Institutional Movers ---
  async function loadBuildupView(forceRefresh = false) {
    try {
      const url = forceRefresh ? `/api/futures/buildup?refresh=true&_t=${Date.now()}` : '/api/futures/buildup';
      const resB = await fetch(url);
      if (resB.ok) {
        const dataB = await resB.json();
        renderQuadrants(dataB);
      }
      // Also render High-Velocity Market Movers & Buzzers in Buildup view
      if (state.dashboardData && state.dashboardData.marketMovers) {
        renderFuturesMovers(state.dashboardData.marketMovers);
      } else {
        const dUrl = forceRefresh ? `/api/futures/dashboard?refresh=true&_t=${Date.now()}` : '/api/futures/dashboard';
        fetch(dUrl).then(r => r.json()).then(d => {
          if (d && d.marketMovers) renderFuturesMovers(d.marketMovers);
        }).catch(() => {});
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
      const asOf = data.asOfDate ? `NSE Official &bull; ${data.asOfDate}` : 'NSE Official';
      if (banBox) {
        if (bannedList.length > 0) {
          banBox.innerHTML = `
            <div style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:8px; padding:12px 16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:6px;">
                <strong style="color:#ef4444; font-size:13.5px;">🚫 ${bannedList.length} Securities in Official NSE F&amp;O Ban Period (&gt;95% Limit)</strong>
                <span style="font-size:11px; color:#fca5a5; font-family:'JetBrains Mono',monospace;">${asOf}</span>
              </div>
              <p style="margin:2px 0 10px 0; font-size:11.5px; color:#fca5a5;">Exchange prohibited fresh position creation. Intraday squaring-off permitted only.</p>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${bannedList.map(s => `
                  <span class="fut-badge fut-badge-sb" style="font-size:11.5px; padding:5px 10px; font-weight:700;">${s.symbol}: ${s.mwplPct}% MWPL</span>
                `).join('')}
              </div>
            </div>
          `;
        } else {
          banBox.innerHTML = `
            <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:10px 14px; font-size:12px; color:#34d399; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:15px;">✅</span>
                <span><strong>Zero Securities currently in F&amp;O Ban.</strong> All ~213 NSE F&amp;O contracts open for fresh trading positions.</span>
              </div>
              <span style="font-size:11px; color:#6ee7b7; font-family:'JetBrains Mono',monospace;">${asOf}</span>
            </div>
          `;
        }
      }

      // Warning Alert List
      const alertBox = document.getElementById('futMwplAlertList');
      const alertList = data.alertStocks || data.alertZone || [];
      if (alertBox) {
        if (alertList.length > 0) {
          alertBox.innerHTML = alertList.map(s => {
            const hrStr = s.headroom || (s.headroomLots ? `${fmtQty(s.headroomLots)} lots` : `~${Math.max(50, Math.round((95 - s.mwplPct) * 120))} lots`);
            return `
              <div class="fut-alert-card" style="border:1px solid #f59e0b; border-radius:6px; padding:10px 12px; background:rgba(245,158,11,0.06);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong class="fut-alert-sym" style="font-size:13px; color:var(--text-primary, #f8fafc);">${s.symbol}</strong>
                  <span style="color:#f59e0b; font-weight:800; font-family:'JetBrains Mono',monospace;">${s.mwplPct}%</span>
                </div>
                <div style="font-size:10.5px; color:var(--text-muted, #94a3b8); margin:4px 0;">Lot: ${s.lot || '--'} &bull; Headroom: ${hrStr}</div>
                <div class="fut-mwpl-pbar" style="margin-top:6px;">
                  <div class="fut-mwpl-pfill" style="width:${s.mwplPct}%; background:#f59e0b;"></div>
                </div>
              </div>
            `;
          }).join('');
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
          const limOi = s.limitOi || s.mwplLimit || (curOi && mwpl ? Math.round(curOi * 100 / mwpl) : '--');
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

  // =========================================================================
  // --- SUBTAB: FUTURE OPEN INTEREST & CANVAS TERMINAL ENGINE ---
  // =========================================================================

  const oiState = {
    currentSymbol: 'NIFTY',
    symbolMeta: { s: 'NIFTY', n: 'Nifty 50 Futures', k: 'Index', st: 100 },
    symbolsList: [],
    allBars: [],
    visibleStart: 0,
    visibleCount: 9999,
    hoverX: -1,
    hoverY: -1,
    drag: null,
    optionChain: [],
    atmStrike: 0,
    maxPain: 0,
    chainPcr: 1.0,
    indicators: {
      line: false,
      m20: true,
      m50: false,
      bb: false,
      sr: true,
      rsi: true,
      iv: true,
      dv: true,
      pcr: true
    },
    hiddenCategories: [false, false, false, false],
    isLoading: false,
    initializedEvents: false,
    analyticsData: null
  };

  const OI_COLORS = ['#10b981', '#ef4444', '#06b6d4', '#f59e0b']; // LB (green), SB (red), SC (cyan), LU (amber)
  const OI_NAMES = ['Long Buildup', 'Short Buildup', 'Short Covering', 'Long Unwinding'];

  function getOiColor(k) {
    const isLight = document.body.classList.contains('light-theme') || document.documentElement.getAttribute('data-theme') === 'light';
    switch (k) {
      case '--bg': return isLight ? '#ffffff' : '#0e1117';
      case '--card': return isLight ? '#f4f5f8' : '#171b24';
      case '--tx': return isLight ? '#1e293b' : '#f1f5f9';
      case '--mu': return isLight ? '#64748b' : '#94a3b8';
      case '--gr': return isLight ? '#e2e8f0' : '#1e293b';
      case '--up': return '#10b981';
      case '--dn': return '#ef4444';
      case '--lu': return '#06b6d4';
      case '--lw': return '#f59e0b';
      case '--vol': return '#6366f1';
      case '--ac': return '#38bdf8';
      default: return '#94a3b8';
    }
  }

  function formatOiDate(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatOiDateShort(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  async function loadFutureOpenInterestView(forceRefresh = false) {
    initFutureOiEvents();
    if (!oiState.symbolsList || oiState.symbolsList.length === 0) {
      await fetchFutureOiSymbols();
    }
    await fetchFutureOiData(oiState.currentSymbol, forceRefresh);
  }

  async function fetchFutureOiSymbols() {
    try {
      const res = await fetch('/api/futures/open-interest/symbols');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.symbols) {
        oiState.symbolsList = data.symbols;
        renderFutureOiWatchlist();
      }
    } catch (err) {
      console.warn('Error fetching OI symbols:', err);
    }
  }

  async function fetchFutureOiData(symbol, forceRefresh = false) {
    if (oiState.isLoading) return;
    oiState.isLoading = true;
    oiState.currentSymbol = symbol;

    const helpMsg = document.getElementById('futOiHelpMsg');
    if (helpMsg) helpMsg.textContent = '⏳ Loading analytics for ' + symbol + '...';

    try {
      const url = `/api/futures/open-interest?symbol=${encodeURIComponent(symbol)}${forceRefresh ? '&refresh=true&_t=' + Date.now() : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !data.ok) throw new Error(data ? data.error || 'Failed to compute analytics' : 'No data');

      oiState.analyticsData = data;
      oiState.symbolMeta = {
        s: data.symbol,
        n: data.name || data.symbol,
        k: data.kind || (['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50', 'SENSEX', 'BANKEX'].includes(data.symbol) ? 'Index' : 'Stock'),
        st: data.strikeStep || 50
      };

      const rawSessions = data.sessions || data.timeline || [];
      const sessions = rawSessions.map(s => {
        let dtObj = null;
        if (s.date && typeof s.date === 'string' && s.date.length === 8) {
          dtObj = new Date(Number(s.date.slice(0, 4)), Number(s.date.slice(4, 6)) - 1, Number(s.date.slice(6, 8)));
        } else if (s.dt) {
          dtObj = new Date(s.dt);
        }
        if (!dtObj || isNaN(dtObj.getTime())) dtObj = new Date();
        return {
          dt: dtObj,
          o: Number(s.o || 0),
          h: Number(s.h || 0),
          l: Number(s.l || 0),
          c: Number(s.c || 0),
          v: Number(s.v || 0),
          oi: Number(s.oi || 0),
          iv: s.iv !== null && s.iv !== undefined ? Number(s.iv) : 15.0,
          dv: s.dv !== null && s.dv !== undefined ? Number(s.dv) : 50.0,
          deliv_qty: s.deliv_qty !== null && s.deliv_qty !== undefined ? Number(s.deliv_qty) : 0,
          pcr: s.pcr !== null && s.pcr !== undefined ? Number(s.pcr) : 1.0,
          m20: s.m20 !== null && s.m20 !== undefined ? Number(s.m20) : null,
          m50: s.m50 !== null && s.m50 !== undefined ? Number(s.m50) : null,
          bu: s.bu !== null && s.bu !== undefined ? Number(s.bu) : null,
          bl: s.bl !== null && s.bl !== undefined ? Number(s.bl) : null,
          rsi: s.rsi !== null && s.rsi !== undefined ? Number(s.rsi) : null,
          cat: s.cat !== null && s.cat !== undefined ? Number(s.cat) : 0
        };
      });

      oiState.allBars = sessions;
      oiState.optionChain = (data.optionChain && data.optionChain.strikes) ? data.optionChain.strikes : (Array.isArray(data.optionChain) ? data.optionChain : []);
      oiState.atmStrike = data.atmStrike || (data.optionChain && data.optionChain.atm) || 0;
      oiState.maxPain = data.maxPain || (data.optionChain && data.optionChain.maxPain) || 0;
      oiState.chainPcr = data.pcr || (data.optionChain && data.optionChain.pcr) || 1.0;

      oiState.visibleCount = Math.min(oiState.visibleCount || 9999, sessions.length);
      oiState.visibleStart = Math.max(0, sessions.length - oiState.visibleCount);

      const ttlEl = document.getElementById('futOiTitle');
      if (ttlEl) ttlEl.textContent = `${data.symbol} · ${data.name || 'Futures Analytics & OI Buildup'}`;
      const kindBadge = document.getElementById('futOiKindBadge');
      if (kindBadge) kindBadge.textContent = oiState.symbolMeta.k.toUpperCase();

      renderFutureOiWatchlist();
      drawFutureOiCanvas();
      drawFutureOiOcCanvas();

      if (helpMsg) helpMsg.textContent = `💡 ${sessions.length} sessions loaded. Drag = Pan • Scroll = Zoom`;
    } catch (err) {
      console.error('Error loading OI data:', err);
      if (helpMsg) {
        const isBusy = (err.message || '').includes('503') || (err.message || '').includes('Unavailable') || (err.message || '').includes('Failed to fetch') || (err.message || '').includes('JSON');
        helpMsg.textContent = isBusy ? `⏳ Exchange data service syncing session data. Please retry in a moment.` : `⚠️ Notice: ${err.message}`;
      }
    } finally {
      oiState.isLoading = false;
    }
  }

  function renderFutureOiWatchlist() {
    const ribbon = document.getElementById('futOiWatchlistRibbon');
    if (!ribbon) return;

    const defaultSymbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'SBIN', 'BHARTIARTL', 'LT', 'AXISBANK', 'TATAMOTORS', 'TATASTEEL'];
    
    const list = defaultSymbols.map(sym => {
      const found = (oiState.symbolsList || []).find(x => x.symbol === sym);
      return found || { symbol: sym, ltp: 0, changePct: 0 };
    });

    ribbon.innerHTML = list.map(item => {
      const isSel = (oiState.currentSymbol === item.symbol);
      const isPos = (item.changePct || 0) >= 0;
      const chgColor = isSel ? '#ffffff' : (isPos ? '#10b981' : '#ef4444');
      const sign = isPos ? '+' : '';
      const priceStr = item.ltp ? ` ₹${fmtNum(item.ltp, 1)}` : '';
      const chgStr = item.changePct ? ` <span style="color:${chgColor}; font-weight:700;">${sign}${fmtNum(item.changePct, 2)}%</span>` : '';

      return `
        <button type="button" class="fut-oi-b ${isSel ? 'on' : ''}" data-s="${item.symbol}">
          <b>${item.symbol}</b>${priceStr}${chgStr}
        </button>
      `;
    }).join('');
  }

  function getOiSupportResistance(vis, lastClose) {
    const m = vis.length;
    if (m < 10) return [];
    const P = [];
    for (let i = 4; i < m - 4; i++) {
      const w = vis.slice(i - 4, i + 5);
      if (vis[i].h === Math.max(...w.map(d => d.h))) P.push(vis[i].h);
      if (vis[i].l === Math.min(...w.map(d => d.l))) P.push(vis[i].l);
    }
    P.sort((a, b) => a - b);
    const L = [];
    P.forEach(p => {
      const q = L[L.length - 1];
      if (q && Math.abs(p - q.p) / q.p < 0.005) {
        q.p = (q.p * q.n + p) / (q.n + 1);
        q.n++;
      } else {
        L.push({ p, n: 1 });
      }
    });
    return [
      ...L.filter(x => x.p < lastClose).slice(-2),
      ...L.filter(x => x.p >= lastClose).slice(0, 2)
    ].map(x => ({ p: x.p, r: x.p >= lastClose }));
  }

  function drawFutureOiCanvas() {
    const cv = document.getElementById('futOiCanvas');
    if (!cv) return;
    const cx = cv.getContext('2d');
    if (!cx) return;

    if (!oiState.allBars || oiState.allBars.length === 0) {
      cx.clearRect(0, 0, cv.width, cv.height);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const isStock = oiState.symbolMeta.k === 'Stock';
    const exPanels = [
      oiState.indicators.rsi,
      oiState.indicators.dv && isStock,
      oiState.indicators.iv,
      oiState.indicators.pcr
    ].filter(Boolean).length;

    const baseH = 430 + exPanels * 90;
    cv.style.height = baseH + 'px';
    const W = cv.clientWidth || 800;
    const H = cv.clientHeight || baseH;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const PL = 60, PR = 65, PT = 8;
    const wt = [
      5.0, // 0: Price Candles/Line
      1.2, // 1: Volume
      1.5, // 2: OI Bars
      oiState.indicators.rsi ? 1.3 : 0, // 3: RSI
      (oiState.indicators.dv && isStock) ? 1.3 : 0, // 4: Delivery %
      oiState.indicators.iv ? 1.3 : 0, // 5: IV
      oiState.indicators.pcr ? 1.3 : 0 // 6: PCR
    ];
    const tw = wt.reduce((a, b) => a + b, 0);
    const f = wt.map(x => x / tw);
    const availableH = H - PT - 24 - 12 - wt.filter(Boolean).length * 4;
    let currY = PT;
    const PN = f.map(x => {
      const r = [currY, currY + x * availableH];
      currY += x * availableH + (x > 0 ? 4 : 0);
      return r;
    });

    const vis = oiState.allBars.slice(oiState.visibleStart, oiState.visibleStart + oiState.visibleCount);
    if (!vis.length) return;
    const m = vis.length;
    const x0 = PL, x1 = W - PR;
    const bw = Math.max(1, (x1 - x0) / m);
    const X = i => x0 + bw * (i + 0.5);

    cx.clearRect(0, 0, W, H);
    cx.font = '11px system-ui, -apple-system, sans-serif';

    const grCol = getOiColor('--gr');
    const muCol = getOiColor('--mu');
    const txCol = getOiColor('--tx');
    const bgCol = getOiColor('--bg');
    const cardCol = getOiColor('--card');

    let mn = Math.min(...vis.map(d => d.l));
    let mx = Math.max(...vis.map(d => d.h));
    if (oiState.indicators.bb) {
      vis.forEach(d => {
        if (d.bu) mx = Math.max(mx, d.bu);
        if (d.bl) mn = Math.min(mn, d.bl);
      });
    }
    const pd = Math.max(1, (mx - mn) * 0.05);
    mn -= pd;
    mx += pd;

    const vm = Math.max(1, ...vis.map(d => d.v)) * 1.05;
    const omn = 0;
    const omx = Math.max(1, ...vis.map(d => d.oi)) * 1.08;

    const Y = (v, r, a, b) => {
      const span = b - a || 1;
      return r[1] - ((v - a) / span) * (r[1] - r[0]);
    };
    const yp = v => Y(v, PN[0], mn, mx);

    // Grid lines and price axis labels
    cx.strokeStyle = grCol;
    cx.fillStyle = muCol;
    cx.textAlign = 'right';
    for (let k = 0; k <= 4; k++) {
      const v = mn + ((mx - mn) * k) / 4;
      const y = yp(v);
      cx.beginPath();
      cx.moveTo(x0, y);
      cx.lineTo(x1, y);
      cx.stroke();
      cx.fillText(fmtNum(v, (v < 100 ? 2 : (v < 1000 ? 1 : 0))), x0 - 6, y + 4);
    }

    // Volume axis labels (right)
    cx.textAlign = 'left';
    [0, 1].forEach(frac => {
      const val = vm * frac;
      const valStr = val >= 1e7 ? (val / 1e7).toFixed(1) + 'Cr' : (val / 1e6).toFixed(1) + 'M';
      cx.fillText(valStr, x1 + 6, Y(val, PN[1], 0, vm) + 4);
    });

    // OI axis labels (right)
    [0, 0.5, 1].forEach(frac => {
      const val = omx * frac;
      const valStr = val >= 1e7 ? (val / 1e7).toFixed(1) + 'Cr' : (val / 1e6).toFixed(0) + 'M';
      cx.fillText(valStr, x1 + 6, Y(val, PN[2], 0, omx) + 4);
    });

    // Date X-axis labels
    cx.textAlign = 'center';
    let lk = -1;
    const stStep = Math.max(1, Math.round(m / 8));
    vis.forEach((d, i) => {
      const k = Math.floor(i / stStep);
      if (k !== lk) {
        lk = k;
        cx.fillText(formatOiDateShort(d.dt), X(i), H - 6);
      }
    });

    // Support and Resistance Lines
    if (oiState.indicators.sr) {
      const srLines = getOiSupportResistance(vis, vis[vis.length - 1].c);
      srLines.forEach(l => {
        const y = yp(l.p);
        if (y < PN[0][0] || y > PN[0][1]) return;
        cx.strokeStyle = l.r ? '#ef4444' : '#10b981';
        cx.setLineDash([6, 4]);
        cx.beginPath();
        cx.moveTo(x0, y);
        cx.lineTo(x1, y);
        cx.stroke();
        cx.setLineDash([]);
        cx.fillStyle = l.r ? '#ef4444' : '#10b981';
        cx.textAlign = 'left';
        cx.fillText((l.r ? 'R ' : 'S ') + fmtNum(l.p, 0), x0 + 4, y - 3);
      });
    }

    const drawLineSeries = (key, col, width = 1.5) => {
      cx.strokeStyle = col;
      cx.lineWidth = width;
      cx.beginPath();
      let hasStarted = false;
      vis.forEach((d, i) => {
        if (d[key] === null || d[key] === undefined) return;
        const y = yp(d[key]);
        if (!hasStarted) {
          cx.moveTo(X(i), y);
          hasStarted = true;
        } else {
          cx.lineTo(X(i), y);
        }
      });
      cx.stroke();
      cx.lineWidth = 1;
    };

    // Bollinger Bands
    if (oiState.indicators.bb) {
      cx.fillStyle = 'rgba(99, 102, 241, 0.08)';
      cx.beginPath();
      let hasStarted = false;
      vis.forEach((d, i) => {
        if (d.bu === null || d.bu === undefined) return;
        const y = yp(d.bu);
        if (!hasStarted) {
          cx.moveTo(X(i), y);
          hasStarted = true;
        } else {
          cx.lineTo(X(i), y);
        }
      });
      for (let i = m - 1; i >= 0; i--) {
        if (vis[i].bl !== null && vis[i].bl !== undefined) {
          cx.lineTo(X(i), yp(vis[i].bl));
        }
      }
      cx.fill();
      drawLineSeries('bu', '#6366f1', 1);
      drawLineSeries('bl', '#6366f1', 1);
    }

    // Main Price Candles / Line
    const bd = Math.max(1, bw * 0.7);
    if (oiState.indicators.line) {
      drawLineSeries('c', '#38bdf8', 2);
    }

    vis.forEach((d, i) => {
      const x = X(i);
      const isUp = d.c >= d.o;
      const candleCol = isUp ? '#10b981' : '#ef4444';

      cx.globalAlpha = oiState.hiddenCategories[d.cat] ? 0.15 : 1;
      if (!oiState.indicators.line) {
        cx.strokeStyle = candleCol;
        cx.fillStyle = candleCol;
        cx.beginPath();
        cx.moveTo(x, yp(d.h));
        cx.lineTo(x, yp(d.l));
        cx.stroke();

        const topY = yp(Math.max(d.o, d.c));
        const botY = yp(Math.min(d.o, d.c));
        cx.fillRect(x - bd / 2, topY, bd, Math.max(1, botY - topY));
      }

      if (oiState.hiddenCategories[d.cat]) {
        cx.globalAlpha = 1;
        return;
      }

      // Volume Bar
      cx.globalAlpha = 0.75;
      cx.fillStyle = '#6366f1';
      const vy = Y(d.v, PN[1], 0, vm);
      cx.fillRect(x - bd / 2, vy, bd, PN[1][1] - vy);

      // OI Bar
      cx.fillStyle = OI_COLORS[d.cat] || '#38bdf8';
      const oiy = Y(d.oi, PN[2], omn, omx);
      cx.fillRect(x - bd / 2, oiy, bd, PN[2][1] - oiy);
      cx.globalAlpha = 1;
    });

    if (oiState.indicators.m20) drawLineSeries('m20', '#f59e0b', 1.5);
    if (oiState.indicators.m50) drawLineSeries('m50', '#ec4899', 1.5);

    // RSI Sub-panel
    if (oiState.indicators.rsi && PN[3]) {
      const r = PN[3];
      const ry = v => Y(v, r, 0, 100);
      cx.strokeStyle = grCol;
      [30, 70].forEach(v => {
        cx.setLineDash([3, 3]);
        cx.beginPath();
        cx.moveTo(x0, ry(v));
        cx.lineTo(x1, ry(v));
        cx.stroke();
        cx.setLineDash([]);
        cx.fillStyle = muCol;
        cx.textAlign = 'left';
        cx.fillText(v, x1 + 6, ry(v) + 4);
      });

      cx.strokeStyle = '#38bdf8';
      cx.lineWidth = 1.5;
      cx.beginPath();
      let hasStarted = false;
      vis.forEach((d, i) => {
        if (d.rsi === null || d.rsi === undefined) return;
        const y = ry(d.rsi);
        if (!hasStarted) {
          cx.moveTo(X(i), y);
          hasStarted = true;
        } else {
          cx.lineTo(X(i), y);
        }
      });
      cx.stroke();
      cx.lineWidth = 1;
    }

    const drawSubPanel = (panelIdx, key, lo, hi, col, isBar, refVal) => {
      const r = PN[panelIdx];
      if (!r || r[1] - r[0] < 8) return;
      const yy = v => Y(v, r, lo, hi);
      cx.strokeStyle = grCol;
      cx.fillStyle = muCol;
      cx.textAlign = 'left';

      [lo, (lo + hi) / 2, hi].forEach(v => {
        cx.beginPath();
        cx.moveTo(x0, yy(v));
        cx.lineTo(x1, yy(v));
        cx.stroke();
        cx.fillText(v.toFixed(v % 1 ? 1 : 0), x1 + 6, yy(v) + 4);
      });

      if (refVal !== null && refVal !== undefined) {
        cx.setLineDash([4, 3]);
        cx.strokeStyle = '#f59e0b';
        cx.beginPath();
        cx.moveTo(x0, yy(refVal));
        cx.lineTo(x1, yy(refVal));
        cx.stroke();
        cx.setLineDash([]);
      }

      if (isBar) {
        cx.fillStyle = col;
        cx.globalAlpha = 0.7;
        vis.forEach((d, j) => {
          const val = d[key] !== null && d[key] !== undefined ? d[key] : 0;
          const y = yy(val);
          cx.fillRect(X(j) - bd / 2, y, bd, r[1] - y);
        });
        cx.globalAlpha = 1;
      } else {
        cx.strokeStyle = col;
        cx.lineWidth = 1.5;
        cx.beginPath();
        let hasStarted = false;
        vis.forEach((d, j) => {
          if (d[key] === null || d[key] === undefined) return;
          const y = yy(d[key]);
          if (!hasStarted) {
            cx.moveTo(X(j), y);
            hasStarted = true;
          } else {
            cx.lineTo(X(j), y);
          }
        });
        cx.stroke();
        cx.lineWidth = 1;
      }
    };

    const b = vis[vis.length - 1];
    const adv = vis.length ? (vis.reduce((t, d) => t + (d.dv || 0), 0) / vis.length) : 50;
    const apc = vis.length ? (vis.reduce((t, d) => t + (d.pcr || 1.0), 0) / vis.length) : 1.0;

    if (oiState.indicators.dv && isStock && PN[4]) {
      drawSubPanel(4, 'dv', 0, 100, '#6366f1', true, Math.round(adv));
    }
    if (oiState.indicators.iv && PN[5]) {
      const ivVals = vis.map(d => d.iv).filter(v => !isNaN(v));
      const ivMin = Math.floor(Math.min(...ivVals, 10));
      const ivMax = Math.ceil(Math.max(...ivVals, 30));
      drawSubPanel(5, 'iv', ivMin, ivMax + (ivMin === ivMax ? 1 : 0), '#ec4899', false);
    }
    if (oiState.indicators.pcr && PN[6]) {
      const pcrVals = vis.map(d => d.pcr).filter(v => !isNaN(v) && v > 0);
      const pcrMin = Math.max(0.2, Math.floor((Math.min(...pcrVals, 0.6) - 0.1) * 10) / 10);
      const pcrMax = Math.min(3.0, Math.ceil((Math.max(...pcrVals, 1.4) + 0.1) * 10) / 10);
      drawSubPanel(6, 'pcr', pcrMin, pcrMax + (pcrMin === pcrMax ? 0.2 : 0), '#38bdf8', false, 1.0);
    }

    const panelHeaders = [
      [0, `${oiState.symbolMeta.s} · Futures Price (${oiState.indicators.line ? 'Line' : 'Candlestick'}) + Overlays`],
      [1, 'Futures Volume'],
      [2, 'Open Interest (Bar color = Institutional Buildup Flow)'],
      [3, 'RSI (14) · Momentum'],
      [4, `Delivery % · Cash Delivery Ratio (Benchmark: ${fmtNum(adv, 1)}% Avg)`],
      [5, `ATM Implied Volatility (IV %) · Latest ${fmtNum(b.iv, 1)}%`],
      [6, `Put-Call Ratio (PCR) · Latest ${fmtNum(b.pcr, 2)} (Avg: ${fmtNum(apc, 2)}, 1.0 = Balanced)`]
    ];

    panelHeaders.forEach(([idx, title]) => {
      const r = PN[idx];
      if (!r || r[1] - r[0] < 8) return;
      cx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const textW = cx.measureText(title).width;
      cx.globalAlpha = 0.88;
      cx.fillStyle = cardCol;
      cx.fillRect(x0 + 2, r[0] + 2, textW + 12, 18);
      cx.globalAlpha = 1;
      cx.fillStyle = txCol;
      cx.textAlign = 'left';
      cx.fillText(title, x0 + 8, r[0] + 15);
      cx.font = '11px system-ui, -apple-system, sans-serif';
    });

    if (oiState.hoverX >= 0 && oiState.hoverX < m) {
      const x = X(oiState.hoverX);
      cx.strokeStyle = muCol;
      cx.setLineDash([4, 4]);
      cx.beginPath();
      cx.moveTo(x, PT);
      cx.lineTo(x, H - 22);
      cx.stroke();

      if (oiState.hoverY >= PN[0][0] && oiState.hoverY <= PN[0][1]) {
        cx.beginPath();
        cx.moveTo(x0, oiState.hoverY);
        cx.lineTo(x1, oiState.hoverY);
        cx.stroke();
        cx.setLineDash([]);

        const crossPrice = mn + ((PN[0][1] - oiState.hoverY) / (PN[0][1] - PN[0][0])) * (mx - mn);
        cx.fillStyle = txCol;
        cx.fillRect(x1 + 1, oiState.hoverY - 8, PR - 2, 16);
        cx.fillStyle = bgCol;
        cx.textAlign = 'left';
        cx.fillText(fmtNum(crossPrice, 1), x1 + 5, oiState.hoverY + 4);
      }
      cx.setLineDash([]);
    }

    renderFutureOiPanels(vis);
  }

  function renderFutureOiPanels(vis) {
    if (!vis || !vis.length) return;
    const a = vis[0];
    const b = vis[vis.length - 1];
    const chg = b.c - a.c;
    const chgPct = a.c ? (chg / a.c) * 100 : 0;
    const isPos = chg >= 0;

    const rngEl = document.getElementById('futOiDateRange');
    if (rngEl) rngEl.textContent = `${formatOiDate(a.dt)} – ${formatOiDate(b.dt)} · ${vis.length} sessions`;

    const ltpEl = document.getElementById('futOiLtp');
    if (ltpEl) ltpEl.textContent = `₹${fmtNum(b.c, (b.c < 100 ? 2 : (b.c < 1000 ? 1 : 0)))}`;

    const chgEl = document.getElementById('futOiChg');
    if (chgEl) {
      chgEl.textContent = `${isPos ? '▲ +' : '▼ '}${fmtNum(chg, 2)} (${isPos ? '+' : ''}${fmtNum(chgPct, 2)}%)`;
      chgEl.style.color = isPos ? '#10b981' : '#ef4444';
    }

    const cnt = [0, 0, 0, 0];
    vis.forEach(d => { cnt[d.cat]++; });

    const av = vis.reduce((t, d) => t + d.v, 0) / vis.length;
    const doi = a.oi ? ((b.oi / a.oi) - 1) * 100 : 0;

    const ivs = oiState.allBars.map(d => d.iv).filter(v => !isNaN(v));
    const imn = Math.min(...ivs, 10);
    const imx = Math.max(...ivs, 40);
    const ivr = oiState.analyticsData?.ivRank ?? ((b.iv - imn) / (imx - imn || 1) * 100);
    const ivp = oiState.analyticsData?.ivPercentile ?? (ivs.filter(x => x < b.iv).length / (ivs.length || 1) * 100);

    const adv = vis.reduce((t, d) => t + d.dv, 0) / vis.length;
    const apc = vis.reduce((t, d) => t + d.pcr, 0) / vis.length;

    let peak = a.h, maxDd = 0;
    vis.forEach(d => {
      peak = Math.max(peak, d.h);
      maxDd = Math.min(maxDd, (d.l - peak) / peak);
    });

    const rets = vis.slice(1).map((d, i) => Math.log(d.c / (vis[i].c || 1)));
    const mr = rets.length ? rets.reduce((t, x) => t + x, 0) / rets.length : 0;
    const vol = rets.length ? Math.sqrt(rets.reduce((t, x) => t + (x - mr) ** 2, 0) / rets.length) * Math.sqrt(252) * 100 : 15;

    const statsGrid = document.getElementById('futOiStatsGrid');
    if (statsGrid) {
      const statsList = [
        ['Range High', `₹${fmtNum(Math.max(...vis.map(d => d.h)))}`],
        ['Range Low', `₹${fmtNum(Math.min(...vis.map(d => d.l)))}`],
        ['Avg Volume', av >= 1e7 ? (av / 1e7).toFixed(2) + ' Cr' : (av / 1e6).toFixed(1) + ' M'],
        ['OI Change', `${doi >= 0 ? '+' : ''}${fmtNum(doi, 1)}%`],
        ['Max Drawdown', `${fmtNum(maxDd * 100, 1)}%`],
        ['Ann. Volatility', `${fmtNum(vol, 1)}%`],
        ['RSI (14)', b.rsi ? fmtNum(b.rsi, 0) : '--'],
        ['ATM IV', `${fmtNum(b.iv, 1)}%`],
        ['IV Rank', `${fmtNum(ivr, 0)}%`],
        ['IV Percentile', `${fmtNum(ivp, 0)}%`],
        ['IV − HV', `${(b.iv - vol) >= 0 ? '+' : ''}${fmtNum(b.iv - vol, 1)}`],
        ['PCR (OI)', `${fmtNum(b.pcr, 2)} (Avg: ${fmtNum(apc, 2)})`],
        oiState.symbolMeta.k === 'Stock' ? ['Avg Delivery', `${fmtNum(adv, 1)}% (${fmtNum(b.dv, 1)}% today)`] : ['Max Pain Strike', `₹${fmtNum(oiState.maxPain, 0)}`]
      ];

      statsGrid.innerHTML = statsList.map(([lbl, val]) => `
        <div class="fut-oi-stat">
          <span>${lbl}</span>
          <b>${val}</b>
        </div>
      `).join('');
    }

    const distEl = document.getElementById('futOiBuildupDist');
    if (distEl) {
      distEl.innerHTML = cnt.map((c, i) => {
        const pct = vis.length ? (c / vis.length * 100).toFixed(0) : 0;
        return `
          <div class="fut-oi-row">
            <span>${OI_NAMES[i]}</span>
            <div class="t"><i style="width:${pct}%; background:${OI_COLORS[i]};"></i></div>
            <span>${pct}%</span>
          </div>
        `;
      }).join('');
    }

    const L = oiState.allBars[oiState.allBars.length - 1] || b;
    const reasons = [];
    let sc = 0;

    const addFactor = (v, t) => {
      sc += v;
      reasons.push(`<li style="list-style:none; margin-bottom:4px;">${v > 0 ? '🟢 ' : v < 0 ? '🔴 ' : '⚪ '}${t}</li>`);
    };

    addFactor(
      L.m50 === null ? 0 : (L.c > L.m50 ? 1 : -1),
      L.m50 === null ? 'MA50 data accumulating' : (L.c > L.m50 ? 'Price above MA50 benchmark (bullish)' : 'Price below MA50 benchmark (bearish)')
    );

    addFactor(
      L.m50 === null ? 0 : (L.m20 > L.m50 ? 1 : -1),
      L.m50 === null ? 'MA cross: n/a' : (L.m20 > L.m50 ? 'MA20 > MA50 Golden Cross' : 'MA20 < MA50 Death Cross')
    );

    addFactor(
      L.rsi > 55 ? 1 : (L.rsi < 45 ? -1 : 0),
      `RSI ${L.rsi ? fmtNum(L.rsi, 0) : '--'} ${L.rsi > 70 ? '(Overbought)' : (L.rsi < 30 ? '(Oversold)' : '(Neutral)')}`
    );

    const l5 = oiState.allBars.slice(-5).reduce((t, d) => t + (d.cat === 0 || d.cat === 2 ? 1 : -1), 0);
    addFactor(
      l5 >= 2 ? 1 : (l5 <= -2 ? -1 : 0),
      `Last 5 sessions flow: ${l5 > 0 ? 'Bullish accumulation' : (l5 < 0 ? 'Bearish distribution' : 'Mixed / Consolidating')}`
    );

    const chainPcr = oiState.chainPcr || 1.0;
    addFactor(
      chainPcr > 1.1 ? 1 : (chainPcr < 0.8 ? -1 : 0),
      `Option Chain PCR ${fmtNum(chainPcr, 2)} (${chainPcr > 1.1 ? 'Put writing support' : (chainPcr < 0.8 ? 'Call writing resistance' : 'Neutral')})`
    );

    const biasEl = document.getElementById('futOiBias');
    const gaugePtr = document.getElementById('futOiGaugePointer');
    const reasonsList = document.getElementById('futOiBiasReasons');

    const biasText = sc >= 3 ? 'BULLISH' : (sc >= 1 ? 'MILDLY BULLISH' : (sc <= -3 ? 'BEARISH' : (sc <= -1 ? 'MILDLY BEARISH' : 'NEUTRAL')));
    const biasCol = sc > 0 ? '#10b981' : (sc < 0 ? '#ef4444' : '#f59e0b');

    if (biasEl) {
      biasEl.textContent = biasText;
      biasEl.style.color = biasCol;
    }
    if (gaugePtr) {
      gaugePtr.style.left = Math.max(5, Math.min(95, 50 + sc * 9)) + '%';
    }
    if (reasonsList) {
      reasonsList.innerHTML = reasons.join('');
    }

    renderFutureOiTraderPanel(b, ivr, vol, adv);
  }

  function renderFutureOiTraderPanel(b, ivr, vol, adv) {
    const optPanel = document.getElementById('futOiTraderPanel');
    if (!optPanel) return;

    const sp = b.c;
    const mv = sp * (b.iv / 100) * Math.sqrt(7 / 365);
    const maxPain = oiState.maxPain || sp;
    const dist = sp ? ((maxPain / sp) - 1) * 100 : 0;
    const isStock = oiState.symbolMeta.k === 'Stock';

    const row = (k, v) => `
      <div style="display:flex; justify-content:space-between; font-size:12px; margin:5px 0;">
        <span style="color:var(--text-muted, #94a3b8);">${k}</span>
        <b style="color:var(--text-primary, #f8fafc);">${v}</b>
      </div>
    `;

    const ivt = ivr > 60
      ? 'IV elevated (>60%): Favourable for premium selling (Credit Spread / Strangle / Iron Condor).'
      : (ivr < 30
        ? 'IV compressed (<30%): Favourable for option buying (Long Straddle / Debit Spread).'
        : 'IV balanced (30–60%): Directional vertical spreads optimal.');

    const serverDelivComment = oiState.analyticsData?.optionsTraderPanel?.deliveryCommentary;
    const dt = serverDelivComment || (isStock
      ? (adv > 55 ? 'Cash Delivery high (>55%): Strong institutional holding & absorption.' : (adv < 42 ? 'Cash Delivery low (<42%): Predominantly intraday speculative churn.' : 'Delivery within normal range.'))
      : '');

    optPanel.innerHTML = `
      ${row('ATM Implied Vol (IV)', `${fmtNum(b.iv, 1)}%`)}
      ${row('IV Rank', `${fmtNum(ivr, 0)}%`)}
      ${row('IV vs Realized HV', b.iv > vol ? 'IV > HV (Options expensive)' : 'IV < HV (Options discounted)')}
      ${row('Weekly 1σ Range', `₹${fmtNum(sp - mv, 0)} – ₹${fmtNum(sp + mv, 0)}`)}
      ${row('ATM Straddle Cost', `~₹${fmtNum(mv * 0.8, 1)} pts`)}
      ${row('Max Pain Strike', `₹${fmtNum(maxPain, 0)} (${dist >= 0 ? '+' : ''}${fmtNum(dist, 1)}%)`)}
      ${row('Option Chain PCR', fmtNum(oiState.chainPcr, 2))}
      <div style="font-size:11.5px; color:#94a3b8; margin-top:10px; line-height:1.4; border-top:1px solid rgba(255,255,255,0.08); padding-top:8px;">
        💡 ${ivt} ${dt}
      </div>
    `;
  }

  function drawFutureOiOcCanvas() {
    const cv = document.getElementById('futOiOcCanvas');
    if (!cv || !oiState.optionChain || !oiState.optionChain.length) return;
    const g = cv.getContext('2d');
    if (!g) return;

    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300;
    const h = cv.clientHeight || 190;
    cv.width = w * dpr;
    cv.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const K = oiState.optionChain;
    const mx = Math.max(...K.map(x => Math.max(x.callOi || x.c || 0, x.putOi || x.p || 0))) || 1;
    const bw = w / K.length;
    g.font = '10px system-ui, -apple-system, sans-serif';
    g.textAlign = 'center';

    const muCol = getOiColor('--mu');

    K.forEach((x, i) => {
      const cx0 = i * bw;
      const cVal = x.callOi || x.c || 0;
      const pVal = x.putOi || x.p || 0;
      const hc = (cVal / mx) * (h - 32);
      const hp = (pVal / mx) * (h - 32);

      g.fillStyle = '#ef4444';
      g.fillRect(cx0 + bw * 0.1, h - 18 - hc, bw * 0.38, hc);

      g.fillStyle = '#10b981';
      g.fillRect(cx0 + bw * 0.52, h - 18 - hp, bw * 0.38, hp);

      const strike = x.strike || x.k;
      if (i % 3 === 0 || strike === oiState.atmStrike) {
        g.fillStyle = (strike === oiState.atmStrike) ? '#38bdf8' : muCol;
        g.font = (strike === oiState.atmStrike) ? 'bold 10px system-ui' : '10px system-ui';
        g.fillText(strike, cx0 + bw / 2, h - 4);
      }
      if (strike === oiState.maxPain) {
        g.fillStyle = '#f59e0b';
        g.font = 'bold 9px system-ui';
        g.fillText('MaxPain', cx0 + bw / 2, 10);
      }
    });

    const pcrEl = document.getElementById('futOiPcrText');
    if (pcrEl) {
      pcrEl.textContent = `PCR ${oiState.chainPcr ? oiState.chainPcr.toFixed(2) : '--'} · Max Pain ₹${fmtNum(oiState.maxPain, 0)}`;
    }
  }

  function showFutureOiTip(e, i) {
    const tip = document.getElementById('futOiTip');
    const cv = document.getElementById('futOiCanvas');
    if (!tip || !cv || !oiState.allBars || !oiState.allBars.length) return;

    const vis = oiState.allBars.slice(oiState.visibleStart, oiState.visibleStart + oiState.visibleCount);
    const d = vis[i];
    if (!d) return;

    const fullIdx = oiState.allBars.indexOf(d);
    const prev = fullIdx > 0 ? oiState.allBars[fullIdx - 1] : d;
    const cg = prev && prev.c ? ((d.c / prev.c) - 1) * 100 : 0;
    const r = cv.getBoundingClientRect();

    const volStr = d.v >= 1e7 ? (d.v / 1e7).toFixed(2) + ' Cr' : (d.v / 1e6).toFixed(1) + ' M';
    const oiStr = d.oi >= 1e7 ? (d.oi / 1e7).toFixed(2) + ' Cr' : (d.oi / 1e6).toFixed(1) + ' M';
    const isStock = oiState.symbolMeta.k === 'Stock';
    const formatShares = n => {
      if (!n) return '';
      if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr';
      if (n >= 1e5) return (n / 1e5).toFixed(2) + ' L';
      if (n >= 1e3) return (n / 1e3).toFixed(1) + ' k';
      return n.toLocaleString('en-IN');
    };
    const delivStr = isStock
      ? ` &bull; Deliv: <b>${fmtNum(d.dv, 1)}%</b>${d.deliv_qty ? ' (' + formatShares(d.deliv_qty) + ')' : ''}`
      : ` &bull; Deliv: <b>${fmtNum(d.dv, 1)}%</b>`;

    tip.innerHTML = `
      <div style="font-weight:700; color:#38bdf8; margin-bottom:3px;">${formatOiDate(d.dt)}</div>
      <div>O ₹${fmtNum(d.o, 1)} &bull; H ₹${fmtNum(d.h, 1)}</div>
      <div>L ₹${fmtNum(d.l, 1)} &bull; C ₹${fmtNum(d.c, 1)} <span style="color:${cg >= 0 ? '#10b981' : '#ef4444'}; font-weight:700;">(${cg >= 0 ? '+' : ''}${fmtNum(cg, 2)}%)</span></div>
      <div>Vol: ${volStr} &bull; OI: ${oiStr}</div>
      <div>IV: ${fmtNum(d.iv, 1)}% &bull; PCR: ${fmtNum(d.pcr, 2)}${delivStr}</div>
      <div style="margin-top:4px; font-weight:700; color:${OI_COLORS[d.cat]};">● ${OI_NAMES[d.cat]}</div>
    `;

    tip.style.display = 'block';
    const tipW = 230;
    const tipX = Math.min(e.clientX - r.left + 16, (cv.clientWidth || 800) - tipW);
    const tipY = Math.max(10, e.clientY - r.top - 20);
    tip.style.left = tipX + 'px';
    tip.style.top = tipY + 'px';
  }

  function handleFutureOiCsvUpload(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const lines = rd.result.trim().split(/\r?\n/);
        const D = lines.map(l => l.split(',')).filter(a => a.length >= 7 && !isNaN(Number(a[4]))).map(a => {
          return {
            dt: new Date(a[0]),
            o: Number(a[1]),
            h: Number(a[2]),
            l: Number(a[3]),
            c: Number(a[4]),
            v: Number(a[5]),
            oi: Number(a[6]),
            iv: a[7] ? Number(a[7]) : 15.0,
            dv: a[8] ? Number(a[8]) : 50.0,
            pcr: a[9] ? Number(a[9]) : 1.0,
            cat: 0
          };
        }).filter(d => !isNaN(d.dt.getTime())).sort((a, b) => a.dt - b.dt);

        if (D.length < 5) throw new Error('CSV must have at least 5 valid data rows');

        D.forEach((d, i) => {
          const p = D[i - 1] || d;
          const dp = d.c - p.c;
          const dO = d.oi - p.oi;
          d.cat = dp >= 0 ? (dO >= 0 ? 0 : 2) : (dO >= 0 ? 1 : 3);
        });

        oiState.currentSymbol = 'CSV_DATA';
        oiState.symbolMeta = { s: 'CSV', n: file.name, k: 'Stock', st: Math.max(1, Math.round(D[D.length - 1].c / 200)) };
        oiState.allBars = D;
        oiState.visibleCount = D.length;
        oiState.visibleStart = 0;

        const ttl = document.getElementById('futOiTitle');
        if (ttl) ttl.textContent = `Custom CSV · ${file.name}`;
        const helpMsg = document.getElementById('futOiHelpMsg');
        if (helpMsg) helpMsg.textContent = `✅ Successfully loaded ${D.length} rows from CSV`;

        drawFutureOiCanvas();
      } catch (err) {
        alert('Invalid CSV format: ' + err.message);
      }
    };
    rd.readAsText(file);
  }

  function initFutureOiEvents() {
    if (oiState.initializedEvents) return;
    oiState.initializedEvents = true;

    const cv = document.getElementById('futOiCanvas');
    const tip = document.getElementById('futOiTip');

    if (cv) {
      cv.addEventListener('pointerdown', e => {
        oiState.drag = { x: e.clientX, vs: oiState.visibleStart };
        cv.setPointerCapture(e.pointerId);
      });

      cv.addEventListener('pointerup', () => {
        oiState.drag = null;
      });

      cv.addEventListener('pointermove', e => {
        if (!oiState.allBars || !oiState.allBars.length) return;
        const r = cv.getBoundingClientRect();
        oiState.hoverY = e.clientY - r.top;

        const PL = 60, PR = 65;
        const W = cv.clientWidth || 800;
        const bw = (W - PL - PR) / (oiState.visibleCount || 1);

        if (oiState.drag) {
          const deltaBars = Math.round((e.clientX - oiState.drag.x) / bw);
          oiState.visibleStart = Math.max(0, Math.min(oiState.allBars.length - oiState.visibleCount, oiState.drag.vs - deltaBars));
          oiState.hoverX = -1;
          if (tip) tip.style.display = 'none';
          drawFutureOiCanvas();
          return;
        }

        const i = Math.floor((e.clientX - r.left - PL) / bw);
        if (i < 0 || i >= oiState.visibleCount) {
          oiState.hoverX = -1;
          if (tip) tip.style.display = 'none';
          drawFutureOiCanvas();
          return;
        }
        oiState.hoverX = i;
        drawFutureOiCanvas();
        showFutureOiTip(e, i);
      });

      cv.addEventListener('pointerleave', () => {
        oiState.hoverX = -1;
        if (tip) tip.style.display = 'none';
        drawFutureOiCanvas();
      });

      cv.addEventListener('wheel', e => {
        if (!oiState.allBars || !oiState.allBars.length) return;
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        const PL = 60, PR = 65;
        const W = cv.clientWidth || 800;
        const fr = Math.max(0, Math.min(1, (e.clientX - r.left - PL) / (W - PL - PR)));
        const anchor = oiState.visibleStart + fr * oiState.visibleCount;

        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        oiState.visibleCount = Math.max(10, Math.min(oiState.allBars.length, Math.round(oiState.visibleCount * factor)));
        oiState.visibleStart = Math.max(0, Math.min(oiState.allBars.length - oiState.visibleCount, Math.round(anchor - fr * oiState.visibleCount)));

        // Remove active class from range bar
        document.querySelectorAll('#futOiRangeBar button').forEach(b => b.classList.remove('on'));
        drawFutureOiCanvas();
      }, { passive: false });
    }

    // Range Bar Buttons (1M, 3M, 6M)
    const rangeBar = document.getElementById('futOiRangeBar');
    if (rangeBar) {
      rangeBar.addEventListener('click', e => {
        const btn = e.target.closest('button[data-n]');
        if (!btn || !oiState.allBars || !oiState.allBars.length) return;
        const n = Number(btn.dataset.n);
        oiState.visibleCount = Math.min(n, oiState.allBars.length);
        oiState.visibleStart = Math.max(0, oiState.allBars.length - oiState.visibleCount);
        rangeBar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
        drawFutureOiCanvas();
      });
    }

    // Indicator Toolbar Buttons
    const indBar = document.getElementById('futOiIndicatorBar');
    if (indBar) {
      indBar.addEventListener('click', e => {
        const btn = e.target.closest('button[data-k]');
        if (!btn) return;
        const k = btn.dataset.k;
        if (oiState.indicators[k] !== undefined) {
          oiState.indicators[k] = !oiState.indicators[k];
          btn.classList.toggle('on', !!oiState.indicators[k]);
          drawFutureOiCanvas();
        }
      });
    }

    // Buildup Legend Filter Buttons
    const legEl = document.getElementById('futOiLegend');
    if (legEl) {
      legEl.addEventListener('click', e => {
        const btn = e.target.closest('button[data-c]');
        if (!btn) return;
        const c = Number(btn.dataset.c);
        if (c >= 0 && c <= 3) {
          oiState.hiddenCategories[c] = !oiState.hiddenCategories[c];
          btn.classList.toggle('off', !!oiState.hiddenCategories[c]);
          drawFutureOiCanvas();
        }
      });
    }

    // Watchlist Ribbon Clicks
    const wlRibbon = document.getElementById('futOiWatchlistRibbon');
    if (wlRibbon) {
      wlRibbon.addEventListener('click', e => {
        const btn = e.target.closest('button[data-s]');
        if (btn && btn.dataset.s) {
          selectOiSymbol(btn.dataset.s);
        }
      });
    }

    // CSV File Input
    const csvInput = document.getElementById('futOiCsvInput');
    if (csvInput) {
      csvInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          handleFutureOiCsvUpload(e.target.files[0]);
        }
      });
    }

    // Search Autocomplete
    const sInput = document.getElementById('futOiSearchInput');
    const sDropdown = document.getElementById('futOiSearchDropdown');
    let highlightIdx = 0;
    let filteredSymbols = [];

    const renderDropdown = () => {
      if (!sDropdown) return;
      if (!filteredSymbols.length) {
        sDropdown.innerHTML = `<div style="padding:10px 12px; color:#94a3b8; font-size:12px;">No matching symbol found. (260+ F&O stocks & indices)</div>`;
        sDropdown.style.display = 'block';
        return;
      }

      sDropdown.innerHTML = filteredSymbols.slice(0, 15).map((item, idx) => {
        const isSel = (idx === highlightIdx);
        const isPos = (item.changePct || 0) >= 0;
        const chgCol = isPos ? '#10b981' : '#ef4444';
        const sign = isPos ? '+' : '';
        const priceStr = item.ltp ? `₹${fmtNum(item.ltp, 1)}` : '';
        const chgStr = item.changePct ? ` (${sign}${fmtNum(item.changePct, 2)}%)` : '';

        return `
          <div class="fut-oi-search-row ${isSel ? 'hi' : ''}" data-idx="${idx}">
            <span>
              <strong style="color:var(--text-primary, #f8fafc);">${item.symbol}</strong>
              <span style="color:#94a3b8; font-size:11px; margin-left:6px;">${item.name || ''}</span>
            </span>
            <span style="text-align:right;">
              <span style="color:${chgCol}; font-weight:700;">${priceStr}${chgStr}</span>
              <span class="fut-badge ${item.kind === 'Index' ? 'fut-badge-sb' : 'fut-badge-neutral'}" style="margin-left:6px; font-size:9px;">${(item.kind || 'STOCK').toUpperCase()}</span>
            </span>
          </div>
        `;
      }).join('');
      sDropdown.style.display = 'block';
    };

    const filterSymbols = () => {
      if (!sInput) return;
      const term = sInput.value.trim().toUpperCase();
      filteredSymbols = (oiState.symbolsList || []).filter(item => {
        if (!term) return true;
        return item.symbol.toUpperCase().includes(term) || (item.name && item.name.toUpperCase().includes(term));
      });
      highlightIdx = 0;
      renderDropdown();
    };

    if (sInput && sDropdown) {
      sInput.addEventListener('input', filterSymbols);
      sInput.addEventListener('focus', filterSymbols);
      sInput.addEventListener('blur', () => {
        setTimeout(() => { if (sDropdown) sDropdown.style.display = 'none'; }, 200);
      });

      sInput.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          highlightIdx = Math.min(Math.min(filteredSymbols.length, 15) - 1, highlightIdx + 1);
          renderDropdown();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlightIdx = Math.max(0, highlightIdx - 1);
          renderDropdown();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredSymbols[highlightIdx]) {
            selectOiSymbol(filteredSymbols[highlightIdx].symbol);
            sInput.value = '';
            sDropdown.style.display = 'none';
          }
        } else if (e.key === 'Escape') {
          sDropdown.style.display = 'none';
        }
      });

      sDropdown.addEventListener('mousedown', e => {
        const row = e.target.closest('[data-idx]');
        if (row) {
          const idx = Number(row.dataset.idx);
          if (filteredSymbols[idx]) {
            selectOiSymbol(filteredSymbols[idx].symbol);
            sInput.value = '';
            sDropdown.style.display = 'none';
          }
        }
      });
    }

    window.addEventListener('resize', () => {
      if (state.activeSubTab === 'openInterest') {
        drawFutureOiCanvas();
        drawFutureOiOcCanvas();
      }
    });
  }

  function selectOiSymbol(symbol) {
    if (!symbol) return;
    oiState.currentSymbol = symbol.toUpperCase();
    if (state.activeSubTab !== 'openInterest') {
      switchSubTab('openInterest');
    }
    fetchFutureOiData(oiState.currentSymbol, false);
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
      // Pause if browser tab is hidden/minimized
      if (document.hidden) return;

      // Check Indian market hours (Mon-Fri 09:15 to 15:35 IST)
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 3600000 * 5.5);
      const day = ist.getDay();
      const mins = ist.getHours() * 60 + ist.getMinutes();
      const isMarketOpen = (day >= 1 && day <= 5) && (mins >= 555 && mins <= 935);

      if (!isMarketOpen) {
        if (cdText) cdText.textContent = 'EOD Mode';
        return;
      }

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
      setTimeout(() => {
        const tblWrap = document.querySelector('.fut-table-wrap');
        if (tblWrap) {
          tblWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  }

  function inspectContract(sym) {
    if (!sym) return;
    const cleanSym = String(sym).trim().toUpperCase();
    if (typeof window.inspectStock === 'function') {
      window.inspectStock(cleanSym);
    } else if (typeof inspectStock === 'function') {
      inspectStock(cleanSym);
    } else {
      filterBySymbol(cleanSym);
    }
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

    // Opstra Mover Category Pills Listener
    document.querySelectorAll('#futMoversCategoryPills .fut-mover-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#futMoversCategoryPills .fut-mover-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.moversCategory = pill.dataset.cat || 'all';
        renderFuturesMovers();
      });
    });

    // Opstra Mover Rows Limit Toggle (5 vs 10)
    const btnLim5 = document.getElementById('futMoversLimit5');
    const btnLim10 = document.getElementById('futMoversLimit10');
    if (btnLim5 && btnLim10) {
      btnLim5.addEventListener('click', () => {
        btnLim5.classList.add('active');
        btnLim10.classList.remove('active');
        state.moversLimit = 5;
        renderFuturesMovers();
      });
      btnLim10.addEventListener('click', () => {
        btnLim10.classList.add('active');
        btnLim5.classList.remove('active');
        state.moversLimit = 10;
        renderFuturesMovers();
      });
    }

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
    const urlParams = new URLSearchParams(window.location.search);
    const symParam = urlParams.get('symbol') || urlParams.get('s');
    if (symParam) {
      oiState.currentSymbol = symParam.toUpperCase();
    }
    if (initPath.includes('/rollover')) {
      state.activeSubTab = 'rollover';
    } else if (initPath.includes('/open-interest') || initPath.includes('/oi') || initPath.includes('/future-oi')) {
      state.activeSubTab = 'openInterest';
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
    selectOiSymbol,
    loadFutureOpenInterestView,
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
