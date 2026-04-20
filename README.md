# 🥇 Gold ETF India — Strategy Dashboard

> A self-updating, single-page comparison dashboard for every major Gold ETF listed in India.
> Helps you pick the best fund based on returns, expense ratio, tracking error, and **post-tax real-world returns** under Budget 2024 LTCG rules.

[![Made with Python](https://img.shields.io/badge/Made%20with-Python%203.8%2B-blue?logo=python)](https://www.python.org/)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind%20CSS-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Chart.js](https://img.shields.io/badge/Charts-Chart.js-ff6384?logo=chartdotjs)](https://www.chartjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](#-contributing)

---

## ✨ What you get

A single self-contained HTML page with:

- ✅ Side-by-side comparison of 14 major Indian Gold ETFs
- ✅ Expense ratio, AUM, 1Y / 3Y / 5Y returns, tracking error, liquidity ratings
- ✅ **Best Pick Leaderboard** — composite score (40% tracking + 40% cost + 20% liquidity)
- ✅ **ETF vs Physical Gold** tracking-difference visualisation
- ✅ **Post-tax returns** under Budget 2024 LTCG rules (12.5% no indexation)
- ✅ Daily / monthly / quarterly performance breakdowns
- ✅ Auto-updating: a Python script regenerates data from live AMFI NAVs
- ✅ Zero backend — pure static HTML + vanilla JS

---

## 🚀 Quick start

### Requirements

- Python **3.8+** (stdlib only — no `pip install` needed!)
- A web browser

### Run (2 commands)

```bash
git clone https://github.com/<your-username>/gold-etf-india-strategy.git
cd gold-etf-india-strategy
make update-and-share
```

Pulls fresh NAVs and opens the dashboard in your default browser. Done. 🎉

> **No `make`?** Run the equivalent commands directly:
> ```bash
> python3 update_data.py       # fetch latest NAVs, regenerate data.js
> open index.html              # macOS
> # xdg-open index.html        # Linux
> # start index.html           # Windows
> ```

---

## 📂 Project structure

```
gold-etf-india-strategy/
├── index.html              # Single-page dashboard (Tailwind + Chart.js via CDN)
├── data.js                 # AUTO-GENERATED — ETF data + computed metrics
├── tax.js                  # Post-tax real-world return calculator
├── charts.js               # All chart rendering & table logic
├── update_data.py          # Fetches NAVs from MFAPI.in → rewrites data.js (stdlib only!)
├── Makefile                # Friendly wrapper commands
├── launchd/                # macOS scheduled-job template
│   └── com.goldetf.update.plist
├── LICENSE                 # MIT
└── README.md
```

---

## 🛠️ Makefile commands

| Command | What it does |
|---|---|
| `make update` | Fetch latest NAVs and regenerate `data.js` |
| `make serve` | Open `index.html` in your default browser |
| `make update-and-share` | Run `update` then `serve` |
| `make schedule` | (macOS) Install launchd job to auto-update monthly |
| `make unschedule` | (macOS) Remove the auto-update job |

---

## 🗓️ Auto-update on a schedule

### macOS (launchd)

```bash
make schedule
```

Installs a `launchd` job that runs `update_data.py` on the **1st of every month at 09:00**. Logs go to `/tmp/goldetf-update.log`.

To remove:

```bash
make unschedule
```

### Linux (cron)

```bash
(crontab -l 2>/dev/null; echo "0 9 1 * * cd $(pwd) && $(which python3) update_data.py >> /tmp/goldetf-update.log 2>&1") | crontab -
```

To remove: `crontab -e` and delete the line.

### Windows (Task Scheduler)

```powershell
$action = New-ScheduledTaskAction -Execute "python" -Argument "update_data.py" -WorkingDirectory (Get-Location)
$trigger = New-ScheduledTaskTrigger -Monthly -At 9am -DaysOfMonth 1
Register-ScheduledTask -TaskName "GoldETFUpdate" -Action $action -Trigger $trigger
```

---

## 🌐 Network requirement

`update_data.py` fetches from [api.mfapi.in](https://api.mfapi.in) — a free public mirror of AMFI NAV history. **No API key needed.**

If a fetch fails (network down, API blocked by your firewall), the script logs an error and exits **without** overwriting `data.js`. Just run `make update` again later.

---

## 🧠 Methodology

| Metric | How it's computed |
|---|---|
| **1Y / 3Y / 5Y CAGR** | Pulled from MFAPI NAV history; CAGR computed from oldest date ≤ N years ago |
| **Gold benchmark** | Median of `(best ETF return + its expense ratio)` across all ETFs — derives a "what gold actually did" estimate without a separate price feed |
| **Tracking difference** | `ETF return − gold benchmark` (cumulative drag, ≈ expense ratio) |
| **Tracking error** | Manually maintained from AMC factsheets (annualised std-dev of daily diffs — not derivable from monthly NAVs alone) |
| **Best-pick score** | `0.4 × (1 − tracking_err_norm) + 0.4 × (1 − expense_norm) + 0.2 × liquidity_score` |
| **Post-tax return** | Budget 2024 LTCG (12.5% flat, no indexation) + ₹400/yr demat AMC + ₹500 brokerage round-trip |

---

## 📝 Customising

### Add or remove an ETF

Edit `update_data.py` → `ETFS` list:

```python
EtfMeta(
    name="My New Gold ETF",
    ticker="MYGOLD",
    house="My AMC",
    expense=0.45,
    aum_cr=500,
    liquidity="Medium",
    scheme_code=999999,        # Find at https://api.mfapi.in/mf/search?q=gold
    tracking_error=0.10,
)
```

Then `make update` and the report picks it up.

### Change the holding period or investment amount

Edit `tax.js`:

```js
const TAX_INVESTMENT = 1000000;   // ₹10 lakh — change me
const TAX_HOLDING_YEARS = 5;      // change me
```

### Change the gold-benchmark estimation strategy

Edit `derive_gold_benchmark()` in `update_data.py`. Default = median of best-tracker estimates.

---

## 🤝 Contributing

PRs welcome! Some ideas:

- Pull live gold price from a separate API (instead of deriving from ETFs)
- Add an SIP / lump-sum toggle with XIRR calculation
- Add 10-year and 15-year tax projections
- Export the report as PDF
- Add a dark-mode toggle
- Support more international gold ETFs (US: GLD, IAU; UK: SGLN; etc.)

Steps:

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-change`
3. Commit + push
4. Open a Pull Request

---

## ⚠️ Disclaimer

This is **not investment advice**. The numbers shown are educational estimates derived from public MFAPI data and a plain reading of the Income Tax Act. Always verify with the AMC's official factsheet and consult a SEBI-registered advisor before investing.

---

## 📜 License

[MIT](LICENSE) — do whatever you want, just keep the copyright notice.

---

## 🙏 Credits

- NAV data: [MFAPI.in](https://www.mfapi.in/) — free public AMFI mirror
- UI: [Tailwind CSS](https://tailwindcss.com/) (CDN) + [Chart.js](https://www.chartjs.org/) (CDN)
- Icons: emoji 😎
