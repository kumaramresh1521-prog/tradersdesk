# SIP & Lumpsum Wealth Calculator

Plan your financial journey with institutional precision. Whether investing monthly via a **Systematic Investment Plan (SIP)** or deploying a **One-Time Lumpsum**, this compounding engine calculates your future wealth accumulation, capital appreciation, and year-by-year corpus progression.

---

<div class="td-modern-calc" id="tdModernCalc">
  <style>
    /* ==========================================================================
       MODERN FINTECH CALCULATOR DESIGN SYSTEM
       Theme Agnostic: Flawless in both Day Mode (Light) & Night Mode (Dark)
       ========================================================================== */
    .td-modern-calc {
      --calc-bg: #ffffff;
      --calc-card-bg: #f8fafc;
      --calc-card-border: #e2e8f0;
      --calc-title: #0f172a;
      --calc-text: #334155;
      --calc-muted: #64748b;
      --calc-subtle: #94a3b8;
      --calc-input-bg: #ffffff;
      --calc-input-border: #cbd5e1;
      --calc-active-tab-bg: #0284c7;
      --calc-active-tab-text: #ffffff;
      --calc-tab-bg: #f1f5f9;
      --calc-chip-bg: #f1f5f9;
      --calc-chip-hover: #e2e8f0;
      --calc-chip-text: #475569;
      --calc-invested-color: #0284c7;
      --calc-invested-bg: #f0f9ff;
      --calc-invested-border: #bae6fd;
      --calc-returns-color: #059669;
      --calc-returns-bg: #ecfdf5;
      --calc-returns-border: #a7f3d0;
      --calc-total-color: #6366f1;
      --calc-total-bg: #f5f3ff;
      --calc-total-border: #ddd6fe;
      --calc-track-bg: #e2e8f0;
      --calc-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 4px 12px -2px rgba(0, 0, 0, 0.03);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--calc-bg);
      border: 1px solid var(--calc-card-border);
      border-radius: 20px;
      padding: 32px 32px 42px 32px;
      margin: 28px 0;
      color: var(--calc-text);
      box-shadow: var(--calc-shadow);
      transition: background 0.25s ease, border-color 0.25s ease;
    }

    html:not([data-theme="light"]) .td-modern-calc,
    [data-theme="dark"] .td-modern-calc {
      --calc-bg: #090f20;
      --calc-card-bg: #0e172e;
      --calc-card-border: rgba(255, 255, 255, 0.09);
      --calc-title: #f8fafc;
      --calc-text: #cbd5e1;
      --calc-muted: #94a3b8;
      --calc-subtle: #64748b;
      --calc-input-bg: rgba(3, 7, 18, 0.75);
      --calc-input-border: rgba(56, 189, 248, 0.35);
      --calc-active-tab-bg: #0284c7;
      --calc-active-tab-text: #ffffff;
      --calc-tab-bg: rgba(15, 23, 42, 0.9);
      --calc-chip-bg: rgba(255, 255, 255, 0.05);
      --calc-chip-hover: rgba(255, 255, 255, 0.12);
      --calc-chip-text: #94a3b8;
      --calc-invested-color: #38bdf8;
      --calc-invested-bg: rgba(14, 165, 233, 0.1);
      --calc-invested-border: rgba(14, 165, 233, 0.28);
      --calc-returns-color: #34d399;
      --calc-returns-bg: rgba(16, 185, 129, 0.1);
      --calc-returns-border: rgba(16, 185, 129, 0.28);
      --calc-total-color: #a78bfa;
      --calc-total-bg: rgba(139, 92, 246, 0.1);
      --calc-total-border: rgba(139, 92, 246, 0.28);
      --calc-track-bg: rgba(255, 255, 255, 0.12);
      --calc-shadow: 0 16px 45px -10px rgba(0, 0, 0, 0.7);
    }

    /* Header & Mode Switcher */
    .td-calc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 28px;
      border-bottom: 1px solid var(--calc-card-border);
      padding-bottom: 20px;
    }
    .td-calc-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 20px;
      background: var(--calc-invested-bg);
      color: var(--calc-invested-color);
      border: 1px solid var(--calc-invested-border);
    }
    .td-calc-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--calc-title);
      margin: 6px 0 0 0;
      letter-spacing: -0.02em;
    }
    .td-calc-switcher {
      display: flex;
      background: var(--calc-tab-bg);
      border: 1px solid var(--calc-card-border);
      border-radius: 12px;
      padding: 4px;
      gap: 4px;
    }
    .td-calc-switch-btn {
      padding: 10px 22px;
      border-radius: 9px;
      border: none;
      background: transparent;
      color: var(--calc-muted);
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .td-calc-switch-btn:hover {
      color: var(--calc-title);
    }
    .td-modern-calc .td-calc-switch-btn.active,
    .td-modern-calc .td-calc-switch-btn.active * {
      background: #0284c7 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
    }

    /* Main Grid: Left Controls, Right Chart */
    .td-calc-layout {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 36px;
      align-items: start;
    }
    @media (max-width: 920px) {
      .td-modern-calc { padding: 22px 18px; }
      .td-calc-layout { grid-template-columns: 1fr; gap: 28px; }
    }

    /* Input Group */
    .td-calc-field {
      margin-bottom: 24px;
    }
    .td-calc-field-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .td-calc-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--calc-title);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .td-calc-input-pill {
      display: inline-flex;
      align-items: center;
      background: var(--calc-input-bg);
      border: 1.5px solid var(--calc-input-border);
      border-radius: 10px;
      padding: 7px 14px;
      min-width: 165px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      box-sizing: border-box;
    }
    .td-calc-input-pill:focus-within {
      border-color: var(--calc-active-tab-bg);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
    .td-calc-prefix {
      font-size: 15px;
      font-weight: 700;
      color: var(--calc-invested-color);
      margin-right: 4px;
      user-select: none;
    }
    .td-calc-num-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 16px;
      font-weight: 700;
      color: var(--calc-title);
      width: 100%;
      min-width: 90px;
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      -moz-appearance: textfield !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .td-calc-num-input::-webkit-outer-spin-button,
    .td-calc-num-input::-webkit-inner-spin-button {
      -webkit-appearance: none !important;
      margin: 0 !important;
    }

    /* Custom Slider */
    .td-calc-slider-wrap {
      position: relative;
      margin: 12px 0 10px 0;
    }
    .td-range-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 7px;
      border-radius: 7px;
      outline: none;
      cursor: pointer;
      background: var(--calc-track-bg);
      transition: background 0.15s ease;
    }
    .td-range-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #ffffff;
      border: 3.5px solid #0284c7;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .td-range-slider::-webkit-slider-thumb:hover {
      transform: scale(1.15);
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.45);
    }
    .td-range-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #ffffff;
      border: 3.5px solid #0284c7;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      cursor: pointer;
    }

    /* Quick Suggestion Chips */
    .td-calc-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .td-calc-chip {
      background: var(--calc-chip-bg);
      border: 1px solid var(--calc-card-border);
      border-radius: 14px;
      padding: 3px 10px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--calc-chip-text);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .td-calc-chip:hover {
      background: var(--calc-chip-hover);
      color: var(--calc-title);
      border-color: #0284c7;
    }

    /* Step-Up Toggle Box */
    .td-calc-stepup-box {
      background: var(--calc-card-bg);
      border: 1px solid var(--calc-card-border);
      border-radius: 12px;
      padding: 14px 18px;
      margin-top: 6px;
      transition: all 0.2s ease;
    }
    .td-calc-stepup-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .td-calc-stepup-info {
      display: flex;
      flex-direction: column;
    }
    .td-calc-stepup-title {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--calc-title);
    }
    .td-calc-stepup-sub {
      font-size: 11.5px;
      color: var(--calc-muted);
      margin-top: 2px;
    }
    .td-toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }
    .td-toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .td-toggle-slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background-color: var(--calc-track-bg);
      border-radius: 24px;
      transition: .25s;
    }
    .td-toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      border-radius: 50%;
      transition: .25s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .td-toggle-switch input:checked + .td-toggle-slider {
      background-color: #0284c7;
    }
    .td-toggle-switch input:checked + .td-toggle-slider:before {
      transform: translateX(20px);
    }

    /* Right Column: Chart & Result Dashboard */
    .td-calc-dashboard {
      background: var(--calc-card-bg);
      border: 1px solid var(--calc-card-border);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
    }

    /* Circular SVG Donut Chart */
    .td-donut-wrapper {
      position: relative;
      width: 220px;
      height: 220px;
      margin: 10px auto 22px auto;
    }
    .td-donut-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .td-donut-circle-bg {
      fill: none;
      stroke: var(--calc-track-bg);
      stroke-width: 22;
    }
    .td-donut-circle-invested {
      fill: none;
      stroke: var(--calc-invested-color);
      stroke-width: 22;
      stroke-linecap: round;
      transition: stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease;
    }
    .td-donut-circle-gain {
      fill: none;
      stroke: var(--calc-returns-color);
      stroke-width: 22;
      stroke-linecap: round;
      transition: stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease;
    }
    .td-donut-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      pointer-events: none;
    }
    .td-donut-center-sub {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--calc-muted);
    }
    .td-donut-center-val {
      font-size: 20px;
      font-weight: 800;
      color: var(--calc-title);
      margin: 3px 0;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.02em;
    }
    .td-donut-center-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--calc-returns-bg);
      color: var(--calc-returns-color);
      border: 1px solid var(--calc-returns-border);
    }

    /* Result Breakdown Cards */
    .td-result-cards {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .td-result-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--calc-bg);
      border: 1px solid var(--calc-card-border);
      transition: transform 0.15s ease;
    }
    .td-result-row:hover {
      transform: translateX(2px);
    }
    .td-result-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .td-result-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .td-result-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--calc-text);
    }
    .td-result-pct {
      font-size: 11px;
      color: var(--calc-muted);
      margin-left: 4px;
    }
    .td-result-val {
      font-size: 15px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: var(--calc-title);
    }

    /* Maturity Highlight Card */
    .td-maturity-banner {
      width: 100%;
      margin-top: 14px;
      padding: 14px 18px;
      border-radius: 12px;
      background: var(--calc-total-bg);
      border: 1px solid var(--calc-total-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
    }
    .td-maturity-title {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--calc-total-color);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .td-maturity-val {
      font-size: 20px;
      font-weight: 800;
      color: var(--calc-total-color);
      font-family: 'JetBrains Mono', monospace;
    }

    /* Inflation note */
    .td-inflation-tag {
      font-size: 11px;
      color: var(--calc-muted);
      text-align: center;
      margin-top: 12px;
      line-height: 1.4;
    }

    /* Bottom Compounding Schedule Button & Table */
    .td-calc-footer-action {
      margin: 36px 0 10px 0;
      display: flex;
      justify-content: center;
    }
    .td-modern-calc .td-schedule-btn,
    .td-modern-calc .td-schedule-btn * {
      background: #0284c7 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      border: none !important;
      padding: 12px 28px !important;
      border-radius: 10px !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3) !important;
      transition: all 0.2s ease !important;
    }
    .td-modern-calc .td-schedule-btn:hover {
      background: #0369a1 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 6px 20px rgba(2, 132, 199, 0.45) !important;
    }
    .td-schedule-pane {
      display: none;
      margin-top: 24px;
      border-top: 1px solid var(--calc-card-border);
      padding-top: 24px;
      overflow-x: auto;
    }
    .td-schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: right;
    }
    .td-schedule-table th {
      background: var(--calc-tab-bg);
      color: var(--calc-title);
      padding: 10px 14px;
      font-weight: 700;
      border: 1px solid var(--calc-card-border);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.04em;
    }
    .td-schedule-table td {
      padding: 10px 14px;
      border: 1px solid var(--calc-card-border);
      color: var(--calc-text);
      font-family: 'JetBrains Mono', monospace;
    }
    .td-schedule-table tr:nth-child(even) {
      background: var(--calc-card-bg);
    }
    .td-schedule-table tr:hover td {
      background: var(--calc-invested-bg);
      color: var(--calc-title);
    }
  </style>

  <!-- CALCULATOR HEADER -->
  <div class="td-calc-header">
    <div>
      <span class="td-calc-badge">⚡ Institutional Compounding Suite</span>
      <h2 class="td-calc-title">Wealth Growth &amp; Compounding Simulator</h2>
    </div>
    <!-- Mode Switcher -->
    <div class="td-calc-switcher">
      <button type="button" class="td-calc-switch-btn active" id="btnModeSip" onclick="tdSetMode('sip')">
        🚀 Monthly SIP
      </button>
      <button type="button" class="td-calc-switch-btn" id="btnModeLump" onclick="tdSetMode('lump')">
        💰 One-Time Lumpsum
      </button>
    </div>
  </div>

  <!-- CALCULATOR LAYOUT -->
  <div class="td-calc-layout">
    
    <!-- LEFT CONTROLS -->
    <div class="td-calc-controls">
      
      <!-- FIELD 1: Amount -->
      <div class="td-calc-field">
        <div class="td-calc-field-top">
          <label class="td-calc-label" id="lblAmount">Monthly Investment</label>
          <div class="td-calc-input-pill">
            <span class="td-calc-prefix">₹</span>
            <input type="number" id="inputAmount" class="td-calc-num-input" value="10000" min="500" max="10000000" step="500" oninput="tdOnAmountInput(this.value)" />
          </div>
        </div>
        <div class="td-calc-slider-wrap">
          <input type="range" id="sliderAmount" class="td-range-slider" min="500" max="500000" step="500" value="10000" oninput="tdOnAmountSlider(this.value)" />
        </div>
        <!-- Quick Chips -->
        <div class="td-calc-chips" id="chipsAmount">
          <span class="td-calc-chip" onclick="tdSetAmount(5000)">₹5,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(10000)">₹10,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(25000)">₹25,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(50000)">₹50,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(100000)">₹1 Lakh</span>
        </div>
      </div>

      <!-- FIELD 2: Expected Return Rate -->
      <div class="td-calc-field">
        <div class="td-calc-field-top">
          <label class="td-calc-label">Expected Annual Return (CAGR)</label>
          <div class="td-calc-input-pill">
            <input type="number" id="inputRate" class="td-calc-num-input" value="12.0" min="1" max="35" step="0.5" oninput="tdOnRateInput(this.value)" />
            <span class="td-calc-prefix" style="margin-right:0; margin-left:4px;">%</span>
          </div>
        </div>
        <div class="td-calc-slider-wrap">
          <input type="range" id="sliderRate" class="td-range-slider" min="1" max="30" step="0.5" value="12.0" oninput="tdOnRateSlider(this.value)" />
        </div>
        <!-- Quick Chips -->
        <div class="td-calc-chips">
          <span class="td-calc-chip" onclick="tdSetRate(8.0)">8% (Debt/FD)</span>
          <span class="td-calc-chip" onclick="tdSetRate(12.0)">12% (Nifty 50)</span>
          <span class="td-calc-chip" onclick="tdSetRate(14.5)">14.5% (Flexicap)</span>
          <span class="td-calc-chip" onclick="tdSetRate(18.0)">18% (Aggressive)</span>
        </div>
      </div>

      <!-- FIELD 3: Time Horizon -->
      <div class="td-calc-field">
        <div class="td-calc-field-top">
          <label class="td-calc-label">Investment Horizon</label>
          <div class="td-calc-input-pill">
            <input type="number" id="inputYears" class="td-calc-num-input" value="10" min="1" max="40" step="1" oninput="tdOnYearsInput(this.value)" />
            <span class="td-calc-prefix" style="margin-right:0; margin-left:4px; font-size:13px;">Yr</span>
          </div>
        </div>
        <div class="td-calc-slider-wrap">
          <input type="range" id="sliderYears" class="td-range-slider" min="1" max="35" step="1" value="10" oninput="tdOnYearsSlider(this.value)" />
        </div>
        <!-- Quick Chips -->
        <div class="td-calc-chips">
          <span class="td-calc-chip" onclick="tdSetYears(5)">5 Yrs</span>
          <span class="td-calc-chip" onclick="tdSetYears(10)">10 Yrs</span>
          <span class="td-calc-chip" onclick="tdSetYears(15)">15 Yrs</span>
          <span class="td-calc-chip" onclick="tdSetYears(20)">20 Yrs</span>
          <span class="td-calc-chip" onclick="tdSetYears(25)">25 Yrs</span>
        </div>
      </div>

      <!-- FIELD 4: Annual Step-Up Option (SIP Mode Only) -->
      <div class="td-calc-stepup-box" id="boxStepUp">
        <div class="td-calc-stepup-row" onclick="tdToggleStepUp()">
          <div class="td-calc-stepup-info">
            <span class="td-calc-stepup-title">📈 Annual Step-Up Top-up</span>
            <span class="td-calc-stepup-sub">Increase monthly SIP as your annual salary grows</span>
          </div>
          <label class="td-toggle-switch" onclick="event.stopPropagation()">
            <input type="checkbox" id="chkStepUp" onchange="tdOnStepUpToggle(this.checked)" />
            <span class="td-toggle-slider"></span>
          </label>
        </div>
        <div id="stepUpDetails" style="display:none; margin-top:14px; border-top:1px dashed var(--calc-card-border); padding-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:12.5px; color:var(--calc-muted);">Annual Increment Percentage:</span>
            <span id="txtStepUpPct" style="font-weight:700; color:#0284c7; font-family:'JetBrains Mono', monospace;">10% / year</span>
          </div>
          <input type="range" id="sliderStepUp" class="td-range-slider" min="1" max="25" step="1" value="10" oninput="tdOnStepUpSlider(this.value)" />
        </div>
      </div>

    </div>

    <!-- RIGHT DASHBOARD: CIRCULAR DONUT & METRIC CARDS -->
    <div class="td-calc-dashboard">
      
      <!-- SVG Donut Chart -->
      <div class="td-donut-wrapper">
        <svg class="td-donut-svg" viewBox="0 0 200 200">
          <circle class="td-donut-circle-bg" cx="100" cy="100" r="80"></circle>
          <circle id="donutInvested" class="td-donut-circle-invested" cx="100" cy="100" r="80" stroke-dasharray="0 502.65" stroke-dashoffset="0"></circle>
          <circle id="donutGain" class="td-donut-circle-gain" cx="100" cy="100" r="80" stroke-dasharray="0 502.65" stroke-dashoffset="0"></circle>
        </svg>
        <div class="td-donut-center">
          <span class="td-donut-center-sub">TOTAL MATURITY</span>
          <span class="td-donut-center-val" id="donutTotalVal">₹23.2 L</span>
          <span class="td-donut-center-badge" id="donutMultiplier">2.0x Multiplier</span>
        </div>
      </div>

      <!-- Result Cards -->
      <div class="td-result-cards">
        
        <!-- Invested -->
        <div class="td-result-row">
          <div class="td-result-left">
            <span class="td-result-dot" style="background:var(--calc-invested-color);"></span>
            <span class="td-result-label">Invested Capital</span>
            <span class="td-result-pct" id="pctInvested">(51.6%)</span>
          </div>
          <span class="td-result-val" id="valInvested">₹12,00,000</span>
        </div>

        <!-- Wealth Gain -->
        <div class="td-result-row">
          <div class="td-result-left">
            <span class="td-result-dot" style="background:var(--calc-returns-color);"></span>
            <span class="td-result-label">Est. Compounded Gain</span>
            <span class="td-result-pct" id="pctGain">(48.4%)</span>
          </div>
          <span class="td-result-val" style="color:var(--calc-returns-color);" id="valGain">+₹11,23,391</span>
        </div>

        <!-- Total Future Value Banner -->
        <div class="td-maturity-banner">
          <div>
            <div class="td-maturity-title">Total Corpus Value</div>
            <div style="font-size:11px; color:var(--calc-muted); margin-top:2px;" id="txtHorizonSubtitle">After 10 Years @ 12% CAGR</div>
          </div>
          <div class="td-maturity-val" id="valTotal">₹23,23,391</div>
        </div>

      </div>

      <!-- Inflation Purchasing Power Note -->
      <div class="td-inflation-tag" id="txtInflationNote">
        🛒 Estimated real purchasing power after 6% annual inflation: <strong>₹12.9 Lakh</strong>
      </div>

    </div>

  </div>

  <!-- BOTTOM SCHEDULE TOGGLE -->
  <div class="td-calc-footer-action">
    <button type="button" class="td-schedule-btn" onclick="tdToggleSchedule()">
      📊 View Year-by-Year Growth Table &amp; Breakdown
    </button>
  </div>

  <!-- EXPANDABLE YEARLY SCHEDULE TABLE -->
  <div class="td-schedule-pane" id="paneSchedule">
    <table class="td-schedule-table">
      <thead>
        <tr>
          <th style="text-align:left;">Year</th>
          <th>Annual Contribution</th>
          <th>Total Invested</th>
          <th>Interest Accrued</th>
          <th>Closing Balance</th>
        </tr>
      </thead>
      <tbody id="tbodySchedule">
        <!-- Rendered via JS -->
      </tbody>
    </table>
  </div>

