// GET /api/bot/dev/cases/{no}/shots — รูปผลเทสทุกรอบของเคส (signed URL 1 ชม.) · CLI ดาวน์โหลดไปให้ Claude ดู
import type { NextRequest } from 'next/server'
import { apiJson, authBotApi, untyped } from '@/lib/services/bot/botApi'
import { devCaseByNo, signShots, type ResultRow } from '@/lib/services/bot/botDev'
import { uatCode } from '@/lib/dev/uat'

export async function GET(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const r = await devCaseByNo(a.caller, Number((await params).no.replace(/^uat-?/i, '')))
  if ('error' in r) return r.error
  const { data } = await untyped(a.caller.sb).from('dev_uat_results').select('round, result, shots, created_at').eq('case_id', r.c.id).order('created_at')
  const shots: { round: number; result: string; path: string; url: string | null }[] = []
  for (const x of (data ?? []) as Pick<ResultRow, 'round' | 'result' | 'shots'>[]) {
    for (const s of await signShots(a.caller, Array.isArray(x.shots) ? x.shots : [])) shots.push({ round: x.round, result: x.result, ...s })
  }
  return apiJson({ code: uatCode(r.c.no), shots })
}
