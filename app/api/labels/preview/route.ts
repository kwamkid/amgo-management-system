// รูปตัวอย่างฉลาก 1 ดวงเป็น SVG (?r=<slug> หรือ ?t=<token>, &code=<รหัส>) — วาดด้วยตัวเดียวกับ PDF
import { NextRequest, NextResponse } from 'next/server'
import { renderLabel, toSvg } from '@/lib/labels/render'
import { roundFromRequest } from '@/lib/labels/server'

export async function GET(req: NextRequest) {
  const rl = await roundFromRequest(req)
  if (rl instanceof NextResponse) return rl
  const line = rl.lines.find((l) => l.code === req.nextUrl.searchParams.get('code'))
  if (!line) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const r = await renderLabel(line.label)
  return new NextResponse(await toSvg(r, 600), {
    headers: {
      'Content-Type': 'image/svg+xml',
      // short cache: the factory page tiles the same image ~15× in its A4 preview; edits show within a minute
      'Cache-Control': 'private, max-age=60',
      'X-Label-Pt': String(r.bodyPt),
      'X-Label-Overflow': String(r.overflow),
      'X-Label-Qr-Module': r.qrModule.toFixed(3),
    },
  })
}
