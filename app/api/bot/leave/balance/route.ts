// GET /api/bot/leave/balance — โควต้าวันลา (ทั้งหมด / ใช้ไป / เหลือ) ต่อประเภท
//   ?person=me|<discord id>|<user id> · year=2026 (ค่าเริ่มต้น ปีนี้)
//   superadmin ไม่ส่ง person = ทุกคนที่ยังทำงานอยู่ · general = ของตัวเองเสมอ
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, personName, resolvePeople } from '@/lib/services/bot/botApi'
import { todayBkk } from '@/lib/services/bot/botTasks'
import { LEAVE_TYPES, canSee } from '@/lib/services/bot/botHr'

type QuotaRow = {
  user_id: string
  leave_type: string
  total_days: number
  used_days: number
  remaining_days: number
  user: { nickname: string | null; full_name: string; is_active: boolean; deleted_at: string | null; is_system: boolean } | null
}

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const p = request.nextUrl.searchParams

  const year = Number(p.get('year') ?? todayBkk().slice(0, 4))
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return apiError(400, 'year ไม่ถูกต้อง')

  let userId: string | null = caller.scope === 'superadmin' ? null : caller.user.id
  const person = p.get('person')?.trim()
  if (person) {
    const { found } = await resolvePeople(caller.sb, [person], caller.user)
    if (!found.length) return apiError(400, `ไม่พบพนักงาน: ${person}`)
    if (!canSee(caller, found[0].id)) return apiError(403, 'ดูได้แค่โควต้าของตัวเอง')
    userId = found[0].id
  }

  let q = caller.sb
    .from('leave_quotas')
    .select('user_id, leave_type, total_days, used_days, remaining_days, user:users!leave_quotas_user_id_fkey(nickname, full_name, is_active, deleted_at, is_system)')
    .eq('year', year)
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q
  if (error) return apiError(500, error.message)

  const byPerson = new Map<string, { id: string; name: string; quota: Record<string, { total: number; used: number; remaining: number }> }>()
  for (const r of (data ?? []) as unknown as QuotaRow[]) {
    if (!r.user || (!userId && (!r.user.is_active || r.user.deleted_at || r.user.is_system))) continue
    const e = byPerson.get(r.user_id) ?? { id: r.user_id, name: personName(r.user), quota: {} }
    e.quota[r.leave_type] = { total: Number(r.total_days), used: Number(r.used_days), remaining: Number(r.remaining_days) }
    byPerson.set(r.user_id, e)
  }
  const people = [...byPerson.values()].sort((x, y) => x.name.localeCompare(y.name, 'th'))
  return apiJson({ year, types: LEAVE_TYPES, people, note: people.length ? undefined : 'ยังไม่ได้ตั้งโควต้าปีนี้' })
}
