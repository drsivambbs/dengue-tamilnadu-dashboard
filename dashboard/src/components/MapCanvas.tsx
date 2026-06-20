import { METRICS, type Metric, type Year } from '../types'

/** Placeholder for the interactive MapLibre map (arriving Phase 1b). */
export function MapCanvas({ year, metric }: { year: Year; metric: Metric }) {
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''
  return (
    <section
      className="relative flex flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm"
      aria-label="Map area"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-line px-6 py-4">
        <h2 className="font-serif text-[1.15rem] font-600 text-ink">
          {metricLabel} by district
        </h2>
        <span className="rounded-md bg-brand-soft px-3 py-1 text-[0.85rem] font-600 text-brand-strong">
          {year}
        </span>
      </div>

      {/* Empty state */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* faint grid texture to imply a map canvas */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(31,95,166,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(31,95,166,0.05) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
        <div className="relative max-w-sm px-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
              <path
                d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </div>
          <h3 className="font-serif text-[1.2rem] font-600 text-ink">Interactive district map</h3>
          <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-soft">
            The MapLibre choropleth of Tamil Nadu's 38 districts loads here in the next phase,
            with hover details, zoom, and toggleable GIS layers.
          </p>
          <p className="mt-4 inline-block rounded-full border border-line bg-panel px-3.5 py-1.5 text-[0.78rem] font-600 text-ink-faint">
            Coming in Phase 1b
          </p>
        </div>
      </div>
    </section>
  )
}
