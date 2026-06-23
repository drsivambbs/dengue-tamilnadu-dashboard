import type { ReactNode } from 'react'

/**
 * Collapsible workbench section. Uses native <details>/<summary> so it is
 * keyboard-accessible and screen-reader friendly with no extra wiring —
 * important for our senior-administrator audience.
 */
export function Panel({
  title,
  hint,
  children,
  defaultOpen = true,
}: {
  title: string
  hint?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="group border-b border-line last:border-b-0">
      <summary
        className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5
                   text-[0.74rem] font-600 uppercase tracking-[0.08em] text-ink-soft
                   hover:bg-brand-soft/50 focus-visible:bg-brand-soft/60"
      >
        <span>{title}</span>
        <svg
          className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-90"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-4 pb-3.5 pt-0.5">
        {hint && <p className="mb-2.5 text-[0.78rem] leading-snug text-ink-faint">{hint}</p>}
        {children}
      </div>
    </details>
  )
}
