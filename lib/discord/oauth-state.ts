// lib/discord/oauth-state.ts
//
// ค่า state สำหรับ OAuth ของ Discord — เซ็นชื่อไว้ในตัว ไม่ต้องพึ่ง cookie
//
// ── ทำไมไม่ใช้ cookie ─────────────────────────────────────────────────
// วิธีปกติคือสุ่มค่าเก็บใส่ cookie แล้วเทียบตอน Discord ส่งกลับมา
// แต่ขากลับเป็นการข้ามเว็บ (discord.com → เรา) ซึ่ง cookie มีโอกาสไม่ถูกส่ง
// กลับมาได้หลายสาเหตุ: SameSite · การตั้งค่าเบราว์เซอร์ · ตัวบล็อกโฆษณา ·
// เปิดคนละแท็บ  ผลคือขึ้น bad_state ทั้งที่ผู้ใช้ทำถูกทุกอย่าง (เจอจริง)
//
// ตัวนี้ยัดข้อมูลลงใน state แล้วเซ็นด้วยกุญแจฝั่ง server แทน
// ปลอมไม่ได้เพราะไม่มีกุญแจ และหมดอายุใน 10 นาที
//
// ความปลอดภัยไม่ได้ลดลง เพราะปลายทางยังบังคับว่าต้องมี session อยู่แล้ว
// state มีไว้กันคนหลอกให้เหยื่อกดลิงก์เพื่อผูกบัญชี Discord ของคนอื่นเท่านั้น
// ซึ่งกันได้ด้วยการตรวจว่า state ถูกออกให้ "ผู้ใช้คนที่กำลังล็อกอินอยู่"

import { createHmac, timingSafeEqual } from 'node:crypto'

const TTL_MS = 10 * 60 * 1000

function key(): string {
  const k = process.env.SUPABASE_SECRET_KEY
  if (!k) throw new Error('ยังไม่ได้ตั้ง SUPABASE_SECRET_KEY')
  return k
}

const b64url = (s: string) => Buffer.from(s).toString('base64url')
const unb64url = (s: string) => Buffer.from(s, 'base64url').toString()

const sign = (payload: string) =>
  createHmac('sha256', key()).update(payload).digest('base64url')

export function createOAuthState(userId: string): string {
  const payload = b64url(`${userId}.${Date.now() + TTL_MS}`)
  return `${payload}.${sign(payload)}`
}

export function verifyOAuthState(
  state: string | null,
  userId: string
): { ok: true } | { ok: false; reason: 'missing' | 'bad_signature' | 'expired' | 'wrong_user' } {
  const read = readOAuthState(state)
  if (!read.ok) return { ok: false, reason: read.reason }
  if (read.subject !== userId) return { ok: false, reason: 'wrong_user' }
  return { ok: true }
}

// ── ล็อกอินด้วย Discord (สำรองให้คนที่ LINE เข้าไม่ได้ · เพิ่ม 28 ต.ค. 69) ──
// ตอนเริ่มยังไม่มี session จึงไม่มี userId ให้ผูก — ใส่ "login-<nonce>" แทน
// nonce มีเมื่อกดจากแอปที่ติดตั้ง (PWA) เพื่อส่ง session กลับเข้าแอปแบบเดียวกับ LINE
const LOGIN_PREFIX = 'login-'

export function createLoginState(nonce?: string): string {
  return createOAuthState(`${LOGIN_PREFIX}${nonce ?? ''}`)
}

/** state ของการล็อกอินหรือไม่ · ถ้าใช่คืน nonce (อาจว่าง) */
export function readLoginState(
  state: string | null
): { ok: true; nonce: string | null } | { ok: false; reason: 'missing' | 'bad_signature' | 'expired' | 'not_login' } {
  const read = readOAuthState(state)
  // ดูว่าเป็น state ของการล็อกอินก่อน — state ผูกบัญชีที่หมดอายุต้องไปทางผูกบัญชีตามเดิม
  if (!read.subject?.startsWith(LOGIN_PREFIX)) {
    return { ok: false, reason: read.ok || read.subject ? 'not_login' : read.reason }
  }
  if (!read.ok) return { ok: false, reason: read.reason }
  return { ok: true, nonce: read.subject.slice(LOGIN_PREFIX.length) || null }
}

function readOAuthState(
  state: string | null
): { ok: true; subject: string } | { ok: false; reason: 'missing' | 'bad_signature' | 'expired'; subject?: string } {
  if (!state) return { ok: false, reason: 'missing' }

  const [payload, signature] = state.split('.')
  if (!payload || !signature) return { ok: false, reason: 'bad_signature' }

  const expected = sign(payload)
  // เทียบแบบเวลาคงที่ กันการเดาลายเซ็นทีละตัวอักษรจากเวลาที่ใช้ตอบ
  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return { ok: false, reason: 'bad_signature' }
  }

  const [subject, expiresAt] = unb64url(payload).split('.')
  if (Number(expiresAt) < Date.now()) return { ok: false, reason: 'expired', subject }

  return { ok: true, subject }
}
