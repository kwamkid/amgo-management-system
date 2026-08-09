// ทดสอบว่า "เช็คอินจริงผ่านทางที่แอปใช้" ทำงานได้ใต้ RLS
//
// รัน: node --env-file=.env.local scripts/test-checkin-rls.mjs
//
// ต่างจาก test-rls.mjs ตรงที่อันนั้นยิงตารางตรง ๆ ดูว่าอ่านได้/ไม่ได้
// อันนี้เดินตามลำดับที่แอปทำจริง: เช็คอิน → หากะที่เปิดอยู่ → เช็คเอาท์
// เพราะ policy อาจอนุญาต SELECT แต่บล็อก INSERT/UPDATE โดยไม่รู้ตัว

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

const admin = createClient(URL, SECRET, { auth: { persistSession: false } })

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

async function signInAs(userId) {
  const { data: u } = await admin.auth.admin.getUserById(userId)
  const { data: link } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: u.user.email,
  })
  const c = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } })
  const { error } = await c.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  })
  if (error) throw new Error(`verifyOtp: ${error.message}`)
  return c
}

async function main() {
  const { data: staff } = await admin
    .from('users').select('id, full_name')
    .eq('role', 'employee').eq('is_active', true).limit(2)
  const [me, other] = staff

  const { data: loc } = await admin.from('locations').select('id, name').limit(1).single()

  console.log(`\nทดสอบในนาม: ${me.full_name}\n`)
  const sb = await signInAs(me.id)

  const TAG = 'ทดสอบ RLS ผ่าน service'
  // เก็บกวาดของเก่าก่อน เผื่อรอบก่อนค้าง
  await admin.from('checkins').delete().eq('note', TAG)

  console.log('── เส้นทางที่แอปใช้จริง ────────────────────────')

  // 1. เช็คอิน
  const { data: created, error: inErr } = await sb
    .from('checkins')
    .insert({
      user_id: me.id,
      user_name: me.full_name,
      work_date: new Date().toISOString().slice(0, 10),
      checkin_time: new Date().toISOString(),
      checkin_lat: 13.7,
      checkin_lng: 100.5,
      checkin_type: 'onsite',
      primary_location_id: loc.id,
      locations_in_range: [loc.id],
      status: 'checked-in',
      regular_hours: 0,
      overtime_hours: 0,
      break_hours: 0,
      note: TAG,
    })
    .select('id')
    .single()
  check(!inErr && !!created, 'เช็คอินของตัวเองได้', inErr?.message ?? created?.id?.slice(0, 8))

  // 2. หากะที่เปิดอยู่
  const { data: active } = await sb
    .from('checkins').select('*')
    .eq('user_id', me.id).eq('status', 'checked-in').is('checkout_time', null)
  check((active?.length ?? 0) > 0, 'หากะที่ยังเปิดอยู่ของตัวเองเจอ', `${active?.length ?? 0} แถว`)

  // 3. เช็คเอาท์ (แก้แถวที่ยังไม่ปิด — policy อนุญาตเฉพาะกรณีนี้)
  const { error: outErr } = await sb
    .from('checkins')
    .update({
      checkout_time: new Date().toISOString(),
      regular_hours: 8,
      overtime_hours: 0,
      status: 'completed',
    })
    .eq('id', created.id)
  check(!outErr, 'เช็คเอาท์กะของตัวเองได้', outErr?.message ?? '')

  // 4. total_hours ต้องคำนวณเอง
  const { data: done } = await admin
    .from('checkins').select('total_hours').eq('id', created.id).single()
  check(Number(done.total_hours) === 8, 'total_hours คำนวณอัตโนมัติถูกต้อง', `${done.total_hours} ชม.`)

  console.log('\n── สิ่งที่ต้องทำไม่ได้ ─────────────────────────')

  // 5. แก้กะที่ปิดไปแล้ว — ต้องถูกบล็อก (ไม่งั้นแก้ชั่วโมงตัวเองย้อนหลังได้)
  await sb.from('checkins').update({ regular_hours: 99 }).eq('id', created.id)
  const { data: after } = await admin
    .from('checkins').select('regular_hours').eq('id', created.id).single()
  check(Number(after.regular_hours) === 8,
    '🔴 แก้ชั่วโมงกะที่ปิดไปแล้วไม่ได้', `regular_hours = ${after.regular_hours}`)

  // 6. เช็คอินในนามคนอื่น
  const { error: fakeErr } = await sb.from('checkins').insert({
    user_id: other.id,
    user_name: other.full_name,
    work_date: new Date().toISOString().slice(0, 10),
    checkin_time: new Date().toISOString(),
    checkin_lat: 13.7, checkin_lng: 100.5,
    checkin_type: 'onsite', status: 'checked-in',
    regular_hours: 0, overtime_hours: 0, break_hours: 0,
    note: TAG,
  })
  check(!!fakeErr, '🔴 เช็คอินแทนคนอื่นไม่ได้', fakeErr ? 'ถูกบล็อก' : 'ทะลุ!')

  // 7. ลบกะตัวเองทิ้ง (ไม่มี policy delete ให้พนักงาน)
  await sb.from('checkins').delete().eq('id', created.id)
  const { count } = await admin
    .from('checkins').select('id', { count: 'exact', head: true }).eq('id', created.id)
  check(count === 1, '🔴 ลบกะของตัวเองไม่ได้', count === 1 ? 'ยังอยู่' : 'หายไป!')

  console.log('\n── HR ──────────────────────────────────────────')
  const { data: hr } = await admin
    .from('users').select('id, full_name').eq('role', 'hr').eq('is_active', true).limit(1)

  if (hr?.length) {
    const hrSb = await signInAs(hr[0].id)
    const { error: hrErr } = await hrSb
      // constraint manual_checkout_needs_actor บังคับว่าถ้าบอกว่าปิดกะเอง
      // ต้องบอกด้วยว่าใครเป็นคนปิด — ชั่วโมงทำงานคือเงิน ต้องมีชื่อกำกับเสมอ
      .from('checkins').update({
        regular_hours: 7.5,
        manual_checkout: true,
        manual_checkout_by: hr[0].id,
        manual_checkout_at: new Date().toISOString(),
        manual_note: TAG,
      })
      .eq('id', created.id)
    check(!hrErr, 'HR แก้กะที่ปิดแล้วได้ (ต้องได้)', hrErr?.message ?? '')

    const { data: fixed } = await admin
      .from('checkins').select('regular_hours, manual_checkout').eq('id', created.id).single()
    check(Number(fixed.regular_hours) === 7.5 && fixed.manual_checkout,
      'บันทึกว่า HR เป็นคนแก้', `${fixed.regular_hours} ชม. · manual=${fixed.manual_checkout}`)

    // audit_log ต้องจับได้
    const { count: audits } = await admin
      .from('audit_log').select('id', { count: 'exact', head: true })
      .eq('table_name', 'checkins').eq('record_id', created.id)
    check((audits ?? 0) > 0, 'audit_log บันทึกการแก้ไว้', `${audits} รายการ`)
  }

  await admin.from('checkins').delete().eq('note', TAG)
  await admin.from('checkins').delete().eq('manual_note', TAG)

  console.log(`\n${'═'.repeat(50)}`)
  console.log(fail === 0 ? `✅ ผ่านทั้งหมด ${pass} ข้อ` : `❌ ตก ${fail} ข้อ จาก ${pass + fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
