"""Build lightweight GIS layers for the GIS dashboard tab:
  district_points.geojson  - district centroids with night-lights value
  district_links.geojson   - lines connecting neighbouring districts (spread net)
Both written to dashboard/public/.
"""
import json
from pathlib import Path
import geopandas as gpd, pandas as pd

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "dashboard" / "public" / "tamilnadu_districts.geojson"
NL = ROOT / "analysis" / "bq_load" / "nightlights.csv"
PUB = ROOT / "dashboard" / "public"

nl = pd.read_csv(NL).set_index("district")["nightlights"].to_dict()
gdf = gpd.read_file(GEO)
names = list(gdf["district"])
geoms = list(gdf.geometry)
cent = gdf.to_crs(3857).geometry.centroid.to_crs(4326)
xy = {names[i]: [round(cent[i].x, 4), round(cent[i].y, 4)] for i in range(len(names))}

# centroids + night-lights
points = {"type": "FeatureCollection", "features": [
    {"type": "Feature",
     "properties": {"district": n, "nightlights": nl.get(n, 0)},
     "geometry": {"type": "Point", "coordinates": xy[n]}}
    for n in names]}
(PUB / "district_points.geojson").write_text(json.dumps(points), encoding="utf-8")

# neighbour links (each border once)
buf = [g.buffer(0.01) for g in geoms]
links = {"type": "FeatureCollection", "features": []}
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        if buf[i].intersects(geoms[j]):
            links["features"].append({
                "type": "Feature",
                "properties": {"a": names[i], "b": names[j]},
                "geometry": {"type": "LineString", "coordinates": [xy[names[i]], xy[names[j]]]}})
(PUB / "district_links.geojson").write_text(json.dumps(links), encoding="utf-8")

print(f"points: {len(points['features'])}  links: {len(links['features'])}")
