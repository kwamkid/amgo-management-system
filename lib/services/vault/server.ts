// lib/services/vault/server.ts
//
// Who may do what in the vault. Every /api/vault route starts here. The tables have no RLS
// policies, so these checks are the only gate: use the service-role client from vaultActor()
// and never select `secret` outside reveal/update.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/server'
import type { VaultAction, VaultPerm, VaultSecret } from '@/lib/vault/types'

export const NO_ACCESS: VaultPerm = { canView: false, canEdit: false, canDelete: false }
const FULL_ACCESS: VaultPerm = { canView: true, canEdit: true, canDelete: true }

const LIMITS = { label: 100, field: 500, note: 5000 }

export interface VaultActor {
  id: string
  isAdmin: boolean
  db: ReturnType<typeof createAdminClient>
}

/** Null when not logged in or deactivated, so a leaver loses access with their account. */
export async function vaultActor(): Promise<VaultActor | null> {
  const me = await getCurrentUser()
  if (!me) return null
  return { id: me.profile.id, isAdmin: me.profile.role === 'admin', db: createAdminClient() }
}

export async function permFor(actor: VaultActor, accountId: string): Promise<VaultPerm> {
  if (actor.isAdmin) return FULL_ACCESS
  const { data } = await actor.db
    .from('vault_access')
    .select('can_view, can_edit, can_delete')
    .eq('account_id', accountId)
    .eq('user_id', actor.id)
    .maybeSingle()
  return data ? { canView: data.can_view, canEdit: data.can_edit, canDelete: data.can_delete } : NO_ACCESS
}

/** Throws on failure: callers log before handing anything out, so no log means no secret. */
export async function writeVaultLog(
  actor: VaultActor,
  request: NextRequest,
  entry: { accountId: string; label: string; action: VaultAction; detail?: Record<string, string[]> }
) {
  const { error } = await actor.db.from('vault_logs').insert({
    account_id: entry.accountId,
    account_label: entry.label,
    user_id: actor.id,
    action: entry.action,
    detail: entry.detail ?? null,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  })
  if (error) throw new Error(error.message)
}

/** JSON that browsers and proxies must not keep. */
export function vaultJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export const vaultError = (message: string, status: number) => vaultJson({ error: message }, status)

export const vaultLabel = (a: { platform: string; name: string }) => `${a.platform} ${a.name}`

/** Trims and checks a posted account. Returns a Thai message when it is not usable. */
export function parseAccount(body: unknown):
  | { ok: true; platform: string; name: string; secret: VaultSecret }
  | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const s = (b.secret ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  const platform = text(b.platform).trim()
  const name = text(b.name).trim()
  const secret: VaultSecret = {
    username: text(s.username).trim(),
    password: text(s.password), // spaces can be part of a password
    otpPhone: text(s.otpPhone).trim(),
    note: text(s.note).trim(),
  }
  if (!platform || !name) return { ok: false, error: 'กรอกแพลตฟอร์มและชื่อบัญชีก่อน' }
  if (platform.length > LIMITS.label || name.length > LIMITS.label) return { ok: false, error: 'ชื่อยาวเกินไป' }
  if ([secret.username, secret.password, secret.otpPhone].some((v) => v.length > LIMITS.field)) {
    return { ok: false, error: 'ข้อมูลยาวเกินไป' }
  }
  if (secret.note.length > LIMITS.note) return { ok: false, error: 'โน้ตยาวเกินไป' }
  return { ok: true, platform, name, secret }
}
