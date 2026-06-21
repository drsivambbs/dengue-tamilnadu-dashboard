import { getScopeTotals, getYoYChange, isPartial } from '../dataService'
import type { Year } from '../types'

const num = (v: number) => v.toLocaleString('en-IN')

export function KpiCards({ year, selected }: { year: Year; selected: string | null }) {
  const t = getScopeTotals(year, selected)
  const yoy = getYoYChange(year, selected)
  const partial = isPartial(year)

  return (
    <div className="flex flex-col gap-3">
      <Kpi label="Reported cases" value={num(t.cases)} foot={partial ? `partial · ${partial}` : 'full year'} />
      <Kpi label="Deaths" value={num(t.deaths)} foot={`CFR ${t.cfr.toFixed(2)}%`} />
      <Kpi label="Attack rate" value={t.attackRate.toFixed(1)} foot="per 100,000" />
      <YoYKpi year={year} yoy={yoy} partial={!!partial} />
    </div>
  )
}

function Kpi({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3 shadow-sm">
      <p className="text-[0.74rem] font-600 uppercase tracking-[0.06em] text-ink-faint">{label}</p>
      <p className="mt-1 font-mono text-[1.55rem] font-600 leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[0.76rem] text-ink-faint">{foot}</p>
    </div>
  )
}

function YoYKpi({
  year,
  yoy,
  partial,
}: {
  year: Year
  yoy: { pct: number; prevYear: number } | null
  partial: boolean
}) {
  // For a partial year, a YoY vs a full previous year would mislead.
  if (partial || !yoy) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3 shadow-sm">
        <p className="text-[0.74rem] font-600 uppercase tracking-[0.06em] text-ink-faint">Change vs previous year</p>
        <p className="mt-1 font-mono text-[1.55rem] font-600 leading-none text-ink-faint/70">—</p>
        <p className="mt-1.5 text-[0.76rem] text-ink-faint">{partial ? 'not comparable (partial)' : 'no prior year'}</p>
      </div>
    )
  }
  const down = yoy.pct < 0
  const color = down ? 'text-good' : 'text-alert'
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3 shadow-sm">
      <p className="text-[0.74rem] font-600 uppercase tracking-[0.06em] text-ink-faint">Change vs {yoy.prevYear}</p>
      <p className={`mt-1 flex items-baseline gap-1.5 font-mono text-[1.55rem] font-600 leading-none ${color}`}>
        <span aria-hidden="true">{down ? '▼' : '▲'}</span>
        {Math.abs(yoy.pct).toFixed(0)}%
      </p>
      <p className="mt-1.5 text-[0.76rem] text-ink-faint">{down ? 'fewer' : 'more'} cases than {year - 1}</p>
    </div>
  )
}
