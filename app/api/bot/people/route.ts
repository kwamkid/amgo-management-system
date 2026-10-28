// GET /api/bot/people — พนักงานที่ใช้งานอยู่ (ใช้แปลงชื่อเล่น → id ก่อนมอบงาน)
//   { me: {...}, people: [{ id, name, discordId }] } · discordId = null คือยังไม่ผูก Discord
//   superadmin ได้รายละเอียดเพิ่ม: fullName · nickname · role · position · company · location
//     · employmentStatus · startDate · active · ?include_inactive=1 รวมคนที่ปิดบัญชี/ลาออก · ?q=ค้นชื่อ
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, personName } from '@/lib/services/bot/botApi'

type StaffRow = {
  id: string
  nickname: string | null
  full_name: string
  discord_user_id: string | null
  role: string
  is_active: boolean
  employment_status: string | null
  start_date: string | null
  end_date: string | null
  company: { code: string } | null
  location: { name: string } | null
  job: { name_th: string } | null
}

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const admin = caller.scope === 'superadmin'
  const p = request.nextUrl.searchParams

  let q = caller.sb
    .from('users')
    .select(
      admin
        ? 'id, nickname, full_name, discord_user_id, role, is_active, employment_status, start_date, end_date, ' +
            'company:companies!users_company_id_fkey(code), location:locations!users_primary_location_id_fkey(name), ' +
            'job:job_functions!users_job_function_id_fkey(name_th)'
        : 'id, nickname, full_name, discord_user_id',
    )
    .eq('is_system', false)
    .is('deleted_at', null)
  if (!(admin && p.get('include_inactive') === '1')) q = q.eq('is_active', true)
  const text = admin ? p.get('q')?.trim().replace(/[%_\\,()]/g, ' ') : undefined
  if (text) q = q.or(`nickname.ilike.%${text}%,full_name.ilike.%${text}%,display_name.ilike.%${text}%`)
  const { data, error } = await q
  if (error) return apiError(500, error.message)

  const people = ((data ?? []) as unknown as StaffRow[])
    .map((u) => ({
      id: u.id,
      name: personName(u),
      discordId: u.discord_user_id,
      ...(admin && {
        fullName: u.full_name,
        nickname: u.nickname,
        role: u.role,
        position: u.job?.name_th ?? null,
        company: u.company?.code ?? null,
        location: u.location?.name ?? null,
        employmentStatus: u.employment_status,
        startDate: u.start_date,
        endDate: u.end_date,
        active: u.is_active,
      }),
    }))
    .sort((x, y) => x.name.localeCompare(y.name, 'th'))
  return apiJson({ me: { ...caller.user, scope: caller.scope, isAdmin: caller.isAdmin }, people })
}
