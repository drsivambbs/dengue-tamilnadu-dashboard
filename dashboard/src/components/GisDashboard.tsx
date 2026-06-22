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
const lastMonthIdx = (y: Year) => (y === 2026 ? 5 : 11) // 2026 reported through Jun

type Key = 'cases' | 'attackRate' | 'rain' | 'hum'
const FIELD: Record<Key, { label: string; unit: string; fmt: (v: number) => string; color: string }> = {
  cases: { label: 'Cases', unit: 'cases', fmt: int, color: '#1f5fa6' },
  attackRate: { label: 'Attack rate', unit: '/100k', fmt: one, color: '#1f5fa6' },
  rain: { label: 'Rainfall', unit: 'mm', fmt: int, color: '#0f8f8f' },
  hum: { label: 'Humidity', unit: '%', fmt: one, color: '#7b5ea7' },
}
type OverlayKey = 'none' | 'rain' | 'hum'

interface Hover { x: number; y: number; district: string }

export function GisDashboard() {
  const [boundaries, setBoundaries] = useState<FeatureCollection | null>(null)
  const [points, setPoints] = useState<FeatureCollection | null>(null)
  const [links, setLinks] = useState<FeatureCollection | null>(null)
  const [year, setYear] = useState<Year>(2024)
  const [monthIdx, setMonthIdx] = useState(10) // Nov
  const [baseKey, setBaseKey] = useState<Key>('cases')
  const [overlayKey, setOverlayKey] = useState<OverlayKey>('rain')
  const [lag, setLag] = useState(1)
  const [showLinks, setShowLinks] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    fetch('/tamilnadu_districts.geojson').then((r) => r.json()).then(setBoundaries).catch(() => {})
    fetch('/district_points.geojson').then((r) => r.json()).then(setPoints).catch(() => {})
    fetch('/district_links.geojson').then((r) => r.json()).then(setLinks).catch(() => {})
  }, [])

  const month = Math.min(monthIdx, lastMonthIdx(year))

  // value of a field for a district at a given year+month
  const valAt = useCallback((key: Key, district: string, y: Year, m: number): number | null => {
    if (m < 0 || m > 11) return null
    if (key === 'rain') return getMonthlyWeather(y, district).rain[m] ?? null
    if (key === 'hum') return (getMonthlyWeather(y, district).hum ?? [])[m] ?? null
    const cm = getMonthlyCases(y, district)
    if (key === 'cases') return cm[m]
    const pop = getRecord(district, y)?.population
    return pop ? (cm[m] / pop) * 1e5 : null
  }, [])

  // overlay month/year shifted back by lag
  const lagYM = useMemo(() => {
    const t = (year - 2024) * 12 + month - lag
    return t < 0 ? null : { y: (2024 + Math.floor(t / 12)) as Year, m: ((t % 12) + 12) % 12 }
  }, [year, month, lag])

  const baseDef = FIELD[baseKey]
  const breaks = useMemo(() => {
    const vals = listDistricts().map((d) => valAt(baseKey, d, year, month)).filter((v): v is number => v != null)
    return classify(vals, 'quantile')
  }, [baseKey, year, month, valAt])

  const fc = useMemo<FeatureCollection | null>(() => {
    if (!boundaries) return null
    return {
      ...boundaries,
      features: boundaries.features.map((f) => ({
        ...f,
        properties: { ...f.properties, value: valAt(baseKey, (f.properties as { district: string }).district, year, month) },
      })),
    }
  }, [boundaries, baseKey, year, month, valAt])

  // overlay circles (centroids sized by the lagged climate value)
  const overlay = useMemo(() => {
    if (!points || overlayKey === 'none' || !lagYM) return { fc: null as FeatureCollection | null, min: 0, max: 1 }
    const feats = []
    let min = Infinity, max = -Infinity
    for (const f of points.features) {
      const dist = (f.properties as { district: string }).district
      const v = valAt(overlayKey, dist, lagYM.y, lagYM.m)
      if (v == null) continue
      min = Math.min(min, v); max = Math.max(max, v)
      feats.push({ ...f, properties: { district: dist, ov: v } })
    }
    return { fc: { type: 'FeatureCollection', features: feats } as FeatureCollection, min, max: max > min ? max : min + 1 }
  }, [points, overlayKey, lagYM, valAt])

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0]
    setHover(feat ? { x: e.point.x, y: e.point.y, district: (feat.properties as { district: string }).district } : null)
  }, [])

  const legend = useMemo(() => {
    const colors = sampleColors(breaks.length + 1)
    if (breaks.length === 0) return [{ color: colors[0], label: 'all' }]
    const rows = [{ color: colors[0], label: `< ${baseDef.fmt(breaks[0])}` }]
    for (let i = 1; i < breaks.length; i++) rows.push({ color: colors[i], label: `${baseDef.fmt(breaks[i - 1])} – ${baseDef.fmt(breaks[i])}` })
    rows.push({ color: colors[breaks.length], label: `≥ ${baseDef.fmt(breaks[breaks.length - 1])}` })
    return rows
  }, [breaks, baseDef])

  const ovDef = overlayKey !== 'none' ? FIELD[overlayKey] : null
  const hoverBase = hover ? valAt(baseKey, hover.district, year, month) : null
  const hoverOv = hover && ovDef && lagYM ? valAt(overlayKey as Key, hover.district, lagYM.y, lagYM.m) : null

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
            <Layer id="district-fill" type="fill" paint={{ 'fill-color': colorExpression(breaks) as never, 'fill-opacity': 0.8 }} />
            <Layer id="district-line" type="line" paint={{ 'line-color': '#000000', 'line-width': 0.5 }} />
            <Layer id="district-hover" type="line" filter={['==', ['get', 'district'], hover?.district ?? '']} paint={{ 'line-color': '#0e3460', 'line-width': 2 }} />
          </Source>
        )}
        {links && showLinks && (
          <Source id="links" type="geojson" data={links}>
            <Layer id="links-line" type="line" paint={{ 'line-color': '#0e3460', 'line-opacity': 0.4, 'line-width': 1 }} />
          </Source>
        )}
        {overlay.fc && ovDef && (
          <Source id="overlay" type="geojson" data={overlay.fc}>
            <Layer id="overlay-circle" type="circle" paint={{
              'circle-color': ovDef.color,
              'circle-opacity': 0.5,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1,
              'circle-radius': ['interpolate', ['linear'], ['get', 'ov'], overlay.min, 4, overlay.max, 22],
            }} />
          </Source>
        )}
      </MapGL>

      {/* Controls */}
      <div className="absolute left-3 top-3 z-10 w-64 rounded-lg border border-line bg-surface/95 p-3 shadow-md backdrop-blur-sm">
        <p className="mb-2 font-serif text-[1rem] font-600 text-ink">Compare layers</p>

        <Group title="Colour (fill)">
          <Pills options={[['cases', 'Cases'], ['attackRate', 'Attack rate'], ['rain', 'Rainfall'], ['hum', 'Humidity']]} value={baseKey} onChange={(v) => setBaseKey(v as Key)} />
        </Group>

        <Group title="Overlay (circles)">
          <Pills options={[['none', 'None'], ['rain', 'Rainfall'], ['hum', 'Humidity']]} value={overlayKey} onChange={(v) => setOverlayKey(v as OverlayKey)} />
          {overlayKey !== 'none' && (
            <div className="mt-1.5">
              <p className="mb-1 text-[0.68rem] font-600 uppercase tracking-wide text-ink-faint">Overlay lag (months earlier)</p>
              <div className="flex gap-1">
                {[0, 1, 2].map((l) => (
                  <button key={l} onClick={() => setLag(l)} className={`flex-1 rounded-md py-1 text-[0.82rem] font-600 ${l === lag ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'}`}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </Group>

        <Group title="Time">
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
        </Group>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-line bg-surface/92 px-3 py-2.5 shadow-md backdrop-blur-sm">
        <p className="mb-1.5 text-[0.72rem] font-600 uppercase tracking-[0.05em] text-ink-soft">
          {baseDef.label} <span className="font-400 text-ink-faint">· {baseDef.unit} · {MONTHS[month]} {year}</span>
        </p>
        <ul className="space-y-1">
          {legend.map((row) => (
            <li key={row.color + row.label} className="flex items-center gap-2">
              <span className="h-3 w-5 rounded-sm border border-black/10" style={{ background: row.color }} />
              <span className="text-[0.76rem] tabular-nums text-ink-soft">{row.label}</span>
            </li>
          ))}
        </ul>
        {ovDef && lagYM && (
          <p className="mt-2 border-t border-line pt-1.5 text-[0.72rem] text-ink-faint">
            ● circles = {ovDef.label} ({MONTHS[lagYM.m]} {lagYM.y}{lag ? `, ${lag} mo earlier` : ''}) — bigger = more
          </p>
        )}
      </div>

      {hover && (
        <div className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line-strong bg-surface/97 p-3 shadow-lg" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
          <p className="mb-1.5 font-serif text-[1rem] font-600 text-ink">{hover.district}</p>
          <dl className="space-y-1 text-[0.84rem]">
            <Row label={`${baseDef.label} (${MONTHS[month]})`} value={hoverBase == null ? '—' : `${baseDef.fmt(hoverBase)} ${baseDef.unit}`} highlight />
            {ovDef && <Row label={`${ovDef.label} (lag ${lag})`} value={hoverOv == null ? '—' : `${ovDef.fmt(hoverOv)} ${ovDef.unit}`} />}
          </dl>
        </div>
      )}
    </main>
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
