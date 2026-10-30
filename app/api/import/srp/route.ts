// ราคาขายเราจาก SRP Calculator ของ amgo (?brand=) — ยกมาจาก srpPrices() ใน serve.mjs
// อ่านด้วย service role เพราะสิทธิ์ SRP เป็นรายแบรนด์ แต่คนในโมดูลนำเข้าต้องเห็นราคาทั้งรอบ
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { brandAllowed, importGuard } from '@/lib/services/import/importServer'

export async function GET(req: NextRequest) {
  const ctx = await importGuard()
  if (ctx instanceof NextResponse) return ctx
  const name = req.nextUrl.searchParams.get('brand') ?? ''
  if (!brandAllowed(ctx, name)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data: brand } = await admin
    .from('srp_brands')
    .select('id, name, usd_to_thb, eur_to_thb')
    .eq('name', name)
    .maybeSingle()
  if (!brand) return NextResponse.json({ brand: null, link: '/srp', prices: {} })
  const { data: rows, error } = await admin
    .from('srp_products')
    .select('sku, our_price_thb, platform_price_thb, last_edited_at')
    .eq('is_active', true)
    .eq('brand_id', brand.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const prices: Record<string, { ourPrice: number; platformPrice: number; edited: string | null }> = {}
  for (const r of rows ?? []) {
    const sku = String(r.sku || '').trim()
    if (sku)
      prices[sku] = {
        ourPrice: Number(r.our_price_thb) || 0,
        platformPrice: Number(r.platform_price_thb) || 0,
        edited: r.last_edited_at,
      }
  }
  return NextResponse.json({
    brand: brand.name,
    usdToThb: brand.usd_to_thb,
    eurToThb: brand.eur_to_thb,
    link: `/srp/${brand.id}`,
    prices,
  })
}
