import { legendRows, METRIC_CONFIG, NO_DATA } from '../metrics'
import { CLASS_METHODS, METRICS, type ClassMethod, type Metric } from '../types'

/**
 * Compact legend that floats inside the map (bottom-left). pointer-events-none
 * so it never blocks panning/clicking the districts beneath it. Breaks are
 * data-driven and recomputed per metric + year + classification method.
 */
export function MapLegend({
  metric,
  breaks,
  method,
}: {
  metric: Metric
  breaks: number[]
  method: ClassMethod
}) {
  const label = METRICS.find((m) => m.id === metric)?.label ?? ''
  const unit = METRIC_CONFIG[metric].unit
  const methodLabel = CLASS_METHODS.find((m) => m.id === method)?.label ?? ''
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-line bg-surface/92 px-3 py-2.5 shadow-md backdrop-blur-sm">
      <p className="mb-1.5 text-[0.72rem] font-600 uppercase tracking-[0.05em] text-ink-soft">
        {label} <span className="font-400 text-ink-faint">· {unit}</span>
      </p>
      <ul className="space-y-1">
        {legendRows(breaks, metric).map((row) => (
          <li key={row.color + row.label} className="flex items-center gap-2">
            <span className="h-3 w-5 rounded-sm border border-black/10" style={{ background: row.color }} />
            <span className="text-[0.76rem] tabular-nums text-ink-soft">{row.label}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border border-line-strong" style={{ background: NO_DATA }} />
          <span className="text-[0.76rem] text-ink-faint">No data</span>
        </li>
      </ul>
      <p className="mt-1.5 border-t border-line pt-1.5 text-[0.68rem] text-ink-faint">{methodLabel} classes</p>
    </div>
  )
}
