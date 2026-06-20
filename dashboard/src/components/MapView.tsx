import { useEffect, useMemo, useState, useCallback } from 'react'
import { Map as MapGL, Source, Layer, NavigationControl } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, StyleSpecification } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getYearValues, getRecord, isPartial } from '../dataService'
import { colorExpression, METRIC_CONFIG } from '../metrics'
import { METRICS, type Metric, type Year } from '../types'

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

export function MapView({ year, metric }: { year: Year; metric: Metric }) {
  const [geo, setGeo] = useState<FeatureCollection | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''
  const partial = isPartial(year)

  useEffect(() => {
    fetch('/tamilnadu_districts.geojson')
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(null))
  }, [])

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

  const fmt = METRIC_CONFIG[metric].format
  const hoverRec = hover ? getRecord(hover.district, year) : undefined

  return (
    <section className="relative flex flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
      <div className="flex items-baseline justify-between gap-4 border-b border-line px-6 py-4">
        <h2 className="font-serif text-[1.15rem] font-600 text-ink">{metricLabel} by district</h2>
        <span className="rounded-md bg-brand-soft px-3 py-1 text-[0.85rem] font-600 text-brand-strong">
          {year}
          {partial && <span className="ml-1 font-400 text-brand">· {partial}</span>}
        </span>
      </div>

      <div className="relative flex-1">
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
              <Layer
                id="district-fill"
                type="fill"
                paint={{ 'fill-color': colorExpression(metric) as never, 'fill-opacity': 0.82 }}
              />
              <Layer
                id="district-line"
                type="line"
                paint={{ 'line-color': '#ffffff', 'line-width': 0.8 }}
              />
              <Layer
                id="district-hover"
                type="line"
                filter={['==', ['get', 'district'], hover?.district ?? '']}
                paint={{ 'line-color': '#0e3460', 'line-width': 2.4 }}
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
    </section>
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
