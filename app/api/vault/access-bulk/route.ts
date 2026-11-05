// app/api/vault/access-bulk/route.ts
//
// PUT { accountIds, grants } → set these people's permissions on many accounts (admin only).
// Only the people listed change; everyone else keeps what they have. A person with nothing
// ticked loses access to those accounts.

import { NextRequest } from 'next/server'
import { vaultActor, vaultError, vaultJson, vaultLabel, writeVaultLog } from '@/lib/services/vault/server'
import { normalizeGrant, type VaultGrant } from '@/lib/vault/types'

const MAX_ACCOUNTS = 300
const MAX_PEOPLE = 100

export async function PUT(request: NextRequest) {
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!actor.isAdmin) return vaultError('Forbidden', 403)

  const body = (await request.json().catch(() => null)) as { accountIds?: string[]; grants?: VaultGrant[] } | null
  const accountIds = [...new Set(body?.accountIds ?? [])]
  const grants = body?.grants ?? []
  if (!accountIds.length || !grants.length) return vaultError('เลือกบัญชีและคนก่อน', 400)
  if (accountIds.length > MAX_ACCOUNTS || grants.length > MAX_PEOPLE) return vaultError('เลือกมากเกินไปในครั้งเดียว', 400)

  const add = grants.map(normalizeGrant).filter((g): g is VaultGrant => !!g)
  const addIds = add.map((g) => g.userId)
  const removeIds = grants.map((g) => g.userId).filter((id) => !addIds.includes(id))

  const { data: accounts } = await actor.db.from('vault_accounts').select('id, platform, name').in('id', accountIds)
  if ((accounts?.length ?? 0) !== accountIds.length) return vaultError('มีบัญชีที่ถูกลบไปแล้ว ลองโหลดหน้าใหม่', 409)

  if (addIds.length) {
    const { data: people } = await actor.db
      .from('users')
      .select('id')
      .in('id', addIds)
      .eq('is_active', true)
      .is('deleted_at', null)
    if ((people?.length ?? 0) !== new Set(addIds).size) return vaultError('มีคนที่ไม่ใช่พนักงานปัจจุบัน', 400)
  }

  try {
    await writeVaultLog(
      actor,
      request,
      accounts!.map((a) => ({
        accountId: a.id,
        label: vaultLabel(a),
        action: 'access' as const,
        detail: {
          granted: add.map((g) => `${g.userId}:v${g.canEdit ? 'e' : ''}${g.canDelete ? 'd' : ''}`),
          removed: removeIds,
        },
      }))
    )
    if (add.length) {
      const { error } = await actor.db.from('vault_access').upsert(
        accountIds.flatMap((account_id) =>
          add.map((g) => ({
            account_id,
            user_id: g.userId,
            can_view: g.canView,
            can_edit: g.canEdit,
            can_delete: g.canDelete,
            granted_by: actor.id,
          }))
        ),
        { onConflict: 'account_id,user_id' }
      )
      if (error) throw new Error(error.message)
    }
    if (removeIds.length) {
      const { error } = await actor.db.from('vault_access').delete().in('account_id', accountIds).in('user_id', removeIds)
      if (error) throw new Error(error.message)
    }
    return vaultJson({ success: true })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}
