import { useEffect, useMemo, useState } from 'react'
import { dataApi, type ApiRow } from '../dataApi'
import { listDistricts, YEARS, LATEST_YEAR, lastMonthIndex } from '../dataService'
import { MONTHS, type Year } from '../types'
import { BulkImport } from './BulkImport'
import { Modal, Field } from './Modal'

const intl = (v: number) => v.toLocaleString('en-IN')
const lastMonth = (y: Year | 'all') => (y === 'all' ? 12 : lastMonthIndex(y) + 1)

type SortKey = 'district' | 'year' | 'month' | 'cases' | 'deaths' | 'population' | 'attack_rate' | 'cfr'
const COLS: { key: SortKey | null; label: string; right?: boolean }[] = [
  { key: 'district', label: 'District' },
  { key: 'year', label: 'Year' },
  { key: 'month', label: 'Month' },
  { key: 'cases', label: 'Cases', right: true },
  { key: 'deaths', label: 'Deaths', right: true },
  { key: 'population', label: 'Population', right: true },
  { key: 'attack_rate', label: 'Attack /100k', right: true },
  { key: 'cfr', label: 'CFR %', right: true },
  { key: null, label: '' },
]

export function DataTable({ onOpenDistrict }: { onOpenDistrict?: (d: string, y: Year) => void }) {
  const DISTRICTS = useMemo(() => listDistricts().slice().sort(), [])
  const [rows, setRows] = useState<ApiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<Year | 'all'>('all')
  const [monthFilter, setMonthFilter] = useState<number | 'months' | 'year'>('months')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'district', dir: 1 })
  const [busy, setBusy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState<ApiRow | null>(null)
  const [editForm, setEditForm] = useState({ cases: '', deaths: '' })
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ district: DISTRICTS[0] ?? '', year: String(LATEST_YEAR) })

  const monthly = monthFilter !== 'year'

  const load = () => {
    setLoading(true)
    const yr = yearFilter === 'all' ? undefined : yearFilter
    const req =
      monthFilter === 'year' ? dataApi.list(yr)
      : monthFilter === 'months' ? dataApi.list(yr, undefined, true)
      : dataApi.list(yr, monthFilter)
    req.then((d) => { setRows(d); setErr('') }).catch((e) => setErr(String(e.message || e))).finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [yearFilter, monthFilter])

  const toggleSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key: k, dir: 1 }))

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    const tie = (a: ApiRow, b: ApiRow) => a.district.localeCompare(b.district) || a.year - b.year || (a.month ?? 0) - (b.month ?? 0)
    const cmp = (a: ApiRow, b: ApiRow) => {
      const k = sort.key
      let d = k === 'district' ? a.district.localeCompare(b.district)
        : k === 'month' ? (a.month ?? 0) - (b.month ?? 0)
        : (a[k] as number) - (b[k] as number)
      if (d === 0) d = tie(a, b)
      return d * sort.dir
    }
    return rows.filter((r) => !q || r.district.toLowerCase().includes(q)).sort(cmp)
  }, [rows, query, sort])

  const keyOf = (r: ApiRow) => `${r.district}|${r.year}|${r.month ?? 'Y'}`

  const openEdit = (r: ApiRow) => { setEditRow(r); setEditForm({ cases: String(r.cases), deaths: String(r.deaths) }) }

  const saveEdit = async () => {
    const r = editRow
    if (!r || !r.month) return
    setBusy(true); setErr('')
    try {
      await dataApi.saveMonthly({ district: r.district, year: r.year, month: r.month, cases: +editForm.cases, deaths: +editForm.deaths })
      const ar = r.population ? +(((+editForm.cases) / r.population) * 100000).toFixed(1) : 0
      const cfr = +editForm.cases ? +(((+editForm.deaths) / (+editForm.cases)) * 100).toFixed(2) : 0
      setRows((rs) => rs.map((x) => (keyOf(x) === keyOf(r) ? { ...x, cases: +editForm.cases, deaths: +editForm.deaths, attack_rate: ar, cfr } : x)))
      setEditRow(null)
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const del = async (r: ApiRow) => {
    if (!confirm(`Delete all ${r.district} ${r.year} case data (every month)?`)) return
    setBusy(true); setErr('')
    try { await dataApi.removeYear(r.district, r.year); load() }
    catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const addRow = async () => {
    setBusy(true); setErr('')
    try {
      await dataApi.addYear({ district: addForm.district, year: +addForm.year })
      setAddOpen(false); setAddForm({ district: DISTRICTS[0] ?? '', year: String(LATEST_YEAR) }); load()
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const monthOptions = Array.from({ length: lastMonth(yearFilter) }, (_, i) => i + 1)

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="font-serif text-[1.15rem] font-600 text-ink">Dataset (live · editable)</h2>
            <p className="text-[0.8rem] text-ink-soft">
              {monthFilter === 'year' ? 'Annual totals (sum of months) · read-only' : `Per-month figures · ${monthFilter === 'months' ? 'all months' : MONTHS[(monthFilter as number) - 1]} · click a row to edit`} · click headers to sort · population in the Population tab
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[0.72rem] font-600 ${err ? 'bg-alert/15 text-alert' : 'bg-good/15 text-good'}`}>
            {loading ? 'Loading…' : err ? 'Error' : `${rows.length} rows · cloud`}
          </span>
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 focus-within:border-brand">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search district…" className="w-40 bg-transparent text-[0.9rem] text-ink placeholder:text-ink-faint focus:outline-none" />
          </div>
          {YEARS.length <= 4 ? (
            <div className="flex gap-1 rounded-lg bg-panel p-1">
              {(['all', ...YEARS] as const).map((y) => (
                <button key={y} onClick={() => { setYearFilter(y); if (typeof monthFilter === 'number' && y !== 'all' && monthFilter > lastMonth(y)) setMonthFilter('months') }}
                  className={`rounded-md px-3 py-1.5 text-[0.85rem] font-600 ${y === yearFilter ? 'bg-brand text-surface' : 'text-ink-soft hover:text-brand-strong'}`}>{y === 'all' ? 'All' : y}</button>
              ))}
            </div>
          ) : (
            <select
              value={String(yearFilter)}
              onChange={(e) => { const v = e.target.value; const ny = (v === 'all' ? 'all' : Number(v)) as Year | 'all'; setYearFilter(ny); if (typeof monthFilter === 'number' && ny !== 'all' && monthFilter > lastMonth(ny)) setMonthFilter('months') }}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.85rem] font-600 text-ink-soft focus:border-brand focus:outline-none"
              aria-label="Year"
            >
              <option value="all">All years</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <label className="text-[0.78rem] font-600 uppercase tracking-wide text-ink-faint">Month</label>
          <select value={monthFilter} onChange={(e) => { const v = e.target.value; setMonthFilter(v === 'months' || v === 'year' ? v : Number(v)) }}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.85rem] font-600 text-ink-soft focus:border-brand focus:outline-none" aria-label="Month">
            <option value="months">All months</option>
            <option value="year">Whole year (totals)</option>
            {monthOptions.map((m) => <option key={m} value={m}>{MONTHS[m - 1]}</option>)}
          </select>
          <button onClick={() => setAddOpen(true)} className="rounded-lg bg-brand px-3 py-1.5 text-[0.85rem] font-600 text-surface">+ Add</button>
          <button onClick={() => setShowImport((v) => !v)} className={`rounded-lg border px-3 py-1.5 text-[0.85rem] font-600 transition-colors ${showImport ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-ink-soft hover:border-line-strong hover:text-brand-strong'}`}>
            Bulk import {showImport ? '▴' : '▾'}
          </button>
        </div>

        {err && <p className="border-b border-line bg-alert/10 px-5 py-2 text-[0.85rem] text-alert">{err}</p>}
        {showImport && <BulkImport districts={DISTRICTS} onImported={load} />}

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr>
                {COLS.map((c) => (
                  <th key={c.label || 'actions'} className={`border-b border-line px-4 py-2.5 font-600 text-ink-soft ${c.right ? 'text-right' : 'text-left'}`}>
                    {c.key ? (
                      <button onClick={() => toggleSort(c.key!)} className={`inline-flex items-center gap-1 hover:text-brand-strong ${c.right ? 'flex-row-reverse' : ''}`}>
                        {c.label}
                        <span className="text-[0.7rem] text-ink-faint">{sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                      </button>
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr key={keyOf(r)} className="odd:bg-panel/40 hover:bg-brand-soft/40">
                  <td className="border-b border-line px-4 py-1.5 font-600 text-ink">
                    <button className="hover:text-brand-strong hover:underline" onClick={() => onOpenDistrict?.(r.district, r.year as Year)} title="View on map">{r.district}</button>
                  </td>
                  <td className="border-b border-line px-4 py-1.5 font-mono text-ink">{r.year}</td>
                  <td className="border-b border-line px-4 py-1.5 text-ink-soft">{r.month ? MONTHS[r.month - 1] : 'Year'}</td>
                  <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink">{intl(r.cases)}</td>
                  <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink">{intl(r.deaths)}</td>
                  <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink-soft">{r.population ? intl(r.population) : '—'}</td>
                  <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink-soft">{r.attack_rate?.toFixed(1) ?? '—'}</td>
                  <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink-soft">{(r.cfr ?? 0).toFixed(2)}%</td>
                  <td className="border-b border-line px-3 py-1.5 text-right whitespace-nowrap">
                    {monthly && <button onClick={() => openEdit(r)} className="rounded-md px-2 py-1 text-[0.78rem] font-600 text-brand-strong hover:bg-brand-soft">Edit</button>}
                    {!monthly && <button onClick={() => del(r)} className="rounded-md px-2 py-1 text-[0.78rem] font-600 text-alert hover:bg-alert/10">Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && view.length === 0 && <p className="px-4 py-6 text-center text-ink-faint">No matching rows.</p>}
        </div>

        <div className="border-t border-line px-5 py-2 text-[0.78rem] text-ink-faint">
          {view.length} rows shown · saved to BigQuery with an audit log. ⚠ Sign-in &amp; roles to be added before public use.
        </div>
      </section>

      {/* Edit (popup form) */}
      {editRow && (
        <Modal title={`Edit ${editRow.district} · ${editRow.month ? MONTHS[editRow.month - 1] : ''} ${editRow.year}`} onClose={() => setEditRow(null)}>
          <Field label="Cases" value={editForm.cases} onChange={(v) => setEditForm({ ...editForm, cases: v })} />
          <Field label="Deaths" value={editForm.deaths} onChange={(v) => setEditForm({ ...editForm, deaths: v })} hint="Attack rate & CFR recompute automatically." />
          <div className="mt-1 flex justify-end gap-2">
            <button onClick={() => setEditRow(null)} className="rounded-lg px-3.5 py-2 text-[0.85rem] font-600 text-ink-soft hover:bg-panel">Cancel</button>
            <button onClick={saveEdit} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-[0.85rem] font-600 text-surface disabled:opacity-50">Save</button>
          </div>
        </Modal>
      )}

      {/* Add (popup form) */}
      {addOpen && (
        <Modal title="Add district-year" onClose={() => setAddOpen(false)}>
          <label className="mb-3 block">
            <span className="mb-1 block text-[0.82rem] font-600 text-ink-soft">District</span>
            <select value={addForm.district} onChange={(e) => setAddForm({ ...addForm, district: e.target.value })} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[0.9rem] focus:border-brand focus:outline-none">
              {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <Field label="Year" value={addForm.year} onChange={(v) => setAddForm({ ...addForm, year: v })} hint="Seeds 12 empty months; population auto-projects. Enter cases afterwards." />
          <div className="mt-1 flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="rounded-lg px-3.5 py-2 text-[0.85rem] font-600 text-ink-soft hover:bg-panel">Cancel</button>
            <button onClick={addRow} disabled={busy || !addForm.year} className="rounded-lg bg-brand px-4 py-2 text-[0.85rem] font-600 text-surface disabled:opacity-50">Add</button>
          </div>
        </Modal>
      )}
    </main>
  )
}
