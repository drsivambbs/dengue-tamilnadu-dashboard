import { useMemo } from 'react'
import { getYearValues } from '../dataService'
import { METRIC_CONFIG } from '../metrics'
import { METRICS, type Metric, type Year } from '../types'

/** Ranked district list for the current metric + year. Click to select. */
export function DistrictRanking({
  year,
  metric,
  selected,
  onSelect,
}: {
  year: Year
  metric: Metric
  selected: string | null
  onSelect: (d: string | null) => void
}) {
  const label = METRICS.find((m) => m.id === metric)?.label ?? ''
  const fmt = METRIC_CONFIG[metric].format

  const ranked = useMemo(() => {
    const rows = getYearValues(year, metric).sort((a, b) => b.value - a.value)
    const max = rows.length ? rows[0].value : 0
    return rows.map((r, i) => ({ ...r, rank: i + 1, frac: max ? r.value / max : 0 }))
  }, [year, metric])

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line">
      <div className="flex items-baseline justify-between px-5 pb-1.5 pt-3.5">
        <h3 className="font-serif text-[1rem] font-600 text-ink">District ranking</h3>
        <span className="text-[0.76rem] text-ink-faint">{label}</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {ranked.map((r) => {
          const active = r.district === selected
          return (
            <li key={r.district}>
              <button
                onClick={() => onSelect(active ? null : r.district)}
                aria-pressed={active}
                className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 py-1.5 text-left transition-colors ${
                  active ? 'bg-brand-soft' : 'hover:bg-panel'
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-brand/10"
                  style={{ width: `${Math.max(r.frac * 100, 1.5)}%` }}
                  aria-hidden="true"
                />
                <span className="relative w-5 shrink-0 text-right font-mono text-[0.78rem] text-ink-faint">{r.rank}</span>
                <span className={`relative min-w-0 flex-1 truncate text-[0.86rem] ${active ? 'font-600 text-brand-strong' : 'text-ink'}`}>
                  {r.district}
                </span>
                <span className="relative shrink-0 font-mono text-[0.82rem] font-600 text-ink">{fmt(r.value)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
