// GET  /api/bot/dev/cases?project=<slug> — เคสของโปรเจกต์ + ผลล่าสุดของแต่ละเคส (ค่าเริ่มต้น: เฉพาะที่ยังไม่ปิด)
//   ?status=open (ค่าเริ่มต้น) | all | pending,failed,… · ?limit=200 (สูงสุด 500) · ?brief=1 = เลข/สถานะ/ชื่อ อย่างเดียว
// POST /api/bot/dev/cases — เพิ่มเคส { project, cases: [{ title, steps:[{action, expected?}|"…"], module?, priority?, environment?, shop?, login_as?, menu_path?, page_url?, device?, preparation?, source? }] }
//   คืนเลขเคสที่ได้ (UAT-0086 …) · ต่อท้ายคอลัมน์รอเทส
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson, untyped } from '@/lib/services/bot/botApi'
import { CASE_COLS, RESULT_COLS, devProject, parseCaseInput, toBotCase, type CaseRow, type ResultRow } from '@/lib/services/bot/botDev'
import { uatCode, type UatStatus } from '@/lib/dev/uat'

const STATUSES: UatStatus[] = ['pending', 'retest', 'passed', 'failed', 'blocked', 'closed']
const MAX_LIMIT = 500
const MAX_ADD = 50

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const p = await devProject(a.caller, request.nextUrl.searchParams.get('project'))
  if ('error' in p) return p.error
  const sp = request.nextUrl.searchParams
  const statusParam = (sp.get('status') ?? 'open').toLowerCase()
  const statuses = statusParam === 'all' ? STATUSES : statusParam === 'open' ? STATUSES.filter((s) => s !== 'closed') : (statusParam.split(',').map((s) => s.trim()) as UatStatus[])
  if (statuses.some((s) => !STATUSES.includes(s))) return apiError(400, `status ต้องเป็น open, all หรือ ${STATUSES.join(',')}`)
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 200, 1), MAX_LIMIT)
  const brief = sp.get('brief') === '1'

  const sb = untyped(a.caller.sb)
  const { data, error } = await sb
    .from('dev_uat_cases')
    .select(brief ? 'no, title, status, priority, round' : `${CASE_COLS}, dev_uat_results(${RESULT_COLS})`)
    .eq('project_id', p.project.id)
    .in('status', statuses)
    .order('priority')
    .order('no')
    .limit(limit)
  if (error) return apiJson({ error: error.message }, 500)

  if (brief)
    return apiJson({ project: p.project.slug, cases: ((data ?? []) as unknown as Record<string, unknown>[]).map((c) => ({ ...c, code: uatCode(c.no as number) })) })

  const cases = (data as unknown as (CaseRow & { dev_uat_results: ResultRow[] })[]).map(({ dev_uat_results, ...c }) => {
    const results = [...(dev_uat_results ?? [])].sort((x, y) => y.created_at.localeCompare(x.created_at))
    const latest = results[0]
    return {
      ...toBotCase(c),
      result_count: results.length,
      latest: latest ? { ...latest, shots: latest.shots.length } : null,
    }
  })
  return apiJson({ project: p.project.slug, cases })
}

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const p = await devProject(a.caller, typeof body.project === 'string' ? body.project : null)
  if ('error' in p) return p.error
  const list = Array.isArray(body.cases) ? body.cases : body.title ? [body] : []
  if (list.length === 0) return apiError(400, 'ต้องส่ง cases เป็น array (หรือเคสเดียวใน body)')
  if (list.length > MAX_ADD) return apiError(400, `เพิ่มได้ครั้งละไม่เกิน ${MAX_ADD} เคส`)

  const rows: Record<string, unknown>[] = []
  for (const raw of list) {
    const r = parseCaseInput(raw)
    if ('error' in r) return apiError(400, r.error)
    rows.push({ ...r.row, project_id: p.project.id, created_by: a.caller.user.id, sort_order: Date.now() / 1000 + rows.length })
  }
  const { data, error } = await untyped(a.caller.sb).from('dev_uat_cases').insert(rows).select('no, title')
  if (error) return apiJson({ error: error.message }, 500)
  return apiJson({ project: p.project.slug, added: (data ?? []).map((c: { no: number; title: string }) => ({ no: c.no, code: uatCode(c.no), title: c.title })) }, 201)
}
