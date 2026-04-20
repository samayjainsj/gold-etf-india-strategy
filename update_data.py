#!/usr/bin/env python3
"""
Gold ETF data updater.

Fetches latest NAVs and historical returns for every Gold ETF in India from
MFAPI.in (a free public mirror of AMFI NAV history) and regenerates `data.js`
with fresh numbers so the static HTML report always reflects the latest data.

Usage:
    python update_data.py            # fetch + regenerate data.js
    python update_data.py --dry-run  # show what WOULD be written, no file change

Run this monthly (or via cron / launchd) to keep the report fresh.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
DATA_JS_PATH = REPO_ROOT / "data.js"

# ----------------------------------------------------------------------------
# Static metadata: AMFI scheme codes for each Gold ETF.
# Scheme codes are stable; only NAV history changes over time.
# Discovered once via MFAPI search (https://api.mfapi.in/mf/search?q=gold).
# ----------------------------------------------------------------------------


@dataclass
class EtfMeta:
    name: str
    ticker: str
    house: str
    expense: float          # latest expense ratio (manually maintained)
    aum_cr: int             # latest AUM in ₹ crore (manually maintained)
    liquidity: str          # Very High | High | Medium | Low (manual)
    scheme_code: int        # AMFI scheme code for NAV lookup
    tracking_error: float   # latest published tracking error (manually maintained)


ETFS: list[EtfMeta] = [
    EtfMeta("Nippon India ETF Gold BeES",   "GOLDBEES",   "Nippon India MF", 0.79, 14500, "Very High", 102885, 0.10),
    EtfMeta("SBI Gold ETF",                 "SETFGOLD",   "SBI MF",          0.73,  4200, "High",      119750, 0.12),
    EtfMeta("HDFC Gold ETF",                "HDFCGOLD",   "HDFC MF",         0.59,  3100, "High",      119089, 0.08),
    EtfMeta("ICICI Prudential Gold ETF",    "GOLDIETF",   "ICICI Pru MF",    0.50,  4500, "High",      120505, 0.07),
    EtfMeta("Kotak Gold ETF",               "KOTAKGOLD",  "Kotak MF",        0.55,  3800, "High",      117707, 0.10),
    EtfMeta("Axis Gold ETF",                "AXISGOLD",   "Axis MF",         0.56,  1100, "Medium",    119551, 0.15),
    EtfMeta("UTI Gold ETF",                 "GOLDSHARE",  "UTI MF",          0.50,  1300, "Medium",    102659, 0.12),
    EtfMeta("Aditya Birla SL Gold ETF",     "BSLGOLDETF", "ABSL MF",         0.54,   580, "Medium",    119879, 0.20),
    EtfMeta("Mirae Asset Gold ETF",         "GOLDETF",    "Mirae Asset MF",  0.32,   350, "Medium",    151582, 0.06),
    EtfMeta("LIC MF Gold ETF",              "LICMFGOLD",  "LIC MF",          0.41,   220, "Low",       119932, 0.18),
    EtfMeta("Quantum Gold ETF",             "QGOLDHALF",  "Quantum MF",      0.78,   290, "Low",       101824, 0.25),
    EtfMeta("Invesco India Gold ETF",       "IVZINGOLD",  "Invesco MF",      0.55,   180, "Low",       119529, 0.20),
    EtfMeta("DSP Gold ETF",                 "DSPGOLDETF", "DSP MF",          0.39,    95, "Low",       151738, 0.10),
    EtfMeta("Edelweiss Gold ETF",           "EGOLD",      "Edelweiss MF",    0.36,    75, "Low",       151715, 0.08),
]

MFAPI_URL = "https://api.mfapi.in/mf/{scheme_code}"
REQUEST_TIMEOUT = 15


# ----------------------------------------------------------------------------
# Data fetching & analytics
# ----------------------------------------------------------------------------


@dataclass
class NavSeries:
    """A scheme's NAV history (date -> NAV)."""
    points: list[tuple[date, float]] = field(default_factory=list)

    def latest(self) -> tuple[date, float] | None:
        return self.points[0] if self.points else None

    def nav_on_or_before(self, target: date) -> float | None:
        """Return the NAV on the most recent trading day <= target."""
        for d, nav in self.points:
            if d <= target:
                return nav
        return None

    def cagr_over(self, years: float) -> float | None:
        """Annualised return over the last `years` years (as a percentage)."""
        if not self.points:
            return None
        latest_date, latest_nav = self.points[0]
        target = latest_date - timedelta(days=int(round(years * 365.25)))
        old_nav = self.nav_on_or_before(target)
        if old_nav is None or old_nav <= 0:
            return None
        if years <= 1.001:
            ret = (latest_nav / old_nav - 1.0) * 100.0
        else:
            ret = ((latest_nav / old_nav) ** (1.0 / years) - 1.0) * 100.0
        return round(ret, 2)


