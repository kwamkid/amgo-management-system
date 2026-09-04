// lib/auth/pwaState.ts
//
// ค่า `state` ที่ฝากไปกับ LINE Login แล้ววิ่งกลับมาที่ callback — กติกาล้วน
// (ใช้ทั้งเบราว์เซอร์และ server · ทดสอบด้วย node ตรง ๆ → ห้าม '@/' alias)
//
// ทำไมต้องมี nonce: ตอนกดล็อกอินจาก "แอปที่ติดตั้ง" (PWA) แอป LINE จะยิง callback
// กลับไปที่เบราว์เซอร์หลักของเครื่อง ไม่ใช่แอป · state เป็นช่องทางเดียวที่ข้อมูล
// จากแอปเดินทางผ่าน LINE ไปถึง callback ได้โดยไม่พึ่งคุกกี้ (iOS แอปกับ Safari
// คนละถังคุกกี้) · nonce 128 บิตจึงเป็น "ตั๋ว" ให้แอปมารับ session คืนทีหลัง

export const NONCE_RE = /^[a-f0-9]{32}$/

export interface LineState {
  /** 32 ตัวอักษร hex — มีเมื่อเริ่มจากแอปที่ติดตั้ง */
  nonce?: string
  /** true = เริ่มจากแอปที่ติดตั้ง ต้องส่ง session กลับไปที่แอป */
  pwa?: boolean
  /** โค้ดเชิญ (หน้า /register/invite ใส่มา) — คงไว้ให้เข้ากันได้ */
  inviteCode?: string
}

/** สุ่ม nonce 128 บิต — ใช้ crypto ของเบราว์เซอร์/Node */
export function newNonce(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** สร้างข้อความ state (JSON) — ผู้เรียกต้อง encodeURIComponent เองตอนใส่ URL */
export function buildLineState(s: LineState): string {
  const out: Record<string, unknown> = {}
  if (s.nonce && NONCE_RE.test(s.nonce)) out.nonce = s.nonce
  if (s.pwa) out.pwa = 1
  if (s.inviteCode) out.inviteCode = s.inviteCode
  return JSON.stringify(out)
}

/**
 * อ่าน state กลับ — ทนทั้ง JSON ตรง ๆ, JSON ที่ถูก encode ซ้ำ, และค่าสุ่มแบบเก่า
 * (ก่อน 4 ก.ย. 69 state เป็นสตริงสุ่มเฉย ๆ) → คืน {} ไม่ throw
 */
export function parseLineState(raw: string | null | undefined): LineState {
  if (!raw) return {}
  for (const candidate of [raw, safeDecode(raw)]) {
    if (!candidate) continue
    try {
      const j = JSON.parse(candidate)
      if (!j || typeof j !== 'object') continue
      const out: LineState = {}
      if (typeof j.nonce === 'string' && NONCE_RE.test(j.nonce)) out.nonce = j.nonce
      if (j.pwa === 1 || j.pwa === true) out.pwa = true
      if (typeof j.inviteCode === 'string' && j.inviteCode.length <= 64) out.inviteCode = j.inviteCode
      return out
    } catch {
      /* ไม่ใช่ JSON — ลองตัวถัดไป */
    }
  }
  return {}
}

function safeDecode(s: string): string | null {
  try {
    const d = decodeURIComponent(s)
    return d === s ? null : d
  } catch {
    return null
  }
}

/** ส่วนท้าย query ที่พาข้อมูล handoff ต่อไปยังหน้า verify/register */
export function handoffQuery(s: LineState): string {
  return s.pwa && s.nonce ? `&pwa=1&nonce=${s.nonce}` : ''
}
