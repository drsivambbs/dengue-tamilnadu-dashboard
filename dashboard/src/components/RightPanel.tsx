import { KpiCards } from './KpiCards'
import { DistrictRanking } from './DistrictRanking'
import { isPartial } from '../dataService'
import type { Metric, Year } from '../types'

/**
 * Right "summary" rail — scope KPIs + district ranking. Collapsible like the
 * workbench; the natural home for the insights banner later.
 */
export function RightPanel({
  year,
  metric,
  selected,
  open,
  onToggle,
  onSelect,
}: {
  year: Year
  metric: Metric
  selected: string | null
  open: boolean
  onToggle: () => void
  onSelect: (d: string | null) => void
}) {
  const partial = isPartial(year)

  if (!open) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-l border-line-strong bg-surface py-3" aria-label="Summary (collapsed)">
        <button
          onClick={onToggle}
          aria-label="Expand summary"
          title="Expand summary"
          className="rounded-lg p-2 text-ink-soft hover:bg-brand-soft hover:text-brand-strong"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="mt-3 [writing-mode:vertical-rl] text-[0.72rem] font-600 uppercase tracking-[0.12em] text-ink-faint">
          Summary
        </span>
      </aside>
    )
  }

  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-line-strong bg-surface" aria-label="Summary">
      <div className="flex items-start justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-serif text-[1.05rem] font-600 text-ink">Summary</h2>
          <p className="text-[0.82rem] text-ink-soft">
            {selected ?? 'Tamil Nadu'} · {year}
            {partial && <span className="text-ink-faint"> (Jan–Jun)</span>}
          </p>
        </div>
        <button
          onClick={onToggle}
          aria-label="Collapse summary"
          title="Collapse summary"
          className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink-faint hover:bg-brand-soft hover:text-brand-strong"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <KpiCards year={year} selected={selected} />
      </div>
      <DistrictRanking year={year} metric={metric} selected={selected} onSelect={onSelect} />
    </aside>
  )
}
