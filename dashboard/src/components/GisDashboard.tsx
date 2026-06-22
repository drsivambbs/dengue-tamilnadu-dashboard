import { useEffect, useMemo, useState, useCallback } from 'react'
import { Map as MapGL, Source, Layer, NavigationControl } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, StyleSpecification } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getYearValues, getRecord } from '../dataService'
import { colorExpression, METRIC_CONFIG } from '../metrics'
import { classify } from '../classify'
import { MapLegend } from './MapLegend'
import { METRICS, YEARS, type Metric, type Year } from '../types'

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

interface Hover {
  x: number
  y: number
  district: string
}

export function GisDashboard() {
  const [boundaries, setBoundaries] = useState<FeatureCollection | null>(null)
  const [points, setPoints] = useState<FeatureCollection | null>(null)
  const [links, setLinks] = useState<FeatureCollection | null>(null)
  const [year, setYear] = useState<Year>(2024)
  const [metric, setMetric] = useState<Metric>('attackRate')
  const [show, setShow] = useState({ choropleth: true, links: false, lights: false })
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    fetch('/tamilnadu_districts.geojson').then((r) => r.json()).then(setBoundaries).catch(() => {})
    fetch('/district_points.geojson').then((r) => r.json()).then(setPoints).catch(() => {})
    fetch('/district_links.geojson').then((r) => r.json()).then(setLinks).catch(() => {})
  }, [])

  const breaks = useMemo(
    () => classify(getYearValues(year, metric).map((d) => d.value), 'quantile'),
    [year, metric],
  )

  const fc = useMemo<FeatureCollection | null>(() => {
    if (!boundaries) return null
    const vals = new Map(getYearValues(year, metric).map((d) => [d.district, d.value]))
    return {
      ...boundaries,
      features: boundaries.features.map((f) => ({
        ...f,
        properties: { ...f.properties, value: vals.get((f.properties as { district: string }).district) ?? null },
      })),
    }
  }, [boundaries, year, metric])

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0]
    setHover(feat ? { x: e.point.x, y: e.point.y, district: (feat.properties as { district: string }).district } : null)
  }, [])

  const fmt = METRIC_CONFIG[metric].format
  const hoverRec = hover ? getRecord(hover.district, year) : undefined
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''

  return (
    <main className="relative min-h-0 flex-1">
      <MapGL
        initialViewState={{ longitude: 78.4, latitude: 10.85, zoom: 5.9 }}
        mapStyle={BASEMAP}
        interactiveLayerIds={show.choropleth ? ['district-fill'] : []}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        attributionControl={{ compact: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {fc && show.choropleth && (
          <Source id="districts" type="geojson" data={fc}>
            <Layer id="district-fill" type="fill" paint={{ 'fill-color': colorExpression(breaks) as never, 'fill-opacity': 0.8 }} />
            <Layer id="district-line" type="line" paint={{ 'line-color': '#000000', 'line-width': 0.5 }} />
            <Layer id="district-hover" type="line" filter={['==', ['get', 'district'], hover?.district ?? '']} paint={{ 'line-color': '#0e3460', 'line-width': 2 }} />
          </Source>
        )}

        {links && show.links && (
          <Source id="links" type="geojson" data={links}>
            <Layer id="links-line" type="line" paint={{ 'line-color': '#0e3460', 'line-opacity': 0.45, 'line-width': 1 }} />
          </Source>
        )}

        {points && show.lights && (
          <Source id="points" type="geojson" data={points}>
            <Layer
              id="lights-circle"
              type="circle"
              paint={{
                'circle-color': '#c77d12',
                'circle-opacity': 0.55,
                'circle-stroke-color': '#8a560c',
                'circle-stroke-width': 1,
                'circle-radius': ['interpolate', ['linear'], ['get', 'nightlights'], 0, 3, 5, 10, 30, 24],
              }}
            />
          </Source>
        )}
      </MapGL>

      {/* Layers + view panel (top-left) */}
      <div className="absolute left-3 top-3 z-10 w-60 rounded-lg border border-line bg-surface/95 p-3 shadow-md backdrop-blur-sm">
        <p className="mb-2 font-serif text-[1rem] font-600 text-ink">GIS layers</p>

        <div className="space-y-1.5">
          <LayerToggle label="District choropleth" on={show.choropleth} onClick={() => setShow((s) => ({ ...s, choropleth: !s.choropleth }))} />
          <LayerToggle label="Neighbour spread links" on={show.links} onClick={() => setShow((s) => ({ ...s, links: !s.links }))} />
          <LayerToggle label="Urbanisation (night-lights)" on={show.lights} onClick={() => setShow((s) => ({ ...s, lights: !s.lights }))} />
        </div>

        <div className="mt-3 border-t border-line pt-2.5">
          <p className="mb-1 text-[0.72rem] font-600 uppercase tracking-wide text-ink-faint">Metric</p>
          <div className="flex flex-col gap-1">
            {METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={`rounded-md px-2.5 py-1.5 text-left text-[0.85rem] font-600 transition-colors ${
                  m.id === metric ? 'bg-brand text-surface' : 'text-ink-soft hover:bg-brand-soft'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mb-1 mt-2.5 text-[0.72rem] font-600 uppercase tracking-wide text-ink-faint">Year</p>
          <div className="flex gap-1">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`flex-1 rounded-md py-1.5 text-[0.85rem] font-600 transition-colors ${
                  y === year ? 'bg-brand text-surface' : 'bg-panel text-ink-soft hover:bg-brand-soft'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {show.choropleth && <MapLegend metric={metric} breaks={breaks} method="quantile" />}

      {hover && hoverRec && (
        <div className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line-strong bg-surface/97 p-3 shadow-lg" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
          <p className="mb-1.5 font-serif text-[1rem] font-600 text-ink">{hover.district}</p>
          <dl className="space-y-1 text-[0.84rem]">
            <Row label={metricLabel} value={fmt(hoverRec[metric])} />
            <Row label="Cases" value={hoverRec.cases.toLocaleString('en-IN')} />
            <Row label="Attack rate" value={`${hoverRec.attackRate.toFixed(1)} /100k`} />
          </dl>
        </div>
      )}
    </main>
  )
}

function LayerToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left hover:bg-panel">
      <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${on ? 'border-brand bg-brand text-surface' : 'border-line-strong bg-surface'}`}>
        {on && (
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </span>
      <span className="text-[0.88rem] text-ink">{label}</span>
    </button>
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
