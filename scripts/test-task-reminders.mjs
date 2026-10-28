// scripts/test-task-reminders.mjs — กติกาแจ้งเตือนงานของทีม + บรรทัดสถานะ (ไม่แตะฐานข้อมูล)
import assert from 'node:assert/strict'
import {
  dailyEventFor,
  planDailyReminders,
  eventReminder,
  recipientsFor,
  shouldNagOverdue,
} from '../lib/tasks/reminders.ts'
import { statusLineText, addDaysYmd } from '../lib/tasks/updates.ts'

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

const TODAY = '2026-10-28'
const line = (o) => ({
  kind: 'waiting', waitingFor: 'รอใบเสนอราคา', waitingOn: 'ผู้รับเหมา', body: '',
  eventDate: TODAY, eventTime: null, followUps: 0, createdAt: '2026-10-25T03:00:00Z', ...o,
})
const task = (o) => ({
  id: 't1', title: 'ปูกระเบื้องหน้าร้าน', brand: null, dueDate: TODAY, status: 'doing',
  assigneeIds: ['a'], createdBy: 'boss', statusLine: null, ...o,
})

check('รอเขาอยู่ + ถึงวันตาม = เตือน "ถึงวันตาม"', () => {
  assert.equal(dailyEventFor(task({ statusLine: line() }), TODAY), 'follow_up_today')
  assert.equal(dailyEventFor(task({ statusLine: line({ kind: 'follow_up', followUps: 2 }) }), TODAY), 'follow_up_today')
})

check('งานธรรมดาครบกำหนดวันนี้ = due_today', () => {
  assert.equal(dailyEventFor(task(), TODAY), 'due_today')
})

check('นัด: เตือนวันก่อนและวันนัด ดูจากวันนัด ไม่ใช่วันครบกำหนด', () => {
  const appt = (d) => task({ dueDate: '2026-12-01', statusLine: line({ kind: 'appointment', eventDate: d }) })
  assert.equal(dailyEventFor(appt(addDaysYmd(TODAY, 1)), TODAY), 'appointment_tomorrow')
  assert.equal(dailyEventFor(appt(TODAY), TODAY), 'appointment_today')
  assert.equal(dailyEventFor(appt(addDaysYmd(TODAY, 2)), TODAY), null)
})

check('เลยกำหนด: เตือนวันที่ 1 · 3 · 7 · 14 — วันอื่นเงียบ', () => {
  assert.deepEqual([1, 2, 3, 4, 6, 7, 8, 14, 21].map(shouldNagOverdue),
    [true, false, true, false, false, true, false, true, true])
  assert.equal(dailyEventFor(task({ dueDate: addDaysYmd(TODAY, -3) }), TODAY), 'overdue')
  assert.equal(dailyEventFor(task({ dueDate: addDaysYmd(TODAY, -2) }), TODAY), null)
})

check('งานเสร็จแล้ว / ไม่มีกำหนด / ยังไม่ถึง = ไม่เตือน', () => {
  assert.equal(dailyEventFor(task({ status: 'done' }), TODAY), null)
  assert.equal(dailyEventFor(task({ dueDate: null }), TODAY), null)
  assert.equal(dailyEventFor(task({ dueDate: addDaysYmd(TODAY, 2) }), TODAY), null)
})

check('ผู้รับ: ผู้รับผิดชอบ · งานลอยไปหาคนสร้าง · ไม่ส่งหาคนกดเอง', () => {
  assert.deepEqual(recipientsFor({ assigneeIds: ['a', 'b'], createdBy: 'boss' }), ['a', 'b'])
  assert.deepEqual(recipientsFor({ assigneeIds: [], createdBy: 'boss' }), ['boss'])
  assert.deepEqual(recipientsFor({ assigneeIds: ['a', 'b'], createdBy: 'boss' }, 'a'), ['b'])
})

check('แผนรายวัน: tag ต่องานต่อวัน · ลิงก์เปิดงานนั้น', () => {
  const [p] = planDailyReminders([task({ statusLine: line() }), task({ id: 't2', dueDate: null })], TODAY)
  assert.equal(p.event, 'follow_up_today')
  assert.equal(p.message.tag, `task-t1-${TODAY}`)
  assert.equal(p.message.url, '/tasks?task=t1')
  assert.match(p.message.body, /รอใบเสนอราคา \(ผู้รับเหมา\)/)
})

check('อัปเดตงาน: แจ้งผู้รับผิดชอบคนอื่น · ทำงานคนเดียวไม่แจ้งตัวเอง', () => {
  const t = task({ assigneeIds: ['a', 'b'], statusLine: line() })
  assert.deepEqual(eventReminder('task_updated', t, { id: 'a', name: 'แอม' }).userIds, ['b'])
  assert.equal(eventReminder('task_updated', task(), { id: 'a', name: 'แอม' }), null)
})

check('มอบงาน: แจ้งเฉพาะคนที่เพิ่งได้รับ', () => {
  const p = eventReminder('assigned', task(), { id: 'boss', name: 'แอม' }, { newAssigneeIds: ['c', 'boss'] })
  assert.deepEqual(p.userIds, ['c'])
  assert.equal(p.message.title, 'แอม มอบงานให้')
})

check('บรรทัดสถานะ', () => {
  assert.equal(statusLineText(line({ eventDate: '2026-10-31' })), '⏳ รอใบเสนอราคา (ผู้รับเหมา) · ตาม 31 ต.ค.')
  assert.equal(statusLineText(line({ kind: 'follow_up', waitingOn: null, followUps: 2, eventDate: '2026-11-03' })),
    '⏳ รอใบเสนอราคา · ตามแล้ว 2 ครั้ง · ตาม 3 พ.ย.')
  assert.equal(statusLineText(line({ kind: 'appointment', eventDate: '2026-11-02', eventTime: '14:00:00', body: 'ที่ร้าน' })),
    '📅 นัด 2 พ.ย. 14:00 · ที่ร้าน')
  assert.equal(statusLineText(line({ kind: 'note', body: 'ได้ราคาแล้ว 45,000', eventDate: null })), '📝 ได้ราคาแล้ว 45,000')
})

check('บวกวันข้ามเดือน/ปี', () => {
  assert.equal(addDaysYmd('2026-10-31', 1), '2026-11-01')
  assert.equal(addDaysYmd('2026-12-29', 7), '2027-01-05')
})

console.log(`\n${pass} ผ่าน`)
