// ทดสอบว่าเวลาเลิกงาน/ปิดกะคิดเป็นเวลาไทยเสมอ ไม่ว่าเครื่องที่รันจะอยู่เขตไหน
//
// รัน: node scripts/test-checkout-timezone.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// 30 ก.ย. 69: cron ปิดกะรันบน Vercel (UTC) แล้วใช้ setHours(17, 30) ได้
// 17:30 UTC = 00:30 เวลาไทยของวันรุ่งขึ้น — ใบของ 7 คนโชว์ว่าเลิกงานหลัง
// เที่ยงคืนทุกคืน เทสต์เดิมไม่เคยจับได้เพราะรันบนเครื่องที่ตั้งเวลาไทยอยู่แล้ว
//
// สคริปต์นี้รันทุกข้อซ้ำ 2 รอบ: เขตเวลา UTC (แบบ Vercel) กับ Asia/Bangkok
// (แบบมือถือพนักงาน) ผลต้องเป็นเวลาไทยเดียวกันทั้งสองรอบ
// เวลาในเทสต์เขียนพร้อม +07:00 ทุกตัว ไม่พึ่งเขตเวลาเครื่อง · ไม่แตะฐานข้อมูล

import {
  normalEndTime,
  isForgotCheckout,
  calculateWorkingHours,
  autoCheckoutTime,
  bangkokStartOfDay,
  bangkokDayKey,
} from '../lib/services/workingHoursService.ts'

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

const th = (s) => new Date(`${s}+07:00`)
/** แสดงผลเป็นเวลาไทยโดยไม่พึ่งเขตเวลาเครื่อง */
const show = (d) => (d ? new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ') : 'null')
const same = (a, b) => !!a && !!b && a.getTime() === b.getTime()

const MALL = {
  breakHours: 1,
  workingHours: Object.fromEntries(
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => [
      d,
      { open: '10:00', close: '22:00', isClosed: false },
    ])
  ),
}

