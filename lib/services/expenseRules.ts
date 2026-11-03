// lib/services/expenseRules.ts
//
// กติกาใบเบิกค่าใช้จ่าย — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// (เทสต์ scripts/test-expense-rules.mjs ยิงตรงได้ → ห้ามใช้ '@/' และ import ต้องมี .ts)

import { periodMonth, type CycleCode } from './payrollCycle.ts'

export type ExpenseCategory = 'travel' | 'fuel' | 'parking' | 'meal' | 'phone' | 'supplies' | 'shipping' | 'other'
/** reimburse = พนักงานออกไปก่อน · supplier = ให้บริษัทโอนจ่าย supplier ตรง (3 พ.ย. 69) */
export type ExpenseKind = 'reimburse' | 'supplier'
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
  phone: 'ค่าโทรศัพท์',
  supplies: 'ซื้อของใช้/อุปกรณ์',
  shipping: 'ค่าส่งของ',
  other: 'อื่น ๆ',
}

export const KIND_LABEL: Record<ExpenseKind, string> = {
  reimburse: 'เบิกคืน (ออกไปก่อน)',
  supplier: 'จ่าย supplier',
}

export const PAYOUT_LABEL: Record<ExpensePayout, string> = {
  payroll: 'รวมกับเงินเดือน',
  transfer: 'โอนแยก',
}

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending_manager: 'รอผู้จัดการ',
  pending_finance: 'รอบัญชีอนุมัติ',
  approved: 'อนุมัติแล้ว รอจ่าย',
  paid: 'จ่ายแล้ว',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิก',
}

export interface ExpenseDraft {
  kind?: ExpenseKind
  expenseDate: string // yyyy-mm-dd
  category: string
  description: string
  amount: number
  receiptCount: number
  noReceiptReason: string
  /** ยอด VAT ที่รวมอยู่ใน amount · 0 = ไม่มีใบกำกับภาษี */
  vatAmount?: number
  payeeName?: string
  payeeBank?: string
  payeeAccountNo?: string
}

const isCents = (n: number) => Math.abs(Math.round(n * 100) - n * 100) <= 1e-6

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
  if (!isCents(d.amount)) return 'ยอดเงินมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง'
  const vat = d.vatAmount ?? 0
  if (!Number.isFinite(vat) || vat < 0 || !isCents(vat)) return 'ยอด VAT ไม่ถูกต้อง'
  if (vat >= d.amount) return 'ยอด VAT ต้องน้อยกว่ายอดรวม'
  if (d.kind === 'supplier') {
    // supplier ต้องมีใบวางบิล/ใบแจ้งหนี้เสมอ และบัญชีปลายทางครบ (บัญชีจะส่งไฟล์โอนเข้า SCB)
    if (!d.payeeName?.trim()) return 'ใส่ชื่อบัญชีผู้รับเงิน (supplier)'
    if (!d.payeeBank?.trim()) return 'เลือกธนาคารของ supplier'
    const acc = (d.payeeAccountNo ?? '').replace(/\D/g, '')
    if (acc.length < 10 || acc.length > 15) return 'เลขบัญชี supplier ต้องเป็นตัวเลข 10–15 หลัก'
    if (d.receiptCount === 0) return 'แนบใบวางบิล/ใบแจ้งหนี้'
    return null
  }
  if (d.receiptCount === 0 && !d.noReceiptReason.trim()) {
    return 'แนบรูปใบเสร็จ หรือบอกเหตุผลที่ไม่มีใบเสร็จ'
  }
  return null
}

/** VAT 7% ที่รวมอยู่ในยอด (ใบกำกับภาษีราคารวม VAT) — ปัดสตางค์ */
export function vatIncluded(gross: number): number {
  return Math.round((gross * 7) / 107 * 100) / 100
}

// ── ฟอร์มสรุปสิ้นเดือน "EXPENSES REIMBURSEMENT" (แบบ z/Reimbursement.xlsx ของบัญชี) ──
export type FormSection = 'taxi' | 'toll' | 'gas' | 'entertain' | 'phone' | 'other' | 'other_vat'

export const FORM_SECTIONS: { key: FormSection; title: string }[] = [
  { key: 'taxi', title: '(1) Taxi' },
  { key: 'toll', title: '(2)  Express way fare / Parking ' },
  { key: 'gas', title: '(3) Gasoline' },
  { key: 'entertain', title: '(B) ENTERTAINMENT (ex. Food)' },
  { key: 'phone', title: '(C) Telephone expense' },
  { key: 'other', title: '(D) OTHERS' },
  { key: 'other_vat', title: '(E) OTHERS Vat 7%' },
]

