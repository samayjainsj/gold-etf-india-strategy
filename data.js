// Gold ETF illustrative data – India
// NOTE: Approximate / representative values for educational comparison only.
// Verify live values from AMFI / AMC factsheets before investing.

const goldEtfs = [
  // trackingError = annualised std dev of daily return difference vs gold benchmark (as published by AMCs / Groww / Value Research)
  { name: "Nippon India ETF Gold BeES",   ticker: "GOLDBEES",    house: "Nippon India MF",   expense: 0.79, aum: 14500, ret1y: 57.4, ret3y: 27.0, ret5y: 17.9, trackingError: 0.10, liquidity: "Very High" },
  { name: "SBI Gold ETF",                 ticker: "SETFGOLD",    house: "SBI MF",            expense: 0.73, aum: 4200,  ret1y: 57.2, ret3y: 26.9, ret5y: 17.8, trackingError: 0.12, liquidity: "High" },
  { name: "HDFC Gold ETF",                ticker: "HDFCGOLD",    house: "HDFC MF",           expense: 0.59, aum: 3100,  ret1y: 57.4, ret3y: 27.1, ret5y: 18.0, trackingError: 0.08, liquidity: "High" },
  { name: "ICICI Prudential Gold ETF",    ticker: "GOLDIETF",    house: "ICICI Pru MF",      expense: 0.50, aum: 4500,  ret1y: 57.5, ret3y: 27.2, ret5y: 18.1, trackingError: 0.07, liquidity: "High" },
  { name: "Kotak Gold ETF",               ticker: "KOTAKGOLD",   house: "Kotak MF",          expense: 0.55, aum: 3800,  ret1y: 57.3, ret3y: 27.0, ret5y: 17.9, trackingError: 0.10, liquidity: "High" },
  { name: "Axis Gold ETF",                ticker: "AXISGOLD",    house: "Axis MF",           expense: 0.56, aum: 1100,  ret1y: 57.1, ret3y: 26.8, ret5y: 17.8, trackingError: 0.15, liquidity: "Medium" },
  { name: "UTI Gold ETF",                 ticker: "GOLDSHARE",   house: "UTI MF",            expense: 0.50, aum: 1300,  ret1y: 57.3, ret3y: 27.0, ret5y: 17.9, trackingError: 0.12, liquidity: "Medium" },
  { name: "Aditya Birla SL Gold ETF",     ticker: "BSLGOLDETF",  house: "ABSL MF",           expense: 0.54, aum: 580,   ret1y: 56.9, ret3y: 26.7, ret5y: 17.7, trackingError: 0.20, liquidity: "Medium" },
  { name: "Mirae Asset Gold ETF",         ticker: "GOLDETF",     house: "Mirae Asset MF",    expense: 0.32, aum: 350,   ret1y: 57.5, ret3y: null, ret5y: null, trackingError: 0.06, liquidity: "Medium" },
  { name: "LIC MF Gold ETF",              ticker: "LICMFGOLD",   house: "LIC MF",            expense: 0.41, aum: 220,   ret1y: 57.2, ret3y: 26.9, ret5y: 17.8, trackingError: 0.18, liquidity: "Low" },
  { name: "Quantum Gold ETF",             ticker: "QGOLDHALF",   house: "Quantum MF",        expense: 0.78, aum: 290,   ret1y: 56.8, ret3y: 26.6, ret5y: 17.6, trackingError: 0.25, liquidity: "Low" },
  { name: "Invesco India Gold ETF",       ticker: "IVZINGOLD",   house: "Invesco MF",        expense: 0.55, aum: 180,   ret1y: 56.9, ret3y: 26.7, ret5y: 17.7, trackingError: 0.20, liquidity: "Low" },
  { name: "DSP Gold ETF",                 ticker: "DSPGOLDETF",  house: "DSP MF",            expense: 0.39, aum: 95,    ret1y: 57.3, ret3y: null, ret5y: null, trackingError: 0.10, liquidity: "Low" },
  { name: "Edelweiss Gold ETF",           ticker: "EGOLD",       house: "Edelweiss MF",      expense: 0.36, aum: 75,    ret1y: 57.4, ret3y: null, ret5y: null, trackingError: 0.08, liquidity: "Low" },
];

// ---------- Physical Gold Benchmark (domestic INR price) ----------
// Updated Apr 2026: Gold has rallied massively due to central bank buying,
// geopolitical tensions, and tariff-driven safe-haven demand.
const goldBenchmark = {
  ret1y: 58.0,   // % return over last 1 year (huge rally!)
  ret3y: 27.5,   // CAGR over last 3 years
  ret5y: 18.3,   // CAGR over last 5 years
};

// ---------- Compute tracking difference & best-pick score ----------
// Tracking diff = ETF return - Gold return (negative = ETF underperformed gold)
// Best-pick score (out of 100):
//   - Tracking error (1Y abs diff)  -> 40 pts (lower is better)
//   - Expense ratio                 -> 40 pts (lower is better)
//   - Liquidity                     -> 20 pts (Very High=20, High=15, Medium=10, Low=5)
const liquidityScoreMap = { "Very High": 20, "High": 15, "Medium": 10, "Low": 5 };

const maxExpense = Math.max(...goldEtfs.map(e => e.expense));
const minExpense = Math.min(...goldEtfs.map(e => e.expense));

goldEtfs.forEach(e => {
  e.trackDiff1y = +(e.ret1y - goldBenchmark.ret1y).toFixed(2);
  e.trackDiff3y = e.ret3y == null ? null : +(e.ret3y - goldBenchmark.ret3y).toFixed(2);
  e.trackDiff5y = e.ret5y == null ? null : +(e.ret5y - goldBenchmark.ret5y).toFixed(2);
  e.absTrackErr = Math.abs(e.trackDiff1y);
});

const maxAbsErr = Math.max(...goldEtfs.map(e => e.absTrackErr));
const minAbsErr = Math.min(...goldEtfs.map(e => e.absTrackErr));

goldEtfs.forEach(e => {
  // Normalize: lower is better -> map to (1 - normalized) * weight
  const errScore = maxAbsErr === minAbsErr ? 40 : (1 - (e.absTrackErr - minAbsErr) / (maxAbsErr - minAbsErr)) * 40;
  const expScore = maxExpense === minExpense ? 40 : (1 - (e.expense - minExpense) / (maxExpense - minExpense)) * 40;
  const liqScore = liquidityScoreMap[e.liquidity] || 5;
  e.bestPickScore = +(errScore + expScore + liqScore).toFixed(1);
});

// Daily simulated category-average % change (last 30 days)
const dailyReturns = Array.from({ length: 30 }, (_, i) => +((Math.sin(i / 3) * 0.6 + (Math.random() - 0.5) * 0.4)).toFixed(2));
const dailyLabels  = Array.from({ length: 30 }, (_, i) => `D-${30 - i}`);

// Monthly returns (last 12 months) – illustrative
const monthlyLabels  = ["May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr"];
const monthlyReturns = [1.2, 0.8, 2.1, 3.4, 1.9, 2.7, 0.9, -0.6, 1.5, 2.3, 1.1, 1.6];

// Quarterly returns (last 4 quarters)
const quarterlyLabels  = ["Q2 FY25","Q3 FY25","Q4 FY25","Q1 FY26"];
const quarterlyReturns = [4.1, 5.2, 3.0, 4.8];
