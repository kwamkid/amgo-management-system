// lib/labels/pdf.ts
//
// รวมฉลากเป็น PDF ให้โรงงานพิมพ์ — server only · ทุกไฟล์มีฉลากขนาดเดียว (ขนาดอื่นแยกไฟล์)
//   single = หน้าละ 1 ดวง ขนาดหน้า = ขนาดดวง ครบตามจำนวน (เครื่องพิมพ์สติ๊กเกอร์ม้วน)
//   sheet  = กระดาษ A4 เรียงหลายดวง ครบตามจำนวน + เส้นตัดที่มุม
//   master = 1 หน้าต่อรหัส (โรงงานตั้งจำนวนพิมพ์เองจากตารางในหน้าแชร์)
// ฉลากแต่ละแบบเขียนเป็นคำสั่ง PDF ตรง ๆ (ไม่ผ่าน drawSvgPath ของ pdf-lib — ช้าและกินแรม 1.6 GB
// ตอนลอง 170 แบบ) บีบอัดแล้วเก็บเป็น Form XObject ครั้งเดียว วางซ้ำได้ → 15,000 หน้าก็ยังเล็ก

import {
  PDFDocument, PDFName, StandardFonts, rgb, type PDFRef,
  concatTransformationMatrix, drawObject, popGraphicsState, pushGraphicsState,
} from 'pdf-lib'
import { glyphPath, renderLabel } from './render'
import { ICON03_BLACK, ICON03_RED } from './icon03'
import { TIS_SYMBOL } from './tisMark'
import type { LabelData } from './types'

export type PdfMode = 'single' | 'sheet' | 'master'

const MM = 72 / 25.4 // points per mm
const A4 = { w: 210, h: 297 }
const SHEET_MARGIN = 8
const SHEET_GAP = 4

const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString()

/** SVG path (mm, y down; M L H V C Q Z, absolute or relative) → PDF path operators + fill */
function pathToOps(d: string): string {
  const out: string[] = []
  let x = 0, y = 0, sx = 0, sy = 0
  for (const [, cmd, args] of d.matchAll(/([MLHVCQZmlhvcqz])([^MLHVCQZmlhvcqz]*)/g)) {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : []
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    if (C === 'Z') { out.push('h'); x = sx; y = sy; continue }
    const step = C === 'C' ? 6 : C === 'Q' ? 4 : C === 'H' || C === 'V' ? 1 : 2
    for (let i = 0; i + step <= n.length; i += step) {
      const a = n.slice(i, i + step)
      const ax = (v: number) => (rel ? x + v : v)
      const ay = (v: number) => (rel ? y + v : v)
      if (C === 'M' && i === 0) { x = ax(a[0]); y = ay(a[1]); sx = x; sy = y; out.push(`${f3(x)} ${f3(y)} m`) }
      else if (C === 'M' || C === 'L') { x = ax(a[0]); y = ay(a[1]); out.push(`${f3(x)} ${f3(y)} l`) }
      else if (C === 'H') { x = ax(a[0]); out.push(`${f3(x)} ${f3(y)} l`) }
      else if (C === 'V') { y = ay(a[0]); out.push(`${f3(x)} ${f3(y)} l`) }
      else if (C === 'C') {
        const p = [ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3]), ax(a[4]), ay(a[5])]
        out.push(`${p.map(f3).join(' ')} c`); x = p[4]; y = p[5]
      } else {
        // quadratic → cubic
        const qx = ax(a[0]), qy = ay(a[1]), ex = ax(a[2]), ey = ay(a[3])
        const c1x = x + (2 / 3) * (qx - x), c1y = y + (2 / 3) * (qy - y)
        const c2x = ex + (2 / 3) * (qx - ex), c2y = ey + (2 / 3) * (qy - ey)
        out.push(`${f3(c1x)} ${f3(c1y)} ${f3(c2x)} ${f3(c2y)} ${f3(ex)} ${f3(ey)} c`); x = ex; y = ey
      }
    }
  }
  out.push('f')
  return out.join('\n')
}

