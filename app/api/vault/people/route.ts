// app/api/vault/people/route.ts — GET current staff to pick from when granting (admin only)

import { vaultActor, vaultError, vaultJson } from '@/lib/services/vault/server'
import type { VaultPerson } from '@/lib/vault/types'

export async function GET() {
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!actor.isAdmin) return vaultError('Forbidden', 403)

  const { data, error } = await actor.db
    .from('users')
    .select('id, nickname, full_name')
    .eq('is_active', true)
    .eq('is_system', false)
    .is('deleted_at', null)
    .neq('role', 'admin') // admins already have everything
  if (error) return vaultError(error.message, 500)

  const people: VaultPerson[] = (data ?? [])
    .map((u) => ({ id: u.id, name: u.nickname || u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  return vaultJson({ people })
}
