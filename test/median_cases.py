"""Local sanity test: median annual dengue cases ACROSS districts, per year.
Reads the bundled dengue.json (38 districts x 2024-2026)."""
import json, statistics as st
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "dashboard" / "src" / "data" / "dengue.json"
d = json.loads(DATA.read_text(encoding="utf-8"))
years = d["meta"]["years"]

print(f"{'Year':6s} {'n':>3s} {'Median':>8s} {'Mean':>8s} {'Min':>6s} {'Q1':>7s} {'Q3':>7s} {'Max':>6s}")
for y in years:
    vals = sorted(rec["metrics"][str(y)]["cases"] for rec in d["districts"])
    q = st.quantiles(vals, n=4)  # Q1, Q2(median), Q3
    print(f"{y:<6d} {len(vals):>3d} {st.median(vals):>8.0f} {st.mean(vals):>8.0f} "
          f"{min(vals):>6d} {q[0]:>7.0f} {q[2]:>7.0f} {max(vals):>6d}")

# Which district sits at the median in the latest full year (2025)?
y = 2025
rows = sorted(((rec["metrics"][str(y)]["cases"], rec["district"]) for rec in d["districts"]))
mid = rows[len(rows) // 2]
print(f"\nMedian district in {y}: {mid[1]} ({mid[0]} cases)")
