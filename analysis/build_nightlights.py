"""Cache per-district night-time-lights (VIIRS 2024 mean radiance) via Earth
Engine so the modelling scripts don't re-query EE each run.
Output: analysis/bq_load/nightlights.csv  (district, nightlights)
"""
import json, csv
from pathlib import Path
import ee

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "dashboard" / "public" / "tamilnadu_districts.geojson"
OUT = ROOT / "analysis" / "bq_load" / "nightlights.csv"
OUT.parent.mkdir(parents=True, exist_ok=True)

ee.Initialize(project="merlionz-batchbook")

fc = json.loads(GEO.read_text(encoding="utf-8"))
feats = [ee.Feature(ee.Geometry(f["geometry"]), {"district": f["properties"]["district"]})
         for f in fc["features"]]
districts = ee.FeatureCollection(feats)

viirs = (ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")
         .filterDate("2024-01-01", "2024-12-31").select("avg_rad").mean())
rows = viirs.reduceRegions(collection=districts, reducer=ee.Reducer.mean(), scale=500).getInfo()["features"]

with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["district", "nightlights"])
    for r in rows:
        w.writerow([r["properties"]["district"], round(r["properties"].get("mean") or 0, 3)])
print("Wrote", OUT, "-", len(rows), "districts")
