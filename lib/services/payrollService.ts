// lib/services/payrollService.ts
//
// สรุปเงินเดือนรายเดือน — รวบข้อมูลจริงมาตั้งต้น แล้วให้ HR กรอกส่วนที่เหลือ
//
//   base_salary  จาก user_compensation แถวล่าสุดที่มีผลแล้ว
//   work/absent  จาก attendance_report() (ตัดวันอนาคตแล้ว)
//   ot_hours     รวม overtime_hours จาก checkins ของเดือนนั้น
//   ot_rate      สูตรมาตรฐาน เงินเดือน/30วัน/8ชม. × 1.5 — แก้รายคนได้
//   commission   ยอดขายเดือนก่อน → HR กรอก หรือกดดึงจากเดือนก่อน
//
// ยอดรวม (total) ฐานข้อมูลคำนวณให้ (generated column) — ไม่มีทางไม่ตรงกับช่องย่อย

import { createClient } from '@/lib/supabase/client'
import { getAttendanceReportForExport } from './reportService'
import { format } from 'date-fns'

const sb = () => createClient()

export type PayTier = { upTo: number | null; percent: number }

/** กติกาค่าตอบแทนผันแปรจาก user_pay_items — ต้องมียอดของเดือนถึงจะคิดเป็นเงินได้ */
export interface VariablePayItem {
  id: string
  label: string
  calc: 'tiered_percent' | 'per_piece'
  /** เรตบาทต่อชิ้น (เฉพาะ per_piece) */
  amount: number
  /** ขั้นบันได (เฉพาะ tiered_percent) */
  tiers: PayTier[] | null
}

export interface PayrollRow {
  userId: string
  employeeCode: number | null
  name: string
  bankName: string | null
  bankAccountNo: string | null
  payrollCycle: string | null
  /** ไว้ให้หน้าจอกรองตามตำแหน่ง */
  jobFunctionId: string | null
  /** งวดจ่ายของบริษัทไหน — คนเดียวมีได้หลายแถวถ้ารายได้พิเศษมาจากอีกบริษัท */
  companyId: string | null
  /** true = แถวต้นสังกัด (เงินเดือน/OT/วันมา-ขาด) · false = แถวบริษัทอื่น จ่ายแค่ค่าคอม/พิเศษ */
  isPrimary: boolean
  baseSalary: number
  workDays: number
  absentDays: number
  otHours: number
  otRate: number
  commission: number
  extra: number
  deduction: number
  note: string
  /** กติกาค่าคอมขั้นบันได/ค่าชิ้นงานของคนนี้ — มีเมื่อไหร่ ช่องค่าคอมจะมีปุ่มกรอกยอด */
  variableItems: VariablePayItem[]
  /** ยอดที่ HR กรอกใน dialog: {pay_item_id: ยอดขายบาท หรือ จำนวนชิ้น} */
  variableInputs: Record<string, number>
  /** แถวนี้เคยบันทึกลงฐานข้อมูลแล้วหรือยัง */
  saved: boolean
}

export const payrollTotal = (r: PayrollRow) =>
  r.baseSalary + Math.round(r.otHours * r.otRate * 100) / 100 + r.commission + r.extra - r.deduction

/** กุญแจประจำแถว — คนเดียวมีหลายแถวได้ (แยกตามบริษัทผู้จ่าย) */
export const rowKey = (r: Pick<PayrollRow, 'userId' | 'companyId'>) =>
  `${r.userId}|${r.companyId ?? ''}`

/** อัตรา OT มาตรฐานไทย: เงินเดือน / 30 วัน / 8 ชม. × 1.5 */
export const standardOtRate = (baseSalary: number) =>
  Math.round((baseSalary / 30 / 8) * 1.5 * 1000) / 1000

/**
 * คิดค่าตอบแทนผันแปรจากยอดที่กรอก
 *   ค่าชิ้นงาน      เรต × จำนวนชิ้น
 *   ค่าคอมขั้นบันได คิดแบบขั้นสะสม — ยอดส่วนที่อยู่ในขั้นไหนใช้ % ของขั้นนั้น
 *                   (ไม่เกิน 100,000 ได้ 2% · เกินจากนั้น 3% → ยอด 150,000
 *                    = 100,000×2% + 50,000×3%)
 */
export function calcVariablePay(item: VariablePayItem, input: number): number {
  if (!input || input <= 0) return 0
  if (item.calc === 'per_piece') return Math.round(item.amount * input * 100) / 100

  let total = 0
  let floor = 0
  for (const t of item.tiers ?? []) {
    const cap = t.upTo ?? Infinity
    const portion = Math.min(input, cap) - floor
    if (portion <= 0) break
    total += portion * (t.percent / 100)
    floor = cap
  }
  return Math.round(total * 100) / 100
}

