// app/api/cron/birthday/route.ts
//
// อวยพรวันเกิดพนักงานเข้า Discord — รันเช้าวันละครั้ง
//
// ── ที่ต้องระวัง ──────────────────────────────────────────────────────
// 1. เทียบวัน/เดือนตามเวลาไทย ไม่ใช่ UTC  ถ้าใช้ UTC คนเกิดวันที่ 1
//    จะได้รับคำอวยพรตั้งแต่ 5 ทุ่มของวันที่ 31 เดือนก่อน
// 2. ไม่ส่งซ้ำ — จดไว้ใน app_config ว่าส่งวันไหนไปแล้ว เผื่อ cron ยิงซ้ำ
//    ตอนเน็ตหลุดแล้ว retry
// 3. ไม่บอกอายุและไม่บอกปีเกิด — เป็นข้อมูลส่วนตัว บางคนไม่อยากให้รู้
// 4. คนที่ลาออกไปแล้วไม่ต้องอวยพร

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { loadDiscordSettings } from '@/lib/discord/settings'
import { pickBirthdayMessage } from '@/lib/discord/birthday-messages'

export const maxDuration = 30

const LAST_RUN_KEY = 'birthday_greeting_last_sent'

/** วันที่ตามเวลาไทย ในรูปแบบ YYYY-MM-DD */
function todayInBangkok() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createAdminClient()
  const today = todayInBangkok()
  const [, month, day] = today.split('-')
  const force = request.nextUrl.searchParams.get('force') === '1'

  // ── กันส่งซ้ำวันเดียวกัน ────────────────────────────────────────────
  const { data: lastRun } = await sb
    .from('app_config')
    .select('value')
    .eq('key', LAST_RUN_KEY)
    .maybeSingle()

  if (!force && lastRun?.value === today) {
    return NextResponse.json({ success: true, skipped: 'ส่งไปแล้ววันนี้', date: today })
  }

  // ── ใครเกิดวันนี้ ───────────────────────────────────────────────────
  const { data: users, error } = await sb
    .from('users')
    .select('id, full_name, line_display_name, discord_user_id, birth_date')
    .eq('is_active', true)
    .eq('employment_status', 'active')
    .is('deleted_at', null)
    .not('birth_date', 'is', null)

  if (error) {
    return NextResponse.json({ error: `ดึงรายชื่อไม่สำเร็จ: ${error.message}` }, { status: 500 })
  }

  const birthdayPeople = (users ?? []).filter((u) => {
    const [, m, d] = u.birth_date!.split('-')
    return m === month && d === day
  })

  if (!birthdayPeople.length) {
    await sb
      .from('app_config')
      .upsert(
        { key: LAST_RUN_KEY, value: today, note: 'ไม่มีคนเกิดวันนี้' },
        { onConflict: 'key' }
      )
    return NextResponse.json({ success: true, date: today, count: 0 })
  }

  // ── ส่งเข้า Discord ────────────────────────────────────────────────
  const settings = await loadDiscordSettings(sb)

  if (settings.notifications.birthday === false) {
    return NextResponse.json({ success: true, skipped: 'ปิดการแจ้งเตือนวันเกิดไว้' })
  }

  // ไม่ได้ตั้งช่องวันเกิดไว้ ก็ส่งเข้าช่อง HR แทน
  const webhook = settings.webhooks.birthday || settings.webhooks.hr
  if (!webhook) {
    return NextResponse.json(
      { error: 'ยังไม่ได้ตั้ง Webhook สำหรับวันเกิด (ตั้งได้ที่ ตั้งค่าระบบ → Discord)' },
      { status: 400 }
    )
  }

  const sent: string[] = []
  const failed: string[] = []

  for (const u of birthdayPeople) {
    const name = u.full_name || u.line_display_name
    // ผูก Discord ไว้แล้วก็ mention ให้เจ้าตัวเห็น ไม่ได้ผูกก็เอ่ยชื่อเฉย ๆ
    const who = u.discord_user_id ? `<@${u.discord_user_id}>` : `**${name}**`

    const body = {
      embeds: [
        {
          title: '🎂 วันนี้วันเกิด',
          description: `${who}\n\n${pickBirthdayMessage(u.id, today)}`,
          color: 0xf59e0b,
        },
      ],
      // mention ให้เด้งจริง ต้องอนุญาตไว้ ไม่งั้น Discord แสดงเป็นข้อความเฉย ๆ
      allowed_mentions: u.discord_user_id
        ? { users: [u.discord_user_id] }
        : { parse: [] },
    }

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) sent.push(name)
      else failed.push(`${name}: HTTP ${res.status}`)
    } catch (e) {
      failed.push(`${name}: ${e instanceof Error ? e.message : 'ส่งไม่สำเร็จ'}`)
    }
  }

  // จดว่าส่งแล้วเฉพาะตอนสำเร็จหมด ไม่งั้นรอบหน้าจะได้ลองใหม่
  if (!failed.length) {
    await sb.from('app_config').upsert(
      { key: LAST_RUN_KEY, value: today, note: `อวยพร ${sent.length} คน: ${sent.join(', ')}` },
      { onConflict: 'key' }
    )
  }

  return NextResponse.json({
    success: !failed.length,
    date: today,
    count: sent.length,
    sent,
    failed,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
