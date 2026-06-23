"""Dengue surveillance edit API — FastAPI over BigQuery.

Data model (monthly = source of truth):
  monthly             district, year, month, cases, deaths  ← editable counts
  population_base     district, census_2011, growth_pct     ← 2011 census + per-district growth
  population_override district, year, population            ← optional official figure
  population          ← VIEW: COALESCE(override, census_2011 × (1+growth)^(year-2011))
  district_year       ← VIEW deriving annual rollup + AR/CFR

Population changes once a year and is auto-projected from the 2011 Census base
by a per-district growth rate; an admin may override a specific district-year
with an official figure. Managed on its own Population tab, separate from cases.

The Data tab reads /api/rows with an optional month filter:
  - month 1-12  → one row per district for that month (cases/deaths editable),
                  attack-rate/CFR computed for that month against the population.
  - no month    → annual rollup per district (sum of months). Counts and
                  population are read-only here; population is managed elsewhere.

Designed for Cloud Run; authenticates to BigQuery via the runtime service
account (ADC). NOTE: still PUBLIC/unauthenticated — add sign-in + roles before
real use.
"""
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google.cloud import bigquery

PROJECT = os.environ.get("GCP_PROJECT", "merlionz-batchbook")
DATASET = "dengue"
MONTHLY = f"{PROJECT}.{DATASET}.monthly"
POP = f"{PROJECT}.{DATASET}.population"           # VIEW (read-only)
POP_BASE = f"{PROJECT}.{DATASET}.population_base"
POP_OVR = f"{PROJECT}.{DATASET}.population_override"
AUDIT = f"{PROJECT}.{DATASET}.audit_log"

client = bigquery.Client(project=PROJECT)
app = FastAPI(title="Dengue Surveillance API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# valid districts (loaded once) to validate input
VALID_DISTRICTS = {
    r["district"] for r in client.query(f"SELECT DISTINCT district FROM `{MONTHLY}`").result()
}


def _params(**kv):
    """Build a QueryJobConfig from name -> (type, value) pairs."""
    return bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter(k, t, v) for k, (t, v) in kv.items()
    ])


def _run(sql: str, **kv):
    return client.query(sql, job_config=_params(**kv)).result()


def _audit(action: str, district: str, year: int, month, detail: str, user: str):
    _run(
        f"INSERT INTO `{AUDIT}` (ts, action, district, year, month, detail, user_email) "
        "VALUES (@ts,@a,@d,@y,@m,@det,@u)",
        ts=("TIMESTAMP", datetime.now(timezone.utc)), a=("STRING", action),
        d=("STRING", district), y=("INT64", year), m=("INT64", month),
        det=("STRING", detail), u=("STRING", user),
    )


# ---- models ---------------------------------------------------------------

class MonthlyRow(BaseModel):
    district: str
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    cases: int = Field(ge=0)
    deaths: int = Field(ge=0)


class YearRow(BaseModel):
    district: str
    year: int = Field(ge=2000, le=2100)


class BaseRow(BaseModel):
    district: str
    census_2011: int = Field(gt=0)
    growth_pct: float = Field(ge=-5, le=10)


class OverrideRow(BaseModel):
    district: str
    year: int = Field(ge=2000, le=2100)
    population: int = Field(gt=0)


# ---- read -----------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "districts": len(VALID_DISTRICTS)}


@app.get("/api/rows")
def list_rows(year: Optional[int] = None, month: Optional[int] = None, months: bool = False):
    """Rows with derived attack-rate / CFR that respond to the month filter.

    - month in 1-12 → just that month, one row per district
    - months=true   → every month expanded, one row per district-month
    - otherwise     → annual rollup (one row per district-year, month=null)
    """
    y = ("INT64", year or 0)

    if months or (month and 1 <= month <= 12):
        params = {"y": y}
        clauses = []
        if year:
            clauses.append("m.year=@y")
        if month and 1 <= month <= 12:
            clauses.append("m.month=@mo")
            params["mo"] = ("INT64", month)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = f"""
        SELECT m.district, m.year, m.month, m.cases, m.deaths,
               p.population,
               ROUND(SAFE_DIVIDE(m.cases, p.population) * 100000, 1) AS attack_rate,
               ROUND(SAFE_DIVIDE(m.deaths, m.cases) * 100, 2) AS cfr
        FROM `{MONTHLY}` m
        LEFT JOIN `{POP}` p USING (district, year)
        {where}
        ORDER BY m.district, m.year, m.month
        """
        rows = client.query(sql, job_config=_params(**params)).result()
    else:
        where_year = "WHERE m.year=@y" if year else ""
        sql = f"""
        SELECT m.district, m.year, NULL AS month,
               SUM(m.cases) AS cases, SUM(m.deaths) AS deaths,
               ANY_VALUE(p.population) AS population,
               ROUND(SAFE_DIVIDE(SUM(m.cases), ANY_VALUE(p.population)) * 100000, 1) AS attack_rate,
               ROUND(SAFE_DIVIDE(SUM(m.deaths), SUM(m.cases)) * 100, 2) AS cfr
        FROM `{MONTHLY}` m
        LEFT JOIN `{POP}` p USING (district, year)
        {where_year}
        GROUP BY m.district, m.year
        ORDER BY m.district, m.year
        """
        rows = client.query(sql, job_config=_params(y=y)).result()
    return [dict(r) for r in rows]


# ---- write: monthly counts ------------------------------------------------

