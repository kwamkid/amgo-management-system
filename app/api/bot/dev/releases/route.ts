// GET   /api/bot/dev/releases?project=<slug>[&items=1] — รอบงาน + ความคืบหน้า (items=1 = รายการเคส/บั๊กในรอบ)
// POST  /api/bot/dev/releases — { project, name, goal?, start_date?, target_date?, status? } → 201 { id, name }
// PATCH /api/bot/dev/releases — { project, release: <id|ชื่อ>, ...fields?, add_cases?, add_bugs?, remove_cases?, remove_bugs? }
// DELETE /api/bot/dev/releases?project=&release= — ลบรอบ (เคส/บั๊กกลับไปไม่อยู่ในรอบ)
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson, untyped } from '@/lib/services/bot/botApi'
import { devProject, listReleases, parseReleaseInput, releaseRef, setReleaseItems } from '@/lib/services/bot/botDev'

const ITEM_KEYS = ['add_cases', 'add_bugs', 'remove_cases', 'remove_bugs']
const FIELD_KEYS = ['name', 'goal', 'start_date', 'target_date', 'status']

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const p = await devProject(a.caller, request.nextUrl.searchParams.get('project'))
  if ('error' in p) return p.error
  try {
    return apiJson({ project: p.project.slug, releases: await listReleases(a.caller, p.project, request.nextUrl.searchParams.get('items') === '1') })
  } catch (e) {
    return apiJson({ error: (e as Error).message }, 500)
  }
}

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const p = await devProject(a.caller, typeof body.project === 'string' ? body.project : null)
  if ('error' in p) return p.error
  const parsed = parseReleaseInput(body, false)
  if ('error' in parsed) return apiError(400, parsed.error)
  const { data, error } = await untyped(a.caller.sb)
    .from('dev_releases')
    .insert({ ...parsed.row, project_id: p.project.id, created_by: a.caller.user.id })
    .select('id, name')
    .single()
  if (error) return apiError(400, error.message)
  return apiJson(data, 201)
}

export async function PATCH(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const p = await devProject(a.caller, typeof body.project === 'string' ? body.project : null)
  if ('error' in p) return p.error
  const unknown = Object.keys(body).filter((k) => !['project', 'release', ...FIELD_KEYS, ...ITEM_KEYS].includes(k))
  if (unknown.length) return apiError(400, `unknown field(s): ${unknown.join(', ')}`)
  try {
    const r = await releaseRef(a.caller, p.project, body.release)
    const fields = Object.fromEntries(Object.entries(body).filter(([k]) => FIELD_KEYS.includes(k)))
    if (Object.keys(fields).length) {
      const parsed = parseReleaseInput(fields, true)
      if ('error' in parsed) return apiError(400, parsed.error)
      const { error } = await untyped(a.caller.sb).from('dev_releases').update(parsed.row).eq('id', r.id)
      if (error) return apiError(400, error.message)
    }
    const added = await setReleaseItems(a.caller, p.project, r.id, body.add_cases, body.add_bugs)
    const removed = await setReleaseItems(a.caller, p.project, null, body.remove_cases, body.remove_bugs, r.id)
    return apiJson({ ok: true, release: r.name, updated: Object.keys(fields), added, removed })
  } catch (e) {
    return apiError(400, (e as Error).message)
  }
}

export async function DELETE(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const sp = request.nextUrl.searchParams
  const p = await devProject(a.caller, sp.get('project'))
  if ('error' in p) return p.error
  try {
    const r = await releaseRef(a.caller, p.project, sp.get('release'))
    const { error } = await untyped(a.caller.sb).from('dev_releases').delete().eq('id', r.id)
    if (error) return apiError(400, error.message)
    return apiJson({ ok: true, deleted: r.name })
  } catch (e) {
    return apiError(400, (e as Error).message)
  }
}
