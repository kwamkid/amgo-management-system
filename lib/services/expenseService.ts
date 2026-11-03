// lib/services/expenseService.ts
//
// ใบเบิกค่าใช้จ่าย — พนักงานจ่ายไปก่อน แล้วเบิกคืน (30 ก.ย. 69)
// + จ่าย supplier ตรง · ไฟล์โอน SCB · บันทึกจ่ายทั้งชุด (3 พ.ย. 69 — migration 20261103120000)
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
import { getUserCycle } from './scheduleSwapService'
import {
  checkExpense,
  payrollMonthFor,
  type ExpenseCategory,
  type ExpenseKind,
  type ExpensePayout,
  type ExpenseStatus,
} from './expenseRules'

export * from './expenseRules'

const BUCKET = 'expense-receipts' as const
const sb = () => createClient()

export interface ExpenseClaim {
  id: string
  kind: ExpenseKind
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
  payeeName: string | null
  payeeBank: string | null
  payeeAccountNo: string | null
  routeFrom: string | null
  routeTo: string | null
  distanceKm: number | null
  purpose: string | null
  attendees: string | null
  vatAmount: number
  exportedAt: string | null
  /** ชื่อจริงเจ้าของใบ = ชื่อบัญชีรับโอน — มีเฉพาะรายการที่ join เจ้าของมา */
  ownerFullName?: string | null
  /** บัญชีรับโอนของเจ้าของใบ — มีเฉพาะรายการจาก listClaims (join มาพร้อมชื่อ) */
  bankName?: string | null
  bankAccountNo?: string | null
}

type Row = {
  id: string
  kind: string
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
  payee_name: string | null
  payee_bank: string | null
  payee_account_no: string | null
  route_from: string | null
  route_to: string | null
  distance_km: number | null
  purpose: string | null
  attendees: string | null
  vat_amount: number
  exported_at: string | null
}

const toClaim = (r: Row): ExpenseClaim => ({
  id: r.id,
  kind: (r.kind ?? 'reimburse') as ExpenseKind,
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
  payeeName: r.payee_name,
  payeeBank: r.payee_bank,
  payeeAccountNo: r.payee_account_no,
  routeFrom: r.route_from,
  routeTo: r.route_to,
  distanceKm: r.distance_km == null ? null : Number(r.distance_km),
  purpose: r.purpose,
  attendees: r.attendees,
  vatAmount: Number(r.vat_amount ?? 0),
  exportedAt: r.exported_at,
})

/**
 * ชื่อ snapshot ตอนยื่นอาจเป็นชื่อ LINE — ทับด้วยชื่อจริง (ชื่อเล่น) เสมอ
 * join ชื่อมาในคำขอเดียว · ตารางนี้ชี้ไป users 5 ทาง ต้องระบุ FK ของเจ้าของใบ
 */
const WITH_OWNER =
  '*, owner:users!expense_claims_user_id_fkey(display_name, full_name, bank_name, bank_account_no, company_id)' as const
type RowWithOwner = Row & {
  owner: {
    display_name: string | null
    full_name: string
    bank_name: string | null
    bank_account_no: string | null
    company_id: string | null
  } | null
}
const toNamedClaim = (r: RowWithOwner): ExpenseClaim => ({
  ...toClaim(r),
  userName: r.owner?.display_name || r.owner?.full_name || r.user_name,
  ownerFullName: r.owner?.full_name ?? null,
  // ว่าง = ต้นสังกัดของเจ้าของใบ (กติกาเดิมของ company_id)
  companyId: r.company_id ?? r.owner?.company_id ?? null,
  // แท็บรอโอนใช้ — เดิมดึงเลขบัญชีแยกอีกรอบหลังได้รายการใบ
  bankName: r.owner?.bank_name ?? null,
  bankAccountNo: r.owner?.bank_account_no ?? null,
})

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
    .select(WITH_OWNER)
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`โหลดใบเบิกไม่สำเร็จ: ${error.message}`)
  return ((data ?? []) as unknown as RowWithOwner[]).map(toNamedClaim)
}

/** จำนวนใบที่รอแต่ละขั้น — กล่องหน้าแรก HR */
export async function countPending(): Promise<{ manager: number; finance: number; toPay: number }> {
  // คำขอเดียว นับเอง — ใบที่ยังเปิดอยู่มีไม่กี่ใบ (เดิมยิง count แยก 3 ครั้ง)
  const { data } = await sb()
    .from('expense_claims')
    .select('status, payout')
    .in('status', ['pending_manager', 'pending_finance', 'approved'])
  const rows = data ?? []
  return {
    manager: rows.filter((r) => r.status === 'pending_manager').length,
    finance: rows.filter((r) => r.status === 'pending_finance').length,
    toPay: rows.filter((r) => r.status === 'approved' && r.payout === 'transfer').length,
  }
}

