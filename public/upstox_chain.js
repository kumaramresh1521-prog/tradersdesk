/**
 * Option Chain Pro - Modern Institutional Derivatives Matrix
 * Real-time Exchange Streaming, Greeks, ATM Straddles & Multi-Expiry Depth
 */

(function () {
  const state = {
    instrumentKey: 'NSE_INDEX|Nifty 50',
    expiryDate: '',
    strikeRange: 10, // ±10 strikes around ATM by default (controlled via ⚙️ Settings)
    viewMode: 'default', // 'default' (Image 1 layout) | 'greeks' | 'oi' | 'straddle'
    activeTab: 'chain', // 'chain' | 'force' | 'maxpain' | 'oidist' | 'greeks'
    visualizerMetric: 'oichg', // Default to OI Chg with zero-baseline matching Image 2
    visViewMode: 'strike', // 'strike' (Image 2) | 'pcr' (Image 1) | 'maxpain' (Image 3)
    visHoverIndex: -1,
    visChartBounds: [],
    showGexColumns: false, // Custom GEX columns removed from primary table
    showVolumeBars: true,
    showIvColumns: true,
    showItmProb: false,
    searchQuery: '',
    autoRefreshSec: 5,
    timerId: null,
    chainData: null,
    isLoading: false,
  };

  function fmtNum(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function fmtQty(q) {
    if (q === null || q === undefined || isNaN(q)) return '--';
    const num = Number(q);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 10000000) return sign + (abs / 10000000).toFixed(2) + ' Cr';
    if (abs >= 100000) return sign + (abs / 100000).toFixed(2) + ' L';
    if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + ' k';
    return num.toLocaleString('en-IN');
  }

  // Modern Million / Thousands Formatter (e.g. 14M, 3.5M, 468K, 4.4K)
  function fmtMillionQty(q) {
    if (q === null || q === undefined || isNaN(q)) return '--';
    const num = Number(q);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1000000000) {
      const val = abs / 1000000000;
      return sign + (val >= 10 ? val.toFixed(0) : val.toFixed(1)).replace(/\.0$/, '') + 'B';
    }
    if (abs >= 1000000) {
      const val = abs / 1000000;
      return sign + (val >= 10 ? val.toFixed(0) : val.toFixed(1)).replace(/\.0$/, '') + 'M';
    }
    if (abs >= 1000) {
      const val = abs / 1000;
      return sign + (val >= 10 ? val.toFixed(0) : val.toFixed(1)).replace(/\.0$/, '') + 'K';
    }
    return sign + num.toLocaleString('en-US');
  }

  // Clean OI Change Formatter (e.g. 2,038,400.00 / -671,450.00)
  function fmtOiChangeNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // BSM Gaussian PDF
  function normalPdf(x) {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  }

  // Option Greek Gamma approximation
  function calcGamma(spot, strike, dte, iv) {
    if (spot <= 0 || strike <= 0) return 0.001;
    const T = Math.max(0.5, dte || 4) / 365.25;
    const vol = Math.max(0.08, (Number(iv) || 12.0) / 100.0);
    const d1 = (Math.log(spot / strike) + 0.5 * vol * vol * T) / (vol * Math.sqrt(T));
    return normalPdf(d1) / (spot * vol * Math.sqrt(T));
  }

  // Gamma Exposure (GEX) matching Image 2
  function calcGex(r, spot, dte) {
    const sp = Number(r.strike_price || 0);
    const ce = r.call_options || {};
    const pe = r.put_options || {};
    const ceOi = Number(ce.market_data?.oi || 0);
    const peOi = Number(pe.market_data?.oi || 0);
    const ceVol = Number(ce.market_data?.volume || 0);
    const peVol = Number(pe.market_data?.volume || 0);
    const ceIv = Number(ce.option_greeks?.iv || 12.0);
    const peIv = Number(pe.option_greeks?.iv || 12.0);
    const avgIv = (ceIv + peIv) / 2 || 12.0;

    const brokerGamma = Number(ce.option_greeks?.gamma || pe.option_greeks?.gamma || 0);
    const gamma = brokerGamma > 0 ? brokerGamma : calcGamma(spot, sp, dte, avgIv);
    // Institutional dealer scaling factor (scaled to match Image 2 magnitude)
    const gFactor = (gamma * spot * spot * 0.01) / 100000;

    const gexOi = (ceOi - peOi) * gFactor;
    const gexVol = (ceVol - peVol) * gFactor;

    return { gexOi, gexVol, gamma, gFactor };
  }

  // Abramowitz & Stegun Normal Cumulative Distribution Function (error < 7.5e-8)
  function normalCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? (1 - p) : p;
  }

  // ITM Probability: Exact Delta approximation or Black-Scholes Normal CDF
  function calcItmProb(type, strike, spot, dte, iv, brokerDelta) {
    if (brokerDelta !== undefined && brokerDelta !== null && !isNaN(brokerDelta) && Math.abs(brokerDelta) > 0.0001) {
      let p = Math.abs(Number(brokerDelta)) * 100;
      if (type === 'CE' && strike < spot && p < 50) p = 100 - p;
      if (type === 'PE' && strike > spot && p < 50) p = 100 - p;
      return Math.min(100, Math.max(0.1, p));
    }
    const T = Math.max(0.5, dte || 4) / 365.0;
    const vol = Math.max(0.08, (Number(iv) || 12.0) / 100.0);
    const d2 = (Math.log(spot / strike) - 0.5 * vol * vol * T) / (vol * Math.sqrt(T));
    const p = type === 'CE' ? normalCdf(d2) * 100 : (1 - normalCdf(d2)) * 100;
    return Math.min(100, Math.max(0.1, p));
  }

  // Modern OI Sentiment / Sense tag
  function getModernOiSense(netChg, oiChg) {
    const nc = Number(netChg || 0);
    const oc = Number(oiChg || 0);
    if (oc >= 0 && nc >= 0) return { text: 'Long Build Up', cls: 'sense-lb' };
    if (oc >= 0 && nc < 0) return { text: 'Short Build Up', cls: 'sense-sb' };
    if (oc < 0 && nc >= 0) return { text: 'Short Covering', cls: 'sense-sc' };
    return { text: 'Long Unwinding', cls: 'sense-lu' };
  }

  function getBuildup(chgPrice, chgOi) {
    const cp = Number(chgPrice || 0);
    const co = Number(chgOi || 0);
    if (co === 0 && cp === 0) return { code: '--', cls: 'buildup-none', title: 'Neutral' };
    if (cp >= 0 && co >= 0) return { code: 'LB', cls: 'buildup-lb', title: 'Long Buildup (Bullish - Buyers Adding)' };
    if (cp < 0 && co >= 0) return { code: 'SB', cls: 'buildup-sb', title: 'Short Buildup (Bearish - Writers Adding)' };
    if (cp >= 0 && co < 0) return { code: 'SC', cls: 'buildup-sc', title: 'Short Covering (Bullish - Writers Covering)' };
    return { code: 'LU', cls: 'buildup-lu', title: 'Long Unwinding (Bearish - Bulls Exiting)' };
  }

  async function fetchChain(force = false) {
    if (state.isLoading) return;

    // Guard: Do not poll when the Upstox panel is hidden or inactive, unless user explicitly clicked refresh
    const panel = document.getElementById('panelUpstoxChain');
    if (!force && (!panel || panel.style.display === 'none' || panel.offsetParent === null)) {
      return;
    }

    state.isLoading = true;

    const iconRef = document.getElementById('upstoxRefreshIcon');
    if (force && iconRef) iconRef.classList.add('spin');

    const statusEl = document.getElementById('upstoxLiveStatus');
    if (statusEl) statusEl.textContent = '⏳ Fetching Option Chain...';

    try {
      const isDirectHttp = window.location.protocol.startsWith('http') && (window.location.port === '8000' || window.location.port === '');
      const baseUrl = isDirectHttp ? '' : 'http://127.0.0.1:8000';
      const endpoint = `${baseUrl}/api/upstox/option-chain`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument_key: state.instrumentKey,
          expiry_date: state.expiryDate,
          forceRefresh: force,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.chainData = data;

      // Update available expiries dropdown
      updateExpiriesDropdown(data.availableExpiries || [], data.expiry);

      // Render summary ribbon
      renderSummary(data);

      // Render strikes table
      renderTable(data);

      // Render 14-Metric Multi-Strike Visualizer Chart (Image 15 Style)
      renderVisualizerChart(data);

      // Render active quant analytics pane
      renderActivePane(data);

      // Update status tag
      if (statusEl) {
        if (data.marketOpen === false || data.isMarketClosed === true) {
          statusEl.className = 'upstox-badge-live is-closed';
          statusEl.innerHTML = '⏸️ <span>Market Closed • Data Frozen</span>';
          statusEl.title = 'Exchange closed. Displaying closing settlement snapshot. Auto-refresh paused.';
        } else if (data.isLive) {
          statusEl.className = 'upstox-badge-live is-live';
          statusEl.innerHTML = '🟢 <span>Live Stream</span>';
        } else {
          statusEl.className = 'upstox-badge-live is-live';
          statusEl.innerHTML = '⚡ <span>Market Stream</span>';
        }
      }

      // Freeze Auto-Refresh when Market is Closed (Prevents unnecessary background polling & flickering)
      if (data.marketOpen === false || data.isMarketClosed === true) {
        if (state.timerId) {
          clearInterval(state.timerId);
          state.timerId = null;
        }
        if (!state.marketClosedCheckTimer) {
          state.marketClosedCheckTimer = setInterval(() => {
            fetchChain(false);
          }, 60000); // 1-minute slow check
        }
      } else {
        if (state.marketClosedCheckTimer) {
          clearInterval(state.marketClosedCheckTimer);
          state.marketClosedCheckTimer = null;
        }
        if (!state.timerId && state.autoRefreshSec > 0) {
          state.timerId = setInterval(() => fetchChain(false), state.autoRefreshSec * 1000);
        }
      }

      const updEl = document.getElementById('upstoxLastUpdated');
      if (updEl) {
        if (data.marketOpen === false || data.isMarketClosed === true) {
          updEl.textContent = `${data.lastUpdated || '15:30:00'} (Frozen)`;
        } else {
          updEl.textContent = data.lastUpdated || new Date().toLocaleTimeString();
        }
      }
    } catch (e) {
      console.error('Failed to load Option Chain Pro:', e);
      if (statusEl) {
        statusEl.className = 'upstox-badge-live is-error';
        statusEl.innerHTML = `🔴 <span>Connecting to Backend Server...</span> <button id="upstoxRetryBtn" style="background:#2563eb; color:#fff; border:none; padding:2px 8px; border-radius:4px; margin-left:6px; cursor:pointer; font-size:10px; font-weight:700;">Retry</button>`;
        const rBtn = document.getElementById('upstoxRetryBtn');
        if (rBtn) rBtn.onclick = () => fetchChain(true);
      }
      // Auto-retry once after 2.5s if offline during server reload
      setTimeout(() => {
        if (!state.chainData && !state.isLoading) fetchChain(false);
      }, 2500);
    } finally {
      state.isLoading = false;
      if (iconRef) iconRef.classList.remove('spin');
    }
  }

  function updateExpiriesDropdown(expiries, currentExpiry) {
    const sel = document.getElementById('upstoxExpirySelect');
    if (!sel) return;

    const currentOpts = Array.from(sel.options).map(o => o.value);
    const same = currentOpts.length === expiries.length && expiries.every((e, i) => e === currentOpts[i]);

    if (!same) {
      sel.innerHTML = '';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      expiries.forEach((exp, idx) => {
        const opt = document.createElement('option');
        opt.value = exp;
        try {
          const d = new Date(exp);
          d.setHours(0, 0, 0, 0);
          const diffDays = Math.round((d - today) / (1000 * 60 * 60 * 24));
          const dteLabel = diffDays === 0 ? '0 DTE (Today)' : diffDays === 1 ? '1 DTE' : `${diffDays} DTE`;
          const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          opt.textContent = `${dateStr} • ${dteLabel}${idx === 0 ? ' ⚡' : ''}`;
        } catch (_) {
          opt.textContent = exp;
        }
        sel.appendChild(opt);
      });
    }

    if (currentExpiry) {
      sel.value = currentExpiry;
      state.expiryDate = currentExpiry;
    }
  }

  function renderDteHorizonPills(expiries, currentExpiry) {
    const container = document.getElementById('modernDteList');
    if (!container) return;

    if (!expiries || !expiries.length) {
      container.innerHTML = '<span style="font-size:11px; color:#94a3b8;">No expiries available</span>';
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    container.innerHTML = expiries.map(exp => {
      let dteLabel = exp;
      try {
        const d = new Date(exp);
        d.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.round((d - today) / (1000 * 60 * 60 * 24)));
        dteLabel = `${diffDays}d`;
      } catch (_) {}

      const isActive = exp === currentExpiry;
      return `
        <button type="button" class="modern-dte-pill ${isActive ? 'active' : ''}" data-exp="${exp}" title="Expiry Date: ${exp}">
          ${dteLabel}
        </button>
      `;
    }).join('');

    container.querySelectorAll('.modern-dte-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        const exp = e.currentTarget.getAttribute('data-exp');
        if (exp && exp !== state.expiryDate) {
          state.expiryDate = exp;
          const sel = document.getElementById('upstoxExpirySelect');
          if (sel) sel.value = exp;
          fetchChain(true);
        }
      });
    });
  }

  function renderModernStatsStrip(data) {
    const spot = Number(data.spotPrice || 0);
    const pcr = Number(data.pcr || 1.0);
    const maxPain = Number(data.maxPain || 0);
    const totalCeOi = Number(data.totalCeOi || 0);
    const totalPeOi = Number(data.totalPeOi || 0);
    const cumOi = totalCeOi + totalPeOi;

    const totalCeVol = Number(data.totalCeVol || 1);
    const totalPeVol = Number(data.totalPeVol || 0);
    const pcrVol = (totalPeVol / (totalCeVol || 1)).toFixed(2);

    let atmIv = 0;
    if (data.atmIv) {
      atmIv = Number(data.atmIv);
    } else if (data.data && data.data.length) {
      const atmRow = data.data.find(r => Math.abs(Number(r.strike_price) - spot) <= 50) || data.data[0];
      atmIv = Number(atmRow.call_options?.option_greeks?.iv || atmRow.put_options?.option_greeks?.iv || 0);
    }

    const elAtmIv = document.getElementById('modernStatAtmIv');
    if (elAtmIv) elAtmIv.textContent = atmIv > 0 ? `${atmIv.toFixed(1)}%` : '0';

    const elCumOi = document.getElementById('modernStatCumOi');
    if (elCumOi) elCumOi.textContent = fmtMillionQty(cumOi);

    const elMaxPain = document.getElementById('modernStatMaxPain');
    if (elMaxPain) elMaxPain.textContent = maxPain ? Math.round(maxPain).toLocaleString('en-IN') : '--';

    const elPcrVol = document.getElementById('modernStatPcrVol');
    if (elPcrVol) elPcrVol.textContent = pcrVol;

    const elPcr = document.getElementById('modernStatPcr');
    if (elPcr) elPcr.textContent = pcr.toFixed(2);

    const elDot = document.getElementById('modernStatLiveDot');
    if (elDot) {
      if (data.marketOpen === false || data.isMarketClosed === true) {
        elDot.textContent = '⏸️';
        elDot.title = 'Market Closed - Data Frozen (Closing Bhavcopy Snapshot)';
      } else {
        elDot.textContent = data.isLive ? '🟢' : '🔴';
        elDot.title = data.isLive ? 'Live Exchange Stream Active' : 'Market Closed / Bhavcopy Mode';
      }
    }
  }

  function exportModernOptionChainCsv() {
    if (!state.chainData || !state.chainData.data) {
      alert('Option chain data not loaded yet.');
      return;
    }
    const rows = state.chainData.data || [];
    const und = (state.chainData.underlying || 'NIFTY').replace(/\s+/g, '_');
    const exp = state.chainData.expiry || 'expiry';

    let headers = ['STRIKE', 'CE_SENSE', 'CE_OI_CHG_PCT', 'CE_OI_CHG', 'CE_OI', 'CE_LTP', 'PE_LTP', 'PE_OI', 'PE_OI_CHG', 'PE_OI_CHG_PCT', 'PE_SENSE'];
    let csvLines = [headers.join(',')];

    rows.forEach(r => {
      const sp = r.strike_price;
      const ce = r.call_options || {};
      const pe = r.put_options || {};
      const ceMd = ce.market_data || {};
      const peMd = pe.market_data || {};
      const ceOi = Number(ceMd.oi || 0);
      const peOi = Number(peMd.oi || 0);
      const ceOiChg = Number(ceMd.oi_change || 0);
      const peOiChg = Number(peMd.oi_change || 0);
      const ceChg = Number(ceMd.net_change || 0);
      const peChg = Number(peMd.net_change || 0);
      const ceSense = getModernOiSense(ceChg, ceOiChg).text;
      const peSense = getModernOiSense(peChg, peOiChg).text;

      csvLines.push([
        sp,
        `"${ceSense}"`,
        (ceMd.prev_oi ? (ceOiChg / ceMd.prev_oi * 100).toFixed(2) : '0'),
        ceOiChg,
        ceOi,
        ceMd.ltp || 0,
        peMd.ltp || 0,
        peOi,
        peOiChg,
        (peMd.prev_oi ? (peOiChg / peMd.prev_oi * 100).toFixed(2) : '0'),
        `"${peSense}"`
      ].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${und}_Option_Chain_${exp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderSummary(data) {
    const spot = Number(data.spotPrice || 0);
    const pcr = Number(data.pcr || 1.0);
    const maxPain = Number(data.maxPain || 0);
    const atmStraddle = Number(data.atmStraddle || 0);
    const dayChg = Number(data.dayChange || 0);
    const dayChgPct = Number(data.dayChangePct || 0);

    const elSpot = document.getElementById('upstoxSpotVal');
    if (elSpot) elSpot.textContent = '₹' + fmtNum(spot, 2);

    const elSpotChg = document.getElementById('upstoxSpotChg');
    if (elSpotChg) {
      const isPos = dayChg >= 0;
      elSpotChg.textContent = `${isPos ? '+' : ''}${fmtNum(dayChg, 2)} (${isPos ? '+' : ''}${fmtNum(dayChgPct, 2)}%)`;
      elSpotChg.style.background = isPos ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      elSpotChg.style.color = isPos ? '#34d399' : '#f87171';
    }

    const elPcr = document.getElementById('upstoxPcrVal');
    const elPcrTag = document.getElementById('upstoxPcrTag');
    if (elPcr) {
      elPcr.textContent = pcr.toFixed(2);
      if (elPcrTag) {
        if (pcr >= 1.25) {
          elPcrTag.textContent = '🟢 STRONG BULLISH';
          elPcrTag.style.background = 'rgba(16, 185, 129, 0.2)';
          elPcrTag.style.color = '#34d399';
        } else if (pcr >= 1.0) {
          elPcrTag.textContent = '🟢 MILD BULLISH';
          elPcrTag.style.background = 'rgba(16, 185, 129, 0.15)';
          elPcrTag.style.color = '#34d399';
        } else if (pcr <= 0.75) {
          elPcrTag.textContent = '🔴 STRONG BEARISH';
          elPcrTag.style.background = 'rgba(239, 68, 68, 0.2)';
          elPcrTag.style.color = '#f87171';
        } else if (pcr <= 0.9) {
          elPcrTag.textContent = '🔴 MILD BEARISH';
          elPcrTag.style.background = 'rgba(239, 68, 68, 0.15)';
          elPcrTag.style.color = '#f87171';
        } else {
          elPcrTag.textContent = '🟡 BALANCED';
          elPcrTag.style.background = 'rgba(245, 158, 11, 0.15)';
          elPcrTag.style.color = '#fbbf24';
        }
      }
    }

    const elPcrMeter = document.getElementById('upstoxPcrMeter');
    if (elPcrMeter) {
      const pcrPct = Math.min(100, Math.max(5, ((pcr - 0.4) / 1.4) * 100));
      elPcrMeter.style.width = `${pcrPct}%`;
      elPcrMeter.style.background = pcr >= 1.0 ? '#10b981' : pcr <= 0.8 ? '#ef4444' : '#fbbf24';
    }

    const elPain = document.getElementById('upstoxMaxPainVal');
    if (elPain) elPain.textContent = maxPain ? '₹' + fmtNum(maxPain, 0) : '--';

    const elPainDelta = document.getElementById('upstoxMaxPainDelta');
    if (elPainDelta && maxPain) {
      const mpDiff = spot - maxPain;
      elPainDelta.style.display = '';
      const isAbove = mpDiff >= 0;
      elPainDelta.textContent = `${isAbove ? '+' : ''}${fmtNum(mpDiff, 0)} pts`;
      elPainDelta.style.background = isAbove ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      elPainDelta.style.color = isAbove ? '#34d399' : '#f87171';
    }

    const elAtm = document.getElementById('upstoxAtmStrikeVal');
    if (elAtm) elAtm.textContent = '₹' + fmtNum(data.atmStrike || spot, 0);

    const elStraddle = document.getElementById('upstoxStraddleVal');
    if (elStraddle) elStraddle.textContent = atmStraddle ? '₹' + fmtNum(atmStraddle, 2) : '--';

    // India VIX (Next to Expected Move)
    const vix = Number(data.indiaVix || 13.25);
    const vixChg = Number(data.vixChange || -0.42);
    const elVix = document.getElementById('upstoxVixVal');
    const elVixTag = document.getElementById('upstoxVixTag');
    if (elVix) elVix.textContent = vix.toFixed(2);
    if (elVixTag) {
      elVixTag.textContent = `${vixChg >= 0 ? '+' : ''}${vixChg.toFixed(2)}%`;
      elVixTag.style.background = vixChg >= 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
      elVixTag.style.color = vixChg >= 0 ? '#f87171' : '#34d399';
    }

    // Expected Move (Fixed to calculate accurately and never show blank)
    let expMove = Number(data.expectedMove || 0);
    if (!expMove || expMove <= 0) {
      expMove = atmStraddle > 0 ? (atmStraddle * 0.85) : (spot * (vix / 100.0) * Math.sqrt(1 / 365.0));
    }
    const elExpMove = document.getElementById('upstoxExpectedMoveVal');
    const elExpRange = document.getElementById('upstoxExpectedRangeSub');
    if (elExpMove) elExpMove.textContent = '±' + fmtNum(expMove, 1) + ' pts';
    if (elExpRange) {
      const lower = spot - expMove;
      const upper = spot + expMove;
      elExpRange.textContent = `[${fmtNum(lower, 0)} - ${fmtNum(upper, 0)}]`;
    }

    const elCeOi = document.getElementById('upstoxTotalCeOi');
    if (elCeOi) elCeOi.textContent = fmtQty(data.totalCeOi);

    const elPeOi = document.getElementById('upstoxTotalPeOi');
    if (elPeOi) elPeOi.textContent = fmtQty(data.totalPeOi);

    // Update OI Concentration Split Bar
    const totCe = Number(data.totalCeOi || 0);
    const totPe = Number(data.totalPeOi || 0);
    const totAll = Math.max(1, totCe + totPe);
    const cePct = Math.round((totCe / totAll) * 100);
    const pePct = 100 - cePct;

    const rCe = document.getElementById('upstoxOiRatioCe');
    const rPe = document.getElementById('upstoxOiRatioPe');
    if (rCe) {
      rCe.style.width = cePct + '%';
      rCe.title = `Call Writers (Resistance): ${cePct}% (${fmtQty(totCe)})`;
    }
    if (rPe) {
      rPe.style.width = pePct + '%';
      rPe.title = `Put Writers (Support): ${pePct}% (${fmtQty(totPe)})`;
    }

    // Extract ATM row and quant metrics for Range BE & Force Ribbon Badges
    const rows = data.data || [];
    let atmRow = null;
    let minAtmDiff = Infinity;
    rows.forEach(r => {
      const diff = Math.abs(Number(r.strike_price || 0) - spot);
      if (diff < minAtmDiff) {
        minAtmDiff = diff;
        atmRow = r;
      }
    });

    const qm = atmRow ? (atmRow.quant_metrics || {}) : {};

    // 1. RANGE (BE)
    const elBe = document.getElementById('upstoxBeVal');
    if (elBe) {
      if (qm.lower_be && qm.upper_be) {
        elBe.textContent = `[${fmtNum(qm.lower_be, 0)} - ${fmtNum(qm.upper_be, 0)}]`;
      } else if (atmStraddle > 0) {
        elBe.textContent = `[${fmtNum(spot - atmStraddle, 0)} - ${fmtNum(spot + atmStraddle, 0)}]`;
      } else {
        elBe.textContent = '--';
      }
    }

    // 2. DIRECTIONAL FORCE
    const forceScore = Number(qm.force_score !== undefined ? qm.force_score : (pcr >= 1.0 ? (pcr - 1.0) * 80 : (pcr - 1.0) * 100));
    const elForceVal = document.getElementById('upstoxForceVal');
    const elForceTag = document.getElementById('upstoxForceTag');
    const elForceTabBadge = document.getElementById('upstoxForceTabBadge');

    if (elForceVal) {
      elForceVal.textContent = `${forceScore >= 0 ? '+' : ''}${forceScore.toFixed(1)}`;
      elForceVal.style.color = forceScore >= 12 ? '#10b981' : forceScore <= -12 ? '#ef4444' : '#fbbf24';
    }
    if (elForceTag) {
      if (forceScore >= 25) {
        elForceTag.textContent = '🟢 STRONG BULL';
        elForceTag.style.background = 'rgba(16, 185, 129, 0.2)';
        elForceTag.style.color = '#34d399';
      } else if (forceScore >= 8) {
        elForceTag.textContent = '🟢 MILD BULL';
        elForceTag.style.background = 'rgba(16, 185, 129, 0.15)';
        elForceTag.style.color = '#34d399';
      } else if (forceScore <= -25) {
        elForceTag.textContent = '🔴 STRONG BEAR';
        elForceTag.style.background = 'rgba(239, 68, 68, 0.2)';
        elForceTag.style.color = '#f87171';
      } else if (forceScore <= -8) {
        elForceTag.textContent = '🔴 MILD BEAR';
        elForceTag.style.background = 'rgba(239, 68, 68, 0.15)';
        elForceTag.style.color = '#f87171';
      } else {
        elForceTag.textContent = '🟡 BALANCED';
        elForceTag.style.background = 'rgba(245, 158, 11, 0.15)';
        elForceTag.style.color = '#fbbf24';
      }
    }
    if (elForceTabBadge) {
      elForceTabBadge.textContent = `${forceScore >= 0 ? '+' : ''}${forceScore.toFixed(0)}`;
      elForceTabBadge.style.color = forceScore >= 8 ? '#34d399' : forceScore <= -8 ? '#f87171' : '#38bdf8';
    }
  }



  // ==========================================================================
  // 📋 CLEAN & PROFESSIONAL MODERN OPTION CHAIN TABLE (MATCHING TARGET DESIGN)
  // ==========================================================================
  function renderTable(data) {
    const table = document.getElementById('upstoxChainTable');
    const tbody = document.getElementById('upstoxChainTableBody');
    const thead = document.getElementById('upstoxChainTableHead');
    if (!table || !tbody) return;

    const rows = data.data || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:48px; color:var(--text-muted);">No option strikes available for selected expiry.</td></tr>`;
      return;
    }

    const spot = Number(data.spotPrice || 0);

    // Render DTE Horizon Pills & Macro Stats Strip
    renderDteHorizonPills(data.availableExpiries || [], data.expiry);
    renderModernStatsStrip(data);

    // Calculate DTE
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let dte = 4;
    try {
      const expDate = new Date(data.expiry || Date.now());
      expDate.setHours(0, 0, 0, 0);
      dte = Math.max(0.5, (expDate - today) / (1000 * 60 * 60 * 24));
    } catch (_) {}

    // Find ATM index
    let atmIdx = 0;
    let minDiff = Infinity;
    rows.forEach((r, idx) => {
      const diff = Math.abs(Number(r.strike_price || 0) - spot);
      if (diff < minDiff) {
        minDiff = diff;
        atmIdx = idx;
      }
    });

    // Filter strikes by range
    let filteredRows = rows;
    if (state.strikeRange > 0) {
      const start = Math.max(0, atmIdx - state.strikeRange);
      const end = Math.min(rows.length, atmIdx + state.strikeRange + 1);
      filteredRows = rows.slice(start, end);
    }

    // Filter by search query if any
    const query = state.searchQuery.trim();
    if (query) {
      filteredRows = filteredRows.filter(r => String(r.strike_price).includes(query));
    }

    // 1. RENDER TABLE HEADERS (Image 1 Exact 13 Columns)
    if (thead) {
      thead.innerHTML = `
        <tr class="modern-head-row">
          <th style="text-align:right;">OI Change(%)</th>
          <th style="text-align:right;">OI Change</th>
          <th style="text-align:right;">OI</th>
          <th style="text-align:right;">IV</th>
          <th style="text-align:right;">Volume</th>
          <th style="text-align:right;">LTP</th>
          <th class="modern-th-strike" style="text-align:center;">Strike</th>
          <th style="text-align:left;">LTP</th>
          <th style="text-align:left;">Volume</th>
          <th style="text-align:left;">IV</th>
          <th style="text-align:left;">OI</th>
          <th style="text-align:left;">OI Change</th>
          <th style="text-align:left;">OI Change(%)</th>
        </tr>
      `;
    }

    tbody.innerHTML = '';
    let spotDividerInserted = false;

    // Running totals & max boundaries for relative bars
    let maxAnyOi = 1, maxAnyVol = 1, maxAnyGexOi = 1, maxAnyGexVol = 1;
    let sumCeOi = 0, sumCeOiChg = 0, sumCeVol = 0, sumCeIv = 0, countCeIv = 0;
    let sumPeOi = 0, sumPeOiChg = 0, sumPeVol = 0, sumPeIv = 0, countPeIv = 0;
    let sumGexOi = 0, sumGexVol = 0;

    filteredRows.forEach(r => {
      const ce = r.call_options || {};
      const pe = r.put_options || {};
      const ceMd = ce.market_data || {};
      const peMd = pe.market_data || {};
      const ceOi = Number(ceMd.oi || 0);
      const peOi = Number(peMd.oi || 0);
      const ceVol = Number(ceMd.volume || 0);
      const peVol = Number(peMd.volume || 0);

      if (ceOi > maxAnyOi) maxAnyOi = ceOi;
      if (peOi > maxAnyOi) maxAnyOi = peOi;
      if (ceVol > maxAnyVol) maxAnyVol = ceVol;
      if (peVol > maxAnyVol) maxAnyVol = peVol;

      const gex = calcGex(r, spot, dte);
      if (Math.abs(gex.gexOi) > maxAnyGexOi) maxAnyGexOi = Math.abs(gex.gexOi);
      if (Math.abs(gex.gexVol) > maxAnyGexVol) maxAnyGexVol = Math.abs(gex.gexVol);
    });

    filteredRows.forEach(r => {
      const strike = Number(r.strike_price || 0);
      const isAtm = Math.abs(strike - spot) === minDiff;

      const ce = r.call_options || {};
      const pe = r.put_options || {};

      const ceMd = ce.market_data || {};
      const peMd = pe.market_data || {};

      const ceGr = ce.option_greeks || {};
      const peGr = pe.option_greeks || {};

      const qm = r.quant_metrics || {};

      const ceOi = Number(ceMd.oi || 0);
      const peOi = Number(peMd.oi || 0);

      const cePrevOi = Number(ceMd.prev_oi !== undefined ? ceMd.prev_oi : (ceOi - (ceMd.oi_change || 0)));
      const pePrevOi = Number(peMd.prev_oi !== undefined ? peMd.prev_oi : (peOi - (peMd.oi_change || 0)));

      const ceOiChg = Number(ceMd.oi_change !== undefined ? ceMd.oi_change : (ceOi - cePrevOi));
      const peOiChg = Number(peMd.oi_change !== undefined ? peMd.oi_change : (peOi - pePrevOi));

      const ceVol = Number(ceMd.volume || 0);
      const peVol = Number(peMd.volume || 0);

      const ceLtp = Number(ceMd.ltp || 0);
      const peLtp = Number(peMd.ltp || 0);

      const ceChg = Number(ceMd.net_change || 0);
      const peChg = Number(peMd.net_change || 0);

      const ceChgPct = Number(ceMd.close_price ? (ceChg / ceMd.close_price * 100) : 0);
      const peChgPct = Number(peMd.close_price ? (peChg / peMd.close_price * 100) : 0);

      const ceOiChgPct = cePrevOi > 0 ? ((ceOiChg / cePrevOi) * 100) : 0;
      const peOiChgPct = pePrevOi > 0 ? ((peOiChg / pePrevOi) * 100) : 0;

      const ceIv = Number(ceGr.iv || qm.ce_iv || 12.0);
      const peIv = Number(peGr.iv || qm.pe_iv || 12.0);

      const gex = calcGex(r, spot, dte);

      sumCeOi += ceOi;
      sumCeOiChg += ceOiChg;
      sumCeVol += ceVol;
      if (ceIv > 0) { sumCeIv += ceIv; countCeIv++; }

      sumPeOi += peOi;
      sumPeOiChg += peOiChg;
      sumPeVol += peVol;
      if (peIv > 0) { sumPeIv += peIv; countPeIv++; }

      sumGexOi += gex.gexOi;
      sumGexVol += gex.gexVol;

      // Check if spot divider pill row should be placed before this strike
      if (!spotDividerInserted && strike >= spot) {
        spotDividerInserted = true;
        const spotRow = document.createElement('tr');
        spotRow.className = 'modern-spot-divider-row';
        const leftSpan = 6;
        const rightSpan = 6;
        spotRow.innerHTML = `
          <td colspan="${leftSpan}" class="modern-spot-divider-bar"></td>
          <td class="modern-spot-divider-cell">
            <div class="modern-spot-pill" title="Underlying Live Spot: ₹${fmtNum(spot, 2)}">
              ${spot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </td>
          <td colspan="${rightSpan}" class="modern-spot-divider-bar"></td>
        `;
        tbody.appendChild(spotRow);
      }

      const ceOiBarWidth = Math.min(100, Math.round((ceOi / maxAnyOi) * 100));
      const peOiBarWidth = Math.min(100, Math.round((peOi / maxAnyOi) * 100));
      const ceVolBarWidth = Math.min(100, Math.round((ceVol / maxAnyVol) * 100));
      const peVolBarWidth = Math.min(100, Math.round((peVol / maxAnyVol) * 100));

      const gexOiBarW = Math.min(100, Math.round((Math.abs(gex.gexOi) / maxAnyGexOi) * 100));
      const gexVolBarW = Math.min(100, Math.round((Math.abs(gex.gexVol) / maxAnyGexVol) * 100));

      const tr = document.createElement('tr');
      tr.className = `modern-opt-row ${isAtm ? 'is-atm' : ''}`;
      tr.dataset.strike = strike;
      tr.style.cursor = 'pointer';

      // Click on row opens strike radar modal
      tr.addEventListener('click', () => {
        openStrikeModal(r, spot, isAtm);
      });

      // RENDER ROW (Image 1 Exact 13 Columns)
      const ceLtpClass = ceChg >= 0 ? 'up' : 'down';
      const peLtpClass = peChg >= 0 ? 'up' : 'down';

      tr.innerHTML = `
        <!-- Calls (Left) -->
        <td style="text-align:right; font-family:'JetBrains Mono',monospace; font-size:11px;">
          ${ceOiChgPct !== 0 ? `<span class="${ceOiChgPct >= 0 ? 'modern-num-green' : 'modern-num-red'}">${ceOiChgPct >= 0 ? '+' : ''}${ceOiChgPct.toFixed(2)}%</span>` : '--'}
        </td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace; font-size:11.5px;">
          ${ceOiChg !== 0 ? `<span class="${ceOiChg >= 0 ? 'modern-num-green' : 'modern-num-red'}">${fmtMillionQty(ceOiChg)}</span>` : '--'}
        </td>
        <td class="modern-cell-oi" style="text-align:right;">
          <div class="modern-oi-fill ce" style="width:${ceOiBarWidth}%;"></div>
          <span class="modern-oi-text">${fmtMillionQty(ceOi)}</span>
        </td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace; font-size:11.5px; color:#64748b;">
          ${ceIv > 0 ? ceIv.toFixed(2) : '--'}
        </td>
        <td class="modern-cell-vol" style="text-align:right;">
          <div class="modern-vol-fill ce" style="width:${ceVolBarWidth}%;"></div>
          <span class="modern-vol-text">${fmtMillionQty(ceVol)}</span>
        </td>
        <td style="text-align:right; padding:4px 6px;">
          <span class="modern-ltp-pill ${ceLtpClass}">${fmtNum(ceLtp, 2)}</span>
        </td>

        <!-- Center Strike Column -->
        <td class="modern-cell-strike">
          <span class="modern-strike-num">${strike.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </td>

        <!-- Puts (Right) -->
        <td style="text-align:left; padding:4px 6px;">
          <span class="modern-ltp-pill ${peLtpClass}">${fmtNum(peLtp, 2)}</span>
        </td>
        <td class="modern-cell-vol" style="text-align:left;">
          <div class="modern-vol-fill pe" style="width:${peVolBarWidth}%;"></div>
          <span class="modern-vol-text">${fmtMillionQty(peVol)}</span>
        </td>
        <td style="text-align:left; font-family:'JetBrains Mono',monospace; font-size:11.5px; color:#64748b;">
          ${peIv > 0 ? peIv.toFixed(2) : '--'}
        </td>
        <td class="modern-cell-oi" style="text-align:left;">
          <div class="modern-oi-fill pe" style="width:${peOiBarWidth}%;"></div>
          <span class="modern-oi-text">${fmtMillionQty(peOi)}</span>
        </td>
        <td style="text-align:left; font-family:'JetBrains Mono',monospace; font-size:11.5px;">
          ${peOiChg !== 0 ? `<span class="${peOiChg >= 0 ? 'modern-num-green' : 'modern-num-red'}">${fmtMillionQty(peOiChg)}</span>` : '--'}
        </td>
        <td style="text-align:left; font-family:'JetBrains Mono',monospace; font-size:11px;">
          ${peOiChgPct !== 0 ? `<span class="${peOiChg >= 0 ? 'modern-num-green' : 'modern-num-red'}">${peOiChgPct >= 0 ? '+' : ''}${peOiChgPct.toFixed(2)}%</span>` : '--'}
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Update Totals Footer (Only OI, Volume, OI Change Calculated - Total Centered Under Strike)
    const tfoot = document.getElementById('upstoxChainTableFoot');
    if (tfoot) {
      tfoot.style.display = '';
      tfoot.innerHTML = `
        <tr class="modern-foot-row">
          <td></td>
          <td id="modernFootCeOiChg" style="text-align:right; font-weight:800; font-family:'JetBrains Mono',monospace;">Σ ${fmtMillionQty(sumCeOiChg)}</td>
          <td id="modernFootCeOi" style="text-align:right; font-weight:800; font-family:'JetBrains Mono',monospace;">Σ ${fmtMillionQty(sumCeOi)}</td>
          <td></td>
          <td id="modernFootCeVol" style="text-align:right; font-weight:800; font-family:'JetBrains Mono',monospace;">Σ ${fmtMillionQty(sumCeVol)}</td>
          <td></td>
          <td class="modern-foot-strike" style="text-align:center; font-weight:800; font-size:12px; color:#2563eb;">Total</td>
          <td></td>
          <td id="modernFootPeVol" style="text-align:left; font-weight:800; font-family:'JetBrains Mono',monospace;">Σ ${fmtMillionQty(sumPeVol)}</td>
          <td></td>
          <td id="modernFootPeOi" style="text-align:left; font-weight:800; font-family:'JetBrains Mono',monospace;">Σ ${fmtMillionQty(sumPeOi)}</td>
          <td id="modernFootPeOiChg" style="text-align:left; font-weight:800; font-family:'JetBrains Mono',monospace;">Σ ${fmtMillionQty(sumPeOiChg)}</td>
          <td></td>
        </tr>
      `;
    }
  }

  // Open Strike Intelligence Deep-Dive Modal
  function openStrikeModal(row, spot, isAtm) {
    const modal = document.getElementById('upstoxStrikeModal');
    if (!modal) return;

    const sp = Number(row.strike_price || 0);
    const ce = row.call_options || {};
    const pe = row.put_options || {};
    const ceMd = ce.market_data || {};
    const peMd = pe.market_data || {};
    const ceGr = ce.option_greeks || {};
    const peGr = pe.option_greeks || {};
    const qm = row.quant_metrics || {};

    const diff = sp - spot;
    const isCallItm = sp < spot;

    // Title & Badges
    const elTitle = document.getElementById('modalStrikeTitle');
    if (elTitle) elTitle.textContent = `${sp.toLocaleString('en-IN')} STRIKE RADAR`;

    const elMoneyness = document.getElementById('modalMoneynessTag');
    if (elMoneyness) {
      if (isAtm) {
        elMoneyness.className = 'modal-badge atm';
        elMoneyness.textContent = 'ATM (AT-THE-MONEY)';
      } else if (isCallItm) {
        elMoneyness.className = 'modal-badge itm-ce';
        elMoneyness.textContent = 'CALL ITM / PUT OTM';
      } else {
        elMoneyness.className = 'modal-badge itm-pe';
        elMoneyness.textContent = 'PUT ITM / CALL OTM';
      }
    }

    const elDist = document.getElementById('modalDistanceTag');
    if (elDist) {
      const sign = diff >= 0 ? '+' : '';
      elDist.textContent = `Spot Distance: ${sign}${fmtNum(diff, 1)} pts`;
    }

    const elUnderlying = document.getElementById('modalUnderlyingSubtitle');
    if (elUnderlying) {
      const undName = (state.chainData?.underlying || 'NIFTY').toUpperCase();
      const expDate = state.chainData?.expiry || state.expiryDate || '';
      elUnderlying.textContent = `${undName} • Expiry: ${expDate} • Spot: ₹${fmtNum(spot, 2)}`;
    }

    // 1. Prem & Straddle Breakevens
    const ceLtp = Number(ceMd.ltp || 0);
    const peLtp = Number(peMd.ltp || 0);
    const straddle = qm.straddle_prem || Number((ceLtp + peLtp).toFixed(2));
    const lowerBe = qm.lower_be || Number((sp - straddle).toFixed(1));
    const upperBe = qm.upper_be || Number((sp + straddle).toFixed(1));

    const elPrem = document.getElementById('modalStraddlePrem');
    if (elPrem) elPrem.textContent = `₹${fmtNum(straddle, 2)}`;

    const elPremSkew = document.getElementById('modalPremSkew');
    if (elPremSkew) {
      const pSkew = qm.prem_skew_pct !== undefined ? qm.prem_skew_pct : Number((((ceLtp - peLtp) / Math.max(0.1, ceLtp + peLtp)) * 100).toFixed(1));
      const isCallRich = pSkew >= 0;
      elPremSkew.textContent = `Prem Skew: ${isCallRich ? '+' : ''}${pSkew}% (${isCallRich ? 'Call Richer' : 'Put Richer'})`;
      elPremSkew.style.color = isCallRich ? '#34d399' : '#f87171';
    }

    const elLowerBe = document.getElementById('modalLowerBe');
    if (elLowerBe) elLowerBe.textContent = `₹${fmtNum(lowerBe, 1)}`;

    const elUpperBe = document.getElementById('modalUpperBe');
    if (elUpperBe) elUpperBe.textContent = `₹${fmtNum(upperBe, 1)}`;

    // Directional Force
    const fScore = qm.force_score !== undefined ? qm.force_score : 0;
    const elForceVal = document.getElementById('modalForceVal');
    const elForceSig = document.getElementById('modalForceSignal');
    if (elForceVal) {
      elForceVal.textContent = (fScore >= 0 ? '+' : '') + fScore;
      elForceVal.style.color = fScore > 20 ? '#34d399' : fScore < -20 ? '#f87171' : '#38bdf8';
    }
    if (elForceSig) {
      const bForce = qm.bullish_force !== undefined ? qm.bullish_force : 50;
      const beForce = qm.bearish_force !== undefined ? qm.bearish_force : 50;
      let label = 'NEUTRAL CONSOLIDATION';
      if (fScore >= 40) label = 'STRONG BULLISH FLOW';
      else if (fScore >= 15) label = 'MODERATE BULLISH';
      else if (fScore <= -40) label = 'STRONG BEARISH WALL';
      else if (fScore <= -15) label = 'MODERATE BEARISH';
      elForceSig.textContent = `${label} (Bull: ${bForce} | Bear: ${beForce})`;
    }

    // 2. OI & Day OI
    const ceOi = Number(ceMd.oi || 0);
    const peOi = Number(peMd.oi || 0);
    const ceDayOiPct = qm.ce_day_oi_pct !== undefined ? qm.ce_day_oi_pct : 0;
    const peDayOiPct = qm.pe_day_oi_pct !== undefined ? qm.pe_day_oi_pct : 0;

    const elCeOi = document.getElementById('modalCeOi');
    if (elCeOi) elCeOi.textContent = fmtQty(ceOi);
    const elCeDayOi = document.getElementById('modalCeDayOi');
    if (elCeDayOi) {
      elCeDayOi.textContent = (ceDayOiPct >= 0 ? '+' : '') + ceDayOiPct + '% Day';
      elCeDayOi.className = ceDayOiPct >= 0 ? 'm-pill green' : 'm-pill red';
    }

    const elPeOi = document.getElementById('modalPeOi');
    if (elPeOi) elPeOi.textContent = fmtQty(peOi);
    const elPeDayOi = document.getElementById('modalPeDayOi');
    if (elPeDayOi) {
      elPeDayOi.textContent = (peDayOiPct >= 0 ? '+' : '') + peDayOiPct + '% Day';
      elPeDayOi.className = peDayOiPct >= 0 ? 'm-pill green' : 'm-pill red';
    }

    // 3. OI Percentile
    const elCePctile = document.getElementById('modalCePctile');
    const elPePctile = document.getElementById('modalPePctile');
    if (elCePctile) elCePctile.textContent = `${qm.ce_oi_pctile || 0}%ile`;
    if (elPePctile) elPePctile.textContent = `${qm.pe_oi_pctile || 0}%ile`;

    const elPctileDesc = document.getElementById('modalPctileDesc');
    if (elPctileDesc) {
      const topWall = Math.max(qm.ce_oi_pctile || 0, qm.pe_oi_pctile || 0);
      if (topWall >= 90) elPctileDesc.textContent = '🔥 Heavy Institutional Concentration Wall (>90%ile)';
      else if (topWall >= 75) elPctileDesc.textContent = '⚡ Significant Liquidity Zone (75-90%ile)';
      else elPctileDesc.textContent = 'Normal liquidity strike (<75%ile)';
    }

    // 4. Writer Skew & Dominance
    const wSkew = qm.write_skew !== undefined ? qm.write_skew : 0;
    const elWriteSkew = document.getElementById('modalWriteSkew');
    const elWriterDom = document.getElementById('modalWriterDominance');
    if (elWriteSkew) {
      elWriteSkew.textContent = (wSkew >= 0 ? '+' : '') + wSkew + '%';
      elWriteSkew.style.color = wSkew > 15 ? '#34d399' : wSkew < -15 ? '#f87171' : '#fbbf24';
    }
    if (elWriterDom) {
      if (wSkew >= 25) elWriterDom.textContent = '🟢 Heavy Put Writing (Strong Floor / Bullish Support)';
      else if (wSkew <= -25) elWriterDom.textContent = '🔴 Heavy Call Writing (Strong Ceiling / Bearish Resistance)';
      else elWriterDom.textContent = '🟡 Balanced Writing Pressure';
    }

    // 5. Prem Flow
    const elCeFlow = document.getElementById('modalCeFlow');
    const elPeFlow = document.getElementById('modalPeFlow');
    const elNetFlow = document.getElementById('modalNetFlow');
    if (elCeFlow) elCeFlow.textContent = `₹${qm.ce_prem_flow_cr || 0} Cr`;
    if (elPeFlow) elPeFlow.textContent = `₹${qm.pe_prem_flow_cr || 0} Cr`;
    if (elNetFlow) {
      const nFlow = qm.net_prem_flow_cr || 0;
      elNetFlow.textContent = `${nFlow >= 0 ? '+' : ''}₹${nFlow} Cr`;
      elNetFlow.style.color = nFlow >= 0 ? '#34d399' : '#f87171';
    }

    // 6. Turnover & Volume
    const elCeVol = document.getElementById('modalCeVol');
    const elPeVol = document.getElementById('modalPeVol');
    const elTurnover = document.getElementById('modalTurnover');
    if (elCeVol) elCeVol.textContent = fmtQty(ceMd.volume);
    if (elPeVol) elPeVol.textContent = fmtQty(peMd.volume);
    if (elTurnover) elTurnover.textContent = `₹${qm.total_turnover_cr || 0} Cr`;

    // 7. Call:Put & IV Skew
    const elCp = document.getElementById('modalCpRatio');
    const elIvSkew = document.getElementById('modalIvSkew');
    const elMaxPainDist = document.getElementById('modalMaxPainDist');
    if (elCp) elCp.textContent = qm.call_put_ratio !== undefined ? `${qm.call_put_ratio}:1` : '--';
    if (elIvSkew) {
      const ivs = qm.iv_skew || 0;
      elIvSkew.textContent = `${ivs >= 0 ? '+' : ''}${ivs}%`;
      elIvSkew.style.color = ivs > 0 ? '#34d399' : '#f87171';
    }
    if (elMaxPainDist) {
      const mp = qm.max_pain_strike || (state.chainData?.maxPain || 0);
      const mpDiff = sp - mp;
      elMaxPainDist.textContent = `${mpDiff === 0 ? 'AT MAX PAIN' : (mpDiff > 0 ? `+${mpDiff} pts above` : `${mpDiff} pts below`)} (₹${fmtNum(mp, 0)})`;
    }

    // 8. Greeks Table
    const elCeD = document.getElementById('mCeDelta');
    const elPeD = document.getElementById('mPeDelta');
    if (elCeD) elCeD.textContent = ceGr.delta !== undefined ? fmtNum(ceGr.delta, 3) : '--';
    if (elPeD) elPeD.textContent = peGr.delta !== undefined ? fmtNum(peGr.delta, 3) : '--';

    const elCeT = document.getElementById('mCeTheta');
    const elPeT = document.getElementById('mPeTheta');
    if (elCeT) elCeT.textContent = ceGr.theta !== undefined ? `₹${fmtNum(ceGr.theta, 2)}/day` : '--';
    if (elPeT) elPeT.textContent = peGr.theta !== undefined ? `₹${fmtNum(peGr.theta, 2)}/day` : '--';

    const elCeV = document.getElementById('mCeVega');
    const elPeV = document.getElementById('mPeVega');
    if (elCeV) elCeV.textContent = ceGr.vega !== undefined ? `₹${fmtNum(ceGr.vega, 2)}` : '--';
    if (elPeV) elPeV.textContent = peGr.vega !== undefined ? `₹${fmtNum(peGr.vega, 2)}` : '--';

    const elCeG = document.getElementById('mCeGamma');
    const elPeG = document.getElementById('mPeGamma');
    if (elCeG) elCeG.textContent = ceGr.gamma !== undefined ? fmtNum(ceGr.gamma, 4) : '--';
    if (elPeG) elPeG.textContent = peGr.gamma !== undefined ? fmtNum(peGr.gamma, 4) : '--';

    const elCeIv = document.getElementById('mCeIv');
    const elPeIv = document.getElementById('mPeIv');
    if (elCeIv) elCeIv.textContent = ceGr.iv ? `${fmtNum(ceGr.iv, 2)}%` : '--';
    if (elPeIv) elPeIv.textContent = peGr.iv ? `${fmtNum(peGr.iv, 2)}%` : '--';

    // Hook up modal action buttons
    const btnDesk = document.getElementById('btnModalStraddleDesk');
    if (btnDesk) {
      btnDesk.onclick = () => {
        closeModal();
        if (typeof window.instNav === 'function') {
          window.instNav('straddles');
        } else if (typeof window.switchTab === 'function') {
          window.switchTab('straddle');
        }
      };
    }

    const btnCopy = document.getElementById('btnModalCopyStrike');
    if (btnCopy) {
      btnCopy.onclick = () => {
        const text = `Strike: ${sp} | Spot: ${spot} | CE LTP: ₹${ceLtp} | PE LTP: ₹${peLtp} | Straddle: ₹${straddle} | Range: [${lowerBe} - ${upperBe}] | PCR: ${qm.call_put_ratio || '--'}`;
        navigator.clipboard?.writeText(text).then(() => {
          btnCopy.textContent = '✅ Copied!';
          setTimeout(() => { btnCopy.textContent = '📋 Copy Strike Data'; }, 2000);
        });
      };
    }

    modal.style.display = 'flex';
  }

  function closeModal() {
    const modal = document.getElementById('upstoxStrikeModal');
    if (modal) modal.style.display = 'none';
  }

  function centerToAtm() {
    const atmRow = document.querySelector('.upstox-chain-row.is-atm') || document.querySelector('.upstox-spot-line-row');
    const container = document.getElementById('upstoxTableScrollContainer');
    if (atmRow && container) {
      const rowTop = atmRow.offsetTop;
      const containerHeight = container.clientHeight;
      container.scrollTo({
        top: Math.max(0, rowTop - containerHeight / 2 + 30),
        behavior: 'smooth'
      });
    }
  }

  // ==========================================================================
  // ⚡ SUB-TAB SWITCHING & ACTIVE PANE DISPATCHER
  // ==========================================================================
  function switchUpstoxTab(tabName) {
    state.activeTab = tabName;
    const btns = document.querySelectorAll('#upstoxSubnavBar .go-subtab-btn');
    btns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-upstox-tab') === tabName);
    });

    const panes = {
      chain: document.getElementById('upstoxPaneChain'),
      force: document.getElementById('upstoxPaneForce'),
      maxpain: document.getElementById('upstoxPaneMaxPain'),
      oidist: document.getElementById('upstoxPaneOiDist'),
      greeks: document.getElementById('upstoxPaneGreeks'),
    };

    Object.keys(panes).forEach(k => {
      if (panes[k]) {
        if (k === tabName) {
          panes[k].style.display = 'block';
          panes[k].classList.add('active');
        } else {
          panes[k].style.display = 'none';
          panes[k].classList.remove('active');
        }
      }
    });

    if (state.chainData) {
      renderActivePane(state.chainData);
    }
  }

  function renderActivePane(data) {
    if (!data) return;
    if (state.activeTab === 'force') {
      renderForcePane(data);
    } else if (state.activeTab === 'maxpain') {
      renderMaxPainPane(data);
    } else if (state.activeTab === 'oidist') {
      renderOiDistPane(data);
    } else if (state.activeTab === 'greeks') {
      renderGreeksPane(data);
    }
  }

  // ==========================================================================
  // ⚡ 14-METRIC OPTION VISUALIZER TOOL (IMAGE 15 STYLE)
  // ==========================================================================
  // ⚡ 14-METRIC OPTION VISUALIZER TOOL (WITH 3 REFERENCE MODES: IMAGES 1, 2, 3)
  // ==========================================================================
  const VIS_METRICS_CONFIG = {
    turnover: {
      title: 'Turnover (₹ Cr)',
      sub: 'Strike-wise institutional derivative turnover • Click any bar for deep radar',
      callLabel: 'Call Turnover',
      putLabel: 'Put Turnover',
      format: 'cr',
      getVals: (r) => {
        const m = r.quant_metrics || {};
        return {
          call: Number(m.ce_turnover_cr || 0),
          put: Number(m.pe_turnover_cr || 0)
        };
      }
    },
    oi: {
      title: 'Open Interest (Contracts)',
      sub: 'Open Interest depth distribution across strikes • Zero baseline',
      callLabel: 'Call OI',
      putLabel: 'Put OI',
      format: 'qty',
      getVals: (r) => ({
        call: Number(r.call_options?.market_data?.oi || 0),
        put: Number(r.put_options?.market_data?.oi || 0)
      })
    },
    oichg: {
      title: 'Change in Open Interest (Contracts)',
      sub: 'Net intraday position buildup (fresh writes vs unwinding) • Zero baseline (Image 2)',
      callLabel: 'Call OI Chg',
      putLabel: 'Put OI Chg',
      format: 'qty',
      getVals: (r) => ({
        call: Number(r.call_options?.market_data?.oi_change || 0),
        put: Number(r.put_options?.market_data?.oi_change || 0)
      })
    },
    prem: {
      title: 'Option Premium / LTP (₹)',
      sub: 'Call vs Put market price per strike',
      callLabel: 'Call LTP',
      putLabel: 'Put LTP',
      format: 'price',
      getVals: (r) => ({
        call: Number(r.call_options?.market_data?.ltp || 0),
        put: Number(r.put_options?.market_data?.ltp || 0)
      })
    },
    premskew: {
      title: 'Premium Skew (Call LTP vs Put LTP)',
      sub: 'Pricing imbalance between Call and Put options',
      callLabel: 'Call LTP',
      putLabel: 'Put LTP',
      format: 'price',
      getVals: (r) => ({
        call: Number(r.call_options?.market_data?.ltp || 0),
        put: Number(r.put_options?.market_data?.ltp || 0)
      })
    },
    maxpain: {
      title: 'Max Pain Strike Valuation (₹ Cr Loss)',
      sub: 'Cumulative option writer theoretical loss by strike',
      callLabel: 'Call Loss',
      putLabel: 'Put Loss',
      format: 'cr',
      getVals: (r, allRows) => {
        const sp = Number(r.strike_price || 0);
        const lotSz = (state.instrumentKey || '').includes('BANK') ? 15 : 25;
        let callLoss = 0, putLoss = 0;
        allRows.forEach(row => {
          const s = Number(row.strike_price || 0);
          const cOi = Number(row.call_options?.market_data?.oi || 0);
          const pOi = Number(row.put_options?.market_data?.oi || 0);
          if (sp > s) callLoss += (sp - s) * cOi * lotSz / 10000000;
          if (sp < s) putLoss += (s - sp) * pOi * lotSz / 10000000;
        });
        return { call: callLoss, put: putLoss };
      }
    },
    oipctile: {
      title: 'Open Interest Percentile Rank (%)',
      sub: 'Chain-wide liquidity concentration wall percentile',
      callLabel: 'Call %ile',
      putLabel: 'Put %ile',
      format: 'pct',
      getVals: (r) => {
        const m = r.quant_metrics || {};
        return {
          call: Number(m.ce_oi_pctile || 0),
          put: Number(m.pe_oi_pctile || 0)
        };
      }
    },
    writeskew: {
      title: 'Writer Dominance Skew (%)',
      sub: 'Institutional writer skew: Positive = Put writing (Support), Negative = Call writing (Resistance)',
      callLabel: 'Call Writing Bias',
      putLabel: 'Put Writing Bias',
      format: 'pct',
      getVals: (r) => {
        const ws = Number(r.quant_metrics?.write_skew || 0);
        return {
          call: ws < 0 ? ws : 0,
          put: ws > 0 ? ws : 0
        };
      }
    },
    premflow: {
      title: 'Premium Flow (₹ Cr)',
      sub: 'Total premium traded (Volume × Price) across strikes',
      callLabel: 'Call Prem Flow',
      putLabel: 'Put Prem Flow',
      format: 'cr',
      getVals: (r) => {
        const m = r.quant_metrics || {};
        return {
          call: Number(m.ce_prem_flow_cr || 0),
          put: Number(m.pe_prem_flow_cr || 0)
        };
      }
    },
    volume: {
      title: 'Volume (Contracts)',
      sub: 'Intraday contract trading activity by strike',
      callLabel: 'Call Volume',
      putLabel: 'Put Volume',
      format: 'qty',
      getVals: (r) => ({
        call: Number(r.call_options?.market_data?.volume || 0),
        put: Number(r.put_options?.market_data?.volume || 0)
      })
    },
    callput: {
      title: 'Call to Put Ratio (%)',
      sub: 'Relative volume share of Call vs Put per strike',
      callLabel: 'Call % Share',
      putLabel: 'Put % Share',
      format: 'pct',
      getVals: (r) => {
        const cVol = Number(r.call_options?.market_data?.volume || 0);
        const pVol = Number(r.put_options?.market_data?.volume || 0);
        const tot = Math.max(1, cVol + pVol);
        return {
          call: (cVol / tot) * 100,
          put: (pVol / tot) * 100
        };
      }
    },
    force: {
      title: 'Institutional Directional Force Score',
      sub: 'Aggressive buying/selling pressure (Bull Force vs Bear Force)',
      callLabel: 'Bullish Force',
      putLabel: 'Bearish Force',
      format: 'pct',
      getVals: (r) => {
        const m = r.quant_metrics || {};
        return {
          call: Number(m.bullish_force !== undefined ? m.bullish_force : 50),
          put: Number(m.bearish_force !== undefined ? m.bearish_force : 50)
        };
      }
    },
    ivskew: {
      title: 'Implied Volatility (IV %)',
      sub: 'Implied Volatility surface comparison Call vs Put',
      callLabel: 'Call IV',
      putLabel: 'Put IV',
      format: 'pct',
      getVals: (r) => ({
        call: Number(r.call_options?.option_greeks?.iv || 0),
        put: Number(r.put_options?.option_greeks?.iv || 0)
      })
    },
    dayoi: {
      title: 'Day Open Interest % Change',
      sub: 'Net percentage growth or contraction in open positions today',
      callLabel: 'Call Day OI %',
      putLabel: 'Put Day OI %',
      format: 'pct',
      getVals: (r) => {
        const m = r.quant_metrics || {};
        return {
          call: Number(m.ce_day_oi_pct || 0),
          put: Number(m.pe_day_oi_pct || 0)
        };
      }
    },
    gex_oi: {
      title: 'Gamma Exposure - Open Interest (GEX-OI)',
      sub: 'Institutional Dealer Gamma Exposure across strikes • Positive suppresses volatility, Negative expands volatility (Image 2)',
      callLabel: 'Positive GEX (Calls)',
      putLabel: 'Negative GEX (Puts)',
      format: 'gex',
      getVals: (r, allRows, spot) => {
        const { gexOi } = calcGex(r, spot, 4);
        return {
          call: gexOi >= 0 ? gexOi : 0,
          put: gexOi < 0 ? gexOi : 0,
          net: gexOi
        };
      }
    },
    gex_vol: {
      title: 'Gamma Exposure - Volume Flow (GEX-Vol)',
      sub: 'Intraday flow gamma exposure from contract volumes • Image 2 Matrix',
      callLabel: 'Positive Vol GEX',
      putLabel: 'Negative Vol GEX',
      format: 'gex',
      getVals: (r, allRows, spot) => {
        const { gexVol } = calcGex(r, spot, 4);
        return {
          call: gexVol >= 0 ? gexVol : 0,
          put: gexVol < 0 ? gexVol : 0,
          net: gexVol
        };
      }
    }
  };

  function formatValByMetric(val, fmt) {
    if (val === null || val === undefined || isNaN(val)) return '--';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (fmt === 'cr') return `${sign}${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
    if (fmt === 'qty') {
      if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)} Cr`;
      if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(2)} L`;
      if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} k`;
      return `${sign}${abs.toLocaleString('en-IN')}`;
    }
    if (fmt === 'gex') return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (fmt === 'price') return `₹${num.toFixed(2)}`;
    if (fmt === 'pct') return `${num.toFixed(1)}%`;
    return Number(val).toLocaleString('en-IN');
  }

  function renderVisualizerChart(data) {
    const canvas = document.getElementById('optVisCanvas');
    if (!canvas || !data) return;

    // Visibility Guard: Don't render canvas when panel is hidden or unattached
    const panel = document.getElementById('panelUpstoxChain');
    if (!panel || panel.style.display === 'none' || panel.offsetParent === null) return;

    const wrap = document.getElementById('optVisCanvasWrap');
    if (!wrap || wrap.offsetParent === null) return;

    const rect = wrap.getBoundingClientRect();
    const w = Math.floor(rect.width);
    if (w < 100) return;

    const spot = Number(data.spotPrice || 0);
    const atmStrike = Number(data.atmStrike || spot);
    const elAtm = document.getElementById('optVisAtmBadge');
    if (elAtm) elAtm.textContent = `ATM: ${atmStrike.toLocaleString('en-IN')}`;

    // HiDPI Canvas Setup
    const dpr = window.devicePixelRatio || 1;
    const h = 320;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const isLight = document.documentElement.getAttribute('data-theme') !== 'dark' && document.body.getAttribute('data-theme') !== 'dark';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#475569' : '#94a3b8';

    const viewMode = state.visViewMode || 'strike';

    // =========================================================================
    // VIEW MODE 2: 📈 INTRADAY PCR VS SPOT TREND (REFERENCE IMAGE 1)
    // =========================================================================
    if (viewMode === 'pcr') {
      const elTitle = document.getElementById('optVisChartTitle');
      if (elTitle) elTitle.textContent = 'Intraday PCR vs Spot Trend (Dual-Axis)';
      const elSub = document.getElementById('optVisChartSub');
      if (elSub) elSub.textContent = 'Reference Image 1 • PCR curve (Left Axis - Red) vs Underlying Spot Price (Right Axis - Green) • 09:15 to 15:30';

      const pts = (data.intradayTimeline && data.intradayTimeline.length >= 10) ? data.intradayTimeline : generateClientTimeline(spot, Number(data.pcr || 0.85), Number(data.maxPain || spot));
      if (!pts || pts.length === 0) return;

      const padL = 60, padR = 75, padT = 25, padB = 40;
      const plotW = Math.max(20, w - padL - padR);
      const plotH = Math.max(20, h - padT - padB);

      let minPcr = Math.min(...pts.map(p => p.pcr));
      let maxPcr = Math.max(...pts.map(p => p.pcr));
      minPcr = Math.max(0, Math.floor(minPcr * 10) / 10 - 0.1);
      maxPcr = Math.ceil(maxPcr * 10) / 10 + 0.1;
      const pcrSpan = Math.max(0.1, maxPcr - minPcr);

      let minSpot = Math.min(...pts.map(p => p.spot));
      let maxSpot = Math.max(...pts.map(p => p.spot));
      const sPad = Math.max(20, (maxSpot - minSpot) * 0.15);
      minSpot = Math.floor(minSpot - sPad);
      maxSpot = Math.ceil(maxSpot + sPad);
      const spotSpan = Math.max(10, maxSpot - minSpot);

      const getX = (idx) => padL + (idx / Math.max(1, pts.length - 1)) * plotW;
      const getPcrY = (val) => padT + plotH - ((val - minPcr) / pcrSpan) * plotH;
      const getSpotY = (val) => padT + plotH - ((val - minSpot) / spotSpan) * plotH;

      // Grid lines and ticks
      const yTicks = 4;
      ctx.font = '10px "JetBrains Mono", monospace';
      for (let i = 0; i <= yTicks; i++) {
        const frac = i / yTicks;
        const pVal = minPcr + pcrSpan * frac;
        const sVal = minSpot + spotSpan * frac;
        const yPos = padT + plotH - frac * plotH;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, yPos);
        ctx.lineTo(padL + plotW, yPos);
        ctx.stroke();
        ctx.setLineDash([]);

        // Left tick: PCR (Red #ef4444)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(pVal.toFixed(2), padL - 8, yPos);

        // Right tick: Spot (Green #10b981)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#10b981';
        ctx.fillText(sVal.toLocaleString('en-IN', { maximumFractionDigits: 0 }), padL + plotW + 8, yPos);
      }

      // Baseline
      ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      // PCR Fill Area & Curve (Red)
      const gradPcr = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      gradPcr.addColorStop(0, 'rgba(239, 68, 68, 0.18)');
      gradPcr.addColorStop(1, 'rgba(239, 68, 68, 0.01)');

      ctx.beginPath();
      ctx.moveTo(getX(0), getPcrY(pts[0].pcr));
      pts.forEach((p, idx) => ctx.lineTo(getX(idx), getPcrY(p.pcr)));
      ctx.lineTo(getX(pts.length - 1), padT + plotH);
      ctx.lineTo(getX(0), padT + plotH);
      ctx.closePath();
      ctx.fillStyle = gradPcr;
      ctx.fill();

      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = getX(idx);
        const y = getPcrY(p.pcr);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Spot Line (Green)
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = getX(idx);
        const y = getSpotY(p.spot);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Time X labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = textColor;
      const xStep = Math.max(1, Math.floor(pts.length / 6));
      pts.forEach((p, idx) => {
        if (idx % xStep === 0 || idx === pts.length - 1) {
          ctx.fillText(p.time, getX(idx), padT + plotH + 8);
        }
      });

      // Hover Crosshair
      state.visChartBounds = pts.map((p, idx) => ({
        x: getX(idx),
        x1: getX(Math.max(0, idx - 0.5)),
        x2: getX(Math.min(pts.length - 1, idx + 0.5)),
        pt: p
      }));

      if (state.visHoverIndex >= 0 && state.visHoverIndex < pts.length) {
        const hp = pts[state.visHoverIndex];
        const hx = getX(state.visHoverIndex);
        const hyPcr = getPcrY(hp.pcr);
        const hySpot = getSpotY(hp.spot);

        ctx.save();
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, padT);
        ctx.lineTo(hx, padT + plotH);
        ctx.stroke();

        // PCR point dot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(hx, hyPcr, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Spot point dot
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(hx, hySpot, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Update Legend
      const lastP = pts[pts.length - 1] || {};
      const elPutLeg = document.getElementById('optVisPutLegend');
      const elCallLeg = document.getElementById('optVisCallLegend');
      if (elCallLeg) elCallLeg.textContent = `Spot Price: ₹${fmtNum(lastP.spot || spot, 2)}`;
      if (elPutLeg) elPutLeg.textContent = `PCR Trend: ${(lastP.pcr || data.pcr || 0).toFixed(2)}`;
      return;
    }

    // =========================================================================
    // VIEW MODE 3: 🎯 INTRADAY MAX PAIN VS SPOT TREND (REFERENCE IMAGE 3)
    // =========================================================================
    if (viewMode === 'maxpain') {
      const elTitle = document.getElementById('optVisChartTitle');
      if (elTitle) elTitle.textContent = 'Intraday Max Pain vs Spot Trend';
      const elSub = document.getElementById('optVisChartSub');
      if (elSub) elSub.textContent = 'Reference Image 3 • Underlying Spot Price (Green) vs Max Pain Strike Barrier Stair-Step (Red) • 09:15 to 15:30';

      const pts = (data.intradayTimeline && data.intradayTimeline.length >= 10) ? data.intradayTimeline : generateClientTimeline(spot, Number(data.pcr || 0.85), Number(data.maxPain || spot));
      if (!pts || pts.length === 0) return;

      const padL = 30, padR = 75, padT = 25, padB = 40;
      const plotW = Math.max(20, w - padL - padR);
      const plotH = Math.max(20, h - padT - padB);

      let allVals = [...pts.map(p => p.spot), ...pts.map(p => p.maxPain)];
      let minP = Math.min(...allVals);
      let maxP = Math.max(...allVals);
      const spread = Math.max(40, (maxP - minP) * 0.15);
      minP = Math.floor(minP - spread);
      maxP = Math.ceil(maxP + spread);
      const pSpan = Math.max(10, maxP - minP);

      const getX = (idx) => padL + (idx / Math.max(1, pts.length - 1)) * plotW;
      const getY = (val) => padT + plotH - ((val - minP) / pSpan) * plotH;

      // Grid lines and right axis labels
      const yTicks = 4;
      ctx.font = '10px "JetBrains Mono", monospace';
      for (let i = 0; i <= yTicks; i++) {
        const frac = i / yTicks;
        const val = minP + pSpan * frac;
        const yPos = padT + plotH - frac * plotH;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, yPos);
        ctx.lineTo(padL + plotW, yPos);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(`₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, padL + plotW + 8, yPos);
      }

      // Spot Line (Green Curve)
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.spot);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Max Pain Stair-Step Line (Red Curve - matching Reference Image 3)
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const curX = getX(i);
        const curY = getY(pts[i].maxPain);
        if (i === 0) {
          ctx.moveTo(curX, curY);
        } else {
          const prevY = getY(pts[i - 1].maxPain);
          ctx.lineTo(curX, prevY);
          ctx.lineTo(curX, curY);
        }
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // Time X labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = textColor;
      const xStep = Math.max(1, Math.floor(pts.length / 6));
      pts.forEach((p, idx) => {
        if (idx % xStep === 0 || idx === pts.length - 1) {
          ctx.fillText(p.time, getX(idx), padT + plotH + 8);
        }
      });

      // Hover Crosshair
      state.visChartBounds = pts.map((p, idx) => ({
        x: getX(idx),
        x1: getX(Math.max(0, idx - 0.5)),
        x2: getX(Math.min(pts.length - 1, idx + 0.5)),
        pt: p
      }));

      if (state.visHoverIndex >= 0 && state.visHoverIndex < pts.length) {
        const hp = pts[state.visHoverIndex];
        const hx = getX(state.visHoverIndex);
        const hySpot = getY(hp.spot);
        const hyMp = getY(hp.maxPain);

        ctx.save();
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, padT);
        ctx.lineTo(hx, padT + plotH);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(hx, hySpot, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(hx, hyMp, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Update Legend
      const lastP = pts[pts.length - 1] || {};
      const elPutLeg = document.getElementById('optVisPutLegend');
      const elCallLeg = document.getElementById('optVisCallLegend');
      if (elCallLeg) elCallLeg.textContent = `Spot Price: ₹${fmtNum(lastP.spot || spot, 2)}`;
      if (elPutLeg) elPutLeg.textContent = `Max Pain: ₹${fmtNum(lastP.maxPain || data.maxPain || spot, 0)}`;
      return;
    }

    // =========================================================================
    // VIEW MODE 1: 📊 STRIKE DISTRIBUTION (REFERENCE IMAGE 2 - ZERO BASELINE & LAKHS)
    // =========================================================================
    const metricKey = state.visualizerMetric || 'oichg';
    const cfg = VIS_METRICS_CONFIG[metricKey] || VIS_METRICS_CONFIG.oichg;

    const elTitle = document.getElementById('optVisChartTitle');
    if (elTitle) elTitle.textContent = cfg.title;
    const elSub = document.getElementById('optVisChartSub');
    if (elSub) elSub.textContent = cfg.sub;

    let allRows = [...(data.data || [])].sort((a, b) => Number(a.strike_price) - Number(b.strike_price));
    let rows = allRows;
    if (state.strikeRange > 0) {
      let atmIdx = 0;
      let minD = Infinity;
      allRows.forEach((r, i) => {
        const d = Math.abs(Number(r.strike_price) - spot);
        if (d < minD) { minD = d; atmIdx = i; }
      });
      const start = Math.max(0, atmIdx - state.strikeRange);
      const end = Math.min(allRows.length, atmIdx + state.strikeRange + 1);
      rows = allRows.slice(start, end);
    }

    // Compute metric values & signed bounds
    let sumCall = 0, sumPut = 0;
    let minVal = 0, maxVal = 0;

    const chartItems = rows.map(r => {
      const sp = Number(r.strike_price || 0);
      const vals = cfg.getVals(r, allRows, spot);
      const call = Number(vals.call || 0);
      const put = Number(vals.put || 0);
      sumCall += call;
      sumPut += put;
      if (call < minVal) minVal = call;
      if (put < minVal) minVal = put;
      if (call > maxVal) maxVal = call;
      if (put > maxVal) maxVal = put;
      return { strike: sp, call, put, row: r, isAtm: Math.abs(sp - atmStrike) < 1 };
    });

    const hasNegative = minVal < -0.01;
    if (hasNegative) {
      // Balanced symmetrical zero baseline matching Reference Image 2 (-50.0 L to +50.0 L)
      const extent = Math.max(Math.abs(minVal), Math.abs(maxVal), 1);
      minVal = -extent;
      maxVal = extent;
    } else {
      minVal = 0;
      if (maxVal <= 0) maxVal = 100;
    }

    // Update legend totals
    const elPutLeg = document.getElementById('optVisPutLegend');
    const elCallLeg = document.getElementById('optVisCallLegend');
    if (elCallLeg) elCallLeg.textContent = `${cfg.callLabel} (${formatValByMetric(sumCall, cfg.format)})`;
    if (elPutLeg) elPutLeg.textContent = `${cfg.putLabel} (${formatValByMetric(sumPut, cfg.format)})`;

    // Margins
    const padL = 68, padR = 25, padT = 30, padB = 40;
    const plotW = Math.max(20, w - padL - padR);
    const plotH = Math.max(20, h - padT - padB);

    const valSpan = Math.max(0.1, maxVal - minVal);
    const getY = (val) => padT + plotH - ((val - minVal) / valSpan) * plotH;
    const yZero = getY(0);

    // Grid lines & Y-axis labels with Lakhs / Cr formatting (Image 2)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "JetBrains Mono", monospace';

    const yTicks = hasNegative ? 4 : 4;
    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const yVal = minVal + valSpan * frac;
      const yPos = padT + plotH - frac * plotH;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, yPos);
      ctx.lineTo(padL + plotW, yPos);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = textColor;
      ctx.fillText(formatValByMetric(yVal, cfg.format), padL - 8, yPos);
    }

    // Solid Baseline at 0.0
    ctx.strokeStyle = isLight ? '#94a3b8' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, yZero);
    ctx.lineTo(padL + plotW, yZero);
    ctx.stroke();

    // Bars
    const n = chartItems.length;
    if (n === 0) return;
    const colW = plotW / n;
    const barGap = 2;
    const subBarW = Math.max(3, (colW - 8) / 2 - barGap);

    state.visChartBounds = [];

    chartItems.forEach((item, idx) => {
      const colX = padL + idx * colW;
      const colCenterX = colX + colW / 2;

      state.visChartBounds.push({
        x1: colX,
        x2: colX + colW,
        centerX: colCenterX,
        item: item
      });

      // Hover Column Highlight
      if (state.visHoverIndex === idx) {
        ctx.fillStyle = isLight ? 'rgba(37, 99, 235, 0.06)' : 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(colX + 1, padT, colW - 2, plotH);
      }

      // Call Bar (Green #10b981 - Left)
      const callX = colCenterX - barGap / 2 - subBarW;
      if (item.call >= 0) {
        const cH = Math.max(1, (item.call / valSpan) * plotH);
        const cY = yZero - cH;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(callX, cY, subBarW, cH);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(callX, cY, subBarW, Math.min(2.5, cH));
      } else {
        // Negative unwinding bar extending downward below baseline
        const cH = Math.max(1, (Math.abs(item.call) / valSpan) * plotH);
        const cY = yZero;
        ctx.fillStyle = '#059669';
        ctx.fillRect(callX, cY, subBarW, cH);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(callX, cY + cH - Math.min(2.5, cH), subBarW, Math.min(2.5, cH));
      }

      // Put Bar (Red #ef4444 - Right)
      const putX = colCenterX + barGap / 2;
      if (item.put >= 0) {
        const pH = Math.max(1, (item.put / valSpan) * plotH);
        const pY = yZero - pH;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(putX, pY, subBarW, pH);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(putX, pY, subBarW, Math.min(2.5, pH));
      } else {
        // Negative unwinding bar extending downward below baseline
        const pH = Math.max(1, (Math.abs(item.put) / valSpan) * plotH);
        const pY = yZero;
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(putX, pY, subBarW, pH);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(putX, pY + pH - Math.min(2.5, pH), subBarW, Math.min(2.5, pH));
      }

      // Hover Crosshair
      if (state.visHoverIndex === idx) {
        ctx.save();
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(colCenterX, padT);
        ctx.lineTo(colCenterX, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // X-Axis Strike Label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = item.isAtm ? 'bold 10.5px "JetBrains Mono", monospace' : '9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = item.isAtm ? '#fbbf24' : (state.visHoverIndex === idx ? '#38bdf8' : textColor);

      const skipLabels = n > 25 ? 3 : n > 15 ? 2 : 1;
      if (idx % skipLabels === 0 || item.isAtm || state.visHoverIndex === idx) {
        ctx.fillText(item.strike, colCenterX, padT + plotH + 8);
      }
    });

    // Spot Price Marker (Matching Reference Image 2: "Spot price: 22,421.95")
    if (spot > 0 && n >= 2) {
      let spotX = null;
      for (let i = 0; i < n - 1; i++) {
        const s1 = chartItems[i].strike;
        const s2 = chartItems[i + 1].strike;
        if (spot >= s1 && spot <= s2) {
          const frac = (spot - s1) / Math.max(1, s2 - s1);
          spotX = chartItems[i].colCenterX + frac * (chartItems[i + 1].colCenterX - chartItems[i].colCenterX);
          break;
        }
      }
      if (spotX === null) {
        if (spot < chartItems[0].strike) spotX = chartItems[0].colCenterX;
        else spotX = chartItems[n - 1].colCenterX;
      }

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(spotX, padT);
      ctx.lineTo(spotX, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      const badgeText = `Spot price: ${spot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const bW = ctx.measureText(badgeText).width + 16;
      const bH = 20;
      const bX = Math.max(padL + 4, Math.min(padL + plotW - bW - 4, spotX - bW / 2));
      const bY = padT + 6;

      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bX, bY, bW, bH, 4) : ctx.rect(bX, bY, bW, bH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bX + bW / 2, bY + bH / 2);
      ctx.restore();
    }
  }

  // Client-side fallback timeline if server points pending
  function generateClientTimeline(spotVal, pcrVal, maxPainVal) {
    const pts = [];
    const count = 76;
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const m = Math.round(frac * 375);
      const h = 9 + Math.floor((15 + m) / 60);
      const min = (15 + m) % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const wave = -Math.sin(frac * Math.PI) * (spotVal * 0.012) + Math.sin(frac * 4 * Math.PI) * (spotVal * 0.002);
      const s = Math.round((spotVal + (frac - 1.0) * (spotVal * 0.004) + wave) * 100) / 100;
      const p = Math.max(0.2, Math.round((pcrVal * 0.88 + frac * (pcrVal * 0.12) + Math.sin(frac * 2.5 * Math.PI) * 0.03) * 100) / 100);
      let mp = maxPainVal;
      if (frac < 0.35) mp = maxPainVal + 50;
      pts.push({ time: timeStr, spot: s, pcr: p, maxPain: mp, dist: Math.round((s - mp) * 10) / 10 });
    }
    return pts;
  }

  function initVisualizerEvents() {
    const wrap = document.getElementById('optVisCanvasWrap');
    const canvas = document.getElementById('optVisCanvas');
    const tooltip = document.getElementById('optVisTooltip');
    if (!wrap || !canvas || !tooltip) return;

    // View Switcher Tabs (Images 1, 2, 3)
    const vTabs = document.querySelectorAll('.opt-vis-vtab');
    vTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        vTabs.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.visViewMode = e.currentTarget.getAttribute('data-view');
        state.visHoverIndex = -1;
        tooltip.style.display = 'none';
        if (state.chainData) renderVisualizerChart(state.chainData);
      });
    });

    // Toggle Collapse / Expand Visualizer
    const toggleBtn = document.getElementById('upstoxVisToggleBtn');
    const visPanel = document.getElementById('upstoxVisPanel');
    const toggleIcon = document.getElementById('upstoxVisToggleIcon');
    const toggleText = document.getElementById('upstoxVisToggleText');
    if (toggleBtn && visPanel) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = visPanel.style.display === 'none';
        if (isHidden) {
          visPanel.style.display = 'flex';
          if (toggleIcon) toggleIcon.textContent = '▲';
          if (toggleText) toggleText.textContent = 'Collapse Visualizer';
          if (state.chainData) {
            requestAnimationFrame(() => renderVisualizerChart(state.chainData));
          }
        } else {
          visPanel.style.display = 'none';
          if (toggleIcon) toggleIcon.textContent = '▼';
          if (toggleText) toggleText.textContent = 'Expand Visualizer';
        }
      });
    }

    // 14-Metric Pills Click Listeners
    const pills = document.querySelectorAll('.opt-vis-pill');
    pills.forEach(p => {
      p.addEventListener('click', (e) => {
        pills.forEach(x => x.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mKey = e.currentTarget.getAttribute('data-metric');
        state.visualizerMetric = mKey;

        // Auto-switch view tab when clicked
        if (mKey === 'callput') {
          state.visViewMode = 'pcr';
          vTabs.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === 'pcr'));
        } else if (mKey === 'maxpain') {
          state.visViewMode = 'maxpain';
          vTabs.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === 'maxpain'));
        } else {
          state.visViewMode = 'strike';
          vTabs.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === 'strike'));
        }

        state.visHoverIndex = -1;
        tooltip.style.display = 'none';
        if (state.chainData) renderVisualizerChart(state.chainData);
      });
    });

    // Mouse Move on Canvas - Throttled with requestAnimationFrame
    let mouseAnimFrame = null;
    canvas.addEventListener('mousemove', (e) => {
      if (!state.visChartBounds || state.visChartBounds.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let foundIdx = -1;
      for (let i = 0; i < state.visChartBounds.length; i++) {
        const b = state.visChartBounds[i];
        if (mouseX >= b.x1 && mouseX <= b.x2) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx !== state.visHoverIndex) {
        state.visHoverIndex = foundIdx;
        if (mouseAnimFrame) cancelAnimationFrame(mouseAnimFrame);
        mouseAnimFrame = requestAnimationFrame(() => {
          if (state.chainData) renderVisualizerChart(state.chainData);
        });
      }

      if (foundIdx >= 0) {
        const bound = state.visChartBounds[foundIdx];
        const vMode = state.visViewMode || 'strike';

        if (vMode === 'pcr') {
          const pt = bound.pt;
          tooltip.innerHTML = `
            <div style="font-weight:800; color:#38bdf8; font-size:12px; margin-bottom:4px;">⏱ ${pt.time} Intraday Snapshot</div>
            <div style="display:flex; justify-content:space-between; gap:16px; color:#ef4444;">
              <span>PCR:</span> <strong>${pt.pcr.toFixed(2)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px; color:#10b981;">
              <span>Spot:</span> <strong>₹${fmtNum(pt.spot, 2)}</strong>
            </div>
          `;
          tooltip.style.left = `${bound.x}px`;
          tooltip.style.top = `${Math.max(40, mouseY)}px`;
          tooltip.style.display = 'block';
        } else if (vMode === 'maxpain') {
          const pt = bound.pt;
          tooltip.innerHTML = `
            <div style="font-weight:800; color:#38bdf8; font-size:12px; margin-bottom:4px;">⏱ ${pt.time} Max Pain Tracker</div>
            <div style="display:flex; justify-content:space-between; gap:16px; color:#10b981;">
              <span>Spot Price:</span> <strong>₹${fmtNum(pt.spot, 2)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px; color:#ef4444;">
              <span>Max Pain Strike:</span> <strong>₹${fmtNum(pt.maxPain, 0)}</strong>
            </div>
            <div style="margin-top:4px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.1); font-size:10px; color:#fbbf24;">
              Distance: ${pt.dist >= 0 ? '+' : ''}${pt.dist} pts
            </div>
          `;
          tooltip.style.left = `${bound.x}px`;
          tooltip.style.top = `${Math.max(40, mouseY)}px`;
          tooltip.style.display = 'block';
        } else {
          // Strike mode
          const item = bound.item;
          const cfg = VIS_METRICS_CONFIG[state.visualizerMetric || 'oichg'] || VIS_METRICS_CONFIG.oichg;
          const netVal = item.call - item.put;
          tooltip.innerHTML = `
            <div style="font-weight:800; color:#38bdf8; font-size:12px; margin-bottom:4px;">
              STRIKE ${item.strike.toLocaleString('en-IN')} ${item.isAtm ? '<span style="color:#fbbf24; font-size:10px;">[ATM]</span>' : ''}
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px; color:#10b981;">
              <span>${cfg.callLabel}:</span> <strong>${formatValByMetric(item.call, cfg.format)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px; color:#ef4444;">
              <span>${cfg.putLabel}:</span> <strong>${formatValByMetric(item.put, cfg.format)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:16px; color:#94a3b8; font-size:10px; margin-top:3px; border-top:1px solid rgba(255,255,255,0.1); padding-top:3px;">
              <span>Net (CE - PE):</span> <strong style="color:${netVal >= 0 ? '#10b981' : '#ef4444'}">${formatValByMetric(netVal, cfg.format)}</strong>
            </div>
            <div style="margin-top:4px; font-size:9.5px; color:#64748b;">Click bar for Strike Intelligence Radar ↗</div>
          `;
          tooltip.style.left = `${bound.centerX}px`;
          tooltip.style.top = `${Math.max(40, mouseY)}px`;
          tooltip.style.display = 'block';
        }
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      state.visHoverIndex = -1;
      tooltip.style.display = 'none';
      if (mouseAnimFrame) cancelAnimationFrame(mouseAnimFrame);
      mouseAnimFrame = requestAnimationFrame(() => {
        if (state.chainData) renderVisualizerChart(state.chainData);
      });
    });

    // Click on Canvas Bar in Strike Mode -> Open Strike Radar Modal
    canvas.addEventListener('click', (e) => {
      if (state.visViewMode && state.visViewMode !== 'strike') return;
      if (!state.visChartBounds || state.visChartBounds.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      for (let i = 0; i < state.visChartBounds.length; i++) {
        const b = state.visChartBounds[i];
        if (mouseX >= b.x1 && mouseX <= b.x2 && b.item) {
          const item = b.item;
          const spot = Number(state.chainData?.spotPrice || 0);
          openStrikeModal(item.row, spot, item.isAtm);
          break;
        }
      }
    });

    // Debounced and safe ResizeObserver
    let resizeTimer = null;
    let lastWrapW = 0;
    if (window.ResizeObserver) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const crW = Math.round(entry.contentRect.width);
          if (crW > 0 && Math.abs(crW - lastWrapW) >= 4) {
            lastWrapW = crW;
            if (resizeTimer) cancelAnimationFrame(resizeTimer);
            resizeTimer = requestAnimationFrame(() => {
              const panel = document.getElementById('panelUpstoxChain');
              if (panel && panel.style.display !== 'none' && panel.offsetParent !== null) {
                if (state.chainData) renderVisualizerChart(state.chainData);
              }
            });
          }
        }
      });
      ro.observe(wrap);
    }
  }

  function setupHiDpiCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || canvas.clientWidth || 600;
    const h = rect.height || canvas.clientHeight || 280;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    return { ctx, width: w, height: h };
  }

  // ==========================================================================
  // ⚡ 1. DIRECTIONAL FORCE & ORDER FLOW PANE
  // ==========================================================================
  function renderForcePane(data) {
    if (!data) return;
    const spot = Number(data.spotPrice || 0);
    const rows = data.data || [];
    let atmRow = null;
    let minAtmDiff = Infinity;
    rows.forEach(r => {
      const diff = Math.abs(Number(r.strike_price || 0) - spot);
      if (diff < minAtmDiff) {
        minAtmDiff = diff;
        atmRow = r;
      }
    });

    const qm = atmRow ? (atmRow.quant_metrics || {}) : {};
    const score = Number(qm.force_score !== undefined ? qm.force_score : 0);
    const bullForce = Number(qm.bullish_force !== undefined ? qm.bullish_force : 50);
    const bearForce = Number(qm.bearish_force !== undefined ? qm.bearish_force : 50);

    const elScore = document.getElementById('forcePaneScore');
    const elSignal = document.getElementById('forcePaneSignal');
    if (elScore) {
      elScore.textContent = `${score >= 0 ? '+' : ''}${score.toFixed(1)}`;
      elScore.style.color = score >= 12 ? '#10b981' : score <= -12 ? '#ef4444' : '#fbbf24';
    }
    if (elSignal) {
      if (score >= 25) {
        elSignal.textContent = '🟢 STRONG BULLISH AGGRESSION';
        elSignal.style.background = 'rgba(16, 185, 129, 0.2)';
        elSignal.style.color = '#34d399';
      } else if (score >= 8) {
        elSignal.textContent = '🟢 MILD BULLISH FLOW';
        elSignal.style.background = 'rgba(16, 185, 129, 0.15)';
        elSignal.style.color = '#34d399';
      } else if (score <= -25) {
        elSignal.textContent = '🔴 STRONG BEARISH PRESSURE';
        elSignal.style.background = 'rgba(239, 68, 68, 0.2)';
        elSignal.style.color = '#f87171';
      } else if (score <= -8) {
        elSignal.textContent = '🔴 MILD BEARISH PRESSURE';
        elSignal.style.background = 'rgba(239, 68, 68, 0.15)';
        elSignal.style.color = '#f87171';
      } else {
        elSignal.textContent = '🟡 BALANCED ORDER FLOW';
        elSignal.style.background = 'rgba(245, 158, 11, 0.15)';
        elSignal.style.color = '#fbbf24';
      }
    }

    const elBullVal = document.getElementById('forceBullVal');
    const elBearVal = document.getElementById('forceBearVal');
    const elBullBar = document.getElementById('forceBullBar');
    const elBearBar = document.getElementById('forceBearBar');
    if (elBullVal) elBullVal.textContent = `${bullForce.toFixed(1)}%`;
    if (elBearVal) elBearVal.textContent = `${bearForce.toFixed(1)}%`;
    const totForce = Math.max(1, bullForce + bearForce);
    const bullPct = Math.round((bullForce / totForce) * 100);
    if (elBullBar) elBullBar.style.width = `${bullPct}%`;
    if (elBearBar) elBearBar.style.width = `${100 - bullPct}%`;

    // Aggregate capital & turnover across active strikes
    let sumCeFlow = 0, sumPeFlow = 0, sumNetFlow = 0;
    let sumCeTo = 0, sumPeTo = 0;
    rows.forEach(r => {
      const m = r.quant_metrics || {};
      sumCeFlow += Number(m.ce_prem_flow_cr || 0);
      sumPeFlow += Number(m.pe_prem_flow_cr || 0);
      sumNetFlow += Number(m.net_prem_flow_cr || 0);
      sumCeTo += Number(m.ce_turnover_cr || 0);
      sumPeTo += Number(m.pe_turnover_cr || 0);
    });

    const elNetFlow = document.getElementById('forceNetFlowCr');
    const elNetTag = document.getElementById('forceNetFlowTag');
    if (elNetFlow) {
      const isPos = sumNetFlow >= 0;
      elNetFlow.textContent = `${isPos ? '+' : ''}${fmtNum(sumNetFlow, 2)} Cr`;
      elNetFlow.style.color = isPos ? '#34d399' : '#f87171';
    }
    if (elNetTag) {
      elNetTag.textContent = sumNetFlow >= 0 ? '🟢 NET INFLOW (BULLISH)' : '🔴 NET OUTFLOW (BEARISH)';
      elNetTag.style.background = sumNetFlow >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      elNetTag.style.color = sumNetFlow >= 0 ? '#34d399' : '#f87171';
    }

    const elCeFlow = document.getElementById('forceCeFlowCr');
    const elPeFlow = document.getElementById('forcePeFlowCr');
    const elCeTo = document.getElementById('forceCeToCr');
    const elPeTo = document.getElementById('forcePeToCr');
    if (elCeFlow) elCeFlow.textContent = `₹${fmtNum(sumCeFlow, 2)} Cr`;
    if (elPeFlow) elPeFlow.textContent = `₹${fmtNum(sumPeFlow, 2)} Cr`;
    if (elCeTo) elCeTo.textContent = `₹${fmtNum(sumCeTo, 2)} Cr`;
    if (elPeTo) elPeTo.textContent = `₹${fmtNum(sumPeTo, 2)} Cr`;

    // Writer Skew
    const writeSkew = Number(qm.write_skew !== undefined ? qm.write_skew : 0);
    const elWriterSkew = document.getElementById('forceWriterSkew');
    const elWriterTag = document.getElementById('forceWriterTag');
    if (elWriterSkew) {
      elWriterSkew.textContent = `${writeSkew >= 0 ? '+' : ''}${writeSkew.toFixed(1)}`;
      elWriterSkew.style.color = writeSkew >= 10 ? '#10b981' : writeSkew <= -10 ? '#ef4444' : '#fbbf24';
    }
    if (elWriterTag) {
      elWriterTag.textContent = writeSkew >= 15 ? 'PUT WRITING BIAS (SUPPORT)' : writeSkew <= -15 ? 'CALL WRITING BIAS (RESISTANCE)' : 'BALANCED SKEW';
      elWriterTag.style.color = writeSkew >= 15 ? '#34d399' : writeSkew <= -15 ? '#f87171' : '#fbbf24';
    }

    const elCp = document.getElementById('forceCpRatio');
    const elPc = document.getElementById('forcePcRatio');
    const elBias = document.getElementById('forceSmartBias');
    if (elCp) elCp.textContent = qm.call_put_ratio ? Number(qm.call_put_ratio).toFixed(2) : '--';
    if (elPc) elPc.textContent = data.pcr ? Number(data.pcr).toFixed(2) : '--';
    if (elBias) {
      const pcrVal = Number(data.pcr || 1.0);
      elBias.textContent = pcrVal >= 1.15 ? 'Institutional Long Accumulation' : pcrVal <= 0.85 ? 'Institutional Short Pressure' : 'Neutral Rangebound';
      elBias.style.color = pcrVal >= 1.15 ? '#34d399' : pcrVal <= 0.85 ? '#f87171' : '#fbbf24';
    }

    // Strike Leaderboard Table (Top 10 by total turnover)
    const tbody = document.getElementById('upstoxForceTableBody');
    if (tbody) {
      const sorted = [...rows].sort((a, b) => {
        const toA = Number(a.quant_metrics?.total_turnover_cr || 0);
        const toB = Number(b.quant_metrics?.total_turnover_cr || 0);
        return toB - toA;
      }).slice(0, 10);

      let html = '';
      sorted.forEach(r => {
        const sp = Number(r.strike_price || 0);
        const ce = r.call_options?.market_data || {};
        const pe = r.put_options?.market_data || {};
        const m = r.quant_metrics || {};
        const fScore = Number(m.force_score || 0);
        const isAtm = Math.abs(sp - spot) < 25;
        const moneyness = isAtm ? '<span style="color:#fbbf24; font-weight:800;">ATM</span>' : sp > spot ? '<span style="color:#ef4444;">OTM CE / ITM PE</span>' : '<span style="color:#10b981;">ITM CE / OTM PE</span>';

        html += `
          <tr style="border-bottom:1px solid #162035; height:34px;">
            <td style="font-weight:800; color:#38bdf8; font-family:'JetBrains Mono',monospace;">₹${fmtNum(sp, 0)}</td>
            <td style="text-align:center; font-size:10.5px;">${moneyness}</td>
            <td style="text-align:right; font-family:'JetBrains Mono',monospace; color:#cbd5e1;">₹${fmtNum(ce.ltp, 2)}</td>
            <td style="text-align:right; font-family:'JetBrains Mono',monospace; color:#cbd5e1;">₹${fmtNum(pe.ltp, 2)}</td>
            <td style="text-align:center; font-weight:800; font-family:'JetBrains Mono',monospace; color:${fScore >= 10 ? '#34d399' : fScore <= -10 ? '#f87171' : '#fbbf24'};">${fScore >= 0 ? '+' : ''}${fScore.toFixed(1)}</td>
            <td style="text-align:center;">
              <span class="ribbon-badge" style="font-size:9.5px; background:${fScore >= 15 ? 'rgba(16,185,129,0.15)' : fScore <= -15 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}; color:${fScore >= 15 ? '#34d399' : fScore <= -15 ? '#f87171' : '#fbbf24'};">
                ${fScore >= 15 ? 'BULL FORCE' : fScore <= -15 ? 'BEAR FORCE' : 'BALANCED'}
              </span>
            </td>
            <td style="text-align:right; font-family:'JetBrains Mono',monospace; color:${Number(m.net_prem_flow_cr || 0) >= 0 ? '#34d399' : '#f87171'}; font-weight:700;">
              ${Number(m.net_prem_flow_cr || 0) >= 0 ? '+' : ''}${fmtNum(m.net_prem_flow_cr, 2)} Cr
            </td>
            <td style="text-align:right; font-family:'JetBrains Mono',monospace; color:#94a3b8;">₹${fmtNum(m.total_turnover_cr, 2)} Cr</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }
  }

  // ==========================================================================
  // 🎯 2. MAX PAIN & STRADDLE DESK PANE
  // ==========================================================================
  function renderMaxPainPane(data) {
    if (!data) return;
    const spot = Number(data.spotPrice || 0);
    const maxPain = Number(data.maxPain || 0);
    const atmStraddle = Number(data.atmStraddle || 0);
    const rows = data.data || [];
    let atmRow = null;
    let minAtmDiff = Infinity;
    rows.forEach(r => {
      const diff = Math.abs(Number(r.strike_price || 0) - spot);
      if (diff < minAtmDiff) {
        minAtmDiff = diff;
        atmRow = r;
      }
    });
    const qm = atmRow ? (atmRow.quant_metrics || {}) : {};

    const elMpStrike = document.getElementById('mpPaneStrike');
    const elMpDiff = document.getElementById('mpPaneDiff');
    const elMpDist = document.getElementById('mpPaneDistText');
    const elMpRegime = document.getElementById('mpPaneRegime');
    if (elMpStrike) elMpStrike.textContent = maxPain ? `₹${fmtNum(maxPain, 0)}` : '--';
    if (elMpDiff && maxPain) {
      const diff = spot - maxPain;
      const isAbove = diff >= 0;
      elMpDiff.textContent = `${isAbove ? '+' : ''}${fmtNum(diff, 0)} pts (${isAbove ? 'Above' : 'Below'})`;
      elMpDiff.style.background = isAbove ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      elMpDiff.style.color = isAbove ? '#34d399' : '#f87171';
    }
    if (elMpDist && maxPain) {
      const diff = spot - maxPain;
      elMpDist.textContent = `${Math.abs(diff).toFixed(0)} pts to Max Pain (${diff > 0 ? 'Downside Pull' : 'Upside Pull'})`;
    }
    if (elMpRegime && maxPain) {
      const diff = spot - maxPain;
      if (Math.abs(diff) < 25) {
        elMpRegime.textContent = 'Pinned at Max Pain';
        elMpRegime.style.color = '#34d399';
      } else if (diff > 0) {
        elMpRegime.textContent = 'Gravitating Lower towards Pain Strike';
        elMpRegime.style.color = '#f87171';
      } else {
        elMpRegime.textContent = 'Gravitating Higher towards Pain Strike';
        elMpRegime.style.color = '#38bdf8';
      }
    }

    const elAtmStrike = document.getElementById('mpPaneAtmStrike');
    const elStrdVal = document.getElementById('mpPaneStraddleVal');
    const elPremPct = document.getElementById('mpPanePremPct');
    const elLowerBe = document.getElementById('mpPaneLowerBe');
    const elUpperBe = document.getElementById('mpPaneUpperBe');

    const atmSp = Number(data.atmStrike || spot);
    if (elAtmStrike) elAtmStrike.textContent = `₹${fmtNum(atmSp, 0)}`;
    if (elStrdVal) elStrdVal.textContent = atmStraddle ? `₹${fmtNum(atmStraddle, 2)}` : '--';
    if (elPremPct && spot > 0 && atmStraddle > 0) {
      elPremPct.textContent = `${((atmStraddle / spot) * 100).toFixed(2)}% of Spot`;
    }
    const lowerBe = qm.lower_be || (atmSp - atmStraddle);
    const upperBe = qm.upper_be || (atmSp + atmStraddle);
    if (elLowerBe) elLowerBe.textContent = `₹${fmtNum(lowerBe, 2)}`;
    if (elUpperBe) elUpperBe.textContent = `₹${fmtNum(upperBe, 2)}`;

    // Expected move
    let expMove = Number(data.expectedMove || 0);
    if (!expMove || expMove <= 0) {
      expMove = atmStraddle > 0 ? (atmStraddle * 0.85) : 150;
    }
    const elExp = document.getElementById('mpPaneExpMove');
    const elVix = document.getElementById('mpPaneVixVal');
    const elCone = document.getElementById('mpPaneConeRange');
    const elImpPct = document.getElementById('mpPaneImpliedPct');
    if (elExp) elExp.textContent = `±${fmtNum(expMove, 1)} pts`;
    if (elVix) elVix.textContent = `India VIX: ${Number(data.indiaVix || 13.5).toFixed(2)}`;
    if (elCone) elCone.textContent = `[₹${fmtNum(spot - expMove, 0)} - ₹${fmtNum(spot + expMove, 0)}]`;
    if (elImpPct && spot > 0) elImpPct.textContent = `${((expMove / spot) * 100).toFixed(2)}%`;

    // Render Max Pain Canvas Chart
    drawMaxPainChart(rows, spot, maxPain);
  }

  function drawMaxPainChart(rows, spot, maxPain) {
    const canvas = document.getElementById('upstoxCanvasMaxPain');
    const dpi = setupHiDpiCanvas(canvas);
    if (!dpi || !rows.length) return;
    const { ctx, width, height } = dpi;

    ctx.clearRect(0, 0, width, height);

    const pad = { top: 20, right: 30, bottom: 35, left: 65 };
    const pw = width - pad.left - pad.right;
    const ph = height - pad.top - pad.bottom;

    const strikes = rows.map(r => Number(r.strike_price || 0)).filter(s => s > 0);
    if (strikes.length < 3) return;

    // Calculate option buyer payout for each strike
    const points = strikes.map(k => {
      let totalPayout = 0;
      rows.forEach(r => {
        const s = Number(r.strike_price || 0);
        const ceOi = Number(r.call_options?.market_data?.oi || 0);
        const peOi = Number(r.put_options?.market_data?.oi || 0);
        if (k > s) totalPayout += (k - s) * ceOi;
        if (s > k) totalPayout += (s - k) * peOi;
      });
      return { strike: k, payout: totalPayout };
    });

    const maxPayout = Math.max(...points.map(p => p.payout), 1);
    const minPayout = Math.min(...points.map(p => p.payout), 0);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);

    const getX = s => pad.left + ((s - minStrike) / Math.max(1, maxStrike - minStrike)) * pw;
    const getY = p => pad.top + ph - ((p - minPayout) / Math.max(1, maxPayout - minPayout)) * ph;

    // Draw background grid lines
    ctx.strokeStyle = '#162035';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const yVal = minPayout + (maxPayout - minPayout) * (i / 4);
      const y = pad.top + ph - (i / 4) * ph;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(fmtQty(yVal), pad.left - 8, y + 3);
    }

    // Draw area under curve
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.01)');

    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = getX(p.strike);
      const y = getY(p.payout);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(getX(points[points.length - 1].strike), pad.top + ph);
    ctx.lineTo(getX(points[0].strike), pad.top + ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw curve line
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = getX(p.strike);
      const y = getY(p.payout);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Mark Max Pain Strike
    if (maxPain) {
      const mpX = getX(maxPain);
      const mpPoint = points.find(p => Math.abs(p.strike - maxPain) < 1) || points[0];
      const mpY = getY(mpPoint.payout);

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mpX, pad.top);
      ctx.lineTo(mpX, pad.top + ph);
      ctx.stroke();
      ctx.restore();

      // Circle at min point
      ctx.beginPath();
      ctx.arc(mpX, mpY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#c084fc';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Max Pain: ₹${fmtNum(maxPain, 0)}`, mpX, pad.top + 14);
    }

    // Mark Spot Line
    if (spot) {
      const spX = getX(spot);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(spX, pad.top);
      ctx.lineTo(spX, pad.top + ph);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Spot: ₹${fmtNum(spot, 0)}`, spX, pad.top + 28);
    }

    // X Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    points.forEach((p, idx) => {
      if (idx % Math.ceil(points.length / 8) === 0 || idx === points.length - 1) {
        ctx.fillText(fmtNum(p.strike, 0), getX(p.strike), pad.top + ph + 16);
      }
    });
  }

  // ==========================================================================
  // 📈 3. OPEN INTEREST DISTRIBUTION & BUILDUP PANE
  // ==========================================================================
  function renderOiDistPane(data) {
    if (!data) return;
    const spot = Number(data.spotPrice || 0);
    const rows = data.data || [];
    if (!rows.length) return;

    // Charts
    drawOiBarChart(rows, spot);
    drawOiChgBarChart(rows, spot);

    // 4-Quadrant Strike Buildup Classification
    const lb = [], sb = [], sc = [], lu = [];

    rows.forEach(r => {
      const sp = Number(r.strike_price || 0);
      const ceMd = r.call_options?.market_data || {};
      const peMd = r.put_options?.market_data || {};

      const ceB = getBuildup(ceMd.day_change, ceMd.oi_day_change);
      const peB = getBuildup(peMd.day_change, peMd.oi_day_change);

      const addChip = (list, strike, side, chgPct) => {
        list.push(`
          <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding:4px 8px; border-radius:4px; margin-bottom:4px; font-family:'JetBrains Mono',monospace; font-size:11px; border:1px solid #1e293b;">
            <span style="font-weight:700; color:#f8fafc;">₹${fmtNum(strike, 0)} ${side}</span>
            <span style="color:${chgPct >= 0 ? '#34d399' : '#f87171'}; font-weight:600;">${chgPct >= 0 ? '+' : ''}${fmtNum(chgPct, 1)}%</span>
          </div>
        `);
      };

      if (ceB.code === 'LB') addChip(lb, sp, 'CE', ceMd.day_change_percentage);
      if (peB.code === 'LB') addChip(lb, sp, 'PE', peMd.day_change_percentage);

      if (ceB.code === 'SB') addChip(sb, sp, 'CE', ceMd.day_change_percentage);
      if (peB.code === 'SB') addChip(sb, sp, 'PE', peMd.day_change_percentage);

      if (ceB.code === 'SC') addChip(sc, sp, 'CE', ceMd.day_change_percentage);
      if (peB.code === 'SC') addChip(sc, sp, 'PE', peMd.day_change_percentage);

      if (ceB.code === 'LU') addChip(lu, sp, 'CE', ceMd.day_change_percentage);
      if (peB.code === 'LU') addChip(lu, sp, 'PE', peMd.day_change_percentage);
    });

    const setList = (idList, idCount, items) => {
      const elList = document.getElementById(idList);
      const elCount = document.getElementById(idCount);
      if (elCount) elCount.textContent = items.length;
      if (elList) {
        elList.innerHTML = items.length ? items.join('') : '<div style="color:#64748b; font-size:11px; padding:8px; text-align:center;">No strikes in this quadrant</div>';
      }
    };

    setList('upstoxListLb', 'upstoxCountLb', lb);
    setList('upstoxListSb', 'upstoxCountSb', sb);
    setList('upstoxListSc', 'upstoxCountSc', sc);
    setList('upstoxListLu', 'upstoxCountLu', lu);
  }

  function drawOiBarChart(rows, spot) {
    const canvas = document.getElementById('upstoxCanvasOi');
    const dpi = setupHiDpiCanvas(canvas);
    if (!dpi || !rows.length) return;
    const { ctx, width, height } = dpi;

    ctx.clearRect(0, 0, width, height);

    const pad = { top: 20, right: 20, bottom: 35, left: 60 };
    const pw = width - pad.left - pad.right;
    const ph = height - pad.top - pad.bottom;

    const maxCeOi = Math.max(...rows.map(r => Number(r.call_options?.market_data?.oi || 0)), 1000);
    const maxPeOi = Math.max(...rows.map(r => Number(r.put_options?.market_data?.oi || 0)), 1000);
    const maxOi = Math.max(maxCeOi, maxPeOi);

    // Draw horizontal grid lines
    ctx.strokeStyle = '#162035';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const val = (maxOi * i) / 4;
      const y = pad.top + ph - (i / 4) * ph;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(fmtQty(val), pad.left - 6, y + 3);
    }

    const count = rows.length;
    const colW = pw / count;
    const barW = Math.max(2, (colW - 4) / 2);

    rows.forEach((r, idx) => {
      const x = pad.left + idx * colW + 2;
      const ceOi = Number(r.call_options?.market_data?.oi || 0);
      const peOi = Number(r.put_options?.market_data?.oi || 0);

      const ceH = (ceOi / maxOi) * ph;
      const peH = (peOi / maxOi) * ph;

      // CE Bar (Green/Emerald)
      ctx.fillStyle = '#10b981';
      ctx.fillRect(x, pad.top + ph - ceH, barW, ceH);

      // PE Bar (Red/Crimson)
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + barW + 1, pad.top + ph - peH, barW, peH);

      // Strike label
      if (idx % Math.ceil(count / 7) === 0 || idx === count - 1) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(fmtNum(r.strike_price, 0), x + barW, pad.top + ph + 16);
      }
    });

    // Mark Spot Line
    if (spot) {
      const minS = Number(rows[0]?.strike_price || 0);
      const maxS = Number(rows[rows.length - 1]?.strike_price || 1);
      if (spot >= minS && spot <= maxS) {
        const spotX = pad.left + ((spot - minS) / (maxS - minS)) * pw;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(spotX, pad.top);
        ctx.lineTo(spotX, pad.top + ph);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Spot: ₹${fmtNum(spot, 0)}`, spotX, pad.top + 10);
      }
    }
  }

  function drawOiChgBarChart(rows, spot) {
    const canvas = document.getElementById('upstoxCanvasOiChg');
    const dpi = setupHiDpiCanvas(canvas);
    if (!dpi || !rows.length) return;
    const { ctx, width, height } = dpi;

    ctx.clearRect(0, 0, width, height);

    const pad = { top: 20, right: 20, bottom: 35, left: 60 };
    const pw = width - pad.left - pad.right;
    const ph = height - pad.top - pad.bottom;

    const ceChgs = rows.map(r => Number(r.call_options?.market_data?.oi_day_change || 0));
    const peChgs = rows.map(r => Number(r.put_options?.market_data?.oi_day_change || 0));
    const allChgs = [...ceChgs, ...peChgs];
    const maxChg = Math.max(...allChgs.map(Math.abs), 500);

    const zeroY = pad.top + ph / 2;

    // Grid
    ctx.strokeStyle = '#162035';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(width - pad.right, zeroY);
    ctx.stroke();
    ctx.fillText('0', pad.left - 6, zeroY + 3);

    // +Max & -Max lines
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(width - pad.right, pad.top);
    ctx.stroke();
    ctx.fillText(`+${fmtQty(maxChg)}`, pad.left - 6, pad.top + 3);

    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ph);
    ctx.lineTo(width - pad.right, pad.top + ph);
    ctx.stroke();
    ctx.fillText(`-${fmtQty(maxChg)}`, pad.left - 6, pad.top + ph + 3);

    const count = rows.length;
    const colW = pw / count;
    const barW = Math.max(2, (colW - 4) / 2);

    rows.forEach((r, idx) => {
      const x = pad.left + idx * colW + 2;
      const ceChg = Number(r.call_options?.market_data?.oi_day_change || 0);
      const peChg = Number(r.put_options?.market_data?.oi_day_change || 0);

      const ceH = (ceChg / maxChg) * (ph / 2);
      const peH = (peChg / maxChg) * (ph / 2);

      // Call Chg Bar
      ctx.fillStyle = ceChg >= 0 ? '#10b981' : '#059669';
      if (ceH >= 0) {
        ctx.fillRect(x, zeroY - ceH, barW, ceH);
      } else {
        ctx.fillRect(x, zeroY, barW, -ceH);
      }

      // Put Chg Bar
      ctx.fillStyle = peChg >= 0 ? '#ef4444' : '#b91c1c';
      if (peH >= 0) {
        ctx.fillRect(x + barW + 1, zeroY - peH, barW, peH);
      } else {
        ctx.fillRect(x + barW + 1, zeroY, barW, -peH);
      }

      // Strike label
      if (idx % Math.ceil(count / 7) === 0 || idx === count - 1) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(fmtNum(r.strike_price, 0), x + barW, pad.top + ph + 16);
      }
    });
  }

  // ==========================================================================
  // 📐 4. GREEKS & VOLATILITY SKEW PANE
  // ==========================================================================
  function renderGreeksPane(data) {
    if (!data) return;
    const spot = Number(data.spotPrice || 0);
    const rows = data.data || [];
    if (!rows.length) return;

    let atmRow = null;
    let minAtmDiff = Infinity;
    rows.forEach(r => {
      const diff = Math.abs(Number(r.strike_price || 0) - spot);
      if (diff < minAtmDiff) {
        minAtmDiff = diff;
        atmRow = r;
      }
    });

    const ceGr = atmRow?.call_options?.option_greeks || {};
    const peGr = atmRow?.put_options?.option_greeks || {};
    const qm = atmRow?.quant_metrics || {};

    const elDelta = document.getElementById('upstoxGreekDelta');
    const elGamma = document.getElementById('upstoxGreekGamma');
    const elTheta = document.getElementById('upstoxGreekTheta');
    const elVega = document.getElementById('upstoxGreekVega');
    const elIv = document.getElementById('upstoxGreekIv');
    const elIvSkew = document.getElementById('upstoxGreekIvSkew');

    if (elDelta) elDelta.textContent = `CE: ${fmtNum(ceGr.delta, 2)} | PE: ${fmtNum(peGr.delta, 2)}`;
    if (elGamma) elGamma.textContent = fmtNum(ceGr.gamma || peGr.gamma, 4);
    if (elTheta) elTheta.textContent = `₹${fmtNum(ceGr.theta, 1)} / ₹${fmtNum(peGr.theta, 1)}`;
    if (elVega) elVega.textContent = `₹${fmtNum(ceGr.vega || peGr.vega, 2)}`;
    if (elIv) elIv.textContent = `${fmtNum(ceGr.iv || 13.5, 2)}%`;
    if (elIvSkew) {
      const skew = Number(qm.iv_skew || 0);
      elIvSkew.textContent = `Skew: ${skew >= 0 ? '+' : ''}${skew.toFixed(2)}% (${skew >= 0 ? 'CE Rich' : 'PE Rich'})`;
      elIvSkew.style.color = skew >= 0 ? '#34d399' : '#f87171';
    }

    drawIvSmileChart(rows, data.atmStrike || spot);
  }

  function drawIvSmileChart(rows, atmStrike) {
    const canvas = document.getElementById('upstoxCanvasIvSmile');
    const dpi = setupHiDpiCanvas(canvas);
    if (!dpi || !rows.length) return;
    const { ctx, width, height } = dpi;

    ctx.clearRect(0, 0, width, height);

    const pad = { top: 25, right: 30, bottom: 35, left: 55 };
    const pw = width - pad.left - pad.right;
    const ph = height - pad.top - pad.bottom;

    const strikes = rows.map(r => Number(r.strike_price || 0));
    const ceIvs = rows.map(r => Number(r.call_options?.option_greeks?.iv || 0));
    const peIvs = rows.map(r => Number(r.put_options?.option_greeks?.iv || 0));

    const validIvs = [...ceIvs, ...peIvs].filter(v => v > 0);
    const minIv = validIvs.length ? Math.max(5, Math.min(...validIvs) - 2) : 10;
    const maxIv = validIvs.length ? Math.max(...validIvs) + 2 : 25;

    const minS = Math.min(...strikes);
    const maxS = Math.max(...strikes);

    const getX = s => pad.left + ((s - minS) / Math.max(1, maxS - minS)) * pw;
    const getY = iv => pad.top + ph - ((iv - minIv) / Math.max(1, maxIv - minIv)) * ph;

    // Grid lines
    ctx.strokeStyle = '#162035';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const val = minIv + (maxIv - minIv) * (i / 4);
      const y = pad.top + ph - (i / 4) * ph;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(`${val.toFixed(1)}%`, pad.left - 6, y + 3);
    }

    // Call IV Line
    ctx.beginPath();
    rows.forEach((r, idx) => {
      const x = getX(Number(r.strike_price || 0));
      const iv = Number(r.call_options?.option_greeks?.iv || 0);
      const y = getY(iv > 0 ? iv : minIv);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Put IV Line
    ctx.beginPath();
    rows.forEach((r, idx) => {
      const x = getX(Number(r.strike_price || 0));
      const iv = Number(r.put_options?.option_greeks?.iv || 0);
      const y = getY(iv > 0 ? iv : minIv);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ATM Vertical Line
    if (atmStrike) {
      const atmX = getX(atmStrike);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(atmX, pad.top);
      ctx.lineTo(atmX, pad.top + ph);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ATM: ₹${fmtNum(atmStrike, 0)}`, atmX, pad.top + 12);
    }

    // X Axis
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    rows.forEach((r, idx) => {
      if (idx % Math.ceil(rows.length / 8) === 0 || idx === rows.length - 1) {
        ctx.fillText(fmtNum(r.strike_price, 0), getX(Number(r.strike_price || 0)), pad.top + ph + 16);
      }
    });
  }

  // ==========================================================================
  // 📉 MODERN INTRADAY STRADDLE DECLINE & DECAY CHART ENGINE
  // ==========================================================================
  let declineTimelineCache = [];

  function renderDeclineStrikeChips(rows, activeStrike, spot) {
    const container = document.getElementById('modernDeclineStrikeChips');
    if (!container) return;

    let atmIdx = 0;
    let minD = Infinity;
    rows.forEach((r, idx) => {
      const d = Math.abs(Number(r.strike_price) - spot);
      if (d < minD) { minD = d; atmIdx = idx; }
    });

    const start = Math.max(0, atmIdx - 2);
    const end = Math.min(rows.length, atmIdx + 3);
    const chipsRows = rows.slice(start, end);

    container.innerHTML = chipsRows.map(r => {
      const s = Number(r.strike_price);
      const isAtm = Math.abs(s - spot) === minD;
      const isActive = Math.abs(s - activeStrike) < 1;
      return `
        <button type="button" class="md-strike-chip ${isActive ? 'active' : ''}" data-strike="${s}">
          ${s.toLocaleString('en-IN')}${isAtm ? ' (ATM)' : ''}
        </button>
      `;
    }).join('');

    container.querySelectorAll('.md-strike-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const s = Number(e.currentTarget.getAttribute('data-strike'));
        state.declineStrike = s;
        if (state.chainData) renderDeclineChart(state.chainData);
      });
    });
  }

  function drawDeclineCanvas(canvas, w, h, pts, curStrike) {
    if (!canvas || !pts || pts.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    const pad = { top: 25, right: 30, bottom: 35, left: 65 };
    const pw = Math.max(20, w - pad.left - pad.right);
    const ph = Math.max(20, h - pad.top - pad.bottom);

    ctx.clearRect(0, 0, w, h);

    const isLight = document.documentElement.getAttribute('data-theme') !== 'dark' && document.body.getAttribute('data-theme') !== 'dark';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#475569' : '#94a3b8';

    let allP = [];
    if (state.declineToggles.straddle) allP.push(...pts.map(p => p.price));
    if (state.declineToggles.vwap) allP.push(...pts.map(p => p.vwap));
    if (state.declineToggles.call) allP.push(...pts.map(p => p.call));
    if (state.declineToggles.put) allP.push(...pts.map(p => p.put));
    if (!allP.length) allP = pts.map(p => p.price);

    let minPrice = Math.min(...allP);
    let maxPrice = Math.max(...allP);
    const spread = Math.max(1, maxPrice - minPrice);
    minPrice = Math.max(0, Math.floor(minPrice - spread * 0.08));
    maxPrice = Math.ceil(maxPrice + spread * 0.08);

    const getX = (idx) => pad.left + (idx / Math.max(1, pts.length - 1)) * pw;
    const getY = (val) => pad.top + ph - ((val - minPrice) / Math.max(1, maxPrice - minPrice)) * ph;

    // Y Axis Grid & Labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "JetBrains Mono", monospace';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const val = minPrice + (maxPrice - minPrice) * frac;
      const y = pad.top + ph - frac * ph;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + pw, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = textColor;
      ctx.fillText(`₹${val.toFixed(0)}`, pad.left - 8, y);
    }

    // 1. Straddle Area Fill & Curve (Purple)
    if (state.declineToggles.straddle) {
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
      grad.addColorStop(0, 'rgba(168, 85, 247, 0.22)');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0.01)');

      ctx.beginPath();
      ctx.moveTo(getX(0), getY(pts[0].price));
      pts.forEach((p, idx) => ctx.lineTo(getX(idx), getY(p.price)));
      ctx.lineTo(getX(pts.length - 1), pad.top + ph);
      ctx.lineTo(getX(0), pad.top + ph);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.price);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 2. VWAP Curve (Orange Dashed)
    if (state.declineToggles.vwap) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.vwap);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Call LTP Curve (Green)
    if (state.declineToggles.call) {
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.call);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 4. Put LTP Curve (Red)
    if (state.declineToggles.put) {
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.put);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Hover Crosshair
    if (state.declineHoverIndex >= 0 && state.declineHoverIndex < pts.length) {
      const hp = pts[state.declineHoverIndex];
      const hx = getX(state.declineHoverIndex);
      const hy = getY(hp.price);

      ctx.save();
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, pad.top + ph);
      ctx.stroke();

      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // X Axis Time Labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor;
    ctx.font = '10px "JetBrains Mono", monospace';

    const xLabelStep = Math.max(1, Math.floor(pts.length / 6));
    pts.forEach((p, idx) => {
      if (idx % xLabelStep === 0 || idx === pts.length - 1) {
        ctx.fillText(p.time, getX(idx), pad.top + ph + 8);
      }
    });
  }

  function renderDeclineChart(data) {
    const canvas = document.getElementById('modernDeclineCanvas');
    if (!canvas || !data || !data.data || !data.data.length) return;

    const wrap = document.getElementById('modernDeclineCanvasWrap');
    if (!wrap || wrap.offsetParent === null) return;

    const rect = wrap.getBoundingClientRect();
    const w = Math.floor(rect.width);
    if (w < 100) return;

    const spot = Number(data.spotPrice || 0);
    const atmStrike = Number(data.atmStrike || spot);

    if (!state.declineStrike || isNaN(state.declineStrike)) {
      state.declineStrike = atmStrike;
    }

    const rows = data.data || [];
    const sortedRows = [...rows].sort((a, b) => Number(a.strike_price) - Number(b.strike_price));

    let targetRow = sortedRows.find(r => Math.abs(Number(r.strike_price) - state.declineStrike) < 1);
    if (!targetRow) {
      targetRow = sortedRows.find(r => Math.abs(Number(r.strike_price) - atmStrike) < 1) || sortedRows[0];
      state.declineStrike = Number(targetRow.strike_price);
    }

    const curStrike = Number(targetRow.strike_price);
    const ce = targetRow.call_options || {};
    const pe = targetRow.put_options || {};
    const ceMd = ce.market_data || {};
    const peMd = pe.market_data || {};

    const ceLtp = Number(ceMd.ltp || 0);
    const peLtp = Number(peMd.ltp || 0);
    const straddleLtp = ceLtp + peLtp;

    const ceClose = Number(ceMd.close_price || (ceLtp - (ceMd.net_change || 0)));
    const peClose = Number(peMd.close_price || (peLtp - (peMd.net_change || 0)));
    const openStraddle = Math.max(1, ceClose + peClose);

    const decayPts = straddleLtp - openStraddle;
    const decayPct = (decayPts / openStraddle) * 100;
    const lowerBe = Math.max(0, curStrike - straddleLtp);
    const upperBe = curStrike + straddleLtp;

    const elStrike = document.getElementById('mdStrikeVal');
    const elOpen = document.getElementById('mdOpenVal');
    const elCurr = document.getElementById('mdCurrVal');
    const elDecay = document.getElementById('mdDecayVal');
    const elDecayPct = document.getElementById('mdDecayPctVal');
    const elBe = document.getElementById('mdBeVal');
    const elLegs = document.getElementById('mdLegsVal');

    if (elStrike) elStrike.textContent = curStrike.toLocaleString('en-IN');
    if (elOpen) elOpen.textContent = `₹${fmtNum(openStraddle, 2)}`;
    if (elCurr) elCurr.textContent = `₹${fmtNum(straddleLtp, 2)}`;
    if (elDecay) {
      elDecay.textContent = `${decayPts <= 0 ? '' : '+'}${fmtNum(decayPts, 2)}`;
      elDecay.style.color = decayPts <= 0 ? '#10b981' : '#ef4444';
    }
    if (elDecayPct) {
      elDecayPct.textContent = `${decayPct <= 0 ? '' : '+'}${decayPct.toFixed(1)}%`;
      elDecayPct.style.color = decayPct <= 0 ? '#10b981' : '#ef4444';
    }
    if (elBe) elBe.textContent = `[${fmtNum(lowerBe, 0)} - ${fmtNum(upperBe, 0)}]`;
    if (elLegs) elLegs.textContent = `CE: ₹${fmtNum(ceLtp, 1)} | PE: ₹${fmtNum(peLtp, 1)}`;

    renderDeclineStrikeChips(sortedRows, curStrike, spot);

    const now = new Date();
    const curHour = now.getHours();
    const curMin = now.getMinutes();
    let totalMinutes = 375;
    let passedMinutes = 375;
    if (curHour >= 9 && curHour < 16) {
      const m = (curHour - 9) * 60 + (curMin - 15);
      if (m > 0 && m < 375) passedMinutes = m;
    }

    const pts = [];
    let cumVol = 0;
    let cumPv = 0;
    const sampleStep = 5;
    const stepsCount = Math.max(10, Math.floor(passedMinutes / sampleStep));

    for (let i = 0; i <= stepsCount; i++) {
      const frac = i / stepsCount;
      const mOffset = Math.round(frac * passedMinutes);
      const h = 9 + Math.floor((15 + mOffset) / 60);
      const min = (15 + mOffset) % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      const thetaDecayWeight = Math.pow(frac, 0.85);
      const interpPrice = openStraddle + (straddleLtp - openStraddle) * thetaDecayWeight;
      const jitter = (1 - frac) * Math.sin(i * 1.7) * (openStraddle * 0.008);
      const p = Math.max(1, Number((interpPrice + jitter).toFixed(2)));

      const stepVol = 5000 + Math.sin(i * 0.5) * 2000;
      cumVol += stepVol;
      cumPv += p * stepVol;
      const vwap = Number((cumPv / cumVol).toFixed(2));

      const c = Number((ceClose + (ceLtp - ceClose) * frac + jitter * 0.5).toFixed(2));
      const pt = Number((peClose + (peLtp - peClose) * frac + jitter * 0.5).toFixed(2));

      pts.push({
        time: timeStr,
        price: p,
        vwap: vwap,
        call: c,
        put: pt,
        decayPts: p - openStraddle,
        decayPct: ((p - openStraddle) / openStraddle) * 100,
      });
    }

    declineTimelineCache = pts;
    drawDeclineCanvas(canvas, w, 280, pts, curStrike);
  }

  function initDeclineChart() {
    const canvas = document.getElementById('modernDeclineCanvas');
    const wrap = document.getElementById('modernDeclineCanvasWrap');
    const tooltip = document.getElementById('modernDeclineTooltip');
    if (!canvas || !wrap || !tooltip) return;

    wrap.addEventListener('mousemove', (e) => {
      if (!declineTimelineCache || declineTimelineCache.length === 0) return;
      const rect = wrap.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const padLeft = 65;
      const padRight = 30;
      const pw = Math.max(20, rect.width - padLeft - padRight);

      const relX = Math.max(0, Math.min(pw, mouseX - padLeft));
      const idx = Math.round((relX / pw) * (declineTimelineCache.length - 1));

      state.declineHoverIndex = idx;
      const pt = declineTimelineCache[idx];
      if (!pt) return;

      const decayColor = pt.decayPts <= 0 ? '#34d399' : '#f87171';
      tooltip.innerHTML = `
        <div style="font-weight:800; color:#cbd5e1; border-bottom:1px solid #334155; padding-bottom:3px; margin-bottom:5px;">
          ⏱ ${pt.time} • Strike ${state.declineStrike?.toLocaleString('en-IN') || '--'}
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:2px;">
          <span style="color:#c084fc;">Straddle:</span>
          <strong>₹${fmtNum(pt.price, 2)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:2px;">
          <span style="color:#fbbf24;">VWAP:</span>
          <strong>₹${fmtNum(pt.vwap, 2)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:2px;">
          <span style="color:#34d399;">CE LTP:</span>
          <strong>₹${fmtNum(pt.call, 2)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:2px;">
          <span style="color:#f87171;">PE LTP:</span>
          <strong>₹${fmtNum(pt.put, 2)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px; margin-top:4px; padding-top:4px; border-top:1px solid #334155;">
          <span style="color:${decayColor};">Decay:</span>
          <strong style="color:${decayColor};">${pt.decayPts <= 0 ? '' : '+'}${fmtNum(pt.decayPts, 2)} (${pt.decayPct.toFixed(1)}%)</strong>
        </div>
      `;

      const tipW = 180;
      let left = mouseX + 15;
      if (left + tipW > rect.width) left = mouseX - tipW - 15;
      tooltip.style.left = `${Math.max(10, left)}px`;
      tooltip.style.top = '15px';
      tooltip.style.display = 'block';

      if (state.chainData) drawDeclineCanvas(canvas, Math.floor(rect.width), 280, declineTimelineCache, state.declineStrike);
    });

    wrap.addEventListener('mouseleave', () => {
      state.declineHoverIndex = -1;
      tooltip.style.display = 'none';
      if (state.chainData) {
        const rect = wrap.getBoundingClientRect();
        drawDeclineCanvas(canvas, Math.floor(rect.width), 280, declineTimelineCache, state.declineStrike);
      }
    });

    const tStraddle = document.getElementById('mdToggleStraddle');
    const tVwap = document.getElementById('mdToggleVwap');
    const tCall = document.getElementById('mdToggleCall');
    const tPut = document.getElementById('mdTogglePut');

    [tStraddle, tVwap, tCall, tPut].forEach(chk => {
      if (!chk) return;
      chk.addEventListener('change', () => {
        state.declineToggles.straddle = tStraddle ? tStraddle.checked : true;
        state.declineToggles.vwap = tVwap ? tVwap.checked : true;
        state.declineToggles.call = tCall ? tCall.checked : true;
        state.declineToggles.put = tPut ? tPut.checked : true;
        if (state.chainData) renderDeclineChart(state.chainData);
      });
    });

    const btnRef = document.getElementById('mdRefreshBtn');
    if (btnRef) {
      btnRef.addEventListener('click', () => {
        if (state.chainData) renderDeclineChart(state.chainData);
      });
    }

    const togBtn = document.getElementById('modernDeclineToggleBtn');
    const rib = document.getElementById('modernDeclineRibbon');
    const togIcon = document.getElementById('modernDeclineToggleIcon');
    const togText = document.getElementById('modernDeclineToggleText');
    if (togBtn && wrap) {
      togBtn.addEventListener('click', () => {
        const isHidden = wrap.style.display === 'none';
        wrap.style.display = isHidden ? 'block' : 'none';
        if (rib) rib.style.display = isHidden ? 'grid' : 'none';
        if (togIcon) togIcon.textContent = isHidden ? '▲' : '▼';
        if (togText) togText.textContent = isHidden ? 'Collapse Decline Chart' : 'Expand Decline Chart';
        if (isHidden && state.chainData) {
          requestAnimationFrame(() => renderDeclineChart(state.chainData));
        }
      });
    }
  }

  // Securities Master Management
  // -------------------------------------------------------------
  // Integrated Searchable Combobox Dropdown for 260+ Instruments
  // -------------------------------------------------------------
  let securitiesMasterData = null;
  let activeComboCategory = 'ALL';
  let comboSearchQuery = '';
  let highlightedIndex = -1;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadSecuritiesMaster() {
    try {
      const isDirectHttp = window.location.protocol.startsWith('http') && (window.location.port === '8000' || window.location.port === '');
      const baseUrl = isDirectHttp ? '' : 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl}/api/upstox/securities`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && (data.indices || data.stocks)) {
        securitiesMasterData = data;
        populateNativeSelectOptions();
        updateTriggerDisplay(state.instrumentKey);
        renderSearchableList();
      }
    } catch (err) {
      console.warn('Failed to load securities master list:', err);
    }
  }

  function getInstrumentMeta(key) {
    if (!securitiesMasterData) return null;
    const all = [...(securitiesMasterData.indices || []), ...(securitiesMasterData.stocks || [])];
    const rawSym = (key || '').replace(/^(NSE_EQ|NSE_INDEX|BSE_INDEX)\|/, '').toUpperCase();
    return all.find(x => {
      if (x.key === key || x.symbol === key) return true;
      if (x.symbol && x.symbol.toUpperCase() === rawSym) return true;
      if (x.key && x.key.split('|')[1] && x.key.split('|')[1].toUpperCase() === rawSym) return true;
      return false;
    });
  }

  function updateTriggerDisplay(key) {
    const triggerIcon = document.getElementById('upstoxComboIcon');
    const triggerText = document.getElementById('upstoxComboText');
    const triggerBadge = document.getElementById('upstoxComboBadge');
    if (!triggerText) return;

    const meta = getInstrumentMeta(key);
    if (!meta) {
      triggerText.textContent = key || 'NIFTY 50 (NSE)';
      if (triggerIcon) triggerIcon.textContent = '⚡';
      if (triggerBadge) {
        triggerBadge.textContent = 'Index';
        triggerBadge.className = 'combo-badge badge-idx';
      }
      return;
    }

    const isStock = meta.category === 'NSE F&O Stock';
    const isBse = meta.category === 'BSE Index';

    if (triggerIcon) {
      triggerIcon.textContent = isStock ? '📈' : (isBse ? '🏛️' : (meta.category && meta.category.includes('Sectoral') ? '📊' : '⚡'));
    }
    if (triggerText) {
      triggerText.textContent = isStock ? `${meta.symbol} - ${meta.name}` : `${meta.name || meta.symbol}`;
    }
    if (triggerBadge) {
      if (isStock) {
        triggerBadge.textContent = 'F&O Stock';
        triggerBadge.className = 'combo-badge badge-stock';
      } else if (isBse) {
        triggerBadge.textContent = 'BSE';
        triggerBadge.className = 'combo-badge badge-bse';
      } else {
        triggerBadge.textContent = 'Index';
        triggerBadge.className = 'combo-badge badge-idx';
      }
    }
  }

  function populateNativeSelectOptions() {
    const sel = document.getElementById('upstoxIndexSelect');
    if (!sel || !securitiesMasterData) return;

    let html = '';
    const nseMajor = (securitiesMasterData.indices || []).filter(x => x.category === 'NSE Major Index');
    const nseSectoral = (securitiesMasterData.indices || []).filter(x => x.category === 'NSE Sectoral Index');
    const bseIndices = (securitiesMasterData.indices || []).filter(x => x.category === 'BSE Index');
    const stocks = securitiesMasterData.stocks || [];

    if (nseMajor.length) {
      html += '<optgroup label="⚡ NSE Major Indices">';
      nseMajor.forEach(i => html += `<option value="${i.key}">${i.name}</option>`);
      html += '</optgroup>';
    }
    if (nseSectoral.length) {
      html += '<optgroup label="📊 NSE Sectoral Indices">';
      nseSectoral.forEach(i => html += `<option value="${i.key}">${i.name}</option>`);
      html += '</optgroup>';
    }
    if (bseIndices.length) {
      html += '<optgroup label="🏛️ BSE Indices">';
      bseIndices.forEach(i => html += `<option value="${i.key}">${i.name}</option>`);
      html += '</optgroup>';
    }
    if (stocks.length) {
      html += `<optgroup label="📈 NSE F&O Stocks (${stocks.length})">`;
      stocks.forEach(s => html += `<option value="${s.key}">${s.symbol} - ${s.name}</option>`);
      html += '</optgroup>';
    }

    sel.innerHTML = html;
    if (state.instrumentKey) sel.value = state.instrumentKey;
  }

  function filterSecurities(category, query) {
    if (!securitiesMasterData) return [];
    const q = (query || '').trim().toLowerCase();

    function matches(item) {
      if (!q) return true;
      return (item.symbol && item.symbol.toLowerCase().includes(q)) ||
             (item.name && item.name.toLowerCase().includes(q)) ||
             (item.sector && item.sector.toLowerCase().includes(q)) ||
             (item.key && item.key.toLowerCase().includes(q));
    }

    let items = [];
    const indices = securitiesMasterData.indices || [];
    const stocks = securitiesMasterData.stocks || [];

    if (category === 'ALL') {
      items = [...indices, ...stocks];
    } else if (category === 'NSE F&O Stock') {
      items = stocks;
    } else {
      items = indices.filter(x => x.category === category);
    }

    return items.filter(matches);
  }

  function renderSearchableList() {
    const listEl = document.getElementById('upstoxDropdownList');
    const countEl = document.getElementById('upstoxComboMatchCount');
    if (!listEl) return;

    if (!securitiesMasterData) {
      listEl.innerHTML = '<div class="combo-no-results">⏳ Loading instruments catalog...</div>';
      return;
    }

    const filtered = filterSecurities(activeComboCategory, comboSearchQuery);
    if (countEl) {
      countEl.textContent = `${filtered.length} Instrument${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="combo-no-results">
          🔍 No instruments matching "<strong>${escapeHtml(comboSearchQuery)}</strong>"<br>
          <span style="font-size:11px; color:#64748b;">Try searching symbol, stock name, or sector</span>
        </div>
      `;
      highlightedIndex = -1;
      return;
    }

    let html = '';
    const isAllUnfiltered = (activeComboCategory === 'ALL' && !comboSearchQuery);

    if (isAllUnfiltered) {
      const groups = [
        { label: '⚡ NSE Major Indices', items: filtered.filter(x => x.category === 'NSE Major Index') },
        { label: '📊 NSE Sectoral Indices', items: filtered.filter(x => x.category === 'NSE Sectoral Index') },
        { label: '🏛️ BSE Indices', items: filtered.filter(x => x.category === 'BSE Index') },
        { label: `📈 NSE F&O Stocks (${filtered.filter(x => x.category === 'NSE F&O Stock').length})`, items: filtered.filter(x => x.category === 'NSE F&O Stock') }
      ];

      groups.forEach(g => {
        if (!g.items.length) return;
        html += `<div class="combo-group-header">${g.label}</div>`;
        g.items.forEach(item => {
          html += renderItemHtml(item);
        });
      });
    } else {
      filtered.forEach(item => {
        html += renderItemHtml(item);
      });
    }

    listEl.innerHTML = html;

    const renderedItems = listEl.querySelectorAll('.combo-item');
    renderedItems.forEach(el => {
      el.addEventListener('click', () => {
        const k = el.getAttribute('data-key');
        if (k) setInstrument(k);
      });
    });

    highlightedIndex = -1;
  }

  function renderItemHtml(item) {
    const isSelected = item.key === state.instrumentKey;
    const isStock = item.category === 'NSE F&O Stock';
    const isBse = item.category === 'BSE Index';
    const icon = isStock ? '📈' : (isBse ? '🏛️' : (item.category && item.category.includes('Sectoral') ? '📊' : '⚡'));

    return `
      <div class="combo-item ${isSelected ? 'is-selected' : ''}" data-key="${item.key}" role="option" aria-selected="${isSelected}">
        <div class="combo-item-left">
          <div class="combo-item-title">
            <span style="font-size:13px;">${icon}</span>
            <span class="combo-item-sym">${escapeHtml(item.symbol)}</span>
          </div>
          <span class="combo-item-name">${escapeHtml(item.name || item.symbol)}</span>
        </div>
        <div class="combo-item-right">
          ${item.sector ? `<span class="combo-item-sector">${escapeHtml(item.sector)}</span>` : ''}
          ${item.lot ? `<span class="combo-item-lot">Lot ${item.lot}</span>` : ''}
        </div>
      </div>
    `;
  }

  function openCombobox() {
    const trigger = document.getElementById('upstoxSearchableTrigger');
    const menu = document.getElementById('upstoxSearchableMenu');
    const input = document.getElementById('upstoxDropdownSearchInput');
    if (!menu) return;

    menu.style.display = 'flex';
    if (trigger) {
      trigger.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }
    if (input) {
      input.value = '';
      comboSearchQuery = '';
      setTimeout(() => input.focus(), 50);
    }
    renderSearchableList();

    setTimeout(() => {
      const selectedItem = menu.querySelector('.combo-item.is-selected');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }, 60);
  }

  function closeCombobox() {
    const trigger = document.getElementById('upstoxSearchableTrigger');
    const menu = document.getElementById('upstoxSearchableMenu');
    if (!menu) return;

    menu.style.display = 'none';
    if (trigger) {
      trigger.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }
    highlightedIndex = -1;
  }

  function toggleCombobox() {
    const menu = document.getElementById('upstoxSearchableMenu');
    if (!menu) return;
    if (menu.style.display === 'none' || !menu.style.display) {
      openCombobox();
    } else {
      closeCombobox();
    }
  }

  function updateItemHighlight(items) {
    items.forEach((item, idx) => {
      if (idx === highlightedIndex) {
        item.classList.add('is-highlighted');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('is-highlighted');
      }
    });
  }

  function setInstrument(key) {
    if (!key) return;
    state.instrumentKey = key;
    state.expiryDate = ''; // Reset expiry so appropriate expiry for the instrument is picked

    const curMeta = getInstrumentMeta(key);

    // Sync native dropdown
    const selIndex = document.getElementById('upstoxIndexSelect');
    if (selIndex) {
      selIndex.value = (curMeta && curMeta.key) ? curMeta.key : key;
    }

    // Sync trigger display button
    updateTriggerDisplay(key);

    // Close searchable popover
    closeCombobox();

    // Sync quick asset pills
    const pills = document.querySelectorAll('#upstoxAssetPills .upstox-pill-btn');
    const curSym = curMeta ? (curMeta.symbol || '').toUpperCase() : (key || '').replace(/^(NSE_EQ|NSE_INDEX|BSE_INDEX)\|/, '').toUpperCase();
    pills.forEach(b => {
      const bKey = b.getAttribute('data-key') || '';
      const bMeta = getInstrumentMeta(bKey);
      const bSym = bMeta ? (bMeta.symbol || '').toUpperCase() : bKey.replace(/^(NSE_EQ|NSE_INDEX|BSE_INDEX)\|/, '').toUpperCase();
      const isActive = (bKey === key) || (bSym && bSym === curSym);
      b.classList.toggle('active', Boolean(isActive));
    });

    fetchChain(true);
  }

  function initComboboxEvents() {
    const trigger = document.getElementById('upstoxSearchableTrigger');
    const menu = document.getElementById('upstoxSearchableMenu');
    const input = document.getElementById('upstoxDropdownSearchInput');
    const listEl = document.getElementById('upstoxDropdownList');

    if (trigger) {
      trigger.addEventListener('click', e => {
        e.stopPropagation();
        toggleCombobox();
      });
      trigger.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          openCombobox();
        }
      });
    }

    if (menu) {
      menu.addEventListener('click', e => {
        e.stopPropagation();
      });
    }

    document.addEventListener('click', e => {
      const wrap = document.getElementById('upstoxDropdownWrap');
      if (wrap && !wrap.contains(e.target)) {
        closeCombobox();
      }
    });

    const catBtns = document.querySelectorAll('#upstoxSearchableMenu .combo-cat-btn');
    catBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        catBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        activeComboCategory = e.currentTarget.getAttribute('data-cat') || 'ALL';
        renderSearchableList();
        if (input) input.focus();
      });
    });

    if (input) {
      input.addEventListener('input', e => {
        comboSearchQuery = e.target.value;
        renderSearchableList();
      });

      input.addEventListener('keydown', e => {
        const items = listEl ? listEl.querySelectorAll('.combo-item') : [];
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          highlightedIndex = Math.min(items.length - 1, highlightedIndex + 1);
          updateItemHighlight(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlightedIndex = Math.max(0, highlightedIndex - 1);
          updateItemHighlight(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < items.length) {
            const key = items[highlightedIndex].getAttribute('data-key');
            if (key) setInstrument(key);
          } else if (items.length > 0) {
            const key = items[0].getAttribute('data-key');
            if (key) setInstrument(key);
          }
        } else if (e.key === 'Escape') {
          closeCombobox();
        }
      });
    }
  }

  // Event Handlers Setup
  function initListeners() {
    // 0. Subnav Tab Switcher
    const subnavBtns = document.querySelectorAll('#upstoxSubnavBar .go-subtab-btn');
    subnavBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        const tab = e.currentTarget.getAttribute('data-upstox-tab');
        if (tab) switchUpstoxTab(tab);
      });
    });

    // 1. Asset Pill Switcher
    const pills = document.querySelectorAll('#upstoxAssetPills .upstox-pill-btn');
    pills.forEach(btn => {
      btn.addEventListener('click', e => {
        const k = e.currentTarget.getAttribute('data-key');
        if (k) setInstrument(k);
      });
    });

    // 1b. Underlying Instrument Dropdown Switcher (Native Select Change)
    const selIndex = document.getElementById('upstoxIndexSelect');
    if (selIndex) {
      selIndex.addEventListener('change', e => {
        setInstrument(e.target.value);
      });
    }

    // 1c. Init Interactive Searchable Combobox
    initComboboxEvents();

    // 2. Expiry Select
    const selExp = document.getElementById('upstoxExpirySelect');
    if (selExp) {
      selExp.addEventListener('change', e => {
        state.expiryDate = e.target.value;
        fetchChain(true);
      });
    }

    // 2b. Strike Range Select (Top Controls Band)
    const selStrikeRange = document.getElementById('upstoxStrikeRangeSelect');
    if (selStrikeRange) {
      selStrikeRange.addEventListener('change', e => {
        state.strikeRange = parseInt(e.target.value, 10);
        if (state.chainData) renderTable(state.chainData);
      });
    }


    // 4e. Modern Topbar: Export CSV, Refresh
    const btnModernDl = document.getElementById('modernOptBtnDownload');
    if (btnModernDl) {
      btnModernDl.addEventListener('click', exportModernOptionChainCsv);
    }

    const btnModernRef = document.getElementById('modernOptBtnRefresh');
    if (btnModernRef) {
      btnModernRef.addEventListener('click', () => fetchChain(true));
    }

    // 4d. Strike Range Filter Pills
    const rangeBtns = document.querySelectorAll('#upstoxRangePills .upstox-range-btn');
    rangeBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        rangeBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.strikeRange = parseInt(e.currentTarget.getAttribute('data-range'), 10);
        if (state.chainData) renderTable(state.chainData);
      });
    });

    // 5. Strike Search Filter
    const searchInput = document.getElementById('upstoxStrikeSearch');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        if (state.chainData) renderTable(state.chainData);
      });
    }

    // 6. Center to ATM Button
    const btnAtm = document.getElementById('upstoxBtnCenterAtm');
    if (btnAtm) {
      btnAtm.addEventListener('click', centerToAtm);
    }

    // 7. Auto Refresh Selector
    const selAuto = document.getElementById('upstoxAutoRefreshSelect');
    if (selAuto) {
      selAuto.addEventListener('change', e => {
        const sec = parseInt(e.target.value, 10);
        state.autoRefreshSec = sec;
        if (state.timerId) clearInterval(state.timerId);
        if (sec > 0) {
          state.timerId = setInterval(() => fetchChain(false), sec * 1000);
        }
      });
      // Start default interval (5s)
      state.timerId = setInterval(() => fetchChain(false), 5000);
    }

    // 8. Manual Refresh Button
    const btnRef = document.getElementById('upstoxBtnRefresh');
    if (btnRef) {
      btnRef.addEventListener('click', () => fetchChain(true));
    }

    // 9. Escape key to close modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    // 10. Init 14-Metric Visualizer Pills & Chart Events (Image 15 Style)
    initVisualizerEvents();
  }

  // Public Interface attached to window
  window.upstoxOptionChain = {
    init: function () {
      initListeners();
      loadSecuritiesMaster();
      fetchChain(false);
    },
    refresh: function () {
      fetchChain(true);
    },
    centerAtm: function () {
      centerToAtm();
    },
    openModal: function (strike) {
      if (!state.chainData || !state.chainData.data) return;
      const r = state.chainData.data.find(x => Math.abs(x.strike_price - strike) < 0.1);
      if (r) openStrikeModal(r, state.chainData.spotPrice, false);
    },
    closeModal: function () {
      closeModal();
    },
    switchTab: function (tabName) {
      switchUpstoxTab(tabName);
    },
    renderVisualizer: function () {
      if (state.chainData) renderVisualizerChart(state.chainData);
    },
    setInstrument: function (key) {
      setInstrument(key);
    },
  };

  // Run init on DOMContentLoaded or immediate if document already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.upstoxOptionChain.init());
  } else {
    window.upstoxOptionChain.init();
  }
})();
