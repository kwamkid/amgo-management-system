// ทดสอบโครงองค์กร — บริษัท · หน้าที่ · รอบจ่ายเงินเดือน
//
// รัน: node --env-file=.env.local scripts/test-org-structure.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// ของเดิมยัด 3 เรื่องไว้ในช่องเดียว (บริษัท + หน้าที่ + สาขา) จนมี 14 หน่วยงาน
// ที่ 8 อันตั้งค่าเหมือนกันเป๊ะ ตอนนี้แยกเป็น 3 แกน:
//   บริษัท   users.company_id
//   หน้าที่  users.job_function_id  ← เป็นตัวกำหนดตารางเวรกับรอบจ่ายเงิน
//   สถานที่  user_allowed_locations
//
// เรื่องที่พลาดง่ายที่สุดคือ "รอบจ่ายวันที่ 30" — เดือนกุมภาไม่มีวันที่ 30
// ถ้าคำนวณตรง ๆ จะได้ 2 มีนาคม คือจ่ายช้าไป 2 วัน และรอบเหลื่อมกันทั้งปี
//
// สคริปต์นี้อ่านอย่างเดียว ไม่แก้ข้อมูล

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

const ymd = (d) => d.toISOString().slice(0, 10)

async function main() {
  /* ── บริษัท ───────────────────────────────────────────────── */
  head('บริษัท')

  const { data: companies } = await admin.from('companies').select('id, code, name_th').order('code')
  check(companies.length === 2, 'มี 2 บริษัท', companies.map((c) => c.code).join(' · '))

  /* ── หน้าที่ ──────────────────────────────────────────────── */
  head('หน้าที่')

  const { data: functions, error: fErr } = await admin
    .from('job_functions')
    .select('id, code, name_th, schedule_type, default_days_per_week, payroll_cycle, is_active')
    .eq('is_active', true)
    .order('sort_order')
  if (fErr) throw new Error(`ดึงหน้าที่ไม่สำเร็จ: ${fErr.message}`)

  check(functions.length > 0, 'มีหน้าที่ให้เลือก', functions.map((f) => f.name_th).join(' · '))

  const { data: cycles } = await admin.from('payroll_cycles').select('code, pay_day, period_start_day, is_active')
  const cycleCodes = new Set(cycles.map((c) => c.code))

  const badCycle = functions.filter((f) => f.payroll_cycle && !cycleCodes.has(f.payroll_cycle))
  check(badCycle.length === 0, 'ทุกหน้าที่อ้างรอบจ่ายที่มีจริง',
    badCycle.map((f) => `${f.name_th}=${f.payroll_cycle}`).join(' · '))

  const noDpw = functions.filter((f) => !f.default_days_per_week)
  check(noDpw.length === 0, 'ทุกหน้าที่มีวัน/สัปดาห์ตั้งไว้',
    noDpw.map((f) => f.name_th).join(' · '))

  // หน้าที่แบบ fixed ต้องมีตารางครบ 7 วัน ไม่งั้นวันที่ขาดจะตกไปใช้ค่าเริ่มต้น
  // จ–ศ ของระบบ ซึ่งอาจไม่ตรงกับหน้าที่นั้นเลย
  const { data: workDays } = await admin
    .from('job_function_work_days')
    .select('job_function_id, day_of_week')

  const daysBy = new Map()
  for (const d of workDays ?? []) {
    daysBy.set(d.job_function_id, (daysBy.get(d.job_function_id) ?? 0) + 1)
  }

  const fixedIncomplete = functions
    .filter((f) => f.schedule_type === 'fixed' && (daysBy.get(f.id) ?? 0) !== 7)
  check(
    fixedIncomplete.length === 0,
    'หน้าที่แบบตารางคงที่ มีครบทั้ง 7 วัน',
    fixedIncomplete.map((f) => `${f.name_th}=${daysBy.get(f.id) ?? 0} วัน`).join(' · ')
  )

  /* ── รอบจ่ายเงินเดือน ─────────────────────────────────────── */
  head('รอบจ่ายเงินเดือน')

  check(cycles.length === 3, 'มี 3 รอบ (28 · สิ้นเดือน · 4)',
    cycles.map((c) => c.code).sort().join(' · '))

  // "สิ้นเดือน" ต้องเป็นทั้งเดือนพอดี ไม่เหลื่อมไปเดือนอื่น
  const { data: feb } = await admin.rpc('payroll_period', {
    p_cycle: 'eom',
    p_pay_month: '2026-02-01',
  })
  check(
    feb?.[0]?.period_start === '2026-02-01' && feb?.[0]?.period_end === '2026-02-28'
      && feb?.[0]?.pay_date === '2026-02-28',
    'สิ้นเดือน ก.พ. = 1–28 ก.พ. จ่าย 28 ก.พ.',
    `${feb?.[0]?.period_start} ถึง ${feb?.[0]?.period_end} จ่าย ${feb?.[0]?.pay_date}`
  )

  // ปีอธิกสุรทินต้องได้ 29 ไม่ใช่ 28
  const { data: leap } = await admin.rpc('payroll_period', {
    p_cycle: 'eom',
    p_pay_month: '2028-02-01',
  })
  check(leap?.[0]?.pay_date === '2028-02-29', 'ปีอธิกสุรทิน จ่าย 29 ก.พ.', leap?.[0]?.pay_date)

  // เดือน 31 วันต้องได้ 31 ไม่ใช่ 30
  const { data: jan } = await admin.rpc('payroll_period', {
    p_cycle: 'eom',
    p_pay_month: '2026-01-01',
  })
  check(jan?.[0]?.pay_date === '2026-01-31', 'เดือน 31 วัน จ่ายวันที่ 31', jan?.[0]?.pay_date)

  /* ── รอบต้องต่อกันสนิท ไม่ขาดไม่ทับ ───────────────────────── */
  let contiguous = true
  let outside = 0
  let prevEndByCycle = new Map()

  for (const c of cycles) {
    for (let i = 0; i < 24; i++) {
      const month = new Date(Date.UTC(2026, i, 1))
      const { data } = await admin.rpc('payroll_period', {
        p_cycle: c.code,
        p_pay_month: ymd(month),
      })
      const row = data?.[0]
      if (!row) continue

      // วันจ่ายต้องอยู่ในเดือนที่ขอเสมอ
      if (row.pay_date.slice(0, 7) !== ymd(month).slice(0, 7)) {
        outside++
        console.log(`     ${c.code} ${ymd(month).slice(0, 7)} → จ่าย ${row.pay_date} (หลุดเดือน)`)
      }

      const prevEnd = prevEndByCycle.get(c.code)
      if (prevEnd) {
        const expected = new Date(`${prevEnd}T00:00:00Z`)
        expected.setUTCDate(expected.getUTCDate() + 1)
        if (row.period_start !== ymd(expected)) {
          contiguous = false
          console.log(`     ${c.code}: รอบก่อนจบ ${prevEnd} แต่รอบใหม่เริ่ม ${row.period_start}`)
        }
      }
      prevEndByCycle.set(c.code, row.period_end)
    }
  }

  check(outside === 0, 'วันจ่ายอยู่ในเดือนที่ขอเสมอ (ตรวจ 24 เดือน × 3 รอบ)')
  check(contiguous, 'รอบเงินเดือนต่อกันสนิท ไม่ขาดไม่ทับ')

  /* ── ใครยังไม่ได้จัด ──────────────────────────────────────── */
  head('ยังต้องกรอก')

  const { data: people } = await admin
    .from('users')
    .select('id, full_name, company_id, job_function_id')
    .is('deleted_at', null)
    .eq('is_system', false)
    .eq('is_active', true)

  const noCompany = people.filter((u) => !u.company_id).length
  const noFunction = people.filter((u) => !u.job_function_id).length
  console.log(`  ℹ️  ยังไม่ระบุบริษัท ${noCompany} คน · ยังไม่ระบุหน้าที่ ${noFunction} คน (จาก ${people.length})`)

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
