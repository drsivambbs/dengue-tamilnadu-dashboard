/** Client for the dengue surveillance API (FastAPI on Cloud Run → BigQuery). */
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://dengue-api-502856744185.asia-south1.run.app'

export interface ApiRow {
  district: string
  year: number
  cases: number
  deaths: number
  population: number
  attack_rate: number
  cfr: number
}

export interface RowInput {
  district: string
  year: number
  cases: number
  deaths: number
  population: number
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

export const dataApi = {
  url: API_URL,
  list: (): Promise<ApiRow[]> => fetch(`${API_URL}/api/rows`).then(handle),
  add: (r: RowInput): Promise<ApiRow> =>
    fetch(`${API_URL}/api/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify(r),
    }).then(handle),
  update: (r: RowInput): Promise<ApiRow> =>
    fetch(`${API_URL}/api/rows`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...userHeader() },
      body: JSON.stringify(r),
    }).then(handle),
  remove: (district: string, year: number): Promise<unknown> =>
    fetch(`${API_URL}/api/rows?district=${encodeURIComponent(district)}&year=${year}`, {
      method: 'DELETE',
      headers: { ...userHeader() },
    }).then(handle),
}
