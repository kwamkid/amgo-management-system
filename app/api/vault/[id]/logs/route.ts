// app/api/vault/[id]/logs/route.ts — GET the latest log rows of one account (admin only)

import { vaultActor, vaultError, vaultJson } from '@/lib/services/vault/server'
import type { VaultLogRow } from '@/lib/vault/types'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!actor.isAdmin) return vaultError('Forbidden', 403)

  const { data, error } = await actor.db
    .from('vault_logs')
    .select('id, action, user_id, ip, detail, created_at')
    .eq('account_id', id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return vaultError(error.message, 500)

  const ids = [...new Set((data ?? []).map((l) => l.user_id))]
  const { data: users } = await actor.db.from('users').select('id, nickname, full_name').in('id', ids)
  const names = new Map(users?.map((u) => [u.id, u.nickname || u.full_name]))

  const logs: VaultLogRow[] = (data ?? []).map((l) => ({
    id: l.id,
    action: l.action as VaultLogRow['action'],
    who: names.get(l.user_id) ?? 'ไม่ทราบชื่อ',
    ip: l.ip,
    detail: l.detail as VaultLogRow['detail'],
    createdAt: l.created_at,
  }))
  return vaultJson({ logs })
}
