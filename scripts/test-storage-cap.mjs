// scripts/test-storage-cap.mjs — กติกาพื้นที่เก็บรูปแบบกล้องวงจรปิด (ไม่แตะฐานข้อมูล)
import assert from 'node:assert/strict'
import { capPlan, formatMb, daysUntilHigh, HIGH_WATER, LOW_WATER } from '../lib/services/storageCapRules.ts'

let pass = 0
const check = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`) } catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1 }
}
const MB = 1048576

check('ต่ำกว่า 85% ไม่ลบ', () => {
  const p = capPlan(106 * MB, 1024)
  assert.equal(p.over, false); assert.equal(p.freeBytes, 0); assert.ok(p.pct > 0.1 && p.pct < 0.11)
})

check('เกิน 85% ต้องลบจนเหลือ 75% (เว้นช่วง 10% กันลบทุกคืน)', () => {
  const p = capPlan(900 * MB, 1024)
  assert.equal(p.over, true)
  assert.equal(p.targetBytes, Math.floor(1024 * MB * LOW_WATER))
  assert.equal(p.freeBytes, 900 * MB - Math.floor(1024 * MB * LOW_WATER))
})

check('พอดีเส้น 85% ยังไม่ลบ (ต้อง "เกิน")', () => {
  assert.equal(capPlan(Math.floor(1024 * MB * HIGH_WATER), 1024).over, false)
})

check('โควตา 0/ติดลบ ไม่ทำให้หารด้วยศูนย์', () => {
  assert.ok(Number.isFinite(capPlan(10 * MB, 0).pct))
})

check('แสดง MB/GB อ่านง่าย', () => {
  assert.equal(formatMb(7.9 * MB), '7.9 MB')
  assert.equal(formatMb(106.4 * MB), '106 MB')
  assert.equal(formatMb(1024 * MB), '1.0 GB')
})

check('ประมาณวันที่จะถึง 85%', () => {
  assert.equal(daysUntilHigh(100 * MB, 1024, 2 * MB), Math.floor((1024 * HIGH_WATER - 100) / 2))
  assert.equal(daysUntilHigh(100 * MB, 1024, 0), null)
  assert.equal(daysUntilHigh(900 * MB, 1024, 5 * MB), 0)
})

console.log(`\n${pass} ผ่าน${process.exitCode ? ' · มีที่ไม่ผ่าน' : ''}`)
