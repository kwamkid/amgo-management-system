// ทดสอบว่าพนักงานแก้แถวตัวเองได้แค่ไหน
//
// รัน: node --env-file=.env.local scripts/test-self-edit-guard.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// policy users_update_own อนุญาต "แก้แถวตัวเอง" — แต่ RLS ของ Postgres
// คุมได้แค่ระดับแถว ไม่ใช่ระดับคอลัมน์ แปลว่าพนักงานยิงจากเบราว์เซอร์แล้ว
// ตั้ง role = admin ให้ตัวเองได้ ถ้าไม่มีอะไรกันไว้
//
// ที่กันคือ trigger users_guard_self_edit ซึ่ง "ดันค่าเดิมกลับเงียบ ๆ"
// ไม่ throw error — จึงมองด้วยตาไม่เห็น ต้องเขียนเทสต์เท่านั้น
//
// เทสต์นี้แก้ข้อมูลจริงแล้วคืนค่าเดิมทุกครั้ง

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
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

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

const read = async (id, cols) =>
  (await admin.from('users').select(cols).eq('id', id).single()).data

async function main() {
  const { data: me } = await admin
    .from('users')
    .select('*')
    .eq('role', 'employee')
    .eq('is_active', true)
    .eq('is_system', false)
    .limit(1)
    .single()

  console.log(`\nทดสอบในนาม: ${me.full_name} (${me.role})\n`)
  const original = { ...me }
  const sb = await signInAs(me.id)

  /* ── ห้ามแก้ ───────────────────────────────────────────────── */
  head('คอลัมน์ที่พนักงานต้องแก้ไม่ได้')

  const FORBIDDEN = [
    ['role', 'admin', 'เลื่อนขั้นตัวเองเป็น admin'],
    ['is_active', !me.is_active, 'เปิด/ปิดการใช้งานตัวเอง'],
    ['is_system', true, 'ตั้งตัวเองเป็นบัญชีระบบ (หายจากรายงานทั้งระบบ)'],
    ['employment_status', 'probation', 'เปลี่ยนสถานะการจ้างตัวเอง'],
    ['company_id', null, 'ย้ายบริษัทตัวเอง'],
    ['job_function_id', null, 'เปลี่ยนหน้าที่ตัวเอง (ตารางงาน+รอบจ่าย)'],
    ['wfh_eligible', !me.wfh_eligible, 'ให้สิทธิ์ทำงานที่บ้านตัวเอง'],
    ['home_radius', 99999, 'ขยายรัศมีเช็คอินที่บ้านตัวเอง'],
    ['start_date_verified', !me.start_date_verified, 'ยืนยันวันเริ่มงานตัวเอง'],
    ['deleted_at', new Date().toISOString(), 'ลบตัวเอง'],
  ]

  for (const [col, value, label] of FORBIDDEN) {
    await sb.from('users').update({ [col]: value }).eq('id', me.id)
    const after = await read(me.id, col)
    check(
      String(after[col]) === String(original[col]),
      `🔴 ${label}ไม่ได้`,
      `${col} = ${after[col]}`
    )
  }

  /* ── แก้ได้ ────────────────────────────────────────────────── */
  head('คอลัมน์ที่พนักงานแก้เองได้')

  await sb
    .from('users')
    .update({ full_name: 'ทดสอบ แก้ชื่อเอง', nickname: 'เทสต์', name_verified: true })
    .eq('id', me.id)

  const named = await read(me.id, 'full_name, nickname, name_verified, display_name')
  check(named.full_name === 'ทดสอบ แก้ชื่อเอง', 'แก้ชื่อจริงตัวเองได้', named.full_name)
  check(named.nickname === 'เทสต์', 'แก้ชื่อเล่นตัวเองได้', named.nickname)
  check(named.name_verified === true, 'ทำเครื่องหมายว่ายืนยันชื่อแล้วได้')
  check(
    named.display_name === 'ทดสอบ แก้ชื่อเอง (เทสต์)',
    'ชื่อแสดงผลอัปเดตตามทันที',
    named.display_name
  )

  await admin
    .from('users')
    .update({
      full_name: original.full_name,
      nickname: original.nickname,
      name_verified: original.name_verified,
    })
    .eq('id', me.id)

  const restored = await read(me.id, 'full_name, nickname')
  check(restored.full_name === original.full_name, 'คืนค่าชื่อเดิมเรียบร้อย', restored.full_name)

  /* ── โค้ดฝั่งเซิร์ฟเวอร์ต้องไม่โดนกันไปด้วย ────────────────── */
  head('service key ต้องเขียนได้')

  // ตัวกันเคยเช็คแค่ is_hr() ซึ่ง service key ไม่ผ่าน → /api/users/delete
  // เขียน deleted_at ไม่ติดมาตลอด โดยที่ API ตอบว่าสำเร็จ
  await admin.from('users').update({ is_active: false }).eq('id', me.id)
  const off = await read(me.id, 'is_active')
  check(off.is_active === false, 'ปิดการใช้งานด้วย service key ได้ (soft delete/กู้คืน)')

  await admin.from('users').update({ is_active: original.is_active }).eq('id', me.id)
  const back = await read(me.id, 'is_active')
  check(back.is_active === original.is_active, 'คืนค่าสถานะเดิมเรียบร้อย')

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
