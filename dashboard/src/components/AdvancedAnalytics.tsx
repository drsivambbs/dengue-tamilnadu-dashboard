import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { getMonthlyCases, getMonthlyWeather, listDistricts } from '../dataService'
import { lagCorrelations, bestLag, lagPairs, pearson } from '../stats'
import { DistrictSearch } from './DistrictSearch'
import { YEARS } from '../types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const C_CASES = '#1f5fa6'
const C_RAIN = '#0f8f8f'
const C_TEMP = '#c77d12'

const strengthWord = (r: number) => {
  const a = Math.abs(r)
  if (a < 0.2) return 'very weak'
  if (a < 0.4) return 'weak'
  if (a < 0.6) return 'moderate'
  if (a < 0.8) return 'strong'
  return 'very strong'
}

export function AdvancedAnalytics({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (d: string | null) => void
}) {
  const districts = useMemo(() => listDistricts().slice().sort(), [])
  const [chosenLag, setChosenLag] = useState<number | null>(null)

  // Reset the chosen lag back to "best" whenever the district scope changes.
  useEffect(() => setChosenLag(null), [selected])

  const { ts, cases, rain, corr, best } = useMemo(() => {
    const rows: { label: string; cases: number; rain: number | null; temp: number | null }[] = []
    for (const y of YEARS) {
      const c = getMonthlyCases(y, selected)
      const w = getMonthlyWeather(y, selected)
      let last = -1
      c.forEach((v, i) => { if (v > 0) last = i })
      for (let i = 0; i <= last; i++) {
        if (w.rain[i] == null) continue
        rows.push({ label: `${MONTHS[i]} '${String(y).slice(2)}`, cases: c[i], rain: w.rain[i], temp: w.temp[i] })
      }
    }
    const caseArr = rows.map((r) => r.cases)
    const rainArr = rows.map((r) => r.rain)
    const correlations = lagCorrelations(caseArr, rainArr, 3)
    return { ts: rows, cases: caseArr, rain: rainArr, corr: correlations, best: bestLag(correlations) }
  }, [selected])

  const lag = chosenLag ?? best.lag
  const { scatter, r } = useMemo(() => {
    const { xs, ys } = lagPairs(cases, rain, lag)
    return { scatter: xs.map((x, i) => ({ x, y: ys[i] })), r: pearson(xs, ys) }
  }, [cases, rain, lag])
  const r2 = Number.isFinite(r) ? r * r : NaN

  const scope = selected ?? 'Tamil Nadu (all districts)'

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {/* Top bar */}
      <section className="flex flex-wrap items-center gap-4 rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-3 shadow-sm">
        <div>
          <h2 className="font-serif text-[1.2rem] font-600 text-ink">Climate &amp; dengue</h2>
          <p className="text-[0.82rem] text-ink-soft">
            Monthly cases vs rainfall &amp; temperature · {scope} · weather: Open-Meteo (ERA5)
          </p>
        </div>
        <div className="ml-auto w-64">
          <DistrictSearch districts={districts} selected={selected} onSelect={onSelect} />
        </div>
      </section>

      {/* 3 columns: graph | correlation | cards */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(0,1.05fr)_minmax(0,0.95fr)] gap-3">
        {/* LEFT — time series graph */}
        <section className="flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <h3 className="mb-2 font-serif text-[1.02rem] font-600 text-ink">Cases, rainfall &amp; temperature</h3>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ts} margin={{ top: 8, right: 6, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#e6ecf3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: '#4b5d70' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval={2} />
                <YAxis yAxisId="cases" tick={{ fontSize: 10.5, fill: '#4b5d70' }} tickLine={false} axisLine={false} width={40} />
                <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 10.5, fill: '#0f8f8f' }} tickLine={false} axisLine={false} width={40} />
                <YAxis yAxisId="temp" orientation="right" hide domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                <Bar yAxisId="cases" dataKey="cases" name="Cases" fill={C_CASES} fillOpacity={0.28} stroke={C_CASES} strokeWidth={1} barSize={10} isAnimationActive={false} />
                <Line yAxisId="rain" type="monotone" dataKey="rain" name="Rain (mm)" stroke={C_RAIN} strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temp (°C)" stroke={C_TEMP} strokeWidth={1.6} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* CENTER — correlation scatter (driven by the chosen lag) */}
        <section className="flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-serif text-[1.02rem] font-600 text-ink">Rainfall vs cases</h3>
            <span className="text-[0.8rem] text-ink-soft">
              {lag === 0 ? 'same month' : `${lag}-mo lag`} · R² {Number.isFinite(r2) ? r2.toFixed(2) : '—'}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 10, bottom: 18, left: 0 }}>
                <CartesianGrid stroke="#e6ecf3" />
                <XAxis type="number" dataKey="x" name="Rainfall" unit=" mm" tick={{ fontSize: 10.5, fill: '#4b5d70' }}
                  label={{ value: `Rainfall ${lag ? `${lag} mo earlier` : ''} (mm)`, position: 'insideBottom', offset: -8, style: { fontSize: 10.5, fill: '#7488a0' } }} />
                <YAxis type="number" dataKey="y" name="Cases" tick={{ fontSize: 10.5, fill: '#4b5d70' }} width={40} />
                <ZAxis range={[55, 55]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
                <Scatter data={scatter} fill={C_CASES} fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* RIGHT — interactive cards + plain interpretation */}
        <section className="flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <h3 className="font-serif text-[1.02rem] font-600 text-ink">Rainfall → cases delay</h3>
          <p className="mb-3 text-[0.8rem] text-ink-soft">Tap a delay to see how rain that many months earlier lines up with cases.</p>
          <div className="grid grid-cols-2 gap-2">
            {corr.map((c) => {
              const active = c.lag === lag
              const isBest = c.lag === best.lag
              return (
                <button
                  key={c.lag}
                  onClick={() => setChosenLag(c.lag)}
                  aria-pressed={active}
                  className={`relative rounded-lg border p-3 text-left transition-colors ${
                    active ? 'border-brand bg-brand-soft' : 'border-line bg-panel hover:border-line-strong'
                  }`}
                >
                  {isBest && (
                    <span className="absolute right-2 top-2 rounded-full bg-brand px-1.5 py-0.5 text-[0.6rem] font-700 uppercase tracking-wide text-surface">
                      Best
                    </span>
                  )}
                  <p className="text-[0.74rem] font-600 uppercase tracking-wide text-ink-faint">
                    {c.lag === 0 ? 'Same month' : `${c.lag} mo later`}
                  </p>
                  <p className={`font-mono text-[1.35rem] font-600 leading-tight ${active ? 'text-brand-strong' : 'text-ink'}`}>
                    {Number.isFinite(c.r) ? c.r.toFixed(2) : '—'}
                  </p>
                  <p className="text-[0.68rem] text-ink-faint">r</p>
                </button>
              )
            })}
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg bg-panel p-3.5 text-[0.9rem] leading-relaxed text-ink-soft">
            {Number.isFinite(r) ? (
              <>
                <p className="mb-2 font-600 text-ink">What this means</p>
                <p className="mb-2">
                  {lag === 0
                    ? 'In the same month, more rain goes together with more dengue cases.'
                    : `More rain is usually followed by more dengue about ${lag} month${lag > 1 ? 's' : ''} later.`}
                </p>
                <p className="mb-2">
                  The link is <strong className="text-ink">{strengthWord(r)}</strong> (r = {r.toFixed(2)}). Rainfall lines up with
                  roughly <strong className="text-ink">{Math.round(r2 * 100)}%</strong> of the month-to-month rise and fall in cases.
                </p>
                <p className="text-[0.82rem] text-ink-faint">
                  The rest is driven by other things — mosquito control, population, and reporting. Correlation is not proof of cause.
                </p>
              </>
            ) : (
              <p>Not enough data for this district to measure the rainfall–cases link.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
