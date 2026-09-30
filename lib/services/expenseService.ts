// lib/services/expenseService.ts
//
// ใบเบิกค่าใช้จ่าย — พนักงานจ่ายไปก่อน แล้วเบิกคืน (30 ก.ย. 69)
//
//   ยื่น (แนบรูปใบเสร็จ) → ผู้จัดการ/แอดมินอนุมัติ → บัญชี/HR อนุมัติ + เลือกวิธีจ่าย
//     · รวมเงินเดือน = ผูกเข้างวดที่ยังไม่ตัดยอด → หน้าเงินเดือนช่อง "เบิกคืน"
//                     → บันทึกงวดแล้วตีตราจ่ายแล้วให้เอง (savePayroll)
//     · โอนแยก      = บัญชีโอนเอง แล้วกด "จ่ายแล้ว" พร้อมแนบสลิป
//
// ขั้นอนุมัติผ่านฟังก์ชัน SQL (expense_manager_decide / expense_finance_decide)
// ซึ่งตรวจลำดับขั้นและกันอนุมัติใบตัวเอง — migration 20260930140000
// กติกาตรวจก่อนยื่นอยู่ expenseRules.ts (เทสต์ยิงตรงได้)

import { createClient } from '@/lib/supabase/client'
import { getImageUrls } from '@/lib/supabase/storage'
import { resizeImage } from '@/lib/utils/resizeImage'
import { getDisplayNames } from './user/queries'
import { getUserCycle } from './scheduleSwapService'
import {
  checkExpense,
  payrollMonthFor,
  type ExpenseCategory,
  type ExpensePayout,
  type ExpenseStatus,
} from './expenseRules'

export * from './expenseRules'

const BUCKET = 'expense-receipts' as const
const sb = () => createClient()

export interface ExpenseClaim {
  id: string
  userId: string
  userName: string
  companyId: string | null
  expenseDate: string
  category: ExpenseCategory
  description: string
  amount: number
  receiptPaths: string[]
  noReceiptReason: string | null
  payout: ExpensePayout
  status: ExpenseStatus
  managerAt: string | null
  financeAt: string | null
  rejectedReason: string | null
  payrollMonth: string | null
  paidAt: string | null
  paidNote: string | null
  slipPath: string | null
  createdAt: string
}

type Row = {
  id: string
  user_id: string
  user_name: string
  company_id: string | null
  expense_date: string
  category: string
  description: string
  amount: number
  receipt_paths: string[]
  no_receipt_reason: string | null
  payout: string
  status: string
  manager_at: string | null
  finance_at: string | null
  rejected_reason: string | null
  payroll_month: string | null
  paid_at: string | null
  paid_note: string | null
  slip_path: string | null
  created_at: string
}

const toClaim = (r: Row): ExpenseClaim => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name,
  companyId: r.company_id,
  expenseDate: r.expense_date,
  category: r.category as ExpenseCategory,
  description: r.description,
  amount: Number(r.amount),
  receiptPaths: r.receipt_paths ?? [],
  noReceiptReason: r.no_receipt_reason,
  payout: r.payout as ExpensePayout,
  status: r.status as ExpenseStatus,
  managerAt: r.manager_at,
  financeAt: r.finance_at,
  rejectedReason: r.rejected_reason,
  payrollMonth: r.payroll_month,
  paidAt: r.paid_at,
  paidNote: r.paid_note,
  slipPath: r.slip_path,
  createdAt: r.created_at,
})

/** ชื่อ snapshot ตอนยื่นอาจเป็นชื่อ LINE — ทับด้วยชื่อจริง (ชื่อเล่น) เสมอ */
async function withNames(claims: ExpenseClaim[]): Promise<ExpenseClaim[]> {
  const names = await getDisplayNames(claims.map((c) => c.userId))
  return claims.map((c) => ({ ...c, userName: names.get(c.userId) ?? c.userName }))
}

export async function listMyClaims(userId: string): Promise<ExpenseClaim[]> {
  const { data, error } = await sb()
    .from('expense_claims')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`โหลดใบเบิกไม่สำเร็จ: ${error.message}`)
  return (data ?? []).map((r) => toClaim(r as Row))
}

/** ใบทั้งบริษัทตามสถานะ — หน้าจัดการ (RLS: ผู้จัดการ/HR/แอดมิน/บัญชี) */
export async function listClaims(statuses: ExpenseStatus[], limit = 200): Promise<ExpenseClaim[]> {
  const { data, error } = await sb()
    .from('expense_claims')
    .select('*')
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`โหลดใบเบิกไม่สำเร็จ: ${error.message}`)
  return withNames((data ?? []).map((r) => toClaim(r as Row)))
}

