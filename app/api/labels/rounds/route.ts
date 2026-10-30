// รายการรอบสั่งของสำหรับหน้าเลือกรอบของฉลาก — ตู้ · วันถึง · จำนวนรหัส/ดวง · พร้อมกี่รหัส · แชร์แล้วหรือยัง
import { NextResponse } from 'next/server'
import { loadRoundLabels } from '@/lib/labels/resolve'
import { labelGuard } from '@/lib/labels/server'

export async function GET() {
  const ctx = await labelGuard()
  if (ctx instanceof NextResponse) return ctx
  const { data: rounds } = await ctx.sb.from('import_rounds').select('id').order('arrive', { ascending: false })
  const out = []
  for (const { id } of rounds ?? []) {
    const rl = await loadRoundLabels(ctx.sb, { id })
    if (!rl) continue
    const lines = rl.lines.filter((l) => !l.skip)
    out.push({
      slug: rl.round.slug,
      name: rl.round.name,
      brand: rl.round.brand,
      arrive: rl.round.arrive,
      status: rl.round.status,
      parts: rl.parts.map((p) => p.name),
      lines: lines.length,
      copies: lines.reduce((s, l) => s + l.copies, 0),
      missing: lines.filter((l) => l.missing.length).length,
      shared: !!rl.settings.share_token,
    })
  }
  return NextResponse.json(out)
}
