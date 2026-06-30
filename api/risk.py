"""District outbreak-risk engine.

Self-refitting negative-binomial forecast of the next ~30 days of dengue cases
from live rainfall. The model is re-fit on every (cached) refresh using the
current case data passed in from BigQuery over a rolling window — so as new
months are added it corrects itself, with no hardcoded coefficients.

Pipeline per refresh:
  1. Take monthly cases + population (rolling last WINDOW_MONTHS) from the caller.
  2. Fetch monthly climate for that window (Open-Meteo archive) to build the
     historical panel, and the most recent ~30 days of live rainfall
     (Open-Meteo forecast, up to today) as the predictor for the next month.
  3. Fit  cases ~ rain(t-1) + temp(t-1) + humidity(t-1) + district  with a
     log(population) offset and an NB family (alpha via Cameron-Trivedi).
  4. Predict expected cases for each district from its live rainfall, and the
     probability of exceeding that district's own historical high-season level
     (75th percentile of monthly cases) from the NB distribution.

Ecological, correlational early-warning signal — not a validated forecast.
"""
import json
import math
import ssl
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy.stats import nbinom
from statsmodels.genmod.families import NegativeBinomial, Poisson

COORDS = json.loads((Path(__file__).parent / "district_coords.json").read_text(encoding="utf-8"))
DISTRICTS = list(COORDS)
LATS = ",".join(str(COORDS[d]["lat"]) for d in DISTRICTS)
LONS = ",".join(str(COORDS[d]["lon"]) for d in DISTRICTS)

LAG = 1                 # months climate leads cases
WINDOW_MONTHS = 60      # rolling fit window (≤ 5 years); uses all data until then
THRESHOLD_Q = 0.75      # "elevated month" = a district's 75th-pct monthly cases
RECENT_DAYS = 30        # live rainfall window used as next-month predictor

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
FORECAST = "https://api.open-meteo.com/v1/forecast"

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

_CACHE = {"sig": None, "ts": 0.0, "fit": None}
TTL = 3600  # seconds; live rainfall is daily-resolution, so hourly is plenty


# ---- Open-Meteo (free, no key; multiple locations per call) ----------------

def _get(url: str, params: dict):
    q = urllib.parse.urlencode(params, safe=",")
    req = urllib.request.Request(f"{url}?{q}", headers={"User-Agent": "Mozilla/5.0"})
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90, context=_ctx) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2)
    raise RuntimeError(f"Open-Meteo request failed: {last}")


def _as_list(resp):
    """Multi-location calls return a list; single-location returns an object."""
    return resp if isinstance(resp, list) else [resp]


def _fetch_monthly_climate(start_date: str, end_date: str) -> dict:
    """(district, year, month) -> {rain, temp, hum} from the ERA5 archive."""
    resp = _as_list(_get(ARCHIVE, {
        "latitude": LATS, "longitude": LONS,
        "start_date": start_date, "end_date": end_date,
        "daily": "precipitation_sum,temperature_2m_mean",
        "hourly": "relative_humidity_2m",
        "timezone": "Asia/Kolkata",
    }))
    out: dict = {}
    for d, loc in zip(DISTRICTS, resp):
        daily = loc.get("daily", {})
        rain: dict = {}
        tsum: dict = {}
        tcnt: dict = {}
        for t, p, tm in zip(daily.get("time", []), daily.get("precipitation_sum", []),
                            daily.get("temperature_2m_mean", [])):
            key = (int(t[0:4]), int(t[5:7]))
            if p is not None:
                rain[key] = rain.get(key, 0.0) + p
            if tm is not None:
                tsum[key] = tsum.get(key, 0.0) + tm
                tcnt[key] = tcnt.get(key, 0) + 1
        hourly = loc.get("hourly", {})
        hsum: dict = {}
        hcnt: dict = {}
        for t, h in zip(hourly.get("time", []), hourly.get("relative_humidity_2m", [])):
            if h is None:
                continue
            key = (int(t[0:4]), int(t[5:7]))
            hsum[key] = hsum.get(key, 0.0) + h
            hcnt[key] = hcnt.get(key, 0) + 1
        for key in rain:
            y, m = key
            out[(d, y, m)] = {
                "rain": round(rain[key], 1),
                "temp": round(tsum[key] / tcnt[key], 1) if tcnt.get(key) else None,
                "hum": round(hsum[key] / hcnt[key], 1) if hcnt.get(key) else None,
            }
    return out


