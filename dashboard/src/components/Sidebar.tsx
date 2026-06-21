import { useMemo } from 'react'
import { Panel } from './Panel'
import { DistrictSearch } from './DistrictSearch'
import { METRIC_CONFIG } from '../metrics'
import { listDistricts, getRecord } from '../dataService'
import { CLASS_METHODS, METRICS, YEARS, type ClassMethod, type Metric, type Year } from '../types'

interface Props {
  year: Year
  metric: Metric
  selected: string | null
  open: boolean
  classMethod: ClassMethod
  onToggle: () => void
  onClassMethod: (m: ClassMethod) => void
  onYear: (y: Year) => void
  onMetric: (m: Metric) => void
  onSelect: (d: string | null) => void
}

/** The "workbench" — the persistent control bench on the left. */
export function Sidebar({ year, metric, selected, open, classMethod, onToggle, onClassMethod, onYear, onMetric, onSelect }: Props) {
  const districts = useMemo(() => listDistricts().slice().sort(), [])

  if (!open) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-line-strong bg-surface py-3" aria-label="Dashboard controls (collapsed)">
        <button
          onClick={onToggle}
          aria-label="Expand workbench"
          title="Expand workbench"
          className="rounded-lg p-2 text-ink-soft hover:bg-brand-soft hover:text-brand-strong"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="mt-3 [writing-mode:vertical-rl] text-[0.72rem] font-600 uppercase tracking-[0.12em] text-ink-faint">
          Workbench
        </span>
      </aside>
    )
  }

  return (
    <aside
      className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-r border-line-strong bg-surface"
      aria-label="Dashboard controls"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-serif text-[1.05rem] font-600 text-ink">Workbench</h2>
          <p className="text-[0.82rem] text-ink-soft">Choose what to show on the map</p>
        </div>
        <button
          onClick={onToggle}
          aria-label="Collapse workbench"
          title="Collapse workbench"
          className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink-faint hover:bg-brand-soft hover:text-brand-strong"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* VIEW ----------------------------------------------------------- */}
      <Panel title="View">
        <label className="mb-2 block text-[0.9rem] font-600 text-ink">Year</label>
        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-panel p-1.5" role="group" aria-label="Select year">
          {YEARS.map((y) => {
            const active = y === year
            return (
              <button
                key={y}
                onClick={() => onYear(y)}
                aria-pressed={active}
                className={`rounded-lg py-2.5 text-[0.95rem] font-600 transition-colors ${
                  active
                    ? 'bg-brand text-surface shadow-sm'
                    : 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong'
                }`}
              >
                {y}
                {y === 2026 && <span className="ml-1 align-super text-[0.6rem]">*</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[0.78rem] text-ink-faint">* 2026 is partial (Jan–Jun)</p>

        <label className="mb-2 mt-5 block text-[0.9rem] font-600 text-ink">Metric</label>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Select metric">
          {METRICS.map((m) => {
            const active = m.id === metric
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={active}
                onClick={() => onMetric(m.id)}
                className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                  active
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-panel'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? 'border-brand' : 'border-line-strong'
                  }`}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                </span>
                <span>
                  <span className="block text-[0.95rem] font-600 text-ink">{m.label}</span>
                  <span className="block text-[0.8rem] text-ink-soft">{m.help}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Panel>

      {/* MAP LAYERS ----------------------------------------------------- */}
      <Panel title="Map layers" hint="Toggle data layers. More GIS layers arrive in later phases.">
        <LayerRow label="District choropleth" sublabel="Selected metric by district" enabled />
        <LayerRow label="Health facilities" sublabel="Point layer" soon />
        <LayerRow label="Rainfall" sublabel="Raster overlay" soon />
        <LayerRow label="Population density" sublabel="Raster overlay" soon />
      </Panel>

      {/* CLASSIFICATION ------------------------------------------------- */}
      <Panel title="Classification" hint="How the map colours are split into classes (recomputed from the data)." defaultOpen={false}>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Classification method">
          {CLASS_METHODS.map((c) => {
            const active = c.id === classMethod
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={active}
                onClick={() => onClassMethod(c.id)}
                className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                  active ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-panel'
                }`}
              >
                <span className={`block text-[0.92rem] font-600 ${active ? 'text-brand-strong' : 'text-ink'}`}>
                  {c.label}
                </span>
                <span className="block text-[0.76rem] leading-snug text-ink-faint">{c.help}</span>
              </button>
            )
          })}
        </div>
      </Panel>

      {/* FIND DISTRICT -------------------------------------------------- */}
      <Panel title="Find district">
        <DistrictSearch districts={districts} selected={selected} onSelect={onSelect} />
        {selected && (
          <SelectedReadout district={selected} year={year} metric={metric} onClear={() => onSelect(null)} />
        )}
      </Panel>

      {/* EXPORT --------------------------------------------------------- */}
      <Panel title="Export" defaultOpen={false}>
        <button
          disabled
          className="mb-2 w-full rounded-lg border border-line bg-panel py-3 text-[0.9rem] font-600 text-ink-soft disabled:cursor-not-allowed disabled:opacity-70"
        >
          Download map (PNG)
        </button>
        <button
          disabled
          className="w-full rounded-lg border border-line bg-panel py-3 text-[0.9rem] font-600 text-ink-soft disabled:cursor-not-allowed disabled:opacity-70"
        >
          Download data (CSV)
        </button>
      </Panel>
    </aside>
  )
}

function LayerRow({
  label,
  sublabel,
  enabled = false,
  soon = false,
}: {
  label: string
  sublabel: string
  enabled?: boolean
  soon?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className={`text-[0.95rem] font-600 ${soon ? 'text-ink-faint' : 'text-ink'}`}>{label}</p>
        <p className="text-[0.8rem] text-ink-faint">{sublabel}</p>
      </div>
      {soon ? (
        <span className="rounded-full border border-line bg-panel px-2.5 py-1 text-[0.68rem] font-600 uppercase tracking-wide text-ink-faint">
          Soon
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${
            enabled ? 'justify-end bg-brand' : 'justify-start bg-line-strong'
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-surface shadow" />
        </span>
      )}
    </div>
  )
}

function SelectedReadout({
  district,
  year,
  metric,
  onClear,
}: {
  district: string
  year: Year
  metric: Metric
  onClear: () => void
}) {
  const rec = getRecord(district, year)
  if (!rec) return null
  const fmt = METRIC_CONFIG[metric].format
  const label = METRICS.find((m) => m.id === metric)?.label ?? ''
  return (
    <div className="mt-3 rounded-lg border border-brand/40 bg-brand-soft/60 p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-serif text-[1.02rem] font-600 leading-tight text-ink">{district}</p>
        <button
          onClick={onClear}
          className="rounded-md px-2 py-0.5 text-[0.78rem] font-600 text-brand-strong hover:bg-surface"
        >
          Clear
        </button>
      </div>
      <dl className="space-y-1 text-[0.85rem]">
        <ReadRow label={label} value={fmt(rec[metric])} highlight />
        <ReadRow label="Cases" value={rec.cases.toLocaleString('en-IN')} />
        <ReadRow label="Deaths" value={rec.deaths.toLocaleString('en-IN')} />
        <ReadRow label="Attack rate" value={`${rec.attackRate.toFixed(1)} /100k`} />
        <ReadRow label="CFR" value={`${rec.cfr.toFixed(2)}%`} />
      </dl>
    </div>
  )
}

function ReadRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`font-mono font-600 ${highlight ? 'text-brand-strong' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}
