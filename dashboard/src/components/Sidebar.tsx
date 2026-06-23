import { Panel } from './Panel'
import { downloadCsv } from '../export'
import { CLASS_METHODS, METRICS, type ClassMethod, type Metric } from '../types'

interface Props {
  metric: Metric
  open: boolean
  classMethod: ClassMethod
  onToggle: () => void
  onClassMethod: (m: ClassMethod) => void
  onMetric: (m: Metric) => void
  onReset: () => void
  canReset: boolean
}

/** The "workbench" — the persistent control bench on the left. */
export function Sidebar({ metric, open, classMethod, onToggle, onClassMethod, onMetric, onReset, canReset }: Props) {
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
      className="flex w-[256px] shrink-0 flex-col overflow-y-auto border-r border-line-strong bg-surface"
      aria-label="Dashboard controls"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-2.5">
        <div>
          <h2 className="font-serif text-[1rem] font-600 text-ink">Workbench</h2>
          <p className="text-[0.78rem] text-ink-soft">Choose what to show on the map</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onReset}
            disabled={!canReset}
            title="Reset all filters to defaults"
            className="rounded-lg border border-line px-2.5 py-1.5 text-[0.78rem] font-600 text-ink-soft transition-colors hover:border-line-strong hover:text-brand-strong disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft"
          >
            Reset
          </button>
          <button
            onClick={onToggle}
            aria-label="Collapse workbench"
            title="Collapse workbench"
            className="-mr-1 rounded-lg p-1.5 text-ink-faint hover:bg-brand-soft hover:text-brand-strong"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* VIEW ----------------------------------------------------------- */}
      <Panel title="View">
        <label className="mb-1.5 block text-[0.85rem] font-600 text-ink">Metric</label>
        <div className="flex flex-col gap-1" role="radiogroup" aria-label="Select metric">
          {METRICS.map((m) => {
            const active = m.id === metric
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={active}
                onClick={() => onMetric(m.id)}
                className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  active
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-panel'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? 'border-brand' : 'border-line-strong'
                  }`}
                >
                  {active && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <span>
                  <span className="block text-[0.88rem] font-600 text-ink">{m.label}</span>
                  <span className="block text-[0.74rem] leading-snug text-ink-soft">{m.help}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Panel>

      {/* CLASSIFICATION ------------------------------------------------- */}
      <Panel title="Classification" hint="How the map colours are split into classes (recomputed from the data)." defaultOpen={false}>
        <div className="flex flex-col gap-1" role="radiogroup" aria-label="Classification method">
          {CLASS_METHODS.map((c) => {
            const active = c.id === classMethod
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={active}
                onClick={() => onClassMethod(c.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  active ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-panel'
                }`}
              >
                <span className={`block text-[0.86rem] font-600 ${active ? 'text-brand-strong' : 'text-ink'}`}>
                  {c.label}
                </span>
                <span className="block text-[0.73rem] leading-snug text-ink-faint">{c.help}</span>
              </button>
            )
          })}
        </div>
      </Panel>

      {/* EXPORT --------------------------------------------------------- */}
      <Panel title="Export" defaultOpen={false}>
        <button
          onClick={downloadCsv}
          className="w-full rounded-lg border border-line bg-surface py-2 text-[0.86rem] font-600 text-ink-soft transition-colors hover:border-line-strong hover:text-brand-strong"
        >
          Download data (CSV)
        </button>
        <p className="mt-1.5 text-[0.74rem] text-ink-faint">Map image (PNG): use the PNG button on the map.</p>
      </Panel>
    </aside>
  )
}

