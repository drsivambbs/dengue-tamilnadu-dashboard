import { useMemo } from 'react'
import { MapView } from './MapView'
import { EpidemicCurve } from './EpidemicCurve'
import { DistrictSearch } from './DistrictSearch'
import { listDistricts } from '../dataService'
import { METRICS, YEARS, type ClassMethod, type Metric, type Year } from '../types'

export type CanvasView = 'map' | 'trend'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const lastMonthIdx = (y: Year) => (y === 2026 ? 5 : 11)
const SELECT = 'rounded-lg border border-line bg-surface px-2 py-1.5 text-[0.85rem] font-600 text-ink-soft focus:border-brand focus:outline-none'

interface Props {
  view: CanvasView
  onView: (v: CanvasView) => void
  year: Year
  month: number // -1 = whole year
  metric: Metric
  selected: string | null
  classMethod: ClassMethod
  onYear: (y: Year) => void
  onMonth: (m: number) => void
  onSelect: (d: string | null) => void
}

const TREND_TITLE: Record<Metric, string> = {
  cases: 'Monthly cases',
  attackRate: 'Monthly attack rate',
  deaths: 'Monthly deaths',
  cfr: 'Monthly case fatality',
}

export function CanvasPanel({ view, onView, year, month, metric, selected, classMethod, onYear, onMonth, onSelect }: Props) {
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''
  const districts = useMemo(() => listDistricts().slice().sort(), [])

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
      <div className="relative z-20 flex items-center gap-4 border-b border-line px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-[1.15rem] font-600 text-ink">
            {view === 'map' ? `${metricLabel} by district` : TREND_TITLE[metric]}
          </h2>
          {view === 'trend' && (
            <span className="text-[0.88rem] text-ink-soft">{selected ?? 'Tamil Nadu'} · 2024–2026</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {view === 'map' && (
            <>
              <select
                value={year}
                onChange={(e) => {
                  const ny = Number(e.target.value) as Year
                  onYear(ny)
                  if (month > lastMonthIdx(ny)) onMonth(-1)
                }}
                className={SELECT}
                aria-label="Year"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={month} onChange={(e) => onMonth(Number(e.target.value))} className={SELECT} aria-label="Month">
                <option value={-1}>Whole year</option>
                {MONTHS.map((m, i) => (i <= lastMonthIdx(year) ? <option key={m} value={i}>{m}</option> : null))}
              </select>
            </>
          )}
          <div className="w-48">
            <DistrictSearch districts={districts} selected={selected} onSelect={onSelect} />
          </div>
          <Toggle view={view} onView={onView} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 p-0">
        {view === 'map' ? (
          <MapView year={year} metric={metric} month={month} selected={selected} classMethod={classMethod} onSelect={onSelect} />
        ) : (
          <div className="h-full w-full p-4">
            <EpidemicCurve selected={selected} metric={metric} />
          </div>
        )}
      </div>
    </section>
  )
}

function Toggle({ view, onView }: { view: CanvasView; onView: (v: CanvasView) => void }) {
  const items: { id: CanvasView; label: string; icon: React.ReactNode }[] = [
    {
      id: 'map',
      label: 'Map',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      ),
    },
    {
      id: 'trend',
      label: 'Trend',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M4 18l5-6 4 3 6-8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]
  return (
    <div className="flex gap-1 rounded-xl bg-panel p-1" role="group" aria-label="Switch view">
      {items.map((it) => {
        const active = it.id === view
        return (
          <button
            key={it.id}
            onClick={() => onView(it.id)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[0.9rem] font-600 transition-colors ${
              active ? 'bg-brand text-surface shadow-sm' : 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong'
            }`}
          >
            {it.icon}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
