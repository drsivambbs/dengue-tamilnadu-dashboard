import type { Metric } from './types'

/** Sequential 5-class palette (colour-blind safe, WHO-style). */
export const PALETTE = ['#ffffcc', '#fed976', '#fd8d3c', '#e31a1c', '#800026']
export const NO_DATA = '#d9d9d9'

interface MetricConfig {
  /** 4 thresholds → 5 classes */
  breaks: number[]
  unit: string
  format: (v: number) => string
}

const int = (v: number) => Math.round(v).toLocaleString('en-IN')

export const METRIC_CONFIG: Record<Metric, MetricConfig> = {
  cases: { breaks: [250, 500, 1000, 2500], unit: 'cases', format: int },
  attackRate: { breaks: [20, 40, 60, 100], unit: 'per 100k', format: (v) => v.toFixed(1) },
  deaths: { breaks: [1, 2, 4, 8], unit: 'deaths', format: int },
  cfr: { breaks: [0.05, 0.1, 0.25, 0.5], unit: '%', format: (v) => `${v.toFixed(2)}%` },
}

/** Legend rows: [colour, label] for the given metric. */
export function legendRows(metric: Metric): { color: string; label: string }[] {
  const { breaks, format } = METRIC_CONFIG[metric]
  return [
    { color: PALETTE[0], label: `< ${format(breaks[0])}` },
    { color: PALETTE[1], label: `${format(breaks[0])} – ${format(breaks[1])}` },
    { color: PALETTE[2], label: `${format(breaks[1])} – ${format(breaks[2])}` },
    { color: PALETTE[3], label: `${format(breaks[2])} – ${format(breaks[3])}` },
    { color: PALETTE[4], label: `≥ ${format(breaks[3])}` },
  ]
}

/** MapLibre step expression that colours a feature by its `value` property. */
export function colorExpression(metric: Metric): unknown[] {
  const { breaks } = METRIC_CONFIG[metric]
  return [
    'case',
    ['==', ['get', 'value'], null],
    NO_DATA,
    [
      'step',
      ['get', 'value'],
      PALETTE[0],
      breaks[0], PALETTE[1],
      breaks[1], PALETTE[2],
      breaks[2], PALETTE[3],
      breaks[3], PALETTE[4],
    ],
  ]
}
