// lib/services/vault/crypto.ts
//
// Encrypts vault logins. Server only.
//
// Encryption, not a hash: a hash cannot be turned back, and staff need the real password.
// Same AES-256-GCM as web/secretBox.ts, with two differences that matter for this data:
//  * its own key (VAULT_SECRET_KEY): a leak of the SSH key does not open shop logins
//  * the account id is bound in as AAD, so a blob copied onto another row fails to decrypt
//    instead of showing the wrong account's password
// Create the key once: openssl rand -hex 32. Losing it loses every stored login.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { VaultSecret } from '@/lib/vault/types'

const VERSION = 'v1'

function masterKey(): Buffer {
  const raw = process.env.VAULT_SECRET_KEY
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('VAULT_SECRET_KEY is not set (openssl rand -hex 32)')
  }
  return Buffer.from(raw, 'hex')
}

export function encryptVault(accountId: string, secret: VaultSecret): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  cipher.setAAD(Buffer.from(accountId, 'utf8'))
  const data = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

export function decryptVault(accountId: string, blob: string): VaultSecret {
  const [version, iv, tag, data] = blob.split(':')
  if (version !== VERSION) throw new Error('Unknown vault blob version')
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64'))
  decipher.setAAD(Buffer.from(accountId, 'utf8'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()])
  return JSON.parse(plain.toString('utf8')) as VaultSecret
}
