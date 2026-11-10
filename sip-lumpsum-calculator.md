# Institutional SIP & Lumpsum Wealth Calculator

Plan your financial freedom with precision. Whether you are investing monthly through a **Systematic Investment Plan (SIP)** or deploying a **One-Time Lumpsum**, this institutional-grade compounding engine calculates your future wealth accumulation, capital appreciation, and year-by-year corpus growth.

---

<div class="td-calc-wrapper" id="tdCalcContainer">
  <style>
    .td-calc-wrapper {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      margin: 28px 0;
      color: #f8fafc;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }
    .td-calc-tabs {
      display: flex;
      gap: 10px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .td-calc-tab-btn {
      flex: 1;
      padding: 12px 18px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #94a3b8;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .td-calc-tab-btn:hover {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.04);
    }
    .td-calc-tab-btn.active {
      background: #0284c7;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
    }
    .td-calc-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 28px;
    }
    @media (max-width: 860px) {
      .td-calc-grid {
        grid-template-columns: 1fr;
      }
    }
    .td-calc-group {
      margin-bottom: 22px;
    }
    .td-calc-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .td-calc-label {
      font-size: 13.5px;
      font-weight: 600;
      color: #cbd5e1;
    }
    .td-calc-val-box {
      display: flex;
      align-items: center;
      background: rgba(2, 6, 23, 0.8);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 8px;
      padding: 6px 12px;
      color: #38bdf8;
      font-family: monospace;
      font-size: 16px;
      font-weight: 700;
    }
    .td-calc-input {
      background: transparent;
      border: none;
      color: #38bdf8;
      font-family: inherit;
      font-size: 16px;
      font-weight: 700;
      width: 110px;
      text-align: right;
      outline: none;
    }
    .td-calc-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 4px;
      background: #334155;
      outline: none;
      cursor: pointer;
    }
    .td-calc-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #38bdf8;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
      border: 2px solid #0f172a;
    }
    .td-calc-presets {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .td-preset-btn {
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      color: #94a3b8;
      font-size: 11.5px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .td-preset-btn:hover {
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.3);
    }
    .td-calc-summary-card {
      background: linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .td-kpi-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 12px 0;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
    }
    .td-kpi-item:last-of-type {
      border-bottom: none;
    }
    .td-kpi-title {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
    }
    .td-kpi-num {
      font-size: 17px;
      font-weight: 800;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    }
    .td-kpi-total {
      margin-top: 14px;
      padding: 16px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .td-kpi-total-title {
      font-size: 13px;
      font-weight: 700;
      color: #34d399;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .td-kpi-total-num {
      font-size: 24px;
      font-weight: 900;
      color: #34d399;
      font-family: -apple-system, BlinkMacSystemFont, monospace;
    }
    .td-progress-container {
      margin: 18px 0 10px 0;
    }
    .td-progress-bar {
      height: 12px;
      border-radius: 6px;
      background: #0284c7;
      display: flex;
      overflow: hidden;
    }
    .td-progress-inv {
      background: #0284c7;
      height: 100%;
      transition: width 0.3s;
    }
    .td-progress-gain {
      background: #10b981;
      height: 100%;
      transition: width 0.3s;
    }
    .td-progress-legend {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 11.5px;
      color: #94a3b8;
    }
    .td-legend-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 5px;
    }
    .td-table-toggle {
      margin-top: 18px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #94a3b8;
      border-radius: 8px;
      padding: 9px 14px;
      font-size: 12.5px;
      font-weight: 600;
      width: 100%;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .td-table-toggle:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
      border-color: #38bdf8;
    }
    .td-schedule-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 12px;
      display: none;
    }
    .td-schedule-table th {
      background: rgba(15, 23, 42, 0.8);
      color: #94a3b8;
      padding: 8px 10px;
      text-align: right;
      font-weight: 600;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .td-schedule-table th:first-child { text-align: left; }
    .td-schedule-table td {
      padding: 8px 10px;
      text-align: right;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: #e2e8f0;
      font-family: monospace;
    }
    .td-schedule-table td:first-child { text-align: left; font-family: inherit; font-weight: 600; color: #cbd5e1; }
  </style>

  <!-- 1. Tabs Header -->
  <div class="td-calc-tabs">
    <button type="button" class="td-calc-tab-btn active" id="tabSip" onclick="setCalcMode('sip')">
      <span>🔄</span> SIP Calculator (Monthly)
    </button>
    <button type="button" class="td-calc-tab-btn" id="tabLumpsum" onclick="setCalcMode('lumpsum')">
      <span>💵</span> Lumpsum Calculator (One-Time)
    </button>
  </div>

  <!-- 2. Interactive Calculator Grid -->
  <div class="td-calc-grid">
    <!-- Left Inputs Column -->
    <div class="td-calc-inputs">
      
      <!-- Field 1: Investment Amount -->
      <div class="td-calc-group">
        <div class="td-calc-label-row">
          <label class="td-calc-label" id="lblAmount">Monthly Investment</label>
          <div class="td-calc-val-box">
            <span>₹</span>
            <input type="number" id="inpAmount" class="td-calc-input" value="10000" min="500" max="10000000" step="500" oninput="onInputAmount(this.value)" />
          </div>
        </div>
        <input type="range" id="rngAmount" class="td-calc-slider" value="10000" min="500" max="100000" step="500" oninput="onSliderAmount(this.value)" />
        <div class="td-calc-presets" id="presetsAmount">
          <button type="button" class="td-preset-btn" onclick="setAmount(2500)">₹2.5K</button>
          <button type="button" class="td-preset-btn" onclick="setAmount(5000)">₹5K</button>
          <button type="button" class="td-preset-btn" onclick="setAmount(10000)">₹10K</button>
          <button type="button" class="td-preset-btn" onclick="setAmount(25000)">₹25K</button>
          <button type="button" class="td-preset-btn" onclick="setAmount(50000)">₹50K</button>
          <button type="button" class="td-preset-btn" onclick="setAmount(100000)">₹1 Lakh</button>
        </div>
      </div>

      <!-- Field 2: Expected Return Rate -->
      <div class="td-calc-group">
        <div class="td-calc-label-row">
          <label class="td-calc-label">Expected Annual Return (p.a.)</label>
          <div class="td-calc-val-box">
            <input type="number" id="inpRate" class="td-calc-input" value="12" min="1" max="30" step="0.5" oninput="onInputRate(this.value)" style="width:55px;" />
            <span>%</span>
          </div>
        </div>
        <input type="range" id="rngRate" class="td-calc-slider" value="12" min="1" max="30" step="0.5" oninput="onSliderRate(this.value)" />
        <div class="td-calc-presets">
          <button type="button" class="td-preset-btn" onclick="setRate(10)">10% (Large Cap)</button>
          <button type="button" class="td-preset-btn" onclick="setRate(12)">12% (Nifty Index)</button>
          <button type="button" class="td-preset-btn" onclick="setRate(15)">15% (Flexi/Mid Cap)</button>
          <button type="button" class="td-preset-btn" onclick="setRate(18)">18% (Small Cap)</button>
        </div>
      </div>

      <!-- Field 3: Time Horizon -->
      <div class="td-calc-group">
        <div class="td-calc-label-row">
          <label class="td-calc-label">Investment Period</label>
          <div class="td-calc-val-box">
            <input type="number" id="inpYears" class="td-calc-input" value="10" min="1" max="40" step="1" oninput="onInputYears(this.value)" style="width:45px;" />
            <span>Yr</span>
          </div>
        </div>
        <input type="range" id="rngYears" class="td-calc-slider" value="10" min="1" max="40" step="1" oninput="onSliderYears(this.value)" />
        <div class="td-calc-presets">
          <button type="button" class="td-preset-btn" onclick="setYears(5)">5 Years</button>
          <button type="button" class="td-preset-btn" onclick="setYears(10)">10 Years</button>
          <button type="button" class="td-preset-btn" onclick="setYears(15)">15 Years</button>
          <button type="button" class="td-preset-btn" onclick="setYears(20)">20 Years</button>
          <button type="button" class="td-preset-btn" onclick="setYears(25)">25 Years</button>
        </div>
      </div>

      <!-- Field 4: Optional Annual Step-Up (SIP Mode Only) -->
      <div class="td-calc-group" id="groupStepUp">
        <div class="td-calc-label-row">
          <label class="td-calc-label">Annual Step-Up (% Yearly Increase)</label>
          <div class="td-calc-val-box">
            <input type="number" id="inpStepUp" class="td-calc-input" value="0" min="0" max="25" step="1" oninput="onInputStepUp(this.value)" style="width:45px;" />
            <span>%</span>
          </div>
        </div>
        <input type="range" id="rngStepUp" class="td-calc-slider" value="0" min="0" max="25" step="1" oninput="onSliderStepUp(this.value)" />
        <div class="td-calc-presets">
          <button type="button" class="td-preset-btn" onclick="setStepUp(0)">None (0%)</button>
          <button type="button" class="td-preset-btn" onclick="setStepUp(5)">5% Step-Up</button>
          <button type="button" class="td-preset-btn" onclick="setStepUp(10)">10% Step-Up</button>
          <button type="button" class="td-preset-btn" onclick="setStepUp(15)">15% Step-Up</button>
        </div>
      </div>

    </div>

    <!-- Right Summary Column -->
    <div class="td-calc-summary-card">
      <div>
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; font-weight:700; margin-bottom:12px;">Projection Breakdown</div>
        
        <div class="td-kpi-item">
          <span class="td-kpi-title">Invested Amount</span>
          <span class="td-kpi-num" id="dispInvested" style="color:#38bdf8;">₹12,00,000</span>
        </div>

        <div class="td-kpi-item">
          <span class="td-kpi-title">Est. Compounded Gain</span>
          <span class="td-kpi-num" id="dispReturns" style="color:#10b981;">₹11,23,391</span>
        </div>

        <div class="td-kpi-total">
          <div>
            <div class="td-kpi-total-title">Total Future Value</div>
            <div style="font-size:11px; color:#94a3b8;">After <span id="dispTenureLabel">10</span> Years</div>
          </div>
          <div class="td-kpi-total-num" id="dispTotal">₹23,23,391</div>
        </div>

        <!-- Ratio Bar -->
        <div class="td-progress-container">
          <div class="td-progress-bar">
            <div class="td-progress-inv" id="barInvested" style="width:51.6%;"></div>
            <div class="td-progress-gain" id="barReturns" style="width:48.4%;"></div>
          </div>
          <div class="td-progress-legend">
            <span><span class="td-legend-dot" style="background:#0284c7;"></span>Invested: <strong id="pctInvested">52%</strong></span>
            <span><span class="td-legend-dot" style="background:#10b981;"></span>Wealth Gain: <strong id="pctReturns">48%</strong></span>
          </div>
        </div>
      </div>

      <!-- Toggle Table Button -->
      <div>
        <button type="button" class="td-table-toggle" onclick="toggleScheduleTable()">
          <span>📊</span> <span id="lblToggleTable">Show Year-by-Year Growth Table</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 3. Year-by-Year Growth Schedule Table -->
  <div style="overflow-x:auto;">
    <table class="td-schedule-table" id="tblSchedule">
      <thead>
        <tr>
          <th>Year</th>
          <th>Invested Capital</th>
          <th>Interest / Gain</th>
          <th>Total Corpus (End of Year)</th>
        </tr>
      </thead>
      <tbody id="tblScheduleBody"></tbody>
    </table>
  </div>
</div>

<script>
  let currentMode = 'sip';

  function formatInr(val) {
    if (isNaN(val) || val <= 0) return '₹0';
    let roundVal = Math.round(val);
    if (roundVal >= 10000000) {
      let cr = (roundVal / 10000000).toFixed(2);
      return '₹' + cr + ' Cr';
    }
    return '₹' + roundVal.toLocaleString('en-IN');
  }

  function setCalcMode(mode) {
    currentMode = mode;
    const tabSip = document.getElementById('tabSip');
    const tabLump = document.getElementById('tabLumpsum');
    const lblAmount = document.getElementById('lblAmount');
    const rngAmount = document.getElementById('rngAmount');
    const inpAmount = document.getElementById('inpAmount');
    const presets = document.getElementById('presetsAmount');
    const stepUpGroup = document.getElementById('groupStepUp');

    if (mode === 'sip') {
      tabSip.classList.add('active');
      tabLump.classList.remove('active');
      lblAmount.textContent = 'Monthly Investment';
      rngAmount.min = 500;
      rngAmount.max = 100000;
      rngAmount.step = 500;
      if (parseFloat(inpAmount.value) > 100000) inpAmount.value = 10000;
      rngAmount.value = inpAmount.value;
      stepUpGroup.style.display = 'block';

      presets.innerHTML = `
        <button type="button" class="td-preset-btn" onclick="setAmount(2500)">₹2.5K</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(5000)">₹5K</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(10000)">₹10K</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(25000)">₹25K</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(50000)">₹50K</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(100000)">₹1 Lakh</button>
      `;
    } else {
      tabLump.classList.add('active');
      tabSip.classList.remove('active');
      lblAmount.textContent = 'One-Time Lumpsum Investment';
      rngAmount.min = 5000;
      rngAmount.max = 2000000;
      rngAmount.step = 5000;
      if (parseFloat(inpAmount.value) < 5000) inpAmount.value = 100000;
      rngAmount.value = inpAmount.value;
      stepUpGroup.style.display = 'none';

      presets.innerHTML = `
        <button type="button" class="td-preset-btn" onclick="setAmount(25000)">₹25K</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(50000)">₹50K</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(100000)">₹1 Lakh</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(500000)">₹5 Lakh</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(1000000)">₹10 Lakh</button>
        <button type="button" class="td-preset-btn" onclick="setAmount(2500000)">₹25 Lakh</button>
      `;
    }
    recalculate();
  }

  function onSliderAmount(v) { document.getElementById('inpAmount').value = v; recalculate(); }
  function onInputAmount(v) { document.getElementById('rngAmount').value = v; recalculate(); }
  function setAmount(v) { document.getElementById('inpAmount').value = v; document.getElementById('rngAmount').value = v; recalculate(); }

  function onSliderRate(v) { document.getElementById('inpRate').value = v; recalculate(); }
  function onInputRate(v) { document.getElementById('rngRate').value = v; recalculate(); }
  function setRate(v) { document.getElementById('inpRate').value = v; document.getElementById('rngRate').value = v; recalculate(); }

  function onSliderYears(v) { document.getElementById('inpYears').value = v; recalculate(); }
  function onInputYears(v) { document.getElementById('rngYears').value = v; recalculate(); }
  function setYears(v) { document.getElementById('inpYears').value = v; document.getElementById('rngYears').value = v; recalculate(); }

  function onSliderStepUp(v) { document.getElementById('inpStepUp').value = v; recalculate(); }
  function onInputStepUp(v) { document.getElementById('rngStepUp').value = v; recalculate(); }
  function setStepUp(v) { document.getElementById('inpStepUp').value = v; document.getElementById('rngStepUp').value = v; recalculate(); }

  function recalculate() {
    const P = Math.max(0, parseFloat(document.getElementById('inpAmount').value) || 0);
    const annualRate = Math.max(0.1, parseFloat(document.getElementById('inpRate').value) || 0);
    const years = Math.max(1, parseInt(document.getElementById('inpYears').value) || 1);
    const stepUp = (currentMode === 'sip') ? (parseFloat(document.getElementById('inpStepUp').value) || 0) : 0;

    let totalInvested = 0;
    let totalCorpus = 0;
    const schedule = [];

    if (currentMode === 'sip') {
      const i = annualRate / 12 / 100;
      let curMonthly = P;
      let curCorpus = 0;

      for (let y = 1; y <= years; y++) {
        let yearInvested = 0;
        for (let m = 1; m <= 12; m++) {
          curCorpus = (curCorpus + curMonthly) * (1 + i);
          yearInvested += curMonthly;
          totalInvested += curMonthly;
        }
        let yearGain = curCorpus - totalInvested;
        schedule.push({
          year: y,
          invested: totalInvested,
          gain: Math.max(0, curCorpus - totalInvested),
          corpus: curCorpus
        });
        if (stepUp > 0) {
          curMonthly = curMonthly * (1 + (stepUp / 100));
        }
      }
      totalCorpus = curCorpus;
    } else {
      // Lumpsum Mode: A = P * (1 + r)^t
      totalInvested = P;
      const r = annualRate / 100;
      for (let y = 1; y <= years; y++) {
        let corp = P * Math.pow(1 + r, y);
        schedule.push({
          year: y,
          invested: totalInvested,
          gain: Math.max(0, corp - totalInvested),
          corpus: corp
        });
      }
      totalCorpus = P * Math.pow(1 + r, years);
    }

    const estReturns = Math.max(0, totalCorpus - totalInvested);

    document.getElementById('dispInvested').textContent = formatInr(totalInvested);
    document.getElementById('dispReturns').textContent = formatInr(estReturns);
    document.getElementById('dispTotal').textContent = formatInr(totalCorpus);
    document.getElementById('dispTenureLabel').textContent = years;

    const invPct = totalCorpus > 0 ? ((totalInvested / totalCorpus) * 100).toFixed(1) : 50;
    const retPct = (100 - invPct).toFixed(1);

    document.getElementById('barInvested').style.width = invPct + '%';
    document.getElementById('barReturns').style.width = retPct + '%';
    document.getElementById('pctInvested').textContent = invPct + '%';
    document.getElementById('pctReturns').textContent = retPct + '%';

    // Populate Year-by-Year Table
    const tbody = document.getElementById('tblScheduleBody');
    if (tbody) {
      let rows = '';
      for (let row of schedule) {
        rows += `<tr>
          <td>Year ${row.year}</td>
          <td>${formatInr(row.invested)}</td>
          <td style="color:#34d399;">${formatInr(row.gain)}</td>
          <td style="color:#38bdf8; font-weight:700;">${formatInr(row.corpus)}</td>
        </tr>`;
      }
      tbody.innerHTML = rows;
    }
  }

  function toggleScheduleTable() {
    const tbl = document.getElementById('tblSchedule');
    const lbl = document.getElementById('lblToggleTable');
    if (tbl.style.display === 'table') {
      tbl.style.display = 'none';
      lbl.textContent = 'Show Year-by-Year Growth Table';
    } else {
      tbl.style.display = 'table';
      lbl.textContent = 'Hide Growth Table';
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recalculate);
  } else {
    recalculate();
  }
</script>

---

## What is a Systematic Investment Plan (SIP)?

A **Systematic Investment Plan (SIP)** is an institutional method of investing a fixed sum of money at regular intervals (typically monthly) into mutual funds, exchange-traded funds (ETFs), or equity portfolios. 

### Core Benefits of SIP:
1. **Rupee Cost Averaging**: When the market dips, your fixed installment buys more units. When the market surges, you buy fewer units. This eliminates the psychological pressure of market timing.
2. **Disciplined Compounding**: Automated bank mandates guarantee that capital is invested consistently month after month before discretionary expenses.
3. **Low Barrier to Entry**: Retail investors can begin building long-term equity wealth starting with as little as ₹500 per month.

---

## What is a Lumpsum Investment?

A **Lumpsum Investment** involves deploying a substantial single capital tranche at one time. 

### When is Lumpsum Preferred?
* **Post-Correction Valuations**: Deploying lumpsum capital during sharp market pullbacks, index corrections (-10% to -20%), or oversold market breadth phases maximizes forward returns.
* **Windfall Allocations**: Annual corporate bonuses, business profits, dividends, or real estate proceeds are ideal candidates for lumpsum deployment into diversified index funds.

---

## SIP vs Lumpsum: Strategic Comparison

| Metric | Systematic Investment Plan (SIP) | Lumpsum Investment |
| :--- | :--- | :--- |
| **Cash Inflow Style** | Regular monthly cash flows (Salaried / Recurring) | Single one-time lump-sum capital |
| **Market Timing Risk** | **Zero**. Automatically averages market cycles | **High**. Vulnerable to near-term market drawdowns |
| **Volatility Shield** | Excellent (Rupee cost averaging mitigates drawdowns) | Requires long holding period (5-7+ years) |
| **Bull Market Performance**| Strong, but slightly lags lumpsum in linear bull runs | **Optimal** in linear, multi-year bull trends |
| **Best For** | Monthly wealth creation & retirement planning | Deploying idle capital at reasonable market valuations |

---

## Mathematical Compounding Formulas Explained

### 1. SIP Compounding Formula
The future maturity value of a standard monthly SIP is determined by:

$$M = P 	imes rac{(1 + i)^n - 1}{i} 	imes (1 + i)$$

* **$M$**: Total Maturity Value
* **$P$**: Monthly Investment Amount
* **$i$**: Monthly interest rate ($rac{	ext{Annual Rate}}{12 	imes 100}$)
* **$n$**: Total number of installments ($	ext{Tenure in Years} 	imes 12$)

### 2. Lumpsum Compounding Formula
The future value of a one-time lumpsum is given by the classic compound interest formula:

$$A = P 	imes (1 + r)^t$$

* **$A$**: Total Maturity Amount
* **$P$**: Initial Principal Lumpsum Invested
* **$r$**: Annual expected return rate in decimals ($rac{	ext{Rate}}{100}$)
* **$t$**: Investment duration in years

---

## The "8-4-3 Rule" of Compounding

In Indian equity markets, long-term investors witness the exponential acceleration of compound interest known as the **8-4-3 Rule**:

1. **First ₹1 Crore**: Often takes ~**8 Years** of consistent monthly investments.
2. **Second ₹1 Crore**: Takes only ~**4 Years**, as the accumulated corpus starts generating returns larger than your annual savings.
3. **Third ₹1 Crore**: Takes just ~**3 Years**, where interest compounds upon previous interest exponentially!

---

## Step-Up SIP: The Secret Wealth Accelerator

Salaried professionals and growing business owners receive annual increments. A **Step-Up SIP** increases your monthly contribution by a modest percentage (e.g., 10%) every year.

> **Institutional Insight**: A ₹10,000 monthly SIP at 12% over 20 years accumulates **₹99.9 Lakhs**. By simply adding a **10% annual Step-Up**, the final maturity corpus explodes to **₹2.03 Crores**—more than double the wealth with minimal lifestyle impact!

---

## Frequently Asked Questions (FAQ)

### What is a realistic expected return rate for Indian equities?
Historically, the **Nifty 50 Index** has delivered a 12% to 14% Compound Annual Growth Rate (CAGR) over 10-15+ year rolling periods. Mid-cap and small-cap indices have delivered 14% to 18% CAGR over full economic cycles, with higher volatility.

### Are SIP returns guaranteed?
No. Equity mutual fund and index investments are market-linked instruments. However, holding diversified equity portfolios for 7 to 10+ years historically eliminates the probability of negative returns in the Indian market.

### What are the tax implications on Mutual Funds in India?
* **Equity Mutual Funds (Holding > 1 Year)**: Long-Term Capital Gains (LTCG) above ₹1.25 Lakh per financial year are taxed at 12.5%.
* **Short-Term Capital Gains (Holding < 1 Year)**: Taxed at 20%.

---

*Disclaimer: This calculator is provided for financial planning and educational simulations only. Actual mutual fund returns vary based on market cycles and fund selection.*
