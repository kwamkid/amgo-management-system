// GET  /api/bot/dev/bugs?project=<slug> — บั๊กของโปรเจกต์ (ค่าเริ่มต้น: ที่ยังเปิด)
//   ?status=open (ค่าเริ่มต้น) | all | new,accepted,fixing,testing,closed,wont_fix · ?limit=200 (สูงสุด 500)
// POST /api/bot/dev/bugs — แจ้งบั๊ก { project, bugs: [{ title, severity?, steps?, expected?, actual?, environment?, device?,
//   page_url?, shots?: [path จาก /dev/images], uat_case?: "UAT-0089", source? }] } (หรือบั๊กเดียวใน body) → BUG-0001 …
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson, untyped } from '@/lib/services/bot/botApi'
import { BUG_COLS, devProject, insertBugs, toBotBug, type BugRow } from '@/lib/services/bot/botDev'
import { BUG_STATUSES, type BugStatus } from '@/lib/dev/bugs'

const MAX_ADD = 20

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const sp = request.nextUrl.searchParams
  const p = await devProject(a.caller, sp.get('project'))
  if ('error' in p) return p.error
  const arg = (sp.get('status') ?? 'open').toLowerCase()
  const statuses = arg === 'all' ? BUG_STATUSES : arg === 'open' ? BUG_STATUSES.filter((s) => s !== 'closed' && s !== 'wont_fix') : (arg.split(',').map((s) => s.trim()) as BugStatus[])
  if (statuses.some((s) => !BUG_STATUSES.includes(s))) return apiError(400, `status ต้องเป็น open, all หรือ ${BUG_STATUSES.join(',')}`)
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 200, 1), 500)
  const { data, error } = await untyped(a.caller.sb)
    .from('dev_bugs')
    .select(`${BUG_COLS}, dev_uat_cases(no)`)
    .eq('project_id', p.project.id)
    .in('status', statuses)
    .order('no')
    .limit(limit)
  if (error) return apiJson({ error: error.message }, 500)
  const bugs = ((data ?? []) as unknown as (BugRow & { dev_uat_cases: { no: number } | null })[]).map((b) => toBotBug(b, p.project, b.dev_uat_cases?.no))
  return apiJson({ project: p.project.slug, bugs })
}

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const p = await devProject(a.caller, typeof body.project === 'string' ? body.project : null)
  if ('error' in p) return p.error
  const { project: _p, ...single } = body
  const list = Array.isArray(body.bugs) ? body.bugs : body.title ? [single] : []
  if (list.length === 0) return apiError(400, 'ต้องส่ง bugs เป็น array (หรือบั๊กเดียวใน body)')
  if (list.length > MAX_ADD) return apiError(400, `แจ้งได้ครั้งละไม่เกิน ${MAX_ADD} บั๊ก`)
  try {
    return apiJson({ project: p.project.slug, added: await insertBugs(a.caller, p.project, list) }, 201)
  } catch (e) {
    return apiError(400, (e as Error).message)
  }
}
