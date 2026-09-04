// lib/auth/pwaHandoff.ts
//
// ฝั่งเบราว์เซอร์ของ "ส่งต่อ session กลับเข้าแอป"
//
// ลำดับเหตุการณ์:
//   1. แอปที่ติดตั้งกดปุ่ม LINE → startPwaLogin() จำ nonce ไว้ใน localStorage
//      (ไม่ใช่ sessionStorage — iOS อาจฆ่าแอปตอนอยู่เบื้องหลัง localStorage รอด)
//   2. LINE ยิง callback ไปที่ Chrome/Safari → หน้า /auth/verify ที่นั่นไม่แลก token
//      แต่ offerHandoff() ฝากไว้ที่ server ตาม nonce
//   3. แอปกลับมาเห็นหน้าจอ → หน้า login เห็น pendingPwaLogin() → claimHandoff() วนถาม
//      จนได้ token → แลกเป็น session ในแอปเอง
'use client'

import { newNonce, NONCE_RE } from './pwaState'

const KEY = 'amgo-pwa-login'
const MAX_AGE_MS = 10 * 60 * 1000

export function startPwaLogin(): string {
  const nonce = newNonce()
  try {
    localStorage.setItem(KEY, JSON.stringify({ nonce, at: Date.now() }))
  } catch { /* โหมดส่วนตัว — ยังพอใช้ได้ถ้าหน้าไม่ถูกโหลดใหม่ */ }
  return nonce
}

/** nonce ที่ยังรอ session อยู่ (ไม่เกิน 10 นาที) */
export function pendingPwaLogin(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { nonce, at } = JSON.parse(raw)
    if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) return null
    if (Date.now() - Number(at || 0) > MAX_AGE_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return nonce
  } catch {
    return null
  }
}

export function clearPwaLogin(): void {
  try {
    localStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

/** เบราว์เซอร์ที่ LINE ยิงกลับ: ฝาก token ให้แอปมารับ — คืน true เมื่อฝากสำเร็จ */
export async function offerHandoff(nonce: string, tokenHash: string, next: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce, tokenHash, next }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** แอป: ถามว่า token มาหรือยัง — ได้แล้วแถวถูกลบทันที (ใช้ได้ครั้งเดียว) */
export async function claimHandoff(nonce: string): Promise<{ tokenHash: string; next: string | null } | null> {
  try {
    const res = await fetch(`/api/auth/handoff?nonce=${nonce}`, { cache: 'no-store' })
    if (res.status !== 200) return null
    const j = await res.json()
    return typeof j?.tokenHash === 'string' ? { tokenHash: j.tokenHash, next: j.next ?? null } : null
  } catch {
    return null
  }
}
