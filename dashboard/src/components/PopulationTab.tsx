import { useEffect, useMemo, useState } from 'react'
import { dataApi, type BaseRow, type PopRow } from '../dataApi'
import { Modal, Field } from './Modal'

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
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'district', dir: 1 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [editBase, setEditBase] = useState<BaseRow | null>(null)
  const [baseForm, setBaseForm] = useState({ census: '', growth: '' })
  const [ovr, setOvr] = useState<{ district: string; year: number; isOverride: boolean } | null>(null)
  const [ovrVal, setOvrVal] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([dataApi.listBase(), dataApi.listPopulation()])
      .then(([b, p]) => { setBase(b); setPops(p); setErr('') })
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

  const toggleSort = (k: string) => setSort((s) => (s.key === k ? { key: k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key: k, dir: 1 }))

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const val = (b: BaseRow): string | number => {
      if (sort.key === 'district') return b.district
      if (sort.key === 'census') return b.census_2011
      if (sort.key === 'growth') return b.growth_pct
      return popMap[b.district]?.[Number(sort.key.slice(2))]?.population ?? 0
    }
    return base
      .filter((b) => !q || b.district.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = val(a), vb = val(b)
        const d = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
        return (d || a.district.localeCompare(b.district)) * sort.dir
      })
  }, [base, query, sort, popMap])

  const openEditBase = (b: BaseRow) => { setEditBase(b); setBaseForm({ census: String(b.census_2011), growth: String(b.growth_pct) }) }
  const saveBase = async () => {
    if (!editBase) return
    setBusy(true); setErr('')
    try { await dataApi.saveBase({ district: editBase.district, census_2011: +baseForm.census, growth_pct: +baseForm.growth }); setEditBase(null); load() }
    catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const openOverride = (district: string, year: number, p?: PopRow) => { setOvr({ district, year, isOverride: !!p?.is_override }); setOvrVal(String(p?.population ?? '')) }
  const saveOverride = async () => {
    if (!ovr) return
    setBusy(true); setErr('')
    try { await dataApi.saveOverride({ district: ovr.district, year: ovr.year, population: +ovrVal }); setOvr(null); load() }
    catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }
  const revert = async () => {
    if (!ovr) return
    setBusy(true); setErr('')
    try { await dataApi.clearOverride(ovr.district, ovr.year); setOvr(null); load() }
    catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  const Arrow = ({ k }: { k: string }) => <span className="text-[0.7rem] text-ink-faint">{sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="font-serif text-[1.15rem] font-600 text-ink">Population (auto-projected)</h2>
            <p className="text-[0.8rem] text-ink-soft">Projected from the 2011 Census by a per-district growth rate · click headers to sort · Edit the base, or a year cell to override</p>
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
                <th className="border-b border-line px-4 py-2.5 text-left font-600 text-ink-soft"><button onClick={() => toggleSort('district')} className="inline-flex items-center gap-1 hover:text-brand-strong">District <Arrow k="district" /></button></th>
                <th className="border-b border-line px-4 py-2.5 text-right font-600 text-ink-soft"><button onClick={() => toggleSort('census')} className="inline-flex flex-row-reverse items-center gap-1 hover:text-brand-strong">Census 2011 <Arrow k="census" /></button></th>
                <th className="border-b border-line px-4 py-2.5 text-right font-600 text-ink-soft"><button onClick={() => toggleSort('growth')} className="inline-flex flex-row-reverse items-center gap-1 hover:text-brand-strong">Growth %/yr <Arrow k="growth" /></button></th>
                {years.map((y) => (
                  <th key={y} className="border-b border-line px-4 py-2.5 text-right font-600 text-ink-soft"><button onClick={() => toggleSort(`y:${y}`)} className="inline-flex flex-row-reverse items-center gap-1 hover:text-brand-strong">{y} <Arrow k={`y:${y}`} /></button></th>
                ))}
                <th className="border-b border-line px-3 py-2.5 text-right font-600 text-ink-soft"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.district} className="odd:bg-panel/40 hover:bg-brand-soft/40">
                  <td className="border-b border-line px-4 py-1.5 font-600 text-ink">{b.district}</td>
                  <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink">{intl(b.census_2011)}</td>
                  <td className="border-b border-line px-4 py-1.5 text-right font-mono text-ink">{b.growth_pct}</td>
                  {years.map((y) => {
                    const p = popMap[b.district]?.[y]
                    return (
                      <td key={y} className="border-b border-line px-4 py-1.5 text-right">
                        <button onClick={() => openOverride(b.district, y, p)} title="Click to override with an official figure" className="inline-flex items-center gap-1.5 hover:text-brand-strong">
                          <span className={`font-mono ${p?.is_override ? 'font-600 text-brand-strong' : 'text-ink-soft'}`}>{p ? intl(p.population) : '—'}</span>
                          {p?.is_override && <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[0.6rem] font-600 uppercase tracking-wide text-brand-strong">set</span>}
                        </button>
                      </td>
                    )
                  })}
                  <td className="border-b border-line px-3 py-1.5 text-right">
                    <button onClick={() => openEditBase(b)} className="rounded-md px-2 py-1 text-[0.78rem] font-600 text-brand-strong hover:bg-brand-soft">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <p className="px-4 py-6 text-center text-ink-faint">No matching districts.</p>}
        </div>

        <div className="border-t border-line px-5 py-2 text-[0.78rem] text-ink-faint">
          Auto-calculated; values tagged <span className="font-600 text-brand-strong">set</span> are official overrides. Editing the base re-projects every year. Saved to BigQuery with an audit log. ⚠ Sign-in &amp; roles to be added before public use.
        </div>
      </section>

      {editBase && (
        <Modal title={`Edit population base · ${editBase.district}`} onClose={() => setEditBase(null)}>
          <Field label="2011 Census population" value={baseForm.census} onChange={(v) => setBaseForm({ ...baseForm, census: v })} />
          <Field label="Annual growth rate (%)" value={baseForm.growth} onChange={(v) => setBaseForm({ ...baseForm, growth: v })} hint="Re-projects every year for this district." />
          <div className="mt-1 flex justify-end gap-2">
            <button onClick={() => setEditBase(null)} className="rounded-lg px-3.5 py-2 text-[0.85rem] font-600 text-ink-soft hover:bg-panel">Cancel</button>
            <button onClick={saveBase} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-[0.85rem] font-600 text-surface disabled:opacity-50">Save</button>
          </div>
        </Modal>
      )}

      {ovr && (
        <Modal title={`Override population · ${ovr.district} ${ovr.year}`} onClose={() => setOvr(null)}>
          <Field label="Official population" value={ovrVal} onChange={setOvrVal} hint="Overrides the projected value for this district-year only." />
          <div className="mt-1 flex items-center justify-between">
            <button onClick={revert} disabled={busy || !ovr.isOverride} className="rounded-lg px-3 py-2 text-[0.82rem] font-600 text-alert hover:bg-alert/10 disabled:opacity-40">Revert to projection</button>
            <div className="flex gap-2">
              <button onClick={() => setOvr(null)} className="rounded-lg px-3.5 py-2 text-[0.85rem] font-600 text-ink-soft hover:bg-panel">Cancel</button>
              <button onClick={saveOverride} disabled={busy || !ovrVal} className="rounded-lg bg-brand px-4 py-2 text-[0.85rem] font-600 text-surface disabled:opacity-50">Save</button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  )
}
