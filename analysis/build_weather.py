"""Fetch monthly rainfall + temperature per Tamil Nadu district from the
Open-Meteo historical archive (free, no API key) and bundle as weather.json for
the dashboard's Advanced Analytics page.

Rainfall  = monthly sum of daily precipitation (mm)
Temperature = monthly mean of daily mean 2m temperature (°C)
"""
import json, time, urllib.request, urllib.parse, ssl
import geopandas as gpd
from _paths import ROOT

YEARS = [2024, 2025, 2026]
START = "2024-01-01"
END = "2026-06-10"  # archive lags a few days; keep safely in the past
# District boundaries with the canonical `district` property (built by build_data.py)
TN_GEOJSON = ROOT / "dashboard" / "public" / "tamilnadu_districts.geojson"
OUT = ROOT / "dashboard" / "src" / "data" / "weather.json"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch(lat, lon):
    q = urllib.parse.urlencode({
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "start_date": START,
        "end_date": END,
        "daily": "precipitation_sum,temperature_2m_mean",
        "timezone": "Asia/Kolkata",
    })
    req = urllib.request.Request(f"{ARCHIVE}?{q}", headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(3)
    return None


def monthly(daily):
    """Aggregate daily arrays into per-year [12] rain-sum and temp-mean."""
    times = daily["time"]
    precip = daily["precipitation_sum"]
    temp = daily["temperature_2m_mean"]
    rain = {y: [None] * 12 for y in YEARS}
    tsum = {y: [0.0] * 12 for y in YEARS}
    tcnt = {y: [0] * 12 for y in YEARS}
    for t, p, tm in zip(times, precip, temp):
        y = int(t[0:4]); m = int(t[5:7]) - 1
        if y not in rain:
            continue
        if p is not None:
            rain[y][m] = (rain[y][m] or 0.0) + p
        if tm is not None:
            tsum[y][m] += tm; tcnt[y][m] += 1
    out = {}
    for y in YEARS:
        temps = [round(tsum[y][m] / tcnt[y][m], 1) if tcnt[y][m] else None for m in range(12)]
        rains = [round(rain[y][m], 1) if rain[y][m] is not None else None for m in range(12)]
        out[str(y)] = {"rain": rains, "temp": temps}
    return out


gdf = gpd.read_file(TN_GEOJSON)
# Use a projected CRS centroid then convert back to lat/lon to avoid warnings.
cent = gdf.to_crs(3857).geometry.centroid.to_crs(4326)

districts = {}
for i, row in gdf.iterrows():
    name = row["district"]
    lat, lon = cent[i].y, cent[i].x
    print(f"  {name:18s} ({lat:.3f},{lon:.3f}) ...", flush=True)
    data = fetch(lat, lon)
    districts[name] = monthly(data["daily"])
    time.sleep(0.4)

# State aggregate: mean rainfall + mean temperature across districts per month.
state = {}
for y in YEARS:
    rains, temps = [], []
    for m in range(12):
        rv = [districts[d][str(y)]["rain"][m] for d in districts if districts[d][str(y)]["rain"][m] is not None]
        tv = [districts[d][str(y)]["temp"][m] for d in districts if districts[d][str(y)]["temp"][m] is not None]
        rains.append(round(sum(rv) / len(rv), 1) if rv else None)
        temps.append(round(sum(tv) / len(tv), 1) if tv else None)
    state[str(y)] = {"rain": rains, "temp": temps}

out = {
    "meta": {
        "source": "Open-Meteo historical archive (ERA5)",
        "rainfall": "monthly sum of daily precipitation (mm)",
        "temperature": "monthly mean of daily mean 2m temperature (°C)",
        "years": YEARS,
    },
    "districts": districts,
    "state": state,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")
print("Wrote", OUT, "-", len(districts), "districts")