for (const tz of ['UTC', 'Asia/Bangkok']) {
  // Node อ่าน process.env.TZ ใหม่ทันทีที่กำหนดค่า
  process.env.TZ = tz
  console.log(`\n══ เครื่องตั้งเขตเวลา ${tz} ══`)

  head('เวลาเลิกงานปกติ (เคสจริง 29 ก.ย. 69)')
  {
    // ไกด์ บิ๊ก พี่โด้ กิ่งไผ่ แป้งหมี่ พีช: เข้า ~08:20 กะ 08:30–17:30
    const end = normalEndTime(th('2026-09-29T08:20:00'), '17:30:00', 1, '08:30:00')
    check(same(end, th('2026-09-29T17:30:00')), 'กะ 08:30–17:30 เลิก 17:30 วันเดียวกัน ไม่ใช่ 00:30', show(end))

    // ยิ่ว: เข้า 08:57 กะ 09:00–18:00
    const end2 = normalEndTime(th('2026-09-29T08:57:00'), '18:00:00', 1, '09:00:00')
    check(same(end2, th('2026-09-29T18:00:00')), 'กะ 09:00–18:00 เลิก 18:00 ไม่ใช่ 01:00', show(end2))

    const noShift = normalEndTime(th('2026-09-29T09:00:00'), null, 1)
    check(same(noShift, th('2026-09-29T18:00:00')), 'ไม่มีกะ = เข้า + 8 + พัก 1', show(noShift))

    const overnight = normalEndTime(th('2026-09-29T23:00:00'), '06:00:00', 1, '22:00:00')
    check(same(overnight, th('2026-09-30T06:00:00')), 'กะข้ามคืน 22–06 เลิก 06:00 พรุ่งนี้', show(overnight))
  }

  head('ลืมเช็คเอาท์ = ข้ามวันตามปฏิทินไทย')
  {
    // Min/แตน เข้าตี 4 (= 21:00 UTC ของเมื่อวาน) — ถ้าเทียบวันแบบ UTC จะคิดว่าข้ามวันแล้ว
    const cin = th('2026-09-29T03:59:00')
    check(
      !isForgotCheckout(cin, th('2026-09-29T15:02:00'), '08:30:00', '17:30:00', 1),
      'เข้า 03:59 ออก 15:02 วันเดียวกัน = ไม่ใช่ลืม'
    )
    check(
      !isForgotCheckout(th('2026-09-29T09:00:00'), th('2026-09-29T23:59:00'), '09:00:00', '18:00:00', 1),
      'ออก 23:59 วันเดียวกัน = ไม่ใช่ลืม'
    )
    check(
      isForgotCheckout(th('2026-09-29T09:00:00'), th('2026-09-30T00:01:00'), '09:00:00', '18:00:00', 1),
      'ออก 00:01 วันถัดไป = ลืม'
    )
  }

  head('ชั่วโมง PC ห้างไม่เพี้ยนตามเขตเวลา')
  {
    // เคสที่เจ้าของยืนยันแล้ว: เข้า 09:43 ออก 22:03 → เพดานปิดห้าง 22:00
    const calc = calculateWorkingHours(th('2026-08-14T09:43:00'), th('2026-08-14T22:03:00'), MALL, undefined, false)
    check(calc.totalHours === 11.28 && calc.overtimeHours === 3.28, 'ตัดที่ห้างปิด 22:00 เวลาไทย', `${calc.totalHours}/${calc.overtimeHours}`)
    check(!calc.isOvernightShift, 'ไม่นับเป็นกะข้ามคืน')
  }

  head('cron ปิดกะ 00:05 ปิดที่กี่โมง')
  {
    const now = th('2026-09-30T00:05:00')
    check(same(bangkokStartOfDay(now), th('2026-09-30T00:00:00')), 'เที่ยงคืนวันนี้ = 30 ก.ย. 00:00 เวลาไทย', show(bangkokStartOfDay(now)))
    check(bangkokDayKey(th('2026-09-29T23:59:00')) === '2026-09-29', '23:59 ยังเป็นวันที่ 29')

    const t1 = autoCheckoutTime(th('2026-09-29T08:20:00'), '08:30:00', '17:30:00', 1, now)
    check(same(t1, th('2026-09-29T17:30:00')), 'ลืมเช็คเอาท์ปิดที่ 17:30', show(t1))

    // ดา 29 ก.ย. เข้า 20:00 ไม่มีกะ → เข้า+9 = ตี 5 พรุ่งนี้ ต้องไม่ข้ามวัน
    const t2 = autoCheckoutTime(th('2026-09-29T20:00:00'), null, null, 1, now)
    check(same(t2, th('2026-09-29T23:59:00')), 'ไม่มีกะ เข้าดึก → ปิดไม่เกิน 23:59 วันเดียวกัน', show(t2))

    // เข้าหลังเลิกกะ (กะ 09–18 เข้า 20:00) → ออกหลังเข้า 1 นาที ชั่วโมง 0
    const t3 = autoCheckoutTime(th('2026-09-29T20:00:00'), '09:00:00', '18:00:00', 1, now)
    check(same(t3, th('2026-09-29T20:01:00')), 'เข้าหลังเลิกกะ → เข้า + 1 นาที', show(t3))

    // กะข้ามคืนที่ยังทำงานอยู่ตอน 00:05 — ห้ามตัด
    const t4 = autoCheckoutTime(th('2026-09-29T22:00:00'), '22:00:00', '06:00:00', 1, now)
    check(t4 === null, 'กะ 22–06 ยังไม่ถึงเวลาเลิก → ข้ามไว้รอบหน้า', show(t4))
    const t5 = autoCheckoutTime(th('2026-09-29T22:00:00'), '22:00:00', '06:00:00', 1, th('2026-10-01T00:05:00'))
    check(same(t5, th('2026-09-30T06:00:00')), 'คืนถัดไปค่อยปิดที่ 06:00', show(t5))

    // cron พลาดไปคืนหนึ่ง แล้วมาเก็บตกใบของสองวันก่อน
    const t6 = autoCheckoutTime(th('2026-09-28T20:00:00'), null, null, 1, now)
    check(same(t6, th('2026-09-28T23:59:00')), 'ใบเก่าสองวันปิดที่ 23:59 ของวันนั้นเอง', show(t6))
  }
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)
