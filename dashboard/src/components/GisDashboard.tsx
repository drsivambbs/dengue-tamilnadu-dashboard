import { useEffect, useMemo, useState, useCallback } from 'react'
import { Map as MapGL, Source, Layer, NavigationControl } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, StyleSpecification } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMonthlyCases, getMonthlyWeather, getRecord, listDistricts } from '../dataService'
import { colorExpression, sampleColors } from '../metrics'
import { classify } from '../classify'
import { YEARS, type Year } from '../types'

const BASEMAP: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const int = (v: number) => Math.round(v).toLocaleString('en-IN')
const one = (v: number) => v.toFixed(1)
const lastMonthIdx = (y: Year) => (y === 2026 ? 5 : 11)

type Key = 'cases' | 'attackRate' | 'rain' | 'hum'
const FIELD: Record<Key, { label: string; unit: string; fmt: (v: number) => string }> = {
  cases: { label: 'Cases', unit: 'cases', fmt: int },
  attackRate: { label: 'Attack rate', unit: '/100k', fmt: one },
  rain: { label: 'Rainfall', unit: 'mm', fmt: int },
  hum: { label: 'Humidity', unit: '%', fmt: one },
}

// Stevens 3x3 bivariate palette — BIV[yClass][xClass]; x→ low..high, y↑ low..high
const BIV = [
  ['#e8e8e8', '#ace4e4', '#5ac8c8'],
  ['#dfb0d6', '#a5add3', '#5698b9'],
  ['#be64ac', '#8c62aa', '#3b4994'],
]
const NODATA = '#e0e0e0'
const tercile = (v: number, br: number[]) =>
  br.length === 0 ? 1 : br.length === 1 ? (v < br[0] ? 0 : 2) : v < br[0] ? 0 : v < br[1] ? 1 : 2

type Mode = 'single' | 'biv'
interface Hover { x: number; y: number; district: string }

