// ฉลาก สคบ. ของรอบสั่งของ (?r=<slug>) — GET ข้อมูลทั้งรอบ (ค่าที่ไล่ชั้นแล้ว) · PUT ตั้งค่ารอบ / เปิด-ปิดลิงก์แชร์
import { NextRequest, NextResponse } from 'next/server'
import { renderLabel } from '@/lib/labels/render'
import { loadRoundLabels } from '@/lib/labels/resolve'
import { labelGuard, newShareToken } from '@/lib/labels/server'

export async function GET(req: NextRequest) {
  const ctx = await labelGuard()
  if (ctx instanceof NextResponse) return ctx
  try {
    const rl = await loadRoundLabels(ctx.sb, { slug: req.nextUrl.searchParams.get('r') ?? '' })
    if (!rl) return NextResponse.json({ error: 'not found' }, { status: 404 })
    // the page needs values/from/missing + how the text fitted, not the flattened label copy
    const lines = []
    for (const { label, ...l } of rl.lines) {
      const r = await renderLabel(label)
      lines.push({ ...l, size: `${label.w}x${label.h}`, fit: { bodyPt: r.bodyPt, overflow: r.overflow, qrModule: +r.qrModule.toFixed(3) } })
    }
    return NextResponse.json({ ...rl, lines, canEdit: ctx.canEdit })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

const MONTH_RE = /^(0[1-9]|1[0-2])\/\d{4}$/
const SIZE_RE = /^\d+(\.\d+)?x\d+(\.\d+)?$/

export async function PUT(req: NextRequest) {
  const ctx = await labelGuard(true)
  if (ctx instanceof NextResponse) return ctx
  const { data: round } = await ctx.sb.from('import_rounds').select('id').eq('slug', req.nextUrl.searchParams.get('r') ?? '').maybeSingle()
  if (!round) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const b = (await req.json()) as { import_month?: string | null; extra_pct?: number; default_size?: string; share?: boolean }
  const row: Record<string, unknown> = { round_id: round.id, updated_at: new Date().toISOString(), updated_by: ctx.userId }
  if (b.import_month !== undefined) {
    if (b.import_month && !MONTH_RE.test(b.import_month)) return NextResponse.json({ error: 'เดือนปีต้องเป็นแบบ 12/2026' }, { status: 400 })
    row.import_month = b.import_month || null
  }
  if (b.extra_pct !== undefined) row.extra_pct = Math.min(50, Math.max(0, Number(b.extra_pct) || 0))
  if (b.default_size !== undefined) {
    if (!SIZE_RE.test(b.default_size)) return NextResponse.json({ error: 'ขนาดต้องเป็นแบบ 50x50' }, { status: 400 })
    row.default_size = b.default_size
  }
  if (b.share === true) {
    const { data: cur } = await ctx.sb.from('label_rounds').select('share_token').eq('round_id', round.id).maybeSingle()
    if (!cur?.share_token) Object.assign(row, { share_token: newShareToken(), shared_at: new Date().toISOString(), shared_by: ctx.userId })
  }
  if (b.share === false) Object.assign(row, { share_token: null, shared_at: null, shared_by: null })

  const { error } = await ctx.sb.from('label_rounds').upsert(row as never)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
