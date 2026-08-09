// ทดสอบระบบลาบน Supabase — ทั้งสิทธิ์ (RLS) และการหักโควต้าอัตโนมัติ
//
// รัน: node --env-file=.env.local scripts/test-leave-rls.mjs
//
// เดินตามลำดับที่แอปทำจริง: ยื่นใบลา → HR อนุมัติ → โควต้าถูกหัก
// → ยกเลิก → โควต้าคืน  เพราะจุดที่พังง่ายที่สุดคือ trigger ไม่ทำงานใต้ RLS
// (นโยบายอนุญาต SELECT แต่บล็อก INSERT ที่ trigger ต้องเขียน = โควต้าไม่ขยับ
//  โดยไม่มี error ให้เห็น)

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

const admin = createClient(URL, SECRET, { auth: { persistSession: false } })

let pass = 0,
  fail = 0
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

const YEAR = 2027 // ปีอนาคต — ไม่ชนข้อมูลจริง
const REASON = 'ทดสอบระบบลาอัตโนมัติ'

/** วันลาที่ไม่ชนกับใบลาจริงและไม่มีเช็คอิน (ไม่งั้นโดนกติกา "มาทำงานชนะ") */
const DAY1 = `${YEAR}-11-03`
const DAY2 = `${YEAR}-11-04`

async function cleanup(userId) {
  await admin.from('leave_requests').delete().eq('user_id', userId).eq('reason', REASON)
  await admin.from('leave_quotas').delete().eq('user_id', userId).eq('year', YEAR)
  await admin.from('leave_quota_history').delete().eq('user_id', userId).eq('year', YEAR)
}

const usedOf = async (userId, type) => {
  const { data } = await admin
    .from('leave_quotas')
    .select('total_days, used_days, remaining_days')
    .eq('user_id', userId)
    .eq('year', YEAR)
    .eq('leave_type', type)
    .maybeSingle()
  return data
}

