/**
 * Single data-access layer for the whole dashboard.
 *
 * Reads LIVE from the API (BigQuery) via loadData(), which must run before the
 * app renders (see main.tsx). The getters below stay synchronous — they read an
 * in-memory store populated on load — so UI components are unchanged. Call
 * loadData() again to refresh after edits/imports. (Weather stays bundled.)
 */
import weatherData from './data/weather.json'
import { dataApi } from './dataApi'
import type { DengueData, DistrictMetric, Metric, Year } from './types'

const EMPTY_DB: DengueData = {
  meta: { source: '', populationSource: '', years: [], partial: {} },
  districts: [],
  stateTotals: {},
  monthly: {},
}
let db: DengueData = EMPTY_DB

/** Fetch the live dataset and populate the in-memory store. */
export async function loadData(): Promise<void> {
  const res = await fetch(`${dataApi.url}/api/dashboard`)
  if (!res.ok) throw new Error(`Could not load data (${res.status})`)
  db = (await res.json()) as DengueData
  meta = db.meta
  YEARS = [...db.meta.years].sort((a, b) => a - b)
  LATEST_YEAR = YEARS[YEARS.length - 1]
  LATEST_MONTH = lastMonthIndex(LATEST_YEAR)
}

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

/** Annual total rainfall (mm) for a district. */
export function getAnnualRain(year: Year, district: string): number {
  return getMonthlyWeather(year, district).rain.reduce((a: number, v) => a + (v ?? 0), 0)
}

/** Annual mean humidity (%) for a district. */
export function getAnnualHumidity(year: Year, district: string): number {
  const h = (getMonthlyWeather(year, district).hum ?? []).filter((v): v is number => v != null)
  return h.length ? h.reduce((a, v) => a + v, 0) / h.length : 0
}

// ---- available years + month extents (live; set by loadData) ----
/** Dataset metadata (source, years, partial labels). */
export let meta = db.meta
/** Surveillance years present in the data, ascending. */
export let YEARS: Year[] = []
/** Most recent year in the data. */
export let LATEST_YEAR: Year = 0
/** Latest month with data in the latest year (0-indexed) — the default view. */
export let LATEST_MONTH = -1

/** 0-indexed last month that has reported cases in a year (11 for a full year,
 *  fewer for a partial/current year). Drives sliders, dropdowns and defaults so
 *  partial years need no hardcoding. */
export function lastMonthIndex(year: Year): number {
  const m = db.monthly[String(year)]
  if (!m) return 11
  let last = -1
  for (const rec of Object.values(m)) rec.cases.forEach((c, i) => { if (c > 0) last = Math.max(last, i) })
  return last < 0 ? 11 : last
}

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

/** A single month's metrics for a district (derived from monthly + population). */
export function getMonthlyRecord(year: Year, month: number, district: string): DistrictMetric | undefined {
  const annual = getRecord(district, year)
  if (!annual) return undefined
  const m = db.monthly[String(year)]?.[district]
  const cases = m?.cases[month] ?? 0
  const deaths = m?.deaths[month] ?? 0
  const population = annual.population
  return {
    cases,
    deaths,
    population,
    attackRate: population ? +((cases / population) * 1e5).toFixed(1) : 0,
    cfr: cases ? +((deaths / cases) * 100).toFixed(2) : 0,
  }
}

/** All districts for a specific month, with the chosen metric pulled out. */
export function getMonthValues(
  year: Year,
  month: number,
  metric: Metric,
): { district: string; value: number; record: DistrictMetric }[] {
  return listDistricts().map((district) => {
    const record = getMonthlyRecord(year, month, district)!
    return { district, value: record[metric], record }
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

/**
 * Totals for the chosen scope and time window. `month` is a 0-based index
 * (0 = Jan); pass -1 (or omit) for the whole year. A single month uses the
 * year's population as the attack-rate denominator.
 */
export function getScopeTotalsFor(year: Year, district: string | null, month = -1): DistrictMetric {
  if (month < 0) return getScopeTotals(year, district)
  const cases = getMonthlyCases(year, district)[month] ?? 0
  const deaths = getMonthlyDeaths(year, district)[month] ?? 0
  const population = getScopeTotals(year, district).population
  return {
    cases,
    deaths,
    population,
    attackRate: population ? +((cases / population) * 1e5).toFixed(1) : 0,
    cfr: cases ? +((deaths / cases) * 100).toFixed(2) : 0,
  }
}

/**
 * Change in cases vs the previous year for the scope. With a month selected it
 * compares the same month a year earlier (so it stays meaningful for a partial
 * current year); otherwise it compares full-year totals.
 */
export function getYoYChange(
  year: Year,
  district: string | null,
  month = -1,
): { pct: number; prevYear: number } | null {
  const prev = (year - 1) as Year
  if (!db.meta.years.includes(prev)) return null
  const cur = getScopeTotalsFor(year, district, month).cases
  const before = getScopeTotalsFor(prev, district, month).cases
  if (!before) return null
  return { pct: ((cur - before) / before) * 100, prevYear: prev }
}
