# Dashboard (Phase 1 — work in progress)

Interactive GIS dashboard for the Tamil Nadu dengue data.

**Planned stack:** Vite + React + TypeScript · Tailwind CSS · MapLibre GL (`react-map-gl`) · Recharts.

**Data access** is abstracted behind a single `dataService` module so the app can
read a bundled JSON export now and switch to a BigQuery-backed API later without
changing any UI components.

See the repository root [README](../README.md) for the full roadmap.
