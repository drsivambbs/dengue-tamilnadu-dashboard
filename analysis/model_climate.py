"""Negative binomial regression of monthly dengue cases on lagged climate.

Standard ecological count model:
  cases ~ rainfall(t-1) + temperature(t-1) + humidity(t-1) + district
  with an offset of log(population) so we model the *rate*, and a negative
  binomial family to handle overdispersion in the counts.

Reports incidence rate ratios (IRR = exp(coef)) with 95% CIs, and ranks the
three climate factors by standardised effect ("which matters most").
"""
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from statsmodels.genmod.families import Poisson, NegativeBinomial
from _paths import ROOT

LOAD = ROOT / "analysis" / "bq_load"
LAG = 1  # months that climate leads cases

# ---- assemble the monthly panel ----
monthly = pd.read_csv(LOAD / "monthly.csv")
weather = pd.read_csv(LOAD / "weather_monthly.csv")
pop = pd.read_csv(LOAD / "district_year.csv")[["district", "year", "population"]]

df = monthly.merge(weather, on=["district", "year", "month"]).merge(pop, on=["district", "year"])
df["t"] = (df["year"] - 2024) * 12 + (df["month"] - 1)
df = df.sort_values(["district", "t"]).reset_index(drop=True)

for v in ["rain_mm", "temp_c", "humidity_pct"]:
    df[f"{v}_l"] = df.groupby("district")[v].shift(LAG)

df = df[df["t"] <= (2026 - 2024) * 12 + 5]                       # through Jun 2026 (reported)
df = df.dropna(subset=["rain_mm_l", "temp_c_l", "humidity_pct_l", "population"])
df["rain10_l"] = df["rain_mm_l"] / 10.0                          # per 10 mm
df["log_pop"] = np.log(df["population"])

print(f"Observations: {len(df)} district-months  (climate lag = {LAG} month)\n")

FORMULA = "cases ~ rain10_l + temp_c_l + humidity_pct_l + C(district)"
LABELS = {
    "rain10_l": "Rainfall (per +10 mm)",
    "temp_c_l": "Temperature (per +1 °C)",
    "humidity_pct_l": "Humidity (per +1 %)",
}

# ---- overdispersion check (Poisson) -> justifies negative binomial ----
poi = smf.glm(FORMULA, df, family=Poisson(), offset=df["log_pop"]).fit()
dispersion = poi.pearson_chi2 / poi.df_resid
# Cameron-Trivedi estimate of the NB dispersion parameter alpha
mu = poi.mu
aux = smf.ols("aux ~ mu - 1", df.assign(aux=((df["cases"] - mu) ** 2 - df["cases"]) / mu, mu=mu)).fit()
alpha = max(float(aux.params.iloc[0]), 1e-3)
print(f"Poisson dispersion = {dispersion:.1f} (>1 means overdispersed -> negative binomial is appropriate)")
print(f"Estimated NB alpha = {alpha:.3f}\n")

# ---- negative binomial model ----
nb = smf.glm(FORMULA, df, family=NegativeBinomial(alpha=alpha), offset=df["log_pop"]).fit()
ci = nb.conf_int()

print("Incidence Rate Ratios (IRR) — effect of each factor, holding the others constant")
print(f"{'Factor':26s} {'IRR':>6s}  {'95% CI':>16s}  {'p':>8s}")
for k, label in LABELS.items():
    irr = np.exp(nb.params[k])
    lo, hi = np.exp(ci.loc[k, 0]), np.exp(ci.loc[k, 1])
    p = nb.pvalues[k]
    star = "*" if p < 0.05 else " "
    print(f"{label:26s} {irr:6.3f}  [{lo:6.3f}, {hi:6.3f}] {p:8.3f}{star}")

# ---- which matters most: standardised predictors ----
z = df.copy()
for v in ["rain10_l", "temp_c_l", "humidity_pct_l"]:
    z[v] = (z[v] - z[v].mean()) / z[v].std()
nbz = smf.glm(FORMULA, z, family=NegativeBinomial(alpha=alpha), offset=z["log_pop"]).fit()
importance = {k: abs(nbz.params[k]) for k in LABELS}
ranked = sorted(importance, key=importance.get, reverse=True)

print("\nWhich factor matters most (standardised effect size):")
for i, k in enumerate(ranked, 1):
    print(f"  {i}. {LABELS[k]:26s} |effect| = {importance[k]:.3f}")

top = ranked[0]
irr_top = np.exp(nb.params[top])
direction = "more" if irr_top > 1 else "fewer"
print("\nPlain summary:")
print(f"  With rainfall, temperature and humidity considered together, "
      f"{LABELS[top].split(' (')[0].lower()} is the strongest signal.")
print(f"  Each step shown changes expected cases toward {direction} dengue about "
      f"{abs(irr_top - 1) * 100:.0f}% (1 month later), holding the other two constant.")
print("  Note: ecological, correlational analysis — not proof of cause.")

# ---- export results for the dashboard ----
import json
KEY = {"rain10_l": "rain", "temp_c_l": "temp", "humidity_pct_l": "hum"}
factors_out = []
for k, label in LABELS.items():
    factors_out.append({
        "key": KEY[k],
        "label": label.split(" (")[0],
        "irr": round(float(np.exp(nb.params[k])), 3),
        "ci": [round(float(np.exp(ci.loc[k, 0])), 3), round(float(np.exp(ci.loc[k, 1])), 3)],
        "p": round(float(nb.pvalues[k]), 4),
        "importance": round(float(importance[k]), 3),
        "significant": bool(nb.pvalues[k] < 0.05),
    })
out = {
    "model": "negative binomial",
    "lag_months": LAG,
    "n": int(len(df)),
    "ranked": [KEY[k] for k in ranked],
    "factors": factors_out,
}
out_path = ROOT / "dashboard" / "src" / "data" / "climate_model.json"
out_path.write_text(json.dumps(out, indent=1), encoding="utf-8")
print("\nWrote", out_path)
