// app/api/vault/[id]/access/route.ts
//
// PUT { grants: VaultGrant[] } → replace who can view/edit/delete this account (admin only).
// Upsert first, then remove the rest, so a failure part-way never widens access.

import { NextRequest } from 'next/server'
import { vaultActor, vaultError, vaultJson, vaultLabel, writeVaultLog } from '@/lib/services/vault/server'
import { normalizeGrant, type VaultGrant } from '@/lib/vault/types'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!actor.isAdmin) return vaultError('Forbidden', 403)

  const body = (await request.json().catch(() => null)) as { grants?: VaultGrant[] } | null
  if (!Array.isArray(body?.grants)) return vaultError('Bad request', 400)
  const grants = body.grants.map(normalizeGrant).filter((g): g is VaultGrant => !!g)

  const { data: account } = await actor.db.from('vault_accounts').select('platform, name').eq('id', id).maybeSingle()
  if (!account) return vaultError('ไม่พบบัญชีนี้', 404)

  const userIds = grants.map((g) => g.userId)
  if (userIds.length) {
    const { data: people } = await actor.db
      .from('users')
      .select('id')
      .in('id', userIds)
      .eq('is_active', true)
      .is('deleted_at', null)
    if ((people?.length ?? 0) !== new Set(userIds).size) return vaultError('มีคนที่ไม่ใช่พนักงานปัจจุบัน', 400)
  }

  const { data: before } = await actor.db.from('vault_access').select('user_id').eq('account_id', id)
  const removed = (before ?? []).map((b) => b.user_id).filter((u) => !userIds.includes(u))

  try {
    await writeVaultLog(actor, request, {
      accountId: id,
      label: vaultLabel(account),
      action: 'access',
      detail: {
        granted: grants.map((g) => `${g.userId}:${g.canView ? 'v' : ''}${g.canEdit ? 'e' : ''}${g.canDelete ? 'd' : ''}`),
        removed,
      },
    })
    if (grants.length) {
      const { error } = await actor.db.from('vault_access').upsert(
        grants.map((g) => ({
          account_id: id,
          user_id: g.userId,
          can_view: g.canView,
          can_edit: g.canEdit,
          can_delete: g.canDelete,
          granted_by: actor.id,
        })),
        { onConflict: 'account_id,user_id' }
      )
      if (error) throw new Error(error.message)
    }
    if (removed.length) {
      const { error } = await actor.db.from('vault_access').delete().eq('account_id', id).in('user_id', removed)
      if (error) throw new Error(error.message)
    }
    return vaultJson({ success: true })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}
