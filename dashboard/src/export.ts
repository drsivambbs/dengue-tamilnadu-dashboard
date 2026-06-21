import { getExportRows } from './dataService'

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Download the full district × year dataset as CSV. */
export function downloadCsv() {
  const rows = getExportRows()
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','))
  downloadBlob('tamilnadu-dengue-data.csv', new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
}

interface LegendItem {
  color: string
  label: string
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Compose the live map canvas into a self-contained PNG with a title banner and
 * a legend drawn on top. Returns a Blob (or null if the canvas is unavailable).
 */
export function exportMapImage(
  mapCanvas: HTMLCanvasElement,
  opts: { title: string; subtitle: string; legend: LegendItem[] },
): Promise<Blob | null> {
  const dpr = window.devicePixelRatio || 1
  const w = mapCanvas.width
  const h = mapCanvas.height
  const titleH = Math.round(64 * dpr)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h + titleH
  const ctx = out.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)

  const font = (weight: number, px: number) =>
    `${weight} ${Math.round(px * dpr)}px "Public Sans", system-ui, sans-serif`

  ctx.fillStyle = '#15212e'
  ctx.font = font(600, 22)
  ctx.fillText(opts.title, Math.round(20 * dpr), Math.round(34 * dpr))
  ctx.fillStyle = '#7488a0'
  ctx.font = font(400, 13)
  ctx.fillText(opts.subtitle, Math.round(20 * dpr), Math.round(52 * dpr))

  ctx.drawImage(mapCanvas, 0, titleH)

  // Legend (bottom-left of the map area)
  const pad = 9 * dpr
  const sw = 18 * dpr
  const sh = 12 * dpr
  const lh = 19 * dpr
  ctx.font = font(500, 12)
  let maxLabel = 0
  for (const l of opts.legend) maxLabel = Math.max(maxLabel, ctx.measureText(l.label).width)
  const boxW = pad * 2 + sw + 6 * dpr + maxLabel
  const boxH = pad * 2 + opts.legend.length * lh
  const bx = 12 * dpr
  const by = titleH + h - boxH - 12 * dpr

  ctx.fillStyle = 'rgba(255,255,255,0.93)'
  ctx.strokeStyle = '#d3dcea'
  ctx.lineWidth = dpr
  roundRect(ctx, bx, by, boxW, boxH, 6 * dpr)
  ctx.fill()
  ctx.stroke()

  ctx.textBaseline = 'top'
  opts.legend.forEach((l, i) => {
    const ry = by + pad + i * lh
    ctx.fillStyle = l.color
    ctx.fillRect(bx + pad, ry, sw, sh)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.strokeRect(bx + pad, ry, sw, sh)
    ctx.fillStyle = '#4b5d70'
    ctx.fillText(l.label, bx + pad + sw + 6 * dpr, ry)
  })
  ctx.textBaseline = 'alphabetic'

  return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png'))
}
