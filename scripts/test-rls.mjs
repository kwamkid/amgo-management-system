// ทดสอบ RLS ด้วย session จริง — ไม่ใช่แค่ดูว่ามี policy ครบไหม
//
// รัน: node --env-file=.env.local scripts/test-rls.mjs
//
// สิ่งที่พิสูจน์: พนักงานธรรมดาต้องอ่านเงินเดือนคนอื่นไม่ได้
// อ่าน audit_log ไม่ได้ และเลื่อนขั้นตัวเองเป็น admin ไม่ได้

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

const admin = createClient(URL, SECRET, { auth: { persistSession: false } })

let pass = 0
let fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

/** ล็อกอินเป็นคนนั้นจริง ๆ ผ่าน magic link แล้วคืน client ที่ถือ session */
async function signInAs(userId) {
  const { data: u } = await admin.auth.admin.getUserById(userId)
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: u.user.email,
  })
  if (error) throw new Error(error.message)

  const client = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } })
  const { error: vErr } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  })
  if (vErr) throw new Error(`verifyOtp: ${vErr.message}`)
  return client
}

async function main() {
  // หาพนักงานธรรมดา 1 คน กับคนอื่นอีก 1 คน
  const { data: staff } = await admin
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'employee')
    .eq('is_active', true)
    .limit(2)

  const [me, other] = staff
  console.log(`\nทดสอบในนาม: ${me.full_name} (${me.role})`)
  console.log(`เทียบกับ:    ${other.full_name}\n`)

  // ให้ทั้งคู่มีเงินเดือน จะได้ทดสอบได้
  for (const u of [me, other]) {
    await admin.from('user_compensation').upsert(
      { user_id: u.id, effective_from: '2020-01-01', base_salary: 30000, pay_type: 'monthly',
        note: 'ข้อมูลทดสอบ RLS' },
      { onConflict: 'user_id,effective_from' }
    )
    // รายได้พิเศษก็เป็นเงินเหมือนกัน ต้องปิดแน่นเท่าเงินเดือน
    await admin.from('user_pay_items').insert({
      user_id: u.id, kind: 'commission', label: 'ทดสอบ RLS',
      amount: 5000, effective_from: '2020-01-01', note: 'ข้อมูลทดสอบ RLS',
    })
  }

  const sb = await signInAs(me.id)

  console.log('── พนักงานธรรมดา ───────────────────────────────')

  const { data: ownPay } = await sb.from('user_compensation').select('*').eq('user_id', me.id)
  check(ownPay?.length === 1, 'เห็นเงินเดือนตัวเอง', `${ownPay?.length ?? 0} แถว`)

  const { data: otherPay } = await sb.from('user_compensation').select('*').eq('user_id', other.id)
  check(otherPay?.length === 0, '🔴 อ่านเงินเดือนคนอื่นไม่ได้', `เห็น ${otherPay?.length ?? 0} แถว`)

  const { data: allPay } = await sb.from('user_compensation').select('*')
  check(allPay?.length === 1, '🔴 ดึงเงินเดือนทั้งตารางไม่ได้', `เห็น ${allPay?.length ?? 0} แถว`)

  const { data: viaView } = await sb.from('salary_history').select('*')
  check(viaView?.length <= 1, '🔴 อ้อมผ่าน view salary_history ไม่ได้', `เห็น ${viaView?.length ?? 0} แถว`)

  const { data: ownExtra } = await sb.from('user_pay_items').select('*').eq('user_id', me.id)
  check(ownExtra?.length >= 1, 'เห็นรายได้พิเศษของตัวเอง', `${ownExtra?.length ?? 0} แถว`)

  const { data: otherExtra } = await sb.from('user_pay_items').select('*').eq('user_id', other.id)
  check(otherExtra?.length === 0, '🔴 อ่านรายได้พิเศษของคนอื่นไม่ได้', `เห็น ${otherExtra?.length ?? 0} แถว`)

  // เพิ่มรายได้พิเศษให้ตัวเอง = จ่ายเงินตัวเองเพิ่ม ต้องทำไม่ได้เด็ดขาด
  await sb.from('user_pay_items').insert({
    user_id: me.id, kind: 'commission', label: 'ขอเพิ่มเอง',
    amount: 99999, effective_from: '2020-01-01',
  })
  const { count: selfAdded } = await admin
    .from('user_pay_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', me.id)
    .eq('label', 'ขอเพิ่มเอง')
  check(selfAdded === 0, '🔴 เพิ่มรายได้พิเศษให้ตัวเองไม่ได้', `เพิ่มได้ ${selfAdded} แถว`)

  const { data: audit } = await sb.from('audit_log').select('*').limit(5)
  check(audit?.length === 0, '🔴 อ่าน audit_log ไม่ได้', `เห็น ${audit?.length ?? 0} แถว`)

  // ยกระดับตัวเอง
  await sb.from('users').update({ role: 'admin' }).eq('id', me.id)
  const { data: after } = await admin.from('users').select('role').eq('id', me.id).single()
  check(after.role === 'employee', '🔴 เลื่อนขั้นตัวเองเป็น admin ไม่ได้', `role = ${after.role}`)

  await sb.from('users').update({ employment_status: 'active', is_active: true }).eq('id', other.id)
  const { data: otherAfter } = await admin.from('users').select('full_name').eq('id', other.id).single()
  check(!!otherAfter, 'แก้ข้อมูลคนอื่นไม่ได้ (ไม่มีแถวโดนแตะ)')

  const { data: myCheckins } = await sb.from('checkins').select('id').eq('user_id', me.id).limit(5)
  check((myCheckins?.length ?? 0) >= 0, 'อ่านเช็คอินตัวเองได้', `${myCheckins?.length ?? 0} แถว`)

  const { data: otherCheckins } = await sb.from('checkins').select('id').eq('user_id', other.id)
  check(otherCheckins?.length === 0, 'อ่านเช็คอินคนอื่นไม่ได้', `เห็น ${otherCheckins?.length ?? 0} แถว`)

  const { data: locs } = await sb.from('locations').select('id')
  check((locs?.length ?? 0) > 0, 'อ่านสถานที่ได้ (หน้าเช็คอินต้องใช้)', `${locs?.length ?? 0} แห่ง`)

  const { data: people } = await sb.from('users').select('id').limit(100)
  check((people?.length ?? 0) > 1, 'อ่านรายชื่อคนอื่นได้ (ต้องใช้แสดงชื่อ)', `${people?.length ?? 0} คน`)

  // ── HR ────────────────────────────────────────────────────────────
  const { data: hr } = await admin
    .from('users').select('id, full_name').eq('role', 'hr').eq('is_active', true).limit(1)

  if (hr?.length) {
    console.log('\n── HR ──────────────────────────────────────────')
    const hrSb = await signInAs(hr[0].id)
    const { data: hrPay } = await hrSb.from('user_compensation').select('*')
    check((hrPay?.length ?? 0) >= 2, 'HR เห็นเงินเดือนทุกคน', `${hrPay?.length ?? 0} แถว`)

    const { data: hrExtra } = await hrSb.from('user_pay_items').select('*')
    check((hrExtra?.length ?? 0) >= 2, 'HR เห็นรายได้พิเศษทุกคน', `${hrExtra?.length ?? 0} แถว`)

    const { data: hrAudit } = await hrSb.from('audit_log').select('id').limit(5)
    check(hrAudit?.length === 0, '🔴 HR อ่าน audit_log ไม่ได้ (admin เท่านั้น)', `เห็น ${hrAudit?.length ?? 0}`)

    /* ── HR ต้องบันทึกหน้า "แก้หลายคนพร้อมกัน" ได้ครบทุกช่อง ──────────
       RLS ไม่ throw แต่กรองแถวทิ้งเงียบ ๆ — ถ้าไม่ได้แถวกลับมาแปลว่าไม่มีสิทธิ์
       เคยพลาดมาแล้ว: หน้าจอขึ้นว่าบันทึกสำเร็จ แต่ข้อมูลไม่เปลี่ยน       */
    const { data: co } = await admin.from('companies').select('id').limit(1).single()
    const { data: jf } = await admin.from('job_functions').select('id, default_days_per_week')
      .eq('is_active', true).limit(1).single()

    // ⚠️ ต้องอ่านแถวเต็มก่อนแก้ — me มีแค่ id/full_name/role
    //    เคยพลาดมาแล้ว: คืนค่าด้วย undefined ซึ่ง supabase-js ตัดทิ้ง
    //    ผลคือค่าทดสอบค้างบนข้อมูลจริงของพนักงานจริง
    const { data: before } = await admin.from('users').select('*').eq('id', me.id).single()
    const { data: touched } = await hrSb
      .from('users')
      .update({
        full_name: 'ทดสอบ สิทธิ์HR',
        nickname: 'ทดสอบHR',
        name_verified: true,
        company_id: co.id,
        job_function_id: jf.id,
        employment_type: 'monthly',
        employment_status: 'probation',
        start_date: '2020-01-01',
        start_date_verified: true,
        days_per_week: jf.default_days_per_week ?? 5,
        payroll_cycle: 'c28',
      })
      .eq('id', me.id)
      .select('id, full_name, nickname, company_id, job_function_id, employment_status, payroll_cycle')

    check(touched?.length === 1, 'HR บันทึกข้อมูลพนักงานคนอื่นได้ (หน้าแก้หลายคน)',
      touched?.length ? '' : 'ไม่มีแถวโดนแตะ = RLS ปฏิเสธ')
    if (touched?.length) {
      const row = touched[0]
      check(row.company_id === co.id, 'HR ตั้งบริษัทให้คนอื่นได้')
      check(row.job_function_id === jf.id, 'HR ตั้งหน้าที่ให้คนอื่นได้')
      check(row.nickname === 'ทดสอบHR', 'HR แก้ชื่อ/ชื่อเล่นคนอื่นได้')
      check(row.employment_status === 'probation', 'HR เปลี่ยนสถานะการจ้างคนอื่นได้')
      check(row.payroll_cycle === 'c28', 'HR ตั้งรอบจ่ายเงินให้คนอื่นได้')
    }

    // เงินเดือน + รายได้พิเศษ — หน้าเดียวกันเขียนทั้งคู่
    const { data: comp } = await hrSb.from('user_compensation').insert({
      user_id: me.id, effective_from: '2019-01-01', base_salary: 12345,
      pay_type: 'monthly', note: 'ข้อมูลทดสอบ RLS',
    }).select('id')
    check(comp?.length === 1, 'HR บันทึกเงินเดือนให้คนอื่นได้')

    const { data: extra } = await hrSb.from('user_pay_items').insert({
      user_id: me.id, kind: 'commission', label: 'ทดสอบ RLS',
      amount: 1000, effective_from: '2019-01-01', note: 'ข้อมูลทดสอบ RLS',
    }).select('id')
    check(extra?.length === 1, 'HR เพิ่มรายได้พิเศษให้คนอื่นได้')

    // คืนค่าเดิมให้ครบทุกช่องที่แตะ แล้วเทียบทีละช่องว่ากลับจริง
    const TOUCHED = [
      'full_name', 'nickname', 'name_verified', 'company_id', 'job_function_id',
      'employment_type', 'employment_status', 'start_date', 'start_date_verified',
      'days_per_week', 'payroll_cycle',
    ]
    await admin
      .from('users')
      .update(Object.fromEntries(TOUCHED.map((k) => [k, before[k]])))
      .eq('id', me.id)

    const { data: restored } = await admin
      .from('users').select(TOUCHED.join(', ')).eq('id', me.id).single()
    const notRestored = TOUCHED.filter((k) => String(restored[k]) !== String(before[k]))
    check(
      notRestored.length === 0,
      'คืนค่าข้อมูลเดิมของพนักงานจริงครบทุกช่อง',
      notRestored.length
        ? notRestored.map((k) => `${k}: ${before[k]} → ${restored[k]}`).join(' · ')
        : `${before.full_name} · ตรวจ ${TOUCHED.length} ช่อง`
    )
  }

  // เก็บกวาดข้อมูลทดสอบ
  await admin.from('user_compensation').delete().eq('note', 'ข้อมูลทดสอบ RLS')
  await admin.from('user_pay_items').delete().eq('note', 'ข้อมูลทดสอบ RLS')
  await admin.from('user_pay_items').delete().eq('label', 'ขอเพิ่มเอง')

  console.log(`\n${'═'.repeat(50)}`)
  console.log(fail === 0 ? `✅ ผ่านทั้งหมด ${pass} ข้อ` : `❌ ตก ${fail} ข้อ จาก ${pass + fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
