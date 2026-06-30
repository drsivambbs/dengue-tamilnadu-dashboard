import { useMemo, useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts'
import { EpidemicCurve } from './EpidemicCurve'
import { DistrictSearch } from './DistrictSearch'
import { LagStrip } from './LagStrip'
import { getMonthlyMetric, getMonthlyWeather, listDistricts, YEARS, LATEST_YEAR, LATEST_MONTH, lastMonthIndex } from '../dataService'
import { METRIC_CONFIG } from '../metrics'
import { MONTHS, METRICS, type Metric, type Year } from '../types'

const SELECT = 'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.85rem] font-600 text-ink-soft focus:border-brand focus:outline-none'

/** n months before (y,m), clamped to the earliest available month. */
function monthsBack(y: number, m: number, n: number): Pt {
  const min = YEARS[0] * 12
  const total = Math.max(min, y * 12 + m - n)
  return { y: Math.floor(total / 12), m: total % 12 }
}
const Y_LABEL: Record<Metric, string> = {
  cases: 'Reported cases',
  attackRate: 'Attack rate (/100k)',
  deaths: 'Deaths',
  cfr: 'Case fatality (%)',
}
interface Pt { y: number; m: number }

/** Trend page: a full continuous epidemic curve over a date range (tab 1) and
 *  the month-wise year-overlay profile (tab 2). */
export function TrendPage({ selected, onSelect }: { selected: string | null; onSelect: (d: string | null) => void }) {
  const [tab, setTab] = useState<'timeline' | 'monthwise'>('timeline')
  const [resetNonce, setResetNonce] = useState(0) // remounts the active tab to defaults
  const districts = useMemo(() => listDistricts().slice().sort(), [])
  const reset = () => { onSelect(null); setResetNonce((n) => n + 1) }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-line px-5 py-2.5">
          <SubTab active={tab === 'timeline'} onClick={() => setTab('timeline')}>Full epidemic curve</SubTab>
          <SubTab active={tab === 'monthwise'} onClick={() => setTab('monthwise')}>Month-wise (by year)</SubTab>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={reset} title="Reset filters to defaults" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[0.85rem] font-600 text-ink-soft hover:border-line-strong hover:text-brand-strong">Reset</button>
            <div className="w-56"><DistrictSearch districts={districts} selected={selected} onSelect={onSelect} /></div>
          </div>
        </div>
        {tab === 'timeline' ? <Timeline key={resetNonce} selected={selected} /> : <MonthWise key={resetNonce} selected={selected} />}
      </section>
    </main>
  )
}

function MonthWise({ selected }: { selected: string | null }) {
  const [metric, setMetric] = useState<Metric>('cases')
  const [picked, setPicked] = useState<Year[]>(() => YEARS.slice(-3))
  const [showRain, setShowRain] = useState(false)
  const [lag, setLag] = useState(1)
  const years = picked.length ? picked : YEARS
  const toggleYear = (y: Year) => setPicked((p) => (p.includes(y) ? p.filter((x) => x !== y) : [...p, y]))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel/40 px-5 py-2.5">
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className={SELECT} aria-label="Metric">
          {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <span className="ml-2 text-[0.78rem] font-600 uppercase tracking-wide text-ink-faint">Years</span>
        <div className="flex gap-1 rounded-lg bg-panel p-1">
          <button onClick={() => setPicked([])} aria-pressed={picked.length === 0}
            className={`rounded-md px-2.5 py-1 text-[0.82rem] font-600 ${picked.length === 0 ? 'bg-brand text-surface' : 'text-ink-soft hover:text-brand-strong'}`}>All</button>
          {YEARS.map((y) => (
            <button key={y} onClick={() => toggleYear(y)} aria-pressed={picked.includes(y)}
              className={`rounded-md px-2.5 py-1 text-[0.82rem] font-600 ${picked.includes(y) ? 'bg-brand text-surface' : 'text-ink-soft hover:text-brand-strong'}`}>{y}</button>
          ))}
        </div>
        <label className="ml-3 flex items-center gap-1.5 text-[0.82rem] font-600 text-ink-soft">
          <input type="checkbox" checked={showRain} onChange={(e) => setShowRain(e.target.checked)} className="accent-[#2b8a3e]" />
          Rainfall
        </label>
        {showRain && (
          <select value={lag} onChange={(e) => setLag(Number(e.target.value))} className={SELECT} aria-label="Rainfall lag (months)">
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? 'No lag' : `Lag ${n} mo`}</option>)}
          </select>
        )}
        <span className="ml-auto text-[0.8rem] text-ink-soft">{selected ?? 'Tamil Nadu'} · monthly profile</span>
      </div>
      <div className="min-h-0 flex-1 p-4">
        <EpidemicCurve selected={selected} metric={metric} years={years} showRain={showRain} lag={lag} onLagChange={setLag} />
      </div>
    </div>
  )
}

