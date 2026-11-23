// POST /api/dev/notify — คนเทสบันทึกผล "ไม่ผ่าน/ติดขัด" → push ไปหาผู้จัดการของโปรเจกต์นั้น
// (เจ้าของ 3 พ.ย. 69: แจ้งเตือนส่งหาผม — เจ้าของเป็น manager ของทุกโปรเจกต์ที่สร้างเอง)
// ชื่อคนเทสและผลอ่านจาก DB ด้วย service role หลังยืนยัน session — เบราว์เซอร์ส่งแค่ caseId
// บั๊ก (23 พ.ย. 69) { bugId }: อ่านเหตุการณ์ล่าสุดของบั๊กที่ผู้เรียกทำเอง (≤ 2 นาที) แล้วแจ้งตามนั้น —
//   แจ้งใหม่ → ผู้จัดการ · → รอเทส → คนแจ้ง · ผู้เทสตอบผล (ปิด/ยังไม่หาย) → ผู้จัดการ + ผู้รับผิดชอบ
//   tag = id ของเหตุการณ์ (กดซ้ำ = แจ้งทับอันเดิม ไม่เด้งซ้ำ)
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push/send'
import { STATUS_LABELS, uatCode, type UatResultValue } from '@/lib/dev/uat'
import { BUG_STATUS_LABELS, bugCode, type BugStatus } from '@/lib/dev/bugs'
import { untyped } from '@/lib/services/bot/botApi'

export const maxDuration = 15

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const user = await verifiedUser(sb)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { caseId?: string; bugId?: string } | null
  if (typeof body?.bugId === 'string') return notifyBug(body.bugId, user.id)
  const caseId = typeof body?.caseId === 'string' ? body.caseId : null
  if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 })

  const admin = untyped(createAdminClient())
  // ผลล่าสุดของเคส ต้องเป็นของคนที่เรียก (กันยิงแจ้งเตือนแทนคนอื่น)
  const { data: r } = await admin
    .from('dev_uat_results')
    .select('result, note, tester_name, tester_id, dev_uat_cases(no, title, project_id, dev_projects(slug, name))')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!r || r.tester_id !== user.id) return NextResponse.json({ skipped: 'not-your-result' })
  const result = r.result as UatResultValue
  if (result === 'passed') return NextResponse.json({ skipped: 'passed' })
  const c = r.dev_uat_cases as unknown as { no: number; title: string; project_id: string; dev_projects: { slug: string; name: string } | null }

  const { data: managers } = await admin
    .from('dev_project_members')
    .select('user_id')
    .eq('project_id', c.project_id)
    .eq('role', 'manager')
    .neq('user_id', user.id)
  const to = (managers ?? []).map((m: { user_id: string }) => m.user_id)
  if (to.length === 0) return NextResponse.json({ sent: 0 })

  const sent = await sendPushToUsers(to, {
    title: `${STATUS_LABELS[result]} ${uatCode(c.no)} · ${c.dev_projects?.name ?? ''}`.trim(),
    body: `${r.tester_name ?? 'ผู้เทส'}: ${c.title}${r.note ? ` — ${String(r.note).slice(0, 120)}` : ''}`,
    url: `/dev/uat/${c.dev_projects?.slug ?? ''}?case=${caseId}`,
    tag: `uat-${caseId}`,
  })
  return NextResponse.json({ sent })
}

type Admin = ReturnType<typeof untyped>

async function managersOf(admin: Admin, projectId: string): Promise<string[]> {
  const { data } = await admin.from('dev_project_members').select('user_id').eq('project_id', projectId).eq('role', 'manager')
  return (data ?? []).map((m: { user_id: string }) => m.user_id)
}

async function notifyBug(bugId: string, me: string) {
  const admin = untyped(createAdminClient())
  const { data: e } = await admin
    .from('dev_bug_events')
    .select('id, kind, from_status, to_status, note, actor_id, actor_name, created_at')
    .eq('bug_id', bugId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!e || e.actor_id !== me) return NextResponse.json({ skipped: 'not-your-event' })
  if (Date.now() - new Date(e.created_at as string).getTime() > 2 * 60_000) return NextResponse.json({ skipped: 'old' })
  const { data: b } = await admin
    .from('dev_bugs')
    .select('no, title, project_id, reported_by, assignee_id, severity, dev_projects(slug, name)')
    .eq('id', bugId)
    .maybeSingle()
  if (!b) return NextResponse.json({ skipped: 'gone' })
  const p = b.dev_projects as unknown as { slug: string; name: string } | null

  let to: string[] = []
  let title = ''
  const to_status = e.to_status as BugStatus | null
  if (e.kind === 'created') {
    to = await managersOf(admin, b.project_id as string)
    title = `บั๊กใหม่ ${bugCode(b.no as number)} · ${p?.name ?? ''}`
  } else if (e.kind === 'status' && to_status === 'testing') {
    to = [b.reported_by as string].filter(Boolean)
    title = `แก้แล้ว รอเทส ${bugCode(b.no as number)} · ${p?.name ?? ''}`
  } else if (e.kind === 'status' && e.from_status === 'testing' && (to_status === 'closed' || to_status === 'fixing')) {
    to = [...(await managersOf(admin, b.project_id as string)), b.assignee_id as string].filter(Boolean)
    title = `${to_status === 'closed' ? 'เทสผ่าน ปิดแล้ว' : 'ยังไม่หาย'} ${bugCode(b.no as number)} · ${p?.name ?? ''}`
  } else if (e.kind === 'assign' && b.assignee_id) {
    to = [b.assignee_id as string]
    title = `มอบบั๊ก ${bugCode(b.no as number)} ให้คุณ · ${p?.name ?? ''}`
  } else {
    return NextResponse.json({ skipped: 'quiet', status: to_status ? BUG_STATUS_LABELS[to_status] : e.kind })
  }
  to = [...new Set(to)].filter((id) => id !== me)
  if (to.length === 0) return NextResponse.json({ sent: 0 })
  const sent = await sendPushToUsers(to, {
    title: title.trim(),
    body: `${e.actor_name ?? ''}: ${b.title}${e.note ? ` — ${String(e.note).slice(0, 120)}` : ''}`,
    url: `/dev/bugs/${p?.slug ?? ''}?bug=${bugId}`,
    tag: `bug-${e.id}`,
  })
  return NextResponse.json({ sent })
}
