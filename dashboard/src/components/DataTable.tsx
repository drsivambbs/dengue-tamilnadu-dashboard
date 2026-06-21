import { useMemo, useState } from 'react'
import { getExportRows } from '../dataService'
import { downloadCsv } from '../export'
import { YEARS, type Year } from '../types'

type Key =
  | 'District' | 'Year' | 'Cases' | 'Deaths' | 'Population' | 'AttackRate_per_100k' | 'CFR_percent'

interface Col {
  key: Key
  label: string
  num: boolean
  fmt?: (v: number) => string
}

const intl = (v: number) => v.toLocaleString('en-IN')

const COLS: Col[] = [
  { key: 'District', label: 'District', num: false },
  { key: 'Year', label: 'Year', num: true },
  { key: 'Cases', label: 'Cases', num: true, fmt: intl },
  { key: 'Deaths', label: 'Deaths', num: true, fmt: intl },
  { key: 'Population', label: 'Population', num: true, fmt: intl },
  { key: 'AttackRate_per_100k', label: 'Attack rate /100k', num: true, fmt: (v) => v.toFixed(1) },
  { key: 'CFR_percent', label: 'CFR %', num: true, fmt: (v) => `${v.toFixed(2)}%` },
]

export function DataTable({ onOpenDistrict }: { onOpenDistrict?: (d: string, y: Year) => void }) {
  const allRows = useMemo(() => getExportRows(), [])
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<Year | 'all'>('all')
  const [sortKey, setSortKey] = useState<Key>('District')
  const [sortAsc, setSortAsc] = useState(true)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let r = allRows.filter((row) => {
      if (yearFilter !== 'all' && row.Year !== yearFilter) return false
      if (q && !String(row.District).toLowerCase().includes(q)) return false
      return true
    })
    r = [...r].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortAsc ? cmp : -cmp
    })
    return r
  }, [allRows, query, yearFilter, sortKey, sortAsc])

  const toggleSort = (k: Key) => {
    if (k === sortKey) setSortAsc((v) => !v)
    else { setSortKey(k); setSortAsc(k === 'District') }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="font-serif text-[1.15rem] font-600 text-ink">Dataset</h2>
            <p className="text-[0.8rem] text-ink-soft">Tamil Nadu dengue · district × year · Source: IHIP</p>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 focus-within:border-brand">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search district…"
              className="w-44 bg-transparent text-[0.9rem] text-ink placeholder:text-ink-faint focus:outline-none"
              aria-label="Search district"
            />
          </div>

          <div className="flex gap-1 rounded-lg bg-panel p-1" role="group" aria-label="Filter year">
            {(['all', ...YEARS] as const).map((y) => {
              const active = y === yearFilter
              return (
                <button
                  key={y}
                  onClick={() => setYearFilter(y)}
                  aria-pressed={active}
                  className={`rounded-md px-3 py-1.5 text-[0.85rem] font-600 transition-colors ${
                    active ? 'bg-brand text-surface shadow-sm' : 'text-ink-soft hover:text-brand-strong'
                  }`}
                >
                  {y === 'all' ? 'All years' : y}
                </button>
              )
            })}
          </div>

          <button
            onClick={downloadCsv}
            className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[0.85rem] font-600 text-ink-soft hover:border-line-strong hover:text-brand-strong"
          >
            Download CSV
          </button>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`cursor-pointer select-none border-b border-line px-4 py-2.5 font-600 text-ink-soft hover:text-brand-strong ${
                      c.num ? 'text-right' : 'text-left'
                    }`}
                    aria-sort={sortKey === c.key ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.num && <Arrow show={sortKey === c.key} asc={sortAsc} />}
                      {c.label}
                      {!c.num && <Arrow show={sortKey === c.key} asc={sortAsc} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.District}-${row.Year}`}
                  onClick={() => onOpenDistrict?.(String(row.District), row.Year as Year)}
                  title="View on map"
                  className={`cursor-pointer ${i % 2 ? 'bg-panel/40' : 'bg-surface'} hover:bg-brand-soft`}
                >
                  {COLS.map((c) => {
                    const v = row[c.key]
                    const text = c.num && typeof v === 'number' && c.fmt ? c.fmt(v) : String(v)
                    return (
                      <td
                        key={c.key}
                        className={`border-b border-line px-4 py-2 ${
                          c.num ? 'text-right font-mono tabular-nums text-ink' : 'font-600 text-ink'
                        }`}
                      >
                        {text}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-4 py-6 text-center text-ink-faint">No matching rows.</p>}
        </div>

        <div className="border-t border-line px-5 py-2 text-[0.8rem] text-ink-faint">
          {rows.length} rows · click a row to view that district on the map
        </div>
      </section>
    </main>
  )
}

function Arrow({ show, asc }: { show: boolean; asc: boolean }) {
  if (!show) return <span className="text-ink-faint/30">↕</span>
  return <span className="text-brand">{asc ? '↑' : '↓'}</span>
}
