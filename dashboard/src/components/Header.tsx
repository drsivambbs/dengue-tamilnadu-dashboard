/** Top application bar. Clear institutional title, no branding yet (per spec). */
export function Header() {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-line-strong bg-surface px-7 py-4 shadow-[0_1px_0_rgba(21,33,46,0.04)]">
      <div className="flex items-center gap-4">
        {/* Simple emblem mark (placeholder for an institutional logo later) */}
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-surface shadow-sm">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path
              d="M12 2C8 6 5 9 5 13a7 7 0 0014 0c0-4-3-7-7-11z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="font-serif text-[1.5rem] font-600 leading-tight text-ink">
            Tamil Nadu Dengue Surveillance
          </h1>
          <p className="text-[0.86rem] text-ink-soft">
            District-wise monitoring dashboard · Source: IHIP
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-right">
        <div className="hidden lg:block">
          <p className="text-[0.72rem] uppercase tracking-[0.08em] text-ink-faint">Reporting period</p>
          <p className="text-[0.95rem] font-600 text-ink">2024 – 2026</p>
        </div>
        <span className="rounded-full border border-line bg-panel px-3 py-1.5 text-[0.74rem] font-500 text-ink-soft">
          Preview · Phase 1a
        </span>
      </div>
    </header>
  )
}
