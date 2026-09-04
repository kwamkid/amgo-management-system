// ทดสอบกติการูปสต็อก/หน้าร้านประจำวัน
//
// รัน: node scripts/test-stock-photos.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// กติกานี้เป็นด่านกั้นเช็คเอาท์ — ผิดทางหนึ่งคือคนถ่ายครบแล้วยังออกไม่ได้
// ผิดอีกทางคือคนไม่ถ่ายก็ออกได้ ทั้งสองทางเจ้าของจะรู้ทันทีวันแรกที่ใช้
//
// สคริปต์นี้เรียกฟังก์ชันตรง ๆ ไม่แตะฐานข้อมูล ไม่ต้องมี env

import { stockPhotoStatus, missingLabel } from '../lib/services/stockPhotoRules.ts'

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

const S = { kind: 'storefront' }
const K = { kind: 'stock' }

head('ครบ = มีทั้งสองอย่าง อย่างละอย่างน้อย 1')

{
  const r = stockPhotoStatus([S, K])
  check(r.complete, 'หน้าร้าน 1 + สต็อก 1 = ครบ')
  check(r.missing.length === 0, 'ไม่มีอะไรขาด')
}
{
  const r = stockPhotoStatus([S, S, S, K, K])
  check(r.complete && r.storefront === 3 && r.stock === 2, 'กี่รูปก็ได้ — หน้าร้าน 3 สต็อก 2 = ครบ', `${r.storefront}/${r.stock}`)
}

head('ไม่ครบ — บอกได้ว่าขาดอะไร')

{
  const r = stockPhotoStatus([])
  check(!r.complete, 'ยังไม่ถ่ายเลย = ไม่ครบ')
  check(missingLabel(r) === 'หน้าร้าน และ สต็อก', 'บอกว่าขาดทั้งคู่', missingLabel(r))
}
{
  const r = stockPhotoStatus([S, S])
  check(!r.complete, 'หน้าร้านอย่างเดียว 2 รูป = ยังไม่ครบ (สต็อกยังไม่มี)')
  check(missingLabel(r) === 'สต็อก', 'บอกว่าขาดสต็อก', missingLabel(r))
}
{
  const r = stockPhotoStatus([K])
  check(!r.complete && missingLabel(r) === 'หน้าร้าน', 'สต็อกอย่างเดียว = ขาดหน้าร้าน', missingLabel(r))
}

head('ค่าขยะไม่ทำให้ผ่านฟรี')

{
  const r = stockPhotoStatus([{ kind: 'selfie' }, { kind: '' }])
  check(!r.complete, 'kind ที่ไม่รู้จักไม่นับเป็นอะไรเลย')
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)
