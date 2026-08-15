// ทดสอบช่วงงานของรอบจ่ายเงินเดือน
//
// รัน: node scripts/test-payroll-cycle.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// เลขวันมา/ขาด/OT ที่เข้าช่องเงินเดือนมาจากช่วงวันชุดนี้ทั้งหมด ขยับวันเดียว
// = เงินเปลี่ยนทั้งบริษัท และเป็นความผิดที่ "ดูด้วยตาไม่รู้" เพราะต้องรู้ว่า
// ใครอยู่รอบไหนถึงจะบอกได้
//
// กติกาเจ้าของ 15 ส.ค. 69: ตัดยอดก่อนวันจ่าย เอาไว้ทำ report
//   c28 งาน 26 เดือนก่อน – 25 เดือนนี้ · ตัด 25 · จ่าย 28 เดือนนี้
//   c4  งาน 1 – สิ้นเดือนนี้ · ตัดสิ้นเดือน · จ่าย 4 เดือนถัดไป
//
// ป้ายงวด = **เดือนที่ทำงาน** ไม่ใช่เดือนที่เงินออก — เจ้าของยืนยัน 16 ส.ค. 69
// ("งวดที่จ่ายไป 4 ส.ค. มันคืองวด ก.ค.")
//
// สคริปต์นี้เรียกฟังก์ชันตรง ๆ ไม่แตะฐานข้อมูล ไม่ต้องมี env

import {
  cycleWindow,
  cutoffDate,
  payDate,
  isCutoffPassed,
  cycleCutoffToday,
  resolveCycle,
} from '../lib/services/payrollCycle.ts'

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const M = (y, m) => new Date(y, m - 1, 1)

head('c28 — จ่าย 28 ตัด 25')

{
  const w = cycleWindow('c28', M(2026, 8))
  check(ymd(w.from) === '2026-07-26', 'งวด ส.ค. เริ่มนับ 26 ก.ค.', ymd(w.from))
  check(ymd(w.to) === '2026-08-25', 'ตัดยอด 25 ส.ค.', ymd(w.to))
  check(ymd(w.payDate) === '2026-08-28', 'เงินออก 28 ส.ค.', ymd(w.payDate))
}

head('c4 — งานเต็มเดือน ตัดสิ้นเดือน จ่ายวันที่ 4 เดือนถัดไป')

{
  const w = cycleWindow('c4', M(2026, 8))
  check(ymd(w.from) === '2026-08-01', 'งวด ส.ค. เริ่มนับ 1 ส.ค.', ymd(w.from))
  check(ymd(w.to) === '2026-08-31', 'ตัดยอด 31 ส.ค.', ymd(w.to))
  check(ymd(w.payDate) === '2026-09-04', 'เงินออก 4 ก.ย.', ymd(w.payDate))
}

{
  // เคสที่เจ้าของยกมาแก้ความเข้าใจผิด: เงินที่ออก 4 ส.ค. คืองวดกรกฎาคม
  const jul = cycleWindow('c4', M(2026, 7))
  check(ymd(jul.payDate) === '2026-08-04', 'งวด ก.ค. เงินออก 4 ส.ค.', ymd(jul.payDate))
  check(
    ymd(jul.from) === '2026-07-01' && ymd(jul.to) === '2026-07-31',
    'เงินที่จ่าย 4 ส.ค. คืองาน 1–31 ก.ค.',
    `${ymd(jul.from)} – ${ymd(jul.to)}`
  )
}

{
  // เดือนกุมภาพันธ์สั้น — ต้องได้ 28/29 จริง ไม่ใช่ 30
  const w = cycleWindow('c4', M(2026, 2))
  check(ymd(w.to) === '2026-02-28', 'งวด ก.พ. ตัดยอด 28 ก.พ.', ymd(w.to))
  check(ymd(w.payDate) === '2026-03-04', 'งวด ก.พ. เงินออก 4 มี.ค.', ymd(w.payDate))
  const leap = cycleWindow('c4', M(2028, 2))
  check(ymd(leap.to) === '2028-02-29', 'ปีอธิกสุรทินได้ 29 ก.พ.', ymd(leap.to))
  const dec = cycleWindow('c4', M(2026, 12))
  check(ymd(dec.payDate) === '2027-01-04', 'งวด ธ.ค. เงินออก 4 ม.ค. ปีถัดไป', ymd(dec.payDate))
}

head('ไม่มีวันตกหล่นและไม่นับซ้ำ')

