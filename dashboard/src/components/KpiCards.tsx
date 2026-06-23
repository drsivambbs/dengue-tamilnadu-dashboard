import { getScopeTotalsFor, getYoYChange, isPartial } from '../dataService'
import { MONTHS, type Year } from '../types'

const num = (v: number) => v.toLocaleString('en-IN')

export function KpiCards({ year, selected, month = -1 }: { year: Year; selected: string | null; month?: number }) {
  const t = getScopeTotalsFor(year, selected, month)
  const yoy = getYoYChange(year, selected, month)
  const partial = isPartial(year)
  const monthly = month >= 0
  const periodFoot = monthly ? MONTHS[month] : partial ? `partial · ${partial}` : 'full year'

  return (
    <div className="flex flex-col gap-3">
      <Kpi label="Reported cases" value={num(t.cases)} foot={periodFoot} />
      <Kpi label="Deaths" value={num(t.deaths)} foot={`CFR ${t.cfr.toFixed(2)}%`} />
      <Kpi label="Attack rate" value={t.attackRate.toFixed(1)} foot="per 100,000" />
      {/* A single month is comparable year-on-year even when the year is partial. */}
      <YoYKpi year={year} yoy={yoy} partial={!!partial && !monthly} monthly={monthly} monthLabel={monthly ? MONTHS[month] : ''} />
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
  monthly,
  monthLabel,
}: {
  year: Year
  yoy: { pct: number; prevYear: number } | null
  partial: boolean
  monthly: boolean
  monthLabel: string
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
  const context = monthly ? `${monthLabel} ${year - 1}` : `${year - 1}`
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-4 py-3 shadow-sm">
      <p className="text-[0.74rem] font-600 uppercase tracking-[0.06em] text-ink-faint">
        Change vs {monthly ? `${monthLabel} ${yoy.prevYear}` : yoy.prevYear}
      </p>
      <p className={`mt-1 flex items-baseline gap-1.5 font-mono text-[1.55rem] font-600 leading-none ${color}`}>
        <span aria-hidden="true">{down ? '▼' : '▲'}</span>
        {Math.abs(yoy.pct).toFixed(0)}%
      </p>
      <p className="mt-1.5 text-[0.76rem] text-ink-faint">{down ? 'fewer' : 'more'} cases than {context}</p>
    </div>
  )
}
