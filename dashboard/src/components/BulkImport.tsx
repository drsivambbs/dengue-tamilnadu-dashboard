import { useMemo, useState } from 'react'
import { dataApi, type MonthlyInput } from '../dataApi'

/** Parse pasted/uploaded long-format rows: district, year, month, cases, deaths.
 *  Accepts CSV or TSV; an optional header row is skipped. */
function parse(text: string, districtSet: Set<string>) {
  const rows: MonthlyInput[] = []
  const errors: string[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  lines.forEach((line, i) => {
    if (i === 0 && /district/i.test(line) && /month/i.test(line)) return // header
    const cells = line.split(line.includes('\t') ? '\t' : ',').map((c) => c.trim())
    if (cells.length < 5) { errors.push(`Line ${i + 1}: expected 5 columns, got ${cells.length}`); return }
    const [d, yS, mS, cS, deS] = cells
    const year = Number(yS), month = Number(mS), cases = Number(cS), deaths = Number(deS)
    if (!districtSet.has(d)) errors.push(`Line ${i + 1}: unknown district "${d}"`)
    else if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.push(`Line ${i + 1}: bad year "${yS}"`)
    else if (!Number.isInteger(month) || month < 1 || month > 12) errors.push(`Line ${i + 1}: month must be 1–12 ("${mS}")`)
    else if (!Number.isInteger(cases) || cases < 0) errors.push(`Line ${i + 1}: bad cases "${cS}"`)
    else if (!Number.isInteger(deaths) || deaths < 0) errors.push(`Line ${i + 1}: bad deaths "${deS}"`)
    else rows.push({ district: d, year, month, cases, deaths })
  })
  return { rows, errors }
}

export function BulkImport({ districts, onImported }: { districts: string[]; onImported: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const districtSet = useMemo(() => new Set(districts), [districts])
  const { rows, errors } = useMemo(() => parse(text, districtSet), [text, districtSet])

  const onFile = (file: File | undefined) => {
    if (!file) return
    file.text().then((t) => { setText(t); setMsg(''); setErr('') })
  }

  const doImport = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      const res = await dataApi.bulkImport(rows)
      setMsg(`Imported ${res.imported} rows (years ${res.years.join(', ')}).`)
      setText('')
      onImported()
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false) }
  }

  return (
    <div className="border-b border-line bg-panel/40 px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[0.78rem] font-600 uppercase tracking-wide text-ink-faint">Bulk import</span>
        <span className="text-[0.74rem] text-ink-faint">
          Columns: <span className="font-mono">district, year, month, cases, deaths</span> · CSV or TSV (paste from Excel) · header row optional
        </span>
        <label className="ml-auto cursor-pointer rounded-md border border-line bg-surface px-3 py-1.5 text-[0.82rem] font-600 text-ink-soft hover:border-line-strong hover:text-brand-strong">
          Upload .csv
          <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setMsg(''); setErr('') }}
        placeholder={'Chennai,2027,1,120,0\nCoimbatore,2027,1,95,1\n…  (or paste rows copied from Excel)'}
        rows={5}
        className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-[0.82rem] text-ink focus:border-brand focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          onClick={doImport}
          disabled={busy || rows.length === 0}
          className="rounded-md bg-brand px-3.5 py-1.5 text-[0.85rem] font-600 text-surface disabled:opacity-50"
        >
          {busy ? 'Importing…' : `Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}
        </button>
        {text.trim() && (
          <span className={`text-[0.8rem] font-600 ${errors.length ? 'text-warn' : 'text-good'}`}>
            {rows.length} valid · {errors.length} error{errors.length === 1 ? '' : 's'}
          </span>
        )}
        {msg && <span className="text-[0.8rem] font-600 text-good">{msg}</span>}
        {err && <span className="text-[0.8rem] font-600 text-alert">{err}</span>}
      </div>

      {errors.length > 0 && (
        <ul className="mt-1.5 max-h-24 overflow-auto text-[0.76rem] text-alert">
          {errors.slice(0, 8).map((e) => <li key={e}>• {e}</li>)}
          {errors.length > 8 && <li className="text-ink-faint">…and {errors.length - 8} more</li>}
        </ul>
      )}
    </div>
  )
}
