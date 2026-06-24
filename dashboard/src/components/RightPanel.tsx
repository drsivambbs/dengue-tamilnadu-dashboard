import { KpiCards } from './KpiCards'
import { isPartial } from '../dataService'
import { MONTHS, type Year } from '../types'

/**
 * Right "summary" rail — scope KPIs for the current selection. Collapsible like
 * the workbench. (District ranking now lives in the canvas Bars view.)
 */
export function RightPanel({
  year,
  selected,
  open,
  onToggle,
  month = -1,
}: {
  year: Year
  selected: string | null
  open: boolean
  onToggle: () => void
  month?: number
}) {
  const partial = isPartial(year)
  const monthly = month >= 0

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
    <aside className="flex w-[256px] shrink-0 flex-col overflow-hidden border-l border-line-strong bg-surface" aria-label="Summary">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-2.5">
        <div>
          <h2 className="font-serif text-[1rem] font-600 text-ink">Summary</h2>
          <p className="text-[0.78rem] text-ink-soft">
            {selected ?? 'Tamil Nadu'} · {monthly ? `${MONTHS[month]} ${year}` : year}
            {partial && !monthly && <span className="text-ink-faint"> (Jan–Jun)</span>}
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

      <div className="p-2.5">
        <KpiCards year={year} selected={selected} month={month} />
      </div>
    </aside>
  )
}
