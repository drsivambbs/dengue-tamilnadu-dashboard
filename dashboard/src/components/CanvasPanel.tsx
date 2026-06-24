import { useMemo, useState, type ReactNode } from 'react'
import { MapView } from './MapView'
import { MonthSlider } from './MonthSlider'
import { MapKpiStrip } from './MapKpiStrip'
import { DistrictBars } from './DistrictBars'
import { DistrictSearch } from './DistrictSearch'
import { listDistricts, YEARS, lastMonthIndex } from '../dataService'
import { downloadCsv } from '../export'
import { MONTHS, METRICS, CLASS_METHODS, type ClassMethod, type Metric, type Year } from '../types'

export type CanvasView = 'map' | 'bars'

const lastMonthIdx = (y: Year) => lastMonthIndex(y)
const SELECT = 'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.85rem] font-600 text-ink-soft focus:border-brand focus:outline-none'

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
  onMetric: (m: Metric) => void
  onClassMethod: (m: ClassMethod) => void
  onSelect: (d: string | null) => void
  onReset: () => void
}

export function CanvasPanel({ view, onView, year, month, metric, selected, classMethod, onYear, onMonth, onMetric, onClassMethod, onSelect, onReset }: Props) {
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''
  const districts = useMemo(() => listDistricts().slice().sort(), [])
  const [resetSignal, setResetSignal] = useState(0)
  const [exportSignal, setExportSignal] = useState(0)

  // Step one month, rolling across year boundaries within the available data.
  const stepMonth = (delta: number) => {
    if (month < 0) { onMonth(delta > 0 ? 0 : lastMonthIdx(year)); return }
    let m = month + delta
    let y = year
    if (m > lastMonthIdx(year)) {
      const ni = YEARS.indexOf(year) + 1
      if (ni >= YEARS.length) return
      y = YEARS[ni]; m = 0
    } else if (m < 0) {
      const pi = YEARS.indexOf(year) - 1
      if (pi < 0) return
      y = YEARS[pi]; m = lastMonthIdx(y)
    }
    if (y !== year) onYear(y)
    onMonth(m)
  }

  const resetAll = () => { onReset(); setResetSignal((s) => s + 1) }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
      <div className="relative z-20 flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5">
        <h2 className="mr-1 font-serif text-[1.1rem] font-600 text-ink">{metricLabel} by district</h2>

        {/* Metric (compact dropdown) */}
        <select value={metric} onChange={(e) => onMetric(e.target.value as Metric)} className={SELECT} aria-label="Metric">
          {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>

        {(view === 'map' || view === 'bars') && (
          <select
            value={year}
            onChange={(e) => { const ny = Number(e.target.value) as Year; onYear(ny); if (month > lastMonthIdx(ny)) onMonth(-1) }}
            className={SELECT}
            aria-label="Year"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {view === 'bars' && (
          <select value={month} onChange={(e) => onMonth(Number(e.target.value))} className={SELECT} aria-label="Month">
            <option value={-1}>Whole year</option>
            {Array.from({ length: lastMonthIdx(year) + 1 }, (_, i) => i).map((i) => (
              <option key={i} value={i}>{MONTHS[i]}</option>
            ))}
          </select>
        )}

        <div className="w-44"><DistrictSearch districts={districts} selected={selected} onSelect={onSelect} /></div>

        <div className="ml-auto flex items-center gap-2">
          {/* Classification (popover) — affects map & bars colours */}
          <Popover label="Classes">
              {(close) => (
                <div role="radiogroup" aria-label="Classification method">
                  {CLASS_METHODS.map((c) => (
                    <button
                      key={c.id}
                      role="radio"
                      aria-checked={c.id === classMethod}
                      onClick={() => { onClassMethod(c.id); close() }}
                      className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[0.85rem] ${c.id === classMethod ? 'bg-brand-soft font-600 text-brand-strong' : 'text-ink-soft hover:bg-panel'}`}
                    >
                      <span className="block font-600">{c.label}</span>
                      <span className="block text-[0.72rem] text-ink-faint">{c.help}</span>
                    </button>
                  ))}
                </div>
              )}
          </Popover>

          {/* Export (popover) */}
          <Popover label="Export">
            {(close) => (
              <div>
                <button onClick={() => { downloadCsv(); close() }} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[0.85rem] font-600 text-ink-soft hover:bg-panel">Download data (CSV)</button>
                {view === 'map' && (
                  <button onClick={() => { setExportSignal((s) => s + 1); close() }} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[0.85rem] font-600 text-ink-soft hover:bg-panel">Download map (PNG)</button>
                )}
              </div>
            )}
          </Popover>

          <button onClick={resetAll} title="Reset filters and map view" className={SELECT + ' hover:border-line-strong hover:text-brand-strong'}>Reset</button>

          <Toggle view={view} onView={onView} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 p-0">
        {view === 'map' ? (
          <>
            <MapView year={year} metric={metric} month={month} selected={selected} classMethod={classMethod} onSelect={onSelect} resetSignal={resetSignal} exportSignal={exportSignal} />
            <MapKpiStrip year={year} month={month} selected={selected} />
            <MonthSlider
              year={year}
              month={month}
              max={lastMonthIdx(year)}
              onMonth={onMonth}
              onStep={stepMonth}
              canPrev={!(year === YEARS[0] && month <= 0)}
              canNext={!(year === YEARS[YEARS.length - 1] && month >= lastMonthIdx(year))}
            />
          </>
        ) : (
          <DistrictBars year={year} month={month} metric={metric} classMethod={classMethod} selected={selected} onSelect={onSelect} />
        )}
      </div>
    </section>
  )
}

/** Small click-to-open menu; children is a render prop given a `close` fn. */
function Popover({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={SELECT + ' flex items-center gap-1 hover:border-line-strong hover:text-brand-strong'}>
        {label} <span aria-hidden="true" className="text-[0.7rem]">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} aria-hidden="true" />
          <div className="absolute right-0 z-40 mt-1 min-w-[200px] rounded-lg border border-line bg-surface p-1.5 shadow-lg">
            {children(close)}
          </div>
        </>
      )}
    </div>
  )
}

function Toggle({ view, onView }: { view: CanvasView; onView: (v: CanvasView) => void }) {
  const items: { id: CanvasView; label: string; icon: ReactNode }[] = [
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
      id: 'bars',
      label: 'Bars',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.88rem] font-600 transition-colors ${
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
