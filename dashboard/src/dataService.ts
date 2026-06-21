/**
 * Single data-access layer for the whole dashboard.
 *
 * Phase 1 reads the bundled JSON export. In Phase 2 this same module will be
 * reimplemented to call the BigQuery-backed API — the UI components depend only
 * on these functions, so nothing above this file changes.
 */
import data from './data/dengue.json'
import weatherData from './data/weather.json'
import type { DengueData, DistrictMetric, Metric, Year } from './types'

const db = data as unknown as DengueData

interface WeatherYear {
  rain: (number | null)[]
  temp: (number | null)[]
  hum?: (number | null)[]
}
const weather = weatherData as unknown as {
  meta: Record<string, unknown>
  districts: Record<string, Record<string, WeatherYear>>
  state: Record<string, WeatherYear>
}
const EMPTY_W: WeatherYear = { rain: Array(12).fill(null), temp: Array(12).fill(null) }

/** Monthly rainfall (mm) + mean temperature (°C) for the scope. */
export function getMonthlyWeather(year: Year, district: string | null): WeatherYear {
  if (district) return weather.districts[district]?.[String(year)] ?? EMPTY_W
  return weather.state[String(year)] ?? EMPTY_W
}

export const meta = db.meta

export function listDistricts(): string[] {
  return db.districts.map((d) => d.district)
}

export function getRecord(district: string, year: Year): DistrictMetric | undefined {
  return db.districts.find((d) => d.district === district)?.metrics[String(year)]
}

export function getValue(record: DistrictMetric, metric: Metric): number {
  return record[metric]
}

/** All districts for a year, with the chosen metric's value pulled out. */
export function getYearValues(
  year: Year,
  metric: Metric,
): { district: string; value: number; record: DistrictMetric }[] {
  return db.districts.map((d) => {
    const record = d.metrics[String(year)]
    return { district: d.district, value: record[metric], record }
  })
}

export function getStateTotals(year: Year): DistrictMetric {
  return db.stateTotals[String(year)]
}

export function getMonthly(year: Year) {
  return db.monthly[String(year)]
}

export function isPartial(year: Year): string | undefined {
  return db.meta.partial[String(year)]
}

/** Flat district × year rows for CSV export. */
export function getExportRows() {
  const rows: Record<string, string | number>[] = []
  for (const d of db.districts) {
    for (const y of db.meta.years) {
      const m = d.metrics[String(y)]
      rows.push({
        District: d.district,
        Year: y,
        Cases: m.cases,
        Deaths: m.deaths,
        Population: m.population,
        AttackRate_per_100k: m.attackRate,
        CFR_percent: m.cfr,
      })
    }
  }
  return rows
}

/** Totals for the chosen scope: a single district, or all of Tamil Nadu. */
export function getScopeTotals(year: Year, district: string | null): DistrictMetric {
  if (district) return getRecord(district, year) ?? getStateTotals(year)
  return getStateTotals(year)
}

/** Monthly cases (12 values) for the scope. State = sum across districts. */
export function getMonthlyCases(year: Year, district: string | null): number[] {
  const m = db.monthly[String(year)]
  if (district) return m[district]?.cases ?? new Array(12).fill(0)
  const sum = new Array(12).fill(0)
  for (const d of Object.values(m)) d.cases.forEach((v, i) => (sum[i] += v))
  return sum
}

/** Monthly deaths (12 values) for the scope. */
export function getMonthlyDeaths(year: Year, district: string | null): number[] {
  const m = db.monthly[String(year)]
  if (district) return m[district]?.deaths ?? new Array(12).fill(0)
  const sum = new Array(12).fill(0)
  for (const d of Object.values(m)) d.deaths.forEach((v, i) => (sum[i] += v))
  return sum
}

/**
 * Monthly series for any metric. Attack rate uses the year's population as the
 * denominator each month; CFR is monthly deaths ÷ monthly cases.
 */
export function getMonthlyMetric(year: Year, district: string | null, metric: Metric): number[] {
  const cases = getMonthlyCases(year, district)
  if (metric === 'cases') return cases
  const deaths = getMonthlyDeaths(year, district)
  if (metric === 'deaths') return deaths
  if (metric === 'attackRate') {
    const pop = getScopeTotals(year, district).population
    return cases.map((c) => (pop ? +((c / pop) * 100000).toFixed(2) : 0))
  }
  // cfr
  return deaths.map((d, i) => (cases[i] ? +((d / cases[i]) * 100).toFixed(2) : 0))
}

/** Year-on-year change in cases vs the previous year, for the scope. */
export function getYoYChange(
  year: Year,
  district: string | null,
): { pct: number; prevYear: number } | null {
  const prev = (year - 1) as Year
  if (!db.meta.years.includes(prev)) return null
  const cur = getScopeTotals(year, district).cases
  const before = getScopeTotals(prev, district).cases
  if (!before) return null
  return { pct: ((cur - before) / before) * 100, prevYear: prev }
}
