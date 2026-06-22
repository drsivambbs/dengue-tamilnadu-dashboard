"""Local test: does a district's monthly dengue track its NEIGHBOURS' dengue?

Neighbour spread = a free proxy for movement-driven spatial spread, built only
from the district boundaries we already have (no external API).
"""
import json
from pathlib import Path
import geopandas as gpd

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "dashboard" / "public" / "tamilnadu_districts.geojson"
DENGUE = ROOT / "dashboard" / "src" / "data" / "dengue.json"
YEARS = [2024, 2025, 2026]
LAST_T = (2026 - 2024) * 12 + 5  # through Jun 2026 (reported)

# 1. adjacency: which districts share a border (small buffer catches slivers)
gdf = gpd.read_file(GEO)
geoms = list(gdf.geometry)
names = list(gdf["district"])
buffed = [g.buffer(0.01) for g in geoms]
neighbours = {}
for i, ni in enumerate(names):
    neighbours[ni] = [names[j] for j in range(len(names))
                      if i != j and buffed[i].intersects(geoms[j])]

avg_n = sum(len(v) for v in neighbours.values()) / len(neighbours)
print(f"Adjacency built: {len(names)} districts, avg {avg_n:.1f} neighbours each")
print(f"  e.g. Coimbatore borders: {', '.join(neighbours['Coimbatore'])}\n")

# 2. monthly cases as cases[district][t]
d = json.loads(DENGUE.read_text(encoding="utf-8"))
cases = {n: {} for n in names}
for y in YEARS:
    for district, md in d["monthly"][str(y)].items():
        for m in range(12):
            cases[district][(y - 2024) * 12 + m] = md["cases"][m]

def neigh_mean(dist, t):
    vals = [cases[n][t] for n in neighbours[dist] if t in cases[n]]
    return sum(vals) / len(vals) if vals else None

# 3. build pairs: own cases vs neighbour-mean (same month) and (1 month earlier)
own, same, lagged_own, lagged = [], [], [], []
for dist in names:
    for t in range(0, LAST_T + 1):
        if t not in cases[dist]:
            continue
        nm = neigh_mean(dist, t)
        if nm is not None:
            own.append(cases[dist][t]); same.append(nm)
        nlag = neigh_mean(dist, t - 1)
        if t >= 1 and nlag is not None:
            lagged_own.append(cases[dist][t]); lagged.append(nlag)

def pearson(xs, ys):
    n = len(xs); mx = sum(xs)/n; my = sum(ys)/n
    sxy = sum((x-mx)*(y-my) for x, y in zip(xs, ys))
    sxx = sum((x-mx)**2 for x in xs); syy = sum((y-my)**2 for y in ys)
    return sxy / ((sxx*syy) ** 0.5)

print(f"Own cases vs NEIGHBOUR cases, same month:      r = {pearson(own, same):.2f}  (n={len(own)})")
print(f"Own cases vs NEIGHBOUR cases, 1 month earlier: r = {pearson(lagged_own, lagged):.2f}  (n={len(lagged_own)})")
