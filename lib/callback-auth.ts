// lib/callback-auth.ts
//
// ตรวจว่าคนเรียก endpoint แจ้งลูกค้าติดต่อกลับเป็นตัวจริง
//
// endpoint พวกนี้ต้องเปิดให้ยิงจากอินเทอร์เน็ตได้ เพราะ iOS Shortcut ไม่มี session
// ล็อกอิน — ถ้าไม่มีรหัส ใครเดา URL เจอก็โพสต์เข้าห้องแชทบริษัทได้ไม่จำกัด
//
// ⚠️ แยกรหัสจาก CRON_SECRET โดยตั้งใจ: รหัสนี้อยู่ในมือถือเจ้าของ ถ้าเครื่องหาย
// หรือแชร์ Shortcut ให้ใครแล้วหลุด จะได้เปลี่ยนเฉพาะตัวนี้ ไม่ต้องไปไล่แก้ cron
// อีก 8 ตัวที่ใช้ CRON_SECRET อยู่

import type { NextRequest } from 'next/server'

export function isAuthorizedCallback(request: NextRequest): boolean {
  const key = process.env.CALLBACK_API_KEY

  // ไม่ได้ตั้งรหัส = ปล่อยผ่านตอน dev แต่ปฏิเสธตอน production
  // (ไม่งั้นลืมตั้งแล้วกลายเป็นเปิดให้ทุกคนโพสต์)
  if (!key) return process.env.NODE_ENV === 'development'

  return (
    request.headers.get('x-api-key') === key ||
    request.headers.get('authorization') === `Bearer ${key}`
  )
}
