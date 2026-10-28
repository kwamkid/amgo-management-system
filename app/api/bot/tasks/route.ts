// GET  /api/bot/tasks — รายการงาน (ทุกคนเห็นทุกงาน)
//   ?status=todo,doing (ค่าเริ่มต้น · 'all' = ทุกสถานะ) · brand=hape · assignee=me|<discord id>|<user id>|none
//   ?mine=1 (คนสร้างหรือผู้รับผิดชอบ = ผู้เรียก) · due_before=YYYY-MM-DD · due_after=YYYY-MM-DD (รวมวันนั้น)
//   ?overdue=1 (เลยกำหนด ยังไม่เสร็จ) · q=คำในชื่องาน · limit=50 (สูงสุด 200)
//
// POST /api/bot/tasks — สร้างงาน
//   { title, notes?, brand?, due_date?: "YYYY-MM-DD", assignees?: ["me" | discord id | user id] }
//   general: มอบได้แค่ตัวเอง (ไม่ส่ง assignees = มอบให้ตัวเอง) · superadmin: มอบใครก็ได้ / ไม่มอบใครก็ได้
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson, resolvePeople } from '@/lib/services/bot/botApi'
import {
  STATUSES,
  TASK_COLS,
  getTaskRow,
  isYmd,
  normalizeBrand,
  toBotTasks,
  todayBkk,
  type TaskRow,
  type TaskStatus,
} from '@/lib/services/bot/botTasks'

const MAX_LIMIT = 200

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const p = request.nextUrl.searchParams

  const statusParam = (p.get('status') ?? 'todo,doing').toLowerCase()
  const statuses = statusParam === 'all' ? STATUSES : (statusParam.split(',').map((s) => s.trim()) as TaskStatus[])
  if (!statuses.length || statuses.some((s) => !STATUSES.includes(s))) return apiError(400, 'status ต้องเป็น todo,doing,done หรือ all')

  const dueBefore = p.get('due_before')
  const dueAfter = p.get('due_after')
  if ((dueBefore && !isYmd(dueBefore)) || (dueAfter && !isYmd(dueAfter))) return apiError(400, 'วันที่ต้องเป็น YYYY-MM-DD')
  const limit = Math.min(Math.max(Number(p.get('limit')) || 50, 1), MAX_LIMIT)

  let q = caller.sb.from('tasks').select(TASK_COLS).in('status', statuses)
  const brand = normalizeBrand(p.get('brand'))
  if (brand) q = q.eq('brand', brand)
  if (dueBefore) q = q.lte('due_date', dueBefore)
  if (dueAfter) q = q.gte('due_date', dueAfter)
  if (p.get('overdue') === '1') q = q.lt('due_date', todayBkk()).neq('status', 'done')
  const text = p.get('q')?.trim()
  if (text) q = q.ilike('title', `%${text.replace(/[%_\\]/g, (m) => '\\' + m)}%`)

  // ทีมเล็ก (งานหลักร้อย) — กรองผู้รับผิดชอบในโค้ดง่ายกว่า join
  const { data, error } = await q
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) return apiError(500, error.message)
  let rows = (data ?? []) as TaskRow[]

  const assignee = p.get('assignee')?.trim()
  if (assignee === 'none') rows = rows.filter((r) => !r.task_assignees.length)
  else if (assignee) {
    const { found } = await resolvePeople(caller.sb, [assignee], caller.user)
    if (!found.length) return apiError(400, `ไม่พบพนักงาน: ${assignee}`)
    rows = rows.filter((r) => r.task_assignees.some((x) => x.user_id === found[0].id))
  }
  if (p.get('mine') === '1')
    rows = rows.filter((r) => r.created_by === caller.user.id || r.task_assignees.some((x) => x.user_id === caller.user.id))

  const total = rows.length
  const tasks = await toBotTasks(caller.sb, rows.slice(0, limit))
  return apiJson({ today: todayBkk(), total, truncated: total > limit, tasks })
}

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')

  const title = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
  if (!title) return apiError(400, 'ต้องมี title')
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 5000) : ''
  const due = body.due_date ?? null
  if (due !== null && !isYmd(due)) return apiError(400, 'due_date ต้องเป็น YYYY-MM-DD')

  let assigneeIds: string[]
  if (body.assignees === undefined) {
    assigneeIds = caller.isAdmin ? [] : [caller.user.id]
  } else {
    if (!Array.isArray(body.assignees)) return apiError(400, 'assignees ต้องเป็น array')
    const { found, missing } = await resolvePeople(caller.sb, body.assignees.map(String), caller.user)
    if (missing.length) return apiError(400, `ไม่พบพนักงาน: ${missing.join(', ')}`)
    assigneeIds = found.map((f) => f.id)
    if (!caller.isAdmin && assigneeIds.some((id) => id !== caller.user.id))
      return apiError(403, 'มอบงานให้คนอื่นได้เฉพาะแอดมิน — พนักงานจดงานให้ตัวเองได้เท่านั้น')
  }

  // งานใหม่อยู่บนสุดของคอลัมน์ "ต้องทำ" (เหมือนหน้าเว็บ: ลำดับน้อยกว่าใบบนสุด)
  const { data: top } = await caller.sb.from('tasks').select('sort_order').eq('status', 'todo').order('sort_order').limit(1).maybeSingle()
  const { data, error } = await caller.sb
    .from('tasks')
    .insert({
      title,
      notes,
      brand: normalizeBrand(body.brand),
      due_date: due as string | null,
      sort_order: (top?.sort_order ?? 1) - 1,
      created_by: caller.user.id,
    })
    .select('id')
    .single()
  if (error) return apiError(500, error.message)
  if (assigneeIds.length) {
    const { error: aErr } = await caller.sb.from('task_assignees').insert(assigneeIds.map((user_id) => ({ task_id: data.id, user_id })))
    if (aErr) return apiError(500, `สร้างงานแล้ว แต่ใส่ผู้รับผิดชอบไม่สำเร็จ: ${aErr.message}`)
  }
  const row = await getTaskRow(caller.sb, data.id)
  const [task] = await toBotTasks(caller.sb, row ? [row] : [], { notes: 'full' })
  return apiJson({ task }, 201)
}
