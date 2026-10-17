/**
 * global_markets_desk.js
 * Institutional Real-Time Global Indices & Multi-Asset Macro Desk
 * Moneycontrol-style High-Density Regional Tables, Live GIFT Nifty Cue & Fast In-Place Ticks
 * Fully integrated into TradersDesk.in Main Terminal
 */

(function () {
  "use strict";

  let gmCachedData = null;
  let currentGmCategory = "all";
  let gmSearchQuery = "";
  let gmCurrentViewMode = "table"; // "table" (default Moneycontrol style) | "cards"
  let gmAutoRefreshTimer = null;
  let gmPreviousPrices = {};
  let isInitialized = false;

  const CATEGORY_META = {
    us: { title: "US Markets (Wall Street & Futures)", flag: "🇺🇸" },
    asia: { title: "Asian Markets & GIFT Nifty", flag: "🌏" },
    europe: { title: "European Markets", flag: "🇪🇺" },
    commodity: { title: "Commodities & Precious Metals", flag: "🛢️" },
    currency: { title: "Currencies & Forex Rates", flag: "💱" },
    adr: { title: "Indian ADRs (NYSE & Nasdaq)", flag: "🇮🇳" },
    bonds: { title: "Sovereign Bond Yields", flag: "📑" },
    crypto: { title: "Digital Assets & Crypto", flag: "🪙" }
  };

  function initGlobalMarketsDesk() {
    setupControls();
    loadGlobalMarketsSuite(false);

    // Auto-refresh quotes every 10 seconds (ultra-fast in-memory cache on backend)
    if (gmAutoRefreshTimer) clearInterval(gmAutoRefreshTimer);
    gmAutoRefreshTimer = setInterval(() => {
      const autoBox = document.getElementById("gmAutoRefresh");
      const panel = document.getElementById("panelGlobalMarkets");
      if (autoBox && autoBox.checked && panel && (panel.style.display !== "none" || panel.classList.contains("active"))) {
        loadGlobalMarketsSuite(true);
      }
    }, 10000);
  }

  function setupControls() {
    if (isInitialized) return;
    isInitialized = true;

    // Category Filter Pills
    const catBtns = document.querySelectorAll("#gmCategoryBar .gm-cat-btn");
    catBtns.forEach((b) => {
      b.addEventListener("click", () => {
        catBtns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        currentGmCategory = b.getAttribute("data-cat") || "all";
        renderGlobalMarketsViews(true); // force re-render when switching category
      });
    });

    // Search Box
    const searchInput = document.getElementById("gmSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        gmSearchQuery = (e.target.value || "").trim().toLowerCase();
        renderGlobalMarketsViews(true);
      });
    }

    // View Mode Toggle (Grouped Table vs Grid Cards)
    const viewTableBtn = document.getElementById("gmViewTableBtn");
    const viewCardsBtn = document.getElementById("gmViewCardsBtn");
    const tablesContainer = document.getElementById("gmRegionalTablesContainer");
    const cardsGrid = document.getElementById("gmCardsGrid");

    if (viewTableBtn && viewCardsBtn && tablesContainer && cardsGrid) {
      viewTableBtn.addEventListener("click", () => {
        gmCurrentViewMode = "table";
        viewTableBtn.classList.add("active");
        viewCardsBtn.classList.remove("active");
        tablesContainer.style.display = "block";
        cardsGrid.style.display = "none";
      });

      viewCardsBtn.addEventListener("click", () => {
        gmCurrentViewMode = "cards";
        viewCardsBtn.classList.add("active");
        viewTableBtn.classList.remove("active");
        tablesContainer.style.display = "none";
        cardsGrid.style.display = "grid";
      });
    }

    // Manual Refresh Button
    const refBtn = document.getElementById("gmRefreshBtn");
    if (refBtn) {
      refBtn.addEventListener("click", () => {
        loadGlobalMarketsSuite(false);
      });
    }
  }

  async function loadGlobalMarketsSuite(isSilent = false) {
    try {
      const res = await fetch(`/api/global-markets?category=all`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || !json.ok) throw new Error("Invalid response");

      gmCachedData = json;

      // Update Global Sentiment Card & Category Counts
      updateGlobalSentimentCard(json.categorySummary, json.sections);
      updateCategoryCounts(json.categorySummary, json.totalAssets);

      // Render or In-Place Update views
      renderGlobalMarketsViews(false);

    } catch (err) {
      console.error("Failed to load global markets suite:", err);
      if (!isSilent) {
        const cont = document.getElementById("gmRegionalTablesContainer");
        if (cont) {
          cont.innerHTML = `<div style="padding:40px; text-align:center; color:#ef4444;">
            Failed to stream Global Markets feed. Please verify server connection.
          </div>`;
        }
      }
    }
  }

  function updateGiftNiftyHero(cue, metrics) {
    const elCard = document.getElementById("gmGiftHeroCard");
    if (!elCard) return;
    const gData = (metrics && metrics.giftNifty) || {};
    const ltp = gData.ltp || cue.giftLtp || 22450.0;
    const chg = gData.change !== undefined ? gData.change : (cue.gapPoints || 0.0);
    const pct = gData.changePct !== undefined ? gData.changePct : 0.0;
    const isPos = chg >= 0;

    const elLtp = document.getElementById("gmHeroGiftLtp");
    const elChg = document.getElementById("gmHeroGiftChg");
    const elCue = document.getElementById("gmGiftCueTag");
    const elBadge = document.getElementById("gmGiftBadge");
    const elSpot = document.getElementById("gmHeroNiftySpot");

    if (elLtp) elLtp.textContent = Number(ltp).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (elChg) {
      elChg.textContent = `${isPos ? "+" : ""}${Number(chg).toFixed(2)} (${isPos ? "+" : ""}${Number(pct).toFixed(2)}%)`;
      elChg.style.color = isPos ? "#10b981" : "#f87171";
    }

    if (elCue && cue) {
      elCue.textContent = cue.cueText || `${cue.openingBias} (${isPos ? '+' : ''}${cue.gapPoints} pts)`;
      elCue.classList.toggle("bearish", !isPos);
    }

    if (elBadge) {
      elBadge.classList.toggle("bearish", !isPos);
    }
    if (elCard) {
      elCard.classList.toggle("bearish", !isPos);
    }

    if (elSpot && cue && cue.niftySpot) {
      elSpot.textContent = Number(cue.niftySpot).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Range bar
    const giftItem = gmCachedData && gmCachedData.assets ? gmCachedData.assets.find(x => x.id === "gift_nifty") : null;
    if (giftItem) {
      const elLow = document.getElementById("gmHeroGiftLow");
      const elHigh = document.getElementById("gmHeroGiftHigh");
      const elFill = document.getElementById("gmHeroGiftRangeFill");

      if (elLow) elLow.textContent = Number(giftItem.low).toFixed(2);
      if (elHigh) elHigh.textContent = Number(giftItem.high).toFixed(2);

      const spread = giftItem.high - giftItem.low;
      const fillPct = spread > 0 ? Math.min(100, Math.max(0, ((giftItem.ltp - giftItem.low) / spread) * 100)) : 50;
      if (elFill) {
        elFill.style.width = `${fillPct.toFixed(1)}%`;
        elFill.classList.toggle("bearish", !isPos);
      }
    }
  }

  function updateGlobalSentimentCard(summary, sections) {
    if (!gmCachedData || !gmCachedData.assets) return;
    const all = gmCachedData.assets;
    const adv = all.filter(x => x.change > 0).length;
    const dec = all.filter(x => x.change < 0).length;
    const total = adv + dec || 1;
    const advPct = Math.round((adv / total) * 100);

    const elAdv = document.getElementById("gmAdvCount");
    const elDec = document.getElementById("gmDecCount");
    const elFill = document.getElementById("gmSentimentFill");
    const elBias = document.getElementById("gmGlobalBiasBadge");

    if (elAdv) elAdv.textContent = `🟢 ${adv} Advancing (${advPct}%)`;
    if (elDec) elDec.textContent = `🔴 ${dec} Declining (${100 - advPct}%)`;
    if (elFill) elFill.style.width = `${advPct}%`;

    if (elBias) {
      if (advPct >= 60) {
        elBias.textContent = "STRONG BULLISH";
        elBias.style.background = "rgba(16, 185, 129, 0.2)";
        elBias.style.color = "#34d399";
      } else if (advPct >= 50) {
        elBias.textContent = "MILDLY POSITIVE";
        elBias.style.background = "rgba(16, 185, 129, 0.15)";
        elBias.style.color = "#10b981";
      } else if (advPct >= 40) {
        elBias.textContent = "RANGEBOUND / MIXED";
        elBias.style.background = "rgba(245, 158, 11, 0.15)";
        elBias.style.color = "#fbbf24";
      } else {
        elBias.textContent = "BEARISH PRESSURE";
        elBias.style.background = "rgba(239, 68, 68, 0.2)";
        elBias.style.color = "#f87171";
      }
    }

    // 3 Regional Pillars
    const formatPillar = (id, elId) => {
      const sec = sections && sections[id];
      const el = document.getElementById(elId);
      if (!el) return;
      if (sec) {
        const avg = sec.avgPct || 0.0;
        const sign = avg >= 0 ? "+" : "";
        el.textContent = `${sign}${avg.toFixed(2)}%`;
        el.style.color = avg >= 0 ? "#10b981" : "#f87171";
      } else {
        el.textContent = "FLAT";
        el.style.color = "#94a3b8";
      }
    };

    formatPillar("us", "gmBiasUs");
    formatPillar("asia", "gmBiasAsia");
    formatPillar("europe", "gmBiasEurope");
  }

  function updateCategoryCounts(summary, totalCount) {
    if (totalCount !== undefined) {
      const el = document.getElementById("countAll");
      if (el) el.textContent = totalCount;
    }
    if (!summary) return;

    const countMap = {
      us: "countUs",
      asia: "countAsia",
      europe: "countEurope",
      commodity: "countCommodity",
      currency: "countCurrency",
      adr: "countAdr",
      bonds: "countBonds",
      crypto: "countCrypto"
    };

    Object.keys(countMap).forEach((k) => {
      const el = document.getElementById(countMap[k]);
      if (el && summary[k]) {
        el.textContent = summary[k].count;
      }
    });
  }

  function renderGlobalMarketsViews(forceRebuild = false) {
    if (!gmCachedData || !gmCachedData.assets) return;

    if (gmCurrentViewMode === "table") {
      renderMoneycontrolGroupedTables(forceRebuild);
    } else {
      renderGridCards(forceRebuild);
    }
  }

  function renderMoneycontrolGroupedTables(forceRebuild = false) {
    const container = document.getElementById("gmRegionalTablesContainer");
    if (!container) return;

    const sections = gmCachedData.sections || {};
    const hasExistingDom = container.querySelector(".gm-regional-section") !== null;

    // Filter which sections to show based on category filter
    let sectionKeys = Object.keys(CATEGORY_META);
    if (currentGmCategory !== "all") {
      sectionKeys = sectionKeys.filter(k => k === currentGmCategory);
    }

    // If query is active or forceRebuild or DOM doesn't exist, rebuild the table skeleton
    if (forceRebuild || !hasExistingDom || gmSearchQuery) {
      let html = "";

      sectionKeys.forEach((secKey) => {
        let secData = sections[secKey];
        if (!secData || !secData.items) return;

        let items = secData.items;
        if (gmSearchQuery) {
          items = items.filter(x => {
            const sym = (x.symbol || "").toLowerCase();
            const nm = (x.name || "").toLowerCase();
            const ctry = (x.country || "").toLowerCase();
            return sym.includes(gmSearchQuery) || nm.includes(gmSearchQuery) || ctry.includes(gmSearchQuery);
          });
          if (items.length === 0) return;
        }

        const meta = CATEGORY_META[secKey] || { title: secData.title, flag: "🌐" };
        const adv = items.filter(x => x.change > 0).length;
        const dec = items.filter(x => x.change < 0).length;
        const avgChg = items.length ? (items.reduce((acc, x) => acc + (x.changePct || 0), 0) / items.length) : 0.0;
        const avgSign = avgChg >= 0 ? "+" : "";

        html += `
          <div class="gm-regional-section" id="gmSec_${secKey}">
            <div class="gm-regional-header">
              <h3>
                <span>${meta.flag}</span>
                <span>${meta.title}</span>
                <span style="font-size:11px; font-weight:600; color:#94a3b8; font-family:var(--font-mono);">(${items.length} Assets)</span>
              </h3>
              <div style="display:flex; align-items:center; gap:12px; font-size:11px; font-family:var(--font-mono);">
                <span style="color:#10b981; font-weight:700;">🟢 ${adv} Adv</span>
                <span style="color:#ef4444; font-weight:700;">🔴 ${dec} Dec</span>
                <span style="padding:2px 8px; border-radius:4px; font-weight:700; background:${avgChg >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color:${avgChg >= 0 ? '#34d399' : '#f87171'};">
                  Avg ${avgSign}${avgChg.toFixed(2)}%
                </span>
              </div>
            </div>

            <div style="overflow-x:auto;">
              <table class="gm-regional-table">
                <thead>
                  <tr>
                    <th style="min-width:180px;">BENCHMARK / ASSET</th>
                    <th style="text-align:right; min-width:110px;">LTP</th>
                    <th style="text-align:right; min-width:90px;">CHANGE</th>
                    <th style="text-align:center; min-width:90px;">% CHANGE</th>
                    <th style="min-width:140px; text-align:center;">DAY RANGE (L - H)</th>
                    <th style="min-width:130px; text-align:center;">52-WEEK RANGE</th>
                    <th style="text-align:right; min-width:90px;">PREV CLOSE</th>
                    <th style="text-align:center; min-width:80px;">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(asset => renderTableRowHtml(asset)).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      });

      if (!html) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#94a3b8;">No global assets found matching '${escapeHtml(gmSearchQuery)}'</div>`;
      } else {
        container.innerHTML = html;
      }

    } else {
      // IN-PLACE TICK UPDATES (ZERO REBUILD LAG!)
      gmCachedData.assets.forEach((asset) => {
        updateRowCellsInPlace(asset);
      });
    }
  }

  function renderTableRowHtml(asset) {
    const isPos = asset.change >= 0;
    const sign = isPos ? "+" : "";
    const chgColor = isPos ? "#10b981" : "#ef4444";
    const pillClass = isPos ? "gm-pill-pos" : "gm-pill-neg";

    const ltpFormatted = formatAssetPrice(asset.ltp, asset.category, asset.currency);
    const daySpread = asset.high - asset.low;
    const dayPct = daySpread > 0 ? Math.min(100, Math.max(0, ((asset.ltp - asset.low) / daySpread) * 100)) : 50;

    let statusStyle = "background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);";
    if (asset.marketStatus === "CLOSED") {
      statusStyle = "background:rgba(148,163,184,0.12); color:#94a3b8; border:1px solid rgba(148,163,184,0.25);";
    }

    gmPreviousPrices[asset.id] = asset.ltp;

    return `
      <tr id="gmRow_${asset.id}" data-asset-id="${asset.id}">
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">${asset.flag || "🌐"}</span>
            <div>
              <div style="font-weight:800; font-family:var(--font-mono); color:#fff; font-size:13px;">${asset.symbol}</div>
              <div style="font-size:11px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</div>
            </div>
          </div>
        </td>
        <td style="text-align:right;">
          <span class="gm-cell-ltp" id="gmLtp_${asset.id}" style="font-family:var(--font-mono); font-weight:800; font-size:13px; color:#fff; padding:2px 4px; border-radius:3px;">
            ${ltpFormatted}
          </span>
        </td>
        <td style="text-align:right;">
          <span id="gmChg_${asset.id}" style="font-family:var(--font-mono); font-weight:700; color:${chgColor};">
            ${sign}${Number(asset.change).toFixed(2)}
          </span>
        </td>
        <td style="text-align:center;">
          <span id="gmPct_${asset.id}" class="${pillClass}">
            ${sign}${Number(asset.changePct).toFixed(2)}%
          </span>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; justify-content:space-between; font-size:9.5px; font-family:var(--font-mono); color:#94a3b8;">
              <span id="gmLow_${asset.id}">${formatCompactPrice(asset.low)}</span>
              <span id="gmHigh_${asset.id}">${formatCompactPrice(asset.high)}</span>
            </div>
            <div class="gm-table-range-track">
              <div class="gm-range-fill ${!isPos ? 'bearish' : ''}" id="gmRangeFill_${asset.id}" style="width:${dayPct.toFixed(1)}%;"></div>
            </div>
          </div>
        </td>
        <td style="text-align:center; font-family:var(--font-mono); font-size:11px; color:#94a3b8;">
          ${formatCompactPrice(asset.week52Low)} - ${formatCompactPrice(asset.week52High)}
        </td>
        <td style="text-align:right; font-family:var(--font-mono); color:#94a3b8;">
          ${formatCompactPrice(asset.prevClose)}
        </td>
        <td style="text-align:center;">
          <span style="font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:10px; ${statusStyle}">
            ${asset.marketStatus === "OPEN" ? "● OPEN" : "○ CLOSED"}
          </span>
        </td>
      </tr>
    `;
  }

  function updateRowCellsInPlace(asset) {
    const elLtp = document.getElementById(`gmLtp_${asset.id}`);
    if (!elLtp) return; // Row not currently in DOM (e.g. filtered)

    const prevPrice = gmPreviousPrices[asset.id];
    const newPrice = asset.ltp;
    const isPos = asset.change >= 0;
    const sign = isPos ? "+" : "";
    const chgColor = isPos ? "#10b981" : "#ef4444";

    // 1. In-place price with flash
    const formatted = formatAssetPrice(newPrice, asset.category, asset.currency);
    if (elLtp.textContent.trim() !== formatted.trim()) {
      elLtp.textContent = formatted;
      if (prevPrice !== undefined) {
        if (newPrice > prevPrice) {
          elLtp.classList.remove("gm-flash-red");
          elLtp.classList.add("gm-flash-green");
          setTimeout(() => elLtp.classList.remove("gm-flash-green"), 1400);
        } else if (newPrice < prevPrice) {
          elLtp.classList.remove("gm-flash-green");
          elLtp.classList.add("gm-flash-red");
          setTimeout(() => elLtp.classList.remove("gm-flash-red"), 1400);
        }
      }
    }
    gmPreviousPrices[asset.id] = newPrice;

    // 2. In-place Change
    const elChg = document.getElementById(`gmChg_${asset.id}`);
    if (elChg) {
      elChg.textContent = `${sign}${Number(asset.change).toFixed(2)}`;
      elChg.style.color = chgColor;
    }

    // 3. In-place % Change Pill
    const elPct = document.getElementById(`gmPct_${asset.id}`);
    if (elPct) {
      elPct.textContent = `${sign}${Number(asset.changePct).toFixed(2)}%`;
      elPct.className = isPos ? "gm-pill-pos" : "gm-pill-neg";
    }

    // 4. In-place Day Range Bar
    const daySpread = asset.high - asset.low;
    const dayPct = daySpread > 0 ? Math.min(100, Math.max(0, ((newPrice - asset.low) / daySpread) * 100)) : 50;
    const elFill = document.getElementById(`gmRangeFill_${asset.id}`);
    if (elFill) {
      elFill.style.width = `${dayPct.toFixed(1)}%`;
      elFill.classList.toggle("bearish", !isPos);
    }
  }

  function renderGridCards(forceRebuild) {
    const grid = document.getElementById("gmCardsGrid");
    if (!grid) return;

    let items = gmCachedData.assets || [];
    if (currentGmCategory !== "all") {
      items = items.filter(x => x.category === currentGmCategory);
    }
    if (gmSearchQuery) {
      items = items.filter(x => {
        const sym = (x.symbol || "").toLowerCase();
        const nm = (x.name || "").toLowerCase();
        return sym.includes(gmSearchQuery) || nm.includes(gmSearchQuery);
      });
    }

    grid.innerHTML = items.map(asset => {
      const isPos = asset.change >= 0;
      const chgColor = isPos ? "#10b981" : "#ef4444";
      const sign = isPos ? "+" : "";
      const ltpFormatted = formatAssetPrice(asset.ltp, asset.category, asset.currency);
      const daySpread = asset.high - asset.low;
      const dayPct = daySpread > 0 ? Math.min(100, Math.max(0, ((asset.ltp - asset.low) / daySpread) * 100)) : 50;

      return `
        <div class="gm-card" id="gmCard_${asset.id}">
          <div class="gm-card-header">
            <div class="gm-card-title-group">
              <div class="gm-card-symbol-line">
                <span class="gm-card-flag">${asset.flag || "🌐"}</span>
                <span class="gm-card-symbol">${asset.symbol}</span>
              </div>
              <div class="gm-card-name" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</div>
            </div>
            <span class="gm-status-pill ${asset.marketStatus === 'OPEN' ? 'open' : 'closed'}">${asset.marketStatus}</span>
          </div>

          <div class="gm-card-price-row">
            <div class="gm-card-ltp">${ltpFormatted}</div>
            <div class="gm-card-chg-wrap" style="color:${chgColor};">
              <div class="gm-card-chg-val">${sign}${Number(asset.change).toFixed(2)}</div>
              <div class="gm-card-chg-pct">${sign}${Number(asset.changePct).toFixed(2)}%</div>
            </div>
          </div>

          <div class="gm-range-group">
            <div class="gm-range-bar-box">
              <div class="gm-range-labels">
                <span class="gm-range-tag">Day Range</span>
                <span>L: ${formatCompactPrice(asset.low)} | H: ${formatCompactPrice(asset.high)}</span>
              </div>
              <div class="gm-range-track">
                <div class="gm-range-fill ${!isPos ? 'bearish' : ''}" style="width:${dayPct.toFixed(1)}%;"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function formatAssetPrice(ltp, category, currency) {
    if (category === "bonds") {
      return `${Number(ltp).toFixed(2)}%`;
    }
    if (category === "currency" && ltp < 5) {
      return Number(ltp).toFixed(4);
    }
    if (currency === "USD") {
      return `$${Number(ltp).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (currency === "INR" || !currency) {
      return `₹${Number(ltp).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return Number(ltp).toLocaleString("en-US", { minimumFractionDigits: 2 });
  }

  function formatCompactPrice(val) {
    if (val === undefined || val === null) return "--";
    const num = Number(val);
    if (num >= 100000) {
      return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    }
    if (num >= 1000) {
      return num.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return num.toFixed(2);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Expose global controller
  window.globalMarketsDesk = {
    init: initGlobalMarketsDesk,
    refresh: loadGlobalMarketsSuite
  };

})();
