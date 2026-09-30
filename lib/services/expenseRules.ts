// lib/services/expenseRules.ts
//
// กติกาใบเบิกค่าใช้จ่าย — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// (เทสต์ scripts/test-expense-rules.mjs ยิงตรงได้ → ห้ามใช้ '@/' และ import ต้องมี .ts)

import { periodMonth, type CycleCode } from './payrollCycle.ts'

export type ExpenseCategory = 'travel' | 'fuel' | 'parking' | 'meal' | 'supplies' | 'shipping' | 'other'
export type ExpensePayout = 'payroll' | 'transfer'
export type ExpenseStatus =
  | 'pending_manager'
  | 'pending_finance'
  | 'approved'
  | 'paid'
  | 'rejected'
  | 'cancelled'

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  travel: 'ค่าเดินทาง (แท็กซี่/วิน/รถสาธารณะ)',
  fuel: 'ค่าน้ำมัน',
  parking: 'ค่าที่จอดรถ/ทางด่วน',
  meal: 'ค่าอาหาร/รับรอง',
  supplies: 'ซื้อของใช้/อุปกรณ์',
  shipping: 'ค่าส่งของ',
  other: 'อื่น ๆ',
}

export const PAYOUT_LABEL: Record<ExpensePayout, string> = {
  payroll: 'รวมกับเงินเดือน',
  transfer: 'โอนแยก',
}

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending_manager: 'รอผู้จัดการ',
  pending_finance: 'รอบัญชี',
  approved: 'อนุมัติแล้ว รอจ่าย',
  paid: 'จ่ายแล้ว',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิก',
}

export interface ExpenseDraft {
  expenseDate: string // yyyy-mm-dd
  category: string
  description: string
  amount: number
  receiptCount: number
  noReceiptReason: string
}

/**
 * ตรวจก่อนยื่น — คืนข้อความปัญหา · null = ผ่าน
 * กติกาเจ้าของ 30 ก.ย. 69: ต้องมีรูปใบเสร็จทุกใบ ไม่มีวงเงิน · ไม่มีใบเสร็จ = เขียนเหตุผลแทน
 */
export function checkExpense(d: ExpenseDraft, today: string): string | null {
  if (!d.expenseDate) return 'เลือกวันที่จ่ายเงิน'
  if (d.expenseDate > today) return 'วันที่จ่ายเงินต้องไม่เกินวันนี้'
  if (!(d.category in CATEGORY_LABEL)) return 'เลือกประเภทค่าใช้จ่าย'
  if (!d.description.trim()) return 'บอกว่าจ่ายค่าอะไร'
  if (!Number.isFinite(d.amount) || d.amount <= 0) return 'ใส่ยอดเงินมากกว่า 0'
  // เทียบแบบเผื่อเศษ — 0.29 × 100 ในทศนิยมฐานสองได้ 28.999999999999996
  if (Math.abs(Math.round(d.amount * 100) - d.amount * 100) > 1e-6) {
    return 'ยอดเงินมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง'
  }
  if (d.receiptCount === 0 && !d.noReceiptReason.trim()) {
    return 'แนบรูปใบเสร็จ หรือบอกเหตุผลที่ไม่มีใบเสร็จ'
  }
  return null
}

/**
 * งวดเงินเดือนที่ใบเบิกแบบ "รวมเงินเดือน" จะเข้าไป — งวดที่วันอนุมัติตกอยู่
 * (งวดนั้นยังไม่ตัดยอดแน่นอน เพราะวันนี้ยังอยู่ในช่วงของมัน) คืน 'yyyy-mm-01'
 */
export function payrollMonthFor(cycle: CycleCode, approvedAt: Date): string {
  const m = periodMonth(cycle, approvedAt)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
}