@app.put("/api/monthly")
def upsert_monthly(r: MonthlyRow, x_user_email: str = Header(default="anonymous")):
    if r.district not in VALID_DISTRICTS:
        raise HTTPException(400, f"Unknown district: {r.district}")
    _run(
        f"""MERGE `{MONTHLY}` T
        USING (SELECT @d AS district, @y AS year, @m AS month) S
        ON T.district=S.district AND T.year=S.year AND T.month=S.month
        WHEN MATCHED THEN UPDATE SET cases=@c, deaths=@de
        WHEN NOT MATCHED THEN INSERT (district, year, month, cases, deaths)
          VALUES (@d, @y, @m, @c, @de)""",
        d=("STRING", r.district), y=("INT64", r.year), m=("INT64", r.month),
        c=("INT64", r.cases), de=("INT64", r.deaths),
    )
    _audit("month_upsert", r.district, r.year, r.month,
           f"cases={r.cases} deaths={r.deaths}", x_user_email)
    return r.model_dump()


# ---- population: base (2011 census + per-district growth) ------------------

@app.get("/api/population/base")
def list_base():
    rows = client.query(
        f"SELECT district, census_2011, growth_pct FROM `{POP_BASE}` ORDER BY district"
    ).result()
    return [dict(r) for r in rows]


@app.put("/api/population/base")
def upsert_base(r: BaseRow, x_user_email: str = Header(default="anonymous")):
    if r.district not in VALID_DISTRICTS:
        raise HTTPException(400, f"Unknown district: {r.district}")
    _run(
        f"""MERGE `{POP_BASE}` T
        USING (SELECT @d AS district) S ON T.district=S.district
        WHEN MATCHED THEN UPDATE SET census_2011=@c, growth_pct=@g
        WHEN NOT MATCHED THEN INSERT (district, census_2011, growth_pct) VALUES (@d, @c, @g)""",
        d=("STRING", r.district), c=("INT64", r.census_2011), g=("FLOAT64", r.growth_pct),
    )
    _audit("pop_base", r.district, None, None,
           f"census_2011={r.census_2011} growth_pct={r.growth_pct}", x_user_email)
    return r.model_dump()


# ---- population: effective values (projected, with overrides) --------------

@app.get("/api/population")
def list_population(year: Optional[int] = None):
    where = "WHERE year=@y" if year else ""
    rows = client.query(
        f"SELECT district, year, population, is_override FROM `{POP}` {where} ORDER BY district, year",
        job_config=_params(y=("INT64", year or 0)),
    ).result()
    return [dict(r) for r in rows]


@app.put("/api/population/override")
def upsert_override(r: OverrideRow, x_user_email: str = Header(default="anonymous")):
    if r.district not in VALID_DISTRICTS:
        raise HTTPException(400, f"Unknown district: {r.district}")
    _run(
        f"""MERGE `{POP_OVR}` T
        USING (SELECT @d AS district, @y AS year) S
        ON T.district=S.district AND T.year=S.year
        WHEN MATCHED THEN UPDATE SET population=@p
        WHEN NOT MATCHED THEN INSERT (district, year, population) VALUES (@d, @y, @p)""",
        d=("STRING", r.district), y=("INT64", r.year), p=("INT64", r.population),
    )
    _audit("pop_override", r.district, r.year, None, f"population={r.population}", x_user_email)
    return r.model_dump()


@app.delete("/api/population/override")
def delete_override(district: str, year: int, x_user_email: str = Header(default="anonymous")):
    """Remove an official override → the district-year reverts to the projection."""
    _run(f"DELETE FROM `{POP_OVR}` WHERE district=@d AND year=@y",
         d=("STRING", district), y=("INT64", year))
    _audit("pop_override_clear", district, year, None, "", x_user_email)
    return {"reverted": {"district": district, "year": year}}


# ---- add / delete a district-year (case data; population auto-projects) ----

@app.post("/api/year", status_code=201)
def add_year(r: YearRow, x_user_email: str = Header(default="anonymous")):
    """Register a new district-year for case entry: seed 12 zero months.
    Population is auto-projected from the census base — no need to enter it."""
    if r.district not in VALID_DISTRICTS:
        raise HTTPException(400, f"Unknown district: {r.district}")
    exists = next(client.query(
        f"SELECT COUNT(*) n FROM `{MONTHLY}` WHERE district=@d AND year=@y",
        job_config=_params(d=("STRING", r.district), y=("INT64", r.year)),
    ).result())["n"]
    if exists:
        raise HTTPException(409, f"{r.district} {r.year} already exists — edit it instead")
    _run(
        f"""INSERT INTO `{MONTHLY}` (district, year, month, cases, deaths)
        SELECT @d, @y, mo, 0, 0 FROM UNNEST(GENERATE_ARRAY(1, 12)) AS mo""",
        d=("STRING", r.district), y=("INT64", r.year),
    )
    _audit("year_add", r.district, r.year, None, "seeded 12 months", x_user_email)
    return r.model_dump()


@app.delete("/api/year")
def delete_year(district: str, year: int, x_user_email: str = Header(default="anonymous")):
    _run(f"DELETE FROM `{MONTHLY}` WHERE district=@d AND year=@y",
         d=("STRING", district), y=("INT64", year))
    _run(f"DELETE FROM `{POP_OVR}` WHERE district=@d AND year=@y",
         d=("STRING", district), y=("INT64", year))
    _audit("year_delete", district, year, None, "", x_user_email)
    return {"deleted": {"district": district, "year": year}}
