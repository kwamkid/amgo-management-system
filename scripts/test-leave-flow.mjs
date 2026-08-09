// ทดสอบกติกาการลาแบบครบวงจร — ทำงานกับฐานข้อมูลจริง แต่ไม่ทิ้งขยะไว้
//
// รัน: node --env-file=.env.local scripts/test-leave-flow.mjs
//
// ── ทำไมต้องมีสคริปต์ ไม่ทดสอบมือ ──────────────────────────────────────
// ทดสอบมือบนระบบจริง = ใบลาปลอมค้างในประวัติ · โควตาพนักงานเพี้ยน ·
// audit_log มีร่องรอยที่ไม่ได้เกิดจริง  ลบทีหลังก็ลืมลบบางอย่างเสมอ
//
// สคริปต์นี้:
//   · ใช้ปี 2027 ที่ยังไม่มีข้อมูลจริง
//   · ติดป้าย TAG ทุกแถวที่สร้าง แล้วลบตามป้ายตอนจบ
//   · เก็บกวาดของค้างจากรอบก่อนก่อนเริ่มเสมอ (เผื่อรอบก่อนตายกลางคัน)
//
// ต่างจาก test-leave-rls.mjs: อันนั้นทดสอบ "ใครทำอะไรได้"
// อันนี้ทดสอบ "ตัวเลขถูกไหม" — โควตาหัก คืน ลาด่วนคูณ ลาข้ามปี

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY
const admin = createClient(URL, SECRET, { auth: { persistSession: false } })

const TAG = '__ทดสอบกติกาการลา__'
const YEAR = 2027

