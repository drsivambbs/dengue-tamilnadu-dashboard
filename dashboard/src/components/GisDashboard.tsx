import { useEffect, useMemo, useState, useCallback } from 'react'
import { Map as MapGL, Source, Layer, NavigationControl } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, StyleSpecification } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getRecord, getAnnualRain, getAnnualHumidity, listDistricts } from '../dataService'
import { colorExpression, sampleColors, NO_DATA } from '../metrics'
import { classify } from '../classify'
import { YEARS, type Year } from '../types'

const BASEMAP: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}

const int = (v: number) => Math.round(v).toLocaleString('en-IN')
const one = (v: number) => v.toFixed(1)

type VarKey = 'cases' | 'attackRate' | 'rain' | 'hum' | 'lights'
interface VarDef {
  key: VarKey
  label: string
  unit: string
  fmt: (v: number) => string
  group: 'Dengue' | 'Climate' | 'Urban'
}
const VARS: VarDef[] = [
  { key: 'cases', label: 'Dengue cases', unit: 'cases', fmt: int, group: 'Dengue' },
  { key: 'attackRate', label: 'Attack rate', unit: '/100k', fmt: one, group: 'Dengue' },
  { key: 'rain', label: 'Rainfall (annual)', unit: 'mm', fmt: int, group: 'Climate' },
  { key: 'hum', label: 'Humidity (avg)', unit: '%', fmt: one, group: 'Climate' },
  { key: 'lights', label: 'Night-lights', unit: 'radiance', fmt: one, group: 'Urban' },
]

interface Hover { x: number; y: number; district: string }

export function GisDashboard() {
  const [boundaries, setBoundaries] = useState<FeatureCollection | null>(null)
  const [links, setLinks] = useState<FeatureCollection | null>(null)
  const [lightsBy, setLightsBy] = useState<Record<string, number>>({})
  const [year, setYear] = useState<Year>(2024)
  const [varKey, setVarKey] = useState<VarKey>('cases')
  const [showLinks, setShowLinks] = useState(false)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    fetch('/tamilnadu_districts.geojson').then((r) => r.json()).then(setBoundaries).catch(() => {})
    fetch('/district_links.geojson').then((r) => r.json()).then(setLinks).catch(() => {})
    fetch('/district_points.geojson').then((r) => r.json()).then((g: FeatureCollection) => {
      const m: Record<string, number> = {}
      for (const f of g.features) {
        const p = f.properties as { district: string; nightlights: number }
        m[p.district] = p.nightlights
      }
      setLightsBy(m)
    }).catch(() => {})
  }, [])

  const vdef = VARS.find((v) => v.key === varKey)!

  const valueOf = useCallback((district: string): number | null => {
    if (varKey === 'lights') return lightsBy[district] ?? null
    if (varKey === 'rain') return getAnnualRain(year, district)
    if (varKey === 'hum') return getAnnualHumidity(year, district)
    const rec = getRecord(district, year)
    return rec ? rec[varKey] : null
  }, [varKey, year, lightsBy])

  const breaks = useMemo(() => {
    const vals = listDistricts().map(valueOf).filter((v): v is number => v != null)
    return classify(vals, 'quantile')
  }, [valueOf])

  const fc = useMemo<FeatureCollection | null>(() => {
    if (!boundaries) return null
    return {
      ...boundaries,
      features: boundaries.features.map((f) => ({
        ...f,
        properties: { ...f.properties, value: valueOf((f.properties as { district: string }).district) },
      })),
    }
  }, [boundaries, valueOf])

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

  const hoverRec = hover ? getRecord(hover.district, year) : undefined
  const hoverVal = hover ? valueOf(hover.district) : null

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

      {/* Layer / variable panel */}
      <div className="absolute left-3 top-3 z-10 w-64 rounded-lg border border-line bg-surface/95 p-3 shadow-md backdrop-blur-sm">
        <p className="mb-1.5 font-serif text-[1rem] font-600 text-ink">Map layer</p>
        <p className="mb-2 text-[0.76rem] text-ink-soft">Pick a variable to colour the districts. Switch to compare.</p>
        <div className="space-y-2">
          {(['Dengue', 'Climate', 'Urban'] as const).map((grp) => (
            <div key={grp}>
              <p className="text-[0.68rem] font-600 uppercase tracking-wide text-ink-faint">{grp}</p>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {VARS.filter((v) => v.group === grp).map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setVarKey(v.key)}
                    className={`rounded-md px-2.5 py-1.5 text-left text-[0.85rem] font-600 transition-colors ${
                      v.key === varKey ? 'bg-brand text-surface' : 'text-ink-soft hover:bg-brand-soft'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-line pt-2.5">
          <p className="mb-1 text-[0.68rem] font-600 uppercase tracking-wide text-ink-faint">Year</p>
          <div className="flex gap-1">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`flex-1 rounded-md py-1.5 text-[0.82rem] font-600 transition-colors ${
                  y === year ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={showLinks} onChange={() => setShowLinks((s) => !s)} className="h-4 w-4 accent-[var(--color-brand)]" />
            <span className="text-[0.85rem] text-ink">Neighbour-spread links</span>
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-line bg-surface/92 px-3 py-2.5 shadow-md backdrop-blur-sm">
        <p className="mb-1.5 text-[0.72rem] font-600 uppercase tracking-[0.05em] text-ink-soft">
          {vdef.label} <span className="font-400 text-ink-faint">· {vdef.unit}</span>
        </p>
        <ul className="space-y-1">
          {legend.map((row) => (
            <li key={row.color + row.label} className="flex items-center gap-2">
              <span className="h-3 w-5 rounded-sm border border-black/10" style={{ background: row.color }} />
              <span className="text-[0.76rem] tabular-nums text-ink-soft">{row.label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="h-3 w-5 rounded-sm border border-line-strong" style={{ background: NO_DATA }} />
            <span className="text-[0.76rem] text-ink-faint">No data</span>
          </li>
        </ul>
      </div>

      {hover && hoverRec && (
        <div className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line-strong bg-surface/97 p-3 shadow-lg" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
          <p className="mb-1.5 font-serif text-[1rem] font-600 text-ink">{hover.district}</p>
          <dl className="space-y-1 text-[0.84rem]">
            <Row label={vdef.label} value={hoverVal == null ? '—' : `${vdef.fmt(hoverVal)} ${vdef.unit}`} highlight />
            <Row label="Cases" value={int(hoverRec.cases)} />
            <Row label="Attack rate" value={`${hoverRec.attackRate.toFixed(1)} /100k`} />
          </dl>
        </div>
      )}
    </main>
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
