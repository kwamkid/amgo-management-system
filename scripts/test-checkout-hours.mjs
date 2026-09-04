// ทดสอบกติกาชั่วโมงตอนเช็คเอาท์ — โดยเฉพาะ "ลืมเช็คเอาท์"
//
// รัน: node scripts/test-checkout-hours.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// กติกา "ลืมเช็คเอาท์ = ปิดที่เวลาเลิกงานปกติ ไม่มีโอที" เคยเขียนไว้ที่
// cron 23:59 ที่เดียว (autoCheckoutService) ซึ่งกวาดเฉพาะกะที่เปิดค้างเกิน
// 12 ชม. — คนเข้าบ่าย/เย็นแล้วลืมจึงรอดตาข่ายไปกดเช็คเอาท์เองเช้าวันรุ่งขึ้น
// แล้วได้ชั่วโมงเต็มดุ้น (ปู 14 ส.ค. 69: เข้า 16:55 ออก 08:48 = 14.87 ชม.
// + โอที 6.87) เจ้าของเห็นเลขนี้ใน Discord แล้วทัก
//
// อีกด้านหนึ่งคือห้ามไปกินโอทีจริงของ PC หน้าร้าน ซึ่งเข้า 09:43 ออก 22:03
// ได้โอที 3.27 ชม. — เจ้าของยืนยันแล้วว่าเลขนั้นถูก เทสต์นี้จึงตรึงทั้งสองฝั่ง
//
// สคริปต์นี้เรียกฟังก์ชันตรง ๆ ไม่แตะฐานข้อมูล ไม่ต้องมี env

import {
  isForgotCheckout,
  normalEndTime,
  calculateWorkingHours,
} from '../lib/services/workingHoursService.ts'

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

const at = (s) => new Date(s)

/** ชั่วโมงที่ระบบจะบันทึกจริง เลียนแบบ checkOut() ใน checkinService */
function hoursFor({ cin, cout, shiftStart = null, shiftEnd = null, location = null }) {
  const breakHours = location?.breakHours ?? 1
  const forgot = isForgotCheckout(at(cin), at(cout), shiftStart, shiftEnd, breakHours)
  const cap = normalEndTime(at(cin), shiftEnd, breakHours)
  const effective = forgot && cap < at(cout) ? cap : at(cout)
  const calc = calculateWorkingHours(
    at(cin),
    effective,
    location ?? { workingHours: {}, breakHours: 1 },
    shiftStart && shiftEnd ? { startTime: shiftStart, endTime: shiftEnd, graceMinutes: 15 } : undefined,
    false
  )
  return forgot
    ? { forgot, regular: calc.regularHours, ot: 0, total: calc.regularHours }
    : { forgot, regular: calc.regularHours, ot: calc.overtimeHours, total: calc.totalHours }
}

const MALL = {
  breakHours: 1,
  workingHours: Object.fromEntries(
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => [
      d,
      { open: '10:00', close: '22:00', isClosed: false },
    ])
  ),
}

head('ลืมเช็คเอาท์ = มากดข้ามวัน')

// เคสจริงที่เจ้าของทัก: ปู 14 ส.ค. 69 WFH ไม่มีกะ
{
  const r = hoursFor({ cin: '2026-08-14T16:55:31', cout: '2026-08-15T08:48:22' })
  check(r.forgot, 'ปู 14 ส.ค. เข้า 16:55 ออก 08:48 = ลืม')
  check(r.ot === 0, 'ลืมแล้วโอทีต้องเป็น 0', `ได้ ${r.ot} (ของเดิม 6.87)`)
  check(r.total === 8, 'ตัดที่เวลาเลิกงาน เข้า+8ชม.+พัก = 8 ชม.', `ได้ ${r.total} (ของเดิม 14.87)`)
}

// กะบ่ายจบ 22:00 แล้วมาปิดตอนเที่ยงวันรุ่งขึ้น
{
  const r = hoursFor({
    cin: '2026-08-12T17:18:21',
    cout: '2026-08-13T13:32:59',
    shiftStart: '13:00:00',
    shiftEnd: '22:00:00',
    location: MALL,
  })
  check(r.forgot, 'กะบ่าย จบ 22:00 มาปิดเที่ยงวันรุ่งขึ้น = ลืม')
  check(r.total === 4, 'นับถึง 22:00 หักพัก = 4 ชม.', `ได้ ${r.total}`)
}

// ค้างข้ามวันหลายวัน
{
  const r = hoursFor({
    cin: '2026-08-08T12:01:18',
    cout: '2026-08-10T10:04:37',
    shiftStart: '10:00:00',
    shiftEnd: '19:00:00',
    location: MALL,
  })
  check(r.forgot, 'ค้าง 46 ชม. ข้าม 2 วัน = ลืม')
  check(r.total <= 8, 'ชั่วโมงต้องไม่เกิน 1 วันงาน', `ได้ ${r.total}`)
}

head('โอทีจริงต้องไม่โดนกิน')

// PC หน้าร้าน — เจ้าของยืนยันว่าเลขนี้ถูก ห้ามเปลี่ยน
{
  const r = hoursFor({
    cin: '2026-08-14T09:43:25',
    cout: '2026-08-14T22:03:49',
    shiftStart: '10:00:00',
    shiftEnd: '19:00:00',
    location: MALL,
  })
  check(!r.forgot, 'PC เข้า 09:43 ออก 22:03 วันเดียวกัน = ไม่ใช่ลืม')
  check(r.ot > 3 && r.ot < 3.5, 'โอทียังอยู่ครบ', `ได้ ${r.ot} ชม.`)
}

