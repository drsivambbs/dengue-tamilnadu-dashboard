import { useEffect, type ReactNode } from 'react'

/** Centered modal dialog with a backdrop. Closes on Escape / backdrop click. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-sm rounded-[var(--radius-panel)] border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="font-serif text-[1.05rem] font-600 text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-ink-faint hover:bg-panel hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/** Labelled numeric field for modal forms. */
export function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[0.82rem] font-600 text-ink-soft">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[0.9rem] text-ink focus:border-brand focus:outline-none"
      />
      {hint && <span className="mt-1 block text-[0.74rem] text-ink-faint">{hint}</span>}
    </label>
  )
}
