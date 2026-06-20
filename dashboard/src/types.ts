// Shared types for the dashboard. Kept central so the data layer (JSON now,
// BigQuery API later) and the UI agree on the same shapes.

export type Year = 2024 | 2025 | 2026

export type Metric = 'cases' | 'attackRate' | 'deaths' | 'cfr'

export const YEARS: Year[] = [2024, 2025, 2026]

export const METRICS: { id: Metric; label: string; help: string }[] = [
  { id: 'cases', label: 'Reported cases', help: 'Total dengue cases reported' },
  { id: 'attackRate', label: 'Attack rate', help: 'Cases per 100,000 population' },
  { id: 'deaths', label: 'Deaths', help: 'Reported dengue deaths' },
  { id: 'cfr', label: 'Case fatality ratio', help: 'Deaths ÷ cases (%)' },
]
