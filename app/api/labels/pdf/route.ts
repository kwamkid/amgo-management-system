// ไฟล์ PDF ส่งโรงงาน (?r=<slug> หรือ ?t=<token>, &size=50x50, &mode=single|sheet|master)
// ใช้เวลา ~1–5 วิ (15,000 ดวง ≈ 5 วิ · ทดสอบ 30 ต.ค. 69) — ตอบตรงเป็นไฟล์ ไม่ผ่านคิว เพราะไม่มีที่เก็บไฟล์
// (storage ใกล้เต็ม) และโรงงานกดดาวน์โหลดแล้วรอได้
import { NextRequest, NextResponse } from 'next/server'
import { buildLabelPdf, type PdfMode } from '@/lib/labels/pdf'
import { linesOfSize } from '@/lib/labels/resolve'
import { roundFromRequest } from '@/lib/labels/server'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const rl = await roundFromRequest(req)
  if (rl instanceof NextResponse) return rl
  const sp = req.nextUrl.searchParams
  const size = sp.get('size') ?? '50x50'
  const mode = (['single', 'sheet', 'master'].includes(sp.get('mode') ?? '') ? sp.get('mode') : 'sheet') as PdfMode
  const lines = linesOfSize(rl, size)
  if (!lines.length) return NextResponse.json({ error: 'no labels of this size' }, { status: 404 })

  const title = `${rl.round.name} — labels ${size} mm`
  const pdf = await buildLabelPdf(lines.map((l) => ({ label: l.label, copies: l.copies })), mode, title)
  const file = `${rl.round.slug}-labels-${size}mm-${mode}.pdf`
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${sp.get('dl') ? 'attachment' : 'inline'}; filename="${file}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
