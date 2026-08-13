// app/api/discord/send/route.ts
//
// จุดเดียวที่ยิงข้อความเข้า Discord จริง — เบราว์เซอร์ประกอบ embed แล้วส่งมาที่นี่
//
// ทำไมต้องอ้อม: webhook URL เป็นความลับใน app_config (is_secret — อ่านได้เฉพาะ
// hr/admin) พนักงานทั่วไปอ่านตรงไม่ได้ ถ้าให้เบราว์เซอร์อ่านเอง แจ้งเตือนของ
// พนักงานจะเงียบหายหมด (บั๊กจริง 8–13 ส.ค. 69) — server อ่านด้วยสิทธิ์ระบบแทน
// และ URL ไม่เคยหลุดออกไปหาเบราว์เซอร์
//
// ต้องล็อกอินเท่านั้น (กันคนนอกยิงสแปม) · สวิตช์เปิด/ปิดรายประเภทเช็คที่นี่

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadDiscordSettings, type DiscordSettings } from '@/lib/discord/settings'

export const maxDuration = 15

const MAX_PAYLOAD_CHARS = 20_000

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { channel?: string; type?: string; payload?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { channel, type, payload } = body
  if (!channel || !payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const settings = await loadDiscordSettings(createAdminClient())

  if (type && settings.notifications[type as keyof DiscordSettings['notifications']] === false) {
    return NextResponse.json({ skipped: 'disabled' })
  }

  const url = settings.webhooks[channel as keyof DiscordSettings['webhooks']]
  if (!url) {
    return NextResponse.json({ skipped: 'no-webhook' })
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    console.error('Discord ตอบ', res.status, 'ช่อง', channel)
    return NextResponse.json({ error: 'discord-failed' }, { status: 502 })
  }
  return NextResponse.json({ success: true })
}
