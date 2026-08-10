// ทดสอบชื่อพนักงาน — ชื่อจริง · ชื่อเล่น · ชื่อที่ใช้แสดงผล
//
// รัน: node --env-file=.env.local scripts/test-employee-names.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// ระบบเก่าเก็บ "ชื่อ LINE" เป็นชื่อพนักงาน ซึ่งเป็นชื่อที่เจ้าตัวตั้งเอง
// เช่น "🌨️🌈🌻" · "koโก koโก" · "winko" — เปิดรายงานมาแล้วไม่รู้ว่าใคร
// พอเอาไปคิดค่าแรงหรือส่งให้ผู้จัดการดู ก็ตรวจสอบอะไรไม่ได้เลย
//
// เทสต์นี้เช็คว่าทุกคนมีชื่อจริงกับชื่อเล่นครบ ซึ่งเป็นงานที่ต้องไล่กรอกด้วยมือ
// จึงบอกด้วยว่าเหลือใครบ้าง ไม่ใช่แค่บอกว่าไม่ผ่าน
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

/** สถานะที่แปลว่าออกไปแล้ว — ไม่ต้องไล่กรอกชื่อย้อนหลัง */
const ENDED = ['resigned', 'terminated', 'retired']
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

async function main() {
  const { data: users, error } = await admin
    .from('users')
    .select(
      'id, full_name, nickname, display_name, name_verified, line_display_name, employment_status'
    )
    .is('deleted_at', null)
    .eq('is_system', false)
    .order('full_name')

  if (error) throw new Error(`ดึงรายชื่อไม่สำเร็จ: ${error.message}`)

  const current = users.filter((u) => !ENDED.includes(u.employment_status))
  console.log(`\nพนักงานทั้งหมด ${users.length} คน · ยังทำงานอยู่ ${current.length} คน`)

  /* ── ชื่อจริง ─────────────────────────────────────────────── */
  head('ชื่อจริง')

  const noReal = current.filter((u) => !u.name_verified)
  check(
    noReal.length === 0,
    'ทุกคนที่ยังทำงานอยู่มีชื่อจริงแล้ว',
    noReal.length ? `ยังขาด ${noReal.length} คน` : `ตรวจ ${current.length} คน`
  )
  noReal.forEach((u) => console.log(`       ยังเป็นชื่อ LINE: ${u.line_display_name}`))

  // ยืนยันแล้วแต่ยังเหมือนชื่อ LINE เป๊ะ = มีคนกดผ่านโดยไม่ได้แก้จริง
  const fakeVerified = current.filter(
    (u) => u.name_verified && norm(u.full_name) === norm(u.line_display_name)
  )
  check(
    fakeVerified.length === 0,
    'ไม่มีใครถูกทำเครื่องหมายว่ายืนยันแล้วทั้งที่ยังเป็นชื่อ LINE',
    fakeVerified.map((u) => u.full_name).join(' · ')
  )

  const dirty = users.filter((u) => u.full_name !== norm(u.full_name))
  check(
    dirty.length === 0,
    'ชื่อไม่มีช่องว่างซ้ำหรือเว้นหัวท้าย',
    dirty.map((u) => JSON.stringify(u.full_name)).join(' · ')
  )

  // วงเล็บควรถูกย้ายไปช่องชื่อเล่นหมดแล้ว ถ้ายังค้างแปลว่ามีคนพิมพ์กลับเข้าไป
  const stillParen = users.filter((u) => /\([^()]*\)\s*$/.test(u.full_name))
  check(
    stillParen.length === 0,
    'ไม่มีชื่อเล่นค้างอยู่ในวงเล็บท้ายชื่อจริง',
    stillParen.map((u) => u.full_name).join(' · ')
  )

  /* ── ชื่อเล่น ─────────────────────────────────────────────── */
  head('ชื่อเล่น')

  const noNick = current.filter((u) => !u.nickname?.trim())
  check(
    noNick.length === 0,
    'ทุกคนที่ยังทำงานอยู่มีชื่อเล่นแล้ว',
    noNick.length ? `ยังขาด ${noNick.length} คน` : `ตรวจ ${current.length} คน`
  )
  noNick.forEach((u) => console.log(`       ยังไม่มีชื่อเล่น: ${u.full_name}`))

  // ชื่อเล่นซ้ำไม่ผิดกติกา แต่เปิดรายงานแล้วแยกไม่ออกว่าคนไหน — เตือนเฉย ๆ
  const byNick = new Map()
  for (const u of current.filter((x) => x.nickname?.trim())) {
    const k = u.nickname.trim().toLowerCase()
    byNick.set(k, [...(byNick.get(k) ?? []), u.full_name])
  }
  const dupes = [...byNick.entries()].filter(([, names]) => names.length > 1)
  if (dupes.length) {
    console.log(`  ⚠️  ชื่อเล่นซ้ำ ${dupes.length} ชื่อ — รายงานจะแยกไม่ออกว่าใคร`)
    dupes.forEach(([nick, names]) => console.log(`       "${nick}" = ${names.join(' · ')}`))
  } else {
    console.log('  ✓  ไม่มีชื่อเล่นซ้ำกัน')
  }

  /* ── ชื่อที่ใช้แสดงผล ─────────────────────────────────────── */
  head('ชื่อที่ใช้แสดงผล')

  // display_name เป็นคอลัมน์คำนวณ — ถ้าสูตรเพี้ยนจะเห็นตรงนี้
  const expected = (u) =>
    u.nickname?.trim() ? `${u.full_name} (${u.nickname.trim()})` : u.full_name
  const wrong = users.filter((u) => u.display_name !== expected(u))
  check(
    wrong.length === 0,
    'display_name = "ชื่อจริง (ชื่อเล่น)" ทุกแถว',
    wrong.length ? `ไม่ตรง ${wrong.length} แถว` : `ตรวจ ${users.length} แถว`
  )

  const emptyDisplay = users.filter((u) => !u.display_name?.trim())
  check(emptyDisplay.length === 0, 'ไม่มีใครที่ชื่อแสดงผลว่าง')

  /* ── รายงานต้องเอาชื่อนี้ไปใช้จริง ────────────────────────── */
  head('ชื่อในรายงาน')

  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  const from = new Date(today.getTime() - 30 * 86400_000).toISOString().slice(0, 10)

  const { data: rows, error: rErr } = await admin.rpc('attendance_report', {
    p_from: from,
    p_to: to,
    p_only_present: true,
    p_limit: 200,
    p_offset: 0,
  })
  if (rErr) throw new Error(`เรียก attendance_report ไม่สำเร็จ: ${rErr.message}`)

  const nameInReport = new Map(users.map((u) => [u.id, u.display_name]))
  const mismatched = (rows ?? []).filter(
    (r) => nameInReport.has(r.user_id) && r.full_name !== nameInReport.get(r.user_id)
  )
  check(
    mismatched.length === 0,
    'รายงานใช้ชื่อเดียวกับที่ตั้งไว้ในระบบ',
    mismatched.length
      ? `ไม่ตรง ${mismatched.length} แถว เช่น "${mismatched[0].full_name}"`
      : `ตรวจ ${rows?.length ?? 0} แถว (${from} ถึง ${to})`
  )

  const withNick = (rows ?? []).filter((r) => /\(.+\)\s*$/.test(r.full_name)).length
  console.log(
    `  ✓  รายงาน ${rows?.length ?? 0} แถว มีชื่อเล่นติดมาด้วย ${withNick} แถว`
  )

  /* ── ใครจะเจอหน้าบังคับกรอกตอนล็อกอินครั้งหน้า ──────────── */
  head('สิ่งที่ต้องทำก่อนใช้งาน')

  const { data: gate } = await admin
    .from('users')
    .select('full_name, nickname, name_verified, discord_user_id, line_display_name')
    .is('deleted_at', null)
    .eq('is_system', false)
    .eq('is_active', true)

  // ต้องตรงกับกติกาใน lib/todo/tasks.ts
  const blocked = (gate ?? []).filter(
    (u) => !u.name_verified || !u.nickname?.trim() || !u.discord_user_id
  )
  const byName = blocked.filter((u) => !u.name_verified || !u.nickname?.trim()).length
  const byDiscord = blocked.filter((u) => !u.discord_user_id).length

  console.log(
    `  ℹ️  ${blocked.length} จาก ${gate?.length ?? 0} คน จะเจอหน้า /setup ตอนล็อกอินครั้งหน้า`
  )
  console.log(`       ติดเรื่องชื่อ ${byName} คน · ติดเรื่อง Discord ${byDiscord} คน`)

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
