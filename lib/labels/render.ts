// lib/labels/render.ts
//
// วาดฉลาก สคบ. 1 ดวงเป็น "เส้นเวกเตอร์ล้วน" (ตัวหนังสือแปลงเป็นเส้นแล้ว) — server only
// ทำไมไม่ใช้ฟอนต์ใน PDF ตรง ๆ: pdf-lib วางสระ/วรรณยุกต์ไทยไม่เป็น (ไม่มี shaping) ตัวจะซ้อนกัน
// → จัดตัวอักษรด้วย HarfBuzz (ตัวเดียวกับเบราว์เซอร์) แล้วเอา outline ของแต่ละ glyph มาเป็น path
// ผลคือโรงงานเปิดไฟล์ที่ไหนก็เหมือนกันทุกเครื่อง ไม่ต้องมีฟอนต์ไทย
//
// ผลลัพธ์ = ตำแหน่ง glyph (รูปตัวอักษรเก็บครั้งเดียวต่อไฟล์ ใช้ซ้ำ) + path ของวงแหวน/QR + ตำแหน่งโลโก้
// หน่วยมิลลิเมตร แกน y ชี้ลง · ระบายดำทั้งหมด (nonzero)
// เลย์เอาต์ยึดตามสติ๊กเกอร์ตัวอย่างของเจ้าของ (01-AGD/สคบ/*.png = 50×50 มม.)

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import QRCode from 'qrcode'
import { ICON03_BLACK, ICON03_RED, ICON03_RING } from './icon03'
import { TIS_RING, TIS_SYMBOL } from './tisMark'
import type { LabelData, LabelFit } from './types'

type HB = typeof import('harfbuzzjs')
type HbFont = InstanceType<HB['Font']>

interface FontPair { thai: HbFont; latin: HbFont; upemThai: number; upemLatin: number; thaiId: number; latinId: number }
interface Fonts { hb: HB; regular: FontPair; bold: FontPair; byId: HbFont[] }

let fontsP: Promise<Fonts> | null = null

/** fonts + wasm load once per server instance */
function loadFonts(): Promise<Fonts> {
  fontsP ??= (async () => {
    const hb = await import('harfbuzzjs')
    const dir = join(process.cwd(), 'lib/labels/fonts')
    const font = async (file: string) => {
      const face = new hb.Face(new hb.Blob(await readFile(join(dir, file))))
      return { font: new hb.Font(face), upem: face.upem }
    }
    const pair = async (w: 'Regular' | 'Bold', id: number): Promise<FontPair> => {
      const [t, l] = await Promise.all([font(`NotoSansThai-${w}.ttf`), font(`NotoSansLatin-${w}.ttf`)])
      return { thai: t.font, latin: l.font, upemThai: t.upem, upemLatin: l.upem, thaiId: id, latinId: id + 1 }
    }
    const [regular, bold] = await Promise.all([pair('Regular', 0), pair('Bold', 2)])
    return { hb, regular, bold, byId: [regular.thai, regular.latin, bold.thai, bold.latin] }
  })()
  return fontsP
}

const PT = 25.4 / 72 // mm per point
const n3 = (v: number) => (Math.round(v * 1000) / 1000).toString()

// ── path helpers ───────────────────────────────────────────────────────────
/** scale + move an SVG path (M L Q C Z absolute, m l q c z relative) */
function mapPath(d: string, sx: number, sy: number, tx: number, ty: number): string {
  let out = ''
  for (const [, cmd, args] of d.matchAll(/([MLQCZmlqcz])([^MLQCZmlqcz]*)/g)) {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : []
    const rel = cmd === cmd.toLowerCase()
    out += cmd + n.map((v, i) => n3(i % 2 === 0 ? v * sx + (rel ? 0 : tx) : v * sy + (rel ? 0 : ty))).join(' ')
  }
  return out
}

