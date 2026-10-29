// ราคาขายจริงบนชั้นใน aoocommerce (?brand=) — ผลเหมือน aooPrices() ใน serve.mjs เดิม
// เรียกผ่าน MCP ของ aoo (เครื่องมือ stock · กุญแจอ่านอย่างเดียว บริษัทเดียว) แทนกุญแจหลักของฐานข้อมูล
// (เจ้าของ 30 ต.ค. 69) · กุญแจ AOO_MCP_KEY อยู่ฝั่ง server เท่านั้น · ไม่ตั้ง = ไม่มีราคา aoo (หน้าใช้ SRP แทน)
import { NextRequest, NextResponse } from 'next/server'
import { importGuard } from '@/lib/services/import/importServer'

const AOO_MCP_URL = process.env.AOO_MCP_URL || 'https://app.aoocommerce.com/api/mcp'

const CACHE = new Map<string, { at: number; prices: Record<string, { price: number; discount: number }> }>()

type StockRow = { sku: string | null; barcode: string | null; price: number | null; discount_price: number | null }

export async function GET(req: NextRequest) {
  const ctx = await importGuard()
  if (ctx instanceof NextResponse) return ctx
  const key = process.env.AOO_MCP_KEY
  if (!key) return NextResponse.json({ prices: {}, error: 'ยังไม่ได้ตั้งกุญแจ MCP ของ aoo' })
  const brand = req.nextUrl.searchParams.get('brand') ?? ''
  // shelf prices change rarely — keep them 10 min per server instance (each page open used to call aoo)
  const hit = CACHE.get(brand)
  if (hit && Date.now() - hit.at < 600_000) return NextResponse.json({ prices: hit.prices })

  const res = await fetch(AOO_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'stock', arguments: { brands: [brand], include_zero: true, limit: 2000 } },
    }),
    cache: 'no-store',
  })
  if (!res.ok) return NextResponse.json({ prices: {}, error: `aoo MCP ${res.status}` })
  const body = (await res.json()) as { result?: { content?: { text?: string }[]; isError?: boolean } }
  const text = body.result?.content?.[0]?.text
  if (!text || body.result?.isError) return NextResponse.json({ prices: {}, error: text ?? 'aoo MCP ไม่ตอบ' })

  const prices: Record<string, { price: number; discount: number }> = {}
  for (const r of JSON.parse(text) as StockRow[]) {
    if (!(Number(r.price) > 0)) continue
    const p = { price: Number(r.price), discount: Number(r.discount_price) || 0 }
    const sku = String(r.sku || '').trim().toUpperCase().replace(/^00-[A-Z]+-/, '')
    for (const k of [String(r.barcode || '').trim(), sku]) if (k && !prices[k]) prices[k] = p
  }
  CACHE.set(brand, { at: Date.now(), prices })
  return NextResponse.json({ prices })
}
