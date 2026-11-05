// Browser calls to /api/vault. The tables cannot be read from the browser at all.

import type { VaultGrant, VaultItem, VaultLogRow, VaultPerson, VaultSecret } from '@/lib/vault/types'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/vault${path}`, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'ทำรายการไม่สำเร็จ')
  return body as T
}

export interface VaultForm {
  platform: string
  name: string
  secret: VaultSecret
}

export const listVault = () => call<{ isAdmin: boolean; items: VaultItem[] }>('')

export const addVault = (form: VaultForm) =>
  call<{ id: string }>('', { method: 'POST', body: JSON.stringify(form) })

export const saveVault = (id: string, form: VaultForm) =>
  call(`/${id}`, { method: 'PATCH', body: JSON.stringify(form) })

export const deleteVault = (id: string) => call(`/${id}`, { method: 'DELETE' })

export const revealVault = async (id: string) =>
  (await call<{ secret: VaultSecret }>(`/${id}/reveal`, { method: 'POST' })).secret

export const saveVaultAccess = (id: string, grants: VaultGrant[]) =>
  call(`/${id}/access`, { method: 'PUT', body: JSON.stringify({ grants }) })

export const vaultLogs = async (id: string) => (await call<{ logs: VaultLogRow[] }>(`/${id}/logs`)).logs

export const vaultPeople = async () => (await call<{ people: VaultPerson[] }>('/people')).people
