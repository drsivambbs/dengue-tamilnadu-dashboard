import type { Page } from '../types'

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'trend', label: 'Trend' },
  { id: 'gis', label: 'Risk' },
  { id: 'data', label: 'Data' },
  { id: 'population', label: 'Population' },
  // Advanced Analytics hidden for now (kept in code; restore here to re-enable)
]

/** Top application bar with primary navigation. */
export function Header({ page, onPage }: { page: Page; onPage: (p: Page) => void }) {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-line-strong bg-surface px-7 py-3 shadow-[0_1px_0_rgba(21,33,46,0.04)]">
      <div className="flex items-center gap-4">
        {/* Directorate of Public Health & Preventive Medicine emblem */}
        <img
          src="/dph.png"
          alt="Directorate of Public Health & Preventive Medicine, Tamil Nadu"
          className="h-12 w-12 shrink-0"
        />
        <div>
          <p className="text-[0.7rem] font-600 uppercase tracking-[0.08em] text-ink-faint">
            Government of Tamil Nadu · Directorate of Public Health &amp; Preventive Medicine
          </p>
          <h1 className="font-serif text-[1.35rem] font-600 leading-tight text-ink">
            Tamil Nadu Dengue Surveillance
          </h1>
          <p className="text-[0.84rem] text-ink-soft">District-wise monitoring · Source: IHIP</p>
        </div>
      </div>

      <nav className="flex items-center gap-1.5 rounded-xl bg-panel p-1.5" aria-label="Primary">
        {NAV.map((n) => {
          const active = n.id === page
          return (
            <button
              key={n.id}
              onClick={() => onPage(n.id)}
              aria-current={active ? 'page' : undefined}
              className={`rounded-lg px-5 py-2 text-[0.92rem] font-600 transition-colors ${
                active ? 'bg-brand text-surface shadow-sm' : 'text-ink-soft hover:bg-brand-soft hover:text-brand-strong'
              }`}
            >
              {n.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
