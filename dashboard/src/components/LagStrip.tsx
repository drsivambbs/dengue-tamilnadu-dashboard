import { useMemo } from 'react'
import { lagCorrelations, bestLag } from '../stats'

/** Inline footer strip: Pearson r of the shown metric vs rainfall at lags 0–3.
 *  `rain` is the SAME-month series (lag 0); the correlation shifts internally.
 *  Clicking a chip sets the active lag. Render only when rainfall is shown. */
export function LagStrip({ cases, rain, lag, onPick }: {
  cases: number[]
  rain: (number | null)[]
  lag: number
  onPick: (lag: number) => void
}) {
  const { corr, best } = useMemo(() => {
    const corr = lagCorrelations(cases, rain, 3)
    return { corr, best: bestLag(corr) }
  }, [cases, rain])

  return (
    <span className="flex items-center gap-1">
      <span className="mr-0.5 text-[0.72rem] font-600 uppercase tracking-wide text-ink-faint">Lag r</span>
      {corr.map((c) => {
        const active = c.lag === lag
        const isBest = c.lag === best.lag && Number.isFinite(best.r)
        return (
          <button
            key={c.lag}
            onClick={() => onPick(c.lag)}
            aria-pressed={active}
            title={`${c.lag === 0 ? 'Same month' : `${c.lag} mo earlier`} · n=${c.n}`}
            className={`rounded-md border px-1.5 py-0.5 text-[0.74rem] font-600 tabular-nums transition-colors ${
              active ? 'border-[#2b8a3e] bg-[#2b8a3e]/10 text-[#1e6b2e]' : 'border-line text-ink-soft hover:border-line-strong'
            }`}
          >
            {c.lag === 0 ? 'Same' : `+${c.lag}`} {Number.isFinite(c.r) ? c.r.toFixed(2) : '—'}
            {isBest && <span className="ml-1 text-[0.58rem] font-700 uppercase text-[#2b8a3e]">best</span>}
          </button>
        )
      })}
    </span>
  )
}
