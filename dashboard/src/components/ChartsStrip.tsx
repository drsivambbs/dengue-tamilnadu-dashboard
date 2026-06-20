import { KpiCards } from './KpiCards'
import { EpidemicCurve } from './EpidemicCurve'
import type { Year } from '../types'

/** Bottom analytics strip: KPI cards (left) + epidemic curve (right). */
export function ChartsStrip({ year, selected }: { year: Year; selected: string | null }) {
  return (
    <section
      className="grid h-[268px] shrink-0 grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-4"
      aria-label="Summary indicators and trend"
    >
      <KpiCards year={year} selected={selected} />
      <EpidemicCurve selected={selected} />
    </section>
  )
}
