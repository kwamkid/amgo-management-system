// POST /api/dev/notify — คนเทสบันทึกผล "ไม่ผ่าน/ติดขัด" → push ไปหาผู้จัดการของโปรเจกต์นั้น
// (เจ้าของ 3 พ.ย. 69: แจ้งเตือนส่งหาผม — เจ้าของเป็น manager ของทุกโปรเจกต์ที่สร้างเอง)
// ชื่อคนเทสและผลอ่านจาก DB ด้วย service role หลังยืนยัน session — เบราว์เซอร์ส่งแค่ caseId
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push/send'
import { STATUS_LABELS, uatCode, type UatResultValue } from '@/lib/dev/uat'
import { untyped } from '@/lib/services/bot/botApi'

export const maxDuration = 15

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const user = await verifiedUser(sb)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { caseId?: string } | null
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
