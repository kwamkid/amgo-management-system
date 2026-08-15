// app/api/web/public/slip/route.ts
//
// เจ้าของเว็บอัพสลิปเอง (ไม่ต้องล็อกอิน) — decode QR → กันสลิปซ้ำ →
// ตั้งบิลเป็น "รอตรวจ" แล้วเจ้าของเมนูค่อยกดอนุมัติที่หน้า /websites/slips
//
// ยกกติกามาจากระบบเดิมทั้งหมด: บิลที่จ่ายแล้ว/รอตรวจอยู่ อัพซ้ำไม่ได้ ·
// สลิปซ้ำ (เลขอ้างอิงเคยใช้) บันทึกไว้แต่ไม่เปลี่ยนสถานะบิล

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSlip } from '@/lib/services/web/slip'

export const runtime = 'nodejs' // sharp ต้องใช้ node runtime
export const maxDuration = 30

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const file = form.get('slip')
  const billId = form.get('billId')
  const paidScopeRaw = String(form.get('paidScope') || '')

  if (!(file instanceof File) || typeof billId !== 'string') {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 8MB' }, { status: 413 })
  }

  const sb = createAdminClient()
  const { data: bill } = await sb
    .from('web_bills')
    .select('id, site_id, status, bill_domain')
    .eq('id', billId)
    .maybeSingle()
  if (!bill) return NextResponse.json({ error: 'ไม่พบบิล' }, { status: 404 })
  if (bill.status === 'paid' || bill.status === 'pending_review') {
    return NextResponse.json(
      {
        error:
          bill.status === 'paid' ? 'บิลนี้ชำระเรียบร้อยแล้ว' : 'บิลนี้อัพสลิปแล้ว รอตรวจสอบอยู่',
      },
      { status: 400 }
    )
  }

  const paidScope: 'hosting' | 'hosting_domain' =
    bill.bill_domain && paidScopeRaw === 'hosting_domain' ? 'hosting_domain' : 'hosting'

  const buffer = Buffer.from(await file.arrayBuffer())

  // เก็บรูปใน bucket ปิด (สลิปมีข้อมูลบัญชี) — ฝั่งแอดมินเปิดด้วยลิงก์ชั่วคราว
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
  const path = `${bill.site_id}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await sb.storage
    .from('web-slips')
    .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: false })
  if (upErr) return NextResponse.json({ error: 'อัพโหลดรูปไม่สำเร็จ' }, { status: 500 })

  // อ่าน QR → กันสลิปซ้ำด้วยเลขอ้างอิงธุรกรรม
  const read = await readSlip(buffer)
  let verifyResult: 'ok' | 'duplicate' | 'unreadable' = 'unreadable'
  if (read.readable && read.transRef) {
    const { count } = await sb
      .from('web_slips')
      .select('id', { count: 'exact', head: true })
      .eq('read_ref', read.transRef)
    verifyResult = (count ?? 0) > 0 ? 'duplicate' : 'ok'
  }

  await sb.from('web_slips').insert({
    bill_id: bill.id,
    site_id: bill.site_id,
    slip_image_url: path,
    qr_raw: read.qrRaw,
    read_ref: read.transRef,
    verify_result: verifyResult,
  })

  if (verifyResult === 'duplicate') {
    return NextResponse.json({
      ok: false,
      verifyResult,
      message: 'สลิปนี้เคยถูกใช้แล้ว กรุณาอัพสลิปใบที่ถูกต้อง',
    })
  }

  await sb
    .from('web_bills')
    .update({ status: 'pending_review', paid_scope: paidScope })
    .eq('id', bill.id)

  return NextResponse.json({
    ok: true,
    verifyResult,
    message:
      verifyResult === 'unreadable'
        ? 'รับสลิปแล้ว (อ่าน QR ไม่ออก จะตรวจด้วยตาอีกที)'
        : 'รับสลิปแล้ว รอตรวจสอบ',
  })
}
