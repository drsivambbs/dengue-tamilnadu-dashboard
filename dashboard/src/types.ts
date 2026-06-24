// Shared types for the dashboard. Kept central so the data layer (JSON now,
// BigQuery API later) and the UI agree on the same shapes.

export type Page = 'dashboard' | 'analytics' | 'gis' | 'data' | 'population' | 'trend'

// A surveillance year. Kept as `number` (not a fixed union) so future years are
// added by rebuilding dengue.json — no type/code changes. The list of available
// years (YEARS) and per-year month extents live in dataService, derived from data.
export type Year = number

export type Metric = 'cases' | 'attackRate' | 'deaths' | 'cfr'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type ClassMethod = 'quantile' | 'jenks' | 'stddev' | 'equal'

export const CLASS_METHODS: { id: ClassMethod; label: string; help: string }[] = [
  { id: 'quantile', label: 'Quantile', help: 'Equal number of districts per class — good for skewed data' },
  { id: 'jenks', label: 'Natural breaks', help: 'Jenks — groups similar values, splits at natural gaps' },
  { id: 'stddev', label: 'Std. deviation', help: 'Classes around the mean (assumes a normal spread)' },
  { id: 'equal', label: 'Equal interval', help: 'Equal value range per class' },
]

export const METRICS: { id: Metric; label: string; help: string }[] = [
  { id: 'cases', label: 'Reported cases', help: 'Total dengue cases reported' },
  { id: 'attackRate', label: 'Attack rate', help: 'Cases per 100,000 population' },
  { id: 'deaths', label: 'Deaths', help: 'Reported dengue deaths' },
  { id: 'cfr', label: 'Case fatality ratio', help: 'Deaths ÷ cases (%)' },
]

// ---- Data file shapes (dengue.json) ----
export interface DistrictMetric {
  cases: number
  deaths: number
  population: number
  attackRate: number
  cfr: number
}

export interface DistrictRecord {
  district: string
  metrics: Record<string, DistrictMetric>
}

export interface DengueData {
  meta: {
    source: string
    populationSource: string
    years: number[]
    partial: Record<string, string>
  }
  districts: DistrictRecord[]
  stateTotals: Record<string, DistrictMetric>
  monthly: Record<string, Record<string, { cases: number[]; deaths: number[] }>>
}
