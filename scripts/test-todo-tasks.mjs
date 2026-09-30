// ทดสอบทะเบียน "สิ่งที่ต้องทำ" — lib/todo/tasks.ts
//
// รัน: node --env-file=.env.local scripts/test-todo-tasks.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// กติกานี้ตัดสินว่า "ใครเข้าระบบได้" ถ้าเพี้ยนไปทางเข้มเกิน = ล็อกพนักงาน
// ออกจากระบบทั้งบริษัท  ถ้าหลวมเกิน = ชื่อ LINE หลุดเข้าไปในรายงานอีก
//
// และเงื่อนไขเดียวกันนี้ถูกเขียนซ้ำอีก 2 ที่ที่เป็น SQL (หน้า dashboard ของ HR
// กับ LINE callback) เทสต์นี้จึงยิงฐานข้อมูลจริงมาเทียบด้วยว่าตรงกันไหม —
// ถ้าไม่ตรง จะเกิดอาการ "HR บอกว่าคนนี้ยังไม่ทำ แต่เจ้าตัวเข้าระบบได้ปกติ"

import { createClient } from '@supabase/supabase-js'
import { TODO_TASKS, blockingTodos, needsSetup, pendingTodos } from '../lib/todo/tasks.ts'

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

/** พนักงานสมมติ — ค่าตั้งต้นคือ "ทำครบแล้ว" */
const person = (over = {}) => ({
  id: 'x',
  fullName: 'อนงค์ สุขพลอย',
  nickname: 'แตน',
  nameVerified: true,
  discordUserId: '123456',
  isSystem: false,
  role: 'employee',
  // เพิ่ม 30 ก.ย. 69 — เลขบัญชี · บัตรประชาชน+ที่อยู่ · วันหยุด · แจ้งเตือน
  bankName: 'KBANK',
  bankAccountNo: '1234567890',
  nationalId: '1101700203451',
  address: '99 ถนนพระราม 2 แขวงแสมดำ เขตบางขุนเทียน กรุงเทพฯ',
  needsDayOff: false,
  hasPush: true,
  ...over,
})

