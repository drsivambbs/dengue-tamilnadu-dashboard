import { useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceDot, Label,
} from 'recharts'
import { getMonthlyCases, getMonthlyMetric, isPartial, YEARS } from '../dataService'
import { METRIC_CONFIG } from '../metrics'
import { MONTHS, type Metric } from '../types'

// Year series colours: latest = red, second-latest = blue, older = grey.
function buildSeries() {
  return YEARS.map((year, i) => {
    const fromEnd = YEARS.length - 1 - i
    if (fromEnd === 0) return { year, color: '#c0392b', width: 3, dash: undefined as string | undefined }
    if (fromEnd === 1) return { year, color: '#1f5fa6', width: 3, dash: undefined as string | undefined }
    return { year, color: '#9aa7b5', width: 2, dash: '5 4' as string | undefined }
  })
}

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
  const SERIES = useMemo(buildSeries, [])
  // Latest non-partial year — basis for the peak marker and high-season band.
  const LATEST_FULL_YEAR = useMemo(() => [...YEARS].reverse().find((y) => !isPartial(y)) ?? YEARS[YEARS.length - 1], [])

  const { data, peak, season } = useMemo(() => {
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

    // Monthly profile of the latest full year (2025) drives both the peak
    // marker and the dynamic high-season band — so the marker sits on a real
    // point and the band reflects the metric actually shown.
    const ref = byYear.find((b) => b.y === LATEST_FULL_YEAR)?.series ?? []
    const prof = MONTHS.map((_, i) => ref[i] ?? 0)
    let pIdx = 0
    prof.forEach((v, i) => { if (v > prof[pIdx]) pIdx = i })
    const peakVal = prof[pIdx]

    // High-season band: contiguous months around the peak at or above half-peak.
    let s = pIdx
    let e = pIdx
    if (peakVal > 0) {
      const thr = peakVal * 0.5
      while (s > 0 && prof[s - 1] >= thr) s--
      while (e < 11 && prof[e + 1] >= thr) e++
    }

    return {
      data: rows,
      peak: peakVal > 0 ? { month: MONTHS[pIdx], value: peakVal } : null,
      season: peakVal > 0 ? { start: MONTHS[s], end: MONTHS[e] } : null,
    }
  }, [selected, metric])

  const axisFmt = (v: number) => {
    if (metric === 'cases') return v >= 1000 ? `${v / 1000}k` : `${v}`
    if (metric === 'cfr') return `${v}%`
    return `${v}`
  }

  const Tip = ({ active, label, payload }: CurveTooltipProps) => {
    if (!active || !payload?.length) return null
    // Dedupe by series name — the shaded Area shares the latest year's name with
    // its Line, which would otherwise list that year twice.
    const seen = new Set<string>()
    const rows = [...payload]
      .filter((p) => p.value != null && p.name != null && !seen.has(p.name) && seen.add(p.name))
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

            {/* Dynamic high-season band (from full-year averages) */}
            {season && (
              <ReferenceArea x1={season.start} x2={season.end} fill="#c77d12" fillOpacity={0.08} stroke="none">
                <Label value="Peak season" position="insideTop" fontSize={11} fill="#9a6a10" />
              </ReferenceArea>
            )}

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
            <Area type="monotone" dataKey={String(LATEST_FULL_YEAR)} stroke="none" fill="url(#curveFill)" isAnimationActive={false} />

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
              {isPartial(s.year) && <span className="text-ink-faint">({isPartial(s.year)})</span>}
            </span>
          ))}
        </div>
        <span className="text-[0.76rem] text-ink-faint">
          {season ? `Shaded band = peak season (${season.start}–${season.end})` : 'No peak season'}
        </span>
      </div>
    </div>
  )
}
