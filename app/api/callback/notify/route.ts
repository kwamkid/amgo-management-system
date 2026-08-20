// app/api/callback/notify/route.ts
//
// iOS Shortcut ยิงเบอร์ลูกค้ามาที่นี่ → ตั้งโพสต์ใหม่ในห้อง "ลูกค้าให้ติดต่อกลับ"
// พร้อม mention คนที่รับผิดชอบสาขานั้น
//
// ⚠️ ห้องนั้นเป็น **forum channel** ไม่ใช่ text channel — webhook ต้องส่ง
// `thread_name` มาด้วยเสมอ ไม่งั้น Discord ตอบ 400 · รูปแบบทำตามที่เจ้าของ
// โพสต์เองอยู่แล้ว: หัวข้อ = เบอร์ (+ โน้ตถ้ามี) · เนื้อใน = คน mention
//
// ทำไมไม่เรียก /api/discord/send: อันนั้นบังคับ session ล็อกอิน ซึ่ง Shortcut ไม่มี

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadDiscordSettings } from '@/lib/discord/settings'
import { isAuthorizedCallback } from '@/lib/callback-auth'
import { findTarget, membersOf } from '@/lib/callback-targets'

export const maxDuration = 15

/**
 * บันทึกทุกคำขอ รวมถึงที่ล้มเหลว — ไม่มีทางไล่ปัญหา "Shortcut ยิงแล้วไม่ขึ้น"
 * ได้เลยถ้าไม่เห็นว่ามือถือส่งอะไรมาจริง (log ของ Vercel เข้าถึงไม่ได้จากที่นี่)
 *
 * ล้มเหลวในการบันทึกห้ามทำให้คำขอพัง — การแจ้งเบอร์ลูกค้าสำคัญกว่า log
 */
async function log(
  sb: ReturnType<typeof createAdminClient>,
  status: number,
  raw: unknown,
  error: string | null,
  ua: string | null
) {
  try {
    await (sb as unknown as {
      from(t: string): { insert(v: unknown): Promise<unknown> }
    })
      .from('callback_logs')
      .insert({ ok: status === 200, status, raw, error, user_agent: ua })
  } catch {
    /* ไม่เป็นไร */
  }
}

/** ตัดอักขระที่ไม่ใช่เบอร์ทิ้ง — iOS ส่งมาได้หลายหน้าตา (+66, เว้นวรรค, ขีด, วงเล็บ) */
function cleanPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  // +66xxxxxxxxx → 0xxxxxxxxx อ่านง่ายกว่าสำหรับคนไทยที่ต้องกดโทรกลับ
  if (digits.startsWith('+66')) return '0' + digits.slice(3)
  if (digits.startsWith('66') && digits.length >= 11) return '0' + digits.slice(2)
  return digits
}

export async function POST(request: NextRequest) {
  const sb = createAdminClient()
  const ua = request.headers.get('user-agent')

  if (!isAuthorizedCallback(request)) {
    await log(sb, 401, null, 'รหัสไม่ถูกต้องหรือไม่ได้ส่งมา', ua)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { phone?: string; targetId?: string; label?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    await log(sb, 400, null, 'อ่าน JSON ไม่ออก', ua)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const phone = cleanPhone(String(body.phone ?? ''))
  if (phone.length < 8) {
    await log(sb, 400, body, `เบอร์ไม่ถูกต้อง (ได้มา: "${String(body.phone ?? '')}")`, ua)
    return NextResponse.json({ error: 'เบอร์ไม่ถูกต้อง' }, { status: 400 })
  }

  // รับได้ทั้ง id และ label — Shortcut ที่ใช้ "Choose from List" กับชื่อล้วน ๆ
  // จะได้ไม่ต้องเขียนสูตรแกะ id บนมือถือ
  const target = await findTarget(sb, { id: body.targetId, label: body.label })
  if (!target) {
    await log(sb, 404, body, `ไม่รู้จักสาขา "${body.label ?? body.targetId ?? ''}"`, ua)
    return NextResponse.json({ error: 'ไม่รู้จักสาขานี้' }, { status: 404 })
  }

  const people = await membersOf(sb, target.id)
  if (!people.length) {
    await log(sb, 409, body, 'สาขานี้ยังไม่ได้ตั้งคนรับผิดชอบ', ua)
    return NextResponse.json({ error: 'สาขานี้ยังไม่ได้ตั้งคนรับผิดชอบ' }, { status: 409 })
  }

  const settings = await loadDiscordSettings(sb)
  const url = settings.webhooks.callback
  if (!url) {
    await log(sb, 503, body, 'ยังไม่ได้ตั้ง webhook ของห้องนี้', ua)
    return NextResponse.json({ error: 'ยังไม่ได้ตั้ง webhook ของห้องนี้' }, { status: 503 })
  }

  const note = String(body.note ?? '').trim().slice(0, 80)
  const ids = people.map((p) => p.discord_user_id!)

  const res = await fetch(`${url}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // หัวข้อโพสต์ในฟอรัม — Discord จำกัด 100 ตัวอักษร
      thread_name: `${phone}${note ? ` ${note}` : ''}`.slice(0, 100),
      content: `📞 ${target.label} — ${ids.map((id) => `<@${id}>`).join(' ')}`,
      // ยิงถึงเฉพาะคนที่ตั้งใจ · กัน @everyone/@here หลุดไปโดยไม่ได้ตั้งใจ
      allowed_mentions: { parse: [], users: ids },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    await log(sb, 502, body, `Discord ตอบ ${res.status}: ${detail.slice(0, 200)}`, ua)
    return NextResponse.json({ error: 'ส่งเข้า Discord ไม่สำเร็จ' }, { status: 502 })
  }

  await log(sb, 200, body, null, ua)
  return NextResponse.json({
    success: true,
    phone,
    target: target.label,
    mentioned: people.map((p) => p.nickname).filter(Boolean),
  })
}