export interface ClaimExtras {
  kind: ExpenseKind
  vatAmount: number
  payeeName?: string
  payeeBank?: string
  payeeAccountNo?: string
  routeFrom?: string
  routeTo?: string
  distanceKm?: number | null
  purpose?: string
  attendees?: string
}

const blankToNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null)

export async function createClaim(params: ClaimExtras & {
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
      kind: params.kind,
      vatAmount: params.vatAmount,
      payeeName: params.payeeName,
      payeeBank: params.payeeBank,
      payeeAccountNo: params.payeeAccountNo,
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

  const supplier = params.kind === 'supplier'
  const { error } = await client.from('expense_claims').insert({
    id,
    kind: params.kind,
    user_id: params.userId,
    user_name: params.userName,
    company_id: params.companyId,
    expense_date: params.expenseDate,
    category: params.category,
    description: params.description.trim(),
    amount: params.amount,
    // supplier โอนเสมอ (constraint ใน DB ตรวจซ้ำ)
    payout: supplier ? 'transfer' : params.payout,
    receipt_paths: paths,
    no_receipt_reason: paths.length ? null : params.noReceiptReason.trim(),
    vat_amount: params.vatAmount || 0,
    payee_name: supplier ? blankToNull(params.payeeName) : null,
    payee_bank: supplier ? blankToNull(params.payeeBank) : null,
    payee_account_no: supplier ? (params.payeeAccountNo ?? '').replace(/\D/g, '') : null,
    route_from: blankToNull(params.routeFrom),
    route_to: blankToNull(params.routeTo),
    distance_km: params.distanceKm ?? null,
    purpose: blankToNull(params.purpose),
    attendees: blankToNull(params.attendees),
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

/**
 * โอนเสร็จแล้ว — ทีละใบหรือทั้งชุดที่โอนผ่านไฟล์ SCB ไปพร้อมกัน · สลิปใบเดียวใช้กับทุกใบในชุด (ไม่บังคับ)
 * อัปโหลดสลิปลงโฟลเดอร์ของเจ้าของใบแต่ละคน — พนักงานดูได้เฉพาะไฟล์ในโฟลเดอร์ตัวเอง (storage policy)
 */
export async function markTransferred(
  claims: ExpenseClaim[],
  byId: string,
  note: string,
  slip?: File | null
): Promise<void> {
  if (!claims.length) return
  const client = sb()
  const slipOf = new Map<string, string>()
  if (slip) {
    const isImage = slip.type.startsWith('image/')
    const blob = isImage ? await resizeImage(slip) : slip
    const ext = isImage ? 'jpg' : (slip.name.split('.').pop() || 'bin')
    const stamp = Date.now()
    for (const userId of new Set(claims.map((c) => c.userId))) {
      const path = `${userId}/slips/slip-${stamp}.${ext}`
      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: isImage ? 'image/jpeg' : slip.type, upsert: false })
      if (error) throw new Error(`อัปโหลดสลิปไม่สำเร็จ: ${error.message}`)
      slipOf.set(userId, path)
    }
  }
  // แยกคำขอตามเจ้าของใบ — path สลิปต่างกันต่อคน
  const byUser = new Map<string, string[]>()
  for (const c of claims) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c.id])
  for (const [userId, ids] of byUser) {
    const { error } = await client
      .from('expense_claims')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: byId,
        paid_note: note.trim() || null,
        slip_path: slipOf.get(userId) ?? null,
      })
      .in('id', ids)
      .eq('status', 'approved')
      .eq('payout', 'transfer')
    if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`)
  }
}

export interface ClaimEdit {
  expenseDate: string
  category: ExpenseCategory
  vatAmount: number
  description: string
  amount: number
  routeFrom: string
  routeTo: string
  distanceKm: number | null
  purpose: string
  attendees: string
  payeeName: string
  payeeBank: string
  payeeAccountNo: string
}

/**
 * บัญชีแก้หมวด/รายละเอียดก่อนอนุมัติหรือก่อนโอน (เจ้าของ 3 พ.ย. 69) — RLS expense_claims_finance_update
 * ยอดเงินแก้ได้เฉพาะตอนรอบัญชี (อนุมัติแล้วอาจผูกงวดเงินเดือนไปแล้ว) · แก้บัญชีปลายทาง/ยอด = ล้างตราส่งออก
 */
export async function updateClaimDetails(claim: ExpenseClaim, e: ClaimEdit): Promise<void> {
  if (claim.status !== 'pending_finance' && claim.status !== 'approved') {
    throw new Error('แก้ได้เฉพาะใบที่รอบัญชีหรือรอโอน')
  }
  const amount = claim.status === 'pending_finance' ? e.amount : claim.amount
  const problem = checkExpense(
    {
      kind: claim.kind,
      expenseDate: e.expenseDate,
      category: e.category,
      description: e.description,
      amount,
      // ไฟล์แนบไม่ได้แก้ตรงนี้ — นับของเดิม
      receiptCount: claim.receiptPaths.length,
      noReceiptReason: claim.noReceiptReason ?? '',
      vatAmount: e.vatAmount,
      payeeName: e.payeeName,
      payeeBank: e.payeeBank,
      payeeAccountNo: e.payeeAccountNo,
    },
    '9999-12-31'
  )
  if (problem) throw new Error(problem)

  const supplier = claim.kind === 'supplier'
  const acc = e.payeeAccountNo.replace(/\D/g, '')
  const payeeChanged =
    supplier && (e.payeeName.trim() !== claim.payeeName || e.payeeBank !== claim.payeeBank || acc !== claim.payeeAccountNo)

  const { error } = await sb()
    .from('expense_claims')
    .update({
      expense_date: e.expenseDate,
      category: e.category,
      vat_amount: e.vatAmount,
      description: e.description.trim(),
      amount,
      route_from: blankToNull(e.routeFrom),
      route_to: blankToNull(e.routeTo),
      distance_km: e.distanceKm,
      purpose: blankToNull(e.purpose),
      attendees: blankToNull(e.attendees),
      ...(supplier ? { payee_name: e.payeeName.trim(), payee_bank: e.payeeBank, payee_account_no: acc } : {}),
      ...(payeeChanged || amount !== claim.amount ? { exported_at: null, exported_by: null } : {}),
    })
    .eq('id', claim.id)
    .in('status', ['pending_finance', 'approved'])
  if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`)
}

