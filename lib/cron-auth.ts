// lib/cron-auth.ts
//
// ตรวจว่าคนเรียกงานตามเวลาเป็นตัวจริง
//
// รับได้ 3 ทาง เพราะบริการตั้งเวลาแต่ละเจ้าใส่ค่าได้ไม่เหมือนกัน:
//   1. Authorization: Bearer <secret>   ← ดีที่สุด ใช้อันนี้
//   2. x-cron-secret: <secret>          ← เผื่อเจ้าไหนไม่ให้แก้ Authorization
//   3. ?secret=<secret>                 ← ทางสุดท้าย
//
// ⚠️ ทาง 3 ทิ้งรหัสไว้ใน log ของทั้งฝั่งเรียกและฝั่งรับ (cron-job.org เก็บ
//    ประวัติการเรียกไว้ดูย้อนหลังได้) ใช้เมื่อจำเป็นจริง ๆ เท่านั้น
//
// ถ้าไม่ได้ตั้ง CRON_SECRET ไว้ = ปล่อยผ่านตอน dev แต่ปฏิเสธตอน production
// (ไม่งั้นลืมตั้งแล้วใครก็ยิงงานได้)

import type { NextRequest } from 'next/server'

export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET

  if (!secret) return process.env.NODE_ENV === 'development'

  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true

  if (request.headers.get('x-cron-secret') === secret) return true

  return request.nextUrl.searchParams.get('secret') === secret
}
