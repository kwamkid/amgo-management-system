#!/usr/bin/env node
// สร้างกุญแจ API ของบอทแชท (/api/bot/...) — พิมพ์กุญแจเต็ม + SQL insert ออกจอ "ไม่แตะ DB เอง"
// เอา SQL ไปรันใน Supabase SQL editor (project amgo) · กุญแจเต็มโชว์ครั้งเดียว เก็บใน env ของ Hermes
//
//   node scripts/mint-bot-key.mjs superadmin "Jarvis (Hermes VPS)" <owner user id>
//   node scripts/mint-bot-key.mjs general    "Edith (Hermes VPS)"
//
// สูตรเดียวกับ lib/services/bot/botApi.ts (newBotKey) — prefix amgo_bot_ · เก็บ sha256 hex
// เพิกถอน: update public.bot_api_keys set revoked_at = now() where key_prefix = '<prefix>';

import { createHash, randomBytes } from 'node:crypto'

const [scope, label, actsAs] = process.argv.slice(2)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

if (!['superadmin', 'general'].includes(scope) || !label) {
  console.error('usage: node scripts/mint-bot-key.mjs <superadmin|general> "<label>" [acts_as user id — superadmin only]')
  process.exit(1)
}
if (scope === 'superadmin' && !UUID.test(actsAs ?? '')) {
  console.error('superadmin ต้องระบุ user id ของเจ้าของ (users.id) — งานที่บอทสร้าง/ปิด ลงชื่อคนนี้')
  process.exit(1)
}

const PREFIX = 'amgo_bot_'
const key = PREFIX + randomBytes(24).toString('base64url')
const hash = createHash('sha256').update(key).digest('hex')
const prefix = key.slice(0, PREFIX.length + 4)
const q = (s) => `'${s.replace(/'/g, "''")}'`

console.log(`\nKEY (shown once — put it in the bot's env, never in git):\n${key}\n`)
console.log('SQL:')
console.log(
  `insert into public.bot_api_keys (label, key_prefix, key_hash, scope, acts_as)\n` +
    `values (${q(label)}, ${q(prefix)}, ${q(hash)}, ${q(scope)}, ${scope === 'superadmin' ? q(actsAs) : 'null'});\n`
)
