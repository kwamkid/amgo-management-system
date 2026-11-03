// GET   /api/bot/dev/cases/{no} — เคสเต็ม + ประวัติผล (รูปเป็น signed URL 1 ชม.)
// PATCH /api/bot/dev/cases/{no} — { action: 'retest', fix_note } ส่งกลับไปเทสซ้ำ (รอบ+1) · { action: 'close' } ปิดเคส
//   · { action: 'update', ...fields } แก้ข้อมูลเคส (title, steps, module, …)
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson, untyped } from '@/lib/services/bot/botApi'
import { devCaseByNo, parseCaseInput, RESULT_COLS, signShots, toBotCase, type ResultRow } from '@/lib/services/bot/botDev'
import { uatCode } from '@/lib/dev/uat'

type Params = { params: Promise<{ no: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const r = await devCaseByNo(a.caller, Number((await params).no.replace(/^uat-?/i, '')))
  if ('error' in r) return r.error
  const { data } = await untyped(a.caller.sb).from('dev_uat_results').select(RESULT_COLS).eq('case_id', r.c.id).order('created_at', { ascending: false })
  const results = await Promise.all(
    ((data ?? []) as ResultRow[]).map(async (x) => ({ ...x, shots: await signShots(a.caller, Array.isArray(x.shots) ? x.shots : []) }))
  )
  return apiJson({ case: toBotCase(r.c, r.project), results })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const r = await devCaseByNo(a.caller, Number((await params).no.replace(/^uat-?/i, '')))
  if ('error' in r) return r.error
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const sb = untyped(a.caller.sb)
  const code = uatCode(r.c.no)

  let patch: Record<string, unknown>
  if (body.action === 'retest') {
    patch = { status: 'retest', round: r.c.round + 1, fix_note: typeof body.fix_note === 'string' && body.fix_note.trim() ? body.fix_note.trim() : null }
  } else if (body.action === 'close') {
    patch = { status: 'closed' }
  } else if (body.action === 'update') {
    const { action: _a, ...fields } = body
    const parsed = parseCaseInput({ title: r.c.title, steps: r.c.steps, ...fields })
    if ('error' in parsed) return apiError(400, parsed.error)
    patch = parsed.row
  } else {
    return apiError(400, 'action ต้องเป็น retest, close หรือ update')
  }
  const { error } = await sb.from('dev_uat_cases').update(patch).eq('id', r.c.id)
  if (error) return apiJson({ error: error.message }, 500)
  return apiJson({ ok: true, code, ...patch })
}
