// lib/services/seo/aiReferralToken.ts
//
// token ของแต่ละเว็บสำหรับส่งยอด "คนที่ AI ส่งมา" เข้า POST /api/seo/ai-referrals — ฝั่งเซิร์ฟเวอร์เท่านั้น
// = hash ของ CRON_SECRET + โดเมน (ไม่ต้องตั้ง env ใหม่ · ไม่ส่ง secret จริงออกไปเก็บที่เว็บ · คนละเว็บคนละ token)

import { createHash } from 'node:crypto'

export const normalizeDomain = (d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')

export function aiReferralToken(domain: string) {
  return createHash('sha256')
    .update(`${process.env.CRON_SECRET ?? ''}:ai-referrals:${normalizeDomain(domain)}`)
    .digest('hex')
    .slice(0, 32)
}
