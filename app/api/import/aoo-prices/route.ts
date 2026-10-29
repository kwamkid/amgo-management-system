// ราคาขายจริงบนชั้นใน aoocommerce (?brand=) — ผ่าน MCP ของ aoo (ดู aooPrices ใน importServer)
// หน้าได้ราคาชุดแรกมากับ /api/import/plan แล้ว — route นี้ใช้ตอนดึงราคาใหม่ (สลับกลับมาที่หน้าเกิน 10 นาที)
import { NextRequest, NextResponse } from 'next/server'
import { aooPrices, importGuard } from '@/lib/services/import/importServer'

export async function GET(req: NextRequest) {
  const ctx = await importGuard()
  if (ctx instanceof NextResponse) return ctx
  return NextResponse.json(await aooPrices(req.nextUrl.searchParams.get('brand') ?? ''))
}
