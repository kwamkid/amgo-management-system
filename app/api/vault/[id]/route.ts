// app/api/vault/[id]/route.ts
//
//   PATCH  → save changes (needs edit)
//   DELETE → remove the account and its grants (needs delete); the log stays

import { NextRequest } from 'next/server'
import { decryptVault, encryptVault } from '@/lib/services/vault/crypto'
import { parseAccount, permFor, vaultActor, vaultError, vaultJson, vaultLabel, writeVaultLog } from '@/lib/services/vault/server'
import type { VaultSecret } from '@/lib/vault/types'

type Ctx = { params: Promise<{ id: string }> }

const FIELD_NAMES: Record<keyof VaultSecret, string> = {
  username: 'username',
  password: 'password',
  otpPhone: 'otp_phone',
  note: 'note',
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!(await permFor(actor, id)).canEdit) return vaultError('Forbidden', 403)

  const parsed = parseAccount(await request.json().catch(() => null))
  if (!parsed.ok) return vaultError(parsed.error, 400)

  const { data: current } = await actor.db.from('vault_accounts').select('platform, name, secret').eq('id', id).maybeSingle()
  if (!current) return vaultError('ไม่พบบัญชีนี้', 404)

  try {
    // Names of what changed, never the values.
    const before = decryptVault(id, current.secret)
    const fields = (Object.keys(FIELD_NAMES) as (keyof VaultSecret)[])
      .filter((k) => before[k] !== parsed.secret[k])
      .map((k) => FIELD_NAMES[k])
    if (current.platform !== parsed.platform) fields.push('platform')
    if (current.name !== parsed.name) fields.push('name')

    await writeVaultLog(actor, request, { accountId: id, label: vaultLabel(parsed), action: 'update', detail: { fields } })
    const { error } = await actor.db
      .from('vault_accounts')
      .update({
        platform: parsed.platform,
        name: parsed.name,
        secret: encryptVault(id, parsed.secret),
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
    return vaultJson({ success: true })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!(await permFor(actor, id)).canDelete) return vaultError('Forbidden', 403)

  const { data: current } = await actor.db.from('vault_accounts').select('platform, name').eq('id', id).maybeSingle()
  if (!current) return vaultError('ไม่พบบัญชีนี้', 404)

  try {
    await writeVaultLog(actor, request, { accountId: id, label: vaultLabel(current), action: 'delete' })
    const { error } = await actor.db.from('vault_accounts').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return vaultJson({ success: true })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}
