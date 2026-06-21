import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { getMonthlyCases, getMonthlyWeather, listDistricts } from '../dataService'
import { lagCorrelations, bestLag, lagPairs, pearson } from '../stats'
import { DistrictSearch } from './DistrictSearch'
import { YEARS } from '../types'
import climateModelRaw from '../data/climate_model.json'

interface ModelFactor {
  key: FactorKey
  label: string
  irr: number
  ci: [number, number]
  p: number
  importance: number
  significant: boolean
}
const MODEL = climateModelRaw as unknown as {
  lag_months: number
  n: number
  ranked: FactorKey[]
  factors: ModelFactor[]
}
const MODEL_BY: Record<string, ModelFactor> = Object.fromEntries(MODEL.factors.map((f) => [f.key, f]))
const MAX_IMP = Math.max(...MODEL.factors.map((f) => f.importance))
// effect size shown per natural step of each factor
const STEP: Record<FactorKey, string> = { rain: 'per +10 mm', hum: 'per +1%', temp: 'per +1 °C' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const C_CASES = '#1f5fa6'

type FactorKey = 'rain' | 'hum' | 'temp'
const FACTORS: Record<FactorKey, { label: string; short: string; unit: string; color: string; axis: string }> = {
  rain: { label: 'Rainfall', short: 'Rain', unit: 'mm', color: '#0f8f8f', axis: 'Rain (mm)' },
  hum: { label: 'Humidity', short: 'Humidity', unit: '%', color: '#7b5ea7', axis: 'Humidity (%)' },
  temp: { label: 'Temperature', short: 'Temp', unit: '°C', color: '#c77d12', axis: 'Temp (°C)' },
}
const FACTOR_ORDER: FactorKey[] = ['rain', 'hum', 'temp']

type ChartView = 'series' | 'scatter'

export function AdvancedAnalytics({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (d: string | null) => void
}) {
  const districts = useMemo(() => listDistricts().slice().sort(), [])
  const [factor, setFactor] = useState<FactorKey>('rain')
  const [chosenLag, setChosenLag] = useState<number | null>(null)
  const [chart, setChart] = useState<ChartView>('series')
  useEffect(() => setChosenLag(null), [selected, factor])

  const { ts, cases, series, corrByFactor, bestByFactor } = useMemo(() => {
    const rows: { label: string; cases: number; rain: number | null; hum: number | null; temp: number | null }[] = []
    for (const y of YEARS) {
      const c = getMonthlyCases(y, selected)
      const w = getMonthlyWeather(y, selected)
      const hum = w.hum ?? Array(12).fill(null)
      let last = -1
      c.forEach((v, i) => { if (v > 0) last = i })
      for (let i = 0; i <= last; i++) {
        if (w.rain[i] == null) continue
        rows.push({ label: `${MONTHS[i]} '${String(y).slice(2)}`, cases: c[i], rain: w.rain[i], hum: hum[i], temp: w.temp[i] })
      }
    }
    const caseArr = rows.map((r) => r.cases)
    const ser: Record<FactorKey, (number | null)[]> = {
      rain: rows.map((r) => r.rain),
      hum: rows.map((r) => r.hum),
      temp: rows.map((r) => r.temp),
    }
    const corrs = {} as Record<FactorKey, ReturnType<typeof lagCorrelations>>
    const bests = {} as Record<FactorKey, ReturnType<typeof bestLag>>
    for (const f of FACTOR_ORDER) {
      corrs[f] = lagCorrelations(caseArr, ser[f], 3)
      bests[f] = bestLag(corrs[f])
    }
    return { ts: rows, cases: caseArr, series: ser, corrByFactor: corrs, bestByFactor: bests }
  }, [selected])

  const corr = corrByFactor[factor]
  const best = bestByFactor[factor]
  const lag = chosenLag ?? best.lag
  const { scatter, r } = useMemo(() => {
    const { xs, ys } = lagPairs(cases, series[factor], lag)
    return { scatter: xs.map((x, i) => ({ x, y: ys[i] })), r: pearson(xs, ys) }
  }, [cases, series, factor, lag])
  const r2 = Number.isFinite(r) ? r * r : NaN
  const fc = FACTORS[factor]
  const scope = selected ?? 'Tamil Nadu (all districts)'

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {/* Top bar */}
      <section className="flex flex-wrap items-center gap-4 rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-3 shadow-sm">
        <div>
          <h2 className="font-serif text-[1.2rem] font-600 text-ink">Climate &amp; dengue</h2>
          <p className="text-[0.82rem] text-ink-soft">Which weather factor drives dengue, and how early it warns · {scope}</p>
        </div>
        <div className="ml-auto w-64">
          <DistrictSearch districts={districts} selected={selected} onSelect={onSelect} />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        {/* LEFT — chart with toggle */}
        <section className="flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-serif text-[1.05rem] font-600 text-ink">
              {chart === 'series' ? `Cases & ${fc.label.toLowerCase()} over time` : `${fc.label} vs cases`}
              {chart === 'scatter' && (
                <span className="ml-2 text-[0.8rem] font-400 text-ink-soft">
                  {lag === 0 ? 'same month' : `${lag}-mo delay`} · R² {Number.isFinite(r2) ? r2.toFixed(2) : '—'}
                </span>
              )}
            </h3>
            <div className="flex gap-1 rounded-xl bg-panel p-1" role="group" aria-label="Switch chart">
              {([['series', 'Time series'], ['scatter', 'Scatter']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setChart(id)}
                  aria-pressed={chart === id}
                  className={`rounded-lg px-3.5 py-1.5 text-[0.85rem] font-600 transition-colors ${
                    chart === id ? 'bg-brand text-surface shadow-sm' : 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong'
                  }`}
                >
                  {label}
                </button>
              ))}
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
                  <YAxis yAxisId="f" orientation="right" tick={{ fontSize: 11, fill: fc.color }} tickLine={false} axisLine={false} width={48}
                    label={{ value: fc.axis, angle: 90, position: 'insideRight', style: { fontSize: 11, fill: fc.color } }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="cases" dataKey="cases" name="Dengue cases" fill={C_CASES} fillOpacity={0.26} stroke={C_CASES} strokeWidth={1} barSize={13} isAnimationActive={false} />
                  <Line yAxisId="f" type="monotone" dataKey={factor} name={`${fc.label} (${fc.unit})`} stroke={fc.color} strokeWidth={2.4} dot={false} isAnimationActive={false} connectNulls />
                </ComposedChart>
              ) : (
                <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: 6 }}>
                  <CartesianGrid stroke="#e6ecf3" />
                  <XAxis type="number" dataKey="x" name={fc.label} unit={` ${fc.unit}`} tick={{ fontSize: 11, fill: '#4b5d70' }}
                    label={{ value: `${fc.label} ${lag ? `${lag} month${lag > 1 ? 's' : ''} earlier` : 'this month'} (${fc.unit})`, position: 'insideBottom', offset: -8, style: { fontSize: 11, fill: '#7488a0' } }} />
                  <YAxis type="number" dataKey="y" name="Cases" tick={{ fontSize: 11, fill: '#4b5d70' }} width={46}
                    label={{ value: 'Cases', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#7488a0' } }} />
                  <ZAxis range={[70, 70]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
                  <Scatter data={scatter} fill={fc.color} fillOpacity={0.6} />
                </ScatterChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* RIGHT — drivers ranking + delay cards + interpretation */}
        <section className="flex min-h-0 flex-col overflow-y-auto rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <h3 className="font-serif text-[1.05rem] font-600 text-ink">Which factor matters most</h3>
          <p className="mb-2 text-[0.8rem] text-ink-soft">
            From a statistical model across all districts (rain, humidity &amp; temperature weighed together). Tap to explore.
          </p>
          <div className="flex flex-col gap-1.5">
            {MODEL.ranked.map((fk, i) => {
              const m = MODEL_BY[fk]
              const active = fk === factor
              return (
                <button
                  key={fk}
                  onClick={() => setFactor(fk)}
                  aria-pressed={active}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    active ? 'border-brand bg-brand-soft' : 'border-line bg-panel hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 text-center font-mono text-[0.8rem] text-ink-faint">{i + 1}</span>
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: FACTORS[fk].color }} />
                    <span className={`flex-1 text-[0.9rem] ${active ? 'font-600 text-brand-strong' : 'text-ink'}`}>{FACTORS[fk].label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-700 uppercase tracking-wide ${m.significant ? 'bg-good/15 text-good' : 'bg-line text-ink-faint'}`}>
                      {m.significant ? 'Driver' : 'Minor'}
                    </span>
                  </div>
                  <div className="ml-[1.65rem] mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full" style={{ width: `${(m.importance / MAX_IMP) * 100}%`, background: FACTORS[fk].color }} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* timing for the chosen factor (per-scope correlation) */}
          <h4 className="mt-4 font-600 text-ink">{fc.label}: how early it warns</h4>
          <p className="mb-1.5 text-[0.76rem] text-ink-faint">
            Cases vs {fc.label.toLowerCase()} 0–3 months earlier · {selected ?? 'all Tamil Nadu'}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {corr.map((c) => {
              const active = c.lag === lag
              const isBest = c.lag === best.lag
              return (
                <button
                  key={c.lag}
                  onClick={() => { setChosenLag(c.lag); setChart('scatter') }}
                  aria-pressed={active}
                  className={`relative rounded-lg border px-1 py-2 text-center transition-colors ${
                    active ? 'border-brand bg-brand-soft' : 'border-line bg-panel hover:border-line-strong'
                  }`}
                >
                  {isBest && <span className="absolute -top-1.5 right-1 rounded-full bg-brand px-1 py-0.5 text-[0.52rem] font-700 uppercase text-surface">Best</span>}
                  <p className="text-[0.66rem] font-600 uppercase tracking-wide text-ink-faint">{c.lag === 0 ? 'Same' : `+${c.lag}mo`}</p>
                  <p className={`font-mono text-[1rem] font-600 leading-tight ${active ? 'text-brand-strong' : 'text-ink'}`}>
                    {Number.isFinite(c.r) ? c.r.toFixed(2) : '—'}
                  </p>
                </button>
              )
            })}
          </div>

          {/* model-based interpretation */}
          <div className="mt-4 border-t border-line pt-3 text-[0.9rem] leading-relaxed">
            {(() => {
              const m = MODEL_BY[factor]
              const pct = Math.abs((m.irr - 1) * 100).toFixed(1)
              const more = m.irr > 1
              return (
                <>
                  <p className="text-[0.96rem] text-ink">
                    {m.significant
                      ? <><strong>{fc.label}</strong> is an independent driver of dengue.</>
                      : <><strong>{fc.label}</strong> is not an independent driver once rainfall &amp; humidity are accounted for.</>}
                  </p>
                  <p className="mt-2 text-ink-soft">
                    {m.significant
                      ? <>More {fc.label.toLowerCase()} → {more ? 'more' : 'fewer'} dengue, about <strong className="text-ink">{pct}%</strong> {STEP[factor]} a month later (holding the other two constant).</>
                      : <>On its own it tracks dengue (it’s seasonal), but it adds little beyond rainfall and humidity.</>}
                  </p>
                  {Number.isFinite(best.r) && (
                    <p className="mt-2 text-ink-soft">
                      Timing: cases tend to follow {fc.label.toLowerCase()} by about{' '}
                      <strong className="text-ink">{best.lag === 0 ? 'the same month' : `${best.lag} month${best.lag > 1 ? 's' : ''}`}</strong>.
                    </p>
                  )}
                  <p className="mt-3 rounded-lg bg-panel p-3 text-[0.79rem] text-ink-faint">
                    Based on a negative binomial model ({MODEL.n} district-months). Statistical links, not proof of cause.
                  </p>
                </>
              )
            })()}
          </div>
        </section>
      </div>
    </main>
  )
}
