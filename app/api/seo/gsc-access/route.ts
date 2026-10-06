// app/api/seo/gsc-access/route.ts
//
// เช็คว่า service account เข้า GSC ของเว็บที่ลงทะเบียนไว้ได้ไหม
//
// GET — คืนอีเมล service account (ให้ก๊อปไปเพิ่มใน GSC) + property ที่มันเห็น
//       แล้วอัปเดต gsc_access ของทุกเว็บใน seo_sites ตามจริง
//       เว็บใหม่ที่ลืมเพิ่มสิทธิ์จะขึ้น "ไม่มีสิทธิ์" ทันที ไม่ต้องรอ cron พัง

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listProperties, serviceAccountEmail } from '@/lib/services/seo/gsc'
import { requireWebOwner } from '@/lib/services/seo/owner'

export async function GET() {
  if (!(await requireWebOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = serviceAccountEmail()
  if (!email) {
    return NextResponse.json({
      email: null,
      properties: [],
      error: 'ยังไม่ได้ตั้ง GSC_SERVICE_ACCOUNT_JSON ใน env ของเซิร์ฟเวอร์',
    })
  }

  let properties
  try {
    properties = await listProperties()
  } catch (e) {
    return NextResponse.json({ email, properties: [], error: (e as Error).message })
  }

  const visible = new Set(properties.map((p) => p.siteUrl))
  const sb = createAdminClient()
  const { data: sites } = await sb.from('seo_sites').select('id, gsc_property')
  const now = new Date().toISOString()
  await Promise.all(
    (sites ?? [])
      .filter((s) => s.gsc_property)
      .map((s) =>
        sb
          .from('seo_sites')
          .update({ gsc_access: visible.has(s.gsc_property!) ? 'ok' : 'denied', gsc_checked_at: now })
          .eq('id', s.id)
      )
  )

  return NextResponse.json({ email, properties })
}
