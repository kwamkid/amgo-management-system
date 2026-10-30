// GET /api/bot/payroll?month=YYYY-MM (ค่าเริ่มต้น = เดือนนี้) · ?detail=1 = แถวรายคน
//   เฉพาะกุญแจ superadmin (Jarvis — เจ้าของ) — เงินเดือนเป็นข้อมูลลับ ไม่เปิดให้กุญแจ general
//   ตัวเลขมาจาก loadPayrollWithReality + payrollTotal ตัวเดียวกับหน้าเงินเดือน — ห้ามคิดใหม่ที่นี่
//   ไม่ส่งเลขบัญชีธนาคาร
import type { NextRequest } from 'next/server'
import { apiError, apiJson, authBotApi } from '@/lib/services/bot/botApi'
import { loadPayrollWithReality, payrollTotal, type PayrollRow } from '@/lib/services/payrollService'
import { CYCLE_LABELS } from '@/lib/services/payrollCycle'

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const r2 = (n: number) => Math.round(n * 100) / 100

interface CompanyAgg {
  company: { id: string | null; code: string | null; name: string | null }
  people: number
  total: number
  baseSalary: number
  otHours: number
  otPay: number
  commission: number
  extra: number
  reimbursement: number
  deduction: number
  cycles: Record<string, { label: string; people: number; total: number; payDate: string; cutoffPassed: boolean }>
}

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  if (caller.scope !== 'superadmin') return apiError(403, 'เงินเดือนดูได้เฉพาะกุญแจ superadmin')

  const p = request.nextUrl.searchParams
  const m = p.get('month')?.trim()
  if (m && !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return apiError(400, 'month ต้องเป็น YYYY-MM')
  const now = new Date()
  const month = m ? new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1)
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

  const [{ rows }, companiesRes] = await Promise.all([
    loadPayrollWithReality(month, caller.sb),
    caller.sb.from('companies').select('id, code, name_th'),
  ])
  if (companiesRes.error) return apiError(500, companiesRes.error.message)
  const companies = new Map((companiesRes.data ?? []).map((c) => [c.id, c]))

  const byCompany = new Map<string, CompanyAgg>()
  for (const r of rows as PayrollRow[]) {
    const key = r.companyId ?? ''
    const c = r.companyId ? companies.get(r.companyId) : null
    const agg =
      byCompany.get(key) ??
      ({
        company: { id: r.companyId, code: c?.code ?? null, name: c?.name_th ?? null },
        people: 0, total: 0, baseSalary: 0, otHours: 0, otPay: 0, commission: 0, extra: 0, reimbursement: 0, deduction: 0,
        cycles: {},
      } satisfies CompanyAgg)
    const total = payrollTotal(r)
    const otPay = r2(r.otHours * r.otRate)
    agg.people += 1
    agg.total += total
    agg.baseSalary += r.baseSalary
    agg.otHours += r.otHours
    agg.otPay += otPay
    agg.commission += r.commission
    agg.extra += r.extra
    agg.reimbursement += r.reimbursement
    agg.deduction += r.deduction
    const cy = agg.cycles[r.cycle] ?? { label: CYCLE_LABELS[r.cycle], people: 0, total: 0, payDate: ymd(r.payDate), cutoffPassed: r.cutoffPassed }
    cy.people += 1
    cy.total += total
    agg.cycles[r.cycle] = cy
    byCompany.set(key, agg)
  }

  const perCompany = [...byCompany.values()]
    .map((c) => ({
      ...c,
      total: r2(c.total), baseSalary: r2(c.baseSalary), otHours: r2(c.otHours), otPay: r2(c.otPay),
      commission: r2(c.commission), extra: r2(c.extra), reimbursement: r2(c.reimbursement), deduction: r2(c.deduction),
      cycles: Object.fromEntries(Object.entries(c.cycles).map(([k, v]) => [k, { ...v, total: r2(v.total) }])),
    }))
    .sort((x, y) => y.total - x.total)

  const grand = r2(perCompany.reduce((s, c) => s + c.total, 0))
  const allCutoff = rows.length > 0 && rows.every((r) => r.cutoffPassed)

  const body: Record<string, unknown> = {
    month: monthKey,
    note: allCutoff ? 'ผ่านวันตัดยอดแล้ว ตัวเลขนิ่ง' : 'ยังไม่ถึงวันตัดยอดของบางรอบ — ตัวเลขวันมา/ขาด/OT ยังเปลี่ยนได้',
    total: grand,
    people: new Set(rows.map((r) => r.userId)).size,
    companies: perCompany,
  }
  if (p.get('detail') === '1')
    body.rows = (rows as PayrollRow[])
      .map((r) => ({
        person: { id: r.userId, name: r.name, code: r.employeeCode },
        company: companies.get(r.companyId ?? '')?.code ?? null,
        primary: r.isPrimary,
        cycle: r.cycle,
        payDate: ymd(r.payDate),
        baseSalary: r.baseSalary,
        workDays: r.workDays,
        absentDays: r.absentDays,
        otHours: r.otHours,
        otPay: r2(r.otHours * r.otRate),
        commission: r.commission,
        extra: r.extra,
        reimbursement: r.reimbursement,
        deduction: r.deduction,
        total: r2(payrollTotal(r)),
        note: r.note || null,
      }))
      .sort((x, y) => y.total - x.total)
  return apiJson(body)
}
