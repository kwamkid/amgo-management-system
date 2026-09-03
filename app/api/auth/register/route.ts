// app/api/auth/register/route.ts
//
// สมัครเป็นพนักงาน — ปลายทางเดียวที่สร้างแถวใน users ได้จากคนนอก
//
// ── ของเดิมเขียนลง Firestore ───────────────────────────────────────────
// ตอนย้ายระบบ ไฟล์นี้ถูกข้ามไป คนที่สมัครใหม่จึงไปโผล่ใน Firestore
// ซึ่งไม่มีใครอ่านแล้ว = สมัครเสร็จแล้วล็อกอินไม่ได้ และไม่มีใครเห็นในระบบ
//
// ── ที่เปลี่ยน ─────────────────────────────────────────────────────────
// 1. เขียนลง Supabase (users + user_allowed_locations)
// 2. ตัวตน LINE มาจาก "ตั๋วที่เซ็นแล้ว" ไม่ใช่ค่าที่เบราว์เซอร์ส่งมาเฉย ๆ
//    ของเดิมยิง POST เองแล้วใส่ lineUserId ของใครก็ได้
// 3. นับโควตาลิงก์เชิญด้วย consume_invite_link — ตรวจกับบวกในคำสั่งเดียว
//    ของเดิมอ่านมาบวกใน JS สองคนกดพร้อมกันแล้วนับหาย ลิงก์ 1 ครั้งใช้ได้ 2 คน
// 4. บังคับชื่อจริง + ชื่อเล่น ตั้งแต่ตอนสมัคร ไม่ให้ชื่อ LINE หลุดเข้าระบบอีก

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAuthUser } from '@/lib/supabase/line-auth'
import { verifyRegisterTicket } from '@/lib/supabase/register-ticket'

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const form = body.userData ?? {}

    /* ── 1. ตัวตนจาก LINE ─────────────────────────────────────────── */
    const ticket = verifyRegisterTicket(body.ticket)
    if (!ticket.ok) {
      return bad(
        ticket.reason === 'expired'
          ? 'หน้าสมัครเปิดค้างไว้นานเกินไป กรุณาเข้าสู่ระบบด้วย LINE ใหม่อีกครั้ง'
          : 'ข้อมูลการยืนยันตัวตนไม่ถูกต้อง กรุณาเข้าสู่ระบบด้วย LINE ใหม่อีกครั้ง',
        401
      )
    }
    const profile = ticket.profile

    /* ── 2. ตรวจข้อมูลที่กรอก ─────────────────────────────────────── */
    const fullName = String(form.fullName ?? '').trim().replace(/\s+/g, ' ')
    const nickname = String(form.nickname ?? '').trim().replace(/\s+/g, ' ')
    const phone = String(form.phone ?? '').trim()
    const birthDate = String(form.birthDate ?? '').trim()

    if (fullName.split(' ').length < 2) return bad('กรุณากรอกทั้งชื่อและนามสกุล')
    if (!nickname) return bad('กรุณากรอกชื่อเล่น')
    if (!/^0\d{9}$/.test(phone)) return bad('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (0xxxxxxxxx)')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return bad('กรุณาระบุวันเกิด')

    const sb = createAdminClient()

    /* ── 3. สมัครซ้ำ ──────────────────────────────────────────────── */
    const { data: existing } = await sb
      .from('users')
      .select('id, deleted_at')
      .eq('line_user_id', profile.userId)
      .maybeSingle()

    if (existing) {
      return bad(
        existing.deleted_at
          ? 'บัญชีนี้ถูกลบไปแล้ว กรุณาติดต่อฝ่ายบุคคล'
          : 'บัญชีนี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบ',
        409
      )
    }

    /* ── 3.5 ชื่อซ้ำกับคนที่มีอยู่แล้ว ────────────────────────────── */
    // LINE คนละ id = ระบบมองเป็นคนละคนเสมอ · ของจริงเจอ 3 ก.ย. 69: พนักงานใหม่
    // สมัคร 2 รอบห่างกัน 17 นาทีด้วย LINE คนละอัน ได้ 2 บัญชีชื่อเดียวกันเป๊ะ
    // แล้วบัญชีหนึ่งไปล็อก Discord ของอีกบัญชีไว้จนสมัครไม่จบ
    //
    // ไม่บล็อกตาย เพราะชื่อ-นามสกุลซ้ำกันจริง ๆ ก็มีได้ — เตือนแล้วให้ยืนยัน
    // อีกครั้ง ส่วนที่เผลอกดสมัครซ้ำจะหยุดตรงนี้เอง
    if (!body.confirmDuplicateName) {
      const { data: sameName } = await sb
        .from('users')
        .select('id, nickname, is_active')
        .eq('full_name', fullName)
        .is('deleted_at', null)
        .limit(1)

      if (sameName?.length) {
        const other = sameName[0]
        return NextResponse.json(
          {
            error:
              `มี "${fullName}" อยู่ในระบบแล้ว` +
              (other.nickname ? ` (ชื่อเล่น ${other.nickname})` : '') +
              (other.is_active ? '' : ' — บัญชีนั้นถูกปิดใช้งานอยู่') +
              '\n\nถ้าเคยสมัครไว้แล้ว ให้ออกแล้วเข้าใหม่ด้วย LINE เดิมที่ใช้สมัครครั้งแรก' +
              '\nถ้าเป็นคนละคนที่ชื่อซ้ำกันพอดี กดยืนยันเพื่อสมัครต่อได้เลย',
            duplicateName: true,
          },
          { status: 409 }
        )
      }
    }

    /* ── 4. ลิงก์เชิญ — ตรวจ+นับในคำสั่งเดียว ─────────────────────── */
    let invite: {
      id: string
      default_role: string
      default_location_ids: string[]
      allow_checkin_outside_location: boolean
      require_approval: boolean
    } | null = null

    const inviteCode = String(body.inviteCode ?? '').trim()
    if (inviteCode) {
      const { data, error } = await sb.rpc('consume_invite_link', { p_code: inviteCode })
      if (error) {
        console.error('consume_invite_link ล้มเหลว:', error.message)
        return bad('ตรวจสอบลิงก์เชิญไม่สำเร็จ', 500)
      }
      // ไม่คืนแถว = ลิงก์หมดอายุ / ครบโควตา / ถูกปิด
      if (!data?.length) return bad('ลิงก์เชิญใช้ไม่ได้แล้ว กรุณาขอลิงก์ใหม่จากฝ่ายบุคคล')
      invite = data[0]
    }

    const role = invite?.default_role ?? 'employee'
    // ไม่มีลิงก์เชิญ = ต้องให้ HR อนุมัติก่อนเสมอ
    const needsApproval = invite ? invite.require_approval !== false : true

    /* ── 5. สร้างบัญชี ────────────────────────────────────────────── */
    const uid = await ensureAuthUser(profile, role)

    const { error: insErr } = await sb.from('users').insert({
      id: uid,
      line_user_id: profile.userId,
      line_display_name: profile.displayName,
      line_picture_url: profile.pictureUrl ?? '',
      full_name: fullName,
      nickname,
      name_verified: true, // เจ้าตัวกรอกเอง ไม่ใช่ชื่อ LINE ที่ลากมา
      phone,
      birth_date: birthDate,
      role,
      employment_status: 'active',
      is_active: !needsApproval,
      needs_approval: needsApproval,
      allow_checkin_outside_location: invite?.allow_checkin_outside_location ?? false,
      invite_link_id: invite?.id ?? null,
      invite_link_code: inviteCode || null,
    })

    if (insErr) {
      console.error('สร้างพนักงานไม่สำเร็จ:', insErr.message)
      return bad('สมัครไม่สำเร็จ กรุณาลองใหม่', 500)
    }

    /* ── 6. สาขาที่เช็คอินได้ตามลิงก์เชิญ ─────────────────────────── */
    const locationIds = invite?.default_location_ids ?? []
    if (locationIds.length) {
      const { error: locErr } = await sb
        .from('user_allowed_locations')
        .insert(locationIds.map((location_id) => ({ user_id: uid, location_id })))
      // สาขาผูกไม่ติดไม่ควรทำให้การสมัครล้มทั้งใบ — HR แก้ทีหลังได้
      if (locErr) console.warn('ผูกสาขาให้พนักงานใหม่ไม่สำเร็จ:', locErr.message)
    }

    return NextResponse.json({
      success: true,
      needsApproval,
      message: needsApproval ? 'สมัครสำเร็จ รอฝ่ายบุคคลอนุมัติ' : 'สมัครสำเร็จ',
    })
  } catch (err) {
    console.error('Registration error:', err)
    return bad('การลงทะเบียนล้มเหลว', 500)
  }
}
