// ราคาขายจริงบนชั้นใน aoocommerce (?brand=) — ยกมาจาก aooPrices() ใน serve.mjs
// กุญแจ aoo อยู่ใน env ฝั่ง server เท่านั้น (AOO_SUPABASE_URL / AOO_SUPABASE_SECRET_KEY) · ไม่ตั้ง = ไม่มีราคา aoo
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { importGuard } from '@/lib/services/import/importServer'

export async function GET(req: NextRequest) {
  const ctx = await importGuard()
  if (ctx instanceof NextResponse) return ctx
  const url = process.env.AOO_SUPABASE_URL
  const key = process.env.AOO_SUPABASE_SECRET_KEY
  if (!url || !key) return NextResponse.json({ prices: {}, error: 'ยังไม่ได้ตั้งกุญแจ aoocommerce' })
  const aoo = createClient(url, key, { auth: { persistSession: false } })
  const name = req.nextUrl.searchParams.get('brand') ?? ''
  const { data: brands } = await aoo.from('product_brands').select('id').ilike('name', name)
  if (!brands?.length) return NextResponse.json({ prices: {} })
  const prices: Record<string, { price: number; discount: number }> = {}
  for (let from = 0; ; from += 1000) {
    const { data, error } = await aoo
      .from('products_with_variations')
      .select('sku, barcode, default_price, discount_price')
      .is('variation_deleted_at', null)
      .gt('default_price', 0)
      .in('brand_id', brands.map((b) => b.id))
      .range(from, from + 999)
    if (error) return NextResponse.json({ prices, error: error.message })
    for (const r of data ?? []) {
      const p = { price: Number(r.default_price), discount: Number(r.discount_price) || 0 }
      const sku = String(r.sku || '').trim().toUpperCase().replace(/^00-[A-Z]+-/, '')
      for (const k of [String(r.barcode || '').trim(), sku]) if (k && !prices[k]) prices[k] = p
    }
    if ((data ?? []).length < 1000) break
  }
  return NextResponse.json({ prices })
}
