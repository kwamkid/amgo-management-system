// ไฟล์ PDF ฉลาก (?r=<slug> หรือ ?t=<token>, &size=50x50, &mode=single|sheet|master)
// ใช้เวลา ~1–5 วิ (15,000 ดวง ≈ 5 วิ · ทดสอบ 30 ต.ค. 69) — ตอบตรงเป็นไฟล์ ไม่ผ่านคิว เพราะไม่มีที่เก็บไฟล์
// (storage ใกล้เต็ม) และโรงงานกดดาวน์โหลดแล้วรอได้
//
// พิมพ์เอง (เจ้าของ 30 ต.ค. 69 — ใช้เครื่องพิมพ์ฉลากทีละดวง):
//   &qty=E2024:5,E2005:2  เลือกรหัส + จำนวนต่อรหัส (ไม่ใส่ = ทุกรหัสตามจำนวนสั่ง)
//   &as=50x30             พิมพ์ทุกดวงเป็นขนาดนี้ (ไม่ใส่ = ใช้ &size กรองเฉพาะดวงที่ตั้งขนาดนั้นไว้)
import { NextRequest, NextResponse } from 'next/server'
import { buildLabelPdf, type PdfMode } from '@/lib/labels/pdf'
import { linesOfSize } from '@/lib/labels/resolve'
import { roundFromRequest } from '@/lib/labels/server'
import { parseSize, sizeKey } from '@/lib/labels/types'

export const maxDuration = 60

const SIZE_RE = /^\d+(\.\d+)?x\d+(\.\d+)?$/

export async function GET(req: NextRequest) {
  const rl = await roundFromRequest(req)
  if (rl instanceof NextResponse) return rl
  const sp = req.nextUrl.searchParams
  const mode = (['single', 'sheet', 'master'].includes(sp.get('mode') ?? '') ? sp.get('mode') : 'sheet') as PdfMode

  const qty = new Map<string, number>()
  for (const part of (sp.get('qty') ?? '').split(',')) {
    const [code, n] = part.split(':').map((x) => x?.trim())
    if (code) qty.set(code, Math.min(Math.max(Math.floor(Number(n)) || 1, 1), 5000))
  }
  const as = SIZE_RE.test(sp.get('as') ?? '') ? parseSize(sp.get('as')) : null
  const size = as ? sizeKey(as.w, as.h) : sp.get('size') ?? '50x50'

  // with &as every picked line is redrawn at that size; otherwise only lines saved with &size
  const pool = as ? rl.lines.filter((l) => !l.skip) : linesOfSize(rl, size)
  const lines = pool.filter((l) => !qty.size || qty.has(l.code))
  if (!lines.length) return NextResponse.json({ error: 'no labels of this size' }, { status: 404 })

  const title = `${rl.round.name} — labels ${size} mm`
  let pdf: Uint8Array
  try {
    pdf = await buildLabelPdf(
      lines.map((l) => ({ label: as ? { ...l.label, ...as } : l.label, copies: qty.get(l.code) ?? l.copies })),
      mode,
      title,
    )
  } catch (e) {
    console.error('[labels/pdf]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const file = `${rl.round.slug}-labels-${size}mm-${mode}.pdf`
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${sp.get('dl') ? 'attachment' : 'inline'}; filename="${file}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
