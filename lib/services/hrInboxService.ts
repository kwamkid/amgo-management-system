// lib/services/hrInboxService.ts
//
// กล่องงานหน้าแรก HR — ทุกอย่างที่ต้องทำ/ต้องตาม มาจาก RPC hr_inbox() ครั้งเดียว
// (migration 20260930100000) · เจ้าของสั่ง 30 ก.ย. 69: "หน้าแรกของ HR จะต้องรวม
// สิ่งที่ขาด และยังไม่ approve ทั้งหมด"
//
// ── ใบลืมเช็คเอาท์ ──────────────────────────────────────────────────────
// ระบบปิดกะที่เวลาเลิกงานปกติ (ไม่มี OT) แล้วติดธง needs_review · พนักงานแจ้ง
// เวลาเลิกจริงได้ตอนเปิดแอป (claim_checkout_time) · HR ตัดสินที่นี่:
//   ยืนยันตามระบบ  → ชั่วโมงเดิม ปลดธง
//   อนุมัติ/แก้เวลา → คิดชั่วโมงใหม่ด้วย manualCheckout (กติกาเดียวกับกดเช็คเอาท์เอง)
// โชว์เฉพาะงวดที่ยังไม่ตัดยอด — งวดที่ตัดแล้วแก้ไปก็ไม่เข้าเงินเดือน (เจ้าของเลือก)

import { createClient } from '@/lib/supabase/client'
import { manualCheckout } from './checkinService'

export interface ForgotItem {
  id: string
  user_id: string
  name: string
  work_date: string
  checkin_time: string
  checkout_time: string | null
  shift_start_time: string | null
  shift_end_time: string | null
  claimed_checkout_time: string | null
  claim_note: string | null
}

export interface PersonRef {
  user_id: string
  name: string
}

export interface HrInbox {
  today: string
  leave_pending: number
  swap_pending: number
  forgot: ForgotItem[]
  absent_today: PersonRef[]
  schedule_issues: (PersonRef & { reason: string })[]
  no_push: PersonRef[]
  staff_total: number
}

export async function fetchHrInbox(): Promise<HrInbox> {
  const { data, error } = await createClient().rpc('hr_inbox')
  if (error) throw new Error(`โหลดงานของ HR ไม่สำเร็จ: ${error.message}`)
  return data as unknown as HrInbox
}

interface Reviewer {
  id: string
  name: string
}

/** เวลาที่ระบบปิดให้ถูกแล้ว — ปลดธงโดยไม่แตะชั่วโมง */
export async function confirmSystemCheckout(item: ForgotItem, by: Reviewer): Promise<void> {
  const sb = createClient()
  const { error } = await sb
    .from('checkins')
    .update({ hours_status: 'original' })
    .eq('id', item.id)
    .eq('hours_status', 'needs_review')
  if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`)

  await sb.from('checkin_edits').insert({
    checkin_id: item.id,
    edited_at: new Date().toISOString(),
    edited_by: by.id,
    edited_by_name: by.name,
    field: 'hoursStatus',
    old_value: 'needs_review',
    new_value: 'original',
    reason: 'HR ยืนยันเวลาเลิกงานตามที่ระบบปิดให้',
  })
}

/** ปิดกะใหม่ที่เวลาที่ HR ยอมรับ (ที่พนักงานแจ้ง หรือที่ HR แก้เอง) แล้วคิดชั่วโมงใหม่ */
export async function setCheckoutTime(
  item: ForgotItem,
  checkoutTime: Date,
  by: Reviewer,
  reason: string
): Promise<void> {
  // ไม่อนุมัติ OT พิเศษ = ตัดที่เวลาปิดสาขาเหมือนตอนกดเช็คเอาท์เองทุกประการ
  await manualCheckout(item.id, item.work_date, checkoutTime, by.id, by.name, reason, false)
}