/** จำนวนใบที่รอแต่ละขั้น — กล่องหน้าแรก HR */
export async function countPending(): Promise<{ manager: number; finance: number; toPay: number }> {
  const count = async (status: ExpenseStatus, payout?: ExpensePayout) => {
    let q = sb().from('expense_claims').select('id', { count: 'exact', head: true }).eq('status', status)
    if (payout) q = q.eq('payout', payout)
    const { count: n } = await q
    return n ?? 0
  }
  const [manager, finance, toPay] = await Promise.all([
    count('pending_manager'),
    count('pending_finance'),
    count('approved', 'transfer'),
  ])
  return { manager, finance, toPay }
}

export async function createClaim(params: {
  userId: string
  userName: string
  companyId: string | null
  expenseDate: string
  category: ExpenseCategory
  description: string
  amount: number
  payout: ExpensePayout
  receipts: File[]
  noReceiptReason: string
  today: string
}): Promise<void> {
  const problem = checkExpense(
    {
      expenseDate: params.expenseDate,
      category: params.category,
      description: params.description,
      amount: params.amount,
      receiptCount: params.receipts.length,
      noReceiptReason: params.noReceiptReason,
    },
    params.today
  )
  if (problem) throw new Error(problem)

  const id = crypto.randomUUID()
  const client = sb()

  // อัปโหลดใบเสร็จก่อน — ใบเบิกที่บันทึกแล้วต้องมีรูปครบเสมอ
  // (ไฟล์กำพร้าถ้าบันทึกใบพังเสียแค่ที่เก็บเล็กน้อย ดีกว่าใบที่อ้างรูปที่ไม่มีอยู่)
  const paths: string[] = []
  for (const [i, file] of params.receipts.entries()) {
    const blob = file.type.startsWith('image/') ? await resizeImage(file) : file
    const ext = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() || 'bin')
    const path = `${params.userId}/${id}/${i + 1}.${ext}`
    const { error } = await client.storage.from(BUCKET).upload(path, blob, {
      contentType: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
      upsert: false,
    })
    if (error) throw new Error(`อัปโหลดใบเสร็จไม่สำเร็จ: ${error.message}`)
    paths.push(path)
  }

  const { error } = await client.from('expense_claims').insert({
    id,
    user_id: params.userId,
    user_name: params.userName,
    company_id: params.companyId,
    expense_date: params.expenseDate,
    category: params.category,
    description: params.description.trim(),
    amount: params.amount,
    payout: params.payout,
    receipt_paths: paths,
    no_receipt_reason: paths.length ? null : params.noReceiptReason.trim(),
    status: 'pending_manager',
  })
  if (error) throw new Error(`ยื่นใบเบิกไม่สำเร็จ: ${error.message}`)
}

export async function cancelClaim(id: string): Promise<void> {
  const { error } = await sb()
    .from('expense_claims')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending_manager')
  if (error) throw new Error(`ยกเลิกไม่สำเร็จ: ${error.message}`)
}

export async function managerDecide(id: string, approve: boolean, reason?: string): Promise<void> {
  const { error } = await sb().rpc('expense_manager_decide', {
    p_id: id,
    p_approve: approve,
    p_reason: reason ?? undefined,
  })
  if (error) throw new Error(error.message)
}

/** บัญชีอนุมัติ — รวมเงินเดือนจะผูกงวดที่ยังไม่ตัดยอดตามรอบจ่ายของเจ้าของใบ */
export async function financeDecide(
  claim: ExpenseClaim,
  approve: boolean,
  opts: { reason?: string; payout?: ExpensePayout } = {}
): Promise<void> {
  const payout = opts.payout ?? claim.payout
  const payrollMonth =
    approve && payout === 'payroll'
      ? payrollMonthFor(await getUserCycle(claim.userId), new Date())
      : undefined
  const { error } = await sb().rpc('expense_finance_decide', {
    p_id: claim.id,
    p_approve: approve,
    p_reason: opts.reason ?? undefined,
    p_payout: payout,
    p_payroll_month: payrollMonth,
  })
  if (error) throw new Error(error.message)
}

/** โอนแยกเสร็จแล้ว — แนบสลิปได้ (ไม่บังคับ) */
export async function markTransferred(
  claim: ExpenseClaim,
  byId: string,
  note: string,
  slip?: File | null
): Promise<void> {
  const client = sb()
  let slipPath: string | null = null
  if (slip) {
    const blob = slip.type.startsWith('image/') ? await resizeImage(slip) : slip
    slipPath = `${claim.userId}/${claim.id}/slip-${Date.now()}.jpg`
    const { error } = await client.storage
      .from(BUCKET)
      .upload(slipPath, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new Error(`อัปโหลดสลิปไม่สำเร็จ: ${error.message}`)
  }
  const { error } = await client
    .from('expense_claims')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: byId,
      paid_note: note.trim() || null,
      slip_path: slipPath,
    })
    .eq('id', claim.id)
    .eq('status', 'approved')
    .eq('payout', 'transfer')
  if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`)
}

/** ลิงก์ดูรูปใบเสร็จ/สลิป (signed URL อายุสั้น) */
export async function receiptUrls(paths: string[]): Promise<Map<string, string>> {
  return getImageUrls(BUCKET, paths)
}
