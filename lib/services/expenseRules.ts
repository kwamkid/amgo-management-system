// lib/services/expenseRules.ts
//
// กติกาใบเบิกค่าใช้จ่าย — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// (เทสต์ scripts/test-expense-rules.mjs ยิงตรงได้ → ห้ามใช้ '@/' และ import ต้องมี .ts)

import { periodMonth, type CycleCode } from './payrollCycle.ts'

/**
 * หมวดย่อยที่พนักงานเลือก (ไว้ดูสถิติ) — เก็บใน expense_claims.category (เจ้าของ 27 พ.ย. 69)
 * แต่ละหมวดย่อยอยู่ใต้หมวดบัญชี (รหัสผังบัญชี) ใน ACCOUNT_GROUPS
 */
export type ExpenseCategory =
  | 'taxi' | 'toll' | 'gas' | 'entertain' | 'shipping' | 'promo' | 'ads'
  | 'packaging' | 'stationery' | 'supplies' | 'repair' | 'phone' | 'welfare' | 'other'
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

/** ชื่อหมวดย่อยเต็ม ๆ ที่พนักงานเห็น */
export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  taxi: 'ค่าเดินทาง (Taxi · Grab · BTS · วิน)',
  toll: 'ทางด่วน / ที่จอดรถ',
  gas: 'ค่าน้ำมัน / ชาร์จรถ',
  entertain: 'ค่ารับรอง (เลี้ยงลูกค้า · ข้าวงานแฟร์)',
  shipping: 'ค่าส่งของ (Lalamove · ไปรษณีย์)',
  promo: 'ป้าย · สติ๊กเกอร์ · ของแจกงานขาย',
  ads: 'ค่าโฆษณา',
  packaging: 'ถุง · กล่อง · บรรจุภัณฑ์',
  stationery: 'เครื่องเขียน · ปริ้นท์เอกสาร',
  supplies: 'ของใช้สิ้นเปลือง',
  repair: 'ค่าซ่อม',
  phone: 'ค่าโทรศัพท์ / อินเทอร์เน็ต',
  welfare: 'สวัสดิการพนักงาน (ขนม · ของขวัญ)',
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

// ── หมวดบัญชี + หมวดย่อย (เจ้าของ 27 พ.ย. 69 — แทนฟอร์ม Excel "EXPENSES REIMBURSEMENT" 7 ช่องเดิม) ──
// พนักงานเลือก 2 ชั้น: หมวดบัญชี (รหัสผังบัญชีที่บัญชีรวมยอด → account_code) แล้วหมวดย่อย (ไว้ดูสถิติ → category)

/** ชื่อเดิมของหมวดย่อย — call site เก่ายังใช้ชื่อนี้ (= ExpenseCategory) */
export type FormSection = ExpenseCategory

