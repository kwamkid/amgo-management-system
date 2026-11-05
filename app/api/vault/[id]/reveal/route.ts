// app/api/vault/[id]/reveal/route.ts
//
// POST → the only way a login leaves the server. POST so it is never cached or put in a URL.
// The log is written first: if it fails, nothing is returned.

import { NextRequest } from 'next/server'
import { decryptVault } from '@/lib/services/vault/crypto'
import { permFor, vaultActor, vaultError, vaultJson, vaultLabel, writeVaultLog } from '@/lib/services/vault/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await vaultActor()
  if (!actor) return vaultError('Unauthorized', 401)
  if (!(await permFor(actor, id)).canView) return vaultError('Forbidden', 403)

  const { data } = await actor.db.from('vault_accounts').select('platform, name, secret').eq('id', id).maybeSingle()
  if (!data) return vaultError('ไม่พบบัญชีนี้', 404)

  try {
    const secret = decryptVault(id, data.secret)
    await writeVaultLog(actor, request, { accountId: id, label: vaultLabel(data), action: 'reveal' })
    return vaultJson({ secret })
  } catch (e) {
    return vaultError((e as Error).message, 500)
  }
}