const monthKey = (month: Date) => format(month, 'yyyy-MM-01')

/**
 * เลขวันมา/ขาดของเดือน — ก้อนเดียวกับหน้ารายงาน (คิดกะหมุนเวียน/เลื่อนวันหยุดแล้ว)
 * แยกออกมาให้หน้า payroll รีเฟรชเฉพาะเลขนี้ได้ หลังแก้ตารางเวรจาก dialog
 * โดยไม่ต้องโหลดทั้งหน้าใหม่ (ค่าคอมที่ HR พิมพ์ค้างอยู่จะได้ไม่หาย)
 */
export async function loadAttendanceDays(
  month: Date
): Promise<Map<string, { work: number; absent: number }>> {
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  // ต้องส่ง showOnlyPresent: false — ค่าปริยายตัดวันขาดทิ้ง แล้วขาดจะเป็น 0 ทุกคน
  const attendance = await getAttendanceReportForExport({
    startDate: from,
    endDate: to,
    showOnlyPresent: false,
  })
  return new Map(
    attendance.summary.map((s) => [s.userId, { work: s.presentDays, absent: s.absentDays }])
  )
}

/**
 * ชั่วโมง OT จริงของเดือน — เฉพาะคนที่มีสิทธิ์ OT (รายคนชนะ ไม่ตั้งก็ตามตำแหน่ง)
 * คนมีสิทธิ์มี entry เสมอ (ไม่มี OT = 0) · คนไม่มีสิทธิ์ไม่มี entry
 * ปุ่ม "อัปเดตจากข้อมูลจริง" ใช้แยกว่าใครให้ระบบทับ ใครคงเลขที่ HR กรอกมือไว้
 */
export async function loadOtHours(month: Date): Promise<Map<string, number>> {
  const client = sb()
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0)

  const [usersRes, fnRes, otRes] = await Promise.all([
    client
      .from('users')
      .select('id, ot_eligible, job_function_id')
      .eq('is_active', true)
      .eq('is_system', false)
      .is('deleted_at', null),
    client.from('job_functions').select('id, ot_eligible'),
    client
      .from('checkins')
      .select('user_id, overtime_hours')
      .gte('work_date', format(from, 'yyyy-MM-dd'))
      .lte('work_date', format(to, 'yyyy-MM-dd'))
      .gt('overtime_hours', 0),
  ])

  const fnOt = new Map((fnRes.data ?? []).map((f) => [f.id, f.ot_eligible]))
  const sums = new Map<string, number>()
  for (const c of otRes.data ?? []) {
    sums.set(c.user_id, (sums.get(c.user_id) ?? 0) + Number(c.overtime_hours))
  }

  const result = new Map<string, number>()
  for (const u of usersRes.data ?? []) {
    const otOk = u.ot_eligible ?? (u.job_function_id ? fnOt.get(u.job_function_id) : false) ?? false
    if (otOk) result.set(u.id, Math.round((sums.get(u.id) ?? 0) * 100) / 100)
  }
  return result
}