/** ผังบัญชีทั้งหมด — บัญชีเลือกทับหมวดบัญชีของใบได้จากรายการนี้ */
export const ACCOUNT_CODES: { code: string; name: string }[] = [
  { code: '1111-50', name: 'เงินสดย่อย' },
  { code: '1151-01', name: 'ค่าใช้จ่ายจ่ายล่วงหน้า-ค่าสินค้า' },
  { code: '1151-03', name: 'ค่าใช้จ่ายจ่ายล่วงหน้า-ค่าเช่า' },
  { code: '1151-04', name: 'ค่าใช้จ่ายจ่ายล่วงหน้า-อื่น ๆ' },
  { code: '1410-03', name: 'อุปกรณ์สำนักงาน' },
  { code: '1410-04', name: 'เครื่องตกแต่งสำนักงาน' },
  { code: '1410-06', name: 'เครื่องมือเครื่องใช้สำนักงาน' },
  { code: '1410-07', name: 'ส่วนปรับปรุงอาคาร' },
  { code: '1410-08', name: 'สินทรัพย์ระหว่างก่อสร้าง' },
  { code: '1500-01', name: 'เงินประกัน-เช่าพื้นที่' },
  { code: '1500-02', name: 'เงินประกัน-MEGA' },
  { code: '1500-05', name: 'เงินประกัน' },
  { code: '2120-01', name: 'เจ้าหนี้การค้า' },
  { code: '2120-03', name: 'เจ้าหนี้อื่น' },
  { code: '2131-09', name: 'ค่าใช้จ่ายค้างจ่าย-อื่น ๆ' },
  { code: '2138-00', name: 'เงินกู้ยืมจากกรรมการ' },
  { code: '4100-04', name: 'ส่วนลดจ่าย' },
  { code: '5110-00', name: 'ต้นทุนสินค้าเพื่อขาย' },
  { code: '5130-02', name: 'ส่วนลดรับ' },
  { code: '5130-04', name: 'ค่าใช้จ่ายในการนำเข้า' },
  { code: '5200-02', name: 'ค่าโฆษณา' },
  { code: '5200-04', name: 'ค่าส่งเสริมการขาย' },
  { code: '5200-05', name: 'ค่าขนส่ง' },
  { code: '5200-06', name: 'ค่ารับรอง' },
  { code: '5200-09', name: 'ค่าใช้จ่ายเดินทางและยานพาหนะ' },
  { code: '5200-12', name: 'ค่าหีบห่อและบรรจุภัณฑ์' },
  { code: '5310-01', name: 'เงินเดือน' },
  { code: '5310-02', name: 'ค่าล่วงเวลา' },
  { code: '5310-04', name: 'โบนัส' },
  { code: '5310-05', name: 'ค่าจ้างพนักงาน' },
  { code: '5310-08', name: 'คอมมิชชั่น' },
  { code: '5310-09', name: 'เงินสมทบกองทุนประกันสังคม' },
  { code: '5310-10', name: 'เงินสมทบกองทุนทดแทน' },
  { code: '5310-12', name: 'ค่าอบรมสัมมนา' },
  { code: '5310-17', name: 'ค่าสวัสดิการพนักงาน' },
  { code: '5320-01', name: 'ค่าเครื่องเขียนแบบพิมพ์' },
  { code: '5320-02', name: 'ค่าซ่อมแซม' },
  { code: '5320-03', name: 'วัสดุสิ้นเปลือง' },
  { code: '5320-04', name: 'วัสดุสิ้นเปลืองร้านอาหาร' },
  { code: '5320-05', name: 'ค่าเช่า' },
  { code: '5320-07', name: 'ค่ารักษาความสะอาด' },
  { code: '5320-08', name: 'ค่าบริการสำนักงาน' },
  { code: '5320-09', name: 'ค่าบริการพื้นที่แสดงสินค้า' },
  { code: '5320-10', name: 'ค่าบริการโปรแกรม Online' },
  { code: '5330-02', name: 'ค่าไฟฟ้า' },
  { code: '5330-03', name: 'ค่าน้ำประปา' },
  { code: '5330-05', name: 'ค่าอินเทอร์เน็ต' },
  { code: '5330-06', name: 'ค่าใช้จ่ายส่วนกลาง' },
  { code: '5350-01', name: 'ค่าเบี้ยประกัน-อาคาร' },
  { code: '5360-01', name: 'ภาษีบำรุงท้องที่และภาษีโรงเรือน' },
  { code: '5360-04', name: 'ค่าธรรมเนียมธนาคาร' },
  { code: '5360-05', name: 'ค่าตรวจสอบบัญชีและที่ปรึกษา' },
  { code: '5360-06', name: 'ค่าธรรมเนียมอื่น' },
  { code: '5370-01', name: 'ดอกเบี้ยจ่าย' },
  { code: '5390-01', name: 'ค่าใช้จ่ายต้องห้ามตามประมวลรัษฎากร' },
]

const ACCOUNT_NAME = new Map(ACCOUNT_CODES.map((a) => [a.code, a.name]))
/** ชื่อบัญชีจากรหัส · ไม่รู้จัก = '' */
export const accountName = (code: string | null | undefined): string => (code ? ACCOUNT_NAME.get(code) ?? '' : '')
/** "5200-09 ค่าใช้จ่ายเดินทางและยานพาหนะ" */
export const accountLabel = (code: string): string => `${code} ${accountName(code)}`.trim()

export type AccountGroupKey =
  | 'travel' | 'entertain' | 'shipping' | 'promo' | 'ads' | 'packaging'
  | 'stationery' | 'supplies' | 'repair' | 'phone' | 'welfare' | 'other'

