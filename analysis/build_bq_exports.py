"""Generate flat files for loading into BigQuery from the bundled dashboard data.

Base tables (source of truth):
  monthly.csv           district, year, month, cases, deaths   ← editable counts
  population.csv        district, year, population             ← annual denominator
  weather_monthly.csv   district, year, month, rain_mm, temp_c, humidity_pct
  district_geo.geojsonl newline-delimited GeoJSON features (district + geometry)

district_year is derived from monthly + population as a VIEW (see
load_to_bigquery.sh); district_year.csv is still written for reference / offline use.
"""
import json, csv
from _paths import ROOT

DATA = ROOT / "dashboard" / "src" / "data"
PUBLIC = ROOT / "dashboard" / "public"
OUT = ROOT / "analysis" / "bq_load"
OUT.mkdir(parents=True, exist_ok=True)

dengue = json.loads((DATA / "dengue.json").read_text(encoding="utf-8"))
weather = json.loads((DATA / "weather.json").read_text(encoding="utf-8"))
years = dengue["meta"]["years"]

# 1a. district_year (reference only — BigQuery builds this as a derived VIEW)
with open(OUT / "district_year.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["district", "year", "cases", "deaths", "population", "attack_rate", "cfr"])
    for d in dengue["districts"]:
        for y in years:
            m = d["metrics"][str(y)]
            w.writerow([d["district"], y, m["cases"], m["deaths"], m["population"], m["attackRate"], m["cfr"]])

# 1b. population (annual denominator — editable base table)
with open(OUT / "population.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["district", "year", "population"])
    for d in dengue["districts"]:
        for y in years:
            w.writerow([d["district"], y, d["metrics"][str(y)]["population"]])

# 2. monthly (cases + deaths)
with open(OUT / "monthly.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["district", "year", "month", "cases", "deaths"])
    for y in years:
        for district, md in dengue["monthly"][str(y)].items():
            for i in range(12):
                w.writerow([district, y, i + 1, md["cases"][i], md["deaths"][i]])

# 3. weather_monthly
with open(OUT / "weather_monthly.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["district", "year", "month", "rain_mm", "temp_c", "humidity_pct"])
    for district, yd in weather["districts"].items():
        for y in years:
            wy = yd[str(y)]
            for i in range(12):
                w.writerow([district, y, i + 1, wy["rain"][i], wy["temp"][i], wy["hum"][i]])

# 4. district_geo as newline-delimited GeoJSON (one feature per line)
fc = json.loads((PUBLIC / "tamilnadu_districts.geojson").read_text(encoding="utf-8"))
with open(OUT / "district_geo.geojsonl", "w", encoding="utf-8") as f:
    for feat in fc["features"]:
        f.write(json.dumps({"type": "Feature",
                            "properties": {"district": feat["properties"]["district"]},
                            "geometry": feat["geometry"]}) + "\n")

print("Wrote load files to", OUT)
for p in sorted(OUT.iterdir()):
    print(" ", p.name, f"{p.stat().st_size//1024 or 1} KB")
