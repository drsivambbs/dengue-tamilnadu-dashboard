"""Write the population_base load file for BigQuery.

Population is auto-projected from the 2011 Census base by a per-district annual
growth rate:  population(year) = census_2011 * (1 + growth_pct/100)^(year-2011).

The 2011 Census figures below are the official GoT table (same source used by
analysis/attack_rate.py). Nagapattinam/Mayiladuthurai are split per Census 2011.
The default growth rate is TN's 2001-2011 decadal growth (15.61%) expressed as a
yearly geometric rate; each district gets its own editable rate in the app.

Outputs (to analysis/bq_load/):
  population_base.csv   district, census_2011, growth_pct
"""
import csv
from _paths import ROOT

OUT = ROOT / "analysis" / "bq_load"
OUT.mkdir(parents=True, exist_ok=True)

# 2011 Census population, in LAKHS, keyed to our data district names.
pop_lakhs = {
    'Chennai': 46.47, 'Kanchipuram': 11.66, 'Chengalpattu': 25.56, 'Thiruvallur': 37.28,
    'Cuddalore': 26.06, 'Villupuram': 20.93, 'Kallakurichi': 13.70, 'Vellore': 16.14,
    'Ranipet': 12.10, 'Tirupathur': 11.12, 'Tiruvannamalai': 24.65, 'Salem': 34.82,
    'Namakkal': 17.27, 'Dharmapuri': 15.07, 'Krishnagiri': 18.80, 'Erode': 22.52,
    'Coimbatore': 34.58, 'Tiruppur': 24.79, 'The Nilgiris': 7.35, 'Tiruchirappalli': 27.22,
    'Karur': 10.64, 'Perambalur': 5.65, 'Ariyalur': 7.55, 'Thanjavur': 24.06,
    'Thiruvarur': 12.64, 'Pudukkottai': 16.18, 'Madurai': 30.38, 'Theni': 12.46,
    'Dindigul': 21.60, 'Ramanathapuram': 13.53, 'Virudhunagar': 19.42, 'Sivaganga': 13.39,
    'Tirunelveli': 16.65, 'Tenkasi': 14.08, 'Tuticorin': 17.50, 'Kanniyakumari': 18.70,
    'Nagapattinam': 6.98, 'Mayiladuthurai': 9.18,
}

# TN decadal growth 2001-2011 = 15.61% -> yearly geometric rate (%).
GROWTH_PCT = round((1.1561 ** 0.1 - 1) * 100, 5)  # ≈ 1.46113

with open(OUT / "population_base.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["district", "census_2011", "growth_pct"])
    for district, lakhs in pop_lakhs.items():
        w.writerow([district, round(lakhs * 100000), GROWTH_PCT])

print(f"Wrote {OUT/'population_base.csv'} ({len(pop_lakhs)} districts, growth {GROWTH_PCT}%/yr)")
