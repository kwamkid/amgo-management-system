// app/api/checkin/device-check/route.ts
//
// จับ "มือถือเครื่องเดียวเช็คอินให้หลายคน" (เจ้าของสั่ง 14 ส.ค. 69)
//
// เบราว์เซอร์เรียกหลังเช็คอินสำเร็จ (fire-and-forget) — ต้องทำฝั่ง server เพราะ
// RLS ไม่ให้พนักงานอ่านเช็คอินของคนอื่น · เจอเครื่องซ้ำ → แจ้งห้อง alerts ทันที

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadDiscordSettings } from '@/lib/discord/settings'

export const maxDuration = 15

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let checkinId: string | undefined
  try {
    checkinId = (await request.json()).checkinId
  } catch {
    /* body พัง — ตอบเฉย ๆ */
  }
  if (!checkinId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('checkins')
    .select('device_id, user_id, user_name, work_date')
    .eq('id', checkinId)
    .maybeSingle()

  // เช็คได้เฉพาะเช็คอินของตัวเอง — กันคนอื่นเอา id ไปสุ่มยิง
  if (!me?.device_id || me.user_id !== user.id) return NextResponse.json({ ok: true })

  const { data: others } = await admin
    .from('checkins')
    .select('user_name')
    .eq('device_id', me.device_id)
    .eq('work_date', me.work_date)
    .neq('user_id', me.user_id)

  const names = [...new Set((others ?? []).map((o) => o.user_name))]
  if (names.length === 0) return NextResponse.json({ ok: true })

  const settings = await loadDiscordSettings(admin)
  const url = settings.webhooks.alerts
  if (url) {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: '🚨 มือถือเครื่องเดียวเช็คอินหลายคน',
            description: `**${me.user_name}** เช็คอินจากเครื่องเดียวกับ: **${names.join(', ')}** (วันนี้)`,
            color: 0xef4444,
            footer: { text: 'AMGO Check-in System — ตรวจสอบการกดเช็คอินแทนกัน' },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, shared: names.length })
}
