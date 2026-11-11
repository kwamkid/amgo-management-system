// รอบเดียว (?p=<slug>) — GET คืนรูปแบบ plan.json · PUT รับ plan ทั้งก้อนจากหน้าแล้วเก็บเฉพาะที่แก้ได้
import { NextRequest, NextResponse } from 'next/server'
import { getPlan, importGuard, roundRights, savePlan } from '@/lib/services/import/importServer'

export async function GET(req: NextRequest) {
  const ctx = await importGuard()
  if (ctx instanceof NextResponse) return ctx
  const slug = req.nextUrl.searchParams.get('p') ?? ''
  try {
    const plan = await getPlan(ctx.sb, slug, ctx)
    return plan ? NextResponse.json(plan) : NextResponse.json({ error: 'not found' }, { status: 404 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const ctx = await importGuard()
  if (ctx instanceof NextResponse) return ctx
  const slug = req.nextUrl.searchParams.get('p') ?? ''
  if (!ctx.canEdit) {
    // เจ้าของแบรนด์ (SRP editor) แก้รอบของแบรนด์ตัวเองได้ — RLS import_round_editable คุมซ้ำ
    const { data: r } = await ctx.sb.from('import_rounds').select('brand, srp_brand').eq('slug', slug).maybeSingle()
    if (!r || !roundRights(ctx, r).canEdit) return NextResponse.json({ error: 'แก้ไม่ได้ — สิทธิ์ดูอย่างเดียว' }, { status: 403 })
  }
  try {
    const changed = await savePlan(ctx.sb, slug, await req.json())
    return NextResponse.json({ ok: true, changed, updated: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