async function main() {
  head('คนที่ทำครบแล้ว')
  check(!needsSetup(person()), 'ไม่ถูกบังคับอะไร')
  check(pendingTodos(person()).length === 0, 'ไม่มีรายการค้าง')

  head('คนที่ยังไม่ครบ')

  const cases = [
    ['ยังไม่ยืนยันชื่อจริง', { nameVerified: false }, 'name'],
    ['ไม่มีชื่อเล่น', { nickname: null }, 'name'],
    ['ชื่อเล่นเป็นช่องว่างล้วน', { nickname: '   ' }, 'name'],
    ['ยังไม่ผูก Discord', { discordUserId: undefined }, 'discord'],
    ['ยังไม่มีเลขบัญชี', { bankAccountNo: null }, 'bank'],
    ['ยังไม่เลือกธนาคาร', { bankName: null }, 'bank'],
    ['ยังไม่มีเลขบัตรประชาชน', { nationalId: null }, 'identity'],
    ['ยังไม่มีที่อยู่', { address: '  ' }, 'identity'],
    ['กลุ่ม 6 วันยังไม่มีวันหยุด 1 วัน', { needsDayOff: true }, 'dayoff'],
  ]

  for (const [label, over, expected] of cases) {
    const ids = pendingTodos(person(over)).map((t) => t.id)
    check(ids.includes(expected), `${label} → ต้องขึ้นงาน "${expected}"`, ids.join(', ') || 'ว่าง')
  }

  const all = pendingTodos(
    person({
      nameVerified: false, nickname: '', discordUserId: undefined, bankAccountNo: null,
      nationalId: null, needsDayOff: true, hasPush: false,
    })
  )
  // แจ้งเตือนบังคับเฉพาะบนมือถือ — node ไม่ใช่มือถือ จึงไม่ติดข้อนั้น
  check(all.length === TODO_TASKS.length - 1, 'คนใหม่เอี่ยมติดครบทุกข้อ (ยกเว้นแจ้งเตือนบนคอม)', `${all.length} ข้อ`)
  check(!all.some((t) => t.id === 'push'), 'บนคอมไม่บังคับเปิดแจ้งเตือน')

  // ผู้บริหารไม่ต้องผ่านเรื่องที่เพิ่ม 30 ก.ย. (เจ้าของสั่งเพื่อพนักงาน)
  const adminIds = pendingTodos(person({ role: 'admin', bankAccountNo: null, nationalId: null, needsDayOff: true })).map((t) => t.id)
  check(adminIds.length === 0, 'ผู้บริหารไม่ถูกบังคับเลขบัญชี/บัตร/วันหยุด', adminIds.join(', ') || 'ว่าง')
  check(blockingTodos(person({ nickname: null })).length === 1, 'งานที่บังคับถูกแยกออกมาได้')

  head('ข้อยกเว้น')

  // ถ้าไม่ยกเว้น บัญชีระบบจะเข้าไม่ได้ตอนต้องแก้ปัญหาฉุกเฉิน
  const sys = person({ isSystem: true, nickname: null, discordUserId: undefined })
  check(!needsSetup(sys), 'บัญชีระบบไม่ถูกบังคับ')
  check(pendingTodos(sys).length === 0, 'บัญชีระบบไม่มีรายการค้าง')
  check(pendingTodos(null).length === 0, 'ยังไม่ล็อกอินก็ไม่มีรายการค้าง')

  head('ทะเบียนงาน')

  check(
    TODO_TASKS.every((t) => t.id && t.title && t.why && t.href && t.cta),
    'ทุกงานมีหัวข้อ เหตุผล และปุ่มไปทำต่อครบ'
  )
  check(
    new Set(TODO_TASKS.map((t) => t.id)).size === TODO_TASKS.length,
    'ไม่มี id ซ้ำกัน'
  )

  /* ── ต้องตรงกับที่เขียนเป็น SQL ที่อื่น ─────────────────────── */
  head('เทียบกับข้อมูลจริง')

  const { data: rows, error } = await admin
    .from('users')
    .select('id, full_name, nickname, name_verified, discord_user_id, is_system, role, bank_name, bank_account_no, national_id, address')
    .is('deleted_at', null)
    .eq('is_active', true)

  if (error) throw new Error(`ดึงรายชื่อไม่สำเร็จ: ${error.message}`)

  // กติกาที่ TeamTodoZone กับ LINE callback ใช้ (เขียนเป็น SQL/JS แยกกัน)
  // (วันหยุด/แจ้งเตือนต้องคำนวณจากตารางอื่น — เทียบเฉพาะที่อยู่ในแถว users)
  const sqlRule = (u) =>
    !u.is_system &&
    (!u.name_verified || !u.nickname?.trim() || !u.discord_user_id ||
      (u.role !== 'admin' &&
        (!u.bank_name || !u.bank_account_no?.trim() || !u.national_id?.trim() || !u.address?.trim())))

  // กติกาจากทะเบียน — แปลงแถวดิบเป็นรูปแบบเดียวกับ UserData
  const registryRule = (u) =>
    needsSetup({
      nickname: u.nickname ?? '',
      nameVerified: u.name_verified,
      discordUserId: u.discord_user_id ?? undefined,
      isSystem: u.is_system,
      role: u.role,
      bankName: u.bank_name,
      bankAccountNo: u.bank_account_no,
      nationalId: u.national_id,
      address: u.address,
      needsDayOff: false,
      hasPush: true,
    })

  const mismatch = rows.filter((u) => sqlRule(u) !== registryRule(u))
  check(
    mismatch.length === 0,
    'กติกาในทะเบียนตรงกับที่หน้า HR ใช้ทุกคน',
    mismatch.length ? `ไม่ตรง ${mismatch.length} คน` : `ตรวจ ${rows.length} คน`
  )

  const blocked = rows.filter(registryRule)
  console.log(`  ℹ️  ตอนนี้ ${blocked.length} จาก ${rows.length} คน จะถูกพาไปหน้า /setup`)

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
