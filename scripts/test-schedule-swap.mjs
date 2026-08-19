// ทดสอบกติกาใบสลับวันหยุด
//
// รัน: node scripts/test-schedule-swap.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// ใบสลับวันหยุดไปเปลี่ยน "วันที่ควรมาทำงาน" ซึ่งเป็นตัวตั้งของวันขาด
// และวันขาดเป็นตัวตั้งของเงินเดือน — ปล่อยผ่านผิดใบเดียวคือจ่ายผิด
//
// กติกาเจ้าของ 16 ส.ค. 69:
//   · พนักงานยื่นเอง ระบุทั้งวันมาทำงานและวันหยุดชดเชยตอนยื่น
//   · ทั้งสองวันต้องอยู่งวดจ่ายเดียวกัน
//   · งวดที่ตัดยอดไปแล้วแก้ไม่ได้
//
// สคริปต์นี้เรียกฟังก์ชันตรง ๆ ไม่แตะฐานข้อมูล ไม่ต้องมี env

import { checkSwap } from '../lib/services/scheduleSwapRules.ts'

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

const D = (s) => new Date(`${s}T00:00:00`)
// วันที่ยังไม่ถึงวันตัดยอดของทุกงวดที่ใช้ในเทสต์
const NOW = D('2026-08-16')

const ok = (o) => checkSwap({ now: NOW, ...o })

head('เคสปกติ')

{
  // c4 งวดสิงหา = 1–31 ส.ค. · ทำงานวันหยุด 18 แล้วไปหยุด 20 — งวดเดียวกัน
  const r = ok({ cycle: 'c4', workedDate: D('2026-08-18'), offDate: D('2026-08-20'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r === null, 'PC (c4) สลับ 18 ↔ 20 ส.ค. ผ่าน', r ?? '')
}

{
  // c28 งวดสิงหา = 26 ก.ค. – 25 ส.ค.
  const r = ok({ cycle: 'c28', workedDate: D('2026-08-09'), offDate: D('2026-08-25'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r === null, 'พนักงานทั่วไป (c28) สลับ 9 ↔ 25 ส.ค. ผ่าน', r ?? '')
}

{
  // ยื่นย้อนหลังได้ — ทำงานวันหยุดไปแล้วค่อยมายื่น
  const r = ok({ cycle: 'c28', workedDate: D('2026-08-02'), offDate: D('2026-08-24'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r === null, 'ยื่นย้อนหลัง (ทำงาน 2 ส.ค. ไปแล้ว) ผ่าน', r ?? '')
}

head('ต้องอยู่งวดเดียวกัน')

{
  // c4: 30 ส.ค. อยู่งวดสิงหา · 3 ก.ย. อยู่งวดกันยา
  const r = ok({ cycle: 'c4', workedDate: D('2026-08-30'), offDate: D('2026-09-03'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r !== null, 'c4 ทำงาน 30 ส.ค. → หยุด 3 ก.ย. ต้องไม่ผ่าน')
  check(!!r && r.includes('งวดเดียวกัน'), 'บอกเหตุผลว่าคนละงวด', r ?? '')
}

{
  // c28: 24 ส.ค. อยู่งวดสิงหา (จบ 25) · 27 ส.ค. อยู่งวดกันยา (เริ่ม 26)
  const r = ok({ cycle: 'c28', workedDate: D('2026-08-24'), offDate: D('2026-08-27'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r !== null, 'c28 ห่างกัน 3 วันแต่คร่อมวันตัดยอด ต้องไม่ผ่าน', r ?? '')
}

{
  // ขอบงวดพอดี — c28 งวดกันยาเริ่ม 26 ส.ค. จบ 25 ก.ย.
  const r = ok({ cycle: 'c28', workedDate: D('2026-08-30'), offDate: D('2026-09-20'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r === null, 'c28 ข้ามเดือนแต่อยู่งวดเดียวกัน (30 ส.ค. ↔ 20 ก.ย.) ผ่าน', r ?? '')
}

head('งวดที่ตัดยอดไปแล้ว')

{
  // c28 งวดกรกฎา ตัดยอด 25 ก.ค. — วันนี้ 16 ส.ค. ผ่านมานานแล้ว
  const r = ok({ cycle: 'c28', workedDate: D('2026-07-12'), offDate: D('2026-07-20'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r !== null, 'ยื่นย้อนเข้างวดที่ตัดยอดแล้ว ต้องไม่ผ่าน')
  check(!!r && r.includes('ตัดยอด'), 'บอกว่าตัดยอดไปแล้ว', r ?? '')
}

head('วันที่เลือกต้องสมเหตุสมผล')

{
  const r = ok({ cycle: 'c4', workedDate: D('2026-08-18'), offDate: D('2026-08-18'),
                 workedDateMode: 'off', offDateMode: 'onsite' })
  check(r !== null, 'วันเดียวกันทั้งคู่ ต้องไม่ผ่าน', r ?? '')
}

{
  const r = ok({ cycle: 'c4', workedDate: D('2026-08-19'), offDate: D('2026-08-20'),
                 workedDateMode: 'onsite', offDateMode: 'onsite' })
  check(r !== null, 'วันที่ขอมาทำงานไม่ใช่วันหยุดของเขา ต้องไม่ผ่าน', r ?? '')
}

{
  const r = ok({ cycle: 'c4', workedDate: D('2026-08-18'), offDate: D('2026-08-19'),
                 workedDateMode: 'off', offDateMode: 'off' })
  check(r !== null, 'วันที่ขอไปหยุดเป็นวันหยุดอยู่แล้ว ต้องไม่ผ่าน (กันหยุดฟรี)', r ?? '')
}

{
  // ไม่รู้ตาราง (ส่ง undefined) ก็ยังตรวจเรื่องงวดได้ ไม่ล้ม
  const r = ok({ cycle: 'c4', workedDate: D('2026-08-18'), offDate: D('2026-08-20') })
  check(r === null, 'ไม่ได้ส่งข้อมูลตาราง = ข้ามการตรวจตาราง แต่ยังตรวจงวด', r ?? '')
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)
