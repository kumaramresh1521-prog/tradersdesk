/**
 * PAGE 2 CONTROLLER: GLOBAL MARKETS & STRADDLE + FII/DII + BREADTH & CONTRIBUTION
 * Fully Supports Night Mode (Dark Obsidian) & White Mode (Crisp Institutional)
 */

(function () {
  "use strict";

  // State
  let currentSuite = "straddle"; // 'straddle', 'fiidii', 'contribution'
  let currentSymbol = "nifty50";
  let isLightMode = false;
  let currentToolsSubView = "global"; // 'global' or 'straddle'
  let currentGmCategory = "all";
  let currentGmView = "cards"; // 'cards' or 'table'
  let gmSearchQuery = "";
  let gmAutoRefreshTimer = null;
  let gmPreviousPrices = {};
  let gmCachedData = null;

  // Chart Cache
  const charts = {};

  function isLight() {
    return document.body.classList.contains("theme-light");
  }

  function getThemeColors() {
    const light = isLight();
    return {
      bg: light ? "#ffffff" : "#111a2e",
      text: light ? "#64748b" : "#94a3b8",
      textBright: light ? "#0f172a" : "#ffffff",
      grid: light ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)",
      teal: light ? "#0284c7" : "#00e5ff",
      green: light ? "#059669" : "#10b981",
      red: light ? "#e11d48" : "#f43f5e",
      amber: light ? "#d97706" : "#f59e0b",
      blue: light ? "#0284c7" : "#38bdf8",
      purple: light ? "#7c3aed" : "#a855f7"
    };
  }

  // ========================================================================
  // THEME MANAGEMENT (Night Mode / White Mode)
  // ========================================================================
  function initTheme() {
    const saved = localStorage.getItem("p2_theme") || "dark";
    if (saved === "light") {
      applyTheme(true);
    } else {
      applyTheme(false);
    }

    const btn = document.getElementById("p2ThemeToggleBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        const next = !isLight();
        applyTheme(next);
        localStorage.setItem("p2_theme", next ? "light" : "dark");
        // Re-render active view to refresh canvas colors
        refreshActiveView();
      });
    }
  }

  function applyTheme(light) {
    isLightMode = light;
    if (light) {
      document.body.classList.add("theme-light");
      const icon = document.getElementById("p2ThemeIcon");
      const lbl = document.getElementById("p2ThemeLabel");
      if (icon) icon.textContent = "☀️";
      if (lbl) lbl.textContent = "White Mode";
    } else {
      document.body.classList.remove("theme-light");
      const icon = document.getElementById("p2ThemeIcon");
      const lbl = document.getElementById("p2ThemeLabel");
      if (icon) icon.textContent = "🌙";
      if (lbl) lbl.textContent = "Night Mode";
    }
    if (window.AuthService && window.AuthService.syncState) {
      window.AuthService.syncState({ theme: light ? "light" : "dark" });
    }
  }

  function initMobileNavigation() {
  const nav = document.getElementById("mainInstNav") || document.querySelector(".inst-nav");
  if (!nav) return;

  // Touch handling for mega-menu dropdowns on mobile/touch screens
  nav.querySelectorAll(".has-dropdown").forEach((item) => {
    const btn = item.querySelector(".inst-nav-btn");
    if (btn) {
      btn.addEventListener("click", (e) => {
        const isMobile = window.innerWidth <= 860 || ("ontouchstart" in window);
        if (!isMobile) return; // Desktop uses CSS hover

        // If dropdown is not currently open, open it
        if (!item.classList.contains("mobile-open")) {
          e.preventDefault();
          e.stopPropagation();
          // Close other open dropdowns
          nav.querySelectorAll(".has-dropdown.mobile-open").forEach((other) => {
            if (other !== item) other.classList.remove("mobile-open");
          });
          item.classList.add("mobile-open");
        }
      });
    }

    // When clicking any submenu item, allow click through and close dropdown
    item.querySelectorAll(".inst-dd-item").forEach((subItem) => {
      subItem.addEventListener("click", () => {
        item.classList.remove("mobile-open");
      });
    });
  });

  // Tapping anywhere outside closes any open dropdown
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".has-dropdown")) {
      document.querySelectorAll(".has-dropdown.mobile-open").forEach((item) => {
        item.classList.remove("mobile-open");
      });
    }
  });
}

  // ========================================================================
  // INITIALIZATION & SUITE SWITCHING
  // ========================================================================
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initMobileNavigation();
    setupSuiteSwitching();
    setupGlobalControls();
    setupStraddleControls();
    setupPage2OpstraPcrControls();
    setupFiiDiiControls();
    initBreadthContribution();

    // ── Clean URL Router & Deep Linking Initialization ──────────────────────
    const currentPath = (window.location.pathname || "").toLowerCase().replace(/\/$/, "") || "/";
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab") || urlParams.get("suite");
    const hash = (window.location.hash || "").replace("#", "").toLowerCase();

    if (currentPath === "/breadth-contribution" || currentPath === "/contribution" || tabParam === "contribution" || hash === "contribution") {
      activateSuite("contribution", false);
    } else if (currentPath === "/fii-dii-cash" || tabParam === "fiidii" || hash === "fiidii") {
      activateSuite("fiidii", false);
    } else {
      // Default to ATM Straddle Desk
      activateSuite("straddle", false);
    }
  });

  const P2_ROUTES = {
    "/straddle": {
      suite: "straddle",
      title: "Straddle Desk - Live Options Premium Decay & Greeks | TradersDesk",
      desc: "Real-time Options Straddle chart tracking combined CE+PE premium decay, live intraday delta-neutral curves, IV crush, and exact contract expiries."
    },
    "/atm-straddle": {
      suite: "straddle",
      title: "Straddle Desk - Live Options Premium Decay & Greeks | TradersDesk",
      desc: "Real-time Options Straddle chart tracking combined CE+PE premium decay, live intraday delta-neutral curves, IV crush, and exact contract expiries."
    },
    "/fii-dii-cash": {
      suite: "fiidii",
      title: "FII / DII Cash Market Flow - Historical Institutional Inflow & Outflow | TradersDesk",
      desc: "Historical and intraday FII / DII cash market flow with monthly/annual totals, cumulative institutional liquidity charts, and market impact analysis."
    },
    "/breadth-contribution": {
      suite: "contribution",
      title: "Breadth Contribution Desk - Point Contribution to Nifty & Sector Breakdown | TradersDesk",
      desc: "Detailed stock-by-stock point contribution engine showing heavyweights driving Nifty 50, Bank Nifty, and sector rally or decline."
    },
    "/contribution": {
      suite: "contribution",
      title: "Breadth Contribution Desk - Point Contribution to Nifty & Sector Breakdown | TradersDesk",
      desc: "Detailed stock-by-stock point contribution engine showing heavyweights driving Nifty 50, Bank Nifty, and sector rally or decline."
    }
  };

  function syncP2Url(suiteKey, pushHistory = true) {
    let targetUrl = "/straddle";
    if (suiteKey === "fiidii") {
      targetUrl = "/fii-dii-cash";
    } else if (suiteKey === "contribution") {
      targetUrl = "/breadth-contribution";
    }

    const route = P2_ROUTES[targetUrl] || {
      title: "Straddle Desk | TradersDesk",
      desc: "Professional institutional market intelligence terminal."
    };

    if (pushHistory && typeof history !== "undefined" && history.pushState) {
      if (window.location.pathname !== targetUrl) {
        history.pushState({ suite: suiteKey }, route.title, targetUrl);
      }
    }

    try {
      if (route.title) document.title = route.title;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && route.desc) metaDesc.setAttribute("content", route.desc);
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute("href", "https://tradersdesk.in" + targetUrl);
    } catch (_) {}
  }

  // PopState navigation for Page 2
  window.addEventListener("popstate", () => {
    const path = (window.location.pathname || "").toLowerCase().replace(/\/$/, "");
    const r = P2_ROUTES[path];
    if (r) {
      activateSuite(r.suite, false);
    } else {
      activateSuite("straddle", false);
    }
  });

  function activateSuite(suiteKey, pushHistory = true) {
    if (suiteKey === "tools") suiteKey = "straddle";
    currentSuite = suiteKey;
    const straddleBtn = document.getElementById("p2SuiteStraddleBtn") || document.getElementById("p2SuiteToolsBtn");
    const fiiBtn = document.getElementById("p2SuiteFiiDiiBtn");
    const contribBtn = document.getElementById("p2SuiteContributionBtn");
    const straddleSection = document.getElementById("p2SectionStraddle") || document.getElementById("p2SectionTools");
    const fiiSection = document.getElementById("p2SectionFiiDii");
    const contribSection = document.getElementById("p2SectionBreadthContribution");

    if (straddleBtn) straddleBtn.classList.toggle("active", suiteKey === "straddle");
    if (fiiBtn) fiiBtn.classList.toggle("active", suiteKey === "fiidii");
    if (contribBtn) contribBtn.classList.toggle("active", suiteKey === "contribution");

    const activeLabel = document.getElementById("p2DeskActiveLabel");
    const activeIcon = document.getElementById("p2DeskActiveIcon");
    if (activeLabel && activeIcon) {
      if (suiteKey === "contribution") {
        activeLabel.textContent = "BREADTH & CONTRIBUTION DESK";
        activeIcon.textContent = "📈";
      } else if (suiteKey === "fiidii") {
        activeLabel.textContent = "FII / DII CASH FLOW";
        activeIcon.textContent = "🏛️";
      } else {
        activeLabel.textContent = "ATM STRADDLE DESK";
        activeIcon.textContent = "📉";
      }
    }

    if (straddleSection) straddleSection.style.display = suiteKey === "straddle" ? "block" : "none";
    if (fiiSection) fiiSection.style.display = suiteKey === "fiidii" ? "block" : "none";
    if (contribSection) contribSection.style.display = suiteKey === "contribution" ? "block" : "none";

    if (window.AuthService && window.AuthService.syncState) {
      window.AuthService.syncState({ page2Suite: suiteKey });
    }
    loadCurrentSuite();
    if (suiteKey === "contribution") {
      setupContribCanvasEvents();
      requestAnimationFrame(() => {
        if (contribTimeline && contribTimeline.length > 0) {
          renderIntradayBreadthChart(contribTimeline);
          renderIntradayIndexChart(contribTimeline, contribDataCache ? contribDataCache.indexInfo : null);
        }
      });
    }

    syncP2Url(suiteKey, pushHistory);
  }
  window.activateSuite = activateSuite;

  function setupSuiteSwitching() {
    const straddleBtn = document.getElementById("p2SuiteStraddleBtn") || document.getElementById("p2SuiteToolsBtn");
    const fiiBtn = document.getElementById("p2SuiteFiiDiiBtn");
    const contribBtn = document.getElementById("p2SuiteContributionBtn");

    if (straddleBtn) straddleBtn.addEventListener("click", () => activateSuite("straddle", true));
    if (fiiBtn) fiiBtn.addEventListener("click", (e) => {
      // Direct navigation to the main terminal FII DII Cash page
      e.preventDefault();
      window.location.href = "/fii-dii/cash";
    });
    if (contribBtn) contribBtn.addEventListener("click", () => activateSuite("contribution", true));
  }

  function setupGlobalControls() {
    const sel = document.getElementById("p2IndexSelect");
    const ref = document.getElementById("p2RefreshBtn");

    if (sel) {
      sel.addEventListener("change", (e) => {
        currentSymbol = e.target.value;
        if (window.AuthService && window.AuthService.syncState) {
          window.AuthService.syncState({ page2Index: currentSymbol });
        }
        refreshActiveView();
      });
    }

    if (ref) {
      ref.addEventListener("click", () => {
        refreshActiveView();
      });
    }
  }

  function refreshActiveView() {
    if (currentSuite === "straddle" || currentSuite === "tools") {
      loadStraddleTool();
    } else if (currentSuite === "fiidii") {
      loadFiiDiiSuite();
    } else if (currentSuite === "contribution") {
      loadBreadthContributionSuite(currentContribIndex, currentContribDate, true);
    }
  }

  function loadCurrentSuite() {
    if (currentSuite === "straddle" || currentSuite === "tools") {
      loadStraddleTool();
    } else if (currentSuite === "fiidii") {
      loadFiiDiiSuite();
    } else if (currentSuite === "contribution") {
      loadBreadthContributionSuite(currentContribIndex, currentContribDate, false);
    }
  }

  // Expose controller for workspace restoration ("Jaha Chora Wahi Se Chalu")
  window.Page2Controller = {
    restoreFromState(state) {
      if (!state) return;
      if (state.theme) {
        applyTheme(state.theme === "light");
      }
      if (state.page2Index) {
        currentSymbol = state.page2Index;
        const sel = document.getElementById("p2IndexSelect");
        if (sel) sel.value = currentSymbol;
      }
      if (state.page2Suite) {
        activateSuite(state.page2Suite);
      }
      refreshActiveView();
    }
  };

  // ========================================================================
  // 🧰 TOOLS SUITE: LIVE & HISTORICAL (BACK-DATE) STRADDLE ENGINE
  // ========================================================================
  const straddleState = {
    mode: "live", // "live" or "historical"
    date: "",     // "YYYY-MM-DD"
    category: "Equity",
    index: "NIFTY",
    expiry: "",
    strike: "atm",
    autoRefresh: true,
    data: null,
    timer: null,
    visible: {
      straddle: true,
      spot: true,
      synth: true,
      vwap: true
    },
    categoriesData: null,
    historyMeta: null,
    hoveredIndex: -1
  };

  function setupStraddleControls() {
    const liveBtn = document.getElementById("stModeLiveBtn");
    const histBtn = document.getElementById("stModeHistBtn");
    const dateGrp = document.getElementById("stDateGroup");
    const dateSel = document.getElementById("straddleDateSelect");
    const dateInp = document.getElementById("straddleDateInput");
    const liveToggleWrap = document.getElementById("straddleLiveToggleWrap");

    const catSel = document.getElementById("straddleCategorySelect");
    const idxSel = document.getElementById("straddleIndexSelect");
    const expSel = document.getElementById("straddleExpirySelect");
    const stkSel = document.getElementById("straddleStrikeSelect");
    const autoRef = document.getElementById("straddleAutoRefresh");
    const refBtn = document.getElementById("straddleRefreshBtn");
    const csvBtn = document.getElementById("stExportCsvBtn");

    // Load definitions
    fetchCategories();
    fetchHistoryMeta();

    // Mode switching: Live vs Historical Back-Date
    if (liveBtn && histBtn) {
      liveBtn.addEventListener("click", () => {
        straddleState.mode = "live";
        straddleState.date = "";
        liveBtn.classList.add("active");
        histBtn.classList.remove("active");
        if (dateGrp) dateGrp.style.display = "none";
        if (liveToggleWrap) liveToggleWrap.style.display = "inline-flex";
        populateExpiryOptions();
        loadStraddleTool();
      });

      histBtn.addEventListener("click", async () => {
        straddleState.mode = "historical";
        histBtn.classList.add("active");
        liveBtn.classList.remove("active");
        if (dateGrp) dateGrp.style.display = "flex";
        if (liveToggleWrap) liveToggleWrap.style.display = "none";
        stopStraddleTimer();
        if (!straddleState.historyMeta) {
          await fetchHistoryMeta();
        }
        populateHistoricalDates();
        loadStraddleTool();
      });
    }

    if (dateSel) {
      dateSel.addEventListener("change", (e) => {
        straddleState.date = e.target.value;
        if (dateInp) dateInp.value = straddleState.date;
        populateExpiryOptions();
        loadStraddleTool();
      });
    }

    if (dateInp) {
      dateInp.addEventListener("change", (e) => {
        straddleState.date = e.target.value;
        if (dateSel) dateSel.value = straddleState.date;
        populateExpiryOptions();
        loadStraddleTool();
      });
    }

    if (catSel) {
      catSel.addEventListener("change", (e) => {
        straddleState.category = e.target.value;
        straddleState.strike = "atm";
        populateIndexOptions();
        straddleState.index = idxSel ? idxSel.value : "NIFTY";
        if (straddleState.mode === "historical") {
          populateHistoricalDates();
        } else {
          populateExpiryOptions();
        }
        loadStraddleTool();
      });
    }

    if (idxSel) {
      idxSel.addEventListener("change", (e) => {
        straddleState.index = e.target.value;
        straddleState.strike = "atm";
        if (straddleState.mode === "historical") {
          populateHistoricalDates();
        } else {
          populateExpiryOptions();
        }
        loadStraddleTool();
      });
    }

    if (expSel) {
      expSel.addEventListener("change", (e) => {
        straddleState.expiry = e.target.value;
        loadStraddleTool();
      });
    }

    if (stkSel) {
      stkSel.addEventListener("change", (e) => {
        straddleState.strike = e.target.value;
        loadStraddleTool();
      });
    }

    if (autoRef) {
      autoRef.addEventListener("change", (e) => {
        straddleState.autoRefresh = e.target.checked;
        if (straddleState.autoRefresh && (currentSuite === "tools" || currentSuite === "straddle") && straddleState.mode === "live") {
          startStraddleTimer();
        } else {
          stopStraddleTimer();
        }
      });
    }

    if (refBtn) {
      refBtn.addEventListener("click", () => {
        loadStraddleTool();
      });
    }

    if (csvBtn) {
      csvBtn.addEventListener("click", downloadStraddleCsv);
    }

    // Series visibility toggles (Legend Buttons)
    const legBtns = document.querySelectorAll(".st-legend-btn");
    legBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const series = btn.getAttribute("data-series");
        if (!series || !straddleState.visible.hasOwnProperty(series)) return;
        straddleState.visible[series] = !straddleState.visible[series];
        if (straddleState.visible[series]) {
          btn.classList.add("active");
          btn.classList.remove("inactive");
        } else {
          btn.classList.remove("active");
          btn.classList.add("inactive");
        }
        if (straddleState.data) {
          renderStraddleChart(straddleState.data);
        }
      });
    });

    // Window resize handler for canvas
    window.addEventListener("resize", () => {
      if ((currentSuite === "tools" || currentSuite === "straddle") && straddleState.data) {
        renderStraddleChart(straddleState.data);
      }
    });

    // Setup Canvas Mouse Tracking
    setupStraddleCanvasInteractions();
  }

  async function fetchCategories() {
    try {
      const res = await fetch("/api/tools/straddle-categories");
      const data = await res.json();
      if (data && data.categories) {
        straddleState.categoriesData = data.categories;
        populateIndexOptions();
        if (straddleState.mode === "live") {
          populateExpiryOptions();
        }
      }
    } catch (err) {
      console.warn("Could not fetch categories:", err);
    }
  }

  async function fetchHistoryMeta() {
    try {
      const res = await fetch("/api/tools/straddle-history-meta");
      const data = await res.json();
      if (data) {
        straddleState.historyMeta = data;
      }
    } catch (err) {
      console.warn("Could not fetch history meta:", err);
    }
  }

  function populateHistoricalDates() {
    const dateSel = document.getElementById("straddleDateSelect");
    const dateInp = document.getElementById("straddleDateInput");
    if (!dateSel || !straddleState.historyMeta) return;

    const catKey = (straddleState.category || "Equity").toLowerCase();
    const catItems = straddleState.historyMeta[catKey] || [];
    const symObj = catItems.find(it => it.key === straddleState.index) || catItems[0];

    if (!symObj || !symObj.dates || symObj.dates.length === 0) {
      dateSel.innerHTML = `<option value="">No historical dates</option>`;
      return;
    }

    const dates = symObj.dates;
    // Show last 60 historical sessions in reverse order (newest first)
    const recent = dates.slice(-60).reverse();

    dateSel.innerHTML = recent.map((d, i) => {
      const dObj = new Date(d.value);
      const label = dObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" });
      const tag = i === 0 ? " (Previous Session)" : "";
      return `<option value="${d.value}">${label}${tag}</option>`;
    }).join("");

    straddleState.date = recent[0].value;
    if (dateInp) dateInp.value = straddleState.date;

    populateExpiryOptions();
  }

  function populateIndexOptions() {
    const idxSel = document.getElementById("straddleIndexSelect");
    if (!idxSel || !straddleState.categoriesData) return;

    const catObj = straddleState.categoriesData.find(c => c.name === straddleState.category) || straddleState.categoriesData[0];
    if (!catObj || !catObj.indices) return;

    idxSel.innerHTML = catObj.indices.map(idx => `<option value="${idx.key}">${idx.name}</option>`).join("");
    straddleState.index = idxSel.value || "NIFTY";
  }

  function populateStrikeOptions(strikes, selectedStrike, atmStrike) {
    const stkSel = document.getElementById("straddleStrikeSelect");
    if (!stkSel) return;
    const curVal = straddleState.strike || stkSel.value || "atm";
    let html = `<option value="atm" ${curVal === "atm" ? "selected" : ""}>ATM (${Number(atmStrike || 0).toLocaleString("en-IN")})</option>`;
    if (Array.isArray(strikes)) {
      strikes.forEach(stk => {
        const isSel = (curVal !== "atm" && (curVal === String(stk) || selectedStrike === stk));
        const diff = stk - (atmStrike || stk);
        const tag = diff === 0 ? "ATM" : (diff > 0 ? `+${diff}` : `${diff}`);
        html += `<option value="${stk}" ${isSel ? "selected" : ""}>Strike ${Number(stk).toLocaleString("en-IN")} (${tag})</option>`;
      });
    }
    stkSel.innerHTML = html;
  }

  function populateExpiryOptions() {
    const expSel = document.getElementById("straddleExpirySelect");
    if (!expSel) return;

    // 1. Historical mode expiry resolution
    if (straddleState.mode === "historical" && straddleState.date && straddleState.historyMeta) {
      const catKey = (straddleState.category || "Equity").toLowerCase();
      const catItems = straddleState.historyMeta[catKey] || [];
      const symObj = catItems.find(it => it.key === straddleState.index);
      if (symObj && symObj.dates) {
        const dObj = symObj.dates.find(d => d.value === straddleState.date);
        if (dObj && dObj.expiries && dObj.expiries.length > 0) {
          expSel.innerHTML = dObj.expiries.map((exp, idx) => `
            <option value="${exp.value}">${idx === 0 ? 'Weekly Expiry (' + exp.value + ')' : 'Far Expiry (' + exp.value + ')'}</option>
          `).join("");
          straddleState.expiry = expSel.value;
          return;
        }
      }
    }

    // 2. Live mode expiry resolution
    if (!straddleState.categoriesData) return;
    const catObj = straddleState.categoriesData.find(c => c.name === straddleState.category) || straddleState.categoriesData[0];
    const idxObj = catObj ? catObj.indices.find(i => i.key === straddleState.index) : null;

    if (!idxObj) {
      expSel.innerHTML = `<option value="">Immediate Expiry</option>`;
      straddleState.expiry = "";
      return;
    }

    if (idxObj.expiry_details && idxObj.expiry_details.length > 0) {
      expSel.innerHTML = idxObj.expiry_details.map((exp, idx) => `
        <option value="${exp.value}" ${idx === 0 ? "selected" : ""}>${exp.label}</option>
      `).join("");
      straddleState.expiry = expSel.value;
      return;
    }

    if (idxObj.expiries && idxObj.expiries.length > 0) {
      expSel.innerHTML = idxObj.expiries.map((exp, idx) => `
        <option value="${exp}" ${idx === 0 ? "selected" : ""}>${exp}</option>
      `).join("");
      straddleState.expiry = expSel.value;
      return;
    }

    expSel.innerHTML = `<option value="">Immediate Expiry</option>`;
    straddleState.expiry = "";
  }

  function startStraddleTimer() {
    stopStraddleTimer();
    if (straddleState.mode !== "live") return;
    straddleState.timer = setInterval(() => {
      if ((currentSuite === "tools" || currentSuite === "straddle") && straddleState.autoRefresh && straddleState.mode === "live") {
        loadStraddleTool(true); // silent refresh
      }
    }, 5000);
  }

  function stopStraddleTimer() {
    if (straddleState.timer) {
      clearInterval(straddleState.timer);
      straddleState.timer = null;
    }
  }

  async function loadStraddleTool(isSilent = false) {
    const refBtn = document.getElementById("straddleRefreshBtn");
    if (refBtn && !isSilent) {
      refBtn.textContent = "⏳ Fetching...";
      refBtn.disabled = true;
    }

    try {
      const q = new URLSearchParams({
        index: straddleState.index || "NIFTY",
        category: straddleState.category || "Equity",
        expiry: straddleState.expiry || "",
        strike: straddleState.strike || "atm",
        date: straddleState.mode === "historical" ? (straddleState.date || "") : ""
      });

      const res = await fetch(`/api/tools/straddle-chart?${q.toString()}`);
      const data = await res.json();

      if (!data || !data.ok) {
        straddleState.data = null;
        renderStraddleChart({ points: [] });
        const heading = document.getElementById("straddleChartHeading");
        if (heading) heading.textContent = "Live straddle data unavailable";
        const subtitle = document.querySelector(".straddle-chart-title-left .p2-card-subtitle");
        if (subtitle) subtitle.textContent = data?.message || "Verified Nifty candles or option quotes are currently unavailable. No estimated chart is displayed.";
        console.error("Straddle fetch failed:", data);
        return;
      }

      straddleState.data = data;

      // Synchronize active expiry dropdown if available
      if (data.available_expiries && data.available_expiries.length > 0 && straddleState.mode === "live") {
        const expSel = document.getElementById("straddleExpirySelect");
        if (expSel && (expSel.options.length <= 1 || !straddleState.expiry)) {
          expSel.innerHTML = data.available_expiries.map(exp => `
            <option value="${exp.value}" ${exp.value === data.expiry ? "selected" : ""}>${exp.label}</option>
          `).join("");
          straddleState.expiry = expSel.value;
        }
      }

      // Populate dynamic strike selector around ATM
      if (data.available_strikes && data.available_strikes.length > 0) {
        populateStrikeOptions(data.available_strikes, data.selected_strike, data.atm_strike);
      }

      // 1. Update Metrics Strip
      const lat = data.latest || {};
      const elPrice = document.getElementById("stPriceVal");
      const elDecay = document.getElementById("stDecaySub");
      const elSpotLbl = document.getElementById("stSpotLbl");
      const elSpot = document.getElementById("stSpotVal");
      const elSynth = document.getElementById("stSynthVal");
      const elStrike = document.getElementById("stStrikeVal");
      const elCe = document.getElementById("stCeVal");
      const elPe = document.getElementById("stPeVal");
      const elVwap = document.getElementById("stVwapVal");
      const elDte = document.getElementById("stDteVal");
      const elTime = document.getElementById("stTimeVal");
      const elHeading = document.getElementById("straddleChartHeading");

      const elLower = document.getElementById("stLowerBe");
      const elCenter = document.getElementById("stCenterSpot");
      const elUpper = document.getElementById("stUpperBe");
      const elRange = document.getElementById("stRangeSpread");

      if (elPrice) elPrice.textContent = "₹" + Number(lat.straddle_price || 0).toFixed(2);
      if (elDecay) {
        const dPts = Number(lat.decay_pts || 0);
        const dPct = Number(lat.decay_pct || 0);
        if (dPts >= 0) {
          elDecay.textContent = `Decay: -₹${dPts.toFixed(2)} (-${Math.abs(dPct).toFixed(2)}%)`;
          elDecay.style.color = "#10b981"; // Theta decay (Seller advantage)
        } else {
          elDecay.textContent = `Expansion: +₹${Math.abs(dPts).toFixed(2)} (+${Math.abs(dPct).toFixed(2)}%)`;
          elDecay.style.color = "#f43f5e"; // IV spike
        }
      }
      if (elSpotLbl) elSpotLbl.textContent = `${data.symbol} Spot`;
      if (elSpot) elSpot.textContent = "₹" + Number(lat.spot || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      if (elSynth) elSynth.textContent = "₹" + Number(lat.synthetic_future || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      
      const activeStrikeVal = lat.straddle_strike || data.selected_strike || data.atm_strike || 0;
      if (elStrike) elStrike.textContent = Number(activeStrikeVal).toLocaleString("en-IN");
      if (elCe) elCe.textContent = "₹" + Number(lat.ce_price || 0).toFixed(2);
      if (elPe) elPe.textContent = "₹" + Number(lat.pe_price || 0).toFixed(2);
      if (elVwap) elVwap.textContent = "₹" + Number(lat.vwap || 0).toFixed(2);
      if (elDte) {
        elDte.textContent = data.dte === 0 ? "Expires Today (0 DTE)" : (data.dte === 1 ? "Tomorrow (1 DTE)" : `${data.dte} Days`);
      }
      if (elTime) elTime.textContent = formatIstTime(lat.time);

      if (elHeading) {
        const stkStr = activeStrikeVal ? `Strike ${Number(activeStrikeVal).toLocaleString("en-IN")}` : "ATM";
        if (data.is_historical) {
          elHeading.textContent = `📅 [HISTORICAL: ${data.date}] ${data.symbol} ${stkStr} Straddle Trajectory`;
        } else {
          elHeading.textContent = `${data.symbol} ${stkStr} Straddle Live Trajectory`;
        }
      }

      // Sync navbar real-time straddle badge
      const navBadge = document.getElementById("navStraddleValueBadge");
      if (navBadge && lat.straddle_price) {
        navBadge.textContent = "₹" + Number(lat.straddle_price).toFixed(2);
      }

      const elSub = document.querySelector(".straddle-chart-title-left .p2-card-subtitle");
      if (elSub) {
        elSub.textContent = data.is_historical
          ? `Historical session archive for ${data.date} (Expiry: ${data.expiry}) with tick-by-tick VWAP & Synthetic Future`
          : "Intraday 1-minute trajectory comparing combined premium erosion against spot momentum";
      }

      if (elLower) elLower.textContent = "₹" + Number(lat.lower_breakeven || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      if (elCenter) elCenter.textContent = "₹" + Number(lat.spot || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      if (elUpper) elUpper.textContent = "₹" + Number(lat.upper_breakeven || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      if (elRange) {
        const spreadPct = lat.spot > 0 ? (lat.straddle_price / lat.spot * 100).toFixed(2) : "0.00";
        elRange.textContent = `±₹${Number(lat.straddle_price || 0).toFixed(2)} (±${spreadPct}%)`;
      }

      // 2. Render Full Canvas Chart
      renderStraddleChart(data);

      // 3. Render Historical Snapshots Table
      renderStraddleTable(data.points || []);

      // Start timer if auto-refresh is on
      if (straddleState.autoRefresh) {
        startStraddleTimer();
      }

    } catch (err) {
      straddleState.data = null;
      renderStraddleChart({ points: [] });
      const heading = document.getElementById("straddleChartHeading");
      if (heading) heading.textContent = "Live straddle data unavailable";
      console.error("Error loading straddle tool:", err);
    } finally {
      if (refBtn && !isSilent) {
        refBtn.textContent = "🔄 Fetch";
        refBtn.disabled = false;
      }
    }
  }

  function formatIstTime(isoStr) {
    if (!isoStr) return "--";
    try {
      if (typeof isoStr === "string" && isoStr.length <= 5 && isoStr.includes(":")) {
        return isoStr;
      }
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
    } catch {
      return isoStr;
    }
  }

  function formatIstFull(isoStr) {
    if (!isoStr) return "--";
    try {
      if (typeof isoStr === "string" && isoStr.length <= 5 && isoStr.includes(":")) {
        return isoStr;
      }
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata"
      });
    } catch {
      return isoStr;
    }
  }

  // ========================================================================
  // STRADDLE DUAL-AXIS CANVAS RENDERER (FINANCEDEFT-MATCHED MULTI-AXIS)
  // ========================================================================
  function renderStraddleChart(data) {
    const canvas = document.getElementById("chartLiveStraddle");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const container = canvas.parentElement;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 450;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.scale(dpr, dpr);

    const theme = getThemeColors();
    const isLight = document.body.classList.contains("theme-light");

    // Colors
    const colStraddle = "#06b6d4"; // Cyan
    const colSpot = "#10b981";     // Emerald Green
    const colSynth = "#a855f7";    // Purple
    const colVwap = "#f59e0b";     // Amber Gold

    // Margins / Padding
    const padding = { top: 35, right: 80, bottom: 45, left: 70 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Background fill
    ctx.fillStyle = isLight ? "#f8fafc" : "#0d1322";
    ctx.fillRect(0, 0, width, height);

    const points = data.points || [];
    const n = points.length;
    if (n === 0) {
      ctx.fillStyle = theme.text;
      ctx.font = "14px Inter";
      ctx.textAlign = "center";
      ctx.fillText("No straddle tick data available", width / 2, height / 2);
      return;
    }

    // 1. Compute Left Y-Axis Range (Straddle Price & VWAP)
    let leftVals = [];
    points.forEach(p => {
      if (straddleState.visible.straddle) leftVals.push(p.price);
      if (straddleState.visible.vwap) leftVals.push(p.vwap);
    });
    if (leftVals.length === 0) leftVals = [100, 200];
    let minLeft = Math.min(...leftVals);
    let maxLeft = Math.max(...leftVals);
    const leftPad = (maxLeft - minLeft) * 0.08 || 5;
    minLeft = Math.floor(minLeft - leftPad);
    maxLeft = Math.ceil(maxLeft + leftPad);

    // 2. Compute Right Y-Axis Range (Index Spot & Synthetic Future)
    let rightVals = [];
    points.forEach(p => {
      if (straddleState.visible.spot && p.spot != null && !isNaN(p.spot) && p.spot > 0) rightVals.push(p.spot);
      if (straddleState.visible.synth && p.synthetic_future != null && !isNaN(p.synthetic_future) && p.synthetic_future > 0) rightVals.push(p.synthetic_future);
    });
    if (rightVals.length === 0) rightVals = [23000, 23500];
    let minRight = Math.min(...rightVals);
    let maxRight = Math.max(...rightVals);
    if (maxRight <= minRight) {
      minRight -= 50;
      maxRight += 50;
    }
    const rightPad = Math.max(20, (maxRight - minRight) * 0.08);
    minRight = Math.floor(minRight - rightPad);
    maxRight = Math.ceil(maxRight + rightPad);

    // 3. Gridlines & Y-Axes Labels
    ctx.strokeStyle = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    const gridSteps = 5;

    for (let i = 0; i <= gridSteps; i++) {
      const y = padding.top + (chartH / gridSteps) * i;

      // Horizontal gridline
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Left Y-Axis Label (Straddle Price)
      const lVal = maxLeft - ((maxLeft - minLeft) / gridSteps) * i;
      ctx.fillStyle = colStraddle;
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText("₹" + lVal.toFixed(1), padding.left - 10, y + 4);

      // Right Y-Axis Label (Spot / Future)
      const rVal = maxRight - ((maxRight - minRight) / gridSteps) * i;
      ctx.fillStyle = colSpot;
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(Math.round(rVal).toLocaleString("en-IN"), width - padding.right + 10, y + 4);
    }

    // Watermark in Center
    ctx.save();
    ctx.fillStyle = isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)";
    ctx.font = "800 36px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.is_historical ? `${data.symbol} ${data.date} (HISTORICAL)` : `${data.symbol} STRADDLE DESK`, width / 2, height / 2);
    ctx.restore();

    // Helper coordinate converters
    const getX = (idx) => padding.left + (chartW / (n - 1 || 1)) * idx;
    const getLeftY = (val) => padding.top + chartH - ((val - minLeft) / (maxLeft - minLeft || 1)) * chartH;
    const getRightY = (val) => padding.top + chartH - ((val - minRight) / (maxRight - minRight || 1)) * chartH;

    // 4. Render Curves

    // Curve A: Synthetic Future (Dashed Purple)
    if (straddleState.visible.synth) {
      ctx.strokeStyle = colSynth;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = getX(i);
        const y = getRightY(points[i].synthetic_future);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Curve B: Straddle VWAP (Gold Line)
    if (straddleState.visible.vwap) {
      ctx.strokeStyle = colVwap;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = getX(i);
        const y = getLeftY(points[i].vwap);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Curve C: Index Spot (Emerald Green Line)
    if (straddleState.visible.spot) {
      ctx.strokeStyle = colSpot;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = getX(i);
        const y = getRightY(points[i].spot);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Curve D: Straddle Price (Cyan Line with subtle gradient glow)
    if (straddleState.visible.straddle) {
      // Area gradient
      const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      grad.addColorStop(0, "rgba(6, 182, 212, 0.15)");
      grad.addColorStop(1, "rgba(6, 182, 212, 0.0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(getX(0), padding.top + chartH);
      for (let i = 0; i < n; i++) {
        ctx.lineTo(getX(i), getLeftY(points[i].price));
      }
      ctx.lineTo(getX(n - 1), padding.top + chartH);
      ctx.closePath();
      ctx.fill();

      // Stroke
      ctx.strokeStyle = colStraddle;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = getX(i);
        const y = getLeftY(points[i].price);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 5. X-Axis Time Labels
    ctx.fillStyle = isLight ? "#64748b" : "#94a3b8";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    const xStep = Math.max(1, Math.floor(n / 7));
    let lastDrawnX = -999;

    for (let i = 0; i < n; i += xStep) {
      const x = getX(i);
      const isNearEnd = n > 1 && (getX(n - 1) - x < 60);
      if (isNearEnd) continue;
      if (x - lastDrawnX >= 55) {
        const timeStr = formatIstTime(points[i].time);
        ctx.fillText(timeStr, x, height - 15);
        lastDrawnX = x;
      }
    }
    // Always print final timestamp cleanly without overlap
    if (n > 1) {
      const xLast = getX(n - 1);
      if (xLast - lastDrawnX >= 45) {
        ctx.fillText(formatIstTime(points[n - 1].time), xLast, height - 15);
      }
    }

    // 6. Crosshair Rendering (when hovered)
    if (straddleState.hoveredIndex >= 0 && straddleState.hoveredIndex < n) {
      const hi = straddleState.hoveredIndex;
      const hx = getX(hi);
      const hp = points[hi];

      // Vertical crosshair line
      ctx.strokeStyle = isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, padding.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight dots
      if (straddleState.visible.straddle) {
        drawDot(ctx, hx, getLeftY(hp.price), colStraddle);
      }
      if (straddleState.visible.spot) {
        drawDot(ctx, hx, getRightY(hp.spot), colSpot);
      }
      if (straddleState.visible.synth) {
        drawDot(ctx, hx, getRightY(hp.synthetic_future), colSynth);
      }
      if (straddleState.visible.vwap) {
        drawDot(ctx, hx, getLeftY(hp.vwap), colVwap);
      }
    }
  }

  function drawDot(ctx, x, y, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function setupStraddleCanvasInteractions() {
    const canvas = document.getElementById("chartLiveStraddle");
    const tooltip = document.getElementById("straddleTooltip");
    if (!canvas || !tooltip) return;

    function handleMove(e) {
      if (!straddleState.data || !straddleState.data.points || straddleState.data.points.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      const padding = { top: 35, right: 80, bottom: 45, left: 70 };
      const chartW = rect.width - padding.left - padding.right;

      if (mouseX < padding.left || mouseX > rect.width - padding.right) {
        hideTooltip();
        return;
      }

      const points = straddleState.data.points;
      const n = points.length;
      const relX = (mouseX - padding.left) / chartW;
      const index = Math.round(relX * (n - 1));
      const clampedIndex = Math.max(0, Math.min(n - 1, index));

      straddleState.hoveredIndex = clampedIndex;
      renderStraddleChart(straddleState.data);

      // Tooltip HTML content
      const p = points[clampedIndex];
      const openP = points[0].price || p.price;
      const decayPts = openP - p.price;
      const decayPct = openP > 0 ? (decayPts / openP * 100).toFixed(2) : "0.00";

      tooltip.innerHTML = `
        <div style="font-weight:800; font-size:12px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
          ⏱️ ${formatIstFull(p.time)}
        </div>
        <div style="display:grid; grid-template-columns:auto auto; gap:4px 12px; font-size:11px;">
          <span style="color:#06b6d4; font-weight:700;">Straddle Price:</span>
          <strong style="text-align:right;">₹${p.price.toFixed(2)}</strong>

          <span style="color:#10b981; font-weight:700;">Index Spot:</span>
          <strong style="text-align:right;">₹${Number(p.spot).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong>

          <span style="color:#a855f7; font-weight:700;">Synthetic Future:</span>
          <strong style="text-align:right;">₹${Number(p.synthetic_future).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong>

          <span style="color:#f59e0b; font-weight:700;">VWAP:</span>
          <strong style="text-align:right;">₹${p.vwap.toFixed(2)}</strong>

          <span style="color:var(--p2-text-muted);">Strike:</span>
          <strong style="text-align:right;">${p.straddle_strike}</strong>

          <span style="color:var(--p2-text-muted);">CE / PE:</span>
          <span style="text-align:right;">₹${p.ce_price.toFixed(2)} / ₹${p.pe_price.toFixed(2)}</span>

          <span style="color:var(--p2-text-muted);">Decay from Open:</span>
          <strong style="text-align:right; color:${decayPts >= 0 ? '#10b981' : '#f43f5e'}">
            ₹${Math.abs(decayPts).toFixed(2)} (${decayPts >= 0 ? '-' : '+'}${Math.abs(decayPct)}%)
          </strong>
        </div>
      `;

      tooltip.style.display = "block";
      const tooltipW = 210;
      let tipLeft = mouseX + 16;
      if (tipLeft + tooltipW > rect.width) {
        tipLeft = mouseX - tooltipW - 16;
      }
      tooltip.style.left = Math.max(10, tipLeft) + "px";
      tooltip.style.top = Math.max(10, mouseY - 40) + "px";
    }

    function hideTooltip() {
      straddleState.hoveredIndex = -1;
      tooltip.style.display = "none";
      if (straddleState.data) {
        renderStraddleChart(straddleState.data);
      }
    }

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", hideTooltip);
    canvas.addEventListener("touchstart", handleMove, { passive: true });
    canvas.addEventListener("touchmove", handleMove, { passive: true });
    canvas.addEventListener("touchend", hideTooltip);
  }

  // ========================================================================
  // INTRADAY SNAPSHOTS TABLE
  // ========================================================================
  function renderStraddleTable(points) {
    const tbody = document.querySelector("#tableStraddleHistory tbody");
    if (!tbody) return;

    if (!points || points.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">No intraday history records found.</td></tr>`;
      return;
    }

    const openPrice = points[0].price || 1;
    // Sample every 4th or 5th point to keep table sleek (~40-60 rows) while keeping latest points
    const step = Math.max(1, Math.floor(points.length / 50));
    const sampled = [];
    for (let i = points.length - 1; i >= 0; i -= step) {
      sampled.push(points[i]);
    }
    if (sampled[sampled.length - 1] !== points[0]) {
      sampled.push(points[0]);
    }

    tbody.innerHTML = sampled.map(p => {
      const decayPts = openPrice - p.price;
      const decayPct = (decayPts / openPrice * 100).toFixed(2);
      const isBleeding = decayPts > 0;
      const signal = isBleeding
        ? `<span class="p2-badge p2-badge-green">Theta Decay</span>`
        : `<span class="p2-badge p2-badge-red">IV Expansion</span>`;

      return `
        <tr>
          <td class="font-bold">${formatIstFull(p.time)}</td>
          <td class="text-right font-bold text-cyan">₹${p.price.toFixed(2)}</td>
          <td class="text-right text-green">₹${Number(p.spot).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
          <td class="text-right text-purple">₹${Number(p.synthetic_future).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
          <td class="text-right text-gold">₹${p.vwap.toFixed(2)}</td>
          <td class="text-right text-call">₹${p.ce_price.toFixed(2)}</td>
          <td class="text-right text-put">₹${p.pe_price.toFixed(2)}</td>
          <td class="text-right font-bold" style="color:${isBleeding ? '#10b981' : '#f43f5e'}">
            ${isBleeding ? '-' : '+'}₹${Math.abs(decayPts).toFixed(2)} (${decayPct}%)
          </td>
          <td class="text-center">${signal}</td>
        </tr>
      `;
    }).join("");
  }

  function downloadStraddleCsv() {
    if (!straddleState.data || !straddleState.data.points) {
      alert("No straddle data available to export.");
      return;
    }
    const points = straddleState.data.points;
    const openPrice = points[0].price || 1;

    let csv = "Time (UTC),Time (IST),Straddle Price,Spot,Synthetic Future,VWAP,Strike,CE LTP,PE LTP,Volume,Decay Pts\n";
    points.forEach(p => {
      const decayPts = (openPrice - p.price).toFixed(2);
      const ist = formatIstFull(p.time).replace(",", "");
      csv += `${p.time},${ist},${p.price},${p.spot},${p.synthetic_future},${p.vwap},${p.straddle_strike},${p.ce_price},${p.pe_price},${p.volume},${decayPts}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${straddleState.index}_Straddle_${straddleState.date || 'Live'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ========================================================================
  // 🏛️ SECTION 4: FII / DII INSTITUTIONAL DESK CONTROLLER
  // ========================================================================
  let fiiDiiData = null;
  let currentFiiPeriod = "daily"; // "daily" | "monthly" | "yearly"
  let currentFiiView = "net";     // "net" | "fii" | "dii"
  let currentFiiRange = "30";     // "15" | "30" | "60" | "all"
  let fiiHoveredIndex = -1;
  let fiiCrosshairPos = null;     // { x, y }
  let fiiChartRows = [];

  function setupFiiDiiControls() {
    // Period buttons (Daily / Monthly / Yearly)
    const periodBtns = document.querySelectorAll(".fii-period-btn");
    periodBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        periodBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFiiPeriod = btn.getAttribute("data-period");
        renderFiiDiiView();
      });
    });

    // View buttons (Net / FII / DII)
    const viewBtns = document.querySelectorAll(".fii-view-btn");
    viewBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        viewBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFiiView = btn.getAttribute("data-view");
        renderFiiDiiView();
      });
    });

    // Range select
    const rangeSel = document.getElementById("fiiRangeSelect");
    if (rangeSel) {
      rangeSel.addEventListener("change", (e) => {
        currentFiiRange = e.target.value;
        renderFiiDiiView();
      });
    }

    // Search filter in table
    const searchInput = document.getElementById("fiiTableSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        filterFiiTable(query);
      });
    }

    // CSV Export
    const exportBtn = document.getElementById("fiiExportCsvBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", exportFiiCsv);
    }

    // Refresh Button click
    const refreshBtn = document.getElementById("fiiRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        loadFiiDiiSuite(true);
      });
    }

    // Attach canvas crosshair mouse events
    const canvas = document.getElementById("chartFiiDiiCanvas");
    if (canvas) {
      canvas.addEventListener("mousemove", handleFiiCanvasMouseMove);
      canvas.addEventListener("mouseleave", handleFiiCanvasMouseLeave);
      window.addEventListener("resize", () => {
        if (currentSuite === "fiidii") renderFiiDiiChart();
      });
    }
  }

  let fiiAutoSyncInterval = null;

  async function loadFiiDiiSuite(isForce = false) {
    const refreshBtn = document.getElementById("fiiRefreshBtn");
    const refreshText = document.getElementById("fiiRefreshText");
    const refreshIcon = document.getElementById("fiiRefreshIcon");

    if (isForce && refreshBtn) {
      refreshBtn.disabled = true;
      if (refreshText) refreshText.textContent = "Syncing...";
      if (refreshIcon) refreshIcon.textContent = "⏳";
    }

    try {
      const url = isForce ? "/api/fii-dii-cash?refresh=true" : "/api/fii-dii-cash";
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        fiiDiiData = json;
        const updatedBadge = document.getElementById("fiiLastUpdatedBadge");
        if (updatedBadge) {
          updatedBadge.textContent = json.lastUpdated ? `Updated: ${json.lastUpdated}` : "Updated: Just now";
        }
        renderFiiDiiView();
      }
    } catch (err) {
      console.error("Error loading FII/DII data:", err);
    } finally {
      if (isForce && refreshBtn) {
        setTimeout(() => {
          refreshBtn.disabled = false;
          if (refreshText) refreshText.textContent = "Refresh FII/DII";
          if (refreshIcon) refreshIcon.textContent = "🔄";
        }, 600);
      }
    }

    // Setup periodic 10-minute auto-sync timer while on this tab
    if (!fiiAutoSyncInterval) {
      fiiAutoSyncInterval = setInterval(() => {
        if (currentSuite === "fiidii") {
          loadFiiDiiSuite(false);
        }
      }, 10 * 60 * 1000);
    }
  }

  function getFiiActiveDataset() {
    if (!fiiDiiData) return [];
    let list = [];
    if (currentFiiPeriod === "daily") list = fiiDiiData.daily || [];
    else if (currentFiiPeriod === "monthly") list = fiiDiiData.monthly || [];
    else list = fiiDiiData.yearly || [];

    if (currentFiiRange !== "all") {
      const limit = parseInt(currentFiiRange, 10);
      if (!isNaN(limit)) list = list.slice(0, limit);
    }
    return list;
  }

  function renderFiiDiiView() {
    const list = getFiiActiveDataset();
    fiiChartRows = list;
    updateFiiMetricCards(list);
    renderFiiDiiChart();
    renderFiiDiiTable(list);
  }

  function updateFiiMetricCards(list) {
    if (!list || list.length === 0) return;
    const latest = list[0];
    const totalNet = Number(latest.totalNet || 0);
    const fiiNet = Number(latest.fiiNet || 0);
    const diiNet = Number(latest.diiNet || 0);

    const valTotEl = document.getElementById("fiiValTotal");
    if (valTotEl) {
      valTotEl.textContent = (totalNet > 0 ? "+₹" : "-₹") + Math.abs(totalNet).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
      valTotEl.className = "metric-value " + (totalNet >= 0 ? "text-green" : "text-red");
    }
    const badgeTot = document.getElementById("fiiBadgeTotal");
    if (badgeTot) {
      badgeTot.textContent = totalNet >= 0 ? "BULLISH INFLOW" : "BEARISH OUTFLOW";
      badgeTot.className = "p2-badge " + (totalNet >= 0 ? "p2-badge-green" : "p2-badge-red");
    }

    const valFiiEl = document.getElementById("fiiValFii");
    if (valFiiEl) {
      valFiiEl.textContent = (fiiNet > 0 ? "+₹" : "-₹") + Math.abs(fiiNet).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
      valFiiEl.className = "metric-value " + (fiiNet >= 0 ? "text-green" : "text-red");
    }
    const buyFii = document.getElementById("fiiBuyVal");
    const sellFii = document.getElementById("fiiSellVal");
    if (buyFii) buyFii.textContent = "₹" + Number(latest.fiiBuy || 0).toLocaleString("en-IN");
    if (sellFii) sellFii.textContent = "₹" + Number(latest.fiiSell || 0).toLocaleString("en-IN");

    const valDiiEl = document.getElementById("fiiValDii");
    if (valDiiEl) {
      valDiiEl.textContent = (diiNet > 0 ? "+₹" : "-₹") + Math.abs(diiNet).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
      valDiiEl.className = "metric-value " + (diiNet >= 0 ? "text-green" : "text-red");
    }
    const buyDii = document.getElementById("diiBuyVal");
    const sellDii = document.getElementById("diiSellVal");
    if (buyDii) buyDii.textContent = "₹" + Number(latest.diiBuy || 0).toLocaleString("en-IN");
    if (sellDii) sellDii.textContent = "₹" + Number(latest.diiSell || 0).toLocaleString("en-IN");

    const valNifty = document.getElementById("fiiValNifty");
    const subNifty = document.getElementById("fiiSubNifty");
    const badgeNifty = document.getElementById("fiiBadgeNifty");
    if (valNifty && latest.niftyClose) valNifty.textContent = Number(latest.niftyClose).toLocaleString("en-IN", { minimumFractionDigits: 2 });
    if (subNifty && latest.niftyChange !== undefined) {
      subNifty.textContent = (latest.niftyChange > 0 ? "+" : "") + latest.niftyChange.toFixed(2) + " pts";
      subNifty.className = "metric-sub " + (latest.niftyChange >= 0 ? "text-green" : "text-red");
    }
    if (badgeNifty && latest.niftyPct !== undefined) {
      badgeNifty.textContent = (latest.niftyPct > 0 ? "+" : "") + latest.niftyPct.toFixed(2) + "%";
      badgeNifty.className = "p2-badge " + (latest.niftyPct >= 0 ? "p2-badge-green" : "p2-badge-red");
    }
  }

  function renderFiiDiiChart() {
    const canvas = document.getElementById("chartFiiDiiCanvas");
    if (!canvas || !fiiChartRows || fiiChartRows.length === 0) return;

    const container = document.getElementById("fiiChartContainer");
    const containerWidth = container.clientWidth || 900;
    const isLightMode = isLight();
    const colors = getThemeColors();

    const labelWidth = 100;
    const paddingRight = 90;
    const paddingTop = 45;
    const paddingBottom = 40;
    const rowHeight = 28;
    const barHeight = 16;
    const totalHeight = paddingTop + fiiChartRows.length * rowHeight + paddingBottom;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = containerWidth + "px";
    canvas.style.height = totalHeight + "px";

    const ctx = canvas.getContext("2d");
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // Dynamic Title update
    const periodLabel = currentFiiPeriod.toUpperCase();
    const viewLabel = currentFiiView === "net" ? "FII / FPI & DII Net" : (currentFiiView === "fii" ? "FII / FPI Net Flow" : "DII Domestic Net Flow");
    const titleEl = document.getElementById("fiiChartTitle");
    if (titleEl) titleEl.textContent = `${viewLabel} (in Crores.) - ${periodLabel}`;

    // Compute min and max values
    let valMin = 0;
    let valMax = 0;
    fiiChartRows.forEach(row => {
      let val = 0;
      if (currentFiiView === "net") val = Number(row.totalNet || 0);
      else if (currentFiiView === "fii") val = Number(row.fiiNet || 0);
      else val = Number(row.diiNet || 0);

      if (val < valMin) valMin = val;
      if (val > valMax) valMax = val;
    });

    const absMax = Math.max(Math.abs(valMin), Math.abs(valMax), 1000);
    const magnitude = Math.pow(10, Math.floor(Math.log10(absMax)));
    const ceilMax = Math.ceil(absMax / (magnitude / 2)) * (magnitude / 2);
    const xMin = -ceilMax;
    const xMax = ceilMax;
    const chartWidth = containerWidth - labelWidth - paddingRight;

    function xValToPx(v) {
      return labelWidth + ((v - xMin) / (xMax - xMin)) * chartWidth;
    }

    const zeroX = xValToPx(0);

    // Draw Vertical Grid Lines & X-Axis labels
    const stepCount = 8;
    const stepVal = (xMax - xMin) / stepCount;
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i <= stepCount; i++) {
      const v = xMin + i * stepVal;
      const gx = xValToPx(v);

      ctx.beginPath();
      ctx.strokeStyle = v === 0 ? (isLightMode ? "#0f172a" : "#ffffff") : colors.grid;
      ctx.lineWidth = v === 0 ? 1.5 : 1;
      if (v !== 0) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.moveTo(gx, paddingTop - 10);
      ctx.lineTo(gx, totalHeight - paddingBottom + 5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label at bottom
      ctx.fillStyle = v === 0 ? colors.textBright : colors.text;
      const fmtVal = Math.abs(v) >= 1000 ? (v / 1).toFixed(0) : v.toFixed(0);
      ctx.fillText(fmtVal, gx, totalHeight - paddingBottom + 8);
    }

    // Top X-axis label header
    ctx.fillStyle = colors.text;
    ctx.textAlign = "right";
    ctx.fillText("₹ in Crores ➔", containerWidth - paddingRight, 15);

    // Draw Bars for each row
    fiiChartRows.forEach((row, i) => {
      const yCenter = paddingTop + i * rowHeight + rowHeight / 2;
      const barTop = yCenter - barHeight / 2;
      const isHovered = (i === fiiHoveredIndex);

      let val = 0;
      if (currentFiiView === "net") val = Number(row.totalNet || 0);
      else if (currentFiiView === "fii") val = Number(row.fiiNet || 0);
      else val = Number(row.diiNet || 0);

      const targetX = xValToPx(val);
      const isPositive = val >= 0;

      // Draw Row Highlight if Hovered
      if (isHovered) {
        ctx.fillStyle = isLightMode ? "rgba(2, 132, 199, 0.08)" : "rgba(0, 229, 255, 0.08)";
        ctx.fillRect(0, paddingTop + i * rowHeight, containerWidth, rowHeight);
      }

      // Draw Date Label on Left
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = isHovered ? "bold 12px Inter, sans-serif" : "11px Inter, sans-serif";
      ctx.fillStyle = isHovered ? colors.teal : colors.text;
      const dateText = row.period || row.date || "";
      ctx.fillText(dateText, labelWidth - 12, yCenter);

      // Create Bar Gradient
      const barX = isPositive ? zeroX : targetX;
      const barW = Math.max(2, Math.abs(targetX - zeroX));

      ctx.save();
      const grad = ctx.createLinearGradient(zeroX, barTop, targetX, barTop);
      if (isPositive) {
        grad.addColorStop(0, "#059669");
        grad.addColorStop(1, "#10b981");
        if (isHovered) {
          ctx.shadowColor = "rgba(16, 185, 129, 0.7)";
          ctx.shadowBlur = 12;
        }
      } else {
        grad.addColorStop(0, "#e11d48");
        grad.addColorStop(1, "#f43f5e");
        if (isHovered) {
          ctx.shadowColor = "rgba(244, 63, 94, 0.7)";
          ctx.shadowBlur = 12;
        }
      }

      ctx.fillStyle = grad;
      const radius = 3;
      ctx.beginPath();
      if (isPositive) {
        ctx.roundRect(barX, barTop, barW, barHeight, [0, radius, radius, 0]);
      } else {
        ctx.roundRect(barX, barTop, barW, barHeight, [radius, 0, 0, radius]);
      }
      ctx.fill();
      ctx.restore();

      // Value label near bar tip
      ctx.font = isHovered ? "bold 11px JetBrains Mono, monospace" : "10px JetBrains Mono, monospace";
      ctx.fillStyle = isPositive ? (isLightMode ? "#059669" : "#34d399") : (isLightMode ? "#e11d48" : "#f87171");
      ctx.textBaseline = "middle";
      const sign = val > 0 ? "+" : "";
      const valStr = `${sign}${val.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;

      if (isPositive) {
        ctx.textAlign = "left";
        ctx.fillText(valStr, targetX + 8, yCenter);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(valStr, targetX - 8, yCenter);
      }
    });

    // Draw Crosshair if Active
    if (fiiHoveredIndex >= 0 && fiiCrosshairPos) {
      const activeY = paddingTop + fiiHoveredIndex * rowHeight + rowHeight / 2;
      const mouseX = Math.max(labelWidth, Math.min(containerWidth - paddingRight, fiiCrosshairPos.x));

      ctx.save();
      ctx.strokeStyle = colors.teal;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);

      // Horizontal guideline
      ctx.beginPath();
      ctx.moveTo(labelWidth, activeY);
      ctx.lineTo(containerWidth - paddingRight, activeY);
      ctx.stroke();

      // Vertical guideline
      ctx.beginPath();
      ctx.moveTo(mouseX, paddingTop - 10);
      ctx.lineTo(mouseX, totalHeight - paddingBottom + 5);
      ctx.stroke();

      // Value pill on X-axis tracking cursor
      const cursorVal = xMin + ((mouseX - labelWidth) / chartWidth) * (xMax - xMin);
      const pillText = (cursorVal >= 0 ? "+" : "") + cursorVal.toFixed(0) + " Cr";
      ctx.font = "bold 10px JetBrains Mono, monospace";
      const textW = ctx.measureText(pillText).width;
      const pillW = textW + 12;
      const pillH = 18;
      const pillX = mouseX - pillW / 2;
      const pillY = totalHeight - paddingBottom + 5;

      ctx.setLineDash([]);
      ctx.fillStyle = colors.teal;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillText, mouseX, pillY + pillH / 2);

      ctx.restore();
    }
  }

  function handleFiiCanvasMouseMove(e) {
    const canvas = document.getElementById("chartFiiDiiCanvas");
    if (!canvas || !fiiChartRows || fiiChartRows.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const paddingTop = 45;
    const rowHeight = 28;
    const idx = Math.floor((mouseY - paddingTop) / rowHeight);

    if (idx >= 0 && idx < fiiChartRows.length) {
      fiiHoveredIndex = idx;
      fiiCrosshairPos = { x: mouseX, y: mouseY };
      renderFiiDiiChart();
      updateFiiTooltip(e.clientX, e.clientY, fiiChartRows[idx]);
      highlightFiiTableRow(idx);
    } else {
      handleFiiCanvasMouseLeave();
    }
  }

  function handleFiiCanvasMouseLeave() {
    fiiHoveredIndex = -1;
    fiiCrosshairPos = null;
    renderFiiDiiChart();
    const tooltip = document.getElementById("fiiCrosshairTooltip");
    if (tooltip) tooltip.style.display = "none";
    highlightFiiTableRow(-1);
  }

  function updateFiiTooltip(clientX, clientY, row) {
    const tooltip = document.getElementById("fiiCrosshairTooltip");
    if (!tooltip || !row) return;

    const container = document.getElementById("fiiChartContainer");
    const containerRect = container.getBoundingClientRect();
    const relX = clientX - containerRect.left;
    const relY = clientY - containerRect.top;

    const totalNet = Number(row.totalNet || 0);
    const fiiNet = Number(row.fiiNet || 0);
    const diiNet = Number(row.diiNet || 0);
    const fiiBuy = Number(row.fiiBuy || 0);
    const fiiSell = Number(row.fiiSell || 0);
    const diiBuy = Number(row.diiBuy || 0);
    const diiSell = Number(row.diiSell || 0);
    const niftyClose = row.niftyClose ? Number(row.niftyClose).toFixed(2) : "--";
    const niftyPct = row.niftyPct !== undefined ? (row.niftyPct > 0 ? `+${row.niftyPct}%` : `${row.niftyPct}%`) : "";

    const totClass = totalNet >= 0 ? "text-green" : "text-red";
    const fiiClass = fiiNet >= 0 ? "text-green" : "text-red";
    const diiClass = diiNet >= 0 ? "text-green" : "text-red";

    tooltip.innerHTML = `
      <div class="fii-tooltip-date">
        <span>📅 ${row.period || row.date}</span>
        <span style="font-size:11px; font-weight:700; color:var(--p2-text-bright);">${niftyClose} (${niftyPct})</span>
      </div>
      <div class="fii-tooltip-row">
        <span class="label">Combined Net:</span>
        <span class="val ${totClass}">${totalNet > 0 ? "+" : ""}₹${totalNet.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr</span>
      </div>
      <div class="fii-tooltip-row">
        <span class="label">FII/FPI Net:</span>
        <span class="val ${fiiClass}">${fiiNet > 0 ? "+" : ""}₹${fiiNet.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr</span>
      </div>
      <div class="fii-tooltip-row" style="font-size:10px; opacity:0.8;">
        <span class="label">FII Gross:</span>
        <span>Buy: ₹${fiiBuy.toLocaleString("en-IN")} | Sell: ₹${fiiSell.toLocaleString("en-IN")}</span>
      </div>
      <div class="fii-tooltip-row" style="margin-top:4px;">
        <span class="label">DII Domestic Net:</span>
        <span class="val ${diiClass}">${diiNet > 0 ? "+" : ""}₹${diiNet.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr</span>
      </div>
      <div class="fii-tooltip-row" style="font-size:10px; opacity:0.8;">
        <span class="label">DII Gross:</span>
        <span>Buy: ₹${diiBuy.toLocaleString("en-IN")} | Sell: ₹${diiSell.toLocaleString("en-IN")}</span>
      </div>
    `;

    tooltip.style.display = "block";
    let left = relX + 20;
    if (left + 260 > containerRect.width) {
      left = relX - 270;
    }
    let top = relY - 40;
    if (top < 10) top = 10;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  function renderFiiDiiTable(list) {
    const tbody = document.getElementById("fiiTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const periodLabel = currentFiiPeriod.toUpperCase();
    const tableTitle = document.getElementById("fiiTableTitle");
    if (tableTitle) tableTitle.textContent = `FII/FPI & DII Net Buy/Sell Data - ${periodLabel}`;

    list.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-row-idx", idx);

      const tot = Number(row.totalNet || 0);
      const fii = Number(row.fiiNet || 0);
      const dii = Number(row.diiNet || 0);
      const niftyClose = row.niftyClose ? Number(row.niftyClose).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "--";
      const niftyPct = row.niftyPct !== undefined ? (row.niftyPct >= 0 ? `+${row.niftyPct}%` : `${row.niftyPct}%`) : "";
      const niftyClass = (row.niftyPct || 0) >= 0 ? "text-green" : "text-red";

      let actionText = "Neutral";
      let actionClass = "divergent";
      if (fii > 0 && dii > 0) { actionText = "Both Buying"; actionClass = "bullish"; }
      else if (fii < 0 && dii < 0) { actionText = "Both Selling"; actionClass = "bearish"; }
      else if (fii < 0 && dii > 0) { actionText = "DII Absorbing"; actionClass = "bullish"; }
      else if (fii > 0 && dii < 0) { actionText = "FII Dominance"; actionClass = "bullish"; }

      tr.innerHTML = `
        <td><strong>${row.period || row.date}</strong></td>
        <td class="text-right"><strong class="${niftyClass}">${niftyClose}</strong> <span style="font-size:10px;" class="${niftyClass}">(${niftyPct})</span></td>
        <td class="text-right"><strong class="${tot >= 0 ? 'text-green' : 'text-red'}">${tot > 0 ? '+' : ''}${tot.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></td>
        <td class="text-right">₹${Number(row.fiiBuy || 0).toLocaleString('en-IN')}</td>
        <td class="text-right">₹${Number(row.fiiSell || 0).toLocaleString('en-IN')}</td>
        <td class="text-right"><strong class="${fii >= 0 ? 'text-green' : 'text-red'}">${fii > 0 ? '+' : ''}${fii.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></td>
        <td class="text-right">₹${Number(row.diiBuy || 0).toLocaleString('en-IN')}</td>
        <td class="text-right">₹${Number(row.diiSell || 0).toLocaleString('en-IN')}</td>
        <td class="text-right"><strong class="${dii >= 0 ? 'text-green' : 'text-red'}">${dii > 0 ? '+' : ''}${dii.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></td>
        <td class="text-center"><span class="fii-action-pill ${actionClass}">${actionText}</span></td>
      `;

      tr.addEventListener("mouseenter", () => {
        fiiHoveredIndex = idx;
        const canvas = document.getElementById("chartFiiDiiCanvas");
        if (canvas) {
          const paddingTop = 45;
          const rowHeight = 28;
          fiiCrosshairPos = { x: canvas.clientWidth / 2, y: paddingTop + idx * rowHeight + rowHeight / 2 };
          renderFiiDiiChart();
          highlightFiiTableRow(idx);
        }
      });
      tr.addEventListener("mouseleave", () => {
        handleFiiCanvasMouseLeave();
      });

      tbody.appendChild(tr);
    });
  }

  function highlightFiiTableRow(idx) {
    const rows = document.querySelectorAll("#tableFiiDiiData tbody tr");
    rows.forEach(r => {
      if (parseInt(r.getAttribute("data-row-idx"), 10) === idx) {
        r.classList.add("highlight-bar");
      } else {
        r.classList.remove("highlight-bar");
      }
    });
  }

  function filterFiiTable(query) {
    const rows = document.querySelectorAll("#tableFiiDiiData tbody tr");
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(query) ? "" : "none";
    });
  }

  function exportFiiCsv() {
    if (!fiiChartRows || fiiChartRows.length === 0) return;
    let csv = "Date,NIFTY 50,NIFTY Pct,Combined Net (Cr),FII Buy (Cr),FII Sell (Cr),FII Net (Cr),DII Buy (Cr),DII Sell (Cr),DII Net (Cr)\n";
    fiiChartRows.forEach(r => {
      csv += `"${r.period || r.date}",${r.niftyClose || ''},${r.niftyPct || ''},${r.totalNet || ''},${r.fiiBuy || ''},${r.fiiSell || ''},${r.fiiNet || ''},${r.diiBuy || ''},${r.diiSell || ''},${r.diiNet || ''}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FII_DII_${currentFiiPeriod.toUpperCase()}_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ========================================================================
  // SECTION 5: INDEX BREADTH & STOCK WEIGHT CONTRIBUTION DESK
  // ========================================================================
  // Use IST (UTC+5:30) for today's date — toISOString() gives UTC which can be yesterday before 05:30 IST
  const _todayStr = (() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST = UTC + 5h30m
    const istNow = new Date(now.getTime() + istOffset);
    return istNow.toISOString().slice(0, 10);
  })();
  let currentContribIndex = "nifty50";
  let currentContribDate = _todayStr;
  let isExplicitContribDate = false;
  let currentContribSector = "ALL";
  let currentContribSearch = "";
  let contribDataCache = null;
  let contribTimeline = [];
  let activeContribHoverIndex = -1;
  let contribSortDownCol = "contribution";
  let contribSortDownDir = "asc";
  let contribSortUpCol = "contribution";
  let contribSortUpDir = "desc";

  function initContribSortHeaders() {
    const tblDown = document.getElementById("tablePullingDown");
    if (tblDown) {
      tblDown.querySelectorAll("thead th.contrib-sortable").forEach(th => {
        th.addEventListener("click", () => {
          const col = th.dataset.sort;
          if (!col) return;
          if (contribSortDownCol === col) {
            contribSortDownDir = contribSortDownDir === "desc" ? "asc" : "desc";
          } else {
            contribSortDownCol = col;
            contribSortDownDir = (col === "symbol") ? "asc" : (col === "contribution" ? "asc" : "desc");
          }
          updateContribSortIcons();
          renderContributionTables();
        });
      });
    }

    const tblUp = document.getElementById("tableSupporting");
    if (tblUp) {
      tblUp.querySelectorAll("thead th.contrib-sortable").forEach(th => {
        th.addEventListener("click", () => {
          const col = th.dataset.sort;
          if (!col) return;
          if (contribSortUpCol === col) {
            contribSortUpDir = contribSortUpDir === "desc" ? "asc" : "desc";
          } else {
            contribSortUpCol = col;
            contribSortUpDir = (col === "symbol") ? "asc" : "desc";
          }
          updateContribSortIcons();
          renderContributionTables();
        });
      });
    }
  }

  function updateContribSortIcons() {
    const tblDown = document.getElementById("tablePullingDown");
    if (tblDown) {
      tblDown.querySelectorAll("thead th.contrib-sortable").forEach(th => {
        const col = th.dataset.sort;
        const iconSpan = th.querySelector(".sort-icon");
        if (col === contribSortDownCol) {
          th.classList.add("active-sort");
          if (iconSpan) iconSpan.textContent = contribSortDownDir === "asc" ? "▲" : "▼";
        } else {
          th.classList.remove("active-sort");
          if (iconSpan) iconSpan.textContent = "↕";
        }
      });
    }

    const tblUp = document.getElementById("tableSupporting");
    if (tblUp) {
      tblUp.querySelectorAll("thead th.contrib-sortable").forEach(th => {
        const col = th.dataset.sort;
        const iconSpan = th.querySelector(".sort-icon");
        if (col === contribSortUpCol) {
          th.classList.add("active-sort");
          if (iconSpan) iconSpan.textContent = contribSortUpDir === "asc" ? "▲" : "▼";
        } else {
          th.classList.remove("active-sort");
          if (iconSpan) iconSpan.textContent = "↕";
        }
      });
    }
  }

  function initBreadthContribution() {
    initContribSortHeaders();
    // Date picker input
    const dateInput = document.getElementById("contribDateInput");
    if (dateInput) {
      dateInput.value = currentContribDate;
      dateInput.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
          isExplicitContribDate = true;
          currentContribDate = val;
          loadBreadthContributionSuite(currentContribIndex, currentContribDate, false);
        }
      });
    }

    // Index selector buttons
    const idxBtns = document.querySelectorAll("#contribIndexGroup .contrib-index-btn");
    idxBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        idxBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentContribIndex = btn.getAttribute("data-index");
        loadBreadthContributionSuite(currentContribIndex, currentContribDate, false);
      });
    });

    // Refresh button (explicit manual refresh)
    const refBtn = document.getElementById("contribRefreshBtn");
    if (refBtn) {
      refBtn.addEventListener("click", () => {
        loadBreadthContributionSuite(currentContribIndex, currentContribDate, true);
      });
    }

    // Sector tags
    const sectorTags = document.querySelectorAll("#contribSectorFilters .contrib-sector-tag");
    sectorTags.forEach(tag => {
      tag.addEventListener("click", () => {
        sectorTags.forEach(t => t.classList.remove("active"));
        tag.classList.add("active");
        currentContribSector = tag.getAttribute("data-sector");
        renderContributionTables();
      });
    });

    // Symbol Search input with 40ms debounce for ultra-responsive typing
    const searchInput = document.getElementById("contribSymbolSearchInput");
    if (searchInput) {
      let searchDebounceTimer = null;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          currentContribSearch = (e.target.value || "").trim().toLowerCase();
          renderContributionTables();
        }, 40);
      });
    }

    // Setup Canvas interaction
    setupContribCanvasEvents();

    // Auto-refresh live data every 10 seconds if viewing today's session and market is open
    if (!window._contribAutoRefreshTimer) {
      window._contribAutoRefreshTimer = setInterval(() => {
        const isContribActive = (typeof currentSuite !== "undefined" && currentSuite === "contribution") ||
                                (document.getElementById("p2ViewContribution")?.style.display !== "none");
        if (isContribActive) {
          const isToday = !isExplicitContribDate && (!currentContribDate || currentContribDate === _todayStr);
          const isMarketOpenNow = contribDataCache ? (!contribDataCache.isMarketClosed && !contribDataCache.isHoliday) : true;
          if (isToday && isMarketOpenNow) {
            loadBreadthContributionSuite(currentContribIndex, currentContribDate, false);
          }
        }
      }, 10000);
    }
  }

  async function loadBreadthContributionSuite(indexKey = "nifty50", dateStr = null, isRefresh = false) {
    const dateBadge = document.getElementById("contribDateDisplayBadge");
    if (isRefresh && dateBadge && !dateBadge.textContent.includes("⏳")) {
      dateBadge.textContent = "⏳ Computing Breadth...";
    }
    try {
      const effDate = dateStr || currentContribDate || _todayStr;
      const url = `/api/index-breadth-contribution?index=${encodeURIComponent(indexKey)}&date=${encodeURIComponent(effDate)}${isRefresh ? '&refresh=true' : ''}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data.ok) throw new Error(data.message || "Contribution data is unavailable");
      if (!Array.isArray(data.timeline) || data.timeline.length < 5) {
        throw new Error("Verified contribution timeline is incomplete");
      }

      contribDataCache = data;
      contribTimeline = data.timeline || [];

      // Update Date elements without overwriting user's explicit selection
      const displayDate = data.displayDate || "22-Sep-2026";
      const dateInput = document.getElementById("contribDateInput");
      if (dateInput) {
        if (!isExplicitContribDate) {
          dateInput.value = data.requestedDate || data.date || effDate;
        } else {
          dateInput.value = currentContribDate;
        }
      }

      // Update date badge based on market status
      if (dateBadge) {
        if (data.isHoliday) {
          dateBadge.textContent = "🏛️ Holiday";
          dateBadge.className = "p2-badge p2-badge-amber";
        } else if (data.isMarketClosed) {
          dateBadge.textContent = "🔴 Market Closed";
          dateBadge.className = "p2-badge p2-badge-red";
        } else {
          dateBadge.textContent = "🟢 Live (09:15 - 15:30)";
          dateBadge.className = "p2-badge p2-badge-teal";
        }
      }

      // Update Market Status Notice Banner
      const noticeBanner = document.getElementById("contribMarketNoticeBanner");
      const noticeText = document.getElementById("contribMarketNoticeText");
      if (noticeBanner && noticeText) {
        if (data.holidayNotice) {
          noticeText.textContent = data.holidayNotice;
          noticeBanner.style.display = "flex";
        } else if (data.requestedDate && data.date && data.requestedDate !== data.date) {
          noticeText.textContent = `🔴 Market was closed on ${data.requestedDate} • Showing Completed Session of ${data.displayDate || data.date}`;
          noticeBanner.style.display = "flex";
        } else {
          noticeBanner.style.display = "none";
        }
      }

      // Update spot pill
      const idxInfo = data.indexInfo || {};
      const spotTitle = document.getElementById("contribSpotTitle");
      const spotVal = document.getElementById("contribSpotVal");
      const spotChg = document.getElementById("contribSpotChg");
      const niftyTitle = document.getElementById("niftyChartTitle");
      const breadthTitle = document.getElementById("contribBreadthTitle");
      const breadthMeta = document.getElementById("contribBreadthMeta");
      const niftyMeta = document.getElementById("contribNiftyMeta");

      if (spotTitle) spotTitle.textContent = idxInfo.name || "NIFTY 50";
      if (breadthTitle) breadthTitle.textContent = `Intraday Breadth (${displayDate})`;
      if (niftyTitle) niftyTitle.textContent = `Index Spot Chart (${displayDate})`;
      if (spotVal) spotVal.textContent = Number(idxInfo.spot || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (spotChg) {
        const isUp = (idxInfo.change || 0) >= 0;
        const sign = isUp ? "+" : "";
        spotChg.className = `spot-chg ${isUp ? 'text-green' : 'text-red'}`;
        spotChg.textContent = `${sign}${idxInfo.change || 0} (${sign}${idxInfo.changePct || 0}%)`;
      }

      const summary = data.summary || {};
      if (breadthMeta) {
        const scrips = (idxInfo.name || "").includes("BANK") ? "12/12 scrips" : "50/50 scrips";
        breadthMeta.textContent = `${idxInfo.name || "Nifty 50"} | one minute | ${scrips}`;
      }
      if (niftyMeta) {
        niftyMeta.textContent = `${idxInfo.name || "Nifty 50"} | one minute | Spot & VWAP`;
      }

      // Update Breadth Header Metrics Bar (Matching Page 1 exactly)
      const bSum = data.breadthSummary || {};
      const latestBreadthEl = document.getElementById("contribLatestBreadth");
      const openBreadthEl = document.getElementById("contribOpenBreadth");
      const breadthChgEl = document.getElementById("contribBreadthChange");
      const changeMetricEl = document.getElementById("contribChangeMetric");
      const xoCountEl = document.getElementById("contribXoCount");

      if (latestBreadthEl) latestBreadthEl.textContent = bSum.latestBreadth !== undefined ? `${Number(bSum.latestBreadth).toFixed(2)}%` : "--";
      if (openBreadthEl) openBreadthEl.textContent = bSum.openBreadth !== undefined ? `${Number(bSum.openBreadth).toFixed(2)}%` : "--";
      if (breadthChgEl) {
        const chg = bSum.change;
        const sign = (chg || 0) >= 0 ? "+" : "";
        breadthChgEl.textContent = chg !== undefined ? `${sign}${Number(chg).toFixed(2)} pts` : "--";
        if (changeMetricEl) {
          changeMetricEl.classList.toggle("positive", Number(chg) >= 0);
          changeMetricEl.classList.toggle("negative", Number(chg) < 0);
        }
      }
      if (xoCountEl) xoCountEl.textContent = `${bSum.x || 0} / ${bSum.o || 0}`;

      // Update Index Spot Header Metrics Bar
      const niftySpotValEl = document.getElementById("contribNiftySpotVal");
      const niftyChgValEl = document.getElementById("contribNiftyChgVal");
      const niftyChgMetricEl = document.getElementById("contribNiftyChgMetric");
      if (niftySpotValEl) niftySpotValEl.textContent = Number(idxInfo.spot || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (niftyChgValEl) {
        const isUp = (idxInfo.change || 0) >= 0;
        const sign = isUp ? "+" : "";
        niftyChgValEl.textContent = `${sign}${Number(idxInfo.change || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${sign}${idxInfo.changePct || 0}%)`;
        if (niftyChgMetricEl) {
          niftyChgMetricEl.classList.toggle("positive", isUp);
          niftyChgMetricEl.classList.toggle("negative", !isUp);
        }
      }

      // Update Summary Card & Split Bar
      const netBadge = document.getElementById("contribNetPtsBadge");
      const splitDrag = document.getElementById("contribSplitBarDrag");
      const splitSupport = document.getElementById("contribSplitBarSupport");
      const dragPtsLabel = document.getElementById("contribDragPtsLabel");
      const supportPtsLabel = document.getElementById("contribSupportPtsLabel");

      if (netBadge) {
        const isNetPos = (summary.netPoints || 0) >= 0;
        const sign = isNetPos ? "+" : "";
        netBadge.className = `contrib-net-badge ${isNetPos ? 'text-green' : 'text-red'}`;
        netBadge.textContent = `Net ${sign}${summary.netPoints || 0} pts`;
      }

      const dragPct = summary.dragRatioPct || 34.9;
      const supportPct = summary.supportRatioPct || 65.1;
      if (splitDrag) {
        splitDrag.style.width = `${dragPct}%`;
        splitDrag.title = `Decliners dragging ${dragPct}% (${summary.draggingPoints} pts)`;
      }
      if (splitSupport) {
        splitSupport.style.width = `${supportPct}%`;
        splitSupport.title = `Advancers supporting ${supportPct}% (+${summary.supportingPoints} pts)`;
      }

      if (dragPtsLabel) dragPtsLabel.textContent = `${summary.draggingPoints || 0}`;
      if (supportPtsLabel) supportPtsLabel.textContent = `+${summary.supportingPoints || 0}`;

      // Render Tables
      renderContributionTables();

      // Render Dual Synchronized Charts (Exact Page 1 Breadth Styling)
      requestAnimationFrame(() => {
        renderIntradayBreadthChart(contribTimeline);
        renderIntradayIndexChart(contribTimeline, idxInfo);
      });

    } catch (err) {
      contribDataCache = null;
      contribTimeline = [];
      const msg = err.message || "Verified breadth and index data are unavailable.";
      if (dateBadge) {
        dateBadge.textContent = "⚠ Data unavailable";
        dateBadge.className = "p2-badge p2-badge-amber";
      }
      const noticeBanner = document.getElementById("contribMarketNoticeBanner");
      const noticeText = document.getElementById("contribMarketNoticeText");
      if (noticeBanner && noticeText) {
        noticeText.textContent = `${msg} No estimated breadth or Nifty chart is displayed.`;
        noticeBanner.style.display = "flex";
      }
      ["tbodyPullingDown", "tbodySupporting"].forEach((id) => {
        const body = document.getElementById(id);
        if (body) body.innerHTML = `<tr><td colspan="5" class="text-center">Verified data unavailable</td></tr>`;
      });
      ["chartIntradayBreadthCanvas", "chartIntradayNiftyCanvas"].forEach((id) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 600, height = rect.height || 300;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = document.body.classList.contains("theme-light") ? "#ffffff" : "#0c121e";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = document.body.classList.contains("theme-light") ? "#64748b" : "#94a3b8";
        ctx.font = "13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Verified session data unavailable", width / 2, height / 2);
      });
      console.error("Failed to load Breadth Contribution suite:", err);
    }
  }

  function renderContributionTables() {
    if (!contribDataCache) return;

    let dragging = contribDataCache.draggingDown || [];
    let supporting = contribDataCache.supportingUp || [];

    // Filter by sector if not ALL
    if (currentContribSector !== "ALL") {
      const sec = currentContribSector.toLowerCase();
      dragging = dragging.filter(s => (s.sector || "").toLowerCase().includes(sec));
      supporting = supporting.filter(s => (s.sector || "").toLowerCase().includes(sec));
    }

    // Filter by search query
    if (currentContribSearch) {
      const q = currentContribSearch;
      dragging = dragging.filter(s => (s.symbol || "").toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q));
      supporting = supporting.filter(s => (s.symbol || "").toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q));
    }

    // Update header points and counts
    const dragCountEl = document.getElementById("contribDragStockCount");
    const dragPtsEl = document.getElementById("contribDragHeaderPts");
    const supportCountEl = document.getElementById("contribSupportStockCount");
    const supportPtsEl = document.getElementById("contribSupportHeaderPts");

    let dragSum = 0;
    for (let i = 0; i < dragging.length; i++) dragSum += (dragging[i].contribution || 0);
    let supportSum = 0;
    for (let i = 0; i < supporting.length; i++) supportSum += (supporting[i].contribution || 0);

    if (dragCountEl) dragCountEl.textContent = `${dragging.length} stocks`;
    if (dragPtsEl) dragPtsEl.textContent = dragSum.toFixed(2);
    if (supportCountEl) supportCountEl.textContent = `${supporting.length} stocks`;
    if (supportPtsEl) supportPtsEl.textContent = `+${supportSum.toFixed(2)}`;

    // Sort dragging
    const isAscDown = contribSortDownDir === "asc";
    dragging.sort((a, b) => {
      if (contribSortDownCol === "symbol") {
        return isAscDown ? (a.symbol || "").localeCompare(b.symbol || "") : (b.symbol || "").localeCompare(a.symbol || "");
      }
      const va = Number(a[contribSortDownCol] || 0);
      const vb = Number(b[contribSortDownCol] || 0);
      return isAscDown ? va - vb : vb - va;
    });

    // Sort supporting
    const isAscUp = contribSortUpDir === "asc";
    supporting.sort((a, b) => {
      if (contribSortUpCol === "symbol") {
        return isAscUp ? (a.symbol || "").localeCompare(b.symbol || "") : (b.symbol || "").localeCompare(a.symbol || "");
      }
      const va = Number(a[contribSortUpCol] || 0);
      const vb = Number(b[contribSortUpCol] || 0);
      return isAscUp ? va - vb : vb - va;
    });

    // Ultra-Fast Table Generation using single-pass HTML concatenation
    const tbodyDown = document.getElementById("tbodyPullingDown");
    if (tbodyDown) {
      let html = "";
      for (let i = 0; i < dragging.length; i++) {
        const s = dragging[i];
        const rowCls = s.isHighlighted ? ' class="row-highlight-amber"' : "";
        const ltp = Number(s.ltp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const chg = Number(s.change || 0).toFixed(2);
        const chgPct = `${Number(s.changePct || 0).toFixed(2)}%`;
        const contrib = Number(s.contribution || 0).toFixed(2);
        const barW = Math.max(4, Math.min(100, s.barPct || 0));

        html += `<tr${rowCls}>
          <td><strong>${s.symbol}</strong></td>
          <td class="text-right font-mono">${ltp}</td>
          <td class="text-right font-mono text-red">${chg}</td>
          <td class="text-right font-mono text-red">${chgPct}</td>
          <td class="text-right">
            <div class="contrib-impact-cell">
              <span class="font-mono text-red font-bold">${contrib}</span>
              <span class="contrib-mini-track"><span class="contrib-mini-fill red" style="width:${barW}%;"></span></span>
            </div>
          </td>
        </tr>`;
      }
      tbodyDown.innerHTML = html;
    }

    const tbodyUp = document.getElementById("tbodySupporting");
    if (tbodyUp) {
      let html = "";
      for (let i = 0; i < supporting.length; i++) {
        const s = supporting[i];
        const rowCls = s.isHighlighted ? ' class="row-highlight-amber"' : "";
        const ltp = Number(s.ltp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const chg = `+${Number(s.change || 0).toFixed(2)}`;
        const chgPct = `+${Number(s.changePct || 0).toFixed(2)}%`;
        const contrib = `+${Number(s.contribution || 0).toFixed(2)}`;
        const barW = Math.max(4, Math.min(100, s.barPct || 0));

        html += `<tr${rowCls}>
          <td><strong>${s.symbol}</strong></td>
          <td class="text-right font-mono">${ltp}</td>
          <td class="text-right font-mono text-green">${chg}</td>
          <td class="text-right font-mono text-green">${chgPct}</td>
          <td class="text-right">
            <div class="contrib-impact-cell">
              <span class="font-mono text-green font-bold">${contrib}</span>
              <span class="contrib-mini-track"><span class="contrib-mini-fill green" style="width:${barW}%;"></span></span>
            </div>
          </td>
        </tr>`;
      }
      tbodyUp.innerHTML = html;
    }
  }

  // ========================================================================
  // DUAL SYNCHRONIZED CANVASES & ULTRA-SMOOTH CROSSHAIR ENGINE
  // ========================================================================
  const BREADTH_CHART_PAD = { top: 16, right: 18, bottom: 26, left: 45 };
  const NIFTY_CHART_PAD   = { top: 16, right: 18, bottom: 26, left: 62 };

  let breadthChartGeom = null;
  let niftyChartGeom = null;
  let isContribRafPending = false;

  function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function renderIntradayBreadthChart(timeline) {
    const canvas = document.getElementById("chartIntradayBreadthCanvas");
    if (!canvas || !timeline || timeline.length === 0) return;

    const container = canvas.parentElement;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (container ? container.clientWidth : 0) || 600;
    const h = rect.height > 0 ? rect.height : (container ? container.clientHeight : 0) || 440;
    if (w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isLightMode = document.body.classList.contains("theme-light");
    const bgColor = isLightMode ? "#ffffff" : "#0c121e";
    const textColor = isLightMode ? "#64748b" : "#94a3b8";
    const gridColor = isLightMode ? "#e2e8f0" : "#1e293d";
    const axisColor = isLightMode ? "#cbd5e1" : "#334155";

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const pad = BREADTH_CHART_PAD;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    let minB = 100;
    let maxB = 0;
    for (let i = 0; i < timeline.length; i++) {
      const pt = timeline[i];
      const b = Number(pt.breadth);
      if (Number.isFinite(b)) {
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
      }
      if (pt.ma !== null && pt.ma !== undefined) {
        const ma = Number(pt.ma);
        if (Number.isFinite(ma)) {
          if (ma < minB) minB = ma;
          if (ma > maxB) maxB = ma;
        }
      }
    }
    if (minB > maxB) { minB = 10; maxB = 90; }

    // Dynamic responsive Y-axis bounds so chart curve fills canvas gracefully without squashing
    const centerB = (minB + maxB) / 2.0;
    const targetSpan = Math.max(35, (maxB - minB) * 1.35);
    let yMin = Math.max(0, Math.floor((centerB - targetSpan / 2.0) / 10.0) * 10);
    let yMax = Math.min(100, Math.ceil((centerB + targetSpan / 2.0) / 10.0) * 10);
    if (yMax - yMin < 30) {
      if (yMax <= 70) yMax = Math.min(100, yMin + 30);
      else yMin = Math.max(0, yMax - 30);
    }

    const xFor = (index) => pad.left + (index / Math.max(1, timeline.length - 1)) * plotW;
    const yFor = (value) => pad.top + plotH - ((Math.max(yMin, Math.min(yMax, value)) - yMin) / Math.max(1, (yMax - yMin))) * plotH;

    breadthChartGeom = { pad, plotW, plotH, w, h, xFor, yFor, timeline, yMin, yMax };

    // Draw Dynamic Horizontal Grid lines
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = textColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const gridStep = (yMax - yMin) <= 30 ? 10 : ((yMax - yMin) <= 60 ? 15 : 20);
    const gridLevels = [];
    for (let l = yMin; l <= yMax; l += gridStep) {
      gridLevels.push(l);
    }
    if (!gridLevels.includes(yMax)) gridLevels.push(yMax);

    gridLevels.forEach((level) => {
      const y = yFor(level);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash(level === 50 ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(`${level}%`, pad.left - 6, y);
    });
    ctx.setLineDash([]);

    // Solid Axis lines on left and bottom
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    // 1. Fill Area with Sky Blue Gradient
    let started = false;
    ctx.beginPath();
    for (let i = 0; i < timeline.length; i++) {
      const point = timeline[i];
      if (point.breadth === null || point.breadth === undefined) continue;
      const x = xFor(i);
      const y = yFor(point.breadth);
      if (!started) {
        ctx.moveTo(x, pad.top + plotH);
        ctx.lineTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (started) {
      ctx.lineTo(xFor(timeline.length - 1), pad.top + plotH);
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      areaGrad.addColorStop(0, "rgba(56, 189, 248, 0.22)");
      areaGrad.addColorStop(1, "rgba(56, 189, 248, 0.01)");
      ctx.fillStyle = areaGrad;
      ctx.fill();
    }

    // 2. Draw Breadth % Line (Sky Blue #38bdf8, 2.2px)
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    started = false;
    for (let i = 0; i < timeline.length; i++) {
      const point = timeline[i];
      if (point.breadth === null || point.breadth === undefined) continue;
      const x = xFor(i);
      const y = yFor(point.breadth);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();

    // 3. Draw 20 SMA Line (Amber #f59e0b, 2.0px with glow)
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.0;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(245, 158, 11, 0.35)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    started = false;
    for (let i = 0; i < timeline.length; i++) {
      const point = timeline[i];
      if (point.ma === null || point.ma === undefined) continue;
      const x = xFor(i);
      const y = yFor(point.ma);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();
    ctx.restore();

    // 4. X-Axis Time Labels
    function formatTimeShort(val) {
      if (!val) return "--";
      const s = String(val);
      const m = s.match(/T?(\d{2}:\d{2})/);
      return m ? m[1] : (s.length >= 5 ? s.slice(0, 5) : s);
    }

    ctx.fillStyle = textColor;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(formatTimeShort(timeline[0].time), pad.left, h - pad.bottom + 6);
    ctx.textAlign = "right";
    ctx.fillText(formatTimeShort(timeline[timeline.length - 1].time), w - pad.right, h - pad.bottom + 6);

    ctx.textAlign = "center";
    const timeLabels = ["10:15", "11:15", "12:15", "13:15", "14:15", "15:15"];
    timeLabels.forEach(tStr => {
      const idx = timeline.findIndex(p => String(p.time).includes(tStr) || p.displayTime === tStr);
      if (idx > 0) {
        ctx.fillText(tStr, xFor(idx), h - pad.bottom + 6);
        ctx.save();
        ctx.strokeStyle = isLightMode ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.04)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xFor(idx), pad.top);
        ctx.lineTo(xFor(idx), h - pad.bottom);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 5. Institutional Crosshair Rendering (Vertical + Horizontal + Axis Badges)
    if (activeContribHoverIndex >= 0 && activeContribHoverIndex < timeline.length) {
      const pt = timeline[activeContribHoverIndex];
      const cx = xFor(activeContribHoverIndex);
      const bVal = pt.breadth !== null && pt.breadth !== undefined ? Number(pt.breadth) : 50;
      const cyBreadth = yFor(bVal);

      ctx.save();
      ctx.strokeStyle = isLightMode ? "rgba(0, 0, 0, 0.5)" : "rgba(56, 189, 248, 0.85)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);

      // Vertical crosshair line
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, h - pad.bottom);
      ctx.stroke();

      // Horizontal crosshair line
      ctx.beginPath();
      ctx.moveTo(pad.left, cyBreadth);
      ctx.lineTo(w - pad.right, cyBreadth);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hover dot on Breadth %
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(cx, cyBreadth, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cyBreadth, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Hover dot on 20 SMA
      if (pt.ma !== null && pt.ma !== undefined) {
        const cyMa = yFor(pt.ma);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(cx, cyMa, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Left Y-Axis Breadth Badge
      const bBadgeW = 42;
      const bBadgeH = 17;
      ctx.fillStyle = "#0284c7";
      drawRoundRect(ctx, pad.left - bBadgeW - 3, cyBreadth - bBadgeH / 2, bBadgeW, bBadgeH, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${bVal.toFixed(1)}%`, pad.left - bBadgeW / 2 - 3, cyBreadth);

      // Bottom X-Axis Time Badge
      const timeStr = pt.displayTime || formatTimeShort(pt.time);
      const timeBadgeW = 46;
      const timeBadgeH = 17;
      ctx.fillStyle = isLightMode ? "#334155" : "#0284c7";
      drawRoundRect(ctx, cx - timeBadgeW / 2, h - pad.bottom + 2, timeBadgeW, timeBadgeH, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(timeStr, cx, h - pad.bottom + 2 + timeBadgeH / 2);

      ctx.restore();
    }

    ctx.restore();
  }

  function renderIntradayIndexChart(timeline, idxInfo) {
    const canvas = document.getElementById("chartIntradayNiftyCanvas");
    if (!canvas || !timeline || timeline.length === 0) return;

    const container = canvas.parentElement;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (container ? container.clientWidth : 0) || 600;
    const h = rect.height > 0 ? rect.height : (container ? container.clientHeight : 0) || 440;
    if (w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isLightMode = document.body.classList.contains("theme-light");
    const bgColor = isLightMode ? "#ffffff" : "#0c121e";
    const textColor = isLightMode ? "#64748b" : "#94a3b8";
    const gridColor = isLightMode ? "#e2e8f0" : "#1e293d";
    const axisColor = isLightMode ? "#cbd5e1" : "#334155";

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const pad = NIFTY_CHART_PAD;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    let minSpot = Infinity;
    let maxSpot = -Infinity;
    for (let i = 0; i < timeline.length; i++) {
      const pt = timeline[i];
      const s = Number(pt.spot !== undefined && pt.spot !== null ? pt.spot : pt.close);
      if (Number.isFinite(s) && s > 0) {
        if (s < minSpot) minSpot = s;
        if (s > maxSpot) maxSpot = s;
      }
      if (pt.vwap) {
        const v = Number(pt.vwap);
        if (Number.isFinite(v) && v > 0) {
          if (v < minSpot) minSpot = v;
          if (v > maxSpot) maxSpot = v;
        }
      }
    }

    if (!Number.isFinite(minSpot) || !Number.isFinite(maxSpot) || minSpot === maxSpot) {
      const baseS = (idxInfo && idxInfo.spot) ? Number(idxInfo.spot) : (minSpot > 0 ? minSpot : 23000);
      minSpot = baseS - 50;
      maxSpot = baseS + 50;
    }

    const span = Math.max(15, maxSpot - minSpot);
    const yMin = minSpot - span * 0.08;
    const yMax = maxSpot + span * 0.08;

    const xFor = (index) => pad.left + (index / Math.max(1, timeline.length - 1)) * plotW;
    const yFor = (value) => pad.top + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

    niftyChartGeom = { pad, plotW, plotH, w, h, xFor, yFor, timeline, yMin, yMax };

    // Y Axis Price Steps
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = textColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const val = yMin + ((yMax - yMin) * i) / 4.0;
      const y = yFor(val);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash(i > 0 && i < 4 ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 }), pad.left - 6, y);
    }
    ctx.setLineDash([]);

    // Solid Axis lines on left and bottom
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.lineTo(w - pad.right, h - pad.bottom);
    ctx.stroke();

    // 1. VWAP Line (Amber dashed #f59e0b)
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < timeline.length; i++) {
      const point = timeline[i];
      if (!point.vwap) continue;
      const x = xFor(i);
      const y = yFor(point.vwap);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();
    ctx.restore();

    // 2. Spot Price Area Gradient Fill
    ctx.beginPath();
    started = false;
    for (let i = 0; i < timeline.length; i++) {
      const point = timeline[i];
      const s = Number(point.spot !== undefined && point.spot !== null ? point.spot : point.close);
      const x = xFor(i);
      const y = yFor(s);
      if (!started) {
        ctx.moveTo(x, pad.top + plotH);
        ctx.lineTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (started) {
      ctx.lineTo(xFor(timeline.length - 1), pad.top + plotH);
      ctx.closePath();
      const gradSpot = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      gradSpot.addColorStop(0, "rgba(56, 189, 248, 0.22)");
      gradSpot.addColorStop(1, "rgba(56, 189, 248, 0.01)");
      ctx.fillStyle = gradSpot;
      ctx.fill();
    }

    // 3. Spot Price Curve (Sky Blue #38bdf8, 2.2px)
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    started = false;
    for (let i = 0; i < timeline.length; i++) {
      const point = timeline[i];
      const s = Number(point.spot !== undefined && point.spot !== null ? point.spot : point.close);
      const x = xFor(i);
      const y = yFor(s);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();

    // 4. X-Axis Time Labels
    function formatTimeShort(val) {
      if (!val) return "--";
      const s = String(val);
      const m = s.match(/T?(\d{2}:\d{2})/);
      return m ? m[1] : (s.length >= 5 ? s.slice(0, 5) : s);
    }

    ctx.fillStyle = textColor;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(formatTimeShort(timeline[0].time), pad.left, h - pad.bottom + 6);
    ctx.textAlign = "right";
    ctx.fillText(formatTimeShort(timeline[timeline.length - 1].time), w - pad.right, h - pad.bottom + 6);

    ctx.textAlign = "center";
    const timeLabels = ["10:15", "11:15", "12:15", "13:15", "14:15", "15:15"];
    timeLabels.forEach(tStr => {
      const idx = timeline.findIndex(p => String(p.time).includes(tStr) || p.displayTime === tStr);
      if (idx > 0) {
        ctx.fillText(tStr, xFor(idx), h - pad.bottom + 6);
        ctx.save();
        ctx.strokeStyle = isLightMode ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.04)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xFor(idx), pad.top);
        ctx.lineTo(xFor(idx), h - pad.bottom);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 5. Institutional Crosshair Rendering (Vertical + Horizontal + Price Badges)
    if (activeContribHoverIndex >= 0 && activeContribHoverIndex < timeline.length) {
      const pt = timeline[activeContribHoverIndex];
      const cx = xFor(activeContribHoverIndex);
      const spotVal = Number(pt.spot !== undefined && pt.spot !== null ? pt.spot : pt.close);
      const cySpot = yFor(spotVal);

      ctx.save();
      ctx.strokeStyle = isLightMode ? "rgba(0, 0, 0, 0.5)" : "rgba(56, 189, 248, 0.85)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);

      // Vertical crosshair line
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, h - pad.bottom);
      ctx.stroke();

      // Horizontal crosshair line
      ctx.beginPath();
      ctx.moveTo(pad.left, cySpot);
      ctx.lineTo(w - pad.right, cySpot);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hover dot on Spot curve
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(cx, cySpot, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cySpot, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Hover dot on VWAP
      if (pt.vwap) {
        const cyVwap = yFor(pt.vwap);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(cx, cyVwap, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Left Y-Axis Price Badge
      const pBadgeW = 56;
      const pBadgeH = 17;
      ctx.fillStyle = "#0284c7";
      drawRoundRect(ctx, pad.left - pBadgeW - 3, cySpot - pBadgeH / 2, pBadgeW, pBadgeH, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Number(spotVal).toLocaleString('en-IN', { maximumFractionDigits: 0 }), pad.left - pBadgeW / 2 - 3, cySpot);

      // Bottom X-Axis Time Badge
      const timeStr = pt.displayTime || formatTimeShort(pt.time);
      const timeBadgeW = 46;
      const timeBadgeH = 17;
      ctx.fillStyle = isLightMode ? "#334155" : "#0284c7";
      drawRoundRect(ctx, cx - timeBadgeW / 2, h - pad.bottom + 2, timeBadgeW, timeBadgeH, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(timeStr, cx, h - pad.bottom + 2 + timeBadgeH / 2);

      ctx.restore();
    }

    ctx.restore();
  }

  function scheduleContribChartsRedraw() {
    if (isContribRafPending) return;
    isContribRafPending = true;
    requestAnimationFrame(() => {
      isContribRafPending = false;
      if (contribTimeline && contribTimeline.length > 0) {
        renderIntradayBreadthChart(contribTimeline);
        renderIntradayIndexChart(contribTimeline, contribDataCache ? contribDataCache.indexInfo : null);
        updateContribTooltips(activeContribHoverIndex);
      }
    });
  }

  function setupContribCanvasEvents() {
    const breadthCanvas = document.getElementById("chartIntradayBreadthCanvas");
    const niftyCanvas = document.getElementById("chartIntradayNiftyCanvas");
    if (!breadthCanvas || !niftyCanvas) return;
    if (breadthCanvas._eventsAttached) return;
    breadthCanvas._eventsAttached = true;
    niftyCanvas._eventsAttached = true;

    function handleMouseMove(e, srcCanvas) {
      if (!contribTimeline || contribTimeline.length === 0) return;
      const geom = srcCanvas === breadthCanvas ? breadthChartGeom : niftyChartGeom;
      if (!geom || !geom.plotW) return;

      const rect = srcCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const relX = mouseX - geom.pad.left;
      const ratio = Math.max(0, Math.min(1, relX / Math.max(1, geom.plotW)));
      const idx = Math.max(0, Math.min(contribTimeline.length - 1, Math.round(ratio * (contribTimeline.length - 1))));

      activeContribHoverIndex = idx;
      scheduleContribChartsRedraw();
    }

    function handleMouseLeave() {
      if (activeContribHoverIndex !== -1) {
        activeContribHoverIndex = -1;
        scheduleContribChartsRedraw();
      }
      const bTip = document.getElementById("breadthCrosshairTooltip");
      const nTip = document.getElementById("niftyCrosshairTooltip");
      if (bTip) bTip.style.display = "none";
      if (nTip) nTip.style.display = "none";

      const bStatus = document.getElementById("breadthCrosshairStatus");
      const nStatus = document.getElementById("niftyCrosshairStatus");
      if (bStatus) bStatus.textContent = "Active";
      if (nStatus) nStatus.textContent = "Locked";
    }

    function handleTouch(e, srcCanvas) {
      if (e.touches && e.touches.length > 0) {
        handleMouseMove(e.touches[0], srcCanvas);
      }
    }

    if (breadthCanvas) {
      breadthCanvas.addEventListener("mousemove", (e) => handleMouseMove(e, breadthCanvas));
      breadthCanvas.addEventListener("mouseleave", handleMouseLeave);
      breadthCanvas.addEventListener("touchstart", (e) => handleTouch(e, breadthCanvas), { passive: true });
      breadthCanvas.addEventListener("touchmove", (e) => handleTouch(e, breadthCanvas), { passive: true });
      breadthCanvas.addEventListener("touchend", handleMouseLeave);
    }

    if (niftyCanvas) {
      niftyCanvas.addEventListener("mousemove", (e) => handleMouseMove(e, niftyCanvas));
      niftyCanvas.addEventListener("mouseleave", handleMouseLeave);
      niftyCanvas.addEventListener("touchstart", (e) => handleTouch(e, niftyCanvas), { passive: true });
      niftyCanvas.addEventListener("touchmove", (e) => handleTouch(e, niftyCanvas), { passive: true });
      niftyCanvas.addEventListener("touchend", handleMouseLeave);
    }

    window.addEventListener("resize", () => {
      if (contribTimeline && contribTimeline.length > 0) {
        scheduleContribChartsRedraw();
      }
    });

    if (window.ResizeObserver) {
      const bWrapper = document.getElementById("breadthChartWrapper");
      const nWrapper = document.getElementById("niftyChartWrapper");
      if (bWrapper && !bWrapper._roAttached) {
        bWrapper._roAttached = true;
        const ro = new ResizeObserver(() => {
          if (contribTimeline && contribTimeline.length > 0) {
            scheduleContribChartsRedraw();
          }
        });
        ro.observe(bWrapper);
        if (nWrapper) ro.observe(nWrapper);
      }
    }
  }

  function updateContribTooltips(idx) {
    const bTip = document.getElementById("breadthCrosshairTooltip");
    const nTip = document.getElementById("niftyCrosshairTooltip");
    if (!contribTimeline || idx < 0 || idx >= contribTimeline.length) {
      if (bTip) bTip.style.display = "none";
      if (nTip) nTip.style.display = "none";
      return;
    }

    const pt = contribTimeline[idx];
    const displayDate = contribDataCache ? (contribDataCache.displayDate || contribDataCache.date) : "22-Sep-2026";
    const timeStr = pt.displayTime || (String(pt.time).includes("T") ? pt.time.split("T")[1].slice(0, 5) : pt.time);
    const maStr = pt.ma !== null && pt.ma !== undefined ? `${Number(pt.ma).toFixed(2)}%` : "--";
    const idxInfo = contribDataCache && contribDataCache.indexInfo ? contribDataCache.indexInfo : {};
    const idxName = idxInfo.name || "NIFTY 50";
    const sVal = Number(pt.spot !== undefined && pt.spot !== null ? pt.spot : pt.close);
    const vwapStr = pt.vwap ? Number(pt.vwap).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";

    // Update Header Status Badges with live hovered metrics
    const bStatus = document.getElementById("breadthCrosshairStatus");
    const nStatus = document.getElementById("niftyCrosshairStatus");
    if (bStatus) bStatus.textContent = `${timeStr} • ${Number(pt.breadth).toFixed(1)}%`;
    if (nStatus) nStatus.textContent = `${timeStr} • ₹${sVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    if (bTip && breadthChartGeom) {
      bTip.style.display = "block";
      const cx = breadthChartGeom.xFor(idx);
      const isLeftHalf = cx < (breadthChartGeom.plotW * 0.55);
      bTip.style.left = isLeftHalf ? `${cx + 18}px` : "auto";
      bTip.style.right = isLeftHalf ? "auto" : `${breadthChartGeom.w - cx + 18}px`;
      bTip.style.top = "16px";
      bTip.innerHTML = `
        <div style="font-weight:800; color:var(--p2-teal-light); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:6px; display:flex; justify-content:space-between;">
          <span>📅 ${displayDate}</span><span>⏱️ ${timeStr} IST</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#60a5fa;">Breadth %:</span> <strong class="font-mono">${Number(pt.breadth).toFixed(2)}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#f59e0b;">20 SMA:</span> <strong class="font-mono">${maStr}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#94a3b8;">X / O (Adv/Dec):</span> <strong class="font-mono">${pt.x} / ${pt.o}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:var(--p2-text-muted);">Net (Adv - Dec):</span> <strong class="font-mono ${pt.netAdvancers >= 0 ? 'text-green' : 'text-red'}">${pt.netAdvancers >= 0 ? '+' : ''}${pt.netAdvancers}</strong>
        </div>
      `;
    }

    if (nTip && niftyChartGeom) {
      nTip.style.display = "block";
      const cx = niftyChartGeom.xFor(idx);
      const isLeftHalf = cx < (niftyChartGeom.plotW * 0.55);
      nTip.style.left = isLeftHalf ? `${cx + 18}px` : "auto";
      nTip.style.right = isLeftHalf ? "auto" : `${niftyChartGeom.w - cx + 18}px`;
      nTip.style.top = "16px";
      nTip.innerHTML = `
        <div style="font-weight:800; color:var(--p2-teal-light); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:6px; display:flex; justify-content:space-between;">
          <span>📅 ${displayDate}</span><span>⏱️ ${timeStr} • ${idxName}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="color:#38bdf8;">Spot Price:</span> <strong class="font-mono">${sVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#f59e0b;">VWAP:</span> <strong class="font-mono">${vwapStr}</strong>
        </div>
      `;
    }
  }

  // ========================================================================
  // 🌐 GLOBAL MARKETS & MULTI-ASSET DESK CONTROLLER
  // ========================================================================
  function setupGlobalMarketsControls() {
    // 1. Sub-nav toggling between Global Markets and Straddle
    const gmBtn = document.getElementById("p2ToolGlobalMarketsBtn");
    const stBtn = document.getElementById("p2ToolStraddleBtn");
    const gmView = document.getElementById("p2ViewGlobalMarkets");
    const stView = document.getElementById("p2ViewStraddle");

    if (gmBtn && stBtn) {
      gmBtn.addEventListener("click", () => {
        setToolsSubView("global", true);
      });

      stBtn.addEventListener("click", () => {
        setToolsSubView("straddle", true);
      });
    }

    // 2. Category Filter Pills
    const catBtns = document.querySelectorAll(".gm-cat-btn");
    catBtns.forEach((b) => {
      b.addEventListener("click", () => {
        catBtns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        currentGmCategory = b.getAttribute("data-cat") || "all";
        renderFilteredGlobalAssets();
      });
    });

    // 3. Search Filter
    const searchInput = document.getElementById("gmSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        gmSearchQuery = (e.target.value || "").toLowerCase().trim();
        renderFilteredGlobalAssets();
      });
    }

    // 4. View Switcher (Grid vs List vs Table)
    const cardsBtn = document.getElementById("gmViewCardsBtn");
    const listBtn = document.getElementById("gmViewListBtn");
    const tableBtn = document.getElementById("gmViewTableBtn");
    const cardsGrid = document.getElementById("gmCardsGrid");
    const tableWrap = document.getElementById("gmTableWrapper");

    if (cardsBtn && tableBtn && cardsGrid && tableWrap) {
      cardsBtn.addEventListener("click", () => {
        currentGmView = "cards";
        cardsBtn.classList.add("active");
        if (listBtn) listBtn.classList.remove("active");
        tableBtn.classList.remove("active");
        cardsGrid.classList.remove("gm-list-view");
        cardsGrid.style.display = "grid";
        tableWrap.style.display = "none";
      });

      if (listBtn) {
        listBtn.addEventListener("click", () => {
          currentGmView = "list";
          listBtn.classList.add("active");
          cardsBtn.classList.remove("active");
          tableBtn.classList.remove("active");
          cardsGrid.classList.add("gm-list-view");
          cardsGrid.style.display = "grid";
          tableWrap.style.display = "none";
        });
      }

      tableBtn.addEventListener("click", () => {
        currentGmView = "table";
        tableBtn.classList.add("active");
        cardsBtn.classList.remove("active");
        if (listBtn) listBtn.classList.remove("active");
        cardsGrid.style.display = "none";
        tableWrap.style.display = "block";
      });
    }

    // 5. Refresh Buttons & Auto-Refresh Interval
    const refreshBtn = document.getElementById("gmRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        loadGlobalMarketsSuite(false);
      });
    }

    const exportBtn = document.getElementById("gmExportCsvBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", exportGlobalMarketsCsv);
    }

    // Auto-refresh interval (5 seconds)
    if (gmAutoRefreshTimer) clearInterval(gmAutoRefreshTimer);
    gmAutoRefreshTimer = setInterval(() => {
      const autoBox = document.getElementById("gmAutoRefresh");
      if (
        autoBox &&
        autoBox.checked &&
        currentSuite === "tools" &&
        currentToolsSubView === "global"
      ) {
        loadGlobalMarketsSuite(true);
      }
    }, 5000);
  }

  async function loadGlobalMarketsSuite(isSilent = false) {
    try {
      const res = await fetch(`/api/global-markets?category=all`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || !json.ok) throw new Error("Invalid response");

      gmCachedData = json;
      updateGlobalMacroStrip(json.headlineMetrics);
      updateCategoryBadges(json.categorySummary, json.totalAssets);
      renderFilteredGlobalAssets();

      const clockEl = document.getElementById("gmDeskStatusText");
      if (clockEl && json.asOf) {
        clockEl.textContent = `UPDATED ${json.asOf}`;
      }
    } catch (err) {
      console.error("Failed to load global markets suite:", err);
      if (!isSilent) {
        const grid = document.getElementById("gmCardsGrid");
        if (grid) {
          grid.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--p2-red);">
            Failed to connect to Global Markets Engine. Please check server connection.
          </div>`;
        }
      }
    }
  }

  function updateGlobalMacroStrip(metrics) {
    const strip = document.getElementById("gmMacroStrip");
    if (!strip || !metrics) return;

    const cardsData = [
      {
        title: "GIFT NIFTY",
        sub: "NSE IX FUTURES",
        flag: "🇮🇳",
        val: Number(metrics.giftNifty.ltp).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
        chg: metrics.giftNifty.change,
        pct: metrics.giftNifty.changePct,
        unit: "pts"
      },
      {
        title: "BRENT CRUDE",
        sub: "COMMODITY OIL",
        flag: "🛢️",
        val: `$${Number(metrics.brentCrude.ltp).toFixed(2)}`,
        chg: metrics.brentCrude.change,
        pct: metrics.brentCrude.changePct,
        unit: "/bbl"
      },
      {
        title: "GOLD SPOT",
        sub: "PRECIOUS METAL",
        flag: "🟡",
        val: `$${Number(metrics.gold.ltp).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        chg: metrics.gold.change,
        pct: metrics.gold.changePct,
        unit: "/oz"
      },
      {
        title: "US 10Y BENCHMARK",
        sub: "SOVEREIGN YIELD",
        flag: "🇺🇸",
        val: `${Number(metrics.us10y.ltp).toFixed(2)}%`,
        chg: metrics.us10y.change,
        pct: metrics.us10y.changePct,
        unit: "pts"
      },
      {
        title: "US DOLLAR INDEX",
        sub: "DXY CURRENCY BASKET",
        flag: "💵",
        val: Number(metrics.dxy.ltp).toFixed(2),
        chg: metrics.dxy.change,
        pct: metrics.dxy.changePct,
        unit: "pts"
      },
      {
        title: "BITCOIN SPOT",
        sub: "CRYPTO LEADER",
        flag: "₿",
        val: `$${Number(metrics.btc.ltp).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        chg: metrics.btc.change,
        pct: metrics.btc.changePct,
        unit: "USD"
      }
    ];

    strip.innerHTML = cardsData.map((c) => {
      const isPos = c.chg >= 0;
      const chgClass = isPos ? "text-green" : "text-red";
      const sign = isPos ? "+" : "";
      return `
        <div class="gm-macro-card">
          <div class="gm-macro-top">
            <span>${c.flag} ${c.title}</span>
            <span style="font-size:10px; opacity:0.8;">${c.sub}</span>
          </div>
          <div class="gm-macro-price">${c.val}</div>
          <div class="gm-macro-bottom">
            <span class="${chgClass}">${sign}${c.chg.toFixed(2)} (${sign}${c.pct.toFixed(2)}%)</span>
            <span style="color:var(--p2-text-dim);">${c.unit}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function updateCategoryBadges(summary, totalCount) {
    if (totalCount !== undefined) {
      const el = document.getElementById("countAll");
      if (el) el.textContent = totalCount;
    }
    if (!summary) return;

    const map = {
      indices: "countIndices",
      currency: "countCurrency",
      commodity: "countCommodity",
      crypto: "countCrypto",
      bonds: "countBonds",
      adr: "countAdr"
    };

    Object.keys(map).forEach((k) => {
      const el = document.getElementById(map[k]);
      if (el && summary[k]) {
        el.textContent = summary[k].count;
      }
    });
  }

  function renderFilteredGlobalAssets() {
    if (!gmCachedData || !gmCachedData.assets) return;

    let items = gmCachedData.assets;

    // Filter by Category
    if (currentGmCategory !== "all") {
      items = items.filter((x) => x.category === currentGmCategory);
    }

    // Filter by Search Query
    if (gmSearchQuery) {
      items = items.filter((x) => {
        const sym = (x.symbol || "").toLowerCase();
        const name = (x.name || "").toLowerCase();
        const country = (x.country || "").toLowerCase();
        return sym.includes(gmSearchQuery) || name.includes(gmSearchQuery) || country.includes(gmSearchQuery);
      });
    }

    renderGlobalCards(items);
    renderGlobalTable(items);
  }

  function renderGlobalCards(items) {
    const grid = document.getElementById("gmCardsGrid");
    if (!grid) return;

    if (!items || items.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; padding:40px; text-align:center; color:var(--p2-text-muted);">
        No assets found matching your criteria.
      </div>`;
      return;
    }

    grid.innerHTML = items.map((asset) => {
      const isPos = asset.change >= 0;
      const chgClass = isPos ? "text-green" : "text-red";
      const sign = isPos ? "+" : "";

      // Market Status Badge Class
      let statusClass = "open";
      if (asset.marketStatus === "CLOSED") statusClass = "closed";
      else if (asset.marketStatus === "24/7 LIVE") statusClass = "live";

      // Price Formatting
      let ltpFormatted = formatAssetPrice(asset.ltp, asset.category, asset.currency);

      // Flash determination
      const prevPrice = gmPreviousPrices[asset.id];
      let flashClass = "";
      if (prevPrice !== undefined) {
        if (asset.ltp > prevPrice) flashClass = "flash-green";
        else if (asset.ltp < prevPrice) flashClass = "flash-red";
      }
      gmPreviousPrices[asset.id] = asset.ltp;

      // Day Range calculation
      const daySpread = asset.high - asset.low;
      const dayPct = daySpread > 0 ? Math.min(100, Math.max(0, ((asset.ltp - asset.low) / daySpread) * 100)) : 50;

      // 52W Range calculation
      const w52Spread = asset.week52High - asset.week52Low;
      const w52Pct = w52Spread > 0 ? Math.min(100, Math.max(0, ((asset.ltp - asset.week52Low) / w52Spread) * 100)) : 50;

      // Sparkline SVG
      const sparkSvg = generateSparklineSvg(asset.sparkline, isPos, 140, 36);

      return `
        <div class="gm-card" id="gmCard_${asset.id}">
          <div class="gm-card-header">
            <div class="gm-card-title-group">
              <div class="gm-card-symbol-line">
                <span class="gm-card-flag">${asset.flag || "🌐"}</span>
                <span class="gm-card-symbol">${asset.symbol}</span>
              </div>
              <div class="gm-card-name" title="${asset.name}">${asset.name}</div>
            </div>
            <span class="gm-status-pill ${statusClass}">${asset.marketStatus}</span>
          </div>

          <div class="gm-card-price-row">
            <div class="gm-card-ltp ${flashClass}">${ltpFormatted}</div>
            <div class="gm-card-chg-wrap ${chgClass}">
              <div class="gm-card-chg-val">${sign}${Number(asset.change).toFixed(2)}</div>
              <div class="gm-card-chg-pct">${sign}${Number(asset.changePct).toFixed(2)}%</div>
            </div>
          </div>

          <div class="gm-sparkline-wrap">
            ${sparkSvg}
          </div>

          <div class="gm-range-group">
            <div class="gm-range-bar-box">
              <div class="gm-range-labels">
                <span class="gm-range-tag">Day Range</span>
                <span>L: ${formatCompactPrice(asset.low)} &nbsp;|&nbsp; H: ${formatCompactPrice(asset.high)}</span>
              </div>
              <div class="gm-range-track">
                <div class="gm-range-fill ${!isPos ? 'bearish' : ''}" style="width:${dayPct.toFixed(1)}%;"></div>
              </div>
            </div>

            <div class="gm-range-bar-box">
              <div class="gm-range-labels">
                <span class="gm-range-tag">52W Range</span>
                <span>L: ${formatCompactPrice(asset.week52Low)} &nbsp;|&nbsp; H: ${formatCompactPrice(asset.week52High)}</span>
              </div>
              <div class="gm-range-track">
                <div class="gm-range-fill ${!isPos ? 'bearish' : ''}" style="width:${w52Pct.toFixed(1)}%;"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Clear flash classes after 800ms
    setTimeout(() => {
      document.querySelectorAll(".gm-card-ltp.flash-green, .gm-card-ltp.flash-red").forEach((el) => {
        el.classList.remove("flash-green", "flash-red");
      });
    }, 800);
  }

  function renderGlobalTable(items) {
    const tbody = document.getElementById("tbodyGlobalMarkets");
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--p2-text-muted);">No assets available</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((asset) => {
      const isPos = asset.change >= 0;
      const chgClass = isPos ? "text-green" : "text-red";
      const sign = isPos ? "+" : "";

      let statusClass = "open";
      if (asset.marketStatus === "CLOSED") statusClass = "closed";
      else if (asset.marketStatus === "24/7 LIVE") statusClass = "live";

      const ltpFormatted = formatAssetPrice(asset.ltp, asset.category, asset.currency);

      const daySpread = asset.high - asset.low;
      const dayPct = daySpread > 0 ? Math.min(100, Math.max(0, ((asset.ltp - asset.low) / daySpread) * 100)) : 50;

      const sparkSvg = generateSparklineSvg(asset.sparkline, isPos, 90, 24);

      return `
        <tr>
          <td>
            <div class="gm-table-flag-col">
              <span style="font-size:16px;">${asset.flag || "🌐"}</span>
              <div>
                <div class="gm-table-symbol">${asset.symbol}</div>
                <div class="gm-table-name">${asset.name}</div>
              </div>
            </div>
          </td>
          <td><span class="p2-badge p2-badge-teal">${(asset.category || "").toUpperCase()}</span></td>
          <td><span class="gm-status-pill ${statusClass}">${asset.marketStatus}</span></td>
          <td class="text-right font-mono font-bold" style="font-size:14px;">${ltpFormatted}</td>
          <td class="text-right font-mono ${chgClass}">${sign}${Number(asset.change).toFixed(2)}</td>
          <td class="text-right font-mono ${chgClass} font-bold">${sign}${Number(asset.changePct).toFixed(2)}%</td>
          <td>
            <div class="gm-table-range-cell">
              <div style="display:flex; justify-content:space-between; font-size:9px; font-family:var(--font-mono); color:var(--p2-text-dim);">
                <span>${formatCompactPrice(asset.low)}</span>
                <span>${formatCompactPrice(asset.high)}</span>
              </div>
              <div class="gm-table-range-track">
                <div class="gm-range-fill ${!isPos ? 'bearish' : ''}" style="width:${dayPct.toFixed(1)}%;"></div>
              </div>
            </div>
          </td>
          <td class="text-center font-mono" style="font-size:11px; color:var(--p2-text-muted);">
            ${formatCompactPrice(asset.week52Low)} - ${formatCompactPrice(asset.week52High)}
          </td>
          <td>
            <div class="gm-table-sparkline-cell">${sparkSvg}</div>
          </td>
          <td class="text-right font-mono" style="color:var(--p2-text-muted);">${formatCompactPrice(asset.prevClose)}</td>
        </tr>
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

  function generateSparklineSvg(pts, isPositive, width = 120, height = 30) {
    if (!pts || pts.length < 2) return "";

    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const padding = 4;
    const h = height - padding * 2;
    const w = width;

    const coords = pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = height - padding - ((p - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const color = isPositive ? "#10b981" : "#f43f5e";
    const fillId = `gmGrad_${Math.floor(Math.random() * 1000000)}`;

    const polylineStr = coords.join(" ");
    const areaStr = `0,${height} ${coords.join(" ")} ${w},${height}`;

    return `
      <svg viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" style="width:100%; height:100%; overflow:visible;">
        <defs>
          <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.25" />
            <stop offset="100%" stop-color="${color}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points="${areaStr}" fill="url(#${fillId})" />
        <polyline points="${polylineStr}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }

  function exportGlobalMarketsCsv() {
    if (!gmCachedData || !gmCachedData.assets) return;
    const items = gmCachedData.assets;
    const headers = ["Symbol", "Name", "Category", "Country", "Market Status", "LTP", "Change", "Change Pct", "Day Low", "Day High", "52W Low", "52W High", "Prev Close"];
    const rows = items.map((x) => [
      `"${x.symbol}"`,
      `"${x.name}"`,
      x.category,
      `"${x.country}"`,
      x.marketStatus,
      x.ltp,
      x.change,
      x.changePct,
      x.low,
      x.high,
      x.week52Low,
      x.week52High,
      x.prevClose
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Global_Markets_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

})();




// 6-Dot Mobile & Desktop App Launcher Directory
window.openMobileDotMenu = function() {
  const modal = document.getElementById("mobileDotMenuModal");
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
};

window.closeMobileDotMenu = function() {
  const modal = document.getElementById("mobileDotMenuModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
};

window.dotNavClick = function(e, key, subview) {
  closeMobileDotMenu();
  if (window.instNavClick && typeof window.instNavClick === "function") {
    return window.instNavClick(e, key, subview);
  } else if (window.activateSuite && typeof window.activateSuite === "function") {
    if (key === "straddle") {
      activateSuite("straddle");
      return false;
    } else if (key === "contribution") {
      activateSuite("contribution");
      return false;
    }
    return true;
  }
  return true;
};

// Close on Escape key
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    if (window.closeMobileDotMenu) window.closeMobileDotMenu();
  }
});


// Page 2: Mobile Dropdown Toggle Handler
document.addEventListener("DOMContentLoaded", function() {
  const nav = document.getElementById("mainInstNav") || document.querySelector(".inst-nav");
  if (!nav) return;

  nav.querySelectorAll(".has-dropdown").forEach(function(item) {
    const btn = item.querySelector(".inst-nav-btn");
    if (btn) {
      btn.addEventListener("click", function(e) {
        const isMobile = window.innerWidth <= 860 || ("ontouchstart" in window);
        if (!isMobile) return;

        if (!item.classList.contains("mobile-open")) {
          e.preventDefault();
          e.stopPropagation();
          nav.querySelectorAll(".has-dropdown.mobile-open").forEach(function(other) {
            if (other !== item) other.classList.remove("mobile-open");
          });
          item.classList.add("mobile-open");
        } else {
          item.classList.remove("mobile-open");
        }
      });
    }

    item.querySelectorAll(".inst-dd-item").forEach(function(subItem) {
      subItem.addEventListener("click", function() {
        item.classList.remove("mobile-open");
      });
    });
  });

  document.addEventListener("click", function(e) {
    if (window.innerWidth <= 860 || ("ontouchstart" in window)) {
      const openItem = document.querySelector(".has-dropdown.mobile-open");
      if (openItem && !openItem.contains(e.target)) {
        openItem.classList.remove("mobile-open");
      }
    }
  });
});
