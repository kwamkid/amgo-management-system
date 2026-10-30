// หน้าแชร์ให้โรงงาน (?t=<token>) — ไม่ต้องล็อกอิน · คืนเฉพาะที่โรงงานต้องใช้ (ไม่มีทุน/FOB)
import { NextRequest, NextResponse } from 'next/server'
import { sizeSummary } from '@/lib/labels/resolve'
import { roundByToken } from '@/lib/labels/server'

export async function GET(req: NextRequest) {
  const rl = await roundByToken(req.nextUrl.searchParams.get('t') ?? '')
  if (!rl) return NextResponse.json({ error: 'Link expired' }, { status: 404 })
  return NextResponse.json({
    name: rl.round.name.replace('ตู้ ', 'Container '), // the factory doesn't read Thai
    sharedAt: rl.settings.shared_at,
    sizes: sizeSummary(rl),
    lines: rl.lines.filter((l) => !l.skip).map((l) => ({ code: l.code, name: l.name, size: `${l.label.w}x${l.label.h}`, qty: l.qty, copies: l.copies })),
  })
}