async function main() {
  const { data: staff } = await admin
    .from('users')
    .select('id, full_name')
    .eq('role', 'employee')
    .eq('is_active', true)
    .limit(2)
  const [me, other] = staff

  const { data: hrList } = await admin
    .from('users')
    .select('id, full_name')
    .in('role', ['hr', 'admin'])
    .eq('is_active', true)
    .limit(1)
  const hr = hrList[0]

  console.log(`\nพนักงาน: ${me.full_name}  ·  HR: ${hr.full_name}\n`)

  await cleanup(me.id)

  const sb = await signInAs(me.id)
  const sbHr = await signInAs(hr.id)
  const sbOther = await signInAs(other.id)

  // ── เตรียมโควต้าปีทดสอบ ────────────────────────────────────
  console.log('── โควต้า ─────────────────────────────────────')

  const { error: seedErr } = await sbHr.rpc('seed_leave_quota', {
    p_user_id: me.id,
    p_year: YEAR,
  })
  check(!seedErr, 'HR สร้างโควต้าตั้งต้นได้', seedErr?.message)

  const seeded = await usedOf(me.id, 'sick')
  check(Number(seeded?.total_days) > 0, 'ได้ค่าตั้งต้นจาก leave_type_defaults', `ป่วย ${seeded?.total_days} วัน`)

  // ต้องยิงใส่ "ปีที่มีค่าตั้งต้น + คนที่ยังไม่มีแถว" ถึงจะรู้ว่า RLS กันจริงไหม
  // (ยิงปีที่ไม่มีค่าตั้งต้น ฟังก์ชันจะไม่ insert อะไรเลย แล้วผ่านหลอก ๆ)
  await admin.from('leave_quotas').delete().eq('user_id', other.id).eq('year', YEAR)
  const { error: seedByStaff } = await sb.rpc('seed_leave_quota', {
    p_user_id: other.id,
    p_year: YEAR,
  })
  const { count: sneaked } = await admin
    .from('leave_quotas')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', other.id)
    .eq('year', YEAR)
  check(
    !!seedByStaff || sneaked === 0,
    'พนักงานสร้างโควต้าให้คนอื่นไม่ได้',
    seedByStaff?.message?.slice(0, 60) ?? (sneaked ? `⚠️ สร้างได้ ${sneaked} แถว!` : '')
  )

  const { error: directInsert } = await sb.from('leave_quotas').insert({
    user_id: me.id,
    year: YEAR,
    leave_type: 'vacation',
    total_days: 99,
  })
  check(!!directInsert, 'พนักงานเขียนตารางโควต้าตรง ๆ ไม่ได้', directInsert?.message?.slice(0, 60) ?? '⚠️ เขียนได้!')

  // ── ยื่นใบลา ────────────────────────────────────────────────
  console.log('\n── ยื่นใบลา ───────────────────────────────────')

  const { data: leave, error: createErr } = await sb
    .from('leave_requests')
    .insert({
      user_id: me.id,
      leave_type: 'sick',
      status: 'pending',
      start_date: `${DAY1}T00:00:00Z`,
      end_date: `${DAY2}T00:00:00Z`,
      total_days: 2,
      urgent_multiplier: 1,
      reason: REASON,
      user_name: me.full_name,
    })
    .select('id')
    .single()
  check(!createErr && !!leave, 'ยื่นใบลาของตัวเองได้', createErr?.message)

  const { error: forOtherErr } = await sb.from('leave_requests').insert({
    user_id: other.id,
    leave_type: 'sick',
    status: 'pending',
    start_date: `${DAY1}T00:00:00Z`,
    end_date: `${DAY1}T00:00:00Z`,
    total_days: 1,
    reason: REASON,
    user_name: other.full_name,
  })
  check(!!forOtherErr, 'ยื่นใบลาแทนคนอื่นไม่ได้', forOtherErr?.message?.slice(0, 60) ?? '⚠️ ยื่นได้!')

  const { error: selfApproveErr } = await sb.from('leave_requests').insert({
    user_id: me.id,
    leave_type: 'sick',
    status: 'approved',
    approved_by: me.id,
    start_date: `${DAY1}T00:00:00Z`,
    end_date: `${DAY1}T00:00:00Z`,
    total_days: 1,
    reason: REASON,
    user_name: me.full_name,
  })
  check(!!selfApproveErr, 'ยื่นแล้วอนุมัติตัวเองในทีเดียวไม่ได้', selfApproveErr?.message?.slice(0, 60) ?? '⚠️ ทำได้!')

  const pending = await usedOf(me.id, 'sick')
  check(Number(pending?.used_days) === 0, 'ใบลาที่ยังไม่อนุมัติ ยังไม่หักโควต้า', `ใช้ไป ${pending?.used_days}`)

  const { error: staffApproveErr } = await sb
    .from('leave_requests')
    .update({ status: 'approved', approved_by: me.id })
    .eq('id', leave.id)
  const afterStaffApprove = await usedOf(me.id, 'sick')
  check(
    !!staffApproveErr || Number(afterStaffApprove?.used_days) === 0,
    'พนักงานอนุมัติใบลาตัวเองไม่ได้',
    staffApproveErr?.message?.slice(0, 60) ?? 'นโยบายกรองแถวทิ้ง'
  )

  const { data: otherSees } = await sbOther
    .from('leave_requests')
    .select('id')
    .eq('id', leave.id)
  check(otherSees?.length === 0, 'เพื่อนร่วมงานมองไม่เห็นใบลาของเรา')

  // ── HR อนุมัติ → โควต้าต้องถูกหักเอง ─────────────────────────
  console.log('\n── อนุมัติ (โควต้าคิดโดยฐานข้อมูล) ──────────────')

  const { error: apErr } = await sbHr
    .from('leave_requests')
    .update({
      status: 'approved',
      approved_by: hr.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', leave.id)
    .eq('status', 'pending')
  check(!apErr, 'HR อนุมัติได้', apErr?.message)

  const { data: days } = await admin
    .from('leave_days')
    .select('leave_date, counts_toward_quota')
    .eq('leave_request_id', leave.id)
    .order('leave_date')
  check(days?.length === 2, 'แตกใบลาเป็นรายวันอัตโนมัติ', `${days?.length} วัน`)

  const afterApprove = await usedOf(me.id, 'sick')
  check(Number(afterApprove?.used_days) === 2, 'โควต้าถูกหักเอง ไม่ต้องเขียนโค้ดหัก', `ใช้ไป ${afterApprove?.used_days}`)
  check(
    Number(afterApprove?.remaining_days) === Number(afterApprove?.total_days) - 2,
    'คงเหลือตรงกับ total - used เสมอ (generated column)',
    `เหลือ ${afterApprove?.remaining_days}`
  )

  // ── กติกา "มาทำงานชนะใบลา" ──────────────────────────────────
  console.log('\n── มาทำงานในวันที่ลา ───────────────────────────')

  const { data: loc } = await admin.from('locations').select('id').limit(1).single()
  const { data: ci } = await admin
    .from('checkins')
    .insert({
      user_id: me.id,
      user_name: me.full_name,
      work_date: DAY1,
      checkin_time: `${DAY1}T02:00:00Z`,
      checkin_lat: 13.7,
      checkin_lng: 100.5,
      checkin_type: 'onsite',
      primary_location_id: loc.id,
      locations_in_range: [loc.id],
      status: 'checked-in',
      note: REASON,
    })
    .select('id')
    .single()

  const afterCheckin = await usedOf(me.id, 'sick')
  check(
    Number(afterCheckin?.used_days) === 1,
    'เช็คอินวันที่ลา → คืนโควต้าวันนั้นให้เอง',
    `ใช้ไป ${afterCheckin?.used_days} (เหลือแค่วันที่ไม่ได้มา)`
  )

  // ── ยกเลิกใบที่อนุมัติแล้ว ───────────────────────────────────
  console.log('\n── ยกเลิก ─────────────────────────────────────')

  const { data: cancelledByStaff } = await sb
    .from('leave_requests')
    .update({ status: 'cancelled', cancelled_by: me.id })
    .eq('id', leave.id)
    .eq('status', 'approved')
    .select('id')
  check(
    !cancelledByStaff?.length,
    'พนักงานยกเลิกใบที่อนุมัติแล้วเองไม่ได้',
    cancelledByStaff?.length ? '⚠️ ยกเลิกได้!' : ''
  )

  const { error: cancelErr } = await sbHr
    .from('leave_requests')
    .update({
      status: 'cancelled',
      cancelled_by: hr.id,
      cancelled_at: new Date().toISOString(),
      cancel_reason: REASON,
    })
    .eq('id', leave.id)
  check(!cancelErr, 'HR ยกเลิกใบที่อนุมัติแล้วได้', cancelErr?.message)

  const { count: leftDays } = await admin
    .from('leave_days')
    .select('*', { count: 'exact', head: true })
    .eq('leave_request_id', leave.id)
  check(leftDays === 0, 'ลบวันลาทิ้งตามใบที่ยกเลิก', `เหลือ ${leftDays} แถว`)

  const afterCancel = await usedOf(me.id, 'sick')
  check(Number(afterCancel?.used_days) === 0, 'โควต้าคืนครบเอง', `ใช้ไป ${afterCancel?.used_days}`)

  // ── ข้อมูลอ่อนไหว ───────────────────────────────────────────
  console.log('\n── สิทธิ์การมองเห็น ────────────────────────────')

  const { data: otherQuota } = await sbOther
    .from('leave_quotas')
    .select('user_id')
    .eq('user_id', me.id)
    .eq('year', YEAR)
  check(otherQuota?.length === 0, 'เพื่อนร่วมงานดูโควต้าคนอื่นไม่ได้')

  const { data: hrQuota } = await sbHr
    .from('leave_quotas')
    .select('user_id')
    .eq('user_id', me.id)
    .eq('year', YEAR)
  check(hrQuota?.length > 0, 'HR ดูโควต้าพนักงานได้')

  const { error: staffSetQuota } = await sb
    .from('leave_quotas')
    .update({ total_days: 999 })
    .eq('user_id', me.id)
    .eq('year', YEAR)
    .eq('leave_type', 'sick')
  const tampered = await usedOf(me.id, 'sick')
  check(
    !!staffSetQuota || Number(tampered?.total_days) !== 999,
    'พนักงานเพิ่มโควต้าให้ตัวเองไม่ได้',
    staffSetQuota?.message?.slice(0, 60) ?? 'นโยบายกรองแถวทิ้ง'
  )

  // ── เก็บกวาด ────────────────────────────────────────────────
  if (ci) await admin.from('checkins').delete().eq('id', ci.id)
  await cleanup(me.id)
  await admin.from('leave_quotas').delete().eq('user_id', other.id).eq('year', YEAR)

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`ผ่าน ${pass} · ไม่ผ่าน ${fail}\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error('\n💥', e.message)
  process.exit(1)
})
