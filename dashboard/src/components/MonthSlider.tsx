import { useRef } from 'react'
import { MONTHS, type Year } from '../types'

/**
 * Vertical month selector that floats over the left edge of the map.
 * Steps run from "Whole year" (-1) at the bottom up to the year's last month
 * at the top. Supports click-on-label, drag-the-thumb, and arrow keys.
 */
export function MonthSlider({
  year,
  month,
  max,
  onMonth,
}: {
  year: Year
  month: number
  max: number // index of the last selectable month (11, or 5 for partial 2026)
  onMonth: (m: number) => void
}) {
  // ascending values: -1 (whole year), 0 (Jan) … max
  const steps = [-1, ...Array.from({ length: max + 1 }, (_, i) => i)]
  const n = steps.length
  const trackRef = useRef<HTMLDivElement>(null)

  const cur = month < 0 ? -1 : Math.min(month, max)
  const curIdx = steps.indexOf(cur) // 0 = bottom, n-1 = top
  const filled = (curIdx / (n - 1)) * 100 // % filled from the bottom

  const setFromY = (clientY: number) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientY - r.top) / r.height)) // 0 top → 1 bottom
    onMonth(steps[Math.round((1 - f) * (n - 1))])
  }

  return (
    <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 select-none gap-2.5 rounded-xl border border-line bg-surface/90 px-3 py-3.5 shadow-[0_4px_20px_rgba(21,33,46,0.14)] backdrop-blur-sm">
      {/* track + thumb */}
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          setFromY(e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) setFromY(e.clientY)
        }}
        role="slider"
        aria-label="Month"
        aria-valuemin={-1}
        aria-valuemax={max}
        aria-valuenow={month}
        aria-valuetext={month < 0 ? 'Whole year' : `${MONTHS[month]} ${year}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowUp' || e.key === 'ArrowRight') && cur < max) onMonth(cur + 1)
          if ((e.key === 'ArrowDown' || e.key === 'ArrowLeft') && cur > -1) onMonth(cur - 1)
        }}
        className="relative h-60 w-1.5 cursor-pointer rounded-full bg-line"
      >
        <div className="absolute inset-x-0 bottom-0 rounded-full bg-brand" style={{ height: `${filled}%` }} />
        <div
          className="absolute left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-surface shadow-md transition-[top] duration-100"
          style={{ top: `${100 - filled}%` }}
        />
      </div>

      {/* clickable labels, top = latest month */}
      <div className="flex h-60 flex-col justify-between text-[0.72rem] font-600">
        {[...steps].reverse().map((v) => {
          const active = v === cur
          return (
            <button
              key={v}
              onClick={() => onMonth(v)}
              className={`leading-none transition-colors ${
                active ? 'text-brand-strong' : 'text-ink-soft hover:text-brand'
              }`}
            >
              {v < 0 ? 'Year' : MONTHS[v]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
