# Tamil Nadu Dengue Surveillance — Analysis & Dashboard

Secondary data analysis of district-wise dengue surveillance in **Tamil Nadu, India**
(2024–2026), with an interactive GIS dashboard in progress.

Case data are sourced from the **Integrated Health Information Platform (IHIP)**.
Population denominators are from the **Government of Tamil Nadu** (Census 2011,
projected). District boundaries are from **geoBoundaries** (gbOpen, CC-BY).

## Repository structure

```
.
├── data/
│   ├── raw/                 # Original source files (Excel, population PDF, boundaries)
│   └── processed/           # Cleaned, analysis-ready outputs
│       ├── attack_rates.csv         # Per-district population, cases, attack rate (2024–26)
│       └── tamilnadu_districts.geojson  # 38 TN district boundaries (clipped)
├── analysis/                # Reproducible Python scripts
│   ├── _paths.py            # Shared path config
│   ├── make_map.py          # Clip India ADM2 → TN; case-count choropleth
│   ├── attack_rate.py       # Population projection + attack-rate table
│   ├── attack_map.py        # Attack-rate choropleths
│   └── who_map.py           # WHO-style classified choropleths (print quality)
├── outputs/maps/            # Rendered map figures (PNG)
├── dashboard/               # Interactive React + MapLibre dashboard (Phase 1, WIP)
└── requirements.txt
```

## Reproduce the analysis

```bash
pip install -r requirements.txt
cd analysis
python make_map.py      # downloads boundaries on first run (~48 MB), builds TN geojson
python attack_rate.py   # builds data/processed/attack_rates.csv
python attack_map.py    # attack-rate maps
python who_map.py        # WHO-style maps
```

## Methods note

District-level dengue cases (IHIP, 2024–2026) are divided by projected district
populations to compute **attack rates per 100 000**. Denominators derive from
Government of Tamil Nadu Census-2011 district populations, projected to each year
using the state's 2001–2011 geometric growth rate (**1.46%/year**). Mayiladuthurai,
absent from the source population table, was separated from Nagapattinam using 2011
district figures.

> **Note:** 2026 data are partial (Jan–Jun) and are not directly comparable to the
> full-year 2024 and 2025 figures.

## Data sources

- **Cases/deaths:** Integrated Health Information Platform (IHIP), Tamil Nadu
- **Population:** Government of Tamil Nadu (Census 2011, projected)
- **District boundaries:** [geoBoundaries](https://www.geoboundaries.org/) gbOpen IND ADM2 (CC-BY)

## Roadmap

- [x] Data cleaning, attack-rate computation, WHO-style static maps
- [ ] **Phase 1** — Interactive dashboard (Vite + React + TypeScript, MapLibre GL, Recharts)
- [ ] **Phase 2** — Data layer in BigQuery + FastAPI (Cloud Run) API
- [ ] **Phase 3** — Additional GIS layers (facilities, rasters, finer boundaries); public deploy