</div>

<script>
  (function() {
    let _calcMode = 'sip'; // 'sip' or 'lump'
    let _hasStepUp = false;
    const CIRCUMFERENCE = 2 * Math.PI * 80; // ~502.6548

    function fmtCur(val) {
      if (isNaN(val)) return '₹0';
      return '₹' + Math.round(val).toLocaleString('en-IN');
    }

    function fmtShortCur(val) {
      if (isNaN(val)) return '₹0';
      if (val >= 10000000) {
        return '₹' + (val / 10000000).toFixed(2) + ' Cr';
      } else if (val >= 100000) {
        return '₹' + (val / 100000).toFixed(1) + ' L';
      }
      return fmtCur(val);
    }

    function updateSliderFill(slider, min, max, val) {
      const pct = ((val - min) / (max - min)) * 100;
      slider.style.background = `linear-gradient(to right, #0284c7 0%, #0284c7 ${pct}%, var(--calc-track-bg) ${pct}%, var(--calc-track-bg) 100%)`;
    }

    function runCalculations() {
      const amount = parseFloat(document.getElementById('inputAmount').value) || 0;
      const rate = parseFloat(document.getElementById('inputRate').value) || 0;
      const years = parseInt(document.getElementById('inputYears').value) || 0;
      const stepUp = _hasStepUp ? (parseFloat(document.getElementById('sliderStepUp').value) || 0) : 0;

      let totalInvested = 0;
      let totalCorpus = 0;
      const schedule = [];

      const currentYear = new Date().getFullYear();

      if (_calcMode === 'sip') {
        const monthlyRate = (rate / 100) / 12;
        let runningCorpus = 0;
        let runningInvested = 0;
        let currentMonthly = amount;

        for (let y = 1; y <= years; y++) {
          let annualDeposit = 0;
          let yearStartCorpus = runningCorpus;

          for (let m = 1; m <= 12; m++) {
            runningInvested += currentMonthly;
            annualDeposit += currentMonthly;
            runningCorpus = (runningCorpus + currentMonthly) * (1 + monthlyRate);
          }

          const yearInterest = runningCorpus - yearStartCorpus - annualDeposit;
          schedule.push({
            year: y,
            calYear: currentYear + y,
            annualDeposit: annualDeposit,
            totalInvested: runningInvested,
            yearInterest: yearInterest,
            closingCorpus: runningCorpus
          });

          if (stepUp > 0) {
            currentMonthly = currentMonthly * (1 + stepUp / 100);
          }
        }

        totalInvested = runningInvested;
        totalCorpus = runningCorpus;
      } else {
        // Lumpsum Mode
        totalInvested = amount;
        let runningCorpus = amount;

        for (let y = 1; y <= years; y++) {
          const nextCorpus = runningCorpus * (1 + rate / 100);
          const yearInterest = nextCorpus - runningCorpus;
          runningCorpus = nextCorpus;

          schedule.push({
            year: y,
            calYear: currentYear + y,
            annualDeposit: (y === 1 ? amount : 0),
            totalInvested: amount,
            yearInterest: yearInterest,
            closingCorpus: runningCorpus
          });
        }
        totalCorpus = runningCorpus;
      }

      const totalGain = Math.max(0, totalCorpus - totalInvested);
      const mult = totalInvested > 0 ? (totalCorpus / totalInvested).toFixed(1) + 'x Multiplier' : '1.0x';
      const invPct = totalCorpus > 0 ? ((totalInvested / totalCorpus) * 100).toFixed(1) : '50.0';
      const gainPct = totalCorpus > 0 ? ((totalGain / totalCorpus) * 100).toFixed(1) : '50.0';

      // Update Texts
      document.getElementById('valInvested').innerText = fmtCur(totalInvested);
      document.getElementById('pctInvested').innerText = `(${invPct}%)`;
      document.getElementById('valGain').innerText = '+' + fmtCur(totalGain);
      document.getElementById('pctGain').innerText = `(${gainPct}%)`;
      document.getElementById('valTotal').innerText = fmtCur(totalCorpus);
      document.getElementById('donutTotalVal').innerText = fmtShortCur(totalCorpus);
      document.getElementById('donutMultiplier').innerText = mult;
      document.getElementById('txtHorizonSubtitle').innerText = `After ${years} Year${years > 1 ? 's' : ''} @ ${rate}% CAGR`;

      // Inflation calculation (at ~6% avg inflation)
      const realPurchasingPower = totalCorpus / Math.pow(1 + 0.06, years);
      document.getElementById('txtInflationNote').innerHTML = `🛒 Estimated real purchasing power after 6% annual inflation: <strong>${fmtShortCur(realPurchasingPower)}</strong>`;

      // Update SVG Donut Stroke
      const c = CIRCUMFERENCE;
      const invStroke = (parseFloat(invPct) / 100) * c;
      const gainStroke = (parseFloat(gainPct) / 100) * c;

      const circleInv = document.getElementById('donutInvested');
      const circleGain = document.getElementById('donutGain');

      circleInv.style.strokeDasharray = `${invStroke} ${c}`;
      circleInv.style.strokeDashoffset = '0';

      circleGain.style.strokeDasharray = `${gainStroke} ${c}`;
      circleGain.style.strokeDashoffset = `-${invStroke}`;

      // Update Sliders Gradient Fills
      const sAmt = document.getElementById('sliderAmount');
      updateSliderFill(sAmt, parseFloat(sAmt.min), parseFloat(sAmt.max), amount);

      const sRate = document.getElementById('sliderRate');
      updateSliderFill(sRate, parseFloat(sRate.min), parseFloat(sRate.max), rate);

      const sYrs = document.getElementById('sliderYears');
      updateSliderFill(sYrs, parseFloat(sYrs.min), parseFloat(sYrs.max), years);

      const sStep = document.getElementById('sliderStepUp');
      if (sStep) updateSliderFill(sStep, parseFloat(sStep.min), parseFloat(sStep.max), stepUp || 10);

      // Render Schedule Table
      const tbody = document.getElementById('tbodySchedule');
      let html = '';
      schedule.forEach(row => {
        html += `
          <tr>
            <td style="text-align:left; font-weight:700;">Year ${row.year} <span style="font-size:11px; color:var(--calc-muted); font-weight:normal;">(${row.calYear})</span></td>
            <td>${fmtCur(row.annualDeposit)}</td>
            <td>${fmtCur(row.totalInvested)}</td>
            <td style="color:var(--calc-returns-color);">+${fmtCur(row.yearInterest)}</td>
            <td style="font-weight:700; color:var(--calc-title);">${fmtCur(row.closingCorpus)}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    }

    // Window exposure for events
    window.tdSetMode = function(mode) {
      _calcMode = mode;
      document.getElementById('btnModeSip').classList.toggle('active', mode === 'sip');
      document.getElementById('btnModeLump').classList.toggle('active', mode === 'lump');
      
      const sAmt = document.getElementById('sliderAmount');
      const iAmt = document.getElementById('inputAmount');
      const lblAmt = document.getElementById('lblAmount');
      const chips = document.getElementById('chipsAmount');
      const boxStep = document.getElementById('boxStepUp');

      if (mode === 'sip') {
        lblAmt.innerText = 'Monthly Investment';
        sAmt.min = 500;
        sAmt.max = 500000;
        sAmt.step = 500;
        iAmt.value = 10000;
        sAmt.value = 10000;
        boxStep.style.display = 'block';
        chips.innerHTML = `
          <span class="td-calc-chip" onclick="tdSetAmount(5000)">₹5,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(10000)">₹10,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(25000)">₹25,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(50000)">₹50,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(100000)">₹1 Lakh</span>
        `;
      } else {
        lblAmt.innerText = 'Total One-Time Investment';
        sAmt.min = 5000;
        sAmt.max = 5000000;
        sAmt.step = 5000;
        iAmt.value = 100000;
        sAmt.value = 100000;
        boxStep.style.display = 'none';
        chips.innerHTML = `
          <span class="td-calc-chip" onclick="tdSetAmount(50000)">₹50,000</span>
          <span class="td-calc-chip" onclick="tdSetAmount(100000)">₹1 Lakh</span>
          <span class="td-calc-chip" onclick="tdSetAmount(250000)">₹2.5 Lakh</span>
          <span class="td-calc-chip" onclick="tdSetAmount(500000)">₹5 Lakh</span>
          <span class="td-calc-chip" onclick="tdSetAmount(1000000)">₹10 Lakh</span>
        `;
      }
      runCalculations();
    };

    window.tdOnAmountSlider = function(val) {
      document.getElementById('inputAmount').value = val;
      runCalculations();
    };
    window.tdOnAmountInput = function(val) {
      document.getElementById('sliderAmount').value = val;
      runCalculations();
    };
    window.tdSetAmount = function(val) {
      document.getElementById('inputAmount').value = val;
      document.getElementById('sliderAmount').value = val;
      runCalculations();
    };

    window.tdOnRateSlider = function(val) {
      document.getElementById('inputRate').value = val;
      runCalculations();
    };
    window.tdOnRateInput = function(val) {
      document.getElementById('sliderRate').value = val;
      runCalculations();
    };
    window.tdSetRate = function(val) {
      document.getElementById('inputRate').value = val;
      document.getElementById('sliderRate').value = val;
      runCalculations();
    };

    window.tdOnYearsSlider = function(val) {
      document.getElementById('inputYears').value = val;
      runCalculations();
    };
    window.tdOnYearsInput = function(val) {
      document.getElementById('sliderYears').value = val;
      runCalculations();
    };
    window.tdSetYears = function(val) {
      document.getElementById('inputYears').value = val;
      document.getElementById('sliderYears').value = val;
      runCalculations();
    };

    window.tdToggleStepUp = function() {
      const chk = document.getElementById('chkStepUp');
      chk.checked = !chk.checked;
      tdOnStepUpToggle(chk.checked);
    };
    window.tdOnStepUpToggle = function(checked) {
      _hasStepUp = checked;
      document.getElementById('stepUpDetails').style.display = checked ? 'block' : 'none';
      runCalculations();
    };
    window.tdOnStepUpSlider = function(val) {
      document.getElementById('txtStepUpPct').innerText = val + '% / year';
      runCalculations();
    };

    window.tdToggleSchedule = function() {
      const p = document.getElementById('paneSchedule');
      p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    };

    // Initial Execution
    runCalculations();
  })();
</script>

---

## The Power of Compounding: Key Principles Every Investor Must Know

### 1. The 8-4-3 Rule of Compounding
Compounding works logarithmically. In mutual fund SIPs, wealth creation accelerates drastically as time advances:

* **The First ₹1 Crore takes ~8 to 10 years** of consistent deposits and patient compounding.
* **The Second ₹1 Crore takes only ~4 years**, because your accrued returns begin generating more interest than your original monthly deposits.
* **The Third ₹1 Crore takes only ~3 years**, where gains dwarf total principal invested.

<div style="background:rgba(2,132,199,0.06); border-left:4px solid #0284c7; border-radius:0 12px 12px 0; padding:16px 20px; margin:24px 0;">
  <div style="font-weight:700; color:#0284c7; font-size:14.5px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
    <span>💡</span> Institutional Rule of Thumb
  </div>
  <div style="font-size:14px; color:var(--calc-text, #334155); line-height:1.65;">
    Compounding rewards <strong>time in the market</strong> over timing the market. Starting 5 years earlier can double your ultimate retirement corpus even with half the monthly contribution.
  </div>
</div>

---

### 2. Systematic Investment Plan (SIP) vs One-Time Lumpsum

| Key Feature | Systematic Investment Plan (SIP) | One-Time Lumpsum Investment |
|---|---|---|
| **Capital Requirement** | Disciplined monthly allocation (starts from ₹500/mo) | Bulk upfront capital (e.g. bonus, property sale, inheritance) |
| **Market Volatility Risk** | Low &mdash; Uses **Rupee-Cost Averaging** during dips | High &mdash; Exposed to entry timing and market peaks |
| **Ideal Market Environment** | Range-bound, sideways, or volatile consolidating markets | Post-correction bear market troughs or deep value crashes |
| **Psychological Discipline** | Automated deduction removes emotional trading bias | Requires conviction to hold through short-term drawdown volatility |

---

### 3. The Rule of 72: Doubling Time Formula
The **Rule of 72** is a quick mathematical shortcut to estimate how many years it takes for your investment to double at a given compound annual growth rate (CAGR):

<div style="display:inline-flex; align-items:center; gap:10px; background:var(--calc-card-bg, #f8fafc); border:1.5px solid var(--calc-card-border, #e2e8f0); padding:10px 20px; border-radius:12px; font-size:15px; font-weight:700; color:var(--calc-title, #0f172a); margin:14px 0;">
  <span>Years to Double</span>
  <span style="color:var(--calc-muted, #64748b);">≈</span>
  <span style="color:#0284c7;">72 ÷ Annual Return (%)</span>
</div>

* At **12% CAGR** (historical Nifty 50 TRI return): `72 ÷ 12 =` **6 Years** to double.
* At **15% CAGR** (aggressive mid/small-cap alpha): `72 ÷ 15 =` **4.8 Years** to double.
* At **7% CAGR** (standard bank fixed deposits): `72 ÷ 7 =` **10.3 Years** to double.

---

### 4. Indian Mutual Fund Taxation Guide (Budget 2024 Updates)

* **Long-Term Capital Gains (LTCG)**:
  - Applicable on equity mutual funds held for **more than 12 months**.
  - Capital gains up to **₹1.25 Lakh per financial year are 100% tax-free**.
  - Gains exceeding ₹1.25 Lakh are taxed at **12.5%** (without indexation).
* **Short-Term Capital Gains (STCG)**:
  - Applicable on equity funds held for **less than 12 months**.
  - Taxed at a flat rate of **20%** plus applicable cess.
* **Debt Mutual Funds**:
  - Capital gains are added to total annual taxable income and taxed according to your individual income tax slab.

---

## Frequently Asked Questions (FAQ)

<div style="margin:24px 0; display:flex; flex-direction:column; gap:12px;">
  <details style="background:var(--calc-card-bg, rgba(255,255,255,0.03)); border:1px solid var(--calc-card-border, rgba(255,255,255,0.08)); border-radius:12px; padding:16px 20px;">
    <summary style="font-weight:700; cursor:pointer; font-size:15px; color:var(--calc-title, #f8fafc);">What is a Systematic Investment Plan (SIP)?</summary>
    <p style="margin:12px 0 0 0; font-size:14px; line-height:1.7; color:var(--calc-text, #cbd5e1);">
      A Systematic Investment Plan (SIP) allows you to invest a fixed amount of money at regular intervals (typically monthly) into mutual funds. It inculcates disciplined financial habits and takes advantage of Rupee-Cost Averaging, buying more mutual fund units when markets drop and fewer when markets rise.
    </p>
  </details>

  <details style="background:var(--calc-card-bg, rgba(255,255,255,0.03)); border:1px solid var(--calc-card-border, rgba(255,255,255,0.08)); border-radius:12px; padding:16px 20px;">
    <summary style="font-weight:700; cursor:pointer; font-size:15px; color:var(--calc-title, #f8fafc);">How does an Annual Step-Up SIP multiply wealth?</summary>
    <p style="margin:12px 0 0 0; font-size:14px; line-height:1.7; color:var(--calc-text, #cbd5e1);">
      An Annual Step-Up automatically increases your monthly SIP contribution by a fixed percentage (e.g. 10%) every year in tandem with your annual salary increments. A ₹10,000 monthly SIP with a 10% annual step-up over 20 years yields nearly <strong>₹1.65 Crore</strong>, compared to <strong>₹99 Lakh</strong> without the step-up &mdash; creating an extra ₹66 Lakh of wealth!
    </p>
  </details>

  <details style="background:var(--calc-card-bg, rgba(255,255,255,0.03)); border:1px solid var(--calc-card-border, rgba(255,255,255,0.08)); border-radius:12px; padding:16px 20px;">
    <summary style="font-weight:700; cursor:pointer; font-size:15px; color:var(--calc-title, #f8fafc);">What average return should I realistically expect from Indian equity mutual funds?</summary>
    <p style="margin:12px 0 0 0; font-size:14px; line-height:1.7; color:var(--calc-text, #cbd5e1);">
      Over rolling 10 to 15-year periods, the benchmark Nifty 50 Total Returns Index (TRI) has historically delivered approximately <strong>12% to 13.5% CAGR</strong>. Broad-market flexi-cap and active diversified funds have historically averaged <strong>13% to 15% CAGR</strong>.
    </p>
  </details>

  <details style="background:var(--calc-card-bg, rgba(255,255,255,0.03)); border:1px solid var(--calc-card-border, rgba(255,255,255,0.08)); border-radius:12px; padding:16px 20px;">
    <summary style="font-weight:700; cursor:pointer; font-size:15px; color:var(--calc-title, #f8fafc);">Can I pause, stop, or change my SIP amount midway?</summary>
    <p style="margin:12px 0 0 0; font-size:14px; line-height:1.7; color:var(--calc-text, #cbd5e1);">
      Yes. In open-ended mutual funds, SIPs are completely flexible. You can pause or stop your SIP at any time through your broker or AMC portal without incurring penalties, and resume whenever convenient.
    </p>
  </details>
</div>