export function GisDashboard() {
  const [boundaries, setBoundaries] = useState<FeatureCollection | null>(null)
  const [links, setLinks] = useState<FeatureCollection | null>(null)
  const [mode, setMode] = useState<Mode>('biv')
  const [year, setYear] = useState<Year>(2024)
  const [monthIdx, setMonthIdx] = useState(10)
  const [single, setSingle] = useState<Key>('cases')
  const [varX, setVarX] = useState<Key>('rain') // leading driver (lagged)
  const [varY, setVarY] = useState<Key>('cases') // outcome
  const [lag, setLag] = useState(1)
  const [showLinks, setShowLinks] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    fetch('/tamilnadu_districts.geojson').then((r) => r.json()).then(setBoundaries).catch(() => {})
    fetch('/district_links.geojson').then((r) => r.json()).then(setLinks).catch(() => {})
  }, [])

  const month = Math.min(monthIdx, lastMonthIdx(year))

  const valAt = useCallback((key: Key, district: string, y: Year, m: number): number | null => {
    if (m < 0 || m > 11) return null
    if (key === 'rain') return getMonthlyWeather(y, district).rain[m] ?? null
    if (key === 'hum') return (getMonthlyWeather(y, district).hum ?? [])[m] ?? null
    const cm = getMonthlyCases(y, district)
    if (key === 'cases') return cm[m]
    const pop = getRecord(district, y)?.population
    return pop ? (cm[m] / pop) * 1e5 : null
  }, [])

  const lagYM = useMemo(() => {
    const t = (year - 2024) * 12 + month - lag
    return t < 0 ? null : { y: (2024 + Math.floor(t / 12)) as Year, m: ((t % 12) + 12) % 12 }
  }, [year, month, lag])

  // ---- single-layer choropleth ----
  const singleBreaks = useMemo(() => {
    const vals = listDistricts().map((d) => valAt(single, d, year, month)).filter((v): v is number => v != null)
    return classify(vals, 'quantile')
  }, [single, year, month, valAt])

  // ---- bivariate colours per district ----
  const bivColor = useMemo(() => {
    const ds = listDistricts()
    const xy = lagYM ?? { y: year, m: month }
    const xVals: Record<string, number | null> = {}, yVals: Record<string, number | null> = {}
    ds.forEach((d) => { xVals[d] = valAt(varX, d, xy.y, xy.m); yVals[d] = valAt(varY, d, year, month) })
    const xBr = classify(Object.values(xVals).filter((v): v is number => v != null), 'quantile', 2)
    const yBr = classify(Object.values(yVals).filter((v): v is number => v != null), 'quantile', 2)
    const col: Record<string, string> = {}
    ds.forEach((d) => {
      const xv = xVals[d], yv = yVals[d]
      col[d] = xv == null || yv == null ? NODATA : BIV[tercile(yv, yBr)][tercile(xv, xBr)]
    })
    return col
  }, [varX, varY, lagYM, year, month, valAt])

  const fc = useMemo<FeatureCollection | null>(() => {
    if (!boundaries) return null
    return {
      ...boundaries,
      features: boundaries.features.map((f) => {
        const d = (f.properties as { district: string }).district
        return { ...f, properties: { ...f.properties, value: valAt(single, d, year, month), biv: bivColor[d] ?? NODATA } }
      }),
    }
  }, [boundaries, single, year, month, bivColor, valAt])

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0]
    setHover(feat ? { x: e.point.x, y: e.point.y, district: (feat.properties as { district: string }).district } : null)
  }, [])

  const singleLegend = useMemo(() => {
    const colors = sampleColors(singleBreaks.length + 1)
    const f = FIELD[single].fmt
    if (singleBreaks.length === 0) return [{ color: colors[0], label: 'all' }]
    const rows = [{ color: colors[0], label: `< ${f(singleBreaks[0])}` }]
    for (let i = 1; i < singleBreaks.length; i++) rows.push({ color: colors[i], label: `${f(singleBreaks[i - 1])} – ${f(singleBreaks[i])}` })
    rows.push({ color: colors[singleBreaks.length], label: `≥ ${f(singleBreaks[singleBreaks.length - 1])}` })
    return rows
  }, [singleBreaks, single])

  const fillPaint = mode === 'biv'
    ? { 'fill-color': ['coalesce', ['get', 'biv'], NODATA] as never, 'fill-opacity': 0.82 }
    : { 'fill-color': colorExpression(singleBreaks) as never, 'fill-opacity': 0.82 }

  const hoverX = hover && lagYM ? valAt(varX, hover.district, lagYM.y, lagYM.m) : null
  const hoverY = hover ? valAt(varY, hover.district, year, month) : null
  const hoverSingle = hover ? valAt(single, hover.district, year, month) : null

  return (
    <main className="relative min-h-0 flex-1">
      <MapGL
        initialViewState={{ longitude: 78.4, latitude: 10.85, zoom: 5.9 }}
        mapStyle={BASEMAP}
        interactiveLayerIds={['district-fill']}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        attributionControl={{ compact: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {fc && (
          <Source id="districts" type="geojson" data={fc}>
            <Layer id="district-fill" type="fill" paint={fillPaint} />
            <Layer id="district-line" type="line" paint={{ 'line-color': '#000000', 'line-width': 0.5 }} />
            <Layer id="district-hover" type="line" filter={['==', ['get', 'district'], hover?.district ?? '']} paint={{ 'line-color': '#0e3460', 'line-width': 2 }} />
          </Source>
        )}
        {links && showLinks && (
          <Source id="links" type="geojson" data={links}>
            <Layer id="links-line" type="line" paint={{ 'line-color': '#0e3460', 'line-opacity': 0.4, 'line-width': 1 }} />
          </Source>
        )}
      </MapGL>

      {/* Controls */}
      <div className="absolute left-3 top-3 z-10 w-64 rounded-lg border border-line bg-surface/95 p-3 shadow-md backdrop-blur-sm">
        <div className="mb-2.5 flex gap-1 rounded-lg bg-panel p-1">
          {([['biv', 'Relationship'], ['single', 'Single layer']] as const).map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-md py-1.5 text-[0.82rem] font-600 ${mode === m ? 'bg-brand text-surface shadow-sm' : 'text-ink-soft hover:bg-brand-soft'}`}>{l}</button>
          ))}
        </div>

        {mode === 'biv' ? (
          <>
            <Group title="X — driver (lagged)"><Pills options={[['rain', 'Rainfall'], ['hum', 'Humidity'], ['cases', 'Cases']]} value={varX} onChange={(v) => setVarX(v as Key)} /></Group>
            <Group title="Y — outcome"><Pills options={[['cases', 'Cases'], ['attackRate', 'Attack rate'], ['hum', 'Humidity']]} value={varY} onChange={(v) => setVarY(v as Key)} /></Group>
            <Group title="X lag (months earlier)">
              <div className="flex gap-1">{[0, 1, 2].map((l) => (<button key={l} onClick={() => setLag(l)} className={`flex-1 rounded-md py-1 text-[0.82rem] font-600 ${l === lag ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'}`}>{l}</button>))}</div>
            </Group>
          </>
        ) : (
          <Group title="Variable"><Pills options={[['cases', 'Cases'], ['attackRate', 'Attack rate'], ['rain', 'Rainfall'], ['hum', 'Humidity']]} value={single} onChange={(v) => setSingle(v as Key)} /></Group>
        )}

        <Group title="Time">
          <div className="flex gap-1">{YEARS.map((y) => (<button key={y} onClick={() => { setYear(y); setMonthIdx((m) => Math.min(m, lastMonthIdx(y))) }} className={`flex-1 rounded-md py-1 text-[0.82rem] font-600 ${y === year ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'}`}>{y}</button>))}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="range" min={0} max={lastMonthIdx(year)} value={month} onChange={(e) => setMonthIdx(Number(e.target.value))} className="flex-1 accent-[var(--color-brand)]" />
            <span className="w-9 text-right font-mono text-[0.82rem] font-600 text-ink">{MONTHS[month]}</span>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showLinks} onChange={() => setShowLinks((s) => !s)} className="h-4 w-4 accent-[var(--color-brand)]" /><span className="text-[0.84rem] text-ink">Neighbour links</span></label>
        </Group>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-line bg-surface/95 px-3 py-2.5 shadow-md backdrop-blur-sm">
        {mode === 'biv' ? (
          <BivKey xLabel={FIELD[varX].label} yLabel={FIELD[varY].label} lag={lag} />
        ) : (
          <>
            <p className="mb-1.5 text-[0.72rem] font-600 uppercase tracking-[0.05em] text-ink-soft">{FIELD[single].label} <span className="font-400 text-ink-faint">· {FIELD[single].unit} · {MONTHS[month]} {year}</span></p>
            <ul className="space-y-1">{singleLegend.map((row) => (<li key={row.color + row.label} className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm border border-black/10" style={{ background: row.color }} /><span className="text-[0.76rem] tabular-nums text-ink-soft">{row.label}</span></li>))}</ul>
          </>
        )}
      </div>

      {hover && (
        <div className="pointer-events-none absolute z-10 w-60 rounded-lg border border-line-strong bg-surface/97 p-3 shadow-lg" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
          <p className="mb-1.5 font-serif text-[1rem] font-600 text-ink">{hover.district}</p>
          <dl className="space-y-1 text-[0.84rem]">
            {mode === 'biv' ? (
              <>
                <Row label={`${FIELD[varX].label}${lag ? ` (−${lag}mo)` : ''}`} value={hoverX == null ? '—' : `${FIELD[varX].fmt(hoverX)} ${FIELD[varX].unit}`} />
                <Row label={FIELD[varY].label} value={hoverY == null ? '—' : `${FIELD[varY].fmt(hoverY)} ${FIELD[varY].unit}`} highlight />
              </>
            ) : (
              <Row label={`${FIELD[single].label} (${MONTHS[month]})`} value={hoverSingle == null ? '—' : `${FIELD[single].fmt(hoverSingle)} ${FIELD[single].unit}`} highlight />
            )}
          </dl>
        </div>
      )}
    </main>
  )
}

/** QGIS-style 3x3 bivariate colour key. */
function BivKey({ xLabel, yLabel, lag }: { xLabel: string; yLabel: string; lag: number }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.72rem] font-600 uppercase tracking-[0.05em] text-ink-soft">Relationship</p>
      <div className="flex items-end gap-1.5">
        {/* Y axis label */}
        <div className="flex h-[54px] items-center">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[0.66rem] font-600 text-ink-soft">{yLabel} →</span>
        </div>
        <div>
          <div className="grid grid-cols-3 grid-rows-3" style={{ width: 54, height: 54 }}>
            {[2, 1, 0].map((y) => BIV[y].map((_, x) => (
              <span key={`${y}-${x}`} style={{ background: BIV[y][x] }} />
            )))}
          </div>
          <span className="mt-0.5 block text-[0.66rem] font-600 text-ink-soft">{xLabel}{lag ? ` (−${lag}mo)` : ''} →</span>
        </div>
      </div>
      <p className="mt-1 text-[0.66rem] text-ink-faint">dark = both high</p>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 border-t border-line pt-2 first:border-t-0 first:pt-0">
      <p className="mb-1 text-[0.68rem] font-600 uppercase tracking-wide text-ink-faint">{title}</p>
      {children}
    </div>
  )
}

function Pills({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-md px-2.5 py-1 text-[0.82rem] font-600 transition-colors ${k === value ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'}`}>{label}</button>
      ))}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`font-mono font-600 ${highlight ? 'text-brand-strong' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}
