#!/usr/bin/env bash
# Create the BigQuery dataset + GCS bucket and load the Tamil Nadu dengue data.
# Reproducible Phase 2 data-layer setup. Run after `python build_bq_exports.py`.
#
# Usage:
#   PROJECT=your-project-id BUCKET=your-bucket LOCATION=asia-south1 bash load_to_bigquery.sh
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project)}"
LOCATION="${LOCATION:-asia-south1}"
BUCKET="${BUCKET:-${PROJECT}-dengue-tn}"
DS="dengue"
DIR="$(dirname "$0")/bq_load"

echo "Project=$PROJECT  Location=$LOCATION  Bucket=$BUCKET"

# Dataset + bucket (ignore 'already exists')
bq --location="$LOCATION" mk --dataset --description "Tamil Nadu dengue surveillance" "$PROJECT:$DS" || true
gcloud storage buckets create "gs://$BUCKET" --location="$LOCATION" --uniform-bucket-level-access || true

# Base tables (source of truth): monthly counts + annual population
bq --location="$LOCATION" load --source_format=CSV --skip_leading_rows=1 --replace \
  "$DS.monthly" "$DIR/monthly.csv" \
  district:STRING,year:INTEGER,month:INTEGER,cases:INTEGER,deaths:INTEGER

bq --location="$LOCATION" load --source_format=CSV --skip_leading_rows=1 --replace \
  "$DS.population" "$DIR/population.csv" \
  district:STRING,year:INTEGER,population:INTEGER

# district_year is DERIVED from monthly + population (always consistent)
bq --location="$LOCATION" query --use_legacy_sql=false \
"CREATE OR REPLACE VIEW \`$PROJECT.$DS.district_year\` AS
 SELECT m.district, m.year,
        SUM(m.cases)  AS cases,
        SUM(m.deaths) AS deaths,
        ANY_VALUE(p.population) AS population,
        ROUND(SAFE_DIVIDE(SUM(m.cases),  ANY_VALUE(p.population)) * 100000, 1) AS attack_rate,
        ROUND(SAFE_DIVIDE(SUM(m.deaths), SUM(m.cases)) * 100, 2) AS cfr
 FROM \`$PROJECT.$DS.monthly\` m
 LEFT JOIN \`$PROJECT.$DS.population\` p USING (district, year)
 GROUP BY m.district, m.year"

bq --location="$LOCATION" load --source_format=CSV --skip_leading_rows=1 --replace \
  "$DS.weather_monthly" "$DIR/weather_monthly.csv" \
  district:STRING,year:INTEGER,month:INTEGER,rain_mm:FLOAT,temp_c:FLOAT

# District boundaries -> GEOGRAPHY column
bq --location="$LOCATION" load --source_format=NEWLINE_DELIMITED_JSON --json_extension=GEOJSON \
  --autodetect --replace "$DS.district_geo" "$DIR/district_geo.geojsonl"

# Stage source/processed files in the bucket
gcloud storage cp "$DIR"/*.csv "gs://$BUCKET/bq_load/"

echo "Done. Dataset $PROJECT:$DS ready."
