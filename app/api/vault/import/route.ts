// app/api/vault/import/route.ts
//
// POST { rows } → add many accounts at once (admin only). Same checks as adding one. A row whose
// platform + name already exists is skipped, never overwritten. New accounts have no grants.

import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { encryptVault } from '@/lib/services/vault/crypto'
import { parseAccount, vaultActor, vaultError, vaultJson, vaultLabel, writeVaultLog } from '@/lib/services/vault/server'
import { vaultKey } from '@/lib/vault/import'

const MAX_ROWS = 300

export async function POST(request: NextRequest) {
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!actor.isAdmin) return vaultError('Forbidden', 403)

  const body = (await request.json().catch(() => null)) as { rows?: unknown[] } | null
  if (!Array.isArray(body?.rows) || body.rows.length === 0) return vaultError('ไม่มีแถวให้นำเข้า', 400)
  if (body.rows.length > MAX_ROWS) return vaultError(`นำเข้าได้ครั้งละไม่เกิน ${MAX_ROWS} แถว`, 400)

  const { data: existing, error: readError } = await actor.db.from('vault_accounts').select('platform, name')
  if (readError) return vaultError(readError.message, 500)
  const seen = new Set((existing ?? []).map(vaultKey))

  try {
    const accounts = []
    const logs = []
    for (const [i, row] of body.rows.entries()) {
      const parsed = parseAccount(row)
      if (!parsed.ok) return vaultError(`แถวที่ ${i + 1}: ${parsed.error}`, 400)
      if (seen.has(vaultKey(parsed))) continue
      seen.add(vaultKey(parsed))
      const id = randomUUID()
      accounts.push({
        id,
        platform: parsed.platform,
        name: parsed.name,
        secret: encryptVault(id, parsed.secret),
        created_by: actor.id,
        updated_by: actor.id,
      })
      logs.push({ accountId: id, label: vaultLabel(parsed), action: 'create' as const })
    }

    if (accounts.length) {
      await writeVaultLog(actor, request, logs)
      const { error } = await actor.db.from('vault_accounts').insert(accounts)
      if (error) throw new Error(error.message)
    }
    return vaultJson({ added: accounts.length, skipped: body.rows.length - accounts.length })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}
