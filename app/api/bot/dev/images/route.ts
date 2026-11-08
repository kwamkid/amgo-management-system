// POST /api/bot/dev/images — store one step reference picture { project, data_base64, content_type }
// → { path, preview_url }. Put `path` in steps[].image when adding or updating a case (botDev.ts).
import { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, readJson } from '@/lib/services/bot/botApi'
import { devProject, uploadStepImage } from '@/lib/services/bot/botDev'

export async function POST(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const body = await readJson(request)
  if (!body) return apiError(400, 'body ต้องเป็น JSON object')
  const p = await devProject(a.caller, typeof body.project === 'string' ? body.project : null)
  if ('error' in p) return p.error
  const r = await uploadStepImage(a.caller, p.project, body.data_base64, body.content_type)
  if ('error' in r) return apiError(400, r.error)
  return apiJson({ path: r.path, preview_url: r.url }, 201)
}
