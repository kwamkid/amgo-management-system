// GET /api/bot/people — พนักงานที่ใช้งานอยู่ (ใช้แปลงชื่อเล่น → id ก่อนมอบงาน)
//   { me: {...}, people: [{ id, name, discordId }] } · discordId = null คือยังไม่ผูก Discord
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi, personName } from '@/lib/services/bot/botApi'

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const { data, error } = await caller.sb
    .from('users')
    .select('id, nickname, full_name, discord_user_id')
    .eq('is_active', true)
    .eq('is_system', false)
    .is('deleted_at', null)
  if (error) return apiError(500, error.message)
  const people = (data ?? [])
    .map((u) => ({ id: u.id, name: personName(u), discordId: u.discord_user_id }))
    .sort((x, y) => x.name.localeCompare(y.name, 'th'))
  return apiJson({ me: { ...caller.user, scope: caller.scope, isAdmin: caller.isAdmin }, people })
}
