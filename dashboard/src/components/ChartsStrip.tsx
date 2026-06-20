/** KPI + charts strip below the map. Placeholders for Phase 1d. */
export function ChartsStrip() {
  return (
    <section className="grid grid-cols-4 gap-4" aria-label="Summary indicators">
      <Kpi label="Total cases" />
      <Kpi label="Deaths" />
      <Kpi label="Case fatality ratio" />
      <Kpi label="Change vs previous year" />
    </section>
  )
}

function Kpi({ label }: { label: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-surface px-5 py-4 shadow-sm">
      <p className="text-[0.8rem] font-600 uppercase tracking-[0.06em] text-ink-faint">{label}</p>
      <p className="mt-2 font-mono text-[1.7rem] font-600 leading-none text-ink-faint/60">––</p>
      <p className="mt-2 text-[0.78rem] text-ink-faint">Populated in Phase 1d</p>
    </div>
  )
}
