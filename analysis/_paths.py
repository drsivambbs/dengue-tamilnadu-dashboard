"""Shared paths for the analysis scripts. Resolves everything relative to the
repository root, so scripts can be run from anywhere."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
MAPS = ROOT / "outputs" / "maps"

XLSX = RAW / "dengue_cases_tn_2024-2026_ihip.xlsx"
INDIA_GEOJSON = RAW / "geoBoundaries-IND-ADM2.geojson"
TN_GEOJSON = PROCESSED / "tamilnadu_districts.geojson"
ATTACK_RATES_CSV = PROCESSED / "attack_rates.csv"

# geoBoundaries gbOpen India ADM2 (open / CC-BY) — large source file, not committed
INDIA_GEOJSON_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/"
    "releaseData/gbOpen/IND/ADM2/geoBoundaries-IND-ADM2.geojson"
)

MAPS.mkdir(parents=True, exist_ok=True)
PROCESSED.mkdir(parents=True, exist_ok=True)
