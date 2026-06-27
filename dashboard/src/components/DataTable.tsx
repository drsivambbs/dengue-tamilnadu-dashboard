import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { dataApi, type ApiRow } from '../dataApi'
import { listDistricts, YEARS, LATEST_YEAR, lastMonthIndex } from '../dataService'
import { MONTHS, type Year } from '../types'
import { BulkImport } from './BulkImport'
import { Modal, Field } from './Modal'

const intl = (v: number) => v.toLocaleString('en-IN')
const lastMonth = (y: Year | 'all') => (y === 'all' ? 12 : lastMonthIndex(y) + 1)

// Stable secondary ordering applied after every column's primary comparison,
// matching the original hand-rolled table.
const tie = (a: ApiRow, b: ApiRow) =>
  a.district.localeCompare(b.district) || a.year - b.year || (a.month ?? 0) - (b.month ?? 0)

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    right?: boolean
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    onOpenDistrict?: (d: string, y: Year) => void
    openEdit: (r: ApiRow) => void
    del: (r: ApiRow) => void
    monthly: boolean
  }
}

export function DataTable({ onOpenDistrict }: { onOpenDistrict?: (d: string, y: Year) => void }) {
  const DISTRICTS = useMemo(() => listDistricts().slice().sort(), [])
  const [rows, setRows] = useState<ApiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<Year | 'all'>('all')
  const [monthFilter, setMonthFilter] = useState<number | 'months' | 'year'>('months')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'district', desc: false }])
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
  useEffect(load, [yearFilter, monthFilter])

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

  const columns = useMemo<ColumnDef<ApiRow>[]>(() => {
    const numSort = (key: 'cases' | 'deaths' | 'population' | 'attack_rate' | 'cfr') =>
      (a: { original: ApiRow }, b: { original: ApiRow }) => {
        const d = ((a.original[key] as number) ?? 0) - ((b.original[key] as number) ?? 0)
        return d !== 0 ? d : tie(a.original, b.original)
      }
    return [
      {
        accessorKey: 'district',
        header: 'District',
        sortingFn: (a, b) => { const d = a.original.district.localeCompare(b.original.district); return d !== 0 ? d : tie(a.original, b.original) },
        cell: ({ row, table }) => (
          <button className="font-600 text-ink hover:text-brand-strong hover:underline" onClick={() => table.options.meta?.onOpenDistrict?.(row.original.district, row.original.year as Year)} title="View on map">{row.original.district}</button>
        ),
      },
      {
        accessorKey: 'year',
        header: 'Year',
        sortingFn: (a, b) => { const d = a.original.year - b.original.year; return d !== 0 ? d : tie(a.original, b.original) },
        cell: ({ row }) => <span className="font-mono text-ink">{row.original.year}</span>,
      },
      {
        accessorKey: 'month',
        header: 'Month',
        sortingFn: (a, b) => { const d = (a.original.month ?? 0) - (b.original.month ?? 0); return d !== 0 ? d : tie(a.original, b.original) },
        cell: ({ row }) => <span className="text-ink-soft">{row.original.month ? MONTHS[row.original.month - 1] : 'Year'}</span>,
      },
      { accessorKey: 'cases', header: 'Cases', meta: { right: true }, sortingFn: numSort('cases'), cell: ({ row }) => <span className="font-mono text-ink">{intl(row.original.cases)}</span> },
      { accessorKey: 'deaths', header: 'Deaths', meta: { right: true }, sortingFn: numSort('deaths'), cell: ({ row }) => <span className="font-mono text-ink">{intl(row.original.deaths)}</span> },
      { accessorKey: 'population', header: 'Population', meta: { right: true }, sortingFn: numSort('population'), cell: ({ row }) => <span className="font-mono text-ink-soft">{row.original.population ? intl(row.original.population) : '—'}</span> },
      { accessorKey: 'attack_rate', header: 'Attack /100k', meta: { right: true }, sortingFn: numSort('attack_rate'), cell: ({ row }) => <span className="font-mono text-ink-soft">{row.original.attack_rate?.toFixed(1) ?? '—'}</span> },
      { accessorKey: 'cfr', header: 'CFR %', meta: { right: true }, sortingFn: numSort('cfr'), cell: ({ row }) => <span className="font-mono text-ink-soft">{(row.original.cfr ?? 0).toFixed(2)}%</span> },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { right: true },
        cell: ({ row, table }) => {
          const m = table.options.meta!
          return m.monthly
            ? <button onClick={() => m.openEdit(row.original)} className="rounded-md px-2 py-1 text-[0.78rem] font-600 text-brand-strong hover:bg-brand-soft">Edit</button>
            : <button onClick={() => m.del(row.original)} className="rounded-md px-2 py-1 text-[0.78rem] font-600 text-alert hover:bg-alert/10">Delete</button>
        },
      },
    ]
  }, [])

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable fns; React Compiler safely skips memoizing this component.
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    globalFilterFn: (row, _id, value) => row.original.district.toLowerCase().includes(String(value).trim().toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false,
    meta: { onOpenDistrict, openEdit, del, monthly },
  })
  const view = table.getRowModel().rows

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
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const right = h.column.columnDef.meta?.right
                    const dir = h.column.getIsSorted()
                    return (
                      <th key={h.id} className={`border-b border-line px-4 py-2.5 font-600 text-ink-soft ${right ? 'text-right' : 'text-left'}`}>
                        {h.column.getCanSort() ? (
                          <button onClick={h.column.getToggleSortingHandler()} className={`inline-flex items-center gap-1 hover:text-brand-strong ${right ? 'flex-row-reverse' : ''}`}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <span className="text-[0.7rem] text-ink-faint">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</span>
                          </button>
                        ) : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {view.map((row) => (
                <tr key={keyOf(row.original)} className="odd:bg-panel/40 hover:bg-brand-soft/40">
                  {row.getVisibleCells().map((cell) => {
                    const isActions = cell.column.id === 'actions'
                    return (
                      <td key={cell.id} className={`border-b border-line py-1.5 ${isActions ? 'px-3 whitespace-nowrap' : 'px-4'} ${cell.column.columnDef.meta?.right ? 'text-right' : ''}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
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
