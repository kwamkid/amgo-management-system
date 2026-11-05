// app/api/vault/route.ts
//
//   GET  → accounts this person can view, with login + OTP phone for the list and search
//          (admin: all + who has access). Password and note stay on the server: those go
//          through reveal, which logs. A row that cannot be decrypted still lists, without them.
//   POST → add an account (admin only)

import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { decryptVault, encryptVault } from '@/lib/services/vault/crypto'
import { parseAccount, vaultActor, vaultError, vaultJson, vaultLabel, writeVaultLog } from '@/lib/services/vault/server'
import type { VaultGrant, VaultItem, VaultPerm, VaultPerson } from '@/lib/vault/types'

function listFields(id: string, blob: string) {
  try {
    const { username, otpPhone } = decryptVault(id, blob)
    return { username, otpPhone }
  } catch {
    return {}
  }
}

export async function GET() {
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)

  // Rows that decide what this person sees. Admin: every grant, to show who has access.
  let grants = actor.db.from('vault_access').select('account_id, user_id, can_view, can_edit, can_delete')
  if (!actor.isAdmin) grants = grants.eq('user_id', actor.id).eq('can_view', true)
  const { data: access, error: accessError } = await grants
  if (accessError) return vaultError(accessError.message, 500)

  let accounts = actor.db.from('vault_accounts').select('id, platform, name, secret, updated_at').order('platform').order('name')
  if (!actor.isAdmin) accounts = accounts.in('id', (access ?? []).map((a) => a.account_id))
  const { data, error } = await accounts
  if (error) return vaultError(error.message, 500)

  const names = new Map<string, string>()
  if (actor.isAdmin && access?.length) {
    const { data: users } = await actor.db
      .from('users')
      .select('id, nickname, full_name')
      .in('id', [...new Set(access.map((a) => a.user_id))])
    users?.forEach((u) => names.set(u.id, u.nickname || u.full_name))
  }

  const items: VaultItem[] = (data ?? []).map((a) => {
    const mine = access?.filter((g) => g.account_id === a.id) ?? []
    const perm: VaultPerm = actor.isAdmin
      ? { canView: true, canEdit: true, canDelete: true }
      : { canView: true, canEdit: !!mine[0]?.can_edit, canDelete: !!mine[0]?.can_delete }
    const list: VaultGrant[] = mine.map((g) => ({
      userId: g.user_id,
      name: names.get(g.user_id) ?? 'ไม่ทราบชื่อ',
      canView: g.can_view,
      canEdit: g.can_edit,
      canDelete: g.can_delete,
    }))
    return {
      id: a.id,
      platform: a.platform,
      name: a.name,
      updatedAt: a.updated_at,
      perm,
      ...listFields(a.id, a.secret),
      ...(actor.isAdmin ? { access: list } : {}),
    }
  })

  let admins: VaultPerson[] = []
  if (actor.isAdmin) {
    const { data: rows } = await actor.db
      .from('users')
      .select('id, nickname, full_name')
      .eq('role', 'admin')
      .eq('is_active', true)
      .eq('is_system', false)
      .is('deleted_at', null)
    admins = (rows ?? []).map((u) => ({ id: u.id, name: u.nickname || u.full_name }))
  }

  return vaultJson({ isAdmin: actor.isAdmin, items, admins })
}

export async function POST(request: NextRequest) {
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!actor.isAdmin) return vaultError('Forbidden', 403)

  const parsed = parseAccount(await request.json().catch(() => null))
  if (!parsed.ok) return vaultError(parsed.error, 400)

  try {
    const id = randomUUID() // known before insert: the blob is bound to it
    const { error } = await actor.db.from('vault_accounts').insert({
      id,
      platform: parsed.platform,
      name: parsed.name,
      secret: encryptVault(id, parsed.secret),
      created_by: actor.id,
      updated_by: actor.id,
    })
    if (error) throw new Error(error.message)
    await writeVaultLog(actor, request, { accountId: id, label: vaultLabel(parsed), action: 'create' })
    return vaultJson({ id })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}