export interface AccountGroup {
  key: AccountGroupKey
  /** รหัสผังบัญชี · null = อื่น ๆ (บัญชีเลือกรหัสเอง) */
  code: string | null
  label: string
  short: string
  /** หมวดย่อยในหมวดนี้ — ตัวแรก = ตั้งต้น · เพิ่มหมวดย่อยได้แค่ใส่ในนี้ (+ type/label/ไอคอน) */
  subs: ExpenseCategory[]
}

/** หมวดบัญชีที่พนักงานเลือก ตามลำดับบนหน้าจอ (เจ้าของ 27 พ.ย. 69) */
export const ACCOUNT_GROUPS: AccountGroup[] = [
  { key: 'travel', code: '5200-09', label: 'ค่าเดินทางและยานพาหนะ', short: 'เดินทาง', subs: ['taxi', 'toll', 'gas'] },
  { key: 'entertain', code: '5200-06', label: 'ค่ารับรอง', short: 'รับรอง', subs: ['entertain'] },
  { key: 'shipping', code: '5200-05', label: 'ค่าขนส่ง', short: 'ขนส่ง', subs: ['shipping'] },
  { key: 'promo', code: '5200-04', label: 'ค่าส่งเสริมการขาย', short: 'ส่งเสริมการขาย', subs: ['promo'] },
  { key: 'ads', code: '5200-02', label: 'ค่าโฆษณา', short: 'โฆษณา', subs: ['ads'] },
  { key: 'packaging', code: '5200-12', label: 'ค่าหีบห่อและบรรจุภัณฑ์', short: 'บรรจุภัณฑ์', subs: ['packaging'] },
  { key: 'stationery', code: '5320-01', label: 'ค่าเครื่องเขียนแบบพิมพ์', short: 'เครื่องเขียน', subs: ['stationery'] },
  { key: 'supplies', code: '5320-03', label: 'วัสดุสิ้นเปลือง', short: 'สิ้นเปลือง', subs: ['supplies'] },
  { key: 'repair', code: '5320-02', label: 'ค่าซ่อมแซม', short: 'ซ่อม', subs: ['repair'] },
  { key: 'phone', code: '5330-05', label: 'ค่าอินเทอร์เน็ต / โทรศัพท์', short: 'โทร/เน็ต', subs: ['phone'] },
  { key: 'welfare', code: '5310-17', label: 'ค่าสวัสดิการพนักงาน', short: 'สวัสดิการ', subs: ['welfare'] },
  { key: 'other', code: null, label: 'อื่น ๆ (บัญชีเลือกรหัส)', short: 'อื่น ๆ', subs: ['other'] },
]

const GROUP_BY_KEY = new Map(ACCOUNT_GROUPS.map((g) => [g.key, g]))
const OTHER_GROUP = GROUP_BY_KEY.get('other')!
export const groupByKey = (key: AccountGroupKey): AccountGroup => GROUP_BY_KEY.get(key) ?? OTHER_GROUP
/** หมวดบัญชีที่หมวดย่อยนี้อยู่ */
export const groupOfSection = (sub: ExpenseCategory): AccountGroup =>
  ACCOUNT_GROUPS.find((g) => g.subs.includes(sub)) ?? OTHER_GROUP
/** หมวดบัญชีของรหัส · รหัสนอก 12 หมวด / ไม่มีรหัส = อื่น ๆ */
export const groupOfCode = (code: string | null | undefined): AccountGroup =>
  (code && ACCOUNT_GROUPS.find((g) => g.code === code)) || OTHER_GROUP

/** รหัสบัญชีตั้งต้นของหมวดย่อย (อื่น ๆ = null) */
export const SECTION_ACCOUNT = Object.fromEntries(
  ACCOUNT_GROUPS.flatMap((g) => g.subs.map((s) => [s, g.code]))
) as Record<ExpenseCategory, string | null>

/** รหัสบัญชีของใบ — ที่เก็บไว้ ไม่มีก็ใช้รหัสตั้งต้นของหมวดย่อย · null = ยังไม่ระบุ */
export function accountOf(claim: { category: string; accountCode?: string | null }): string | null {
  return claim.accountCode ?? SECTION_ACCOUNT[formSectionOf(claim.category)] ?? null
}