let pass = 0, fail = 0
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 44 - t.length))}`)

/* ------------------------------------------------------------------ */
async function cleanup(userId) {
  await admin.from('leave_requests').delete().eq('reason', TAG)
  await admin.from('checkins').delete().eq('note', TAG)
  if (userId) {
    await admin.from('leave_quotas').delete().eq('user_id', userId).eq('year', YEAR)
    await admin.from('leave_quota_history').delete().eq('user_id', userId).eq('year', YEAR)
  }
}

const quotaOf = async (userId, type, year = YEAR) => {
  const { data } = await admin
    .from('leave_quotas')
    .select('total_days, used_days, remaining_days')
    .eq('user_id', userId).eq('year', year).eq('leave_type', type)
    .maybeSingle()
  return data ? {
    total: Number(data.total_days),
    used: Number(data.used_days),
    left: Number(data.remaining_days),
  } : null
}

/** ยื่นใบลาแล้วให้ HR อนุมัติ — เส้นทางเดียวกับที่แอปทำ */
async function submitAndApprove(userId, hrId, { type, from, to, days, urgent = 1 }) {
  const { data: leave, error } = await admin.from('leave_requests').insert({
    user_id: userId, leave_type: type, status: 'pending',
    start_date: `${from}T00:00:00+07:00`, end_date: `${to}T00:00:00+07:00`,
    total_days: days, urgent_multiplier: urgent, reason: TAG, user_name: 'ทดสอบ',
  }).select('id').single()
  if (error) throw new Error(`ยื่นใบลาไม่สำเร็จ: ${error.message}`)

  const { error: apErr } = await admin.from('leave_requests')
    .update({ status: 'approved', approved_by: hrId, approved_at: new Date().toISOString() })
    .eq('id', leave.id)
  if (apErr) throw new Error(`อนุมัติไม่สำเร็จ: ${apErr.message}`)

  return leave.id
}

/* ------------------------------------------------------------------ */
async function main() {
  const { data: staff } = await admin.from('users')
    .select('id, full_name').eq('role', 'employee').eq('is_active', true).limit(1)
  const { data: hrList } = await admin.from('users')
    .select('id, full_name').in('role', ['hr', 'admin']).eq('is_active', true).limit(1)

  const me = staff[0], hr = hrList[0]
  console.log(`\nพนักงาน: ${me.full_name}  ·  ผู้อนุมัติ: ${hr.full_name}`)
  console.log(`ปีที่ใช้ทดสอบ: ${YEAR} (ไม่มีข้อมูลจริง)\n`)

  await cleanup(me.id)
  await admin.rpc('seed_leave_quota', { p_user_id: me.id, p_year: YEAR })

  const base = await quotaOf(me.id, 'sick')
  check(base && base.total > 0, 'ตั้งโควตาตั้งต้นได้', `ป่วย ${base?.total} วัน`)

  /* ── หักโควตาตามจำนวนวันจริง ─────────────────────────────── */
  head('ลาปกติ')
  const id1 = await submitAndApprove(me.id, hr.id,
    { type: 'sick', from: `${YEAR}-03-02`, to: `${YEAR}-03-04`, days: 3 })

  const q1 = await quotaOf(me.id, 'sick')
  check(q1.used === 3, 'ลา 3 วัน หักโควตา 3 วัน', `ใช้ไป ${q1.used}`)
  check(q1.left === base.total - 3, 'คงเหลือลดลงตาม', `เหลือ ${q1.left}`)

  const { count: days1 } = await admin.from('leave_days')
    .select('*', { count: 'exact', head: true }).eq('leave_request_id', id1)
  check(days1 === 3, 'แตกเป็นวันลา 3 แถว', `${days1} แถว`)

  /* ── ลาด่วนคูณโควตา ──────────────────────────────────────── */
  head('ลาด่วน (คิด 2 เท่า)')
  await submitAndApprove(me.id, hr.id,
    { type: 'personal', from: `${YEAR}-03-10`, to: `${YEAR}-03-10`, days: 1, urgent: 2 })

  const qp = await quotaOf(me.id, 'personal')
  check(qp.used === 2, 'ลากิจด่วน 1 วัน หักโควตา 2 วัน', `ใช้ไป ${qp.used}`)

  /* ── มาทำงานในวันที่ลา = คืนโควตา ────────────────────────── */
  head('มาทำงานวันที่ลา')
  const { data: loc } = await admin.from('locations').select('id').limit(1).single()
  await admin.from('checkins').insert({
    user_id: me.id, user_name: me.full_name, work_date: `${YEAR}-03-03`,
    checkin_time: `${YEAR}-03-03T02:00:00Z`, checkin_lat: 13.7, checkin_lng: 100.5,
    checkin_type: 'onsite', primary_location_id: loc.id, locations_in_range: [loc.id],
    status: 'checked-in', note: TAG,
  })

  const q2 = await quotaOf(me.id, 'sick')
  check(q2.used === 2, 'เช็คอิน 1 วัน คืนโควตา 1 วัน', `ใช้ไป ${q2.used} (จาก 3)`)

  const { data: refunded } = await admin.from('leave_days')
    .select('counts_toward_quota, refund_reason')
    .eq('leave_request_id', id1).eq('leave_date', `${YEAR}-03-03`).single()
  check(refunded.counts_toward_quota === false, 'วันนั้นถูกทำเครื่องหมายว่าคืนแล้ว')
  check(!!refunded.refund_reason, 'บันทึกเหตุผลที่คืนไว้ด้วย', refunded.refund_reason?.slice(0, 30))

  /* ── ยกเลิกใบที่อนุมัติแล้ว = คืนหมด ─────────────────────── */
  head('ยกเลิกใบที่อนุมัติแล้ว')
  await admin.from('leave_requests').update({
    status: 'cancelled', cancelled_by: hr.id,
    cancelled_at: new Date().toISOString(), cancel_reason: TAG,
  }).eq('id', id1)

  const q3 = await quotaOf(me.id, 'sick')
  check(q3.used === 0, 'คืนโควตาครบทุกวัน', `ใช้ไป ${q3.used}`)

  const { count: leftDays } = await admin.from('leave_days')
    .select('*', { count: 'exact', head: true }).eq('leave_request_id', id1)
  check(leftDays === 0, 'ลบวันลาทิ้งตามใบที่ยกเลิก', `เหลือ ${leftDays}`)

  /* ── ลาเกินโควตา ─────────────────────────────────────────── */
  head('ลาเกินโควตาที่มี')
  const qv = await quotaOf(me.id, 'vacation')
  let blocked = false
  try {
    await submitAndApprove(me.id, hr.id, {
      type: 'vacation', from: `${YEAR}-06-01`,
      to: `${YEAR}-06-${String(qv.total + 5).padStart(2, '0')}`,
      days: qv.total + 5,
    })
  } catch {
    blocked = true
  }
  const qv2 = await quotaOf(me.id, 'vacation')
  check(blocked || qv2.used <= qv2.total,
    'อนุมัติเกินโควตาไม่ได้ (ฐานข้อมูลกันไว้)',
    blocked ? 'ถูกปฏิเสธ' : `ใช้ไป ${qv2.used}/${qv2.total}`)

  /* ── ลาคร่อมปี ───────────────────────────────────────────── */
  head('ลาคร่อมปีใหม่')
  await admin.rpc('seed_leave_quota', { p_user_id: me.id, p_year: YEAR + 1 })
  await submitAndApprove(me.id, hr.id, {
    type: 'sick', from: `${YEAR}-12-30`, to: `${YEAR + 1}-01-02`, days: 4,
  })

  const endYear = await quotaOf(me.id, 'sick', YEAR)
  const newYear = await quotaOf(me.id, 'sick', YEAR + 1)
  check(endYear.used === 2 && newYear.used === 2,
    'หักโควตาแยกตามปีของแต่ละวัน',
    `${YEAR}: ${endYear.used} วัน · ${YEAR + 1}: ${newYear.used} วัน`)

  /* ── โควตาตรงกับวันลาจริงเสมอ ────────────────────────────── */
  head('ความสอดคล้องของตัวเลข')
  const { data: mismatch } = await admin.rpc('exec_sql_check').then(
    () => ({ data: null }), () => ({ data: null }))

  const { data: allDays } = await admin.from('leave_days')
    .select('leave_date, counts_toward_quota, leave_requests!inner(leave_type, status, urgent_multiplier)')
    .eq('user_id', me.id)

  const expected = {}
  for (const d of allDays ?? []) {
    const r = d.leave_requests
    if (r.status !== 'approved' || !d.counts_toward_quota) continue
    const y = Number(d.leave_date.slice(0, 4))
    const k = `${y}|${r.leave_type}`
    expected[k] = (expected[k] ?? 0) + Number(r.urgent_multiplier)
  }

  let consistent = true
  for (const [k, want] of Object.entries(expected)) {
    const [y, t] = k.split('|')
    const q = await quotaOf(me.id, t, Number(y))
    if (!q || q.used !== want) {
      consistent = false
      console.log(`     ไม่ตรง: ${t} ปี ${y} → ควรเป็น ${want} แต่เป็น ${q?.used}`)
    }
  }
  check(consistent, 'used_days ตรงกับวันลาที่นับจริงทุกปี/ทุกประเภท')
  void mismatch

  /* ── เก็บกวาด ────────────────────────────────────────────── */
  await cleanup(me.id)
  await admin.from('leave_quotas').delete().eq('user_id', me.id).eq('year', YEAR + 1)

  const { count: leftover } = await admin.from('leave_requests')
    .select('*', { count: 'exact', head: true }).eq('reason', TAG)
  check(leftover === 0, 'เก็บกวาดข้อมูลทดสอบครบ ไม่เหลือค้าง', `เหลือ ${leftover}`)

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('\n💥', e.message)
  // ตายกลางคันก็ต้องเก็บกวาด ไม่งั้นข้อมูลทดสอบค้างในระบบจริง
  await cleanup(null)
  process.exit(1)
})
