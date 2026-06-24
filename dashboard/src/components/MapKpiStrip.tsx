import { getScopeTotalsFor, getYoYChange, isPartial } from '../dataService'
import { MONTHS, type Year } from '../types'

const num = (v: number) => v.toLocaleString('en-IN')

/** Compact KPI strip floated over the map (top-left): live figures for the
 *  current scope (whole state or a selected district) and period. */
export function MapKpiStrip({ year, month, selected }: { year: Year; month: number; selected: string | null }) {
  const t = getScopeTotalsFor(year, selected, month)
  const yoy = getYoYChange(year, selected, month)
  const monthly = month >= 0
  const period = monthly ? `${MONTHS[month]} ${year}` : isPartial(year) ? `${year} · ${isPartial(year)}` : `${year}`
  const down = yoy && yoy.pct < 0

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-stretch gap-3 rounded-xl border border-line bg-surface/90 px-4 py-2 shadow-[0_4px_20px_rgba(21,33,46,0.14)] backdrop-blur-sm">
      <div className="flex flex-col justify-center pr-3">
        <p className="text-[0.92rem] font-600 leading-tight text-ink">{selected ?? 'Tamil Nadu'}</p>
        <p className="text-[0.72rem] text-ink-faint">{period}</p>
      </div>
      <Stat label="Cases" value={num(t.cases)} />
      <Stat label="Deaths" value={num(t.deaths)} sub={`CFR ${t.cfr.toFixed(2)}%`} />
      <Stat label="Attack /100k" value={t.attackRate.toFixed(1)} />
      <Stat
        label={monthly ? `vs ${MONTHS[month]} ${year - 1}` : `vs ${year - 1}`}
        value={yoy ? `${down ? '▼' : '▲'} ${Math.abs(yoy.pct).toFixed(0)}%` : '—'}
        color={!yoy ? 'text-ink-faint/70' : down ? 'text-good' : 'text-alert'}
      />
    </div>
  )
}

function Stat({ label, value, sub, color = 'text-ink' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col justify-center border-l border-line pl-3">
      <p className="text-[0.62rem] font-600 uppercase tracking-[0.04em] text-ink-faint">{label}</p>
      <p className={`font-mono text-[1.05rem] font-600 leading-tight ${color}`}>{value}</p>
      {sub && <p className="text-[0.64rem] text-ink-faint">{sub}</p>}
    </div>
  )
}
