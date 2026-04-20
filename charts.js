// Render charts and table for the Gold ETF dashboard

const WM = {
  blue: "#0053e2",
  blueLight: "#7aa8ff",
  spark: "#ffc220",
  green: "#2a8703",
  red: "#ea1100",
  gray: "#74767c",
};

document.getElementById("gen-date").textContent = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// ---------- Shared utilities (used by multiple sections) ----------
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// ---------- Table ----------
const liquidityBadge = (lvl) => {
  const map = { "Very High": "badge-green", "High": "badge-blue", "Medium": "badge-yellow", "Low": "badge-red" };
  return `<span class="badge ${map[lvl] || "badge-blue"}">${lvl}</span>`;
};

// Real tracking error: lower = better. Typical Indian Gold ETF range 0.05% – 0.30%.
const trackErrColor = (v) => v <= 0.10 ? 'var(--wm-green)' : (v <= 0.18 ? '#7a5a00' : 'var(--wm-red)');

const tbody = document.getElementById("etfTableBody");
tbody.innerHTML = goldEtfs.map((e, i) => `
  <tr>
    <td class="px-3 py-2 border-b">${i + 1}</td>
    <td class="px-3 py-2 border-b font-medium">${e.name}</td>
    <td class="px-3 py-2 border-b"><code class="text-xs bg-gray-100 px-1.5 py-0.5 rounded">${e.ticker}</code></td>
    <td class="px-3 py-2 border-b text-gray-600">${e.house}</td>
    <td class="px-3 py-2 border-b text-right">${e.expense.toFixed(2)}</td>
    <td class="px-3 py-2 border-b text-right">${e.aum.toLocaleString("en-IN")}</td>
    <td class="px-3 py-2 border-b text-right" style="color: var(--wm-green); font-weight: 600;">${e.ret1y.toFixed(1)}</td>
    <td class="px-3 py-2 border-b text-right font-semibold" style="color: ${trackErrColor(e.trackingError)};">${e.trackingError.toFixed(2)}</td>
    <td class="px-3 py-2 border-b">${liquidityBadge(e.liquidity)}</td>
  </tr>
`).join("");

// ---------- Charts ----------
const labels  = goldEtfs.map(e => e.ticker);
const expRatios = goldEtfs.map(e => e.expense);
const aums      = goldEtfs.map(e => e.aum);
const ret1y     = goldEtfs.map(e => e.ret1y);
const ret3y     = goldEtfs.map(e => e.ret3y ?? 0);
const ret5y     = goldEtfs.map(e => e.ret5y ?? 0);

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true } }
};

new Chart(document.getElementById("expenseChart"), {
  type: "bar",
  data: { labels, datasets: [{ label: "Expense Ratio (%)", data: expRatios, backgroundColor: WM.blue }] },
  options: baseOpts,
});

new Chart(document.getElementById("aumChart"), {
  type: "bar",
  data: { labels, datasets: [{ label: "AUM (₹ Cr)", data: aums, backgroundColor: WM.spark }] },
  options: baseOpts,
});

new Chart(document.getElementById("returnChart"), {
  type: "bar",
  data: { labels, datasets: [{ label: "1-Year Return (%)", data: ret1y, backgroundColor: WM.green }] },
  options: baseOpts,
});

new Chart(document.getElementById("cagrChart"), {
  type: "bar",
  data: {
    labels,
    datasets: [
      { label: "3-Yr CAGR (%)", data: ret3y, backgroundColor: WM.blue },
      { label: "5-Yr CAGR (%)", data: ret5y, backgroundColor: WM.spark },
    ]
  },
  options: baseOpts,
});

// ---------- Tax + Hidden Costs Comparison ----------
(function renderTaxComparison() {
  const sorted = taxComparison;  // already sorted desc by netTakehome
  const best   = sorted[0];
  const second = sorted[1];
  const last   = sorted[sorted.length - 1];

  document.getElementById('taxBestValue').textContent    = inr(best.netTakehome);
  document.getElementById('taxBestName').textContent     = `${best.asset} · +${best.netGainPct}%`;
  document.getElementById('taxBestEtfValue').textContent = inr(second.netTakehome);
  document.getElementById('taxBestEtfName').textContent  = `${second.asset} · +${second.netGainPct}%`;
  document.getElementById('taxWorstValue').textContent   = inr(last.netTakehome);
  document.getElementById('taxWorstName').textContent    = `${last.asset} · +${last.netGainPct}%`;

  const labels = sorted.map(r => r.asset);

  // Net take-home chart
  new Chart(document.getElementById('taxNetChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Net Take-Home (₹)',
        data: sorted.map(r => r.netTakehome),
        backgroundColor: sorted.map((_, i) => i === 0 ? WM.green : WM.blue),
      }]
    },
    options: {
      ...baseOpts,
      indexAxis: 'y',
      scales: { x: { beginAtZero: false, ticks: { callback: (v) => inr(v) } }, y: { ticks: { font: { size: 10 } } } },
    },
  });

  // Stacked cost breakdown (just AMC, brokerage, LTCG tax now — no upfront)
  new Chart(document.getElementById('taxCostChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Demat AMC (5 yrs)', data: sorted.map(r => r.holdingCost), backgroundColor: WM.spark },
        { label: 'Brokerage', data: sorted.map(r => r.sellingCost), backgroundColor: '#9bb8eb' },
        { label: 'LTCG Tax @ 12.5%', data: sorted.map(r => r.tax), backgroundColor: WM.blue },
      ]
    },
    options: {
      ...baseOpts,
      indexAxis: 'y',
      scales: { x: { beginAtZero: true, stacked: true, ticks: { callback: (v) => inr(v) } }, y: { stacked: true, ticks: { font: { size: 10 } } } },
    },
  });

  // Detailed table
  const medal3 = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
  document.getElementById('taxTableBody').innerHTML = sorted.map((r, i) => {
    const projectedTag = r.projected ? '<span class="text-xs text-amber-600" title="5Y data not available; CAGR projected as (gold CAGR − expense)">*proj.</span>' : '';
    return `
      <tr ${i === 0 ? 'style="background:#e1f4d8;"' : ''}>
        <td class="px-3 py-2 border-b text-center font-bold">${medal3(i)}</td>
        <td class="px-3 py-2 border-b"><strong>${r.asset}</strong> ${projectedTag}<div class="text-xs text-gray-500">${r.fullName}</div></td>
        <td class="px-3 py-2 border-b text-right">${r.cagr}%</td>
        <td class="px-3 py-2 border-b text-right">${inr(r.grossFinal)}</td>
        <td class="px-3 py-2 border-b text-right" style="color: var(--wm-red);">${inr(r.totalCosts)}</td>
        <td class="px-3 py-2 border-b text-right" style="color: var(--wm-red);">${inr(r.tax)}</td>
        <td class="px-3 py-2 border-b text-right font-bold" style="color: var(--wm-green);">${inr(r.netTakehome)}</td>
        <td class="px-3 py-2 border-b text-right font-bold" style="color: var(--wm-blue);">+${r.netGainPct}%</td>
      </tr>
    `;
  }).join('');
})();

