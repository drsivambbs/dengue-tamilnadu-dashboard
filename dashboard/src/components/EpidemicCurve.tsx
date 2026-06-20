import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getMonthlyCases } from '../dataService'
import { YEARS } from '../types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEAR_COLORS: Record<number, string> = { 2024: '#94a3b8', 2025: '#1f5fa6', 2026: '#c0392b' }

/** Trim trailing zero months (a partial year) to null so the line stops cleanly. */
function trimPartial(series: number[]): (number | null)[] {
  let last = -1
  series.forEach((v, i) => { if (v > 0) last = i })
  return series.map((v, i) => (i <= last ? v : null))
}

export function EpidemicCurve({ selected }: { selected: string | null }) {
  const data = useMemo(() => {
    const byYear = YEARS.map((y) => ({ y, series: trimPartial(getMonthlyCases(y, selected)) }))
    return MONTHS.map((m, i) => {
      const row: Record<string, number | string | null> = { month: m }
      byYear.forEach(({ y, series }) => (row[y] = series[i]))
      return row
    })
  }, [selected])

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-serif text-[1.05rem] font-600 text-ink">Monthly cases</h3>
        <span className="text-[0.8rem] text-ink-soft">{selected ?? 'Tamil Nadu'}</span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#e6ecf3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#4b5d70' }} tickLine={false} axisLine={{ stroke: '#d3dcea' }} />
            <YAxis tick={{ fontSize: 12, fill: '#4b5d70' }} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #b7c4d6', fontSize: 13 }}
              labelStyle={{ fontWeight: 600, color: '#15212e' }}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            {YEARS.map((y) => (
              <Line
                key={y}
                type="monotone"
                dataKey={String(y)}
                name={String(y)}
                stroke={YEAR_COLORS[y]}
                strokeWidth={y === 2026 ? 2.6 : 2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
