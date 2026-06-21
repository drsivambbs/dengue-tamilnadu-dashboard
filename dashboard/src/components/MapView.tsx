import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Map as MapGL, Source, Layer, NavigationControl } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef, StyleSpecification } from 'react-map-gl/maplibre'
import type { FeatureCollection, Feature, Position } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getYearValues, getRecord } from '../dataService'
import { colorExpression, METRIC_CONFIG } from '../metrics'
import { classify } from '../classify'
import { MapLegend } from './MapLegend'
import { METRICS, type ClassMethod, type Metric, type Year } from '../types'

// Free, no-API-key light basemap (CARTO Positron) — calm, muted, lets data lead.
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

type Bounds = [[number, number], [number, number]]

// Whole-state view to reset to when the selection is cleared.
const TN_BOUNDS: Bounds = [
  [76.0, 8.0],
  [80.5, 13.7],
]

/** Bounding box of a (Multi)Polygon feature → [[w,s],[e,n]]. */
function featureBounds(feature: Feature): Bounds {
  let minX = 180, minY = 90, maxX = -180, maxY = -90
  const visit = (pos: Position) => {
    const [x, y] = pos
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const walk = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === 'number') visit(coords as Position)
    else (coords as unknown[]).forEach(walk)
  }
  const g = feature.geometry
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') walk(g.coordinates)
  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

interface Props {
  year: Year
  metric: Metric
  selected: string | null
  classMethod: ClassMethod
  onSelect: (d: string | null) => void
}

export function MapView({ year, metric, selected, classMethod, onSelect }: Props) {
  const mapRef = useRef<MapRef | null>(null)
  const [geo, setGeo] = useState<FeatureCollection | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''

  // Data-driven class breaks: recomputed from the actual values for this
  // metric + year using the chosen classification method.
  const breaks = useMemo(
    () => classify(getYearValues(year, metric).map((d) => d.value), classMethod),
    [year, metric, classMethod],
  )

  useEffect(() => {
    fetch('/tamilnadu_districts.geojson')
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(null))
  }, [])

  // Zoom to the selected district (or back to the whole state when cleared).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !geo) return
    if (!selected) {
      map.fitBounds(TN_BOUNDS, { padding: 20, duration: 700 })
      return
    }
    const feat = geo.features.find(
      (f) => (f.properties as { district: string }).district === selected,
    )
    if (feat) map.fitBounds(featureBounds(feat), { padding: 80, duration: 800, maxZoom: 9 })
  }, [selected, geo])

  // Merge the selected metric's value into each feature for data-driven styling.
  const fc = useMemo<FeatureCollection | null>(() => {
    if (!geo) return null
    const values = new Map(getYearValues(year, metric).map((d) => [d.district, d.value]))
    return {
      ...geo,
      features: geo.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          value: values.get((f.properties as { district: string }).district) ?? null,
        },
      })),
    }
  }, [geo, year, metric])

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const feat = e.features?.[0]
    if (feat) {
      setHover({ x: e.point.x, y: e.point.y, district: (feat.properties as { district: string }).district })
    } else {
      setHover(null)
    }
  }, [])

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0]
      const d = feat ? (feat.properties as { district: string }).district : null
      onSelect(d && d === selected ? null : d) // click again to deselect
    },
    [onSelect, selected],
  )

  const fmt = METRIC_CONFIG[metric].format
  const hoverRec = hover ? getRecord(hover.district, year) : undefined

  return (
    <div className="relative h-full w-full">
        <MapLegend metric={metric} breaks={breaks} method={classMethod} />
        <MapGL
          ref={mapRef}
          initialViewState={{ longitude: 78.4, latitude: 10.85, zoom: 5.9 }}
          mapStyle={BASEMAP}
          interactiveLayerIds={['district-fill']}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onClick={onClick}
          cursor={hover ? 'pointer' : 'grab'}
          attributionControl={{ compact: true }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {fc && (
            <Source id="districts" type="geojson" data={fc}>
              <Layer
                id="district-fill"
                type="fill"
                paint={{ 'fill-color': colorExpression(breaks) as never, 'fill-opacity': 0.82 }}
              />
              <Layer
                id="district-line"
                type="line"
                paint={{ 'line-color': '#000000', 'line-width': 0.5 }}
              />
              <Layer
                id="district-hover"
                type="line"
                filter={['==', ['get', 'district'], hover?.district ?? '']}
                paint={{ 'line-color': '#0e3460', 'line-width': 1.6 }}
              />
              <Layer
                id="district-selected"
                type="line"
                filter={['==', ['get', 'district'], selected ?? '']}
                paint={{ 'line-color': '#0e3460', 'line-width': 3.2 }}
              />
            </Source>
          )}
        </MapGL>

        {hover && hoverRec && (
          <div
            className="pointer-events-none absolute z-10 w-60 rounded-lg border border-line-strong bg-surface/97 p-3.5 shadow-lg backdrop-blur-sm"
            style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}
          >
            <p className="mb-2 font-serif text-[1.02rem] font-600 leading-tight text-ink">{hover.district}</p>
            <dl className="space-y-1 text-[0.85rem]">
              <Row label={metricLabel} value={fmt(hoverRec[metric])} highlight />
              <Row label="Cases" value={hoverRec.cases.toLocaleString('en-IN')} />
              <Row label="Deaths" value={hoverRec.deaths.toLocaleString('en-IN')} />
              <Row label="Attack rate" value={`${hoverRec.attackRate.toFixed(1)} /100k`} />
              <Row label="CFR" value={`${hoverRec.cfr.toFixed(2)}%`} />
              <Row label="Population" value={hoverRec.population.toLocaleString('en-IN')} />
            </dl>
          </div>
        )}
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