// ---------- ETF vs Gold Benchmark ----------
const trackDiffs = goldEtfs.map(e => e.trackDiff1y);
const goldLine   = goldEtfs.map(() => goldBenchmark.ret1y);

new Chart(document.getElementById("vsGoldChart"), {
  type: "bar",
  data: {
    labels,
    datasets: [
      { type: "bar",  label: "ETF 1-Yr Return %", data: ret1y, backgroundColor: WM.blue, order: 2 },
      { type: "line", label: "Physical Gold (~58.0%)", data: goldLine, borderColor: WM.spark, borderWidth: 3, borderDash: [6,4], pointRadius: 0, fill: false, order: 1 },
    ]
  },
  options: { ...baseOpts, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: false, suggestedMin: 55, suggestedMax: 60 } } },
});

new Chart(document.getElementById("trackErrChart"), {
  type: "bar",
  data: {
    labels,
    datasets: [{
      label: "Tracking Diff vs Gold (%)",
      data: trackDiffs,
      backgroundColor: trackDiffs.map(v => v >= -0.4 ? WM.green : (v >= -0.7 ? WM.spark : WM.red)),
    }]
  },
  options: { ...baseOpts, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true, suggestedMin: -1.2, suggestedMax: 0.2 } } },
});

// ---------- Best Pick Leaderboard ----------
const ranked = [...goldEtfs].sort((a, b) => b.bestPickScore - a.bestPickScore);

new Chart(document.getElementById("bestPickChart"), {
  type: "bar",
  data: {
    labels: ranked.map(e => e.ticker),
    datasets: [{
      label: "Best-Pick Score (/100)",
      data: ranked.map(e => e.bestPickScore),
      backgroundColor: ranked.map((_, i) => i === 0 ? WM.green : (i < 3 ? WM.blue : "#9bb8eb")),
    }]
  },
  options: { ...baseOpts, indexAxis: "y", scales: { x: { beginAtZero: true, max: 100 }, y: { ticks: { font: { size: 10 } } } } },
});

const medal = (i) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);
const lbBody = document.getElementById("leaderboardBody");
lbBody.innerHTML = ranked.map((e, i) => `
  <tr ${i === 0 ? 'style="background:#e1f4d8;"' : ''}>
    <td class="px-3 py-2 border-b font-bold text-center">${medal(i)}</td>
    <td class="px-3 py-2 border-b"><strong>${e.ticker}</strong> <span class="text-xs text-gray-500">· ${e.house}</span></td>
    <td class="px-3 py-2 border-b text-right" style="color: ${e.trackDiff1y >= -0.4 ? 'var(--wm-green)' : 'var(--wm-red)'};">${e.trackDiff1y.toFixed(2)}</td>
    <td class="px-3 py-2 border-b text-right">${e.expense.toFixed(2)}</td>
    <td class="px-3 py-2 border-b text-right font-bold" style="color: var(--wm-blue);">${e.bestPickScore}</td>
  </tr>
`).join("");

new Chart(document.getElementById("dailyChart"), {
  type: "line",
  data: { labels: dailyLabels, datasets: [{ label: "% Change", data: dailyReturns, borderColor: WM.blue, backgroundColor: "rgba(0,83,226,0.1)", fill: true, tension: 0.3, pointRadius: 0 }] },
  options: { ...baseOpts, scales: { x: { ticks: { font: { size: 9 }, maxTicksLimit: 8 } }, y: { beginAtZero: false } } },
});

new Chart(document.getElementById("monthlyChart"), {
  type: "bar",
  data: { labels: monthlyLabels, datasets: [{ label: "Monthly Return (%)", data: monthlyReturns, backgroundColor: monthlyReturns.map(v => v >= 0 ? WM.green : WM.red) }] },
  options: baseOpts,
});

new Chart(document.getElementById("quarterlyChart"), {
  type: "bar",
  data: { labels: quarterlyLabels, datasets: [{ label: "Quarterly Return (%)", data: quarterlyReturns, backgroundColor: WM.spark }] },
  options: baseOpts,
});
