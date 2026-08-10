'use server'

// บันทึกข้อมูลพนักงานหลายคนพร้อมกัน
//
// ⚠️ ไฟล์ 'use server' export ได้เฉพาะ async function เท่านั้น
//    ค่าคงที่กับ type อยู่ที่ ./types (เคยพลาดมาแล้ว — ตัวแปรกลายเป็น
//    proxy ของ server action แล้ว ENDED_STATUSES.includes พังตอนรัน)
//
// ── เปลี่ยนจาก secret key มาใช้ session ของ HR ────────────────────────
// ของเดิมเขียนด้วย createAdminClient() ที่ข้าม RLS ได้ทั้งระบบ แล้วกันด้วย
// env flag เอา  ตอนนี้ RLS เสร็จแล้วจึงใช้สิทธิ์ของคนที่กดจริง:
//   · ไม่ใช่ HR = ฐานข้อมูลปฏิเสธเอง ต่อให้เรียก action ตรง ๆ
//   · audit_log บันทึกได้ว่าใครแก้ (secret key ไม่รู้ว่าใคร)

import { revalidatePath } from 'next/cache'
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server'
import { ENDED_STATUSES, type BulkRow, type SaveResult } from './types'

export async function saveBulk(rows: BulkRow[]): Promise<SaveResult> {
  const me = await getCurrentUser()
  if (!me) {
    return { ok: false, updated: 0, salaryRows: 0, errors: ['ยังไม่ได้เข้าสู่ระบบ'] }
  }
  if (!['hr', 'admin'].includes(me.profile.role)) {
    return {
      ok: false,
      updated: 0,
      salaryRows: 0,
      errors: ['ไม่มีสิทธิ์แก้ข้อมูลพนักงาน — เปิดให้เฉพาะฝ่ายบุคคลกับผู้ดูแลระบบ'],
    }
  }

  const sb = await createServerSupabase()
  const errors: string[] = []
  let updated = 0
  let salaryRows = 0

  // ชื่อไว้ขึ้นข้อความผิดพลาด — บอก id 8 ตัวแรกแล้วคนอ่านไม่รู้เรื่อง
  const nameOf = new Map<string, string>()
  const { data: names } = await sb
    .from('users')
    .select('id, full_name')
    .in('id', rows.map((r) => r.id))
  for (const u of names ?? []) nameOf.set(u.id, u.full_name)
  const label = (id: string) => nameOf.get(id) ?? id.slice(0, 8)

  // เงินเดือนปัจจุบันของแต่ละคน — ใช้เทียบว่าเปลี่ยนจริงไหม
  // จะได้ไม่สร้างประวัติซ้ำทุกครั้งที่กดบันทึก
  const { data: current } = await sb
    .from('user_compensation')
    .select('user_id, base_salary, effective_from')
    .order('effective_from', { ascending: false })

  // เก็บวันที่มีผลของแถวล่าสุดด้วย — เวลาแก้ต้องทับ "แถวที่หน้าจอโชว์อยู่"
  const latestSalary = new Map<string, { amount: number; effectiveFrom: string }>()
  for (const c of current ?? []) {
    if (!latestSalary.has(c.user_id)) {
      latestSalary.set(c.user_id, {
        amount: Number(c.base_salary),
        effectiveFrom: c.effective_from,
      })
    }
  }

  for (const r of rows) {
    // ออกไปแล้วต้องมีวันสุดท้าย — ฐานข้อมูลบังคับไว้ ดักตรงนี้ก่อนจะได้
    // บอกเป็นภาษาคนแทนที่จะโยน constraint error ดิบ ๆ ใส่หน้าผู้ใช้
    if (ENDED_STATUSES.includes(r.employment_status) && !r.end_date) {
      errors.push(`${label(r.id)}: ต้องใส่วันสุดท้ายที่ทำงานก่อน ถึงจะเปลี่ยนเป็นสถานะออกได้`)
      continue
    }

    // full_name เป็น NOT NULL — ปล่อยว่างไปจะโดนฐานข้อมูลด่าเป็นภาษาอังกฤษ
    if (!r.full_name?.trim()) {
      errors.push(`${label(r.id)}: ชื่อ-นามสกุลว่างไม่ได้`)
      continue
    }

    const { data: touched, error } = await sb
      .from('users')
      .update({
        full_name: r.full_name.trim().replace(/\s+/g, ' '),
        nickname: r.nickname?.trim() || null,
        name_verified: r.name_verified,
        company_id: r.company_id,
        job_function_id: r.job_function_id,
        employment_type: r.employment_type,
        employment_status: r.employment_status,
        start_date: r.start_date,
        start_date_verified: r.start_date_verified,
        // ยังทำงานอยู่ = ล้างวันสุดท้ายทิ้ง ไม่งั้นค้างจากตอนเคยตั้งเป็นออก
        end_date: ENDED_STATUSES.includes(r.employment_status) ? r.end_date : null,
        days_per_week: r.days_per_week,
        payroll_cycle: r.payroll_cycle,
      })
      .eq('id', r.id)
      .select('id')

    if (error) {
      errors.push(`${label(r.id)}: ${error.message}`)
      continue
    }

    // RLS ไม่ throw แต่กรองแถวทิ้งเงียบ ๆ — ถ้าไม่ได้แถวกลับมาแปลว่าไม่มีสิทธิ์
    if (!touched?.length) {
      errors.push(`${label(r.id)}: บันทึกไม่ผ่าน (ไม่มีสิทธิ์แก้แถวนี้)`)
      continue
    }
    updated++

    // เงินเดือนเก็บแบบมีวันที่มีผล — ขึ้นเงินเดือนคือเพิ่มแถวใหม่ ของเก่าไม่หาย
    //
    // ⚠️ ต้อง upsert ไม่ใช่ insert
    //    ตารางมี unique(user_id, effective_from) พอ HR แก้ตัวเลขผิดแล้วกด
    //    บันทึกซ้ำในวันเดียวกัน insert จะชนแถวเดิมแล้วทั้งใบขึ้นว่า "มีปัญหา"
    //    ทั้งที่ช่องอื่นบันทึกไปแล้ว — ดูเหมือนบันทึกไม่ได้ทั้งหน้า (เจอจริง)
    const prev = latestSalary.get(r.id)
    if (r.base_salary !== null && r.base_salary !== prev?.amount) {
      // ⚠️ ต้องทับ "แถวล่าสุด" ไม่ใช่เขียนลงวันเริ่มงาน
      //    เคยเขียนลง start_date แล้วแพ้แถวที่วันที่ใหม่กว่า — HR แก้เลขไปแล้ว
      //    แต่หน้าจอยังโชว์ค่าเก่า อ่านเหมือนแก้ไม่ได้ (เจอจริง)
      //    ส่วน "ขึ้นเงินเดือน" แบบเก็บประวัติ ทำที่หน้าพนักงานรายคน
      const { error: cErr } = await sb.from('user_compensation').upsert(
        {
          user_id: r.id,
          effective_from:
            prev?.effectiveFrom ?? r.start_date ?? new Date().toISOString().slice(0, 10),
          base_salary: r.base_salary,
          pay_type: r.employment_type,
          note: `บันทึกโดย ${me.profile.full_name}`,
        },
        { onConflict: 'user_id,effective_from' }
      )
      if (cErr) errors.push(`เงินเดือน ${label(r.id)}: ${cErr.message}`)
      else salaryRows++
    }
  }

  revalidatePath('/employees/bulk')
  revalidatePath('/employees')

  return { ok: errors.length === 0, updated, salaryRows, errors }
}