/** circle as 4 cubic curves; cw = false draws the other way (a hole under nonzero fill) */
function circle(cx: number, cy: number, r: number, cw = true): string {
  const k = r * 0.5523
  const s = cw ? 1 : -1
  return (
    `M${n3(cx + r)} ${n3(cy)}` +
    `C${n3(cx + r)} ${n3(cy + s * k)} ${n3(cx + k)} ${n3(cy + s * r)} ${n3(cx)} ${n3(cy + s * r)}` +
    `C${n3(cx - k)} ${n3(cy + s * r)} ${n3(cx - r)} ${n3(cy + s * k)} ${n3(cx - r)} ${n3(cy)}` +
    `C${n3(cx - r)} ${n3(cy - s * k)} ${n3(cx - k)} ${n3(cy - s * r)} ${n3(cx)} ${n3(cy - s * r)}` +
    `C${n3(cx + k)} ${n3(cy - s * r)} ${n3(cx + r)} ${n3(cy - s * k)} ${n3(cx + r)} ${n3(cy)}Z`
  )
}

// ── text ───────────────────────────────────────────────────────────────────
const isThai = (ch: string) => /[฀-๿]/.test(ch)

/** split into runs: Thai letters → Thai font, the rest → Latin font (spaces follow the run before) */
function runs(text: string): { text: string; thai: boolean }[] {
  const out: { text: string; thai: boolean }[] = []
  for (const ch of text) {
    const thai = ch === ' ' && out.length ? out[out.length - 1].thai : isThai(ch)
    const last = out[out.length - 1]
    if (last && last.thai === thai) last.text += ch
    else out.push({ text: ch, thai })
  }
  return out
}

/** text widths in em, shared by all labels (most lines repeat label to label) */
const widthCache = new Map<string, number>()

/** compounds the ICU dictionary splits but a label must not break ("อุด|ตัน" looked wrong — owner 30 Oct) */
const NO_BREAK = ['อุดตัน', 'ทางเดินหายใจ', 'ผู้ปกครอง', 'ต่ำกว่า', 'ขึ้นไป', 'แรกเกิด', 'เสริมพัฒนาการ']
const UNIT = /^(เดือน|ปี|บาท|ชิ้น|ซม\.?|มม\.?)$/

/** merge segments: listed compounds, and a number with its unit ("18 เดือน", "290 บาท") */
function keepTogether(seg: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < seg.length; i++) {
    let cur = seg[i]
    // longest listed compound starting here
    let joined = cur
    for (let j = i + 1; j < seg.length && joined.length < 16; j++) {
      joined += seg[j]
      if (NO_BREAK.includes(joined)) { cur = joined; i = j }
    }
    // number + space + unit
    if (/^\d[\d,.]*$/.test(cur) && seg[i + 1] === ' ' && UNIT.test(seg[i + 2] ?? '')) {
      cur += ' ' + seg[i + 2]
      i += 2
    }
    out.push(cur)
  }
  return out
}

class Typesetter {
  private f: Fonts
  constructor(f: Fonts) {
    this.f = f
  }

  private shapeRun(text: string, thai: boolean, pair: FontPair) {
    const { hb } = this.f
    const font = thai ? pair.thai : pair.latin
    const buf = new hb.Buffer()
    buf.addText(text)
    buf.guessSegmentProperties()
    if (thai) buf.setLanguage('th')
    hb.shape(font, buf)
    const infos = buf.getGlyphInfos()
    const pos = buf.getGlyphPositions()
    return { font, id: thai ? pair.thaiId : pair.latinId, upem: thai ? pair.upemThai : pair.upemLatin, infos, pos }
  }

  /** width in mm */
  width(text: string, bold: boolean, sizeMm: number): number {
    const key = `${bold ? 1 : 0}|${text}`
    let units = widthCache.get(key)
    if (units == null) {
      units = 0
      for (const r of runs(text)) {
        const s = this.shapeRun(r.text, r.thai, bold ? this.f.bold : this.f.regular)
        for (const p of s.pos) units += p.xAdvance / s.upem
      }
      if (widthCache.size > 50000) widthCache.clear()
      widthCache.set(key, units)
    }
    return units * sizeMm
  }

