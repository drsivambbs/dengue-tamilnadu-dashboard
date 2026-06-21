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

const STRENGTH = (r: number) => {
  const a = Math.abs(r)
  if (a < 0.2) return { word: 'very weak', color: '#94a3b8' }
  if (a < 0.4) return { word: 'weak', color: '#7e93ad' }
  if (a < 0.6) return { word: 'moderate', color: '#1f5fa6' }
  if (a < 0.8) return { word: 'strong', color: '#2f8f5b' }
  return { word: 'very strong', color: '#1d6e44' }
}

type ChartView = 'series' | 'scatter'

export function AdvancedAnalytics({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (d: string | null) => void
}) {
  const districts = useMemo(() => listDistricts().slice().sort(), [])
  const [chosenLag, setChosenLag] = useState<number | null>(null)
  const [chart, setChart] = useState<ChartView>('series')
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
  const strength = STRENGTH(r)
  const scope = selected ?? 'Tamil Nadu (all districts)'

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {/* Top bar */}
      <section className="flex flex-wrap items-center gap-4 rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-3 shadow-sm">
        <div>
          <h2 className="font-serif text-[1.2rem] font-600 text-ink">Climate &amp; dengue</h2>
          <p className="text-[0.82rem] text-ink-soft">
            How rainfall &amp; temperature relate to monthly dengue cases · {scope}
          </p>
        </div>
        <div className="ml-auto w-64">
          <DistrictSearch districts={districts} selected={selected} onSelect={onSelect} />
        </div>
      </section>

      {/* Two containers: 2/3 chart (toggle) + 1/3 interpretation */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        {/* LEFT 2/3 — switch between time series and scatter */}
        <section className="flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-serif text-[1.05rem] font-600 text-ink">
              {chart === 'series' ? 'Cases, rainfall & temperature over time' : 'Rainfall vs cases'}
              {chart === 'scatter' && (
                <span className="ml-2 text-[0.8rem] font-400 text-ink-soft">
                  {lag === 0 ? 'same month' : `${lag}-month delay`} · R² {Number.isFinite(r2) ? r2.toFixed(2) : '—'}
                </span>
              )}
            </h3>
            <div className="flex gap-1 rounded-xl bg-panel p-1" role="group" aria-label="Switch chart">
              {([['series', 'Time series'], ['scatter', 'Scatter']] as const).map(([id, label]) => {
                const active = chart === id
                return (
                  <button
                    key={id}
                    onClick={() => setChart(id)}
                    aria-pressed={active}
                    className={`rounded-lg px-3.5 py-1.5 text-[0.85rem] font-600 transition-colors ${
                      active ? 'bg-brand text-surface shadow-sm' : 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              {chart === 'series' ? (
                <ComposedChart data={ts} margin={{ top: 8, right: 8, bottom: 4, left: 6 }}>
                  <CartesianGrid stroke="#e6ecf3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4b5d70' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval={1} />
                  <YAxis yAxisId="cases" tick={{ fontSize: 11, fill: '#4b5d70' }} tickLine={false} axisLine={false} width={46}
                    label={{ value: 'Cases', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#7488a0' } }} />
                  <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 11, fill: '#0f8f8f' }} tickLine={false} axisLine={false} width={48}
                    label={{ value: 'Rain mm', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#0f8f8f' } }} />
                  <YAxis yAxisId="temp" orientation="right" hide domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="cases" dataKey="cases" name="Dengue cases" fill={C_CASES} fillOpacity={0.26} stroke={C_CASES} strokeWidth={1} barSize={13} isAnimationActive={false} />
                  <Line yAxisId="rain" type="monotone" dataKey="rain" name="Rainfall (mm)" stroke={C_RAIN} strokeWidth={2.4} dot={false} isAnimationActive={false} />
                  <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temperature (°C)" stroke={C_TEMP} strokeWidth={1.7} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                </ComposedChart>
              ) : (
                <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: 6 }}>
                  <CartesianGrid stroke="#e6ecf3" />
                  <XAxis type="number" dataKey="x" name="Rainfall" unit=" mm" tick={{ fontSize: 11, fill: '#4b5d70' }}
                    label={{ value: `Rainfall ${lag ? `${lag} month${lag > 1 ? 's' : ''} earlier` : 'this month'} (mm)`, position: 'insideBottom', offset: -8, style: { fontSize: 11, fill: '#7488a0' } }} />
                  <YAxis type="number" dataKey="y" name="Cases" tick={{ fontSize: 11, fill: '#4b5d70' }} width={46}
                    label={{ value: 'Cases', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#7488a0' } }} />
                  <ZAxis range={[70, 70]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
                  <Scatter data={scatter} fill={C_CASES} fillOpacity={0.6} />
                </ScatterChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* RIGHT 1/3 — interactive delay cards + plain interpretation */}
        <section className="flex min-h-0 flex-col overflow-y-auto rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <h3 className="font-serif text-[1.05rem] font-600 text-ink">Rainfall → cases delay</h3>
          <p className="mb-3 text-[0.8rem] text-ink-soft">Tap a delay to update the scatter &amp; reading.</p>

          <div className="grid grid-cols-2 gap-2">
            {corr.map((c) => {
              const active = c.lag === lag
              const isBest = c.lag === best.lag
              return (
                <button
                  key={c.lag}
                  onClick={() => { setChosenLag(c.lag); setChart('scatter') }}
                  aria-pressed={active}
                  className={`relative rounded-lg border px-2 py-2.5 text-center transition-colors ${
                    active ? 'border-brand bg-brand-soft' : 'border-line bg-panel hover:border-line-strong'
                  }`}
                >
                  {isBest && (
                    <span className="absolute -top-1.5 right-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[0.58rem] font-700 uppercase tracking-wide text-surface">
                      Best
                    </span>
                  )}
                  <p className="text-[0.72rem] font-600 uppercase tracking-wide text-ink-faint">
                    {c.lag === 0 ? 'Same mo' : `+${c.lag} mo`}
                  </p>
                  <p className={`font-mono text-[1.25rem] font-600 leading-tight ${active ? 'text-brand-strong' : 'text-ink'}`}>
                    {Number.isFinite(c.r) ? c.r.toFixed(2) : '—'}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <h4 className="mb-2 font-600 text-ink">What this means</h4>
            {Number.isFinite(r) ? (
              <>
                <p className="text-[0.98rem] leading-snug text-ink">
                  {lag === 0
                    ? 'In the same month, more rain goes with more dengue.'
                    : <>More rain is usually followed by more dengue about <strong>{lag} month{lag > 1 ? 's' : ''} later</strong>.</>}
                </p>

                <div className="mt-3">
                  <div className="mb-1 flex items-baseline justify-between text-[0.82rem]">
                    <span className="text-ink-soft">Strength of the link</span>
                    <span className="font-600 capitalize" style={{ color: strength.color }}>{strength.word}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Math.abs(r) * 100, 100)}%`, background: strength.color }} />
                  </div>
                  <p className="mt-1 text-[0.76rem] text-ink-faint">r = {r.toFixed(2)} (0 = none, 1 = perfect)</p>
                </div>

                <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-soft">
                  Rainfall lines up with roughly <strong className="text-ink">{Math.round(r2 * 100)}%</strong> of the
                  month-to-month rise and fall in cases here.
                </p>

                <p className="mt-3 rounded-lg bg-panel p-3 text-[0.79rem] leading-relaxed text-ink-faint">
                  The rest is shaped by mosquito control, population and reporting. A link in the data is not proof that
                  rain causes dengue.
                </p>
              </>
            ) : (
              <p className="text-ink-soft">Not enough data for this district to measure the rainfall–cases link.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
