// scripts/test-pwa-login.mjs — state ของ LINE Login ที่พก nonce กลับเข้าแอป (ไม่แตะฐานข้อมูล)
import assert from 'node:assert/strict'
import { newNonce, buildLineState, parseLineState, handoffQuery, NONCE_RE } from '../lib/auth/pwaState.ts'

let pass = 0
const check = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${e.message}`)
    process.exitCode = 1
  }
}

check('nonce เป็น hex 32 ตัว ไม่ซ้ำกัน', () => {
  const a = newNonce(), b = newNonce()
  assert.match(a, NONCE_RE)
  assert.notEqual(a, b)
})

check('state จากแอป → callback อ่านกลับได้ครบ (ผ่าน URL encode/decode)', () => {
  const nonce = newNonce()
  const raw = buildLineState({ nonce, pwa: true })
  const roundTrip = decodeURIComponent(encodeURIComponent(raw))
  assert.deepEqual(parseLineState(roundTrip), { nonce, pwa: true })
  assert.equal(handoffQuery(parseLineState(roundTrip)), `&pwa=1&nonce=${nonce}`)
})

check('state จากเบราว์เซอร์ธรรมดาไม่มี pwa → ไม่ส่งต่อ handoff', () => {
  const s = parseLineState(buildLineState({ nonce: newNonce() }))
  assert.equal(s.pwa, undefined)
  assert.equal(handoffQuery(s), '')
})

check('state แบบเก่า (สตริงสุ่ม) หรือขยะ → {} ไม่ throw', () => {
  assert.deepEqual(parseLineState('k3j4h5g6'), {})
  assert.deepEqual(parseLineState(null), {})
  assert.deepEqual(parseLineState('%E0%A4%A'), {})
  assert.deepEqual(parseLineState('{"nonce":"short","pwa":1}'), { pwa: true })
})

check('โค้ดเชิญของหน้า /register/invite ยังอ่านได้ ทั้งแบบ encode ซ้ำ', () => {
  const raw = JSON.stringify({ inviteCode: 'ABC123' })
  assert.deepEqual(parseLineState(raw), { inviteCode: 'ABC123' })
  assert.deepEqual(parseLineState(encodeURIComponent(raw)), { inviteCode: 'ABC123' })
})

console.log(`\n${pass} ผ่าน${process.exitCode ? ' · มีที่ไม่ผ่าน' : ''}`)
