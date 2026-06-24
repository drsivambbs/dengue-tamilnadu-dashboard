import { useMemo, useState } from 'react'

/**
 * Accessible district search. A text box filters the 38 districts; clicking a
 * result (or pressing Enter on the first match) selects it. Large touch targets
 * and clear focus states for senior users.
 */
export function DistrictSearch({
  districts,
  selected,
  onSelect,
}: {
  districts: string[]
  selected: string | null
  onSelect: (d: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return districts
    return districts.filter((d) => d.toLowerCase().includes(q))
  }, [districts, query])

  const choose = (d: string) => {
    onSelect(d)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 focus-within:border-brand">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-faint" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          placeholder={selected ?? 'Search a district…'}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches.length) choose(matches[0])
            if (e.key === 'Escape') setOpen(false)
          }}
          className="w-full bg-transparent text-[0.85rem] font-600 text-ink placeholder:font-400 placeholder:text-ink-faint focus:outline-none"
          aria-label="Search district"
          role="combobox"
          aria-expanded={open}
          aria-controls="district-listbox"
        />
      </div>

      {open && (
        <ul
          id="district-listbox"
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line-strong bg-surface py-1 shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3.5 py-2 text-[0.88rem] text-ink-faint">No match</li>
          )}
          {matches.map((d) => (
            <li key={d} role="option" aria-selected={d === selected}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(d)}
                className={`w-full px-3.5 py-2.5 text-left text-[0.92rem] transition-colors hover:bg-brand-soft ${
                  d === selected ? 'font-600 text-brand-strong' : 'text-ink'
                }`}
              >
                {d}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