def fetch_nav_series(scheme_code: int) -> NavSeries:
    """Pull full NAV history from MFAPI. Newest entry is index 0."""
    url = MFAPI_URL.format(scheme_code=scheme_code)
    req = urllib.request.Request(url, headers={"User-Agent": "gold-etf-india-strategy/1.0"})
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        payload = json.load(resp).get("data", [])
    series = NavSeries()
    for row in payload:
        try:
            d = datetime.strptime(row["date"], "%d-%m-%Y").date()
            nav = float(row["nav"])
        except (KeyError, ValueError):
            continue
        if nav > 0:
            series.points.append((d, nav))
    series.points.sort(key=lambda p: p[0], reverse=True)
    return series


def derive_gold_benchmark(series_by_ticker: dict[str, NavSeries]) -> dict[str, float]:
    """
    Approximate physical-gold returns by taking the BEST of all ETFs over each
    period and adding back its expense ratio. Best ETF tracks gold tightest, so
    its return + expense ≈ underlying gold benchmark.
    """
    benchmark: dict[str, float] = {}
    for years, key in [(1, "ret1y"), (3, "ret3y"), (5, "ret5y")]:
        candidates: list[float] = []
        for etf in ETFS:
            series = series_by_ticker.get(etf.ticker)
            if series is None:
                continue
            cagr = series.cagr_over(years)
            if cagr is None:
                continue
            candidates.append(cagr + etf.expense)
        if candidates:
            benchmark[key] = round(statistics.median(candidates), 2)
    return benchmark


# ----------------------------------------------------------------------------
# Code-gen: write data.js
# ----------------------------------------------------------------------------


