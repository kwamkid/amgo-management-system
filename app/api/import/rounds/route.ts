// รายการรอบสั่งของ — หน้า public/order-plan เรียก (แทน /api/rounds ของ serve.mjs เดิม)
import { NextResponse } from 'next/server'
import { importGuard, listRounds } from '@/lib/services/import/importServer'

export async function GET() {
  const ctx = await importGuard()
  if (ctx instanceof NextResponse) return ctx
  try {
    return NextResponse.json(await listRounds(ctx.sb))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