/** ใบเบิกลงช่องไหนของฟอร์ม — หมวดเดินทาง/รับรอง/โทรศัพท์ตามหมวด · ที่เหลือแยกตามมี VAT ไหม */
export function formSectionOf(category: ExpenseCategory, vatAmount: number): FormSection {
  switch (category) {
    case 'travel': return 'taxi'
    case 'parking': return 'toll'
    case 'fuel': return 'gas'
    case 'meal': return 'entertain'
    case 'phone': return 'phone'
    default: return vatAmount > 0 ? 'other_vat' : 'other'
  }
}

/**
 * งวดเงินเดือนที่ใบเบิกแบบ "รวมเงินเดือน" จะเข้าไป — งวดที่วันอนุมัติตกอยู่
 * (งวดนั้นยังไม่ตัดยอดแน่นอน เพราะวันนี้ยังอยู่ในช่วงของมัน) คืน 'yyyy-mm-01'
 */
export function payrollMonthFor(cycle: CycleCode, approvedAt: Date): string {
  const m = periodMonth(cycle, approvedAt)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
}

// ── เดาหมวดจากรายละเอียด (เจ้าของ 3 พ.ย. 69: พนักงานไม่รู้หมวด ให้ระบบเดาจากของเก่า บัญชีแก้ได้) ──
// กติกาคำ ไล่จากประวัติ Reimbursement.xlsx ของบัญชี 1,218 รายการ (เทสต์วัดความแม่นกับชุดนั้น)
// ลำดับสำคัญ: "ค่าน้ำมัน" ต้องมาก่อน "ค่าน้ำ" และ "ขนของ" (ค่าน้ำมันขนของ = Gasoline) · "ค่าส่ง/ลาล่า" (ขนของ) ลงอื่นๆ ไม่ใช่ Taxi
const SECTION_WORDS: [FormSection, RegExp][] = [
  ['phone', /โทรศัพท์|ค่าโทร|ซิม|เติมเงินมือถือ|แพ็กเกจเน็ต|อินเทอร์เน็ต|internet/i],
  ['gas', /น้ำมัน|เติมแก๊ส|ngv|lpg|ชาร์จรถ|\d+(\.\d+)?\s*l\.\s/i],
  // ขนของ/ส่งของ/ค่าน้ำค่าไฟสถานที่/ตั๋วเครื่องบิน — ลงอื่นๆ ก่อนจะโดนคำว่า "ค่ารถ/ทางด่วน/ค่าน้ำ" ดึงไป
  ['other', /ลาล่า|lalamove|ค่าส่ง|ขนส่ง|ขนย้าย|ขนของ|เหมารถ|ไปรษณีย์|พัสดุ|kerry|flash ?express|best ?express|j&t|\bems\b|ค่าน้ำ(โกดัง|ประปา|สาขา)|ค่าไฟ|เครื่องบิน|ประกัน/i],
  // ค่ารถที่รวมทางด่วนมาในบิลเดียว — บัญชีลง Taxi
  ['taxi', /(ค่ารถ|เรียกรถ|แท็?กซี่|grab).*ทางด่วน/i],
  ['toll', /ทา?่?งด่วน|อีซี่?พาส|easy ?pass|m-?flow|ที่จอด|จอดรถ|ค่าจอด|parking/i],
  ['taxi', /แท็?กซี่|แท๊กซี่|taxi|grab|แก?ร็?[บป]|แกร[บป]|bolt|โบ้?ท|เรียกรถ|ค่ารถ|รถไฟฟ้า|bts|บีทีเอส|mrt|เอ็มอาร์ที|airport ?link|ค่าวิน|วินมอ|มอไซ|มอเตอร์ไซ|เดินทา|รถเมล์|ค่าเรือ|รถตู้|ค่าโดยสาร|ไป-กลับ|ไปกลับ|ขาไป|ขากลับ/i],
  ['entertain', /ค่าข้าว|ซื้อข้าว|อาหาร|เค้ก|กาแฟ|คาเฟ่|ชานม|ขนม|เครื่องดื่ม|น้ำดื่ม|ค่าน้ำ|ซื้อน้ำ|น้ำแพ็ค|เลี้ยง|food|drink|kfc|mcdonald|pizza|starbucks|ร้านอาหาร/i],
  // ไม่มีคำชัด แต่เป็นการเดินทาง "ไป…/กลับ…/จาก…ไป" — ประวัติส่วนใหญ่คือค่ารถ
  ['taxi', /(^|[\s+])(ไป|กลับ)|จาก.+(ไป|กลับ|-)|(ไป|กลับ)(งาน|แฟร์|บูธ|บูท|ห้อง|บ้าน|ออฟฟิศ|โกดัง|สาขา|วังเด็ก)|uber|นั่งรถ|สนามบิน/i],
]

