"""Local test: how the four predictors INTERACT.
  Step 1  - how much the predictors overlap each other (collinearity)
  Method 1 - interaction terms in a negative binomial model
  Method 2 - Random Forest + SHAP interaction values (exploratory)

Predictors: rainfall(t-1), humidity(t-1), neighbour cases(t-1), night-lights.
"""
import json, warnings
from pathlib import Path
import numpy as np, pandas as pd, geopandas as gpd
import statsmodels.api as sm, statsmodels.formula.api as smf
from statsmodels.genmod.families import Poisson, NegativeBinomial
warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "dashboard" / "public" / "tamilnadu_districts.geojson"
dengue = json.loads((ROOT / "dashboard/src/data/dengue.json").read_text(encoding="utf-8"))
weather = json.loads((ROOT / "dashboard/src/data/weather.json").read_text(encoding="utf-8"))
nl = pd.read_csv(ROOT / "analysis/bq_load/nightlights.csv").set_index("district")["nightlights"].to_dict()
YEARS = [2024, 2025, 2026]
LAST_T = (2026 - 2024) * 12 + 5

# adjacency
gdf = gpd.read_file(GEO); geoms = list(gdf.geometry); names = list(gdf["district"])
buf = [g.buffer(0.01) for g in geoms]
neighbours = {names[i]: [names[j] for j in range(len(names)) if i != j and buf[i].intersects(geoms[j])]
              for i in range(len(names))}

pop_by = {r["district"]: {y: r["metrics"][str(y)]["population"] for y in YEARS} for r in dengue["districts"]}

rows = []
for y in YEARS:
    for dist, md in dengue["monthly"][str(y)].items():
        w = weather["districts"][dist][str(y)]
        for m in range(12):
            rows.append(dict(district=dist, t=(y - 2024) * 12 + m, month=m + 1,
                             cases=md["cases"][m], rain=w["rain"][m], hum=w["hum"][m],
                             pop=pop_by[dist][y], nightlights=nl[dist]))
df = pd.DataFrame(rows)
look = {(r.district, r.t): r.cases for r in df.itertuples()}
df["neigh"] = [np.mean([look[(n, r.t)] for n in neighbours[r.district] if (n, r.t) in look]) for r in df.itertuples()]

df = df.sort_values(["district", "t"])
for c in ["rain", "hum", "neigh"]:
    df[f"{c}_l1"] = df.groupby("district")[c].shift(1)
df = df[df.t <= LAST_T].dropna(subset=["rain_l1", "hum_l1", "neigh_l1", "pop"])
df["rain10_l1"] = df["rain_l1"] / 10
df["log_pop"] = np.log(df["pop"])
print(f"Panel: {len(df)} district-months\n")

# ---- Step 1: predictor overlap (correlation among predictors) ----
print("STEP 1 — how much the predictors overlap (correlation):")
corr = df[["rain_l1", "hum_l1", "neigh_l1", "nightlights", "pop"]].corr().round(2)
corr.columns = ["rain", "humid", "neigh", "lights", "pop"]; corr.index = corr.columns
print(corr.to_string(), "\n")

# ---- Method 1: negative binomial with interactions ----
for c in ["rain10_l1", "hum_l1", "neigh_l1", "nightlights"]:
    df[c + "_z"] = (df[c] - df[c].mean()) / df[c].std()
F = "cases ~ rain10_l1_z*hum_l1_z + rain10_l1_z*nightlights_z + neigh_l1_z"
poi = smf.glm(F, df, family=Poisson(), offset=df["log_pop"]).fit()
mu = poi.mu
alpha = max(float(smf.ols("aux ~ mu - 1", df.assign(aux=((df.cases - mu) ** 2 - df.cases) / mu, mu=mu)).fit().params.iloc[0]), 1e-3)
nb = smf.glm(F, df, family=NegativeBinomial(alpha=alpha), offset=df["log_pop"]).fit()
print("METHOD 1 — interaction terms (negative binomial):")
terms = {
    "rain10_l1_z:hum_l1_z": "Rainfall x Humidity",
    "rain10_l1_z:nightlights_z": "Rainfall x Urbanisation(lights)",
}
for k, lab in terms.items():
    if k in nb.params:
        irr = np.exp(nb.params[k]); p = nb.pvalues[k]
        verdict = "SIGNIFICANT" if p < 0.05 else "not significant"
        print(f"  {lab:34s} IRR={irr:5.3f}  p={p:6.3f}  -> {verdict}")
print()

# ---- Method 2: Random Forest + SHAP interaction (exploratory) ----
from sklearn.ensemble import RandomForestRegressor
import shap
df["ar"] = df["cases"] / df["pop"] * 1e5
feats = ["rain_l1", "hum_l1", "neigh_l1", "nightlights", "month"]
X = df[feats]; yv = df["ar"]
rf = RandomForestRegressor(n_estimators=200, min_samples_leaf=5, random_state=0).fit(X, yv)
inter = shap.TreeExplainer(rf).shap_interaction_values(X)
mabs = np.abs(inter).mean(axis=0)
pairs = sorted(((feats[i], feats[j], mabs[i, j] + mabs[j, i])
                for i in range(len(feats)) for j in range(i + 1, len(feats))),
               key=lambda x: -x[2])
print("METHOD 2 — strongest interacting pairs (SHAP, exploratory):")
for a, b, v in pairs[:4]:
    print(f"  {a:12s} x {b:12s} strength={v:.2f}")
