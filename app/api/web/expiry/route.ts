// app/api/web/expiry/route.ts
//
// เตือนวันหมดอายุ โดเมน / โฮสต์ / SSL — cron วันละครั้ง (เช้า)
//   ส่ง Authorization: Bearer <CRON_SECRET>
//
// ส่งเป็น "สรุปใบเดียวต่อวัน" ไม่ใช่ใบละเว็บ — 25+ เว็บถ้าแยกใบจะท่วมห้องแชท
// เกณฑ์: เหลือ ≤ 30 วัน หรือเลยกำหนดแล้ว (เรียงใกล้หมดขึ้นก่อน)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { sendWebAlert } from '@/lib/services/web/webAlerts'

export const maxDuration = 30

const WINDOW_DAYS = 30

const daysLeft = (date: string) => {
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createAdminClient()
  const { data, error } = await sb
    .from('web_sites')
    .select('site_name, domain_expires_at, hosting_expires_at, ssl_expires_at')
    .eq('is_active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items: { site: string; what: string; date: string; days: number }[] = []
  for (const s of data ?? []) {
    const pairs: [string, string | null][] = [
      ['โดเมน', s.domain_expires_at],
      ['โฮสต์', s.hosting_expires_at],
      ['SSL', s.ssl_expires_at],
    ]
    for (const [what, date] of pairs) {
      if (!date) continue
      const days = daysLeft(date)
      if (days <= WINDOW_DAYS) items.push({ site: s.site_name, what, date, days })
    }
  }

  if (!items.length) return NextResponse.json({ success: true, items: 0, sent: false })

  items.sort((a, b) => a.days - b.days)
  const overdue = items.filter((i) => i.days < 0)
  const soon = items.filter((i) => i.days >= 0)

  const line = (i: (typeof items)[number]) =>
    `• **${i.site}** — ${i.what} ${fmt(i.date)} ${i.days < 0 ? `(เลยมา ${-i.days} วัน)` : `(อีก ${i.days} วัน)`}`

  const sent = await sendWebAlert({
    title: '🌐 เว็บไซต์ที่ใกล้หมดอายุ',
    description: `พบ ${items.length} รายการที่ต้องดูภายใน ${WINDOW_DAYS} วัน`,
    color: overdue.length ? 'red' : 'amber',
    fields: [
      ...(overdue.length
        ? [{ name: `เลยกำหนดแล้ว (${overdue.length})`, value: overdue.slice(0, 15).map(line).join('\n') }]
        : []),
      ...(soon.length
        ? [{ name: `ใกล้หมดอายุ (${soon.length})`, value: soon.slice(0, 15).map(line).join('\n') }]
        : []),
    ],
  })

  return NextResponse.json({ success: true, items: items.length, sent })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