  /** glyph placements for a text, baseline at (x, y) */
  draw(text: string, bold: boolean, sizeMm: number, x: number, y: number, out: Glyph[]) {
    let pen = x
    for (const r of runs(text)) {
      const s = this.shapeRun(r.text, r.thai, bold ? this.f.bold : this.f.regular)
      const k = sizeMm / s.upem
      s.infos.forEach((g, i) => {
        const p = s.pos[i]
        if (g.codepoint) out.push({ f: s.id, g: g.codepoint, x: pen + p.xOffset * k, y: y - p.yOffset * k, k })
        pen += p.xAdvance * k
      })
    }
  }

  /** word-wrap; Thai has no spaces between words → Intl.Segmenter (ICU dictionary) */
  wrap(text: string, bold: boolean, sizeMm: number, maxW: (lineIndex: number) => number): string[] {
    const words = keepTogether([...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map((s) => s.segment))
    const lines: string[] = []
    let cur = ''
    const push = () => { lines.push(cur.trimEnd()); cur = '' }
    for (const w of words) {
      if (!cur && !w.trim()) continue
      if (this.width(cur + w, bold, sizeMm) <= maxW(lines.length)) { cur += w; continue }
      if (cur) push()
      if (!w.trim()) continue
      // one word wider than the line → break between grapheme clusters
      if (this.width(w, bold, sizeMm) > maxW(lines.length)) {
        for (const { segment: g } of new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(w)) {
          if (cur && this.width(cur + g, bold, sizeMm) > maxW(lines.length)) push()
          cur += g
        }
      } else cur = w
    }
    if (cur.trim()) push()
    return lines
  }
}

// ── layout ─────────────────────────────────────────────────────────────────
/** big = header · warn = warning/age: bold, 1.45× the body so they stay readable (owner 30 Oct: "ใหญ่กว่าตัวอื่น อ่านรู้เรื่อง") */
interface Para { text: string; bold?: boolean; big?: boolean; warn?: boolean }

const paragraphs = (l: LabelData): Para[] => {
  const p: Para[] = []
  if (l.header) p.push({ text: l.header, big: true })
  p.push({ text: `รหัส : ${l.code}` })
  if (l.typeTh) p.push({ text: `ชื่อสินค้า : ${l.typeTh}` })
  if (l.warning) p.push({ text: `คำเตือน : ${l.warning}`, bold: true, warn: true })
  if (l.age) p.push({ text: `อายุผู้เล่น : ${l.age}`, bold: true, warn: true })
  if (l.usage) p.push({ text: `วิธีการใช้ : ${l.usage}` })
  if (l.manufacturer) p.push({ text: `ผู้ผลิต : ${l.manufacturer}` })
  if (l.country) p.push({ text: `ประเทศผู้ผลิต : ${l.country}` })
  if (l.importMonth) p.push({ text: `เดือน ปี นำเข้า : ${l.importMonth}` })
  if (l.importer) p.push({ text: `นำเข้าและจัดจำหน่ายโดย : ${l.importer}` })
  if (l.address) p.push({ text: l.address })
  if (l.contact) p.push({ text: l.contact })
  return p
}

const priceText = (l: LabelData) => (l.price != null && l.price > 0 ? `ราคา : ${l.price.toLocaleString('en-US')} บาท` : 'ราคา : ……… บาท')

/** glyph g of font f (0 Thai · 1 Latin · 2 Thai bold · 3 Latin bold), font units scaled by k, origin (x, y) */
export interface Glyph { f: number; g: number; x: number; y: number; k: number }

export interface LabelDrawing extends LabelFit {
  w: number
  h: number
  glyphs: Glyph[]
  /** TIS symbol (TIS_SYMBOL, 0..1000 space) at x, y scaled by u */
  tis: { x: number; y: number; u: number }
  /** ring + QR, mm, nonzero fill */
  d: string
  /** 'not under 3' pictogram: red ring + slash (mm path) and the black face (ICON03_BLACK at x, y scaled by u) */
  icon03: { x: number; y: number; u: number; red: string } | null
}

/** glyph outline in font units, y up (cached) */
const glyphCache = new Map<string, string>()
export async function glyphPath(f: number, g: number): Promise<string> {
  const key = `${f}:${g}`
  let p = glyphCache.get(key)
  if (p == null) {
    p = (await loadFonts()).byId[f].glyphToPath(g)
    glyphCache.set(key, p)
  }
  return p
}

// sample body ≈ 4.8–5 pt at 50×50 with every field filled; labels with less text grow up to this
// (owner 30 Oct: 5.5 pt looked too small with empty space left)
const START_PT = 7
// 3×3 cm labels (owner 30 Oct) need ~2.3 pt body with every field filled — printable on a 300 dpi label printer
const FLOOR_PT = 2.2

/**
 * Lay the label out at the largest body size that fits (header = 1.45×, line = 1.42×).
 * Bottom-right block = TIS mark + QR with the standard text under them; price sits left of it.
 */
export async function renderLabel(l: LabelData): Promise<LabelDrawing> {
  const ts = new Typesetter(await loadFonts())
  const { w, h } = l
  const k = Math.min(w, h) / 50
  const m = Math.max(1.2, 1.8 * k)

  // bottom block, sized off the sample (10 mm mark + 10 mm QR at 50×50) but never under 8 mm
  // floor 6 mm (QR modules ≈ 0.21 mm at 3×3 — the page warns below 0.25 mm)
  const sym = Math.min(Math.max(10 * k, 6), h * 0.32, (w - 2 * m) * 0.3)
  const gap = Math.max(0.8, 1.1 * k)
  const caption = [l.tisText, l.showLicense && l.tisLicense ? `ใบอนุญาต ${l.tisLicense}` : ''].filter(Boolean)

  // QR: medium error correction unless the modules get too small, then low
  let qr = QRCode.create(l.qrUrl || ' ', { errorCorrectionLevel: 'M' })
  if (sym / qr.modules.size < 0.25) qr = QRCode.create(l.qrUrl || ' ', { errorCorrectionLevel: 'L' })
  // the QR never goes under 0.26 mm/module (3×3 at 6 mm didn't scan on a 203 dpi printer) — it may outgrow the mark
  const qrS = Math.max(sym, 0.26 * qr.modules.size)
  const qrModule = qrS / qr.modules.size

  const paras = paragraphs(l)
  const price = priceText(l)
  const iconS = l.icon03 ? Math.min(Math.max(10 * k, 5), h * 0.28) : 0
  const iconX = w - m - iconS

  for (let pt = START_PT; ; pt = Math.round((pt - 0.1) * 10) / 10) {
    const s = pt * PT
    const lh = s * 1.42
    const asc = s * 1.02

    // TIS text under the block: smaller than the body, right-aligned (owner 30 Oct)
    const capS = Math.min(s * 0.8, 4.2 * PT * k)
    const capLh = capS * 1.35
    const blockW = sym + gap + qrS
    const blockX = w - m - blockW
    const symBottom = h - m - caption.length * capLh - 0.3
    const symTop = symBottom - qrS // top of the mark + QR block (QR is the taller one)
    // wide labels: the block fills the right side, so the price can drop to the bottom edge
    const priceBase = w > h * 1.3 ? h - m - s * 0.3 : symTop + qrS * 0.62
    const flowEnd = priceBase - asc - s * 0.35
    const fullW = w - 2 * m
    const narrowW = blockX - m - 1
    const bigS = Math.min(s * 1.4, 8.5 * PT * k)
    // the 0-3 pictogram sits in the top-right corner (owner 30 Oct); lines beside it get shorter
    const iconTop = m
    const iconW = iconX - m - 1

    // flow paragraphs top-down; lines whose box reaches the block (or the pictogram) get a narrow width
    let y = m
    const lines: { text: string; bold: boolean; size: number; base: number }[] = []
    for (const p of paras) {
      const size = p.big ? bigS : p.warn ? s * 1.45 : s
      // line pitch 1.32× (was 1.42 — the 1.45× warning pushed 41 C1 labels under 4.5 pt) · Thai marks still clear
      const plh = p.big ? size * 1.3 : size * (p.warn ? 1.28 : 1.32)
      const maxW = (i: number) => {
        const top = y + i * plh
        const bottom = top + plh
        if (bottom > symTop - 0.4) return narrowW
        if (iconS && bottom > iconTop - 0.3 && top < iconTop + iconS + 0.3) return Math.min(fullW, iconW)
        return fullW
      }
      const wrapped = ts.wrap(p.text, !!p.bold, size, maxW)
      for (const t of wrapped) {
        lines.push({ text: t, bold: !!p.bold, size, base: y + size * 1.02 })
        y += plh
      }
      if (p.big) y += s * 0.45
    }

    const fits = y <= flowEnd + 0.01
    if (!fits && pt > FLOOR_PT) continue

    let d = ''
    const glyphs: Glyph[] = []
    for (const ln of lines) ts.draw(ln.text, ln.bold, ln.size, m, ln.base, glyphs)
    ts.draw(price, false, s, m, priceBase, glyphs)

    // TIS mark: true circle ring + traced symbol
    const u = sym / 1000
    const cx = blockX + sym / 2
    const cy = symTop + qrS / 2
    const ro = (TIS_RING.r + TIS_RING.width / 2) * u
    const ri = (TIS_RING.r - TIS_RING.width / 2) * u
    d += circle(cx, cy, ro, true) + circle(cx, cy, ri, false)

    // QR modules as squares (each row merged into runs)
    const qx = blockX + sym + gap
    const n = qr.modules.size
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; ) {
        if (!qr.modules.get(r, c)) { c++; continue }
        let e = c
        while (e < n && qr.modules.get(r, e)) e++
        const x0 = qx + c * qrModule
        const y0 = symTop + r * qrModule
        d += `M${n3(x0)} ${n3(y0)}H${n3(qx + e * qrModule)}V${n3(y0 + qrModule)}H${n3(x0)}Z`
        c = e
      }
    }

