// ทดสอบรายงานการมาทำงาน — ตรวจกติกาที่ระบบเดิมทำผิด
//
// รัน: node --env-file=.env.local scripts/test-attendance-report.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// รายงานคือสิ่งที่เอาไปคิดค่าแรง ผิดแล้วกระทบเงินคน แต่เป็นส่วนที่
// "ดูด้วยตาแล้วไม่รู้ว่าผิด" เพราะต้องรู้ตารางเวรของแต่ละคนถึงจะบอกได้
//
// ระบบเดิมนับเสาร์-อาทิตย์เป็นวันหยุดของทุกคน ซึ่งผิดกับธุรกิจนี้
// (ร้าน/ห้างเปิด 7 วัน · คลัง จ-ส) คนทำงานเสาร์เลยถูกนับเป็นวันหยุด
// ส่วนคนที่หยุดวันอังคารถูกนับเป็นขาดงาน
//
// สคริปต์นี้อ่านอย่างเดียว ไม่แก้ข้อมูล ไม่ต้องเก็บกวาด

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

const FROM = '2026-07-01'
const TO = '2026-07-31'

async function main() {
  console.log(`\nช่วงที่ตรวจ: ${FROM} ถึง ${TO}\n`)

  // ⚠️ PostgREST ตัดที่ 1,000 แถวเสมอ ต้องไล่ดึงทีละหน้าจนหมด
  //    (เดือนกรกฎามี 1,357 แถว — เรียกทีเดียวจะได้ไม่ครบแล้วไม่มี error บอก)
  const grid = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .rpc('attendance_summary', { p_from: FROM, p_to: TO })
      .range(from, from + 999)
    if (error) throw new Error(`เรียก attendance_summary ไม่สำเร็จ: ${error.message}`)
    grid.push(...data)
    if (data.length < 1000) break
  }

  const { data: countRow } = await admin
    .rpc('attendance_summary', { p_from: FROM, p_to: TO })
    .select('user_id')
  check(grid.length > 0, 'รายงานมีข้อมูล', `${grid.length} แถว`)
  check(
    grid.length > 1000,
    'ดึงข้อมูลเกินเพดาน 1,000 แถวได้ครบ',
    `${grid.length} แถว (เรียกทีเดียวจะได้แค่ ${Math.min(countRow?.length ?? 0, 1000)})`
  )

  /* ── เสาร์-อาทิตย์ต้องไม่ใช่วันหยุดของทุกคน ─────────────── */
  head('วันหยุดตามตารางเวรจริง')

  const weekend = grid.filter((r) => [0, 6].includes(new Date(r.work_date).getDay()))
  const workedOnWeekend = weekend.filter((r) => r.status === 'worked')

  check(
    workedOnWeekend.length > 0,
    'มีคนทำงานเสาร์-อาทิตย์ และถูกนับว่าทำงาน',
    `${workedOnWeekend.length} แถว (ระบบเดิมนับเป็นวันหยุดหมด)`
  )

  const dayOffOnWeekday = grid.filter(
    (r) => r.status === 'day_off' && ![0, 6].includes(new Date(r.work_date).getDay())
  )
  check(
    dayOffOnWeekday.length > 0,
    'มีคนหยุดวันธรรมดา และไม่ถูกนับว่าขาดงาน',
    `${dayOffOnWeekday.length} แถว`
  )

  /* ── คนที่ออกไปแล้วต้องไม่โผล่หลังวันสุดท้าย ────────────── */
  head('คนที่สิ้นสุดการเป็นพนักงาน')

  const { data: ended } = await admin
    .from('users')
    .select('id, full_name, end_date')
    .not('end_date', 'is', null)
    .lt('end_date', FROM)

  const ghosts = grid.filter((r) => ended.some((e) => e.id === r.user_id))
  check(
    ghosts.length === 0,
    'ไม่มีแถวของคนที่ออกไปก่อนช่วงรายงาน',
    ghosts.length ? `เจอ ${ghosts.length} แถว` : `ตรวจ ${ended.length} คน`
  )

  // คนที่ออกกลางช่วง ต้องมีแถวถึงวันสุดท้ายแล้วหยุด
  const { data: endedInRange } = await admin
    .from('users')
    .select('id, full_name, end_date')
    .gte('end_date', FROM)
    .lte('end_date', TO)

  let clipped = true
  for (const e of endedInRange ?? []) {
    const after = grid.filter((r) => r.user_id === e.id && r.work_date > e.end_date)
    if (after.length) {
      clipped = false
      console.log(`     ${e.full_name} ออก ${e.end_date} แต่ยังมี ${after.length} แถวหลังจากนั้น`)
    }
  }
  check(clipped, 'คนที่ออกกลางเดือน รายงานหยุดที่วันสุดท้ายพอดี',
    `ตรวจ ${endedInRange?.length ?? 0} คน`)

  /* ── วันลาต้องไม่ใช่ขาดงาน ───────────────────────────────── */
  head('วันลา')

  const { data: leaveDays } = await admin
    .from('leave_days')
    .select('user_id, leave_date, leave_requests!inner(status)')
    .gte('leave_date', FROM)
    .lte('leave_date', TO)
    .eq('counts_toward_quota', true)

  const approved = (leaveDays ?? []).filter((d) => d.leave_requests.status === 'approved')

  let allLeave = true
  let missing = 0
  for (const d of approved) {
    const row = grid.find((r) => r.user_id === d.user_id && r.work_date === d.leave_date)
    if (!row) { missing++; continue }
    if (row.status === 'absent') {
      allLeave = false
      console.log(`     ${d.leave_date} user ${d.user_id.slice(0, 8)} → ขึ้นเป็นขาดงาน`)
    }
  }
  check(allLeave, 'วันที่ลาไม่ถูกนับเป็นขาดงาน', `ตรวจ ${approved.length} วัน`)
  check(missing === 0, 'ทุกวันลาปรากฏในรายงาน', missing ? `หายไป ${missing} วัน` : '')

  /* ── ชั่วโมงที่ยังไม่ยืนยันต้องไม่ถูกนับ ──────────────────── */
  head('ชั่วโมงที่รอ HR ตรวจ')

  const { data: review } = await admin
    .from('checkins')
    .select('user_id, work_date, total_hours')
    .eq('hours_status', 'needs_review')
    .gte('work_date', FROM)
    .lte('work_date', TO)

  const withHours = (review ?? []).filter((r) => Number(r.total_hours) > 0)
  check(
    withHours.length === 0,
    'แถวที่รอตรวจยังไม่มีชั่วโมงติดมา',
    `ตรวจ ${review?.length ?? 0} แถว`
  )

  /* ── สรุปรายคนต้องบวกกันได้ ──────────────────────────────── */
  head('ความสอดคล้องของยอดรวม')

  const { data: summary, error: sumErr } = await admin.rpc('attendance_period_summary', {
    p_from: FROM,
    p_to: TO,
  })
  if (sumErr) throw new Error(`เรียก attendance_period_summary ไม่สำเร็จ: ${sumErr.message}`)

  // attendance_period_summary ไม่คืน user_id มาด้วย เทียบได้แค่ทางชื่อ
  // ซึ่งเปราะ — ชื่อซ้ำหรือมีช่องว่างท้ายก็จับคู่ไม่ได้แล้ว
  let matches = true
  let unmatched = 0
  for (const s of summary) {
    const rows = grid.filter((r) => r.full_name.trim() === s.full_name.trim())
    if (!rows.length) { unmatched++; continue }
    const worked = rows.filter((r) => r.status === 'worked').length
    if (worked !== s.days_worked) {
      matches = false
      console.log(`     ${s.full_name}: สรุปบอก ${s.days_worked} วัน แต่นับได้ ${worked}`)
    }
  }
  check(matches, 'จำนวนวันทำงานในสรุป ตรงกับที่นับจากรายวัน', `ตรวจ ${summary.length} คน`)
  check(unmatched === 0, 'จับคู่คนในสรุปกับรายวันได้ครบ', unmatched ? `จับคู่ไม่ได้ ${unmatched} คน` : '')

  const negative = summary.filter((s) => Number(s.total_hours) < 0)
  check(negative.length === 0, 'ไม่มีใครมีชั่วโมงติดลบ')

  // ชั่วโมงเกิน 16 ไม่ใช่บั๊กโค้ด แต่เป็นข้อมูลที่ควรมีคนดู
  // (กะข้ามคืนจริง หรือลืมเช็คเอาท์แล้วระบบเก่าเดาให้)
  const overwork = grid.filter((r) => Number(r.total_hours ?? 0) > 16)
  if (overwork.length) {
    console.log(`  ⚠️  มี ${overwork.length} แถวที่ชั่วโมงเกิน 16 — ควรให้ HR ตรวจ`)
    overwork.slice(0, 3).forEach((r) =>
      console.log(`       ${r.work_date} ${r.full_name} = ${r.total_hours} ชม.`)
    )
  } else {
    console.log('  ✓  ไม่มีแถวที่ชั่วโมงเกิน 16')
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
