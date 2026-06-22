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

interface Hover { x: number; y: number; district: string }

export function GisDashboard() {
  const [boundaries, setBoundaries] = useState<FeatureCollection | null>(null)
  const [links, setLinks] = useState<FeatureCollection | null>(null)
  const [year, setYear] = useState<Year>(2024)
  const [monthIdx, setMonthIdx] = useState(10)
  const [varKey, setVarKey] = useState<Key>('cases')
  const [showLinks, setShowLinks] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    fetch('/tamilnadu_districts.geojson').then((r) => r.json()).then(setBoundaries).catch(() => {})
    fetch('/district_links.geojson').then((r) => r.json()).then(setLinks).catch(() => {})
  }, [])

  const month = Math.min(monthIdx, lastMonthIdx(year))
  const vdef = FIELD[varKey]

  const valAt = useCallback((key: Key, district: string, y: Year, m: number): number | null => {
    if (key === 'rain') return getMonthlyWeather(y, district).rain[m] ?? null
    if (key === 'hum') return (getMonthlyWeather(y, district).hum ?? [])[m] ?? null
    const cm = getMonthlyCases(y, district)
    if (key === 'cases') return cm[m]
    const pop = getRecord(district, y)?.population
    return pop ? (cm[m] / pop) * 1e5 : null
  }, [])

  const breaks = useMemo(() => {
    const vals = listDistricts().map((d) => valAt(varKey, d, year, month)).filter((v): v is number => v != null)
    return classify(vals, 'quantile')
  }, [varKey, year, month, valAt])

  const fc = useMemo<FeatureCollection | null>(() => {
    if (!boundaries) return null
    return {
      ...boundaries,
      features: boundaries.features.map((f) => ({
        ...f,
        properties: { ...f.properties, value: valAt(varKey, (f.properties as { district: string }).district, year, month) },
      })),
    }
  }, [boundaries, varKey, year, month, valAt])

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0]
    setHover(feat ? { x: e.point.x, y: e.point.y, district: (feat.properties as { district: string }).district } : null)
  }, [])

  const legend = useMemo(() => {
    const colors = sampleColors(breaks.length + 1)
    if (breaks.length === 0) return [{ color: colors[0], label: 'all' }]
    const rows = [{ color: colors[0], label: `< ${vdef.fmt(breaks[0])}` }]
    for (let i = 1; i < breaks.length; i++) rows.push({ color: colors[i], label: `${vdef.fmt(breaks[i - 1])} – ${vdef.fmt(breaks[i])}` })
    rows.push({ color: colors[breaks.length], label: `≥ ${vdef.fmt(breaks[breaks.length - 1])}` })
    return rows
  }, [breaks, vdef])

  const hoverVal = hover ? valAt(varKey, hover.district, year, month) : null

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
            <Layer id="district-fill" type="fill" paint={{ 'fill-color': colorExpression(breaks) as never, 'fill-opacity': 0.82 }} />
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
      <div className="absolute left-3 top-3 z-10 w-60 rounded-lg border border-line bg-surface/95 p-3 shadow-md backdrop-blur-sm">
        <p className="mb-1.5 font-serif text-[1rem] font-600 text-ink">Map layer</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(FIELD) as Key[]).map((k) => (
            <button key={k} onClick={() => setVarKey(k)} className={`rounded-md px-2.5 py-1 text-[0.82rem] font-600 transition-colors ${k === varKey ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'}`}>{FIELD[k].label}</button>
          ))}
        </div>

        <div className="mt-3 border-t border-line pt-2.5">
          <p className="mb-1 text-[0.68rem] font-600 uppercase tracking-wide text-ink-faint">Time</p>
          <div className="flex gap-1">
            {YEARS.map((y) => (
              <button key={y} onClick={() => { setYear(y); setMonthIdx((m) => Math.min(m, lastMonthIdx(y))) }} className={`flex-1 rounded-md py-1 text-[0.82rem] font-600 ${y === year ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'}`}>{y}</button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <input type="range" min={0} max={lastMonthIdx(year)} value={month} onChange={(e) => setMonthIdx(Number(e.target.value))} className="flex-1 accent-[var(--color-brand)]" />
            <span className="w-9 text-right font-mono text-[0.82rem] font-600 text-ink">{MONTHS[month]}</span>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={showLinks} onChange={() => setShowLinks((s) => !s)} className="h-4 w-4 accent-[var(--color-brand)]" />
            <span className="text-[0.84rem] text-ink">Neighbour links</span>
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-line bg-surface/92 px-3 py-2.5 shadow-md backdrop-blur-sm">
        <p className="mb-1.5 text-[0.72rem] font-600 uppercase tracking-[0.05em] text-ink-soft">
          {vdef.label} <span className="font-400 text-ink-faint">· {vdef.unit} · {MONTHS[month]} {year}</span>
        </p>
        <ul className="space-y-1">
          {legend.map((row) => (
            <li key={row.color + row.label} className="flex items-center gap-2">
              <span className="h-3 w-5 rounded-sm border border-black/10" style={{ background: row.color }} />
              <span className="text-[0.76rem] tabular-nums text-ink-soft">{row.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {hover && (
        <div className="pointer-events-none absolute z-10 w-52 rounded-lg border border-line-strong bg-surface/97 p-3 shadow-lg" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
          <p className="mb-1.5 font-serif text-[1rem] font-600 text-ink">{hover.district}</p>
          <dl className="space-y-1 text-[0.84rem]">
            <Row label={`${vdef.label} (${MONTHS[month]})`} value={hoverVal == null ? '—' : `${vdef.fmt(hoverVal)} ${vdef.unit}`} />
          </dl>
        </div>
      )}
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-mono font-600 text-ink">{value}</dd>
    </div>
  )
}
