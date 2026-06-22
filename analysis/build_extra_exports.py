"""Flatten the newer derived artefacts into CSVs for BigQuery:
  adjacency.csv      - district_a, district_b (both directions)
  climate_model.csv  - the negative-binomial IRR results
(nightlights.csv already produced by build_nightlights.py)
"""
import json, csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "analysis" / "bq_load"
PUB = ROOT / "dashboard" / "public"
DATA = ROOT / "dashboard" / "src" / "data"

# adjacency (both directions, for easy neighbour joins)
links = json.loads((PUB / "district_links.geojson").read_text(encoding="utf-8"))
with open(OUT / "adjacency.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["district_a", "district_b"])
    for ft in links["features"]:
        a, b = ft["properties"]["a"], ft["properties"]["b"]
        w.writerow([a, b]); w.writerow([b, a])

# climate model results
cm = json.loads((DATA / "climate_model.json").read_text(encoding="utf-8"))
with open(OUT / "climate_model.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["factor", "label", "irr", "ci_low", "ci_high", "p_value", "importance", "significant", "lag_months", "n_obs"])
    for fac in cm["factors"]:
        w.writerow([fac["key"], fac["label"], fac["irr"], fac["ci"][0], fac["ci"][1],
                    fac["p"], fac["importance"], fac["significant"], cm["lag_months"], cm["n"]])
print("wrote adjacency.csv and climate_model.csv")
