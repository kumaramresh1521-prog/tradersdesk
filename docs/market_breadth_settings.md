# 📈 Market Breadth Pro — Quantitative Settings & Algorithm Reference

This document provides a comprehensive technical and quantitative reference for all calculation parameters in the **Market Breadth Pro (Point & Figure Advance/Decline Engine)**.

---

## 1. Primary Parameters (Always Visible in Compact Toolbar)

### 1.1 Date & Date Range (`dateInput`, `endDateInput`, `dateRangeToggle`)
* **Purpose**: Selects the target trading session (or multi-session historical window) for calculating breadth.
* **Single Session Mode** (Default): Analyzes intraday 1-minute to 30-minute intervals for the specified date (e.g. `16-Oct-2026`).
* **Date Range Mode**: Enables multi-session rolling Point & Figure matrix across consecutive exchange sessions.

### 1.2 Universe (`universeSelect`)
* **Purpose**: Specifies the basket of Indian equities tracked to compute aggregate market participation.
* **Available Universes**:
  - `Nifty 50`: 50 NSE flagship bluechip constituents (Benchmark).
  - `Bank Nifty`: 12 premier private and PSU banking giants.
  - `FinNifty`: 20 financial services, insurance, and NBFC constituents.
  - `Midcap Select` (`MIDCPNIFTY`): Top 25 liquid midcap equities.
  - `Nifty IT`, `Auto`, `Pharma`, `Metal`, `FMCG`, `Energy`: Sector-specific breadth desks.
  - `Nifty 500`: Broad-market institutional capitalization index.

### 1.3 Interval (`intervalInput`)
* **Purpose**: Sampling frequency of underlying stock prices.
* **Options**:
  - `1m` (1 Minute) — High-frequency intraday noise and fast momentum shifts.
  - `3m`, `5m` (Recommended) — Balanced institutional signal-to-noise ratio.
  - `10m`, `15m`, `30m` — Smoothed swing breadth.
  - `Day` (EOD) — Multi-session daily Point & Figure structural trend.

### 1.4 Auto Refresh (`autoRefresh`, `refreshInterval`, `refreshState`)
* **Purpose**: Automatically polls the backend exchange engine without requiring manual page reloads or button clicks.
* **Intervals**: `30s`, `60s` (Default), `2m`.
* **State Pill**: Displays live sync countdown, timestamp of latest computed tick, or market status (`Market Closed • EOD`).

---

## 2. Advanced Mathematical Parameters (Stored in Settings Popover)

### 2.1 Graph Mode (`chartMode`)
* **Options**:
  - `Carry prev` (`carry` - Default): Carries forward the previous session's closing Point & Figure column (X/O state) into the market open (09:15 IST). Prevents artificial whipsaws at 09:15.
  - `Prev + curr` (`previous_current`): Concatenates the preceding trading session's timeline with today's intraday curve for continuous visual perspective.
  - `Current only` (`current`): Evaluates all stocks fresh starting at 09:15 IST without carrying prior state.

### 2.2 Warmup Sessions (`warmupSessions`)
* **Default**: `5` sessions (Range: `0` to `20`).
* **Purpose**: Number of historical daily trading sessions pre-loaded into the Point & Figure matrix before the selected date.
* **Why it matters**: Point & Figure requires price movement history to establish the initial column state (X = Bullish column, O = Bearish column). A warmup of 5 sessions guarantees stable, mathematically accurate starting columns at market open.

### 2.3 Point & Figure Basis (`pnfBasis`)
* **Options**:
  - `High/Low` (`hl` - Default & Industry Standard): Uses High to test for column continuation (X) and Low to test for column reversal (O). Reflects true intraday price extremes.
  - `Close` (`close`): Evaluates only candle closing prices. Smoother but ignores intraday wick extremes.

### 2.4 Box Percentage (`boxPercent`)
* **Default**: `0.15%` (Range: `0.05%` to `5.0%`).
* **Purpose**: The minimum percentage move required to add a box to the current Point & Figure column.
* **Formula**: $\text{Box Size} = \text{Underlying Price} \times \frac{\text{Box \%}}{100}$
* **Interpretation**:
  - Lower box sizes (e.g. `0.1%`) trigger faster flips and show minor micro-trends.
  - Higher box sizes (e.g. `0.25%` - `0.5%`) filter out market noise and highlight major institutional trend commitments.

### 2.5 Reversal Boxes (`reversalBoxes`)
* **Default**: `3` boxes (Standard 3-box reversal method).
* **Purpose**: The number of boxes the price must move in the opposite direction to trigger a column reversal (from X to O, or from O to X).
* **Threshold**: Price must counter-trend by $\text{Box Size} \times \text{Reversal Boxes}$ (e.g., $0.15\% \times 3 = 0.45\%$) before a reversal column is formed.

### 2.6 Max Symbols Limit (`maxSymbols`)
* **Default**: `50` (or `universe.length`).
* **Purpose**: Maximum number of constituent equities processed simultaneously. Caps resource utilization for fast sub-second client-side rendering.

### 2.7 Underlying Index (`indexSelect`)
* **Default**: `Nifty 50` (`nifty50`).
* **Purpose**: Benchmark index curve overlaid underneath the Advance/Decline Point & Figure breadth line to identify **Bullish/Bearish Divergences** (e.g. Index reaching higher highs while breadth is making lower highs = classic institutional distribution warning).

---

## 3. UI Layout & Accessibility
All mathematical parameters (Section 2) are encapsulated in the compact **⚙️ Settings** drawer/popover. Their values are preserved in user workspace local storage and sent transparently with all API requests.