/** สระ/วรรณยุกต์พิมพ์ซ้ำ (ค่่า · เดิินทาง · ซื้้อ) — ยุบก่อนจับคำ */
const tidy = (s: string) => s.trim().replace(/([ัิ-ฺ็-๎])\1+/g, '$1')

/** เดาหมวดจากคำในรายละเอียด — ไม่เจออะไรเลย = อื่นๆ · มี VAT ไปช่องอื่นๆ VAT 7% */
export function guessSection(description: string, hasVat = false): FormSection {
  const d = tidy(description)
  for (const [section, re] of SECTION_WORDS) {
    if (re.test(d)) return section === 'other' && hasVat ? 'other_vat' : section
  }
  return hasVat ? 'other_vat' : 'other'
}

const normDesc = (s: string) => tidy(s).toLowerCase().replace(/[\s\d.,()\-+/]+/g, '')
const bigrams = (s: string) => {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

/**
 * หมวดที่แนะนำ: ใบเก่าที่รายละเอียดคล้ายกัน (หมวดที่บัญชีตรวจแล้ว) ชนะกติกาคำ
 * คล้าย = bigram ทับกัน ≥ 60% (ภาษาไทยไม่มีช่องว่าง ตัดคำไม่ได้)
 */
export function suggestSection(
  description: string,
  history: { description: string; section: FormSection }[]
): { section: FormSection; from: 'history' | 'words' } | null {
  const n = normDesc(description)
  if (n.length < 3) return null
  const mine = bigrams(n)
  let best: { section: FormSection; score: number } | null = null
  for (const h of history) {
    const hn = normDesc(h.description)
    if (hn === n) return { section: h.section, from: 'history' }
    const other = bigrams(hn)
    if (!other.size) continue
    let common = 0
    for (const b of mine) if (other.has(b)) common++
    const score = (2 * common) / (mine.size + other.size)
    if (score >= 0.6 && (!best || score > best.score)) best = { section: h.section, score }
  }
  if (best) return { section: best.section, from: 'history' }
  return { section: guessSection(description), from: 'words' }
}

/** หมวดในฟอร์มบัญชี → ค่าที่เก็บ (category + ต้องมี VAT ไหม) */
export const SECTION_CATEGORY: Record<FormSection, ExpenseCategory> = {
  taxi: 'travel',
  toll: 'parking',
  gas: 'fuel',
  entertain: 'meal',
  phone: 'phone',
  other: 'other',
  other_vat: 'other',
}

/** ชื่อหมวดที่พนักงาน/บัญชีเลือก — ตามหัวข้อในฟอร์ม EXPENSES REIMBURSEMENT */
export const SECTION_LABEL: Record<FormSection, string> = {
  taxi: 'ค่าเดินทาง — แท็กซี่/Grab/รถไฟฟ้า/วิน (Taxi)',
  toll: 'ทางด่วน / ที่จอดรถ (Express way / Parking)',
  gas: 'ค่าน้ำมัน (Gasoline)',
  entertain: 'ค่ารับรอง — อาหาร/เครื่องดื่ม/เค้ก (Entertainment)',
  phone: 'ค่าโทรศัพท์ (Telephone)',
  other: 'อื่น ๆ — ซื้อของ/อุปกรณ์/ค่าส่ง (Others)',
  other_vat: 'อื่น ๆ มีใบกำกับภาษี VAT 7% (Others Vat 7%)',
}

/** ชื่อหมวดแบบสั้น — แถวรายการ */
export const SECTION_SHORT: Record<FormSection, string> = {
  taxi: 'Taxi',
  toll: 'ทางด่วน/จอด',
  gas: 'น้ำมัน',
  entertain: 'รับรอง',
  phone: 'โทรศัพท์',
  other: 'อื่น ๆ',
  other_vat: 'อื่นๆ/VAT',
}

/**
 * ลำดับหมวดบนหน้าจอ = ฮิตสุดก่อน (เจ้าของ 3 พ.ย. 69) — นับจากประวัติ Reimbursement.xlsx 1,218 รายการ
 * Taxi 645 · อื่นๆ 346 · ทางด่วน 140 · รับรอง 62 · น้ำมัน 10 · อื่นๆ VAT 8 · โทรศัพท์ 7
 */
export const SECTION_BY_POPULARITY: FormSection[] = ['taxi', 'other', 'toll', 'entertain', 'gas', 'other_vat', 'phone']

