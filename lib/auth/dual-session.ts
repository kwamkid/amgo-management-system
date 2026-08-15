/**
 * เข้า/ออกระบบ — Supabase อย่างเดียว
 *
 * เดิมไฟล์นี้เป็น "สะพาน" ล็อกอินค้างไว้ทั้ง Supabase และ Firebase เพราะยังมี
 * หน้าเก่าอ่าน Firestore อยู่ · 15 ส.ค. 69 ย้ายก้อนสุดท้าย (อินฟลูเอนเซอร์/
 * แคมเปญ/แบรนด์/สินค้า/ผลงาน) มา Supabase ครบแล้ว จึงถอด Firebase ออกทั้งหมด
 *
 * ชื่อฟังก์ชันคง signInBoth/signOutBoth ไว้ตามเดิม เพราะมีหน้าเรียกอยู่หลายจุด
 */

import { createClient } from '@/lib/supabase/client'

export type DualTokens = {
  /** token_hash ของ Supabase */
  tokenHash: string
}

export async function signInBoth({ tokenHash }: DualTokens) {
  const sb = createClient()
  const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (error) throw new Error(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`)
}

export async function signOutBoth() {
  await createClient().auth.signOut()
}
