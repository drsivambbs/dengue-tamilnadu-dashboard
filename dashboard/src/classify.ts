import type { ClassMethod } from './types'

/**
 * Compute up to `count` class breaks (thresholds) from the data, producing
 * count+1 classes. Returns strictly-increasing interior thresholds; fewer are
 * returned when the data has little spread (e.g. mostly-zero death counts).
 */
export function classify(values: number[], method: ClassMethod, count = 4): number[] {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return []
  const min = v[0]
  const max = v[v.length - 1]
  if (min === max) return []

  let raw: number[] = []
  if (method === 'quantile') {
    for (let i = 1; i <= count; i++) raw.push(quantileSorted(v, i / (count + 1)))
  } else if (method === 'equal') {
    for (let i = 1; i <= count; i++) raw.push(min + ((max - min) * i) / (count + 1))
  } else if (method === 'stddev') {
    const mean = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
    raw = [mean - sd, mean, mean + sd, mean + 2 * sd].slice(0, count)
  } else {
    raw = jenksInterior(v, count + 1)
  }

  // Keep only strictly-increasing thresholds inside (min, max).
  const out: number[] = []
  for (const b of raw) {
    if (b > min && b < max && (out.length === 0 || b > out[out.length - 1] + 1e-9)) out.push(b)
  }
  return out
}

function quantileSorted(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo])
}

/** Jenks natural breaks — returns the interior boundaries (nClasses-1 values). */
function jenksInterior(data: number[], nClasses: number): number[] {
  if (data.length <= nClasses) return data.slice(1, -1)
  const lower = jenksLowerClassLimits(data, nClasses)
  const kclass = new Array<number>(nClasses + 1)
  kclass[nClasses] = data[data.length - 1]
  kclass[0] = data[0]
  let k = data.length
  for (let c = nClasses; c >= 2; c--) {
    kclass[c - 1] = data[lower[k][c] - 2]
    k = lower[k][c] - 1
  }
  return kclass.slice(1, -1)
}

function jenksLowerClassLimits(data: number[], nClasses: number): number[][] {
  const n = data.length
  const lower: number[][] = []
  const variance: number[][] = []
  for (let i = 0; i <= n; i++) {
    lower.push(new Array<number>(nClasses + 1).fill(0))
    variance.push(new Array<number>(nClasses + 1).fill(0))
  }
  for (let i = 1; i <= nClasses; i++) {
    lower[1][i] = 1
    variance[1][i] = 0
    for (let j = 2; j <= n; j++) variance[j][i] = Infinity
  }
  for (let l = 2; l <= n; l++) {
    let sum = 0
    let sumSq = 0
    let w = 0
    let varc = 0
    for (let m = 1; m <= l; m++) {
      const low = l - m + 1
      const val = data[low - 1]
      w++
      sum += val
      sumSq += val * val
      varc = sumSq - (sum * sum) / w
      const i4 = low - 1
      if (i4 !== 0) {
        for (let j = 2; j <= nClasses; j++) {
          if (variance[l][j] >= varc + variance[i4][j - 1]) {
            lower[l][j] = low
            variance[l][j] = varc + variance[i4][j - 1]
          }
        }
      }
    }
    lower[l][1] = 1
    variance[l][1] = varc
  }
  return lower
}
