"""Local test: per-district night-time lights (VIIRS, 2024 mean radiance) via
Earth Engine, and how it relates to dengue cases / attack rate.

Night-lights = a free proxy for urbanisation / human activity.
"""
import json, statistics as st
from pathlib import Path
import ee

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "dashboard" / "public" / "tamilnadu_districts.geojson"
DENGUE = ROOT / "dashboard" / "src" / "data" / "dengue.json"

ee.Initialize(project="merlionz-batchbook")

# 1. district polygons -> EE FeatureCollection
fc = json.loads(GEO.read_text(encoding="utf-8"))
feats = [ee.Feature(ee.Geometry(f["geometry"]), {"district": f["properties"]["district"]})
         for f in fc["features"]]
districts = ee.FeatureCollection(feats)

# 2. VIIRS night-lights: 2024 mean radiance
viirs = (ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
         .filterDate("2024-01-01", "2024-12-31").select("avg_rad").mean())

# 3. mean radiance per district
stats = viirs.reduceRegions(collection=districts, reducer=ee.Reducer.mean(), scale=500)
rows = stats.getInfo()["features"]
light = {r["properties"]["district"]: r["properties"].get("mean") for r in rows}

# 4. join with cases (2024)
d = json.loads(DENGUE.read_text(encoding="utf-8"))
cases = {rec["district"]: rec["metrics"]["2024"]["cases"] for rec in d["districts"]}
ar = {rec["district"]: rec["metrics"]["2024"]["attackRate"] for rec in d["districts"]}

merged = [(name, light[name], cases[name], ar[name]) for name in cases if light.get(name) is not None]

def pearson(xs, ys):
    n = len(xs); mx = sum(xs)/n; my = sum(ys)/n
    sxy = sum((x-mx)*(y-my) for x, y in zip(xs, ys))
    sxx = sum((x-mx)**2 for x in xs); syy = sum((y-my)**2 for y in ys)
    return sxy/((sxx*syy)**0.5)

lights = [m[1] for m in merged]; cs = [m[2] for m in merged]; ars = [m[3] for m in merged]
print(f"Districts with night-lights: {len(merged)}/38")
print(f"Median night-lights radiance: {st.median(lights):.2f}")
print(f"Correlation  night-lights vs CASES (2024):       r = {pearson(lights, cs):.2f}")
print(f"Correlation  night-lights vs ATTACK RATE (2024): r = {pearson(lights, ars):.2f}\n")

print(f"{'District':16s} {'Lights':>8s} {'Cases':>7s} {'AR/100k':>8s}")
for name, l, c, a in sorted(merged, key=lambda x: -x[1])[:8]:
    print(f"{name:16s} {l:8.2f} {c:7d} {a:8.1f}")