/* ------------------------------------------------------------------ */
export async function loadPayroll(month: Date): Promise<PayrollRow[]> {
  const client = sb()
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0)

  const [usersRes, compRes, savedRes, otRes, attendance, fnRes, payItemsRes] = await Promise.all([
    client
      .from('users')
      .select('id, full_name, display_name, employee_code, bank_name, bank_account_no, payroll_cycle, days_per_week, ot_eligible, job_function_id, company_id')
      .eq('is_active', true)
      .eq('is_system', false)
      .is('deleted_at', null)
      .order('employee_code', { ascending: true, nullsFirst: false }),
    // เงินเดือนล่าสุดที่มีผลภายในสิ้นเดือนที่ดู
    client
      .from('user_compensation')
      .select('user_id, base_salary, effective_from')
      .lte('effective_from', format(to, 'yyyy-MM-dd'))
      .order('effective_from', { ascending: false }),
    client.from('payroll_entries').select('*').eq('month', monthKey(month)),
    client
      .from('checkins')
      .select('user_id, overtime_hours')
      .gte('work_date', format(from, 'yyyy-MM-dd'))
      .lte('work_date', format(to, 'yyyy-MM-dd'))
      .gt('overtime_hours', 0),
    // ทั้งช่วง ไม่ใช่แค่หน้าแรก 50 แถว และต้องเอาวันขาดมาด้วย
    // (ค่าปริยายของ attendance_report ตัดวันขาดทิ้ง — ลืมส่งแล้วขาดเป็น 0 ทุกคน)
    getAttendanceReportForExport({ startDate: from, endDate: to, showOnlyPresent: false }),
    client.from('job_functions').select('id, ot_eligible'),
    // กติการายได้พิเศษ — ยอดคงที่เติมช่องพิเศษให้เลย ค่าคอม/ค่าชิ้นงานรอยอดของเดือน
    client.from('user_pay_items').select('id, user_id, label, amount, calc, config, company_id'),
  ])

  const latestSalary = new Map<string, number>()
  for (const c of compRes.data ?? []) {
    if (!latestSalary.has(c.user_id)) latestSalary.set(c.user_id, Number(c.base_salary))
  }

  const otByUser = new Map<string, number>()
  for (const c of otRes.data ?? []) {
    otByUser.set(c.user_id, (otByUser.get(c.user_id) ?? 0) + Number(c.overtime_hours))
  }

  // เลขมา/ขาดใช้ก้อนเดียวกับหน้ารายงาน — คิดกะหมุนเวียน (ควรมา−มาจริง) ให้แล้ว
  const attByUser = new Map(
    attendance.summary.map((s) => [s.userId, { work: s.presentDays, absent: s.absentDays }])
  )

  // งวดที่บันทึกแล้ว — กุญแจ (คน, บริษัท) เพราะคนเดียวมีได้หลายงวด
  const savedByKey = new Map(
    (savedRes.data ?? []).map((s) => [`${s.user_id}|${s.company_id ?? ''}`, s])
  )
  const fnOt = new Map((fnRes.data ?? []).map((f) => [f.id, f.ot_eligible]))

  const itemsByUser = new Map<string, NonNullable<typeof payItemsRes.data>>()
  for (const p of payItemsRes.data ?? []) {
    const list = itemsByUser.get(p.user_id) ?? []
    list.push(p)
    itemsByUser.set(p.user_id, list)
  }

  const toVarItem = (p: NonNullable<typeof payItemsRes.data>[number]): VariablePayItem => ({
    id: p.id,
    label: p.label,
    calc: p.calc as VariablePayItem['calc'],
    amount: Number(p.amount),
    tiers: ((p.config as { tiers?: PayTier[] } | null)?.tiers ?? null) as PayTier[] | null,
  })

  const rows: PayrollRow[] = []
  for (const u of usersRes.data ?? []) {
    const primaryC = u.company_id as string | null
    const items = itemsByUser.get(u.id) ?? []

    // แยกรายการตามบริษัทผู้จ่าย — null บนตัวรายการ = ตามต้นสังกัด
    const byCompany = new Map<string | null, typeof items>()
    for (const p of items) {
      const c = (p.company_id ?? primaryC) as string | null
      const list = byCompany.get(c) ?? []
      list.push(p)
      byCompany.set(c, list)
    }

    const base = (companyItems: typeof items | undefined) => ({
      fixed: (companyItems ?? [])
        .filter((p) => p.calc === 'fixed')
        .reduce((s, p) => s + Number(p.amount), 0),
      variable: (companyItems ?? []).filter((p) => p.calc !== 'fixed').map(toVarItem),
    })

    // ── แถวหลัก: งวดของต้นสังกัด — เงินเดือน/OT/วันมา-ขาด อยู่ที่นี่ ──
    {
      const saved = savedByKey.get(`${u.id}|${primaryC ?? ''}`)
      const salary = saved ? Number(saved.base_salary) : (latestSalary.get(u.id) ?? 0)
      const att = attByUser.get(u.id)
      // สิทธิ์ OT: รายคนชนะ ไม่ตั้งก็ตามตำแหน่ง — ไม่มีสิทธิ์ = ไม่เติมชั่วโมงให้
      const otOk =
        u.ot_eligible ?? (u.job_function_id ? fnOt.get(u.job_function_id) : false) ?? false
      const own = base(byCompany.get(primaryC))
      rows.push({
        userId: u.id,
        employeeCode: u.employee_code,
        name: u.display_name || u.full_name,
        bankName: u.bank_name,
        bankAccountNo: u.bank_account_no,
        payrollCycle: u.payroll_cycle,
        jobFunctionId: u.job_function_id,
        companyId: primaryC,
        isPrimary: true,
        baseSalary: salary,
        workDays: saved ? Number(saved.work_days) : (att?.work ?? 0),
        absentDays: saved ? Number(saved.absent_days) : (att?.absent ?? 0),
        otHours: saved
          ? Number(saved.ot_hours)
          : otOk
            ? Math.round((otByUser.get(u.id) ?? 0) * 100) / 100
            : 0,
        otRate: saved ? Number(saved.ot_rate) : standardOtRate(salary),
        commission: saved ? Number(saved.commission) : 0,
        // รายได้พิเศษยอดคงที่ (ค่าตำแหน่ง/ค่าเดินทาง ฯลฯ) เติมให้เลยทุกเดือน
        extra: saved ? Number(saved.extra) : own.fixed,
        deduction: saved ? Number(saved.deduction) : 0,
        note: saved?.note ?? '',
        variableItems: own.variable,
        variableInputs: (saved?.variable_inputs as Record<string, number> | null) ?? {},
        saved: !!saved,
      })
    }

    // ── แถวเสริม: บริษัทอื่นที่จ่ายรายได้พิเศษให้คนนี้ (หรือเคยบันทึกงวดไว้) ──
    const otherCompanies = new Set<string | null>([...byCompany.keys()])
    for (const s of savedRes.data ?? []) {
      if (s.user_id === u.id) otherCompanies.add(s.company_id as string | null)
    }
    otherCompanies.delete(primaryC)

    for (const c of otherCompanies) {
      const saved = savedByKey.get(`${u.id}|${c ?? ''}`)
      const grp = base(byCompany.get(c))
      rows.push({
        userId: u.id,
        employeeCode: u.employee_code,
        name: u.display_name || u.full_name,
        bankName: u.bank_name,
        bankAccountNo: u.bank_account_no,
        payrollCycle: u.payroll_cycle,
        jobFunctionId: u.job_function_id,
        companyId: c,
        isPrimary: false,
        baseSalary: saved ? Number(saved.base_salary) : 0,
        workDays: saved ? Number(saved.work_days) : 0,
        absentDays: saved ? Number(saved.absent_days) : 0,
        otHours: saved ? Number(saved.ot_hours) : 0,
        otRate: saved ? Number(saved.ot_rate) : 0,
        commission: saved ? Number(saved.commission) : 0,
        extra: saved ? Number(saved.extra) : grp.fixed,
        deduction: saved ? Number(saved.deduction) : 0,
        note: saved?.note ?? '',
        variableItems: grp.variable,
        variableInputs: (saved?.variable_inputs as Record<string, number> | null) ?? {},
        saved: !!saved,
      })
    }
  }
  return rows
}

