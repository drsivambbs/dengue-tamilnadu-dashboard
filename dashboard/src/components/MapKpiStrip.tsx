import { getScopeTotalsFor, getYoYChange, isPartial } from '../dataService'
import { MONTHS, type Year } from '../types'

const num = (v: number) => v.toLocaleString('en-IN')

/** KPI cards floated over the bottom-left of the map: compact, professional
 *  tiles for the current scope (whole state or a selected district) + period. */
export function MapKpiStrip({ year, month, selected }: { year: Year; month: number; selected: string | null }) {
  const t = getScopeTotalsFor(year, selected, month)
  const yoy = getYoYChange(year, selected, month)
  const monthly = month >= 0
  const period = monthly ? `${MONTHS[month]} ${year}` : isPartial(year) ? `${year} · ${isPartial(year)}` : `${year}`
  const down = yoy && yoy.pct < 0
  const deltaLabel = monthly ? `vs ${MONTHS[month]} ${year - 1}` : `vs ${year - 1}`

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 w-[460px] rounded-xl border border-line bg-surface/92 p-2.5 shadow-[0_6px_24px_rgba(21,33,46,0.16)] backdrop-blur-sm">
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <span className="font-serif text-[0.98rem] font-600 text-ink">{selected ?? 'Tamil Nadu'}</span>
        <span className="text-[0.74rem] font-600 text-ink-faint">{period}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Card label="Cases" value={num(t.cases)} />
        <Card label="Deaths" value={num(t.deaths)} sub={`CFR ${t.cfr.toFixed(2)}%`} />
        <Card label="Attack /100k" value={t.attackRate.toFixed(1)} />
        <Card
          label={deltaLabel}
          value={yoy ? `${down ? '▼' : '▲'} ${Math.abs(yoy.pct).toFixed(0)}%` : '—'}
          color={!yoy ? 'text-ink-faint' : down ? 'text-good' : 'text-alert'}
        />
      </div>
    </div>
  )
}

function Card({ label, value, sub, color = 'text-ink' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 shadow-sm">
      <p className="truncate text-[0.62rem] font-600 uppercase tracking-[0.04em] text-ink-faint">{label}</p>
      <p className={`font-mono text-[1.15rem] font-600 leading-tight ${color}`}>{value}</p>
      <p className="h-[0.85rem] text-[0.64rem] leading-tight text-ink-faint">{sub ?? ''}</p>
    </div>
  )
}