function Timeline({ selected }: { selected: string | null }) {
  const [metric, setMetric] = useState<Metric>('cases')
  // Default to the most recent ~24 months (widen via the From/To selectors).
  const [from, setFrom] = useState<Pt>(() => monthsBack(LATEST_YEAR, LATEST_MONTH, 23))
  const [to, setTo] = useState<Pt>({ y: LATEST_YEAR, m: LATEST_MONTH })
  const [showRain, setShowRain] = useState(false)
  const [lag, setLag] = useState(1) // months rainfall leads the metric
  const fmtVal = METRIC_CONFIG[metric].format
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''

  const data = useMemo(() => {
    const rows: { key: string; label: string; value: number; avg: number | null; rain: number | null; rain0: number | null }[] = []
    for (let y = from.y; y <= to.y; y++) {
      if (!YEARS.includes(y)) continue
      const series = getMonthlyMetric(y, selected, metric)
      const mStart = y === from.y ? from.m : 0
      const mEnd = Math.min(y === to.y ? to.m : 11, lastMonthIndex(y))
      for (let m = mStart; m <= mEnd; m++) {
        // rainfall from `lag` months earlier, aligned to this case-month (chart line)
        const r = monthsBack(y, m, lag)
        const rain = YEARS.includes(r.y) ? getMonthlyWeather(r.y, selected).rain[r.m] ?? null : null
        const rain0 = getMonthlyWeather(y, selected).rain[m] ?? null // same-month, for lag correlation
        rows.push({ key: `${y}-${m}`, label: `${MONTHS[m]} '${String(y).slice(2)}`, value: series[m] ?? 0, avg: null, rain, rain0 })
      }
    }
    // trailing 3-month moving average (trend line)
    rows.forEach((r, i) => {
      const w = rows.slice(Math.max(0, i - 2), i + 1)
      r.avg = +(w.reduce((a, x) => a + x.value, 0) / w.length).toFixed(2)
    })
    return rows
  }, [from, to, selected, metric, lag])

  const monthOpts = (y: number) => Array.from({ length: lastMonthIndex(y) + 1 }, (_, i) => i)
  const setFromY = (y: number) => setFrom((f) => ({ y, m: Math.min(f.m, lastMonthIndex(y)) }))
  const setToY = (y: number) => setTo((t) => ({ y, m: Math.min(t.m, lastMonthIndex(y)) }))

  const axisFmt = (v: number) => (metric === 'cases' && v >= 1000 ? `${v / 1000}k` : metric === 'cfr' ? `${v}%` : `${v}`)

  const Tip = ({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string; value?: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    const val = payload.find((p) => p.dataKey === 'value')?.value
    const avg = payload.find((p) => p.dataKey === 'avg')?.value
    const rain = payload.find((p) => p.dataKey === 'rain')?.value
    return (
      <div className="rounded-lg border border-line-strong bg-surface/98 px-3 py-2 shadow-lg backdrop-blur-sm">
        <p className="font-600 text-ink">{label}</p>
        <p className="text-[0.85rem] text-ink-soft">{metricLabel}: <span className="font-mono font-600 text-ink">{fmtVal(val ?? 0)}</span></p>
        <p className="text-[0.78rem] text-ink-faint">3-mo avg: <span className="font-mono">{fmtVal(avg ?? 0)}</span></p>
        {showRain && <p className="text-[0.78rem] text-[#2b8a3e]">Rainfall (−{lag}mo): <span className="font-mono">{rain == null ? '—' : `${Math.round(rain)} mm`}</span></p>}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel/40 px-5 py-2.5">
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className={SELECT} aria-label="Metric">
          {METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <span className="ml-2 text-[0.78rem] font-600 uppercase tracking-wide text-ink-faint">From</span>
        <RangeSel y={from.y} m={from.m} onY={setFromY} onM={(m) => setFrom((f) => ({ ...f, m }))} monthOpts={monthOpts} />
        <span className="text-[0.78rem] font-600 uppercase tracking-wide text-ink-faint">To</span>
        <RangeSel y={to.y} m={to.m} onY={setToY} onM={(m) => setTo((t) => ({ ...t, m }))} monthOpts={monthOpts} />
        <label className="ml-3 flex items-center gap-1.5 text-[0.82rem] font-600 text-ink-soft">
          <input type="checkbox" checked={showRain} onChange={(e) => setShowRain(e.target.checked)} className="accent-[#2b8a3e]" />
          Rainfall
        </label>
        {showRain && (
          <select value={lag} onChange={(e) => setLag(Number(e.target.value))} className={SELECT} aria-label="Rainfall lag (months)">
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? 'No lag' : `Lag ${n} mo`}</option>)}
          </select>
        )}
        <span className="ml-auto text-[0.8rem] text-ink-soft">{selected ?? 'Tamil Nadu'} · {data.length} months</span>
      </div>

      <div className="min-h-0 flex-1 p-4">
        {data.length === 0 ? (
          <p className="py-10 text-center text-ink-faint">Select a valid range (From must be on or before To).</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 20, bottom: 56, left: 8 }} barCategoryGap="18%">
              <CartesianGrid stroke="#c2cdda" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" interval={data.length > 24 ? Math.floor(data.length / 20) : 0} angle={-55} textAnchor="end" height={52} tick={{ fontSize: 10.5, fill: '#4b5d70' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#4b5d70' }} tickLine={false} axisLine={false} width={60} tickFormatter={axisFmt}>
                <Label value={Y_LABEL[metric]} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: '#7488a0', textAnchor: 'middle' }} />
              </YAxis>
              {showRain && (
                <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 12, fill: '#2b8a3e' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `${v}`}>
                  <Label value="Rainfall (mm)" angle={90} position="insideRight" style={{ fontSize: 12, fill: '#2b8a3e', textAnchor: 'middle' }} />
                </YAxis>
              )}
              <Tooltip content={Tip as never} cursor={{ fill: 'rgba(31,95,166,0.06)' }} />
              <Bar yAxisId="left" dataKey="value" name={metricLabel} fill="#1f5fa6" stroke="#000000" strokeWidth={0.35} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Line yAxisId="left" dataKey="avg" name="3-mo average" type="monotone" stroke="#c0392b" strokeWidth={2} dot={false} isAnimationActive={false} />
              {showRain && <Line yAxisId="rain" dataKey="rain" name="Rainfall" type="monotone" stroke="#2b8a3e" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-5 py-2 text-[0.8rem] text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm bg-[#1f5fa6]" /> Monthly {metricLabel.toLowerCase()}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded bg-[#c0392b]" /> 3-month moving average</span>
        {showRain && <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 rounded bg-[#2b8a3e]" /> Rainfall, {lag === 0 ? 'same month' : `${lag} mo earlier`} (mm)</span>}
        {showRain && <span className="ml-auto"><LagStrip cases={data.map((d) => d.value)} rain={data.map((d) => d.rain0)} lag={lag} onPick={setLag} /></span>}
      </div>
    </div>
  )
}

function RangeSel({ y, m, onY, onM, monthOpts }: { y: number; m: number; onY: (y: number) => void; onM: (m: number) => void; monthOpts: (y: number) => number[] }) {
  return (
    <span className="flex items-center gap-1.5">
      <select value={m} onChange={(e) => onM(Number(e.target.value))} className={SELECT} aria-label="From/To month">
        {monthOpts(y).map((i) => <option key={i} value={i}>{MONTHS[i]}</option>)}
      </select>
      <select value={y} onChange={(e) => onY(Number(e.target.value))} className={SELECT} aria-label="From/To year">
        {YEARS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </span>
  )
}

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3.5 py-1.5 text-[0.9rem] font-600 transition-colors ${active ? 'bg-brand text-surface shadow-sm' : 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong'}`}
    >
      {children}
    </button>
  )
}