/* ------------------------------------------------------------------ */
export async function savePayroll(month: Date, rows: PayrollRow[], savedBy: string): Promise<void> {
  const { error } = await sb()
    .from('payroll_entries')
    .upsert(
      rows.map((r) => ({
        month: monthKey(month),
        user_id: r.userId,
        company_id: r.companyId,
        base_salary: r.baseSalary,
        work_days: r.workDays,
        absent_days: r.absentDays,
        ot_hours: r.otHours,
        ot_rate: r.otRate,
        commission: r.commission,
        extra: r.extra,
        deduction: r.deduction,
        note: r.note,
        variable_inputs: Object.keys(r.variableInputs).length ? r.variableInputs : null,
        updated_by: savedBy,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'month,user_id,company_id' }
    )
  if (error) throw new Error(`บันทึกสรุปเงินเดือนไม่สำเร็จ: ${error.message}`)
}

/** ดึงค่าคอม + เงินพิเศษ + หมายเหตุ จากเดือนก่อนมาตั้งต้น — กุญแจ (คน, บริษัท) */
export async function loadPreviousExtras(
  month: Date
): Promise<Map<string, { commission: number; extra: number; note: string }>> {
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1)
  const { data, error } = await sb()
    .from('payroll_entries')
    .select('user_id, company_id, commission, extra, note')
    .eq('month', monthKey(prev))

  if (error) throw new Error(`ดึงข้อมูลเดือนก่อนไม่สำเร็จ: ${error.message}`)
  return new Map(
    (data ?? []).map((r) => [
      `${r.user_id}|${r.company_id ?? ''}`,
      { commission: Number(r.commission), extra: Number(r.extra), note: r.note ?? '' },
    ])
  )
}

/** ไฟล์โอนเงินเข้าธนาคาร — รหัส · ชื่อ · ธนาคาร · เลขบัญชี · ยอดโอน */
export function payrollCsv(rows: PayrollRow[]): string {
  const header = 'รหัส,ชื่อ,ธนาคาร,เลขบัญชี,ยอดโอน'
  const lines = rows
    .filter((r) => payrollTotal(r) > 0)
    .map((r) =>
      [
        r.employeeCode != null ? String(r.employeeCode).padStart(3, '0') : '',
        `"${r.name}"`,
        r.bankName ?? '',
        r.bankAccountNo ?? '',
        payrollTotal(r).toFixed(2),
      ].join(',')
    )
  return '﻿' + [header, ...lines].join('\n') // BOM — เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน
}