    // caption centred under the block
    caption.forEach((t, i) => {
      const tw = ts.width(t, false, capS)
      const x = Math.max(m, w - m - tw)
      ts.draw(t, false, capS, x, symBottom + 0.3 + capS * 1.02 + i * capLh, glyphs)
    })

    let icon03: LabelDrawing['icon03'] = null
    if (iconS) {
      const iu = iconS / 1000
      const icx = iconX + iconS / 2
      const icy = iconTop + iconS / 2
      const R = ICON03_RING
      let red = circle(icx, icy, (R.r + R.width / 2) * iu, true) + circle(icx, icy, (R.r - R.width / 2) * iu, false)
      // slash top-left → bottom-right across the inside of the ring
      const L = (R.r - R.width / 2 + 2) * iu
      const hw = (R.slash / 2) * iu
      const a = Math.SQRT1_2
      const pts = [[-L, -hw], [L, -hw], [L, hw], [-L, hw]].map(([p, q]) => [icx + p * a - q * a, icy + p * a + q * a])
      red += `M${pts.map(([x, y]) => `${n3(x)} ${n3(y)}`).join('L')}Z`
      icon03 = { x: iconX, y: iconTop, u: iu, red }
    }

    return { w, h, glyphs, tis: { x: blockX, y: cy - sym / 2, u }, d, icon03, bodyPt: pt, overflow: !fits, qrModule }
  }
}

const ICON03_HEX = `rgb(${ICON03_RED.map((v) => Math.round(v * 255)).join(',')})`

/** standalone SVG (preview on the review page) */
export async function toSvg(r: LabelDrawing, px = 300): Promise<string> {
  let d = r.d + mapPath(TIS_SYMBOL, r.tis.u, r.tis.u, r.tis.x, r.tis.y)
  if (r.icon03) d += mapPath(ICON03_BLACK, r.icon03.u, r.icon03.u, r.icon03.x, r.icon03.y)
  for (const g of r.glyphs) d += mapPath(await glyphPath(g.f, g.g), g.k, -g.k, g.x, g.y)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r.w} ${r.h}" width="${px}" height="${Math.round((px * r.h) / r.w)}">` +
    `<rect width="${r.w}" height="${r.h}" fill="#fff"/><path d="${d}" fill="#000"/>` +
    (r.icon03 ? `<path d="${r.icon03.red}" fill="${ICON03_HEX}"/>` : '') +
    '</svg>'
  )
}
