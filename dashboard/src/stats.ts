/** Pearson correlation coefficient. Returns NaN if undefined. */
export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return NaN
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  const d = Math.sqrt(sxx * syy)
  return d ? sxy / d : NaN
}

/** Pair cases[t] with rain[t-lag] (rainfall leading by `lag` months). */
export function lagPairs(cases: number[], rain: (number | null)[], lag: number) {
  const xs: number[] = []
  const ys: number[] = []
  for (let t = lag; t < cases.length; t++) {
    const r = rain[t - lag]
    if (r != null && cases[t] != null) {
      xs.push(r)
      ys.push(cases[t])
    }
  }
  return { xs, ys }
}

/** Correlation of cases vs rainfall at each lag 0..maxLag. */
export function lagCorrelations(cases: number[], rain: (number | null)[], maxLag = 3) {
  const out: { lag: number; r: number; n: number }[] = []
  for (let lag = 0; lag <= maxLag; lag++) {
    const { xs, ys } = lagPairs(cases, rain, lag)
    out.push({ lag, r: pearson(xs, ys), n: xs.length })
  }
  return out
}

/** Lag with the strongest positive correlation. */
export function bestLag(corr: { lag: number; r: number }[]) {
  return corr.reduce((best, c) => (Number.isFinite(c.r) && c.r > best.r ? c : best), corr[0])
}
