// GET   /api/bot/dev/bugs/{no}?project=<slug> — บั๊กเต็ม + ประวัติ (รูปเป็น signed URL 1 ชม.) · no = 3 หรือ BUG-0003
// PATCH /api/bot/dev/bugs/{no}?project=<slug>
//   { action: 'status', status, note? } — fixing · testing (note = แก้อะไร, โชว์ให้คนเทส) · closed · wont_fix (note = เหตุผล, ต้องมี)
//   { action: 'update', ...fields } — title, severity, steps, expected, actual, environment, device, page_url, shots, source, uat_case
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson, untyped } from '@/lib/services/bot/botApi'
import { attachBugShots, bugDetail, devBugByNo, parseBugInput, setBugStatusAs, uatCaseId } from '@/lib/services/bot/botDev'
import { bugCode, parseBugNo } from '@/lib/dev/bugs'

type Params = { params: Promise<{ no: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const r = await devBugByNo(a.caller, request.nextUrl.searchParams.get('project'), parseBugNo((await params).no))
  if ('error' in r) return r.error
  return apiJson(await bugDetail(a.caller, r))
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const slug = request.nextUrl.searchParams.get('project') ?? (typeof body.project === 'string' ? body.project : null)
  const r = await devBugByNo(a.caller, slug, parseBugNo((await params).no))
  if ('error' in r) return r.error
  const code = bugCode(r.b.no)

  if (body.action === 'status') {
    const bad = await setBugStatusAs(a.caller, r.b.id, body.status, body.note)
    if (bad) return apiError(400, bad)
    return apiJson({ ok: true, code, status: body.status })
  }
  if (body.action === 'update') {
    const { action: _a, project: _p, ...fields } = body
    const parsed = parseBugInput(fields, true)
    if ('error' in parsed) return apiError(400, parsed.error)
    if (Object.keys(parsed.row).length === 0 && !parsed.uatNo) return apiError(400, 'ไม่มีอะไรให้แก้')
    try {
      if (parsed.row.shots) parsed.row.shots = await attachBugShots(a.caller, r.project.id, parsed.row.shots as string[])
      if (parsed.uatNo) parsed.row.uat_case_id = await uatCaseId(a.caller, r.project.id, parsed.uatNo)
    } catch (e) {
      return apiError(400, (e as Error).message)
    }
    const { error } = await untyped(a.caller.sb).from('dev_bugs').update(parsed.row).eq('id', r.b.id)
    if (error) return apiJson({ error: error.message }, 500)
    return apiJson({ ok: true, code, updated: Object.keys(parsed.row) })
  }
  return apiError(400, 'action ต้องเป็น status หรือ update')
}
