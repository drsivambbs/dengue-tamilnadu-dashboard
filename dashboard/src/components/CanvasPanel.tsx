import { MapView } from './MapView'
import { EpidemicCurve } from './EpidemicCurve'
import { isPartial } from '../dataService'
import { METRICS, type ClassMethod, type Metric, type Year } from '../types'

export type CanvasView = 'map' | 'trend'

interface Props {
  view: CanvasView
  onView: (v: CanvasView) => void
  year: Year
  metric: Metric
  selected: string | null
  classMethod: ClassMethod
  onSelect: (d: string | null) => void
}

const TREND_TITLE: Record<Metric, string> = {
  cases: 'Monthly cases',
  attackRate: 'Monthly attack rate',
  deaths: 'Monthly deaths',
  cfr: 'Monthly case fatality',
}

export function CanvasPanel({ view, onView, year, metric, selected, classMethod, onSelect }: Props) {
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''
  const partial = isPartial(year)

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-3.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-[1.15rem] font-600 text-ink">
            {view === 'map' ? `${metricLabel} by district` : TREND_TITLE[metric]}
          </h2>
          {view === 'map' ? (
            <span className="rounded-md bg-brand-soft px-2.5 py-0.5 text-[0.82rem] font-600 text-brand-strong">
              {year}
              {partial && <span className="ml-1 font-400 text-brand">· {partial}</span>}
            </span>
          ) : (
            <span className="text-[0.88rem] text-ink-soft">{selected ?? 'Tamil Nadu'} · 2024–2026</span>
          )}
        </div>

        <Toggle view={view} onView={onView} />
      </div>

      <div className="relative min-h-0 flex-1 p-0">
        {view === 'map' ? (
          <MapView year={year} metric={metric} selected={selected} classMethod={classMethod} onSelect={onSelect} />
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
