// scripts/test-push.mjs — กติกา push: ใครได้รับ + ข้อความ (ไม่แตะฐานข้อมูล)
import assert from 'node:assert/strict'
import {
  recipientsOf,
  requiresApprover,
  buildMessage,
  thaiShort,
  dateRange,
  APPROVER_ROLES,
} from '../lib/push/events.ts'

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

check('ใบขอ (ลา/สลับ) ไปหาคนอนุมัติ ไม่ใช่คนที่ผู้ส่งเลือก', () => {
  const to = recipientsOf({ event: 'leave_request', actorName: 'ปู', targetUserId: 'someone' })
  assert.deepEqual(to, { roles: APPROVER_ROLES })
  assert.deepEqual(recipientsOf({ event: 'swap_request', actorName: 'ปู' }), { roles: APPROVER_ROLES })
})

check('ผลอนุมัติไปหาเจ้าของใบคนเดียว — ไม่มีเจ้าของ = ไม่ส่ง', () => {
  assert.deepEqual(recipientsOf({ event: 'leave_approved', actorName: 'หน่อย', targetUserId: 'u1' }), { userIds: ['u1'] })
  assert.equal(recipientsOf({ event: 'swap_rejected', actorName: 'หน่อย' }), null)
})

check('เฉพาะอนุมัติ/ปฏิเสธที่ต้องเป็นคนอนุมัติถึงยิงได้', () => {
  assert.equal(requiresApprover('leave_request'), false)
  assert.equal(requiresApprover('swap_request'), false)
  assert.equal(requiresApprover('leave_approved'), true)
  assert.equal(requiresApprover('swap_rejected'), true)
})

check('วันที่ไทยแบบสั้น ไม่ผ่าน Date (ไม่เลื่อนวันตาม timezone)', () => {
  assert.equal(thaiShort('2026-09-01'), '1 ก.ย.')
  assert.equal(thaiShort('2026-12-31T00:00:00Z'), '31 ธ.ค.')
  assert.equal(thaiShort(undefined), '')
  assert.equal(dateRange('2026-09-12', '2026-09-12', 1), '12 ก.ย.')
  assert.equal(dateRange('2026-09-12', '2026-09-14', 3), '12 ก.ย. – 14 ก.ย. (3 วัน)')
})

check('ข้อความใบลา: ชื่อต้น + ประเภท + ช่วงวัน · ด่วนมีสัญลักษณ์', () => {
  const m = buildMessage({
    event: 'leave_request', actorName: 'ปู ใจดี', leaveType: 'ลาป่วย',
    startDate: '2026-09-12', endDate: '2026-09-13', totalDays: 2, reason: 'ไข้', isUrgent: true,
  })
  assert.equal(m.title, '🚨 ปู ขอลาป่วย')
  assert.equal(m.body, '12 ก.ย. – 13 ก.ย. (2 วัน) · ไข้')
  assert.equal(m.url, '/leaves/management')
})

check('ผลอนุมัติเปิดหน้าใบลาของตัวเอง และ tag เดียวกันแทนที่กัน', () => {
  const ok = buildMessage({ event: 'leave_approved', actorName: 'หน่อย', leaveType: 'ลาพักร้อน', startDate: '2026-09-20', endDate: '2026-09-20', totalDays: 1 })
  const no = buildMessage({ event: 'leave_rejected', actorName: 'หน่อย', leaveType: 'ลาพักร้อน', startDate: '2026-09-20', endDate: '2026-09-20', reason: 'คนไม่พอ' })
  assert.equal(ok.url, '/leaves')
  assert.equal(ok.tag, no.tag)
  assert.match(no.body, /เหตุผล: คนไม่พอ/)
})

check('ใบสลับวันหยุด: บอกทั้งวันที่มาทำและวันที่จะหยุด', () => {
  const m = buildMessage({ event: 'swap_request', actorName: 'เนย', workedDate: '2026-09-07', offDate: '2026-09-10' })
  assert.equal(m.title, '🔁 เนย ขอสลับวันหยุด')
  assert.equal(m.body, 'มาทำ 7 ก.ย. แล้วหยุด 10 ก.ย.')
  assert.equal(m.url, '/leaves/swap/management')
  assert.equal(buildMessage({ event: 'swap_approved', actorName: 'แอม', workedDate: '2026-09-07', offDate: '2026-09-10' }).url, '/leaves/swap')
})

check('เนื้อความไม่ยาวเกิน 120 ตัวอักษร (ระบบแจ้งเตือนตัดทิ้งเองแบบไม่สวย)', () => {
  const m = buildMessage({ event: 'leave_request', actorName: 'ปู', leaveType: 'ลากิจ', startDate: '2026-09-12', reason: 'x'.repeat(300) })
  assert.ok(m.body.length <= 120)
})

console.log(`\n${pass} ผ่าน${process.exitCode ? ' · มีที่ไม่ผ่าน' : ''}`)
