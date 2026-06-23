import { useEffect, useMemo, useState } from 'react'
import { dataApi, type BaseRow, type PopRow } from '../dataApi'

const intl = (v: number) => v.toLocaleString('en-IN')

/**
 * Population management — separate from case entry. Population is projected from
 * each district's 2011 Census base by a per-district annual growth rate:
 *   population(year) = census_2011 × (1 + growth%/100)^(year − 2011)
 * An admin can override a specific district-year with an official figure.
 */
export function PopulationTab() {
  const [base, setBase] = useState<BaseRow[]>([])
  const [pops, setPops] = useState<PopRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { census: string; growth: string }>>({})
  const [ovr, setOvr] = useState<{ district: string; year: number } | null>(null)
  const [ovrVal, setOvrVal] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([dataApi.listBase(), dataApi.listPopulation()])
      .then(([b, p]) => {
        setBase(b)
        setPops(p)
        setDrafts(Object.fromEntries(b.map((r) => [r.district, { census: String(r.census_2011), growth: String(r.growth_pct) }])))
        setErr('')
      })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const years = useMemo(() => [...new Set(pops.map((p) => p.year))].sort((a, b) => a - b), [pops])
  const popMap = useMemo(() => {
    const m: Record<string, Record<number, PopRow>> = {}
    for (const p of pops) (m[p.district] ??= {})[p.year] = p
    return m
  }, [pops])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return base.filter((b) => !q || b.district.toLowerCase().includes(q)).sort((a, b) => a.district.localeCompare(b.district))
  }, [base, query])

  const dirty = (d: string) => {
    const b = base.find((x) => x.district === d)
    const dr = drafts[d]
    return b && dr && (dr.census !== String(b.census_2011) || dr.growth !== String(b.growth_pct))
  }

  const saveBase = async (d: string) => {
    const dr = drafts[d]
    setBusy(true); setErr('')
    try {
      await dataApi.saveBase({ district: d, census_2011: +dr.census, growth_pct: +dr.growth })
      load()
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const saveOverride = async () => {
    if (!ovr) return
    setBusy(true); setErr('')
    try {
      await dataApi.saveOverride({ district: ovr.district, year: ovr.year, population: +ovrVal })
      setOvr(null); load()
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const revert = async (d: string, y: number) => {
    setBusy(true); setErr('')
    try { await dataApi.clearOverride(d, y); load() }
    catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="font-serif text-[1.15rem] font-600 text-ink">Population (auto-projected)</h2>
            <p className="text-[0.8rem] text-ink-soft">
              Projected from the 2011 Census by a per-district growth rate · edit the base or override a year with an official figure
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[0.72rem] font-600 ${err ? 'bg-alert/15 text-alert' : 'bg-good/15 text-good'}`}>
            {loading ? 'Loading…' : err ? 'Error' : `${base.length} districts · cloud`}
          </span>
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 focus-within:border-brand">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search district…" className="w-40 bg-transparent text-[0.9rem] text-ink placeholder:text-ink-faint focus:outline-none" />
          </div>
        </div>

        {err && <p className="border-b border-line bg-alert/10 px-5 py-2 text-[0.85rem] text-alert">{err}</p>}

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr>
                <th className="border-b border-line px-4 py-2.5 text-left font-600 text-ink-soft">District</th>
                <th className="border-b border-line px-4 py-2.5 text-right font-600 text-ink-soft">Census 2011</th>
                <th className="border-b border-line px-4 py-2.5 text-right font-600 text-ink-soft">Growth %/yr</th>
                <th className="border-b border-line px-3 py-2.5 text-left font-600 text-ink-soft"></th>
                {years.map((y) => (
                  <th key={y} className="border-b border-line px-4 py-2.5 text-right font-600 text-ink-soft">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const dr = drafts[b.district] ?? { census: '', growth: '' }
                const isDirty = dirty(b.district)
                return (
                  <tr key={b.district} className="odd:bg-panel/40 hover:bg-brand-soft/40">
                    <td className="border-b border-line px-4 py-1.5 font-600 text-ink">{b.district}</td>
                    <td className="border-b border-line px-4 py-1.5 text-right">
                      <input
                        value={dr.census}
                        onChange={(e) => setDrafts({ ...drafts, [b.district]: { ...dr, census: e.target.value } })}
                        inputMode="numeric"
                        className="w-28 rounded-md border border-line bg-surface px-2 py-0.5 text-right font-mono text-[0.85rem] focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="border-b border-line px-4 py-1.5 text-right">
                      <input
                        value={dr.growth}
                        onChange={(e) => setDrafts({ ...drafts, [b.district]: { ...dr, growth: e.target.value } })}
                        inputMode="decimal"
                        className="w-20 rounded-md border border-line bg-surface px-2 py-0.5 text-right font-mono text-[0.85rem] focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="border-b border-line px-3 py-1.5">
                      {isDirty && (
                        <button onClick={() => saveBase(b.district)} disabled={busy} className="rounded-md bg-brand px-2.5 py-1 text-[0.78rem] font-600 text-surface disabled:opacity-50">Save</button>
                      )}
                    </td>
                    {years.map((y) => {
                      const p = popMap[b.district]?.[y]
                      const editing = ovr?.district === b.district && ovr?.year === y
                      return (
                        <td key={y} className="border-b border-line px-4 py-1.5 text-right">
                          {editing ? (
                            <span className="inline-flex items-center gap-1">
                              <input value={ovrVal} onChange={(e) => setOvrVal(e.target.value)} inputMode="numeric" className="w-24 rounded-md border border-brand bg-surface px-2 py-0.5 text-right font-mono text-[0.85rem] focus:outline-none" />
                              <button onClick={saveOverride} disabled={busy} className="rounded bg-brand px-1.5 py-0.5 text-[0.72rem] font-600 text-surface disabled:opacity-50">✓</button>
                              <button onClick={() => setOvr(null)} className="rounded px-1 py-0.5 text-[0.72rem] text-ink-soft hover:bg-panel">✕</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => { setOvr({ district: b.district, year: y }); setOvrVal(String(p?.population ?? '')) }}
                              title="Click to set an official override"
                              className="group inline-flex items-center gap-1.5"
                            >
                              <span className={`font-mono ${p?.is_override ? 'font-600 text-brand-strong' : 'text-ink-soft'}`}>{p ? intl(p.population) : '—'}</span>
                              {p?.is_override && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); revert(b.district, y) }}
                                  title="Manual override — click to revert to projection"
                                  className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[0.62rem] font-600 uppercase tracking-wide text-brand-strong hover:bg-alert/15 hover:text-alert"
                                >
                                  set ↺
                                </span>
                              )}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <p className="px-4 py-6 text-center text-ink-faint">No matching districts.</p>}
        </div>

        <div className="border-t border-line px-5 py-2 text-[0.78rem] text-ink-faint">
          Population is auto-calculated; values in <span className="font-600 text-brand-strong">blue with “set ↺”</span> are official overrides. Editing the base re-projects every year. Saved to BigQuery with an audit log. ⚠ Sign-in &amp; roles to be added before public use.
        </div>
      </section>
    </main>
  )
}
