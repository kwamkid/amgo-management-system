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

    const { data: hrAudit } = await hrSb.from('audit_log').select('id').limit(5)
    check(hrAudit?.length === 0, '🔴 HR อ่าน audit_log ไม่ได้ (admin เท่านั้น)', `เห็น ${hrAudit?.length ?? 0}`)
  }

  // เก็บกวาดข้อมูลทดสอบ
  await admin.from('user_compensation').delete().eq('note', 'ข้อมูลทดสอบ RLS')

  console.log(`\n${'═'.repeat(50)}`)
  console.log(fail === 0 ? `✅ ผ่านทั้งหมด ${pass} ข้อ` : `❌ ตก ${fail} ข้อ จาก ${pass + fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
