// lib/services/autoCheckoutService.ts
//
// ปิดกะให้คนที่ลืมเช็คเอาท์ — รันจาก cron วันละครั้ง
// ทำงานฝั่ง server ด้วยสิทธิ์ที่ข้าม RLS (ไม่มีผู้ใช้ล็อกอินตอน cron ทำงาน)
// ของเดิมที่ใช้ Firestore ลบทิ้งแล้ว — ย้อนดูได้ใน git history
//
// ── นโยบายปัจจุบัน (เจ้าของสั่ง 14 ส.ค. 69) ───────────────────────────
// ลืมเช็คเอาท์ = ปิดให้ที่ "เวลาเลิกงานปกติ" (จบกะถ้ามีกะ · ไม่มีกะ = 18:00
// หรือเข้า+8 ชม.) แล้ว **คิดชั่วโมงถึงแค่ตรงนั้น ไม่มี OT** + ติดธง
// hours_status = 'needs_review' ให้ HR เห็นในรายงานและแก้ได้
//
// ต่างจากยุค Firebase ที่เดาเวลาแล้วบันทึกเวลาที่ผ่านไปจริงทั้งดุ้น
// (เฉลี่ย 15.4 ชม. สูงสุด 26.55 ชม. ไหลเข้าค่าแรง) — การตัดที่เวลาเลิกงาน
// ปกติไม่มีทางเกิน 1 วันงาน จึงบันทึกชั่วโมงได้โดยไม่เปิดช่องปั๊มชั่วโมง

import { createAdminClient } from '@/lib/supabase/admin'
import { autoCheckoutTime, bangkokStartOfDay, calculateWorkingHours } from './workingHoursService'

// ── ปิดทุกใบของเมื่อวาน (เจ้าของสั่ง 30 ก.ย. 69) ───────────────────────
// เดิมกวาดเฉพาะใบที่เปิดค้างเกิน 12 ชม. ตอน 23:59 — คนเข้างานเย็นรอดตาข่าย
// ค้างเป็น "อยู่ในกะ" ข้ามไปถึงวันรุ่งขึ้น (ดา 29 ก.ย. 69 เข้า 20:00 ยังค้างอยู่
// ตอนสาย ๆ ของวันถัดไป) · ตอนนี้ cron รัน 00:05 แล้วปิดทุกใบที่เช็คอินก่อน
// เที่ยงคืนวันนี้ตามเวลาไทย — เข้ากับเส้นแบ่ง "ลืม = ข้ามวัน" ของ isForgotCheckout
//
// ยกเว้นใบที่เวลาเลิกงานปกติยังมาไม่ถึง (กะข้ามคืนแท้ เช่น 22:00–06:00)
// ปล่อยไว้ให้รอบคืนถัดไป ไม่งั้นจะไปตัดกะของคนที่ยังทำงานอยู่จริง

export async function autoCheckoutPendingRecords(now: Date = new Date()): Promise<{
  processed: number
  skipped: number
  errors: string[]
}> {
  const sb = createAdminClient()
  const errors: string[] = []

  const todayStart = bangkokStartOfDay(now)

  // ของเดิมวน query วันนี้+เมื่อวานทีละวันเพราะเอกสารซ้อนตามวันที่
  // ตารางแบนหาได้ทีเดียวจากเวลาเช็คอิน
  const { data: stale, error } = await sb
    .from('checkins')
    .select('id, user_id, user_name, checkin_time, shift_end_time, shift_start_time, primary_location_id')
    .eq('status', 'checked-in')
    .is('checkout_time', null)
    .lt('checkin_time', todayStart.toISOString())

  if (error) throw new Error(`หากะที่ค้างไม่สำเร็จ: ${error.message}`)
  if (!stale?.length) return { processed: 0, skipped: 0, errors }

  console.log(`[ปิดกะอัตโนมัติ] เจอ ${stale.length} รายการ`)

  let processed = 0
  let skipped = 0

  for (const rec of stale) {
    try {
      const checkinTime = new Date(rec.checkin_time!)

      // ชั่วโมงคิดถึงเวลาเลิกงานปกติ (หักพักตามสาขา) — OT ไม่มีเด็ดขาด
      let breakHours = 1
      if (rec.primary_location_id) {
        const { data: loc } = await sb
          .from('locations')
          .select('break_hours')
          .eq('id', rec.primary_location_id)
          .maybeSingle()
        if (loc) breakHours = Number(loc.break_hours ?? 1)
      }

      const checkoutTime = autoCheckoutTime(
        checkinTime,
        rec.shift_start_time,
        rec.shift_end_time,
        breakHours,
        now
      )
      // กะข้ามคืนที่ยังไม่ถึงเวลาเลิก — คนยังทำงานอยู่ รอรอบถัดไป
      if (!checkoutTime) {
        skipped++
        continue
      }

      const calc = calculateWorkingHours(
        checkinTime,
        checkoutTime,
        { workingHours: {}, breakHours },
        undefined,
        false
      )

      const { error: updErr } = await sb
        .from('checkins')
        .update({
          checkout_time: checkoutTime.toISOString(),
          status: 'completed',
          auto_checkout: true,
          forgot_checkout: true,
          auto_checkout_at: new Date().toISOString(),
          auto_checkout_note:
            '[ลืมเช็คเอาท์ — ระบบปิดให้ที่เวลาเลิกงาน ไม่มี OT] HR แก้ได้ถ้าทำงานจริงเลยเวลา',

          regular_hours: calc.regularHours,
          overtime_hours: 0, // ตัดก่อนถึง OT — กติกาเจ้าของ 14 ส.ค. 69
          break_hours: calc.breakHours,
          needs_overtime_approval: false,
          hours_status: 'needs_review', // ธงให้ HR เห็นในรายงาน
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
        reason: 'ลืมเช็คเอาท์ — ข้ามวันแล้วยังไม่ปิดกะ',
      })

      processed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'
      console.error(`[ปิดกะอัตโนมัติ] ✗ ${rec.user_name}:`, msg)
      errors.push(`${rec.user_name}: ${msg}`)
    }
  }

  return { processed, skipped, errors }
}

// เวลาเลิกงานปกติใช้ normalEndTime ตัวเดียวกับตอนพนักงานกดเช็คเอาท์เอง
// (15 ส.ค. 69) — เดิมที่นี่มี guessCheckoutTime ของตัวเองที่ถอยไป 18:00 ก่อน
// ค่อยใช้ เข้า+8 ชม. แบบไม่บวกพัก ใบเดียวกันจึงได้ 7 หรือ 8 ชม. แล้วแต่ว่า
// cron ปิดให้หรือเจ้าตัวมากดเอง
