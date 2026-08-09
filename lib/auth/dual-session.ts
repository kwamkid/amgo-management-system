/**
 * สะพานชั่วคราวระหว่างย้ายจาก Firebase ไป Supabase
 *
 * ตอนนี้ระบบอยู่ครึ่งทาง:
 *   · useAuth + ข้อมูลใหม่  → Supabase
 *   · หน้าเก่าอีกหลายสิบหน้า → ยังอ่าน Firestore อยู่
 *
 * firestore.rules บังคับว่า request.auth != null ทุกคอลเล็กชัน
 * ถ้าตัด Firebase Auth ทิ้งทันที ทุกหน้าที่ยังไม่ได้ย้ายจะอ่านข้อมูลไม่ได้เลย
 * จึงต้องล็อกอินค้างไว้ทั้งสองฝั่ง จนกว่าจะย้าย service ครบ
 *
 * 🗑️ ลบไฟล์นี้ทิ้งเมื่อไม่มีไฟล์ไหน import firebase อีก
 *    เช็คด้วย: grep -rl "firebase" app components hooks lib
 */

import { signInWithCustomToken, signOut as fbSignOut } from 'firebase/auth'
import { auth as firebaseAuth } from '@/lib/firebase/client'
import { createClient } from '@/lib/supabase/client'

export type DualTokens = {
  /** token_hash ของ Supabase — ตัวหลัก */
  tokenHash: string
  /** custom token ของ Firebase — ชั่วคราว จนกว่าหน้าเก่าจะย้ายครบ */
  firebaseToken?: string | null
}

/** เข้าระบบทั้งสองฝั่ง — Supabase สำคัญกว่า ถ้าฝั่งนั้นพังถือว่าล้มเหลว */
export async function signInBoth({ tokenHash, firebaseToken }: DualTokens) {
  const sb = createClient()
  const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (error) throw new Error(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`)

  if (firebaseToken) {
    try {
      await signInWithCustomToken(firebaseAuth, firebaseToken)
    } catch (e) {
      // ฝั่ง Firebase พังไม่ควรกันคนเข้าระบบ — แค่หน้าเก่าจะโหลดข้อมูลไม่ได้
      console.warn('เข้า Firebase ไม่สำเร็จ หน้าที่ยังไม่ได้ย้ายอาจโหลดข้อมูลไม่ขึ้น:', e)
    }
  }
}

/** ออกจากระบบทั้งสองฝั่ง */
export async function signOutBoth() {
  await Promise.allSettled([createClient().auth.signOut(), fbSignOut(firebaseAuth)])
}
