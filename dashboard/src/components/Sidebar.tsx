import { Panel } from './Panel'
import { legendRows, METRIC_CONFIG } from '../metrics'
import { METRICS, YEARS, type Metric, type Year } from '../types'

interface Props {
  year: Year
  metric: Metric
  onYear: (y: Year) => void
  onMetric: (m: Metric) => void
}

/** The "workbench" — the persistent control bench on the left. */
export function Sidebar({ year, metric, onYear, onMetric }: Props) {
  return (
    <aside
      className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line-strong bg-surface"
      aria-label="Dashboard controls"
    >
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-serif text-[1.05rem] font-600 text-ink">Workbench</h2>
        <p className="text-[0.82rem] text-ink-soft">Choose what to show on the map</p>
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

      {/* FIND DISTRICT -------------------------------------------------- */}
      <Panel title="Find district">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3.5 py-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-faint" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search a district…"
            disabled
            className="w-full bg-transparent text-[0.95rem] text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed"
            aria-label="Search district (available next phase)"
          />
        </div>
        <p className="mt-2 text-[0.78rem] text-ink-faint">Search & highlight arrive with the map (Phase 1c).</p>
      </Panel>

      {/* LEGEND --------------------------------------------------------- */}
      <Panel title="Legend" hint={`${METRICS.find((m) => m.id === metric)?.label} (${METRIC_CONFIG[metric].unit})`}>
        {legendRows(metric).map((row) => (
          <LegendSwatch key={row.color} color={row.color} label={row.label} />
        ))}
        <div className="mt-2 flex items-center gap-2.5 py-1">
          <span className="h-4 w-7 rounded-sm border border-line-strong bg-[#d9d9d9]" />
          <span className="text-[0.85rem] text-ink-soft">No data</span>
        </div>
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

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="h-4 w-7 rounded-sm border border-line-strong" style={{ background: color }} />
      <span className="text-[0.85rem] text-ink-soft">{label || ' '}</span>
    </div>
  )
}
