/** Client for the dengue surveillance API (FastAPI on Cloud Run → BigQuery).
 *
 * Source of truth is monthly counts + annual population; attack-rate/CFR are
 * derived server-side and respond to the month filter. `month` is null on
 * annual-rollup rows and 1-12 on per-month rows.
 */
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://dengue-api-502856744185.asia-south1.run.app'

export interface ApiRow {
  district: string
  year: number
  month: number | null
  cases: number
  deaths: number
  population: number
  attack_rate: number
  cfr: number
}

export interface MonthlyInput {
  district: string
  year: number
  month: number
  cases: number
  deaths: number
}

export interface PopulationInput {
  district: string
  year: number
  population: number
}

/** A district's 2011 census base + per-district annual growth rate (%). */
export interface BaseRow {
  district: string
  census_2011: number
  growth_pct: number
}

/** Effective population for a district-year: projected, or an official override. */
export interface PopRow {
  district: string
  year: number
  population: number
  is_override: boolean
}

// A placeholder until real sign-in is added; sent for the audit trail.
const userHeader = () => ({ 'X-User-Email': localStorage.getItem('dengue_user') || 'editor@local' })

async function handle(res: Response) {
  if (!res.ok) {
    let msg = `${res.status}`
    try { msg = (await res.json()).detail || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json()
}

const post = (path: string, body: unknown, method = 'POST') =>
  fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...userHeader() },
    body: JSON.stringify(body),
  }).then(handle)

export const dataApi = {
  url: API_URL,
  /**
   * month 1-12 → that month; allMonths → every month expanded (one row per
   * district-month); neither → annual rollup (month=null).
   */
  list: (year?: number, month?: number, allMonths?: boolean): Promise<ApiRow[]> => {
    const q = new URLSearchParams()
    if (year) q.set('year', String(year))
    if (month) q.set('month', String(month))
    if (allMonths) q.set('months', 'true')
    const qs = q.toString()
    return fetch(`${API_URL}/api/rows${qs ? `?${qs}` : ''}`).then(handle)
  },
  saveMonthly: (r: MonthlyInput): Promise<MonthlyInput> => post('/api/monthly', r, 'PUT'),
  bulkImport: (rows: MonthlyInput[]): Promise<{ imported: number; years: number[] }> =>
    post('/api/monthly/bulk', { rows }, 'POST'),
  addYear: (r: { district: string; year: number }): Promise<unknown> => post('/api/year', r, 'POST'),
  removeYear: (district: string, year: number): Promise<unknown> =>
    fetch(`${API_URL}/api/year?district=${encodeURIComponent(district)}&year=${year}`, {
      method: 'DELETE',
      headers: { ...userHeader() },
    }).then(handle),

  // ---- population (2011 census base + per-district growth, with overrides) ----
  listBase: (): Promise<BaseRow[]> => fetch(`${API_URL}/api/population/base`).then(handle),
  saveBase: (r: BaseRow): Promise<BaseRow> => post('/api/population/base', r, 'PUT'),
  listPopulation: (year?: number): Promise<PopRow[]> =>
    fetch(`${API_URL}/api/population${year ? `?year=${year}` : ''}`).then(handle),
  saveOverride: (r: PopulationInput): Promise<PopulationInput> => post('/api/population/override', r, 'PUT'),
  clearOverride: (district: string, year: number): Promise<unknown> =>
    fetch(`${API_URL}/api/population/override?district=${encodeURIComponent(district)}&year=${year}`, {
      method: 'DELETE',
      headers: { ...userHeader() },
    }).then(handle),
}
