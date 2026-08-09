// lib/services/autoCheckoutService.ts
//
// ปิดกะให้คนที่ลืมเช็คเอาท์ — รันจาก cron วันละครั้ง
// ทำงานฝั่ง server ด้วยสิทธิ์ที่ข้าม RLS (ไม่มีผู้ใช้ล็อกอินตอน cron ทำงาน)
// ของเดิมที่ใช้ Firestore ลบทิ้งแล้ว — ย้อนดูได้ใน git history
//
// ── เปลี่ยนนโยบายจากของเดิม ────────────────────────────────────────────
// ของเดิม "เดา" เวลาเลิกงานให้ (ใช้เวลาปิดกะ หรือ 18:00 หรือ +8 ชม.)
// แล้วบันทึกเป็นชั่วโมงทำงานจริง
//
// ผลที่เกิดขึ้นจริงในข้อมูลที่ย้ายมา: แถวที่ระบบปิดให้เฉลี่ย 15.4 ชม.
// สูงสุด 26.55 ชม. — ตัวเลขพวกนี้ไหลเข้าไปคิดค่าแรงโดยไม่มีใครทัก
//
// รอบนี้ปิดกะให้เหมือนเดิม (ไม่งั้นเช็คอินวันถัดไปไม่ได้) แต่
//   · ชั่วโมง = 0
//   · hours_status = 'needs_review'
// ให้ HR มาตัดสินเอง — ชั่วโมงทำงานคือเงิน ระบบไม่ควรเดาแทนคน

import { createAdminClient } from '@/lib/supabase/admin'

/** ลืมเช็คเอาท์เกินกี่ชั่วโมงถึงถือว่าลืมจริง (ไม่ใช่กะยาว) */
const FORGOT_AFTER_HOURS = 12

export async function autoCheckoutPendingRecords(): Promise<{
  processed: number
  errors: string[]
}> {
  const sb = createAdminClient()
  const errors: string[] = []

  const cutoff = new Date(Date.now() - FORGOT_AFTER_HOURS * 3_600_000)

  // ของเดิมวน query วันนี้+เมื่อวานทีละวันเพราะเอกสารซ้อนตามวันที่
  // ตารางแบนหาได้ทีเดียวจากเวลาเช็คอิน
  const { data: stale, error } = await sb
    .from('checkins')
    .select('id, user_id, user_name, checkin_time, shift_end_time')
    .eq('status', 'checked-in')
    .is('checkout_time', null)
    .lt('checkin_time', cutoff.toISOString())

  if (error) throw new Error(`หากะที่ค้างไม่สำเร็จ: ${error.message}`)
  if (!stale?.length) return { processed: 0, errors }

  console.log(`[ปิดกะอัตโนมัติ] เจอ ${stale.length} รายการ`)

  let processed = 0

  for (const rec of stale) {
    try {
      const checkinTime = new Date(rec.checkin_time!)
      const checkoutTime = guessCheckoutTime(checkinTime, rec.shift_end_time)

      const { error: updErr } = await sb
        .from('checkins')
        .update({
          checkout_time: checkoutTime.toISOString(),
          status: 'completed',
          auto_checkout: true,
          forgot_checkout: true,
          auto_checkout_at: new Date().toISOString(),
          auto_checkout_note:
            'ระบบปิดกะให้เพราะลืมเช็คเอาท์ — เวลาเลิกงานยังไม่ยืนยัน รอ HR ตรวจ',

          // ตั้งใจไม่ใส่ชั่วโมง — ดูหมายเหตุหัวไฟล์
          regular_hours: 0,
          overtime_hours: 0,
          break_hours: 0,
          hours_status: 'needs_review',
        })
        .eq('id', rec.id)
        .eq('status', 'checked-in') // กันชนกับกรณีเขาเพิ่งกดเช็คเอาท์เอง

      if (updErr) throw new Error(updErr.message)

      // ร่องรอยที่ HR เปิดดูได้ — audit_log เก็บให้อัตโนมัติอยู่แล้ว
      await sb.from('checkin_edits').insert({
        checkin_id: rec.id,
        edited_at: new Date().toISOString(),
        edited_by: null,
        edited_by_name: 'ระบบปิดกะอัตโนมัติ',
        field: 'checkoutTime',
        old_value: null,
        new_value: checkoutTime.toISOString(),
        reason: `ลืมเช็คเอาท์เกิน ${FORGOT_AFTER_HOURS} ชั่วโมง`,
      })

      processed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'
      console.error(`[ปิดกะอัตโนมัติ] ✗ ${rec.user_name}:`, msg)
      errors.push(`${rec.user_name}: ${msg}`)
    }
  }

  return { processed, errors }
}

/**
 * เวลาปิดกะที่บันทึกไว้ — เป็นแค่ค่าตั้งต้นให้ HR แก้ ไม่ได้เอาไปคิดชั่วโมง
 */
function guessCheckoutTime(checkinTime: Date, shiftEndTime: string | null): Date {
  const out = new Date(checkinTime)

  if (shiftEndTime) {
    const [h, m] = shiftEndTime.split(':').map(Number)
    out.setHours(h, m, 0, 0)
    if (out <= checkinTime) out.setDate(out.getDate() + 1) // กะข้ามคืน
    return out
  }

  out.setHours(18, 0, 0, 0)
  return out > checkinTime ? out : new Date(checkinTime.getTime() + 8 * 3_600_000)
}
