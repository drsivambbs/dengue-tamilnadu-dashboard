import type { Page } from '../types'

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'data', label: 'Data' },
  // Advanced Analytics + GIS hidden for now (kept in code; restore here to re-enable)
]

/** Top application bar with primary navigation. */
export function Header({ page, onPage }: { page: Page; onPage: (p: Page) => void }) {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-line-strong bg-surface px-7 py-3 shadow-[0_1px_0_rgba(21,33,46,0.04)]">
      <div className="flex items-center gap-4">
        {/* Simple emblem mark (placeholder for an institutional logo later) */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-surface shadow-sm">
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
