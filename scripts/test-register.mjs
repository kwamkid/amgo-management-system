// ทดสอบการสมัครเป็นพนักงาน — /api/auth/register
//
// รัน (ต้องเปิดเซิร์ฟเวอร์ไว้ก่อน):
//   npm run dev
//   node --env-file=.env.local scripts/test-register.mjs
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// ปลายทางนี้เป็นที่เดียวที่คนนอกสร้างแถวใน users ได้ ถ้าหลวมคือใครก็สมัคร
// เป็นพนักงานได้ และของเดิมหลวมจริง — lineUserId มาจาก query string
// แล้ว POST กลับมาเฉย ๆ ใครยิงเองก็ได้ ไม่ต้องผ่าน LINE สักขั้น
//
// เทสต์นี้ยิงของจริงแต่ "ไม่สร้างบัญชีใหม่" — เคสที่ผ่านด่านตั๋วได้จะไปตกที่
// การตรวจข้อมูลหรือชนกับบัญชีที่มีอยู่แล้วเสมอ

import { createHmac } from 'node:crypto'

// ⚠️ ห้ามใช้ NEXT_PUBLIC_APP_URL เป็นค่าตั้งต้น — ใน .env.local มันคือ URL ของ
//    ระบบจริง เทสต์นี้ยิง POST สมัครสมาชิก เผลอรันแล้วไปโดนของจริงทันที
//    (เจอมาแล้ว) จะยิงที่อื่นต้องพิมพ์ URL มาเองเท่านั้น
const BASE = process.argv[2] || 'http://localhost:3002'
const KEY = process.env.SUPABASE_SECRET_KEY
if (!KEY) throw new Error('ต้องมี SUPABASE_SECRET_KEY (รันด้วย --env-file=.env.local)')

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}`)

/** สร้างตั๋วแบบเดียวกับ lib/supabase/register-ticket.ts */
function ticketFor(userId, { expired = false, tamper = false } = {}) {
  const payload = Buffer.from(
    JSON.stringify({
      u: userId,
      n: 'ทดสอบระบบ',
      p: '',
      e: expired ? Date.now() - 1000 : Date.now() + 600_000,
    })
  ).toString('base64url')
  const sig = createHmac('sha256', tamper ? 'กุญแจผิด' : KEY).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

const VALID_FORM = {
  fullName: 'ทดสอบ ระบบสมัคร',
  nickname: 'เทส',
  phone: '0812345678',
  birthDate: '1990-01-01',
}

async function post(body) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function main() {
  console.log(`\nยิงไปที่ ${BASE}\n`)

  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
    console.log('⏭️  ยิงได้เฉพาะเครื่องตัวเอง — เทสต์นี้สร้างข้อมูลจริงได้\n')
    process.exit(0)
  }

  try {
    await fetch(BASE, { method: 'HEAD' })
  } catch {
    console.log('⏭️  เซิร์ฟเวอร์ยังไม่เปิด — ข้ามเทสต์นี้ (รัน npm run dev ก่อน)\n')
    process.exit(0)
  }

  /* ── ด่านตั๋ว ──────────────────────────────────────────────── */
  head('ตัวตนจาก LINE')

  const noTicket = await post({ userData: VALID_FORM })
  check(noTicket.status === 401, 'ไม่มีตั๋ว = สมัครไม่ได้', `ได้ ${noTicket.status}`)

  const forged = await post({
    userData: VALID_FORM,
    ticket: ticketFor('U_ปลอม_ไม่มีจริง', { tamper: true }),
  })
  check(forged.status === 401, 'ตั๋วที่เซ็นด้วยกุญแจอื่น = สมัครไม่ได้', `ได้ ${forged.status}`)

  const expired = await post({
    userData: VALID_FORM,
    ticket: ticketFor('U_ทดสอบหมดอายุ', { expired: true }),
  })
  check(expired.status === 401, 'ตั๋วหมดอายุ = สมัครไม่ได้', `ได้ ${expired.status}`)

  // ตั๋วปลอมต้องไม่หลุดไปสร้างบัญชี — ถ้า 500 แปลว่าไปไกลกว่าที่ควร
  check(
    [noTicket, forged, expired].every((r) => r.status === 401),
    'ตั๋วที่ใช้ไม่ได้ถูกปฏิเสธก่อนแตะฐานข้อมูล'
  )

  /* ── ด่านข้อมูลที่กรอก (ตั๋วถูกต้อง) ──────────────────────── */
  head('ชื่อจริงกับชื่อเล่นต้องครบ')

  const fresh = `Utest${Date.now()}`
  const withTicket = (form) => post({ userData: form, ticket: ticketFor(fresh) })

  const oneWord = await withTicket({ ...VALID_FORM, fullName: 'winko' })
  check(
    oneWord.status === 400 && /ชื่อและนามสกุล/.test(oneWord.body.error ?? ''),
    'ชื่อคำเดียว (ชื่อ LINE) = สมัครไม่ได้',
    oneWord.body.error
  )

  const noNick = await withTicket({ ...VALID_FORM, nickname: '  ' })
  check(
    noNick.status === 400 && /ชื่อเล่น/.test(noNick.body.error ?? ''),
    'ไม่กรอกชื่อเล่น = สมัครไม่ได้',
    noNick.body.error
  )

  const badPhone = await withTicket({ ...VALID_FORM, phone: '123' })
  check(badPhone.status === 400, 'เบอร์โทรไม่ครบ = สมัครไม่ได้', badPhone.body.error)

  const noBirth = await withTicket({ ...VALID_FORM, birthDate: '' })
  check(noBirth.status === 400, 'ไม่ระบุวันเกิด = สมัครไม่ได้', noBirth.body.error)

  /* ── ตั๋วจริง + ข้อมูลครบ แต่สมัครไปแล้ว ──────────────────── */
  head('สมัครซ้ำ')

  // ใช้ LINE id ของคนที่อยู่ในระบบแล้ว — พิสูจน์ว่าตั๋วที่เซ็นถูกผ่านด่านแรกจริง
  // และไปตกที่ด่าน "สมัครซ้ำ" แทนที่จะสร้างแถวใหม่
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, KEY, {
    auth: { persistSession: false },
  })
  const { data: someone } = await admin
    .from('users')
    .select('line_user_id')
    .eq('is_system', false)
    .limit(1)
    .maybeSingle()

  if (someone?.line_user_id) {
    const before = await admin.from('users').select('id', { count: 'exact', head: true })
    const dup = await post({
      userData: VALID_FORM,
      ticket: ticketFor(someone.line_user_id),
    })
    check(dup.status === 409, 'คนที่สมัครแล้วสมัครซ้ำไม่ได้', `ได้ ${dup.status} · ${dup.body.error ?? ''}`)

    const after = await admin.from('users').select('id', { count: 'exact', head: true })
    check(before.count === after.count, 'เทสต์นี้ไม่ได้สร้างพนักงานใหม่ทิ้งไว้', `${before.count} → ${after.count}`)
  } else {
    console.log('  ⏭️  ไม่มีพนักงานให้ทดสอบเคสสมัครซ้ำ')
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
