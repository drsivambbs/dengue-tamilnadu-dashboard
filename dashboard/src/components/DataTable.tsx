import { useEffect, useMemo, useState } from 'react'
import { dataApi, type ApiRow } from '../dataApi'
import { listDistricts } from '../dataService'
import { YEARS, type Year } from '../types'

const intl = (v: number) => v.toLocaleString('en-IN')
const DISTRICTS = listDistricts().slice().sort()

interface Draft { district: string; year: string; cases: string; deaths: string; population: string }
const emptyDraft = (): Draft => ({ district: DISTRICTS[0], year: '2026', cases: '', deaths: '', population: '' })

export function DataTable({ onOpenDistrict }: { onOpenDistrict?: (d: string, y: Year) => void }) {
  const [rows, setRows] = useState<ApiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<Year | 'all'>('all')
  const [editKey, setEditKey] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ cases: string; deaths: string; population: string }>({ cases: '', deaths: '', population: '' })
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    dataApi.list().then((d) => { setRows(d); setErr('') }).catch((e) => setErr(String(e.message || e))).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => (yearFilter === 'all' || r.year === yearFilter) && (!q || r.district.toLowerCase().includes(q)))
      .sort((a, b) => a.district.localeCompare(b.district) || a.year - b.year)
  }, [rows, query, yearFilter])

  const keyOf = (r: { district: string; year: number }) => `${r.district}|${r.year}`

  const startEdit = (r: ApiRow) => {
    setEditKey(keyOf(r))
    setEdit({ cases: String(r.cases), deaths: String(r.deaths), population: String(r.population) })
  }

  const saveEdit = async (r: ApiRow) => {
    setBusy(true); setErr('')
    try {
      const updated = await dataApi.update({ district: r.district, year: r.year, cases: +edit.cases, deaths: +edit.deaths, population: +edit.population })
      setRows((rs) => rs.map((x) => (keyOf(x) === keyOf(r) ? updated : x)))
      setEditKey(null)
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const del = async (r: ApiRow) => {
    if (!confirm(`Delete ${r.district} ${r.year}?`)) return
    setBusy(true); setErr('')
    try { await dataApi.remove(r.district, r.year); setRows((rs) => rs.filter((x) => keyOf(x) !== keyOf(r))) }
    catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const addRow = async () => {
    setBusy(true); setErr('')
    try {
      const created = await dataApi.add({ district: draft.district, year: +draft.year, cases: +draft.cases, deaths: +draft.deaths, population: +draft.population })
      setRows((rs) => [...rs, created]); setDraft(emptyDraft())
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
        {/* Header / controls */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="font-serif text-[1.15rem] font-600 text-ink">Dataset (live · editable)</h2>
            <p className="text-[0.8rem] text-ink-soft">Connected to BigQuery via Cloud Run · changes save to the cloud</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[0.72rem] font-600 ${err ? 'bg-alert/15 text-alert' : 'bg-good/15 text-good'}`}>
            {loading ? 'Loading…' : err ? 'Error' : `${rows.length} rows · cloud`}
          </span>
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 focus-within:border-brand">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search district…" className="w-40 bg-transparent text-[0.9rem] text-ink placeholder:text-ink-faint focus:outline-none" />
          </div>
          <div className="flex gap-1 rounded-lg bg-panel p-1">
            {(['all', ...YEARS] as const).map((y) => (
              <button key={y} onClick={() => setYearFilter(y)} className={`rounded-md px-3 py-1.5 text-[0.85rem] font-600 ${y === yearFilter ? 'bg-brand text-surface' : 'text-ink-soft hover:text-brand-strong'}`}>{y === 'all' ? 'All' : y}</button>
            ))}
          </div>
        </div>

        {err && <p className="border-b border-line bg-alert/10 px-5 py-2 text-[0.85rem] text-alert">{err}</p>}

        {/* Add-row form */}
        <div className="flex flex-wrap items-end gap-2 border-b border-line bg-panel/40 px-5 py-2.5">
          <span className="text-[0.78rem] font-600 uppercase tracking-wide text-ink-faint">Add row</span>
          <select value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })} className="rounded-md border border-line bg-surface px-2 py-1 text-[0.85rem]">
            {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <NumIn v={draft.year} onChange={(v) => setDraft({ ...draft, year: v })} ph="Year" w="w-16" />
          <NumIn v={draft.cases} onChange={(v) => setDraft({ ...draft, cases: v })} ph="Cases" />
          <NumIn v={draft.deaths} onChange={(v) => setDraft({ ...draft, deaths: v })} ph="Deaths" />
          <NumIn v={draft.population} onChange={(v) => setDraft({ ...draft, population: v })} ph="Population" w="w-28" />
          <button onClick={addRow} disabled={busy || !draft.cases || !draft.population} className="rounded-md bg-brand px-3.5 py-1.5 text-[0.85rem] font-600 text-surface disabled:opacity-50">Add</button>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr>
                {['District', 'Year', 'Cases', 'Deaths', 'Population', 'Attack /100k', 'CFR %', ''].map((h, i) => (
                  <th key={h} className={`border-b border-line px-4 py-2.5 font-600 text-ink-soft ${i >= 2 && i <= 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((r) => {
                const editing = editKey === keyOf(r)
                return (
                  <tr key={keyOf(r)} className="odd:bg-panel/40 hover:bg-brand-soft/40">
                    <td className="border-b border-line px-4 py-1.5 font-600 text-ink">
                      <button className="hover:text-brand-strong hover:underline" onClick={() => onOpenDistrict?.(r.district, r.year as Year)} title="View on map">{r.district}</button>
                    </td>
                    <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink">{r.year}</td>
                    <Cell editing={editing} v={edit.cases} display={intl(r.cases)} onChange={(v) => setEdit({ ...edit, cases: v })} />
                    <Cell editing={editing} v={edit.deaths} display={intl(r.deaths)} onChange={(v) => setEdit({ ...edit, deaths: v })} />
                    <Cell editing={editing} v={edit.population} display={intl(r.population)} onChange={(v) => setEdit({ ...edit, population: v })} />
                    <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink-soft">{r.attack_rate.toFixed(1)}</td>
                    <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink-soft">{r.cfr.toFixed(2)}%</td>
                    <td className="border-b border-line px-3 py-1.5 text-right whitespace-nowrap">
                      {editing ? (
                        <>
                          <button onClick={() => saveEdit(r)} disabled={busy} className="rounded-md bg-brand px-2.5 py-1 text-[0.78rem] font-600 text-surface disabled:opacity-50">Save</button>
                          <button onClick={() => setEditKey(null)} className="ml-1 rounded-md px-2 py-1 text-[0.78rem] font-600 text-ink-soft hover:bg-panel">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} className="rounded-md px-2 py-1 text-[0.78rem] font-600 text-brand-strong hover:bg-brand-soft">Edit</button>
                          <button onClick={() => del(r)} className="ml-1 rounded-md px-2 py-1 text-[0.78rem] font-600 text-alert hover:bg-alert/10">Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && view.length === 0 && <p className="px-4 py-6 text-center text-ink-faint">No matching rows.</p>}
        </div>

        <div className="border-t border-line px-5 py-2 text-[0.78rem] text-ink-faint">
          {view.length} rows shown · edits/additions/deletions are saved to BigQuery (with an audit log). ⚠ Sign-in &amp; roles to be added before public use.
        </div>
      </section>
    </main>
  )
}

function NumIn({ v, onChange, ph, w = 'w-20' }: { v: string; onChange: (v: string) => void; ph: string; w?: string }) {
  return <input value={v} onChange={(e) => onChange(e.target.value)} placeholder={ph} inputMode="numeric" className={`${w} rounded-md border border-line bg-surface px-2 py-1 text-[0.85rem] focus:border-brand focus:outline-none`} />
}

function Cell({ editing, v, display, onChange }: { editing: boolean; v: string; display: string; onChange: (v: string) => void }) {
  return (
    <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink">
      {editing ? <input value={v} onChange={(e) => onChange(e.target.value)} inputMode="numeric" className="w-20 rounded-md border border-brand bg-surface px-2 py-0.5 text-right text-[0.85rem] focus:outline-none" /> : display}
    </td>
  )
}
