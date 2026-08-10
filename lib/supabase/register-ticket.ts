// lib/supabase/register-ticket.ts
//
// ตั๋วยืนยันตัวตนจาก LINE สำหรับหน้าสมัคร
//
// ── ปัญหาที่แก้ ────────────────────────────────────────────────────────
// ของเดิม callback ของ LINE ส่ง lineUserId ต่อไปหน้าสมัครทาง query string
// แล้วหน้าสมัคร POST ค่านั้นกลับมาให้ server สร้างบัญชี
//
// แปลว่าใครก็ยิง POST เองได้ ใส่ lineUserId ของคนอื่นก็ได้ — ไม่ต้องผ่าน LINE
// เลยสักขั้นตอน  ตัวเลขนั้นมาจากเบราว์เซอร์ ไม่ใช่จาก LINE
//
// ── วิธีแก้ ────────────────────────────────────────────────────────────
// callback เซ็นโปรไฟล์ที่เพิ่งยืนยันกับ LINE มาแล้วเป็น "ตั๋ว" ส่งไปแทน
// server ยอมสร้างบัญชีเฉพาะเมื่อตั๋วมีลายเซ็นถูกและยังไม่หมดอายุ
//
// ใช้กุญแจตัวเดียวกับ state ของ Discord (ดู lib/discord/oauth-state.ts)

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { LineProfile } from './line-auth'

/** 30 นาที — เผื่อคนกรอกฟอร์มช้า แต่ไม่นานจนตั๋วที่หลุดไปยังใช้ได้ */
const TTL_MS = 30 * 60 * 1000

function key(): string {
  const k = process.env.SUPABASE_SECRET_KEY
  if (!k) throw new Error('ยังไม่ได้ตั้ง SUPABASE_SECRET_KEY')
  return k
}

const sign = (payload: string) =>
  createHmac('sha256', key()).update(payload).digest('base64url')

export function createRegisterTicket(profile: LineProfile): string {
  const payload = Buffer.from(
    JSON.stringify({
      u: profile.userId,
      n: profile.displayName,
      p: profile.pictureUrl ?? '',
      e: Date.now() + TTL_MS,
    })
  ).toString('base64url')

  return `${payload}.${sign(payload)}`
}

export type TicketResult =
  | { ok: true; profile: LineProfile }
  | { ok: false; reason: 'missing' | 'bad_signature' | 'expired' }

export function verifyRegisterTicket(ticket: string | null | undefined): TicketResult {
  if (!ticket) return { ok: false, reason: 'missing' }

  const [payload, signature] = ticket.split('.')
  if (!payload || !signature) return { ok: false, reason: 'bad_signature' }

  const expected = sign(payload)
  // เทียบแบบเวลาคงที่ กันการเดาลายเซ็นทีละตัวอักษรจากเวลาที่ใช้ตอบ
  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return { ok: false, reason: 'bad_signature' }
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      u: string
      n: string
      p: string
      e: number
    }
    if (!data.u || Number(data.e) < Date.now()) return { ok: false, reason: 'expired' }

    return {
      ok: true,
      profile: { userId: data.u, displayName: data.n, pictureUrl: data.p || undefined },
    }
  } catch {
    return { ok: false, reason: 'bad_signature' }
  }
}