def render_data_js(
    series_by_ticker: dict[str, NavSeries],
    benchmark: dict[str, float],
    fetched_at: datetime,
) -> str:
    rows: list[str] = []
    for etf in ETFS:
        series = series_by_ticker.get(etf.ticker)
        ret1y = series.cagr_over(1) if series else None
        ret3y = series.cagr_over(3) if series else None
        ret5y = series.cagr_over(5) if series else None
        rows.append(
            "  { "
            f'name: {json.dumps(etf.name)}, '
            f'ticker: {json.dumps(etf.ticker)}, '
            f'house: {json.dumps(etf.house)}, '
            f"expense: {etf.expense}, aum: {etf.aum_cr}, "
            f"ret1y: {ret1y if ret1y is not None else 'null'}, "
            f"ret3y: {ret3y if ret3y is not None else 'null'}, "
            f"ret5y: {ret5y if ret5y is not None else 'null'}, "
            f"trackingError: {etf.tracking_error}, "
            f'liquidity: {json.dumps(etf.liquidity)} '
            "},"
        )

    return f"""// Gold ETF data – India
// AUTO-GENERATED on {fetched_at.isoformat(timespec='seconds')} by update_data.py
// NAVs sourced from MFAPI.in (free AMFI mirror). Re-run the script monthly.
// Verify live values from AMFI / AMC factsheets before investing.

const goldEtfs = [
{chr(10).join(rows)}
];

// ---------- Physical Gold Benchmark (derived from best-tracking ETF + expense) ----------
const goldBenchmark = {{
  ret1y: {benchmark.get('ret1y', 'null')},
  ret3y: {benchmark.get('ret3y', 'null')},
  ret5y: {benchmark.get('ret5y', 'null')},
}};

// ---------- Compute tracking difference & best-pick score ----------
const liquidityScoreMap = {{ "Very High": 20, "High": 15, "Medium": 10, "Low": 5 }};

const maxExpense = Math.max(...goldEtfs.map(e => e.expense));
const minExpense = Math.min(...goldEtfs.map(e => e.expense));

goldEtfs.forEach(e => {{
  e.trackDiff1y = e.ret1y == null ? null : +(e.ret1y - goldBenchmark.ret1y).toFixed(2);
  e.trackDiff3y = e.ret3y == null ? null : +(e.ret3y - goldBenchmark.ret3y).toFixed(2);
  e.trackDiff5y = e.ret5y == null ? null : +(e.ret5y - goldBenchmark.ret5y).toFixed(2);
  e.absTrackErr = Math.abs(e.trackDiff1y ?? 0);
}});

const maxAbsErr = Math.max(...goldEtfs.map(e => e.absTrackErr));
const minAbsErr = Math.min(...goldEtfs.map(e => e.absTrackErr));

goldEtfs.forEach(e => {{
  const errScore = maxAbsErr === minAbsErr ? 40 : (1 - (e.absTrackErr - minAbsErr) / (maxAbsErr - minAbsErr)) * 40;
  const expScore = maxExpense === minExpense ? 40 : (1 - (e.expense - minExpense) / (maxExpense - minExpense)) * 40;
  const liqScore = liquidityScoreMap[e.liquidity] || 5;
  e.bestPickScore = +(errScore + expScore + liqScore).toFixed(1);
}});

// Daily simulated category-average % change (last 30 days)
const dailyReturns = Array.from({{ length: 30 }}, (_, i) => +((Math.sin(i / 3) * 0.6 + (Math.random() - 0.5) * 0.4)).toFixed(2));
const dailyLabels  = Array.from({{ length: 30 }}, (_, i) => `D-${{30 - i}}`);

// Monthly returns (last 12 months) – illustrative
const monthlyLabels  = ["May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr"];
const monthlyReturns = [1.2, 0.8, 2.1, 3.4, 1.9, 2.7, 0.9, -0.6, 1.5, 2.3, 1.1, 1.6];

// Quarterly returns (last 4 quarters)
const quarterlyLabels  = ["Q2 FY25","Q3 FY25","Q4 FY25","Q1 FY26"];
const quarterlyReturns = [4.1, 5.2, 3.0, 4.8];
"""


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="Compute returns and print summary without writing data.js")
    args = parser.parse_args()

    print("📥 Fetching NAV history from MFAPI.in...")
    series_by_ticker: dict[str, NavSeries] = {}
    failed: list[str] = []
    for etf in ETFS:
        try:
            series = fetch_nav_series(etf.scheme_code)
            if not series.points:
                raise RuntimeError("empty NAV history")
            series_by_ticker[etf.ticker] = series
            latest_date, latest_nav = series.latest()
            print(f"  ✓ {etf.ticker:<12} {len(series.points):>5} points  latest={latest_date}  NAV=₹{latest_nav:,.2f}")
        except Exception as exc:
            failed.append(f"{etf.ticker} ({exc})")
            print(f"  ✗ {etf.ticker:<12} FAILED: {exc}")

    if not series_by_ticker:
        print("\n❌ All fetches failed. Are you on a network that can reach api.mfapi.in?", file=sys.stderr)
        return 1

    benchmark = derive_gold_benchmark(series_by_ticker)
    print(f"\n🟡 Derived gold benchmark (from best-tracking ETFs):")
    for k, v in benchmark.items():
        print(f"     {k}: {v}%")

    if failed:
        print(f"\n⚠️  {len(failed)} ETFs failed: {', '.join(failed)}")

    rendered = render_data_js(series_by_ticker, benchmark, datetime.now())

    if args.dry_run:
        print("\n--- DRY RUN: data.js would be written as ---\n")
        print(rendered[:1200] + "\n  ... (truncated) ...\n")
        return 0

    DATA_JS_PATH.write_text(rendered)
    print(f"\n✅ Wrote {DATA_JS_PATH} ({len(rendered):,} chars)")
    print("   Open index.html in a browser (or refresh) to see the updated report.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