// WFH ทำยาวถึงสามทุ่มในวันเดียวกัน
{
  const r = hoursFor({ cin: '2026-08-14T08:42:06', cout: '2026-08-14T21:06:19' })
  check(!r.forgot, 'WFH เข้า 08:42 ออก 21:06 วันเดียวกัน = ไม่ใช่ลืม')
  check(r.ot > 3, 'ชั่วโมงยังนับให้ครบ', `โอที ${r.ot} ชม.`)
}

// คลังเข้าตี 3 ออกบ่าย — ข้ามเที่ยงคืนขาเข้า ไม่ใช่ขาออก
{
  const r = hoursFor({
    cin: '2026-08-13T04:01:07',
    cout: '2026-08-13T16:11:13',
    shiftStart: '03:00:00',
    shiftEnd: '13:00:00',
  })
  check(!r.forgot, 'คลังเข้า 04:01 ออก 16:11 วันเดียวกัน = ไม่ใช่ลืม')
}

head('กะข้ามคืนแท้')

// จบกะ < เริ่มกะ = ข้ามเที่ยงคืนเป็นเรื่องปกติ
{
  const ontime = hoursFor({
    cin: '2026-08-14T22:00:00',
    cout: '2026-08-15T06:10:00',
    shiftStart: '22:00:00',
    shiftEnd: '06:00:00',
  })
  check(!ontime.forgot, 'กะดึก 22:00–06:00 ปิดกะ 06:10 = ไม่ใช่ลืม')

  const late = hoursFor({
    cin: '2026-08-14T22:00:00',
    cout: '2026-08-16T09:00:00',
    shiftStart: '22:00:00',
    shiftEnd: '06:00:00',
  })
  check(late.forgot, 'กะดึกเดียวกัน แต่มาปิดอีกวัน = ลืม')
}

head('ขอบเขต')

{
  const same = hoursFor({ cin: '2026-08-14T09:00:00', cout: '2026-08-14T23:59:00' })
  check(!same.forgot, 'ปิดกะ 23:59 วันเดียวกัน = ยังไม่ใช่ลืม')

  const cross = hoursFor({ cin: '2026-08-14T09:00:00', cout: '2026-08-15T00:01:00' })
  check(cross.forgot, 'ปิดกะ 00:01 ของวันถัดไป = ลืม')

  // เข้าดึกแล้วปิดตอนเช้าโดยยังไม่ถึงเวลาเลิกงาน — ข้ามวันแต่ยังทำงานอยู่จริง
  const stillWorking = hoursFor({ cin: '2026-08-14T23:00:00', cout: '2026-08-15T03:00:00' })
  check(!stillWorking.forgot, 'เข้า 23:00 ออก 03:00 ยังไม่ถึงเวลาเลิกงาน = ไม่ใช่ลืม')
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
head('เช็คอินหลังเลิกงานของกะกลางวัน (มาร์ค 3 ก.ย. 69)')
{
  const cin = at('2026-09-03T18:15:00')
  const end = normalEndTime(cin, '18:00:00', 1, '09:00:00')
  check(end < cin && end.getDate() === 3 && end.getHours() === 18, 'เวลาเลิกงาน 18:00 วันเดียวกัน ไม่เลื่อนไปพรุ่งนี้', end.toString())
  check(isForgotCheckout(cin, at('2026-09-04T11:46:00'), '09:00:00', '18:00:00', 1), 'มาปิดวันรุ่งขึ้น = ลืม')
  check(!isForgotCheckout(cin, at('2026-09-03T20:00:00'), '09:00:00', '18:00:00', 1), 'ปิดวันเดียวกัน = ไม่ใช่ลืม')
  const SHOP = { breakHours: 1, workingHours: Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map((d) => [d, { open: '09:00', close: '18:00', isClosed: false }])) }
  const calc = calculateWorkingHours(cin, end, SHOP, { startTime: '09:00:00', endTime: '18:00:00', graceMinutes: 15 }, false)
  check(calc.regularHours === 0 && calc.overtimeHours === 0 && calc.breakHours === 0, 'ชั่วโมงเป็น 0 ไม่ติดลบ', `${calc.regularHours}/${calc.overtimeHours}/${calc.breakHours}`)
  const late = calculateWorkingHours(cin, at('2026-09-03T20:00:00'), SHOP, { startTime: '09:00:00', endTime: '18:00:00', graceMinutes: 15 }, false)
  check(late.regularHours === 0, 'เข้าหลังร้านปิด ออกวันเดียวกัน = 0 ชม. (เพดานปิดร้าน)', `${late.regularHours}`)
}

head('กะข้ามคืนยังเลื่อนเวลาเลิกงานไปวันถัดไป')
{
  const cin = at('2026-09-03T23:00:00')
  const end = normalEndTime(cin, '06:00:00', 1, '22:00:00')
  check(end.getDate() === 4 && end.getHours() === 6, 'กะ 22–06 เข้า 23:00 เลิก 06:00 พรุ่งนี้', end.toString())
  const legacy = normalEndTime(cin, '06:00:00', 1)
  check(legacy.getDate() === 4, 'ไม่รู้เวลาเริ่มกะ = พฤติกรรมเดิม (เลื่อน)', legacy.toString())
}

process.exit(fail ? 1 : 0)
