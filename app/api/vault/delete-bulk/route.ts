// app/api/vault/delete-bulk/route.ts — POST { accountIds } → delete many accounts (admin only).
// Grants go with the account; the log rows stay.

import { NextRequest } from 'next/server'
import { vaultActor, vaultError, vaultJson, vaultLabel, writeVaultLog } from '@/lib/services/vault/server'

const MAX_ACCOUNTS = 300

export async function POST(request: NextRequest) {
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!actor.isAdmin) return vaultError('Forbidden', 403)

  const body = (await request.json().catch(() => null)) as { accountIds?: string[] } | null
  const accountIds = [...new Set(body?.accountIds ?? [])]
  if (!accountIds.length) return vaultError('เลือกบัญชีก่อน', 400)
  if (accountIds.length > MAX_ACCOUNTS) return vaultError('เลือกมากเกินไปในครั้งเดียว', 400)

  const { data: accounts } = await actor.db.from('vault_accounts').select('id, platform, name').in('id', accountIds)
  if (!accounts?.length) return vaultError('ไม่พบบัญชี', 404)

  try {
    await writeVaultLog(
      actor,
      request,
      accounts.map((a) => ({ accountId: a.id, label: vaultLabel(a), action: 'delete' as const }))
    )
    const { error } = await actor.db.from('vault_accounts').delete().in('id', accounts.map((a) => a.id))
    if (error) throw new Error(error.message)
    return vaultJson({ deleted: accounts.length })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}
