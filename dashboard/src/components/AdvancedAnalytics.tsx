import { useMemo } from 'react'
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

export function AdvancedAnalytics({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (d: string | null) => void
}) {
  const districts = useMemo(() => listDistricts().slice().sort(), [])

  const { ts, corr, best, scatter, r2 } = useMemo(() => {
    // Continuous monthly timeline across reported months.
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
    const cases = rows.map((r) => r.cases)
    const rain = rows.map((r) => r.rain)
    const correlations = lagCorrelations(cases, rain, 3)
    const b = bestLag(correlations)
    const { xs, ys } = lagPairs(cases, rain, b.lag)
    const points = xs.map((x, i) => ({ x, y: ys[i] }))
    const r = pearson(xs, ys)
    return { ts: rows, corr: correlations, best: b, scatter: points, r2: Number.isFinite(r) ? r * r : NaN }
  }, [selected])

  const scope = selected ?? 'Tamil Nadu (all districts)'
  const lagLabel = (lag: number) => (lag === 0 ? 'the same month' : `a ${lag}-month lag`)

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {/* Header */}
      <section className="flex flex-wrap items-center gap-4 rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-3.5 shadow-sm">
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

      {/* Dual-axis time series */}
      <section className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
        <h3 className="mb-2 font-serif text-[1.05rem] font-600 text-ink">Cases, rainfall &amp; temperature over time</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ts} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="#e6ecf3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4b5d70' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval={1} />
              <YAxis yAxisId="cases" tick={{ fontSize: 11, fill: '#4b5d70' }} tickLine={false} axisLine={false} width={44}
                label={{ value: 'Cases', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#7488a0' } }} />
              <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 11, fill: '#0f8f8f' }} tickLine={false} axisLine={false} width={44}
                label={{ value: 'Rain mm', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#0f8f8f' } }} />
              <YAxis yAxisId="temp" orientation="right" hide domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="cases" dataKey="cases" name="Dengue cases" fill={C_CASES} fillOpacity={0.28} stroke={C_CASES} strokeWidth={1} barSize={14} isAnimationActive={false} />
              <Line yAxisId="rain" type="monotone" dataKey="rain" name="Rainfall (mm)" stroke={C_RAIN} strokeWidth={2.4} dot={false} isAnimationActive={false} />
              <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temp (°C)" stroke={C_TEMP} strokeWidth={1.8} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Lag + scatter */}
      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <h3 className="mb-1 font-serif text-[1.05rem] font-600 text-ink">Rainfall → cases time lag</h3>
          <p className="mb-3 text-[0.82rem] text-ink-soft">
            Correlation (r) of cases with rainfall shifted forward 0–3 months.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {corr.map((c) => {
              const isBest = c.lag === best.lag
              return (
                <div
                  key={c.lag}
                  className={`rounded-lg border p-2.5 text-center ${isBest ? 'border-brand bg-brand-soft' : 'border-line bg-panel'}`}
                >
                  <p className="text-[0.72rem] font-600 uppercase tracking-wide text-ink-faint">{c.lag} mo</p>
                  <p className={`font-mono text-[1.2rem] font-600 ${isBest ? 'text-brand-strong' : 'text-ink'}`}>
                    {Number.isFinite(c.r) ? c.r.toFixed(2) : '—'}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="mt-3 rounded-lg bg-panel p-3 text-[0.88rem] text-ink-soft">
            {Number.isFinite(best.r) ? (
              <>
                Cases track rainfall most strongly at <strong className="text-ink">{lagLabel(best.lag)}</strong>{' '}
                (r = <strong className="text-brand-strong">{best.r.toFixed(2)}</strong>) — dengue tends to rise{' '}
                {best.lag === 0 ? 'within the same month as' : `about ${best.lag} month${best.lag > 1 ? 's' : ''} after`} heavier rain.
              </>
            ) : (
              'Not enough data to estimate a lag for this scope.'
            )}
          </div>
        </section>

        <section className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-serif text-[1.05rem] font-600 text-ink">Rainfall vs cases</h3>
            <span className="text-[0.82rem] text-ink-soft">
              lag {best.lag} mo · R² = <strong className="text-ink">{Number.isFinite(r2) ? r2.toFixed(2) : '—'}</strong>
            </span>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 16, left: 4 }}>
                <CartesianGrid stroke="#e6ecf3" />
                <XAxis type="number" dataKey="x" name="Rainfall" unit=" mm" tick={{ fontSize: 11, fill: '#4b5d70' }}
                  label={{ value: `Rainfall ${best.lag ? `(${best.lag} mo earlier)` : ''} — mm`, position: 'insideBottom', offset: -8, style: { fontSize: 11, fill: '#7488a0' } }} />
                <YAxis type="number" dataKey="y" name="Cases" tick={{ fontSize: 11, fill: '#4b5d70' }} width={44} />
                <ZAxis range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 12 }} />
                <Scatter data={scatter} fill={C_CASES} fillOpacity={0.65} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </main>
  )
}