export async function buildLabelPdf(
  items: { label: LabelData; copies: number }[],
  mode: PdfMode,
  title: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.setCreator('AGD label system')
  if (!items.length) return doc.save()

  const { w, h } = items[0].label

  // shared pieces: one Form XObject per glyph used + the TIS symbol, in one Resources dict
  const ctx = doc.context
  const xobjects = ctx.obj({})
  const resources = ctx.register(ctx.obj({ XObject: xobjects }))
  const form = (ops: string, bbox: number[], res?: PDFRef) =>
    ctx.register(ctx.flateStream(ops, { Type: 'XObject', Subtype: 'Form', BBox: bbox, ...(res ? { Resources: res } : {}) }))
  xobjects.set(PDFName.of('T'), form(pathToOps(TIS_SYMBOL), [0, 0, 1000, 1000]))
  xobjects.set(PDFName.of('I'), form(pathToOps(ICON03_BLACK), [0, 0, 1000, 1000]))
  const glyphNames = new Set<string>()

  // every distinct label once, as a Form XObject in mm with y flipped (0,0 = its bottom-left)
  const forms: PDFRef[] = []
  for (const it of items) {
    const r = await renderLabel(it.label)
    const ops = [`${f3(MM)} 0 0 ${f3(-MM)} 0 ${f3(h * MM)} cm`, '0 g', pathToOps(r.d)]
    ops.push(`q ${f3(r.tis.u)} 0 0 ${f3(r.tis.u)} ${f3(r.tis.x)} ${f3(r.tis.y)} cm /T Do Q`)
    if (r.icon03) {
      const i = r.icon03
      ops.push(`q ${ICON03_RED.join(' ')} rg`, pathToOps(i.red), 'Q')
      ops.push(`q ${f3(i.u)} 0 0 ${f3(i.u)} ${f3(i.x)} ${f3(i.y)} cm /I Do Q`)
    }
    for (const g of r.glyphs) {
      const name = `G${g.f}_${g.g}`
      if (!glyphNames.has(name)) {
        glyphNames.add(name)
        xobjects.set(PDFName.of(name), form(pathToOps(await glyphPath(g.f, g.g)), [-3000, -3000, 6000, 6000]))
      }
      // glyphs are y-up in font units; the label space is y-down → flip back
      ops.push(`q ${f3(g.k)} 0 0 ${f3(-g.k)} ${f3(g.x)} ${f3(g.y)} cm /${name} Do Q`)
    }
    forms.push(form(ops.join('\n'), [0, 0, w * MM, h * MM], resources))
  }
  const place = (page: ReturnType<typeof doc.addPage>, i: number, x: number, y: number) => {
    const name = page.node.newXObject('L', forms[i])
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(1, 0, 0, 1, x, y), drawObject(name), popGraphicsState())
  }

  if (mode === 'master' || mode === 'single') {
    items.forEach((it, i) => {
      const n = mode === 'master' ? 1 : it.copies
      for (let c = 0; c < n; c++) place(doc.addPage([w * MM, h * MM]), i, 0, 0)
    })
    return doc.save({ useObjectStreams: true })
  }

  // sheet: fill A4 row by row, labels in item order
  const cols = Math.max(1, Math.floor((A4.w - 2 * SHEET_MARGIN + SHEET_GAP) / (w + SHEET_GAP)))
  const rows = Math.max(1, Math.floor((A4.h - 2 * SHEET_MARGIN - 4 + SHEET_GAP) / (h + SHEET_GAP)))
  const per = cols * rows
  const ox = (A4.w - (cols * w + (cols - 1) * SHEET_GAP)) / 2
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const total = items.reduce((s, it) => s + it.copies, 0)
  const sheets = Math.ceil(total / per)

  let page = null as ReturnType<typeof doc.addPage> | null
  let slot = 0
  let sheetNo = 0
  const grey = rgb(0.6, 0.6, 0.6)
  for (let i = 0; i < items.length; i++) {
    for (let c = 0; c < items[i].copies; c++) {
      if (!page || slot === per) {
        page = doc.addPage([A4.w * MM, A4.h * MM])
        slot = 0
        sheetNo++
        page.drawText(`${title} · ${w}x${h} mm · ${sheetNo}/${sheets}`, {
          x: SHEET_MARGIN * MM, y: (SHEET_MARGIN / 2) * MM, size: 6, font, color: grey,
        })
      }
      const cx = ox + (slot % cols) * (w + SHEET_GAP)
      const cy = SHEET_MARGIN + Math.floor(slot / cols) * (h + SHEET_GAP) // from top
      const x = cx * MM
      const y = (A4.h - cy - h) * MM
      place(page, i, x, y)
      // crop marks in the gap, 1.5 mm, outside each corner
      const L = 1.5 * MM
      const t = 0.3
      for (const [px, py] of [[x, y], [x + w * MM, y], [x, y + h * MM], [x + w * MM, y + h * MM]]) {
        const sx = px === x ? -1 : 1
        const sy = py === y ? -1 : 1
        page.drawLine({ start: { x: px + sx * 0.5, y: py }, end: { x: px + sx * (0.5 + L), y: py }, thickness: t, color: grey })
        page.drawLine({ start: { x: px, y: py + sy * 0.5 }, end: { x: px, y: py + sy * (0.5 + L) }, thickness: t, color: grey })
      }
      slot++
    }
  }
  return doc.save({ useObjectStreams: true })
}