for (const cycle of ['c28', 'c4', 'c30', 'eom']) {
  let ok = true
  let detail = ''
  for (let m = 2; m <= 12; m++) {
    const prev = cycleWindow(cycle, M(2026, m - 1))
    const cur = cycleWindow(cycle, M(2026, m))
    const dayAfterPrev = new Date(prev.to.getFullYear(), prev.to.getMonth(), prev.to.getDate() + 1)
    if (ymd(dayAfterPrev) !== ymd(cur.from)) {
      ok = false
      detail = `เดือน ${m}: งวดก่อนจบ ${ymd(prev.to)} งวดนี้เริ่ม ${ymd(cur.from)}`
      break
    }
  }
  check(ok, `${cycle}: งวดต่อกันสนิททั้งปี`, detail)
}

head('เดือนที่ 31 วัน / 30 วัน ไม่ทำ c30 เพี้ยน')

{
  check(ymd(payDate('c30', M(2026, 2))) === '2026-02-28', 'c30 ในเดือน ก.พ. ถอยมาวันสุดท้าย', ymd(payDate('c30', M(2026, 2))))
  check(ymd(cutoffDate('eom', M(2026, 8))) === '2026-08-28', 'eom ตัดก่อนสิ้นเดือน 3 วัน', ymd(cutoffDate('eom', M(2026, 8))))
}

head('ล็อกงวดที่ยังไม่ถึงวันตัด')

{
  // วันตัดยอดของงวด ส.ค. (c28) คือ 25 ส.ค. — ต้องนับทั้งวัน
  check(!isCutoffPassed('c28', M(2026, 8), new Date(2026, 7, 24, 23, 59)), '24 ส.ค. = ยังไม่ตัด')
  check(!isCutoffPassed('c28', M(2026, 8), new Date(2026, 7, 25, 23, 59)), '25 ส.ค. ทั้งวัน = ยังไม่ตัด (ยังทำงานอยู่)')
  check(isCutoffPassed('c28', M(2026, 8), new Date(2026, 7, 26, 0, 1)), '26 ส.ค. = ตัดแล้ว')

  // เคสจริงที่พัง: หน่อยกดบันทึกงวด ก.ย. ตอน 11 ส.ค.
  check(!isCutoffPassed('c28', M(2026, 9), new Date(2026, 7, 11)), '11 ส.ค. บันทึกงวด ก.ย. ไม่ได้ (เคสที่เคยพัง)')
  check(!isCutoffPassed('c4', M(2026, 9), new Date(2026, 7, 11)), '11 ส.ค. บันทึกงวด ก.ย. รอบ c4 ก็ไม่ได้')

  // งวดสิงหาคมของ c4 ยังไม่ปิดจนกว่าจะสิ้นเดือน — แถวที่บันทึกไว้กลางเดือนต้องยังล็อกอยู่
  check(!isCutoffPassed('c4', M(2026, 8), new Date(2026, 7, 16)), '16 ส.ค. งวด ส.ค. รอบ c4 ยังไม่ตัด')
  check(isCutoffPassed('c4', M(2026, 8), new Date(2026, 8, 1)), '1 ก.ย. งวด ส.ค. รอบ c4 ตัดแล้ว')
}

head('cron รู้ว่าวันนี้ต้องตัดงวดไหน')

{
  const c28 = cycleCutoffToday('c28', new Date(2026, 7, 25))
  check(c28 !== null && ymd(c28) === '2026-08-01', '25 ส.ค. → ตัดงวดสิงหาคม (c28)', c28 ? ymd(c28) : 'null')

  const c4 = cycleCutoffToday('c4', new Date(2026, 7, 31))
  check(c4 !== null && ymd(c4) === '2026-08-01', '31 ส.ค. → ตัดงวดสิงหาคม (c4)', c4 ? ymd(c4) : 'null')

  check(cycleCutoffToday('c28', new Date(2026, 7, 26)) === null, '26 ส.ค. ไม่ใช่วันตัดของ c28')
  check(cycleCutoffToday('c4', new Date(2026, 7, 25)) === null, '25 ส.ค. ไม่ใช่วันตัดของ c4')

  // ทุกวันในหนึ่งปี ต้องมีวันตัดของแต่ละรอบพอดีเดือนละครั้ง ไม่ขาดไม่เกิน
  for (const cycle of ['c28', 'c4', 'c30', 'eom']) {
    let hits = 0
    for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
      if (cycleCutoffToday(cycle, new Date(d))) hits++
    }
    check(hits === 12, `${cycle}: ตัดยอดปีละ 12 ครั้งพอดี`, `ได้ ${hits}`)
  }
}

head('รอบของคนนี้')

{
  check(resolveCycle('c4', 'c28') === 'c4', 'ตั้งรายคนชนะตำแหน่ง')
  check(resolveCycle(null, 'c4') === 'c4', 'ไม่ตั้งรายคน = ตามตำแหน่ง')
  check(resolveCycle(null, null) === 'c28', 'ไม่มีทั้งคู่ = c28')
  check(resolveCycle('เละ', null) === 'c28', 'ค่าขยะไม่ทำให้ช่วงวันเพี้ยน')
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
process.exit(fail ? 1 : 0)