def _fetch_recent_climate() -> dict:
    """district -> {rain (sum, last ~30d), temp (mean), hum (mean)} up to today."""
    resp = _as_list(_get(FORECAST, {
        "latitude": LATS, "longitude": LONS,
        "daily": "precipitation_sum,temperature_2m_mean",
        "hourly": "relative_humidity_2m",
        "past_days": 31, "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }))
    today = date.today().isoformat()
    out: dict = {}
    for d, loc in zip(DISTRICTS, resp):
        daily = loc.get("daily", {})
        days = [(t, p, tm) for t, p, tm in zip(
            daily.get("time", []), daily.get("precipitation_sum", []),
            daily.get("temperature_2m_mean", [])) if t <= today][-RECENT_DAYS:]
        rain = sum(p for _, p, _ in days if p is not None)
        temps = [tm for _, _, tm in days if tm is not None]
        hourly = loc.get("hourly", {})
        hums = [h for t, h in zip(hourly.get("time", []), hourly.get("relative_humidity_2m", []))
                if h is not None and t[:10] <= today]
        out[d] = {
            "rain": round(rain, 1),
            "temp": round(sum(temps) / len(temps), 1) if temps else None,
            "hum": round(sum(hums) / len(hums), 1) if hums else None,
        }
    return out


def _tier(prob: float) -> str:
    if prob >= 0.80:
        return "Very high"
    if prob >= 0.50:
        return "High"
    if prob >= 0.25:
        return "Moderate"
    return "Low"


# ---- model (pure: testable with injected climate) --------------------------

def build_and_fit(case_rows: list[dict], monthly_clim: dict, recent_clim: dict) -> dict:
    """Fit the NB model and return per-district artifacts (predicted mean μ, the
    case history and live rainfall) needed to score risk at *any* threshold.
    Pure function so it can be unit-tested with bundled climate."""
    df = pd.DataFrame(case_rows)
    df = df[(df["population"] > 0)].copy()
    df["t"] = df["year"] * 12 + (df["month"] - 1)
    tmax = int(df["t"].max())
    df = df[df["t"] > tmax - WINDOW_MONTHS]

    df["rain"] = df.apply(lambda r: (monthly_clim.get((r["district"], r["year"], r["month"])) or {}).get("rain"), axis=1)
    df["temp"] = df.apply(lambda r: (monthly_clim.get((r["district"], r["year"], r["month"])) or {}).get("temp"), axis=1)
    df["hum"] = df.apply(lambda r: (monthly_clim.get((r["district"], r["year"], r["month"])) or {}).get("hum"), axis=1)

    df = df.sort_values(["district", "t"]).reset_index(drop=True)
    for v in ["rain", "temp", "hum"]:
        df[f"{v}_l"] = df.groupby("district")[v].shift(LAG)
    df["rain10_l"] = df["rain_l"] / 10.0

    case_hist = {d: [float(x) for x in g] for d, g in df.groupby("district")["cases"]}

    fit = df.dropna(subset=["rain10_l", "temp_l", "hum_l", "cases", "population"]).copy()
    fit["log_pop"] = np.log(fit["population"])
    if len(fit) < 50 or fit["district"].nunique() < 2:
        raise RuntimeError(f"not enough data to fit (n={len(fit)})")

    formula = "cases ~ rain10_l + temp_l + hum_l + C(district)"
    poi = smf.glm(formula, fit, family=Poisson(), offset=fit["log_pop"]).fit()
    mu = poi.mu
    aux = smf.ols("aux ~ mu - 1", fit.assign(aux=((fit["cases"] - mu) ** 2 - fit["cases"]) / mu, mu=mu)).fit()
    alpha = max(float(aux.params.iloc[0]), 1e-3)
    nb = smf.glm(formula, fit, family=NegativeBinomial(alpha=alpha), offset=fit["log_pop"]).fit()

    fitted_districts = set(fit["district"])
    latest_pop = fit.sort_values("t").groupby("district")["population"].last()

    pred_rows = []
    for d in DISTRICTS:
        if d not in fitted_districts:
            continue
        rc = recent_clim.get(d) or {}
        if rc.get("rain") is None or rc.get("temp") is None or rc.get("hum") is None:
            continue
        pop = float(latest_pop[d])
        pred_rows.append({
            "district": d, "rain10_l": rc["rain"] / 10.0, "temp_l": rc["temp"],
            "hum_l": rc["hum"], "log_pop": math.log(pop), "population": pop,
            "rain_30d": rc["rain"],
        })
    pf = pd.DataFrame(pred_rows)
    pf["mu"] = np.asarray(nb.predict(pf, offset=pf["log_pop"]))

    return {
        "alpha": float(alpha),
        "nObs": int(len(fit)),
        "asOf": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mu": {r["district"]: float(r["mu"]) for _, r in pf.iterrows()},
        "rain30d": {r["district"]: float(r["rain_30d"]) for _, r in pf.iterrows()},
        "caseHist": case_hist,
    }


def score(fit: dict, threshold_pct: int) -> dict:
    """Score each district's P(cases ≥ its threshold_pct-percentile month) from
    the cached fit — cheap, so the threshold can be moved without re-fitting."""
    q = min(max(threshold_pct, 1), 99) / 100.0
    alpha = fit["alpha"]
    n = 1.0 / alpha
    out = []
    for d, mu_d in fit["mu"].items():
        hist = fit["caseHist"].get(d, [])
        thr = max(int(round(float(np.quantile(hist, q)))) if hist else 1, 1)
        p = n / (n + mu_d)
        prob = float(1.0 - nbinom.cdf(thr - 1, n, p))
        out.append({
            "district": d,
            "predictedCases": round(mu_d, 1),
            "threshold": thr,
            "probability": round(prob, 3),
            "rain30d": round(fit["rain30d"].get(d, 0.0), 1),
            "tier": _tier(prob),
        })
    out.sort(key=lambda x: x["probability"], reverse=True)
    return {
        "model": "negative binomial",
        "lagMonths": LAG,
        "windowMonths": WINDOW_MONTHS,
        "thresholdPct": int(threshold_pct),
        "alpha": round(alpha, 3),
        "nObs": fit["nObs"],
        "asOf": fit["asOf"],
        "horizonDays": 30,
        "districts": out,
    }


def compute_risk(case_rows: list[dict], threshold_pct: int = 75, force: bool = False) -> dict:
    """Cached entry point. The fit (fetch + NB) is cached and re-used; only the
    cheap re-scoring runs when the threshold changes. Re-fits when the case data
    changes or the TTL lapses."""
    sig = (len(case_rows), max((r["year"] * 12 + r["month"] for r in case_rows), default=0),
           int(sum(r["cases"] for r in case_rows)))
    now = time.time()
    if force or not _CACHE["fit"] or _CACHE["sig"] != sig or now - _CACHE["ts"] >= TTL:
        df = pd.DataFrame(case_rows)
        tmax_year = int(df.loc[(df["year"] * 12 + (df["month"] - 1)).idxmax(), "year"])
        start_year = int(max(df["year"].min(), tmax_year - WINDOW_MONTHS // 12 - 1))
        monthly_clim = _fetch_monthly_climate(f"{start_year}-01-01", date.today().isoformat())
        recent_clim = _fetch_recent_climate()
        _CACHE.update(sig=sig, ts=now, fit=build_and_fit(case_rows, monthly_clim, recent_clim))
    return score(_CACHE["fit"], threshold_pct)
