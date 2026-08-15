// app/api/web/public/route.ts
//
// หน้าบ้านสำหรับ "เจ้าของเว็บ" (ไม่ต้องล็อกอิน) — ค้นเว็บตัวเอง + ดูบิลค้าง
//
//   GET ?q=abc          → รายชื่อเว็บที่ชื่อตรง (ต้องพิมพ์ ≥ 2 ตัว)
//   GET ?siteId=uuid    → บิลของเว็บนั้น
//
// ⚠️ ตาราง web_* ปิดด้วย RLS ให้เฉพาะเจ้าของเมนู — หน้าบ้านจึงต้องผ่าน route นี้
//    ที่ใช้สิทธิ์ระบบ แล้วคืนเฉพาะฟิลด์ที่จำเป็น (ไม่มี SSH/โน้ต/ข้อมูลติดต่อ)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const siteId = searchParams.get('siteId')
  const sb = createAdminClient()

  if (siteId) {
    const { data: site } = await sb
      .from('web_sites')
      .select('id, site_name, domain_self_registered')
      .eq('id', siteId)
      .eq('is_active', true)
      .maybeSingle()
    if (!site) return NextResponse.json({ error: 'ไม่พบเว็บนี้' }, { status: 404 })

    const { data: bills } = await sb
      .from('web_bills')
      .select('id, year, period_start, period_end, hosting_amount, domain_amount, bill_domain, status')
      .eq('site_id', siteId)
      .order('year', { ascending: false })

    return NextResponse.json({
      site: { id: site.id, siteName: site.site_name },
      bills: (bills ?? []).map((b) => ({
        id: b.id,
        year: b.year,
        periodStart: b.period_start,
        periodEnd: b.period_end,
        hostingAmount: Number(b.hosting_amount),
        domainAmount: Number(b.domain_amount),
        billDomain: b.bill_domain,
        status: b.status,
      })),
    })
  }

  // ค้นหา — สั้นกว่า 2 ตัวไม่คืนอะไร กันคนไล่ดูรายชื่อเว็บคนอื่นทั้งหมด
  if (q.length < 2) return NextResponse.json({ sites: [] })

  const { data } = await sb
    .from('web_sites')
    .select('id, site_name')
    .eq('is_active', true)
    .ilike('site_name', `%${q}%`)
    .order('site_name')
    .limit(10)

  return NextResponse.json({ sites: (data ?? []).map((s) => ({ id: s.id, siteName: s.site_name })) })
}
