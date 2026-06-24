import { useMemo } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts'
import { getYearValues, getMonthValues } from '../dataService'
import { classify } from '../classify'
import { colorForValue, METRIC_CONFIG } from '../metrics'
import { METRICS, type ClassMethod, type Metric, type Year } from '../types'

const Y_LABEL: Record<Metric, string> = {
  cases: 'Reported cases',
  attackRate: 'Attack rate (/100k)',
  deaths: 'Deaths',
  cfr: 'Case fatality (%)',
}

interface TipProps {
  active?: boolean
  payload?: { payload: { district: string; value: number; color: string } }[]
}

/** Ranked bar chart — districts on X, the selected metric on Y, each bar coloured
 *  to match the choropleth (same classification breaks + palette as the map). */
export function DistrictBars({
  year,
  month,
  metric,
  classMethod,
  selected,
  onSelect,
}: {
  year: Year
  month: number
  metric: Metric
  classMethod: ClassMethod
  selected: string | null
  onSelect: (d: string | null) => void
}) {
  const fmtVal = METRIC_CONFIG[metric].format
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''

  const { data, median } = useMemo(() => {
    const scope = month < 0 ? getYearValues(year, metric) : getMonthValues(year, month, metric)
    const breaks = classify(scope.map((d) => d.value), classMethod)
    const rows = scope
      .map((d) => ({ district: d.district, value: d.value, color: colorForValue(d.value, breaks) }))
      .sort((a, b) => b.value - a.value)
    const sorted = rows.map((r) => r.value).sort((a, b) => a - b)
    const n = sorted.length
    const med = n === 0 ? 0 : n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    return { data: rows, median: med }
  }, [year, month, metric, classMethod])

  const axisFmt = (v: number) => {
    if (metric === 'cases') return v >= 1000 ? `${v / 1000}k` : `${v}`
    if (metric === 'cfr') return `${v}%`
    return `${v}`
  }

  const Tip = ({ active, payload }: TipProps) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    return (
      <div className="rounded-lg border border-line-strong bg-surface/98 px-3 py-2 shadow-lg backdrop-blur-sm">
        <p className="flex items-center gap-2 font-600 text-ink">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.district}
        </p>
        <p className="mt-0.5 text-[0.85rem] text-ink-soft">{metricLabel}: <span className="font-mono font-600 text-ink">{fmtVal(p.value)}</span></p>
      </div>
    )
  }

  return (
    <div className="h-full w-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 24, bottom: 76, left: 8 }} barCategoryGap="20%">
          <CartesianGrid stroke="#c2cdda" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="district"
            interval={0}
            angle={-55}
            textAnchor="end"
            height={70}
            tick={{ fontSize: 11, fill: '#4b5d70' }}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#4b5d70' }}
            tickLine={false}
            axisLine={false}
            width={62}
            tickFormatter={axisFmt}
          >
            <Label value={Y_LABEL[metric]} angle={-90} position="insideLeft" style={{ fontSize: 12, fill: '#7488a0', textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip content={Tip as never} cursor={{ fill: 'rgba(31,95,166,0.06)' }} />
          {/* Median reference — dotted */}
          <ReferenceLine y={median} stroke="#15212e" strokeDasharray="2 3" strokeWidth={1} ifOverflow="extendDomain">
            <Label
              value={`Median ${fmtVal(median)}`}
              position="right"
              style={{ fontSize: 11, fontWeight: 600, fill: '#15212e' }}
            />
          </ReferenceLine>
          <Bar
            dataKey="value"
            isAnimationActive={false}
            cursor="pointer"
            radius={[2, 2, 0, 0]}
            onClick={(d: unknown) => {
              const district = (d as { payload?: { district?: string } })?.payload?.district
              if (district) onSelect(district === selected ? null : district)
            }}
          >
            {data.map((d) => (
              <Cell
                key={d.district}
                fill={d.color}
                stroke={d.district === selected ? '#15212e' : '#000000'}
                strokeWidth={d.district === selected ? 1.5 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
