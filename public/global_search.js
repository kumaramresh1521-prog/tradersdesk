/**
 * ============================================================================
 * 🔍 TRADERSDESK GLOBAL SEARCH & COMMAND PALETTE (Cross-Desk Jump Hub)
 * ============================================================================
 * Enables instant universal stock, index, and desk search from anywhere.
 * 1-Click direct navigation to Option Chain Pro, Delivery Desk, MTF Desk,
 * and Futures Dashboard — just like MTF cross-desk jump, but universally available.
 * Keyboard shortcut: Ctrl + K (or Cmd + K), "/" or clicking the top search bar.
 */

(function() {
  "use strict";

  // Comprehensive Curated Catalog of Indices
  const GLOBAL_INDICES = [
    { symbol: "NIFTY 50", label: "NIFTY 50", name: "NIFTY 50 Benchmark Index (50 Stocks)", type: "index", lot: 65, sector: "Benchmark" },
    { symbol: "BANK NIFTY", label: "BANK NIFTY", name: "Nifty Bank Sector Benchmark (12 Stocks)", type: "index", lot: 30, sector: "Banking" },
    { symbol: "FINNIFTY", label: "FINNIFTY", name: "Nifty Financial Services Index", type: "index", lot: 65, sector: "Financial Services" },
    { symbol: "MIDCPNIFTY", label: "MIDCPNIFTY", name: "Nifty Midcap Select Index", type: "index", lot: 120, sector: "Midcap" },
    { symbol: "NIFTY IT", label: "NIFTY IT", name: "Information Technology Sector Benchmark", type: "index", lot: 50, sector: "IT Services" },
    { symbol: "NIFTY AUTO", label: "NIFTY AUTO", name: "Automobile & Auto Components Index", type: "index", lot: 50, sector: "Automobile" },
    { symbol: "NIFTY PHARMA", label: "NIFTY PHARMA", name: "Pharmaceuticals & Healthcare Index", type: "index", lot: 50, sector: "Healthcare" },
    { symbol: "NIFTY METAL", label: "NIFTY METAL", name: "Metals, Mining & Steel Index", type: "index", lot: 50, sector: "Metals & Mining" },
    { symbol: "NIFTY FMCG", label: "NIFTY FMCG", name: "Fast Moving Consumer Goods Index", type: "index", lot: 50, sector: "FMCG" },
    { symbol: "NIFTY ENERGY", label: "NIFTY ENERGY", name: "Energy, Oil & Power Sector Index", type: "index", lot: 50, sector: "Energy & Utilities" },
    { symbol: "NIFTY NEXT 50", label: "NIFTY NEXT 50", name: "Nifty Next 50 Large Cap Index", type: "index", lot: 50, sector: "Large Cap" },
    { symbol: "NIFTY MIDCAP 100", label: "NIFTY MIDCAP 100", name: "Nifty Midcap 100 Broad Benchmark", type: "index", lot: 50, sector: "Midcap" },
    { symbol: "BSE SENSEX", label: "BSE SENSEX", name: "S&P BSE SENSEX 30 Benchmark", type: "index", lot: 20, sector: "BSE Benchmark" }
  ];

  // Platform Desks for Command Navigation
  const GLOBAL_DESKS = [
    { id: "upstoxChain", deskKey: "options", title: "Option Chain Pro", subtitle: "Multi-Broker Live Options Chain, Greeks, PCR, Strike OI & IV Skew", icon: "⚡", tag: "PRO" },
    { id: "delivery", deskKey: "delivery", title: "Delivery Desk", subtitle: "Bhavcopy Demat Cash Delivery %, Volume Shocks & 40+ Sessions History", icon: "📦", tag: "CASH" },
    { id: "mtf", deskKey: "mtf", title: "MTF Leverage Desk", subtitle: "Margin Trading Facility Broker Loan Books, Financed Cr & Squeeze Radar", icon: "💳", tag: "LEVERAGE" },
    { id: "futures", deskKey: "futures", title: "Futures Dashboard", subtitle: "Active Contracts LTP, Cash Basis, Cost of Carry & Buildup Quadrants", icon: "📈", tag: "F&O" },
    { id: "rollover", deskKey: "rollover", url: "/futures/rollover", title: "Futures Rollover Matrix", subtitle: "Dedicated Standalone Expiry Rollover %, 3M/6M Averages & Velocity", icon: "🔄", tag: "STANDALONE" },
    { id: "smartmoney", deskKey: "smartmoney", title: "FII / DII Institutional Desk", subtitle: "FII / DII Cash Market Activity, Participant OI & Index Futures Net", icon: "🏛️", tag: "INSTITUTIONAL" },
    { id: "globalMarkets", deskKey: "globalMarkets", title: "Global Markets & Macro", subtitle: "GIFT NIFTY, Dow Jones, Nasdaq, Crude Oil, Dollar Index & World Assets", icon: "🌐", tag: "MACRO" },
    { id: "breadthContrib", deskKey: "breadthContrib", url: "/breadth-contribution", title: "Market Breadth & Contribution", subtitle: "Live Advance/Decline Breadth Ratio & Index Point Contribution", icon: "📊", tag: "LIVE" },
    { id: "straddle", deskKey: "straddle", url: "/straddle", title: "Straddle Terminal", subtitle: "Live ATM Straddle Premium Decay Curve & Synthetic Spot Basis", icon: "📉", tag: "VOLATILITY" },
    { id: "calendar", deskKey: "calendar", url: "/calendar_studio.html", title: "NSE Trading Holiday Calendar", subtitle: "Exchange Clearing & Trading Holiday Schedule", icon: "📅", tag: "SCHEDULE" }
  ];

  // Curated Dictionary of Popular Active NSE Equities (F&O & Cash)
  const CURATED_STOCKS = [
    { symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Oil & Gas / Telecom", isFnO: true },
    { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Private Banking", isFnO: true },
    { symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Private Banking", isFnO: true },
    { symbol: "SBIN", name: "State Bank of India", sector: "PSU Banking", isFnO: true },
    { symbol: "INFY", name: "Infosys Ltd", sector: "IT Services", isFnO: true },
    { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT Services", isFnO: true },
    { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecom", isFnO: true },
    { symbol: "LT", name: "Larsen & Toubro Ltd", sector: "Capital Goods / Infra", isFnO: true },
    { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", sector: "Private Banking", isFnO: true },
    { symbol: "AXISBANK", name: "Axis Bank Ltd", sector: "Private Banking", isFnO: true },
    { symbol: "ITC", name: "ITC Ltd", sector: "FMCG / Cigarettes", isFnO: true },
    { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automobile", isFnO: true },
    { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "NBFC / Financials", isFnO: true },
    { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", sector: "Automobile", isFnO: true },
    { symbol: "M&M", name: "Mahindra & Mahindra Ltd", sector: "Automobile", isFnO: true },
    { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries", sector: "Healthcare / Pharma", isFnO: true },
    { symbol: "HCLTECH", name: "HCL Technologies Ltd", sector: "IT Services", isFnO: true },
    { symbol: "TATASTEEL", name: "Tata Steel Ltd", sector: "Metals & Mining", isFnO: true },
    { symbol: "NTPC", name: "NTPC Ltd", sector: "Power & Utilities", isFnO: true },
    { symbol: "POWERGRID", name: "Power Grid Corp of India", sector: "Power / Utilities", isFnO: true },
    { symbol: "TITAN", name: "Titan Company Ltd", sector: "Consumer Discretionary", isFnO: true },
    { symbol: "ASIANPAINT", name: "Asian Paints Ltd", sector: "Paints / Consumer", isFnO: true },
    { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd", sector: "Cement / Building Materials", isFnO: true },
    { symbol: "COALINDIA", name: "Coal India Ltd", sector: "Mining & Energy", isFnO: true },
    { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd", sector: "Financial Services", isFnO: true },
    { symbol: "ONGC", name: "Oil & Natural Gas Corp", sector: "Oil & Gas", isFnO: true },
    { symbol: "ADANIENT", name: "Adani Enterprises Ltd", sector: "Diversified / Conglomerate", isFnO: true },
    { symbol: "ADANIPORTS", name: "Adani Ports and SEZ", sector: "Logistics & Ports", isFnO: true },
    { symbol: "JSWSTEEL", name: "JSW Steel Ltd", sector: "Metals & Mining", isFnO: true },
    { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", sector: "FMCG", isFnO: true },
    { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd", sector: "Private Banking", isFnO: true },
    { symbol: "WIPRO", name: "Wipro Ltd", sector: "IT Services", isFnO: true },
    { symbol: "GRASIM", name: "Grasim Industries Ltd", sector: "Materials", isFnO: true },
    { symbol: "DIVISLAB", name: "Divi's Laboratories Ltd", sector: "Pharma / Healthcare", isFnO: true },
    { symbol: "CIPLA", name: "Cipla Ltd", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise", sector: "Healthcare", isFnO: true },
    { symbol: "EICHERMOT", name: "Eicher Motors Ltd", sector: "Automobile", isFnO: true },
    { symbol: "BPCL", name: "Bharat Petroleum Corp Ltd", sector: "Oil & Gas / Refining", isFnO: true },
    { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd", sector: "Automobile", isFnO: true },
    { symbol: "TATACONSUM", name: "Tata Consumer Products", sector: "FMCG / Foods", isFnO: true },
    { symbol: "BRITANNIA", name: "Britannia Industries Ltd", sector: "FMCG / Foods", isFnO: true },
    { symbol: "NESTLEIND", name: "Nestle India Ltd", sector: "FMCG / Foods", isFnO: true },
    { symbol: "TECHM", name: "Tech Mahindra Ltd", sector: "IT Services", isFnO: true },
    { symbol: "LTIM", name: "LTIMindtree Ltd", sector: "IT Services", isFnO: true },
    { symbol: "HDFCLIFE", name: "HDFC Life Insurance Co", sector: "Life Insurance", isFnO: true },
    { symbol: "SBILIFE", name: "SBI Life Insurance Co", sector: "Life Insurance", isFnO: true },
    { symbol: "SHRIRAMFIN", name: "Shriram Finance Ltd", sector: "NBFC / Commercial Vehicle", isFnO: true },
    { symbol: "BEL", name: "Bharat Electronics Ltd", sector: "Defence / Aerospace", isFnO: true },
    { symbol: "HAL", name: "Hindustan Aeronautics Ltd", sector: "Defence / Aerospace", isFnO: true },
    { symbol: "TRENT", name: "Trent Ltd", sector: "Retail / Fashion", isFnO: true },
    { symbol: "ZOMATO", name: "Zomato Ltd", sector: "Internet / Food Delivery", isFnO: true },
    { symbol: "JIOFIN", name: "Jio Financial Services", sector: "Financial Services", isFnO: true },
    { symbol: "DLF", name: "DLF Ltd", sector: "Real Estate", isFnO: true },
    { symbol: "VEDL", name: "Vedanta Ltd", sector: "Metals & Mining", isFnO: true },
    { symbol: "HINDALCO", name: "Hindalco Industries Ltd", sector: "Aluminium & Copper", isFnO: true },
    { symbol: "CHOLAFIN", name: "Cholamandalam Investment", sector: "NBFC / Auto Finance", isFnO: true },
    { symbol: "POLYCAB", name: "Polycab India Ltd", sector: "Wires & Electricals", isFnO: true },
    { symbol: "PERSISTENT", name: "Persistent Systems Ltd", sector: "IT Services", isFnO: true },
    { symbol: "COFORGE", name: "Coforge Ltd", sector: "IT Services", isFnO: true },
    { symbol: "MPHASIS", name: "Mphasis Ltd", sector: "IT Services", isFnO: true },
    { symbol: "DIXON", name: "Dixon Technologies", sector: "Consumer Electronics", isFnO: true },
    { symbol: "CUMMINSIND", name: "Cummins India Ltd", sector: "Capital Goods / Engines", isFnO: true },
    { symbol: "SIEMENS", name: "Siemens Ltd", sector: "Industrial Automation", isFnO: true },
    { symbol: "ABB", name: "ABB India Ltd", sector: "Electrification & Automation", isFnO: true },
    { symbol: "BHEL", name: "Bharat Heavy Electricals", sector: "Heavy Engineering", isFnO: true },
    { symbol: "CANBK", name: "Canara Bank", sector: "PSU Banking", isFnO: true },
    { symbol: "PNB", name: "Punjab National Bank", sector: "PSU Banking", isFnO: true },
    { symbol: "BANKBARODA", name: "Bank of Baroda", sector: "PSU Banking", isFnO: true },
    { symbol: "FEDERALBNK", name: "Federal Bank Ltd", sector: "Private Banking", isFnO: true },
    { symbol: "IDFCFIRSTB", name: "IDFC First Bank Ltd", sector: "Private Banking", isFnO: true },
    { symbol: "AUBANK", name: "AU Small Finance Bank", sector: "Small Finance Bank", isFnO: true },
    { symbol: "BANDHANBNK", name: "Bandhan Bank Ltd", sector: "Banking", isFnO: true },
    { symbol: "PFC", name: "Power Finance Corporation", sector: "Power NBFC", isFnO: true },
    { symbol: "RECLTD", name: "REC Ltd", sector: "Power NBFC", isFnO: true },
    { symbol: "MUTHOOTFIN", name: "Muthoot Finance Ltd", sector: "Gold Loan NBFC", isFnO: true },
    { symbol: "MANAPPURAM", name: "Manappuram Finance Ltd", sector: "Gold Loan NBFC", isFnO: true },
    { symbol: "L&TFH", name: "L&T Finance Holdings", sector: "NBFC", isFnO: true },
    { symbol: "LICHSGFIN", name: "LIC Housing Finance Ltd", sector: "Housing Finance", isFnO: true },
    { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd", sector: "Automobile / Two-Wheelers", isFnO: true },
    { symbol: "TVSMOTOR", name: "TVS Motor Company Ltd", sector: "Automobile / Two-Wheelers", isFnO: true },
    { symbol: "MOTHERSON", name: "Samvardhana Motherson Int", sector: "Auto Components", isFnO: true },
    { symbol: "BHARATFORG", name: "Bharat Forge Ltd", sector: "Auto Components / Forging", isFnO: true },
    { symbol: "BALKRISIND", name: "Balkrishna Industries", sector: "Off-Highway Tyres", isFnO: true },
    { symbol: "MRF", name: "MRF Ltd", sector: "Tyres & Rubber", isFnO: true },
    { symbol: "APOLLOTYRE", name: "Apollo Tyres Ltd", sector: "Tyres & Rubber", isFnO: true },
    { symbol: "LUPIN", name: "Lupin Ltd", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "AUROPHARMA", name: "Aurobindo Pharma Ltd", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "BIOCON", name: "Biocon Ltd", sector: "Biopharmaceuticals", isFnO: true },
    { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "ALKEM", name: "Alkem Laboratories Ltd", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "ZYDUSLIFE", name: "Zydus Lifesciences Ltd", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "GLENMARK", name: "Glenmark Pharmaceuticals", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "IPCALAB", name: "IPCA Laboratories Ltd", sector: "Pharmaceuticals", isFnO: true },
    { symbol: "LAURUSLABS", name: "Laurus Labs Ltd", sector: "Pharma Active Ingredients", isFnO: true },
    { symbol: "SYNGENE", name: "Syngene International Ltd", sector: "Contract Research", isFnO: true },
    { symbol: "MAXHEALTH", name: "Max Healthcare Institute", sector: "Hospitals & Healthcare", isFnO: true },
    { symbol: "METROPOLIS", name: "Metropolis Healthcare", sector: "Diagnostics", isFnO: true },
    { symbol: "LALPATHLAB", name: "Dr Lal PathLabs Ltd", sector: "Diagnostics", isFnO: true },
    { symbol: "NMDC", name: "NMDC Ltd", sector: "Iron Ore Mining", isFnO: true },
    { symbol: "NATIONALUM", name: "National Aluminium Co Ltd", sector: "Aluminium & Mining", isFnO: true },
    { symbol: "SAIL", name: "Steel Authority of India", sector: "Steel & Mining", isFnO: true },
    { symbol: "JINDALSTEL", name: "Jindal Steel & Power Ltd", sector: "Steel & Power", isFnO: true },
    { symbol: "HINDCOPPER", name: "Hindustan Copper Ltd", sector: "Copper Mining", isFnO: true },
    { symbol: "AMBUJACEM", name: "Ambuja Cements Ltd", sector: "Cement", isFnO: true },
    { symbol: "SHREECEM", name: "Shree Cement Ltd", sector: "Cement", isFnO: true },
    { symbol: "DALBHARAT", name: "Dalmia Bharat Ltd", sector: "Cement", isFnO: true },
    { symbol: "ACC", name: "ACC Ltd", sector: "Cement", isFnO: true },
    { symbol: "IOC", name: "Indian Oil Corp Ltd", sector: "Oil Refining & Marketing", isFnO: true },
    { symbol: "GAIL", name: "GAIL India Ltd", sector: "Gas Transmission", isFnO: true },
    { symbol: "PETRONET", name: "Petronet LNG Ltd", sector: "LNG Terminal", isFnO: true },
    { symbol: "IGL", name: "Indraprastha Gas Ltd", sector: "City Gas Distribution", isFnO: true },
    { symbol: "MGL", name: "Mahanagar Gas Ltd", sector: "City Gas Distribution", isFnO: true },
    { symbol: "GUJGASLTD", name: "Gujarat Gas Ltd", sector: "City Gas Distribution", isFnO: true },
    { symbol: "OIL", name: "Oil India Ltd", sector: "Oil & Gas Exploration", isFnO: true },
    { symbol: "HINDPETRO", name: "Hindustan Petroleum Corp", sector: "Oil Refining", isFnO: true },
    { symbol: "TATAPOWER", name: "Tata Power Co Ltd", sector: "Power Generation & Solar", isFnO: true },
    { symbol: "ADANIGREEN", name: "Adani Green Energy Ltd", sector: "Renewable Energy", isFnO: true },
    { symbol: "ADANIPOWER", name: "Adani Power Ltd", sector: "Thermal Power", isFnO: true },
    { symbol: "NHPC", name: "NHPC Ltd", sector: "Hydro Power", isFnO: true },
    { symbol: "SJVN", name: "SJVN Ltd", sector: "Power Generation", isFnO: true },
    { symbol: "GODREJCP", name: "Godrej Consumer Products", sector: "FMCG / Personal Care", isFnO: true },
    { symbol: "DABUR", name: "Dabur India Ltd", sector: "FMCG / Ayurvedic", isFnO: true },
    { symbol: "MARICO", name: "Marico Ltd", sector: "FMCG / Edible Oil", isFnO: true },
    { symbol: "COLPAL", name: "Colgate-Palmolive India", sector: "Oral Care / FMCG", isFnO: true },
    { symbol: "BERGEPAINT", name: "Berger Paints India Ltd", sector: "Paints / Coatings", isFnO: true },
    { symbol: "PIDILITIND", name: "Pidilite Industries Ltd", sector: "Adhesives & Sealants", isFnO: true },
    { symbol: "SRF", name: "SRF Ltd", sector: "Specialty Chemicals", isFnO: true },
    { symbol: "NAVINFLUOR", name: "Navin Fluorine Int", sector: "Fluorochemicals", isFnO: true },
    { symbol: "DEEPAKNTR", name: "Deepak Nitrite Ltd", sector: "Basic Chemicals / Phenol", isFnO: true },
    { symbol: "TATACHEM", name: "Tata Chemicals Ltd", sector: "Soda Ash / Chemicals", isFnO: true },
    { symbol: "UPL", name: "UPL Ltd", sector: "Agrochemicals / Seeds", isFnO: true },
    { symbol: "PIIND", name: "PI Industries Ltd", sector: "Agrochem Custom Synthesis", isFnO: true },
    { symbol: "COROMANDEL", name: "Coromandel International", sector: "Fertilizers & Nutrients", isFnO: true },
    { symbol: "VOLTAS", name: "Voltas Ltd", sector: "Air Conditioning / Durables", isFnO: true },
    { symbol: "HAVELLS", name: "Havells India Ltd", sector: "Electrical Consumer Durables", isFnO: true },
    { symbol: "CROMPTON", name: "Crompton Greaves Consumer", sector: "Fans & Appliances", isFnO: true },
    { symbol: "WHIRLPOOL", name: "Whirlpool of India Ltd", sector: "Home Appliances", isFnO: true },
    { symbol: "BATAINDIA", name: "Bata India Ltd", sector: "Footwear & Retail", isFnO: true },
    { symbol: "PAGEIND", name: "Page Industries Ltd", sector: "Apparel / Jockey India", isFnO: true },
    { symbol: "ABFRL", name: "Aditya Birla Fashion & Retail", sector: "Apparel & Fashion", isFnO: true },
    { symbol: "JUBLFOOD", name: "Jubilant FoodWorks Ltd", sector: "QSR / Domino's India", isFnO: true },
    { symbol: "DEVYANI", name: "Devyani International Ltd", sector: "QSR / KFC & Pizza Hut", isFnO: true },
    { symbol: "INDHOTEL", name: "Indian Hotels Co Ltd", sector: "Hospitality / Taj Hotels", isFnO: true },
    { symbol: "IRCTC", name: "Indian Railway CTC", sector: "Rail Catering & Ticketing", isFnO: true },
    { symbol: "CONCOR", name: "Container Corp of India", sector: "Rail Container Logistics", isFnO: true },
    { symbol: "DELHIVERY", name: "Delhivery Ltd", sector: "Logistics & Supply Chain", isFnO: true },
    { symbol: "GMRINFRA", name: "GMR Airports Infrastructure", sector: "Airport Infrastructure", isFnO: true },
    { symbol: "OBEROIRLTY", name: "Oberoi Realty Ltd", sector: "Premium Real Estate", isFnO: true },
    { symbol: "GODREJPROP", name: "Godrej Properties Ltd", sector: "Residential Real Estate", isFnO: true },
    { symbol: "PRESTIGE", name: "Prestige Estates Projects", sector: "Real Estate Developer", isFnO: true },
    { symbol: "PHOENIXLTD", name: "The Phoenix Mills Ltd", sector: "Retail Malls & Commercial", isFnO: true },
    { symbol: "BRIGADE", name: "Brigade Enterprises Ltd", sector: "Real Estate & Hospitality", isFnO: true },
    { symbol: "LODHA", name: "Macrotech Developers Ltd", sector: "Real Estate / Lodha", isFnO: true },
    { symbol: "INDIGO", name: "InterGlobe Aviation Ltd", sector: "Airlines / Aviation", isFnO: true },
    { symbol: "NAUKRI", name: "Info Edge India Ltd", sector: "Internet Portals / Naukri", isFnO: true },
    { symbol: "PAYTM", name: "One97 Communications", sector: "Fintech & Payments", isFnO: true },
    { symbol: "NYKAA", name: "FSN E-Commerce Ventures", sector: "Beauty & Fashion E-Com", isFnO: true },
    { symbol: "POLICYBZR", name: "PB Fintech Ltd", sector: "Insurance Broking / Web", isFnO: true },
    { symbol: "MCX", name: "Multi Commodity Exchange", sector: "Commodity Exchange", isFnO: true },
    { symbol: "BSE", name: "BSE Ltd", sector: "Stock Exchange", isFnO: true },
    { symbol: "CDSL", name: "Central Depository Services", sector: "Demat Depository", isFnO: true },
    { symbol: "CAMS", name: "Computer Age Management", sector: "Mutual Fund Registrar", isFnO: true },
    { symbol: "ANGELONE", name: "Angel One Ltd", sector: "Retail Stock Broking", isFnO: true },
    { symbol: "IEX", name: "Indian Energy Exchange", sector: "Power Trading Exchange", isFnO: true }
  ];

  let activeIndex = -1;
  let currentFilter = "all";
  let searchDebounceTimer = null;

  /**
   * Builds combined searchable pool from indices, static stocks,
   * live delivery stocks and MTF stock screener.
   */
  function getSearchPool() {
    const pool = [];
    const seen = new Set();

    // 1. Indices
    GLOBAL_INDICES.forEach(idx => {
      seen.add(idx.symbol.toUpperCase());
      pool.push({
        symbol: idx.symbol,
        label: idx.label,
        name: idx.name,
        sector: idx.sector,
        type: "index",
        badge: "INDEX",
        badgeClass: "badge-index",
        isIndex: true,
        lot: idx.lot
      });
    });

    // 2. Desks
    GLOBAL_DESKS.forEach(d => {
      pool.push({
        symbol: d.title.toUpperCase(),
        label: d.title,
        name: d.subtitle,
        sector: "Terminal Navigation",
        type: "desk",
        deskObj: d,
        badge: d.tag,
        badgeClass: "badge-desk",
        isDesk: true
      });
    });

    // 3. Dynamic runtime data from Delivery Desk
    if (window.allDeliveryStocksGlobal && Array.isArray(window.allDeliveryStocksGlobal)) {
      window.allDeliveryStocksGlobal.forEach(s => {
        const sym = (s.symbol || "").trim().toUpperCase();
        if (sym && !seen.has(sym)) {
          seen.add(sym);
          pool.push({
            symbol: sym,
            label: sym,
            name: `${sym} Listed Equity`,
            sector: "NSE Cash Equities",
            type: "stock",
            badge: "NSE EQ",
            badgeClass: "badge-eq",
            close: s.close,
            delivPer: s.delivPer,
            turnoverCr: s.turnoverCr
          });
        }
      });
    }

    // 4. Dynamic runtime data from MTF Screener
    if (window.mtaData && Array.isArray(window.mtaData.stockScreener)) {
      window.mtaData.stockScreener.forEach(s => {
        const sym = (s.symbol || "").trim().toUpperCase();
        const existing = pool.find(p => p.symbol === sym);
        if (existing) {
          if (s.name) existing.name = s.name;
          if (s.sector) existing.sector = s.sector;
          existing.amtFinancedCrore = s.amtFinancedCrore;
          if (s.isFnO) existing.isFnO = true;
        } else if (sym && !seen.has(sym)) {
          seen.add(sym);
          pool.push({
            symbol: sym,
            label: sym,
            name: s.name || `${sym} Listed Equity`,
            sector: s.sector || "Equities",
            type: "stock",
            badge: s.isFnO ? "F&O" : "MTF",
            badgeClass: s.isFnO ? "badge-fno" : "badge-mtf",
            isFnO: !!s.isFnO,
            amtFinancedCrore: s.amtFinancedCrore
          });
        }
      });
    }

    // 5. Curated Stock List (fallback & cold-boot boost)
    CURATED_STOCKS.forEach(stk => {
      const sym = stk.symbol.toUpperCase();
      const isFno = window.isFnOSymbol ? window.isFnOSymbol(sym) : !!stk.isFnO;
      const existing = pool.find(p => p.symbol === sym);
      if (existing) {
        if (!existing.sector || existing.sector === "Equities") existing.sector = stk.sector;
        if (!existing.name || existing.name.includes("Listed Equity")) existing.name = stk.name;
        existing.isFnO = isFno;
        if (isFno) {
          existing.badge = "F&O";
          existing.badgeClass = "badge-fno";
        }
      } else if (!seen.has(sym)) {
        seen.add(sym);
        pool.push({
          symbol: sym,
          label: sym,
          name: stk.name,
          sector: stk.sector,
          type: "stock",
          badge: isFno ? "F&O" : "NSE EQ",
          badgeClass: isFno ? "badge-fno" : "badge-eq",
          isFnO: isFno
        });
      }
    });

    return pool;
  }

  /**
   * Opens the Global Search Command Palette Modal.
   */
  function openGlobalSearch() {
    const modal = document.getElementById("globalSearchModal");
    const input = document.getElementById("globalSearchInput");
    if (!modal || !input) return;

    modal.style.display = "flex";
    document.body.classList.add("modal-open");
    input.value = "";
    activeIndex = -1;
    currentFilter = "all";
    updateFilterPillUI();

    // Render default popular choices immediately
    renderSearchResults("");

    setTimeout(() => {
      input.focus();
    }, 40);
  }

  /**
   * Closes the Global Search Command Palette Modal.
   */
  function closeGlobalSearch() {
    const modal = document.getElementById("globalSearchModal");
    if (modal) {
      modal.style.display = "none";
    }
    document.body.classList.remove("modal-open");
    activeIndex = -1;
  }

  /**
   * Clears the input and resets list.
   */
  function clearGlobalSearch() {
    const input = document.getElementById("globalSearchInput");
    const clearBtn = document.getElementById("globalSearchClearBtn");
    if (input) {
      input.value = "";
      input.focus();
    }
    if (clearBtn) clearBtn.style.display = "none";
    renderSearchResults("");
  }

  /**
   * Sets the category filter: 'all', 'indices', 'fno', 'desks'.
   */
  function setGsearchFilter(filter) {
    currentFilter = filter || "all";
    updateFilterPillUI();
    const input = document.getElementById("globalSearchInput");
    renderSearchResults(input ? input.value : "");
  }

  function updateFilterPillUI() {
    document.querySelectorAll(".gsearch-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.filter === currentFilter);
    });
  }

  /**
   * Filters and renders matching results.
   */
  function renderSearchResults(queryText) {
    const container = document.getElementById("globalSearchResults");
    const clearBtn = document.getElementById("globalSearchClearBtn");
    if (!container) return;

    const query = (queryText || "").trim().toUpperCase();
    if (clearBtn) clearBtn.style.display = query.length > 0 ? "block" : "none";

    const pool = getSearchPool();
    const cleanQ = query.replace(/[\s\-_]+/g, "");

    let matches = [];

    if (!query) {
      // Prioritize Watchlist items if available
      const wl = (window.getWatchlistSymbols && window.getWatchlistSymbols()) || [];
      const watchlistItems = wl.length
        ? pool.filter(p => wl.includes((p.symbol || "").toUpperCase())).slice(0, 6)
        : [];
      const wlSymbols = new Set(watchlistItems.map(x => (x.symbol || "").toUpperCase()));

      let initialIndices = pool.filter(p => p.type === "index" && !wlSymbols.has((p.symbol || "").toUpperCase())).slice(0, 4);
      let initialDesks = pool.filter(p => p.type === "desk").slice(0, 4);
      let initialStocks = pool.filter(p => p.type === "stock" && p.isFnO && !wlSymbols.has((p.symbol || "").toUpperCase())).slice(0, 4);

      if (currentFilter === "indices") matches = pool.filter(p => p.type === "index");
      else if (currentFilter === "desks") matches = pool.filter(p => p.type === "desk");
      else if (currentFilter === "fno") matches = pool.filter(p => p.type === "stock");
      else matches = [...watchlistItems, ...initialIndices, ...initialDesks, ...initialStocks];
    } else {
      // Fuzzy & Substring matching
      matches = pool.filter(item => {
        // Filter type gate
        if (currentFilter === "indices" && item.type !== "index") return false;
        if (currentFilter === "desks" && item.type !== "desk") return false;
        if (currentFilter === "fno" && item.type !== "stock") return false;

        const sym = (item.symbol || "").toUpperCase();
        const name = (item.name || "").toUpperCase();
        const sector = (item.sector || "").toUpperCase();
        const cleanSym = sym.replace(/[\s\-_]+/g, "");

        return (
          sym.startsWith(query) ||
          cleanSym.startsWith(cleanQ) ||
          sym.includes(query) ||
          cleanSym.includes(cleanQ) ||
          name.includes(query) ||
          sector.includes(query)
        );
      });

      // Priority sort: Exact match > Starts with > Index > Stock > Desk
      matches.sort((a, b) => {
        const aSym = a.symbol.toUpperCase();
        const bSym = b.symbol.toUpperCase();
        if (aSym === query && bSym !== query) return -1;
        if (bSym === query && aSym !== query) return 1;

        const aStarts = aSym.startsWith(query);
        const bStarts = bSym.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        if (a.type === "index" && b.type !== "index") return -1;
        if (b.type === "index" && a.type !== "index") return 1;

        return 0;
      });

      matches = matches.slice(0, 16);
    }

    if (!matches.length) {
      container.innerHTML = `
        <div class="gsearch-empty-state">
          <div style="font-size:32px; margin-bottom:8px;">🔍</div>
          <strong style="font-size:14px; color:var(--text-primary);">No stock or index found for "${queryText}"</strong>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            Press Enter to search "${queryText}" directly in Delivery Desk, or try another NSE symbol.
          </p>
          <div style="margin-top:12px; display:flex; justify-content:center; gap:8px;">
            <button type="button" class="btn btn-compact primary" onclick="globalJumpToDesk('delivery', '${queryText}')">📦 Search in Delivery</button>
            <button type="button" class="btn btn-compact" onclick="globalJumpToDesk('options', '${queryText}')">⚡ Search in Options Pro</button>
          </div>
        </div>
      `;
      activeIndex = -1;
      return;
    }

    let html = "";
    matches.forEach((item, idx) => {
      const isIndex = item.type === "index";
      const isDesk = item.type === "desk";

      // Badge Styling
      let badgeHtml = "";
      if (isIndex) {
        badgeHtml = `<span class="gs-badge gs-badge-index">INDEX</span>`;
      } else if (isDesk) {
        badgeHtml = `<span class="gs-badge gs-badge-desk">DESK</span>`;
      } else {
        const isFno = isIndex || Boolean(item.isFnO || (window.isFnOSymbol && window.isFnOSymbol(item.symbol)));
        if (isFno) {
          badgeHtml = `<span class="gs-badge gs-badge-fno">F&amp;O</span>`;
        } else {
          badgeHtml = `<span class="gs-badge gs-badge-eq">NSE EQ</span>`;
        }
      }

      // Quick Action Buttons Strip
      let actionsHtml = "";
      if (isDesk) {
        actionsHtml = `
          <div class="gs-actions-strip" onclick="event.stopPropagation();">
            <button type="button" class="gs-action-btn opt-jump" onclick="handleDeskClick('${item.deskObj.id}', '${item.deskObj.url || ''}')" title="Open ${item.label}">
              Open Desk →
            </button>
          </div>
        `;
      } else {
        const isFno = isIndex || Boolean(item.isFnO || (window.isFnOSymbol && window.isFnOSymbol(item.symbol)));
        const optTitle = isIndex ? `Open ${item.symbol} Option Chain Pro` : `Inspect ${item.symbol} Greeks & Strike OI`;
        const delivTitle = isIndex ? `Inspect ${item.symbol} Constituent Delivery Absorption` : `Inspect ${item.symbol} Security Delivery`;
        const mtfTitle = `Check ${item.symbol} Broker Margin Book & Pledged Exposure`;
        const futTitle = `View ${item.symbol} Futures Basis & Buildup`;

        actionsHtml = `
          <div class="gs-actions-strip" onclick="event.stopPropagation();">
            ${isFno ? `
            <button type="button" class="gs-action-btn opt-jump" onclick="globalJumpToDesk('options', '${item.symbol}')" title="${optTitle}">
              ⚡ Options
            </button>
            ` : ''}
            <button type="button" class="gs-action-btn deliv-jump" onclick="globalJumpToDesk('delivery', '${item.symbol}')" title="${delivTitle}">
              📦 Delivery
            </button>
            ${!isIndex ? `
            <button type="button" class="gs-action-btn mtf-jump" onclick="globalJumpToDesk('mtf', '${item.symbol}')" title="${mtfTitle}">
              💳 MTF
            </button>
            ` : ''}
            ${isFno ? `
            <button type="button" class="gs-action-btn fut-jump" onclick="globalJumpToDesk('futures', '${item.symbol}')" title="${futTitle}">
              📈 Futures
            </button>
            ` : ''}
          </div>
        `;
      }

      const isStarred = (typeof window.isWatchlisted === "function" && window.isWatchlisted(item.symbol));
      const starBtn = (item.type !== "desk")
        ? `<button type="button" class="gs-star-btn" onclick="event.stopPropagation(); window.toggleWatchlistStockUI && window.toggleWatchlistStockUI('${item.symbol}', this); if (!document.getElementById('gsearchInput')?.value) renderSearchResults('');" title="${isStarred ? 'Remove from Watchlist' : 'Add to Watchlist'}" style="background:transparent; border:none; cursor:pointer; font-size:15px; color:${isStarred ? '#eab308' : '#64748b'}; padding:0 4px; line-height:1;">${isStarred ? '★' : '☆'}</button>`
        : '';

      html += `
        <div class="gsearch-item-row" data-idx="${idx}" data-sym="${item.symbol}" data-type="${item.type}" onclick="handleItemSelect(${idx})">
          <div class="gs-item-left">
            <div class="gs-item-top" style="display:flex; align-items:center; gap:6px;">
              ${starBtn}
              <strong class="gs-item-sym">${item.label || item.symbol}</strong>
              ${badgeHtml}
            </div>
            <div class="gs-item-name" title="${item.name}">${item.name || item.sector}</div>
            <div class="gs-item-sector">${item.sector || ''}</div>
          </div>
          <div class="gs-item-right">
            ${actionsHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    window._lastGsearchMatches = matches;
    activeIndex = 0;
    updateActiveRowHighlight();
  }

  function updateActiveRowHighlight() {
    const rows = document.querySelectorAll(".gsearch-item-row");
    rows.forEach((row, idx) => {
      row.classList.toggle("selected", idx === activeIndex);
      if (idx === activeIndex) {
        row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  function handleItemSelect(idx) {
    const matches = window._lastGsearchMatches || [];
    const item = matches[idx];
    if (!item) return;

    if (item.type === "desk") {
      handleDeskClick(item.deskObj.id, item.deskObj.url);
      return;
    }

    // For stock/index, open the rich cross-desk action hub drawer!
    openGlobalStockHub(item.symbol, item);
  }

  function handleDeskClick(deskId, customUrl) {
    closeGlobalSearch();
    if (customUrl) {
      if (typeof window.navigateDesk === "function") {
        window.navigateDesk("", "", customUrl);
      } else {
        window.location.href = customUrl;
      }
      return;
    }

    if (typeof window.instNav === "function") {
      window.instNav(deskId);
    } else if (typeof window.switchTab === "function") {
      window.switchTab(deskId);
    }
  }

  /**
   * ==========================================================================
   * 🚀 UNIVERSAL CROSS-DESK JUMP FUNCTION
   * Moves user to Option Chain, Delivery Desk, MTF, or Futures seamlessly.
   * ==========================================================================
   */
  function globalJumpToDesk(desk, symbol) {
    if (!symbol) return;
    const cleanSym = String(symbol).trim().toUpperCase();

    const isIndex = cleanSym.includes("NIFTY") || cleanSym.includes("SENSEX") || cleanSym.includes("BANKEX");
    if ((desk === "options" || desk === "futures") && !isIndex) {
      if (window.isFnOSymbol && !window.isFnOSymbol(cleanSym)) {
        alert(`"${cleanSym}" is a cash market equity security and is not traded in the F&O derivatives segment.`);
        return;
      }
    }

    closeGlobalSearch();
    closeGlobalStockHub();

    // 1. OPTION CHAIN PRO
    if (desk === "options") {
      if (typeof window.instNav === "function") {
        window.instNav("upstoxChain");
      } else if (typeof window.switchTab === "function") {
        window.switchTab("upstoxChain");
      }

      const isIndex = cleanSym.includes("NIFTY") || cleanSym.includes("SENSEX");
      const prefix = isIndex ? "NSE_INDEX|" : "NSE_EQ|";
      const upstoxKey = (cleanSym.startsWith("NSE_EQ|") || cleanSym.startsWith("NSE_INDEX|") || cleanSym.startsWith("BSE_INDEX|"))
        ? cleanSym
        : `${prefix}${cleanSym}`;

      if (window.upstoxOptionChain && typeof window.upstoxOptionChain.setInstrument === "function") {
        window.upstoxOptionChain.setInstrument(upstoxKey);
      } else {
        setTimeout(() => {
          if (window.upstoxOptionChain && typeof window.upstoxOptionChain.setInstrument === "function") {
            window.upstoxOptionChain.setInstrument(upstoxKey);
          }
        }, 220);
      }
    }

    // 2. DELIVERY DESK
    else if (desk === "delivery") {
      if (typeof window.instNav === "function") {
        window.instNav("delivery");
      } else if (typeof window.switchTab === "function") {
        window.switchTab("delivery");
      }

      const delivInput = document.getElementById("delivSearchInput");
      if (delivInput) {
        delivInput.value = cleanSym;
      }

      if (typeof window.inspectDeliveryStock === "function") {
        window.inspectDeliveryStock(cleanSym);
      } else {
        setTimeout(() => {
          if (typeof window.inspectDeliveryStock === "function") {
            window.inspectDeliveryStock(cleanSym);
          }
        }, 200);
      }
    }

    // 3. MTF LEVERAGE DESK
    else if (desk === "mtf") {
      if (typeof window.instNav === "function") {
        window.instNav("mtf");
      } else if (typeof window.switchTab === "function") {
        window.switchTab("mtf");
      }

      const mtfSearch = document.getElementById("mtfStockSearch");
      if (mtfSearch) {
        mtfSearch.value = cleanSym;
        mtfSearch.dispatchEvent(new Event("input"));
      }

      if (typeof window.inspectStock === "function") {
        window.inspectStock(cleanSym);
      } else {
        setTimeout(() => {
          if (typeof window.inspectStock === "function") {
            window.inspectStock(cleanSym);
          }
        }, 220);
      }
    }

    // 4. FUTURES DASHBOARD
    else if (desk === "futures") {
      if (typeof window.instNav === "function") {
        window.instNav("futures", "matrix");
      } else if (typeof window.switchTab === "function") {
        window.switchTab("futures");
      }

      const futSearch = document.getElementById("futSearchInput");
      if (futSearch) {
        futSearch.value = cleanSym;
        futSearch.dispatchEvent(new Event("input"));
      }
    }
  }

  /**
   * Opens the Stock Hub Modal (4 Big Distinct Action Destination Cards)
   */
  function openGlobalStockHub(symbol, itemData) {
    const modal = document.getElementById("globalStockHubModal");
    if (!modal) return;

    window._gHubActiveSymbol = symbol;
    const cleanSym = String(symbol).trim().toUpperCase();
    const isIndex = cleanSym.includes("NIFTY") || cleanSym.includes("SENSEX");

    const pool = getSearchPool();
    const item = itemData || pool.find(p => p.symbol === cleanSym) || { symbol: cleanSym, name: cleanSym, sector: "Equities" };

    const isFno = isIndex || Boolean(item.isFnO || (window.isFnOSymbol && window.isFnOSymbol(cleanSym)));

    const symEl = document.getElementById("gHubSymbol");
    const nameEl = document.getElementById("gHubName");
    const badgeEl = document.getElementById("gHubBadge");
    const sectorEl = document.getElementById("gHubSector");
    const mtfCard = document.getElementById("gHubMtfCard");
    const optCard = document.getElementById("gHubOptCard") || modal.querySelector(".opt-card");
    const futCard = document.getElementById("gHubFutCard") || modal.querySelector(".fut-card");

    if (symEl) symEl.textContent = item.label || item.symbol;
    if (nameEl) nameEl.textContent = item.name || `${cleanSym} Listed Security`;
    if (sectorEl) sectorEl.textContent = item.sector || (isIndex ? "Benchmark Index" : "Equities");

    if (badgeEl) {
      if (isIndex) {
        badgeEl.textContent = "INDEX";
        badgeEl.className = "mta-badge";
        badgeEl.style.background = "#ede9fe";
        badgeEl.style.color = "#6d28d9";
      } else if (isFno) {
        badgeEl.textContent = "F&O";
        badgeEl.className = "mta-badge mta-badge-fno";
      } else {
        badgeEl.textContent = "NSE EQ";
        badgeEl.className = "mta-badge mta-badge-cash";
      }
    }

    // Hide MTF card for indices since MTF is cash stock specific
    if (mtfCard) {
      mtfCard.style.display = isIndex ? "none" : "flex";
    }

    // Show Option Chain and Futures cards ONLY for genuine F&O securities
    if (optCard) {
      optCard.style.display = isFno ? "flex" : "none";
    }
    if (futCard) {
      futCard.style.display = isFno ? "flex" : "none";
    }

    // Populate quick snapshot metrics strip
    const metricsWrap = document.getElementById("gHubMetrics");
    if (metricsWrap) {
      metricsWrap.innerHTML = `
        <div class="ghub-metric-box">
          <span class="ghub-m-lbl">Security Type</span>
          <strong class="ghub-m-val">${isIndex ? "Index Derivative" : (isFno ? "Cash & F&O Derivative" : "Cash Market Equity")}</strong>
        </div>
        <div class="ghub-metric-box">
          <span class="ghub-m-lbl">Exchange Segment</span>
          <strong class="ghub-m-val" style="color:#2563eb;">${isIndex ? "NSE / NFO" : (isFno ? "NSE EQ & NFO" : "NSE Capital Market (Cash)")}</strong>
        </div>
        <div class="ghub-metric-box">
          <span class="ghub-m-lbl">Lot Size</span>
          <strong class="ghub-m-val" style="color:#10b981;">${item.lot || (isFno ? "F&O Active" : "1 Share (Cash)")}</strong>
        </div>
        <div class="ghub-metric-box">
          <span class="ghub-m-lbl">Primary Analytics</span>
          <strong class="ghub-m-val" style="color:#7c3aed;">${isFno ? "All 4 Desks Linked" : "Delivery & MTF Margin Desk"}</strong>
        </div>
      `;
    }

    modal.style.display = "flex";
  }

  function closeGlobalStockHub() {
    const modal = document.getElementById("globalStockHubModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  // Keyboard Navigation & Shortcut Binder
  function initKeyboardListeners() {
    window.addEventListener("keydown", (e) => {
      // 1. Open with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        openGlobalSearch();
        return;
      }

      // 2. Open with "/" when not in an input
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        openGlobalSearch();
        return;
      }

      // Check if modal is active
      const modal = document.getElementById("globalSearchModal");
      const isModalOpen = modal && modal.style.display === "flex";
      const hubModal = document.getElementById("globalStockHubModal");
      const isHubOpen = hubModal && hubModal.style.display === "flex";

      if (!isModalOpen && !isHubOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (isHubOpen) closeGlobalStockHub();
        if (isModalOpen) closeGlobalSearch();
        return;
      }

      if (isModalOpen) {
        const rows = document.querySelectorAll(".gsearch-item-row");
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (rows.length > 0) {
            activeIndex = (activeIndex + 1) % rows.length;
            updateActiveRowHighlight();
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (rows.length > 0) {
            activeIndex = (activeIndex - 1 + rows.length) % rows.length;
            updateActiveRowHighlight();
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < rows.length) {
            handleItemSelect(activeIndex);
          } else {
            const input = document.getElementById("globalSearchInput");
            const q = input ? input.value.trim() : "";
            if (q) {
              globalJumpToDesk("delivery", q);
            }
          }
        }
      }
    });

    // Real-time debounced input handler
    const input = document.getElementById("globalSearchInput");
    if (input) {
      input.addEventListener("input", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          renderSearchResults(input.value);
        }, 120);
      });
    }
  }

  // Initialize on DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initKeyboardListeners();
    });
  } else {
    initKeyboardListeners();
  }

  // Expose Global Public API
  window.openGlobalSearch = openGlobalSearch;
  window.closeGlobalSearch = closeGlobalSearch;
  window.clearGlobalSearch = clearGlobalSearch;
  window.setGsearchFilter = setGsearchFilter;
  window.globalJumpToDesk = globalJumpToDesk;
  window.openGlobalStockHub = openGlobalStockHub;
  window.closeGlobalStockHub = closeGlobalStockHub;
  window.handleItemSelect = handleItemSelect;
  window.handleDeskClick = handleDeskClick;

})();
