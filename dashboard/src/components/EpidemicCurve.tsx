import { useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceDot, Label,
} from 'recharts'
import { getMonthlyCases, getMonthlyMetric } from '../dataService'
import { METRIC_CONFIG } from '../metrics'
import { YEARS, type Metric } from '../types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SERIES = [
  { year: 2024, color: '#9aa7b5', width: 2, dash: '5 4' },
  { year: 2025, color: '#1f5fa6', width: 3, dash: undefined },
  { year: 2026, color: '#c0392b', width: 3, dash: undefined },
] as const

const Y_LABEL: Record<Metric, string> = {
  cases: 'Reported cases',
  attackRate: 'Attack rate (/100k)',
  deaths: 'Deaths',
  cfr: 'Case fatality (%)',
}

interface CurveTooltipProps {
  active?: boolean
  label?: string | number
  payload?: { name?: string; value?: number; color?: string }[]
}

export function EpidemicCurve({ selected, metric }: { selected: string | null; metric: Metric }) {
  const fmtVal = METRIC_CONFIG[metric].format

  const { data, peak } = useMemo(() => {
    // Reported extent comes from cases (a 0-CFR month is real, not "no data").
    const byYear = YEARS.map((y) => {
      const cases = getMonthlyCases(y, selected)
      let last = -1
      cases.forEach((v, i) => { if (v > 0) last = i })
      const vals = getMonthlyMetric(y, selected, metric)
      const series = vals.map((v, i) => (i <= last ? v : null))
      return { y, series }
    })
    const rows = MONTHS.map((m, i) => {
      const row: Record<string, number | string | null> = { month: m }
      byYear.forEach(({ y, series }) => (row[y] = series[i]))
      return row
    })
    // Peak of the most recent full year (2025) for annotation.
    const ref = byYear.find((b) => b.y === 2025)?.series ?? []
    let pIdx = 0
    ref.forEach((v, i) => { if ((v ?? 0) > (ref[pIdx] ?? 0)) pIdx = i })
    const peakVal = ref[pIdx]
    return { data: rows, peak: peakVal ? { month: MONTHS[pIdx], value: peakVal } : null }
  }, [selected, metric])

  const axisFmt = (v: number) => {
    if (metric === 'cases') return v >= 1000 ? `${v / 1000}k` : `${v}`
    if (metric === 'cfr') return `${v}%`
    return `${v}`
  }

  const Tip = ({ active, label, payload }: CurveTooltipProps) => {
    if (!active || !payload?.length) return null
    const rows = [...payload]
      .filter((p) => p.value != null)
      .sort((a, b) => (b.value as number) - (a.value as number))
    return (
      <div className="rounded-lg border border-line-strong bg-surface/98 px-3.5 py-2.5 shadow-lg backdrop-blur-sm">
        <p className="mb-1.5 font-600 text-ink">{label}</p>
        <dl className="space-y-1">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-4 text-[0.86rem]">
              <dt className="flex items-center gap-2 text-ink-soft">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                {r.name}
              </dt>
              <dd className="font-mono font-600 text-ink">{fmtVal(r.value as number)}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 24, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f5fa6" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#1f5fa6" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Typical peak season band */}
            <ReferenceArea x1="Sep" x2="Nov" fill="#c77d12" fillOpacity={0.07} stroke="none">
              <Label value="Typical peak" position="insideTop" fontSize={11} fill="#9a6a10" />
            </ReferenceArea>

            <CartesianGrid stroke="#e6ecf3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12.5, fill: '#4b5d70' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              tick={{ fontSize: 12.5, fill: '#4b5d70' }}
              tickLine={false}
              axisLine={false}
              width={62}
              tickFormatter={axisFmt}
            >
              <Label
                value={Y_LABEL[metric]}
                angle={-90}
                position="insideLeft"
                style={{ fontSize: 12, fill: '#7488a0', textAnchor: 'middle' }}
              />
            </YAxis>
            <Tooltip content={Tip as never} cursor={{ stroke: '#b7c4d6', strokeWidth: 1 }} />

            {/* Soft fill under the latest full year for emphasis */}
            <Area type="monotone" dataKey="2025" stroke="none" fill="url(#curveFill)" isAnimationActive={false} />

            {SERIES.map((s) => (
              <Line
                key={s.year}
                type="monotone"
                dataKey={String(s.year)}
                name={String(s.year)}
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}

            {peak && (
              <ReferenceDot x={peak.month} y={peak.value} r={5} fill="#1f5fa6" stroke="#fff" strokeWidth={1.5}>
                <Label value={`Peak · ${peak.month}`} position="top" fontSize={11} fill="#16487f" fontWeight={600} />
              </ReferenceDot>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend + footnote */}
      <div className="mt-1 flex items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <span key={s.year} className="flex items-center gap-1.5 text-[0.85rem] text-ink-soft">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: s.color }} />
              {s.year}
              {s.year === 2026 && <span className="text-ink-faint">(Jan–Jun)</span>}
            </span>
          ))}
        </div>
        <span className="text-[0.76rem] text-ink-faint">Shaded band = typical Sep–Nov peak season</span>
      </div>
    </div>
  )
}
