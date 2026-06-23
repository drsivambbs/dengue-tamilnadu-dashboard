import { useMemo } from 'react'
import { getYearValues, getMonthValues } from '../dataService'
import { classify } from '../classify'
import { colorForValue, textOn, METRIC_CONFIG } from '../metrics'
import { METRICS, type ClassMethod, type Metric, type Year } from '../types'

/** Ranked district list for the current metric + year (+ month). Each district's
 *  name carries its map colour so the list reads like the choropleth. */
export function DistrictRanking({
  year,
  metric,
  selected,
  onSelect,
  month = -1,
  classMethod = 'quantile',
}: {
  year: Year
  metric: Metric
  selected: string | null
  onSelect: (d: string | null) => void
  month?: number
  classMethod?: ClassMethod
}) {
  const label = METRICS.find((m) => m.id === metric)?.label ?? ''
  const fmt = METRIC_CONFIG[metric].format

  const ranked = useMemo(() => {
    const rows = (month >= 0 ? getMonthValues(year, month, metric) : getYearValues(year, metric)).sort((a, b) => b.value - a.value)
    const breaks = classify(rows.map((r) => r.value), classMethod)
    return rows.map((r, i) => ({ ...r, rank: i + 1, color: colorForValue(r.value, breaks) }))
  }, [year, metric, month, classMethod])

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line">
      <div className="flex items-baseline justify-between px-4 pb-1 pt-2.5">
        <h3 className="font-serif text-[0.95rem] font-600 text-ink">District ranking</h3>
        <span className="text-[0.72rem] text-ink-faint">{label}</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {ranked.map((r) => {
          const active = r.district === selected
          return (
            <li key={r.district}>
              <button
                onClick={() => onSelect(active ? null : r.district)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2 rounded-md py-0.5 pr-1 text-left transition-[outline] ${
                  active ? 'outline outline-2 outline-brand' : ''
                }`}
              >
                <span className="w-4 shrink-0 text-right font-mono text-[0.72rem] text-ink-faint">{r.rank}</span>
                <span
                  className="min-w-0 flex-1 truncate rounded px-2 py-1 text-[0.82rem] font-600"
                  style={{ background: r.color, color: textOn(r.color) }}
                >
                  {r.district}
                </span>
                <span className="shrink-0 font-mono text-[0.8rem] font-600 text-ink">{fmt(r.value)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
