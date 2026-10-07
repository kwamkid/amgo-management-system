// app/api/queue/run/route.ts
//
// ตัวรันคิวกลาง — ตอบ 202 ทันที แล้วทำงานใน after() (ดู lib/queue/queue.ts)
//
// ใครเรียก:
//   · route ที่เพิ่งลงคิว (kickQueue) — งานเริ่มทันที ไม่ต้องรอ cron
//   · ตัวเอง — ยังเหลืองานหลังหมดเวลา ~40 วิ = เรียกต่ออีกรอบ (function ใหม่ ได้ 60 วิ ใหม่)
//   · /api/web/jobs/next (cron ทุก 2 นาที) — ตัวสำรองเผื่อการปลุกหลุด
// ยืนยันด้วย CRON_SECRET เท่านั้น (ไม่มีหน้าเว็บเรียกตรง)
//
// งานฟลีต (web_jobs) มีตัวรันของตัวเอง (โฮสต์ละงาน · เวลาต่องานยาว) — ถ้ามีคิวรออยู่ก็ปลุกมันด้วย

import { after, NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { drainQueue, kickQueue } from '@/lib/queue/queue'

export const maxDuration = 60

async function run(origin: string) {
  const sb = createAdminClient()
  try {
    const { ran, left } = await drainQueue(sb)
    if (ran) console.log('[queue] ran', ran, left ? '(more left)' : '')
    // เหลืองาน และรอบนี้ทำได้จริง (กันวนเปล่าเมื่อทุกงานพังรอเวลาลองใหม่)
    if (left && ran) await kickQueue(origin)
  } catch (e) {
    console.error('[queue] run', (e as Error).message)
  }
}

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const origin = request.nextUrl.origin
  after(() => run(origin))
  return NextResponse.json({ accepted: true }, { status: 202 })
}

export const GET = handle
export const POST = handle