/** หมวดบัญชี (1 ใน 12) ของใบ — รหัสนอกรายการ = อื่น ๆ */
export const groupOf = (claim: { category: string; accountCode?: string | null }): AccountGroup =>
  groupOfCode(accountOf(claim))

const LEGACY: Record<string, ExpenseCategory> = { travel: 'taxi', parking: 'toll', fuel: 'gas', meal: 'entertain' }

/** หมวดย่อยของใบ — ค่าเก่าก่อน migration 20261127120000 (travel/parking/fuel/meal) แปลงให้ · VAT ไม่มีผลแล้ว */
export function formSectionOf(category: string): ExpenseCategory {
  if (category in CATEGORY_LABEL) return category as ExpenseCategory
  return LEGACY[category] ?? 'other'
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
// ลำดับสำคัญ: "ค่าน้ำมัน" ต้องมาก่อน "ค่าน้ำ" และ "ขนของ" (ค่าน้ำมันขนของ = น้ำมัน) · "ค่าส่ง/ลาล่า" (ขนของ) = ส่งของ ไม่ใช่ Taxi
// หมวดใหม่ 27 พ.ย. (ป้าย/บรรจุภัณฑ์/เครื่องเขียน …) วางหลังกติกาเดิมที่วัดแล้ว จะได้ไม่แย่งแถวที่เคยถูก
const SECTION_WORDS: [FormSection, RegExp][] = [
  ['phone', /โทรศัพท์|ค่าโทร|ซิม|เติมเงินมือถือ|แพ็กเกจเน็ต|อินเทอร์เน็ต|internet/i],
  ['gas', /น้ำมัน|เติมแก๊ส|ngv|lpg|ชาร์จรถ|\d+(\.\d+)?\s*l\.\s/i],
  // ขนของ/ส่งของ — ก่อนจะโดนคำว่า "ค่ารถ" ดึงไป Taxi
  ['shipping', /ลาล่า|lalamove|ค่าส่ง(?!เสริม)|ขนส่ง|ขนย้าย|ขนของ|เหมารถ|ไปรษณีย์|พัสดุ|kerry|flash ?express|best ?express|j&t|\bems\b/i],
  // ค่าน้ำค่าไฟสถานที่/ตั๋วเครื่องบิน/ประกัน — อื่น ๆ ก่อนจะโดน "ค่าน้ำ/ไป-กลับ" ดึงไป
  ['other', /ค่าน้ำ(โกดัง|ประปา|สาขา)|ค่าไฟ|เครื่องบิน|ประกัน/i],
  // ค่ารถที่รวมทางด่วนมาในบิลเดียว — บัญชีลง Taxi
  ['taxi', /(ค่ารถ|เรียกรถ|แท็?กซี่|grab).*ทางด่วน/i],
  ['toll', /ทา?่?งด่วน|อีซี่?พาส|easy ?pass|m-?flow|ที่จอด|จอดรถ|ค่าจอด|parking/i],
  ['taxi', /แท็?กซี่|แท๊กซี่|taxi|grab|แก?ร็?[บป]|แกร[บป]|bolt|โบ้?ท|เรียกรถ|ค่ารถ|รถไฟฟ้า|bts|บีทีเอส|mrt|เอ็มอาร์ที|airport ?link|ค่าวิน|วินมอ|มอไซ|มอเตอร์ไซ|เดินทา|รถเมล์|ค่าเรือ|รถตู้|ค่าโดยสาร|ไป-กลับ|ไปกลับ|ขาไป|ขากลับ/i],
  // ก่อนรับรอง — "เค้กวันเกิดพนักงาน/ขนมพนักงาน" จะโดน "เค้ก/ขนม" ดึงไป ("เค้กวันเกิด" เฉย ๆ ยังเป็นรับรองตามประวัติ)
  ['welfare', /สวัสดิการ|ของขวัญ(พนักงาน|วันเกิด)|เค้กวันเกิดพนักงาน/i],
  ['repair', /ซ่อม/i],
  ['ads', /โฆษณา|boost|ยิงแอด|facebook ads|\bads\b/i],
  ['entertain', /ค่าข้าว|ซื้อข้าว|อาหาร|เค้ก|กาแฟ|คาเฟ่|ชานม|ขนม|เครื่องดื่ม|น้ำดื่ม|ค่าน้ำ|ซื้อน้ำ|น้ำแพ็ค|เลี้ยง|food|drink|kfc|mcdonald|pizza|starbucks|ร้านอาหาร/i],
  // หลังรับรอง — "ข้าวกล่อง/ค่าข้าว 26 กล่อง" ยังเป็นรับรอง
  ['promo', /ป้าย|สติ๊กเกอร์|สติกเกอร์|โปสเตอร์|ไวนิล|ของแจก|ของรางวัล|ของพรีเมี่ยม|โรลอัพ/i],
  ['packaging', /ถุง|กล่อง|บับเบิ้ล|บับเบิล|เทปกาว|บรรจุภัณฑ์|หีบห่อ/i],
  ['stationery', /เครื่องเขียน|ปากกา|กระดาษ|ปริ้น|พิมพ์เอกสาร|ถ่ายเอกสาร|หมึก|แฟ้ม/i],
  // ไม่มีคำชัด แต่เป็นการเดินทาง "ไป…/กลับ…/จาก…ไป" — ประวัติส่วนใหญ่คือค่ารถ
  ['taxi', /(^|[\s+])(ไป|กลับ)|จาก.+(ไป|กลับ|-)|(ไป|กลับ)(งาน|แฟร์|บูธ|บูท|ห้อง|บ้าน|ออฟฟิศ|โกดัง|สาขา|วังเด็ก)|uber|นั่งรถ|สนามบิน/i],
]

/** สระ/วรรณยุกต์พิมพ์ซ้ำ (ค่่า · เดิินทาง · ซื้้อ) — ยุบก่อนจับคำ */
const tidy = (s: string) => s.trim().replace(/([ัิ-ฺ็-๎])\1+/g, '$1')

/** เดาหมวดย่อยจากคำในรายละเอียด — ไม่เจออะไรเลย = อื่น ๆ (VAT ไม่มีผลกับหมวดแล้ว) */
export function guessSection(description: string): FormSection {
  const d = tidy(description)
  for (const [section, re] of SECTION_WORDS) if (re.test(d)) return section
  return 'other'
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

/** หมวดย่อย → ค่าที่เก็บใน category (ตอนนี้ตรงตัว — คงไว้ให้ call site เดิม) */
export const SECTION_CATEGORY = Object.fromEntries(
  (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((k) => [k, k])
) as Record<FormSection, ExpenseCategory>

/** ชื่อหมวดย่อยเต็ม */
export const SECTION_LABEL: Record<FormSection, string> = CATEGORY_LABEL

/** ชื่อหมวดย่อยแบบสั้น — แถวรายการ / การ์ด */
export const SECTION_SHORT: Record<FormSection, string> = {
  taxi: 'Taxi',
  toll: 'ทางด่วน/จอด',
  gas: 'น้ำมัน',
  entertain: 'รับรอง',
  shipping: 'ส่งของ',
  promo: 'ส่งเสริมการขาย',
  ads: 'โฆษณา',
  packaging: 'บรรจุภัณฑ์',
  stationery: 'เครื่องเขียน',
  supplies: 'สิ้นเปลือง',
  repair: 'ซ่อม',
  phone: 'โทร/เน็ต',
  welfare: 'สวัสดิการ',
  other: 'อื่น ๆ',
}

/**
 * ลำดับหมวดย่อย = ฮิตสุดก่อน (เจ้าของ 3 พ.ย. 69 · ปรับ 27 พ.ย.) — ใช้ในตัวกรองหมวดย่อย
 * ประวัติ Reimbursement.xlsx 1,218 รายการ: Taxi 645 · อื่นๆ 346 · ทางด่วน 140 · รับรอง 62 · น้ำมัน 10 · โทรศัพท์ 7
 */
export const SECTION_BY_POPULARITY: FormSection[] = [
  'taxi', 'other', 'toll', 'entertain', 'shipping', 'gas', 'promo',
  'supplies', 'stationery', 'packaging', 'phone', 'repair', 'welfare', 'ads',
]
