// app/api/push/notify/route.ts
//
// เบราว์เซอร์บอกว่า "เกิดเหตุการณ์นี้" → server ตัดสินข้อความและผู้รับ แล้วยิง push
//
// กันปลอม: ชื่อคนทำเรื่องอ่านจากบัญชีที่ล็อกอิน · เหตุการณ์ "อนุมัติ/ปฏิเสธ" ยิงได้
// เฉพาะตำแหน่งที่อนุมัติได้จริง · เหตุการณ์ "ขอ" ไปหาคนอนุมัติเสมอ (ผู้ส่งเลือกผู้รับไม่ได้)
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  PUSH_EVENTS,
  APPROVER_ROLES,
  buildMessage,
  recipientsOf,
  requiresApprover,
  type PushEvent,
  type PushEventInput,
} from '@/lib/push/events'
import { sendPushToUsers, userIdsByRole } from '@/lib/push/send'

export const maxDuration = 15

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined)

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const event = body.event as PushEvent
  if (!PUSH_EVENTS.includes(event)) return NextResponse.json({ error: 'Unknown event' }, { status: 400 })

  const admin = createAdminClient()
  const { data: actor } = await admin
    .from('users')
    .select('display_name, full_name, role')
    .eq('id', user.id)
    .single()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requiresApprover(event) && !(APPROVER_ROLES as readonly string[]).includes(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const input: PushEventInput = {
    event,
    actorName: actor.display_name || actor.full_name,
    targetUserId: str(body.targetUserId, 64),
    leaveType: str(body.leaveType, 40),
    startDate: str(body.startDate, 10),
    endDate: str(body.endDate, 10),
    totalDays: typeof body.totalDays === 'number' ? body.totalDays : undefined,
    workedDate: str(body.workedDate, 10),
    offDate: str(body.offDate, 10),
    reason: str(body.reason, 120),
    isUrgent: body.isUrgent === true,
  }

  const to = recipientsOf(input)
  if (!to) return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })

  // คนทำเรื่องเองไม่ต้องได้รับ (HR ยื่นใบลาเอง ไม่ต้องเด้งหาตัวเอง)
  const ids = ('userIds' in to ? to.userIds : await userIdsByRole(to.roles)).filter((id) => id !== user.id)
  const sent = await sendPushToUsers(ids, buildMessage(input))
  return NextResponse.json({ success: true, recipients: ids.length, sent })
}
