// ทดสอบกติกา "เวลาปกติ" ของคนไม่มีกะ — fixedScheduleRules + การต่อกับตัวคิดชั่วโมง
//
// รัน: node scripts/test-fixed-schedule.mjs
//
// เจ้าของตัดสิน 7 ก.ย. 69: ไม่มีกะ ให้นับเวลาปกติ 8.30/9.00 – 17.30/18.00
// เทสต์นี้ตรึงว่า (1) มาถึง ≤ 08:45 = รอบ 08:30–17:30 · เลยนั้น = รอบ 09:00–18:00
// (2) ไม่มีใครติดสายเพราะรอบเช้า (3) สายเมื่อเลย 09:15 (4) ออกก่อนเลิกงานติดธง
// (5) ลืมเช็คเอาท์ปิดที่เวลาเลิกงานปกติ — ทั้งหมดผ่านทางเดิมของกะจริง
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล ไม่ต้องมี env

import { fixedScheduleShift, usesLocationShifts, FIXED_SCHEDULE } from '../lib/services/fixedScheduleRules.ts'
import { calculateWorkingHours, isForgotCheckout, normalEndTime } from '../lib/services/workingHoursService.ts'

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const at = (hhmm, dayOffset = 0) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2026, 8, 7 + dayOffset, h, m, 0, 0) // จันทร์ 7 ก.ย. 69
  return d
}
const office = { workingHours: {}, breakHours: 1 } // ไม่มีเวลาปิดร้านมาครอบ

// ตอนเช็คอิน service คิดสายแบบนี้ (createCheckIn) — จำลองให้ตรง
const lateAtCheckin = (time, shift) => {
  const [h, m] = shift.startTime.split(':').map(Number)
  const start = new Date(time); start.setHours(h, m, 0, 0)
  const raw = Math.floor((time - start) / 60_000)
  return raw > shift.graceMinutes && raw < 720
}

console.log('\n1) ใครใช้กะสาขา')
check(usesLocationShifts('rotating') === true, 'PC (rotating) เลือกกะสาขา')
check(usesLocationShifts('fixed') === false, 'ตำแหน่งประจำ (fixed) ไม่เลือกกะ')
check(usesLocationShifts(undefined) === false && usesLocationShifts(null) === false, 'ไม่มีตำแหน่ง = ไม่มีกะ')

console.log('\n2) เลือกรอบตามเวลาที่มาถึง')
for (const [t, start, end] of [['07:50','08:30','17:30'], ['08:30','08:30','17:30'], ['08:45','08:30','17:30'],
                                ['08:46','09:00','18:00'], ['09:00','09:00','18:00'], ['09:40','09:00','18:00'], ['13:00','09:00','18:00']]) {
  const s = fixedScheduleShift(at(t))
  check(s.startTime === start && s.endTime === end && s.name === FIXED_SCHEDULE.name && s.graceMinutes === 15,
    `มาถึง ${t} → ${start}–${end}`, `${s.name} ${s.startTime}–${s.endTime}`)
}

console.log('\n3) สายตอนเช็คอิน')
for (const [t, late] of [['08:20', false], ['08:45', false], ['08:46', false], ['09:00', false], ['09:15', false], ['09:16', true], ['10:30', true]]) {
  const time = at(t)
  check(lateAtCheckin(time, fixedScheduleShift(time)) === late, `${t} ${late ? 'สาย' : 'ไม่สาย'}`)
}

console.log('\n4) ชั่วโมงตอนเช็คเอาท์ (ผ่าน calculateWorkingHours เหมือนกะจริง)')
{
  const cin = at('08:30'), s = fixedScheduleShift(cin)
  const c = calculateWorkingHours(cin, at('17:30'), office, s)
  check(c.totalHours === 8 && !c.isLate && !c.isEarlyCheckout, 'มา 08:30 ออก 17:30 = 8 ชม. ไม่สาย ไม่ออกก่อน', JSON.stringify(c))
}
{
  const cin = at('09:00'), s = fixedScheduleShift(cin)
  const c = calculateWorkingHours(cin, at('18:00'), office, s)
  check(c.totalHours === 8 && !c.isLate && !c.isEarlyCheckout, 'มา 09:00 ออก 18:00 = 8 ชม.', JSON.stringify(c))
}
{
  const cin = at('08:30'), s = fixedScheduleShift(cin)
  const c = calculateWorkingHours(cin, at('17:00'), office, s)
  check(c.isEarlyCheckout === true, 'มา 08:30 ออก 17:00 = ออกก่อนเลิกงาน (รอบเช้าเลิก 17:30)')
}
{
  const cin = at('08:40'), s = fixedScheduleShift(cin)
  const c = calculateWorkingHours(cin, at('17:30'), office, s)
  check(!c.isLate && !c.isEarlyCheckout, 'มา 08:40 ออก 17:30 = รอบเช้า ไม่สาย ไม่ออกก่อน')
}
{
  const cin = at('09:30'), s = fixedScheduleShift(cin)
  const c = calculateWorkingHours(cin, at('18:00'), office, s)
  check(c.isLate && c.lateMinutes === 15 && !c.isEarlyCheckout, 'มา 09:30 ออก 18:00 = สาย 15 นาทีหลังผ่อนผัน', JSON.stringify(c))
}

console.log('\n5) ลืมเช็คเอาท์ปิดที่เวลาเลิกงานปกติ')
{
  const cin = at('09:00'), s = fixedScheduleShift(cin)
  const end = normalEndTime(cin, s.endTime, 1, s.startTime)
  check(end.getTime() === at('18:00').getTime(), 'รอบ 09:00 เลิก 18:00 วันเดียวกัน')
  check(isForgotCheckout(cin, at('08:10', 1), s.startTime, s.endTime, 1) === true, 'มาปิดเช้าวันรุ่งขึ้น = ลืม')
  check(isForgotCheckout(cin, at('19:30'), s.startTime, s.endTime, 1) === false, 'ปิด 19:30 วันเดียวกัน = ไม่ใช่ลืม')
}
{
  const cin = at('08:30'), s = fixedScheduleShift(cin)
  check(normalEndTime(cin, s.endTime, 1, s.startTime).getTime() === at('17:30').getTime(), 'รอบ 08:30 เลิก 17:30')
}

console.log(`\n${fail === 0 ? '🎉' : '💥'} ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)
