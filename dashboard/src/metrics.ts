import type { Metric } from './types'

/** Sequential 5-class palette (colour-blind safe, WHO-style). */
export const PALETTE = ['#ffffcc', '#fed976', '#fd8d3c', '#e31a1c', '#800026']
export const NO_DATA = '#d9d9d9'

interface MetricConfig {
  unit: string
  format: (v: number) => string
}

const int = (v: number) => Math.round(v).toLocaleString('en-IN')

export const METRIC_CONFIG: Record<Metric, MetricConfig> = {
  cases: { unit: 'cases', format: int },
  attackRate: { unit: 'per 100k', format: (v) => v.toFixed(1) },
  deaths: { unit: 'deaths', format: int },
  cfr: { unit: '%', format: (v) => `${v.toFixed(2)}%` },
}

/** Evenly sample `n` colours from the 5-class palette (keeps contrast when
 *  fewer than 5 classes are produced). */
export function sampleColors(n: number): string[] {
  if (n <= 1) return [PALETTE[PALETTE.length - 1]]
  return Array.from({ length: n }, (_, i) =>
    PALETTE[Math.round((i * (PALETTE.length - 1)) / (n - 1))],
  )
}

/** Legend rows from dynamic breaks (length 0..4 → 1..5 classes). */
export function legendRows(breaks: number[], metric: Metric): { color: string; label: string }[] {
  const fmt = METRIC_CONFIG[metric].format
  const colors = sampleColors(breaks.length + 1)
  if (breaks.length === 0) return [{ color: colors[0], label: 'all districts' }]
  const rows = [{ color: colors[0], label: `< ${fmt(breaks[0])}` }]
  for (let i = 1; i < breaks.length; i++) {
    rows.push({ color: colors[i], label: `${fmt(breaks[i - 1])} – ${fmt(breaks[i])}` })
  }
  rows.push({ color: colors[breaks.length], label: `≥ ${fmt(breaks[breaks.length - 1])}` })
  return rows
}

/** MapLibre step expression colouring a feature by its `value` property,
 *  using the supplied (already strictly-increasing) breaks. */
export function colorExpression(breaks: number[]): unknown[] {
  const colors = sampleColors(breaks.length + 1)
  const step: unknown[] = ['step', ['get', 'value'], colors[0]]
  breaks.forEach((b, i) => step.push(b, colors[i + 1]))
  return ['case', ['==', ['get', 'value'], null], NO_DATA, step]
}
