"""Dengue surveillance edit API — FastAPI over BigQuery.

CRUD on dengue.district_year (the editable surveillance table), with input
validation, derived attack-rate/CFR, and an audit trail. Designed for Cloud Run;
authenticates to BigQuery via the runtime service account (ADC).
"""
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google.cloud import bigquery

PROJECT = os.environ.get("GCP_PROJECT", "merlionz-batchbook")
DATASET = "dengue"
TABLE = f"{PROJECT}.{DATASET}.district_year"
AUDIT = f"{PROJECT}.{DATASET}.audit_log"

client = bigquery.Client(project=PROJECT)
app = FastAPI(title="Dengue Surveillance API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# valid districts (loaded once) to validate input
VALID_DISTRICTS = {
    r["district"] for r in client.query(f"SELECT DISTINCT district FROM `{TABLE}`").result()
}


class Row(BaseModel):
    district: str
    year: int = Field(ge=2000, le=2100)
    cases: int = Field(ge=0)
    deaths: int = Field(ge=0)
    population: int = Field(gt=0)


def _derive(r: Row):
    ar = round(r.cases / r.population * 100000, 1)
    cfr = round(r.deaths / r.cases * 100, 2) if r.cases else 0.0
    return ar, cfr


def _audit(action: str, district: str, year: int, detail: str, user: str):
    client.query(
        f"INSERT INTO `{AUDIT}` (ts, action, district, year, detail, user_email) "
        "VALUES (@ts,@a,@d,@y,@det,@u)",
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("ts", "TIMESTAMP", datetime.now(timezone.utc)),
            bigquery.ScalarQueryParameter("a", "STRING", action),
            bigquery.ScalarQueryParameter("d", "STRING", district),
            bigquery.ScalarQueryParameter("y", "INT64", year),
            bigquery.ScalarQueryParameter("det", "STRING", detail),
            bigquery.ScalarQueryParameter("u", "STRING", user),
        ]),
    ).result()


def _exists(district: str, year: int) -> bool:
    q = client.query(
        f"SELECT COUNT(*) n FROM `{TABLE}` WHERE district=@d AND year=@y",
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("d", "STRING", district),
            bigquery.ScalarQueryParameter("y", "INT64", year),
        ]),
    )
    return next(q.result())["n"] > 0


@app.get("/api/health")
def health():
    return {"status": "ok", "table": TABLE, "districts": len(VALID_DISTRICTS)}


@app.get("/api/rows")
def list_rows():
    rows = client.query(
        f"SELECT district, year, cases, deaths, population, attack_rate, cfr "
        f"FROM `{TABLE}` ORDER BY district, year"
    ).result()
    return [dict(r) for r in rows]


@app.post("/api/rows", status_code=201)
def add_row(r: Row, x_user_email: str = Header(default="anonymous")):
    if r.district not in VALID_DISTRICTS:
        raise HTTPException(400, f"Unknown district: {r.district}")
    if _exists(r.district, r.year):
        raise HTTPException(409, f"{r.district} {r.year} already exists — use update")
    ar, cfr = _derive(r)
    client.query(
        f"INSERT INTO `{TABLE}` (district, year, cases, deaths, population, attack_rate, cfr) "
        "VALUES (@d,@y,@c,@de,@p,@ar,@cfr)",
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("d", "STRING", r.district),
            bigquery.ScalarQueryParameter("y", "INT64", r.year),
            bigquery.ScalarQueryParameter("c", "INT64", r.cases),
            bigquery.ScalarQueryParameter("de", "INT64", r.deaths),
            bigquery.ScalarQueryParameter("p", "INT64", r.population),
            bigquery.ScalarQueryParameter("ar", "FLOAT64", ar),
            bigquery.ScalarQueryParameter("cfr", "FLOAT64", cfr),
        ]),
    ).result()
    _audit("add", r.district, r.year, f"cases={r.cases} deaths={r.deaths} pop={r.population}", x_user_email)
    return {**r.model_dump(), "attack_rate": ar, "cfr": cfr}


@app.put("/api/rows")
def update_row(r: Row, x_user_email: str = Header(default="anonymous")):
    if not _exists(r.district, r.year):
        raise HTTPException(404, f"{r.district} {r.year} not found — use add")
    ar, cfr = _derive(r)
    client.query(
        f"UPDATE `{TABLE}` SET cases=@c, deaths=@de, population=@p, attack_rate=@ar, cfr=@cfr "
        "WHERE district=@d AND year=@y",
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("d", "STRING", r.district),
            bigquery.ScalarQueryParameter("y", "INT64", r.year),
            bigquery.ScalarQueryParameter("c", "INT64", r.cases),
            bigquery.ScalarQueryParameter("de", "INT64", r.deaths),
            bigquery.ScalarQueryParameter("p", "INT64", r.population),
            bigquery.ScalarQueryParameter("ar", "FLOAT64", ar),
            bigquery.ScalarQueryParameter("cfr", "FLOAT64", cfr),
        ]),
    ).result()
    _audit("update", r.district, r.year, f"cases={r.cases} deaths={r.deaths} pop={r.population}", x_user_email)
    return {**r.model_dump(), "attack_rate": ar, "cfr": cfr}


@app.delete("/api/rows")
def delete_row(district: str, year: int, x_user_email: str = Header(default="anonymous")):
    if not _exists(district, year):
        raise HTTPException(404, f"{district} {year} not found")
    client.query(
        f"DELETE FROM `{TABLE}` WHERE district=@d AND year=@y",
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("d", "STRING", district),
            bigquery.ScalarQueryParameter("y", "INT64", year),
        ]),
    ).result()
    _audit("delete", district, year, "", x_user_email)
    return {"deleted": {"district": district, "year": year}}
