// lib/services/web/secretBox.ts
//
// เข้ารหัส/ถอดรหัสความลับของโฮสต์ (รหัสผ่าน SSH · กุญแจส่วนตัว) — server เท่านั้น
//
// ⚠️ ทำไมไม่ใช้ hash: hash ย้อนกลับไม่ได้ แต่ระบบต้องเอา "ค่าจริง" ไปยื่นให้
//    โฮสต์ตอนต่อ SSH — hash ใช้ได้เฉพาะกรณีเทียบรหัสที่ผู้ใช้พิมพ์เข้ามา
//    ของแบบนี้จึงต้องเป็นการ "เข้ารหัส" (ถอดกลับได้ด้วยกุญแจที่เก็บแยก)
//
// กุญแจหลักอยู่ใน env WEB_SECRET_KEY (32 ไบต์ hex/base64) ไม่เคยอยู่ใน DB
// → ต่อให้ฐานข้อมูลรั่วทั้งก้อน ค่าที่ได้ไปก็ถอดไม่ออก
// สร้างกุญแจใหม่: openssl rand -hex 32

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const PREFIX = 'v1'

function masterKey(): Buffer {
  const raw = process.env.WEB_SECRET_KEY
  if (!raw) throw new Error('ยังไม่ได้ตั้ง WEB_SECRET_KEY ใน environment (openssl rand -hex 32)')
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('WEB_SECRET_KEY ต้องยาว 32 ไบต์ (hex 64 ตัว)')
  return key
}

/** คืนสตริงรูปแบบ v1:<iv>:<tag>:<ciphertext> (base64 ทั้งหมด) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':')
}

export function decryptSecret(blob: string): string {
  const [prefix, iv, tag, data] = blob.split(':')
  if (prefix !== PREFIX) throw new Error('รูปแบบความลับไม่ถูกต้อง')
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}