/** ตีตราว่าส่งออกเป็นไฟล์โอนแล้ว — กันส่งออกซ้ำแล้วโอนเบิ้ล (ยังไม่ถือว่าจ่าย) */
export async function markExported(ids: string[], byId: string): Promise<void> {
  if (!ids.length) return
  const { error } = await sb()
    .from('expense_claims')
    .update({ exported_at: new Date().toISOString(), exported_by: byId })
    .in('id', ids)
    .eq('status', 'approved')
  if (error) throw new Error(`บันทึกการส่งออกไม่สำเร็จ: ${error.message}`)
}

/** ล้างตราส่งออก — ไฟล์ที่ส่งออกไปแล้วไม่ได้ใช้ (เช่น ธนาคารตีกลับ) จะได้ส่งออกใหม่ */
export async function clearExported(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await sb()
    .from('expense_claims')
    .update({ exported_at: null, exported_by: null })
    .in('id', ids)
    .eq('status', 'approved')
  if (error) throw new Error(`ล้างตราส่งออกไม่สำเร็จ: ${error.message}`)
}

/** ใบที่อนุมัติ/จ่ายแล้วของเดือน (ตามวันที่จ่ายเงิน/วันที่ใบแจ้งหนี้) — สรุปสิ้นเดือน */
export async function listClaimsForMonth(month: string, companyId: string | null): Promise<ExpenseClaim[]> {
  const [y, m] = month.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  const q = sb()
    .from('expense_claims')
    .select(WITH_OWNER)
    .in('status', ['approved', 'paid'])
    .gte('expense_date', from)
    .lt('expense_date', next)
    .order('expense_date')
    .limit(2000)
  const { data, error } = await q
  if (error) throw new Error(`โหลดใบเบิกไม่สำเร็จ: ${error.message}`)
  const list = ((data ?? []) as unknown as RowWithOwner[]).map(toNamedClaim)
  return companyId ? list.filter((c) => c.companyId === companyId) : list
}

/** ลิงก์ดูรูปใบเสร็จ/สลิป (signed URL อายุสั้น) */
export async function receiptUrls(paths: string[]): Promise<Map<string, string>> {
  return getImageUrls(BUCKET, paths)
}
