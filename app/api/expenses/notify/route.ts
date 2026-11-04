// app/api/expenses/notify/route.ts
//
// แจ้งผลใบเบิกเข้า Discord พร้อม @แท็กคนยื่น — เจ้าของ 4 พ.ย. 69: "โอนคืนแล้ว" กับ "ไม่อนุมัติ" เท่านั้น
// (ไฟล์ SCB ไม่ส่ง SMS/อีเมลถึงผู้รับ)
//
// กันปลอม: เบราว์เซอร์ส่งแค่เลขใบ + เหตุการณ์ · server ตรวจว่าคนกดเป็นฝ่ายบัญชี (is_finance)
// แล้วอ่านใบเองด้วยสิทธิ์ระบบ — ส่งเฉพาะใบที่สถานะตรงเหตุการณ์จริง และเพิ่งเปลี่ยนไม่เกิน 10 นาที
// (ยิงซ้ำภายหลังไม่ได้) · ห้อง = webhooks.expense ว่าง = ห้องการลา · ปิดได้ที่ notifications.expense
// ไม่ throw ใส่ผู้ใช้: แจ้งเตือนพลาดต้องไม่ทำให้การอนุมัติ/บันทึกโอนล้ม (ฝั่งเบราว์เซอร์เรียกแบบไม่รอ)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadDiscordSettings } from '@/lib/discord/settings'

export const maxDuration = 15

type Event = 'paid' | 'rejected'
const RECENT_MS = 10 * 60 * 1000
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.amgovenger.com'
const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const thb = (n: number) => `${baht.format(n)} ฿`

type ClaimRow = {
  id: string
  user_id: string
  kind: string
  description: string
  amount: number
  payee_name: string | null
  status: string
  paid_at: string | null
  paid_note: string | null
  rejected_at: string | null
  rejected_reason: string | null
  rejected_by: string | null
}

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const user = await verifiedUser(sb)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { claimIds?: unknown; event?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const event = body.event as Event
  const ids = Array.isArray(body.claimIds) ? body.claimIds.filter((x): x is string => typeof x === 'string').slice(0, 200) : []
  if ((event !== 'paid' && event !== 'rejected') || !ids.length) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { data: isFinance } = await sb.rpc('is_finance')
  if (!isFinance) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const settings = await loadDiscordSettings(admin)
  if (settings.notifications.expense === false) return NextResponse.json({ skipped: 'disabled' })
  const url = settings.webhooks.expense || settings.webhooks.leave
  if (!url) return NextResponse.json({ skipped: 'no-webhook' })

  const { data } = await admin
    .from('expense_claims')
    .select('id, user_id, kind, description, amount, payee_name, status, paid_at, paid_note, rejected_at, rejected_reason, rejected_by')
    .in('id', ids)
  const now = Date.now()
  const claims = ((data ?? []) as ClaimRow[]).filter((c) => {
    const at = event === 'paid' ? c.paid_at : c.rejected_at
    return c.status === (event === 'paid' ? 'paid' : 'rejected') && !!at && now - new Date(at).getTime() < RECENT_MS
  })
  if (!claims.length) return NextResponse.json({ skipped: 'nothing-recent' })

  const peopleIds = [...new Set([...claims.map((c) => c.user_id), user.id])]
  const { data: people } = await admin
    .from('users')
    .select('id, full_name, display_name, discord_user_id')
    .in('id', peopleIds)
  const person = new Map((people ?? []).map((p) => [p.id, p]))
  const actor = person.get(user.id)
  const actorName = actor?.display_name || actor?.full_name || 'ฝ่ายบัญชี'

  // ข้อความละคน — ใบโอนทั้งชุดของคนเดียวรวมเป็นข้อความเดียว
  const byOwner = new Map<string, ClaimRow[]>()
  for (const c of claims) byOwner.set(c.user_id, [...(byOwner.get(c.user_id) ?? []), c])

  let sent = 0
  for (const [ownerId, list] of byOwner) {
    const p = person.get(ownerId)
    const name = p?.display_name || p?.full_name || ''
    const mention = p?.discord_user_id ? `<@${p.discord_user_id}>` : name
    const total = list.reduce((s, c) => s + Number(c.amount), 0)
    const lines = list
      .slice(0, 10)
      .map((c) => `• ${c.kind === 'supplier' ? `จ่ายร้าน ${c.payee_name ?? ''} · ` : ''}${c.description} — ${thb(Number(c.amount))}`)
      .join('\n')
    const more = list.length > 10 ? `\n…และอีก ${list.length - 10} ใบ` : ''
    const paid = event === 'paid'
    const supplierOnly = list.every((c) => c.kind === 'supplier')

    const embed = {
      title: paid ? (supplierOnly ? '💸 บริษัทโอนให้ร้านแล้ว' : '💸 โอนคืนแล้ว') : '❌ ใบเบิกไม่อนุมัติ',
      description: lines + more,
      color: paid ? 0x22c55e : 0xef4444,
      fields: [
        { name: 'ยอดรวม', value: thb(total), inline: true },
        { name: paid ? 'บันทึกโดย' : 'ไม่อนุมัติโดย', value: actorName, inline: true },
        ...(paid
          ? list[0].paid_note
            ? [{ name: 'หมายเหตุ', value: list[0].paid_note.slice(0, 500), inline: false }]
            : []
          : [{ name: 'เหตุผล', value: (list[0].rejected_reason ?? '-').slice(0, 500), inline: false }]),
      ],
      url: `${APP_URL}/expenses`,
      footer: { text: 'AMGO · เบิกค่าใช้จ่าย' },
      timestamp: new Date().toISOString(),
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `${mention} ${paid ? (supplierOnly ? 'ใบขอจ่ายร้านของคุณ โอนแล้ว' : 'ได้รับเงินคืนแล้ว') : 'ใบเบิกของคุณไม่ได้รับอนุมัติ'}`,
        embeds: [embed],
        // แท็กเฉพาะเจ้าของใบ — กันข้อความในรายละเอียดไป @everyone
        allowed_mentions: { parse: [], users: p?.discord_user_id ? [p.discord_user_id] : [] },
      }),
    })
    if (res.ok) sent++
    else console.error('Discord ตอบ', res.status, 'แจ้งผลใบเบิก')
  }
  return NextResponse.json({ sent })
}
