// ============================================================
// Tax + All-Cost Comparison: Top 5 Gold ETFs (post Budget 2024)
// ------------------------------------------------------------
// Post Budget 2024 (effective 23-Jul-2024):
//   - Gold ETFs: LTCG (>12mo) = 12.5% no indexation; STCG = slab
// ============================================================

const TAX_INVESTMENT = 1000000;   // ₹10 lakh
const TAX_HOLDING_YEARS = 5;

// Pull top 5 ETFs from leaderboard
const top5Tickers = [...goldEtfs]
  .sort((a, b) => b.bestPickScore - a.bestPickScore)
  .slice(0, 5)
  .map(e => e.ticker);

// Use 5Y CAGR if available; else estimate as (gold 5Y - expense)
function effectiveCagr(etf) {
  if (etf.ret5y != null) return { cagr: etf.ret5y, projected: false };
  return { cagr: +(goldBenchmark.ret5y - etf.expense).toFixed(2), projected: true };
}

// ---------- Cost models ----------
function computeEtfNet(etf) {
  const { cagr, projected } = effectiveCagr(etf);
  const grossFinal  = TAX_INVESTMENT * Math.pow(1 + cagr / 100, TAX_HOLDING_YEARS);
  const dematAmc    = 400 * TAX_HOLDING_YEARS;          // ₹400/yr typical
  const brokerage   = 500;                              // round-trip
  const otherCosts  = dematAmc + brokerage;
  const preTax      = grossFinal - otherCosts;
  const capitalGain = preTax - TAX_INVESTMENT;
  const tax         = Math.max(0, capitalGain) * 0.125; // LTCG 12.5%
  const netTakehome = preTax - tax;
  return {
    asset: etf.ticker,
    fullName: etf.name,
    cagr, projected,
    grossFinal: Math.round(grossFinal),
    upfrontCost: 0,
    holdingCost: dematAmc,
    sellingCost: brokerage,
    totalCosts: otherCosts,
    capitalGain: Math.round(capitalGain),
    tax: Math.round(tax),
    netTakehome: Math.round(netTakehome),
    netGainPct: +((netTakehome - TAX_INVESTMENT) / TAX_INVESTMENT * 100).toFixed(2),
  };
}

// ---------- Build comparison set ----------
const taxComparison = top5Tickers
  .map(t => computeEtfNet(goldEtfs.find(e => e.ticker === t)))
  .sort((a, b) => b.netTakehome - a.netTakehome);
