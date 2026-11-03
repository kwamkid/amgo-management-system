// lib/services/bankTransferFile.ts
//
// ไฟล์โอนหลายรายการเข้า SCB Business Anywhere — แบบเดียวกับที่ "SCB CPX Excel Toolkit 1.1.2"
// (file_template/CPX_Toolkit_Template-SCB.08.69.xls ที่บัญชีใช้อยู่) กดปุ่ม Export แล้วได้ · 3 พ.ย. 69
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล (เทสต์ scripts/test-expense-rules.mjs ยิงตรงได้ → ห้ามใช้ '@/')
//
// รูปแบบไล่จากโค้ด VBA ของ toolkit (Export.bas · Sheet1 ExportDebitRow/ExportCreditRow · Util):
//   ข้อความ UTF-8 ไม่มี BOM · คั่นช่องด้วย | · ขึ้นบรรทัด CRLF · ไม่มีบรรทัดว่างท้ายไฟล์
//   HEADER|<file ref = DDMMYYHHMMSS + product>
//   BCHDET|<batch ref = DDMMYYHHMMSS>|<product>|<yyyymmdd>|<บัญชีตัดเงิน>|<บัญชีหักค่าธรรมเนียม>|<ยอดรวม>|<จำนวนรายการ>||
//   TXNDET|… 28 ช่องต่อรายการ (ดู txnRow)
//   TRAILR|1|<จำนวนรายการ>|<ยอดรวม>
//
// template นี้โอนได้เฉพาะปลายทาง SCB (Own account transfer / 3rd Party Transfer) — บัญชีธนาคารอื่น
// ต้องใช้ template ธนาคารอื่น (CPX_Toolkit_Template-08.69.xls · ยังไม่ทำ) จึงคืนเป็น problems

import { getBank } from '../constants/banks.ts'

/** ข้อมูลที่ไฟล์โอนต้องใช้จากใบเบิก (ExpenseClaim มีครบ) */
export interface TransferSource {
  id: string
  kind: 'reimburse' | 'supplier'
  amount: number
  description: string
  /** ชื่อจริงพนักงาน = ชื่อบัญชีรับเงิน (reimburse) */
  ownerFullName?: string | null
  bankName?: string | null
  bankAccountNo?: string | null
  payeeName?: string | null
  payeeBank?: string | null
  payeeAccountNo?: string | null
}

export interface TransferLine {
  seq: number
  accountName: string
  bankCode: string // SCB, KBANK …
  bankClearing: string // 014, 004 …
  accountNo: string // ตัวเลขล้วน
  amount: number
  reference: string
  claimIds: string[]
}

export interface TransferProblem {
  claimId: string
  reason: string
}

/** บริการโอนใน toolkit (กลุ่ม SCB Transfer) — template ของบัญชีใช้ Own account transfer */
export type ScbProduct = 'OAT' | '3PT'
export const SCB_PRODUCT_LABEL: Record<ScbProduct, string> = {
  OAT: 'Own account transfer',
  '3PT': '3rd Party Transfer',
}

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * เลขบัญชี SCB 10 หลัก + check digit — สูตรเดียวกับ CheckScbDigit ของ toolkit
 * (9 หลักแรก × 4,3,2,7,6,5,4,3,2 เก็บหลักหน่วย → รวม → 10 − หลักหน่วยของผลรวม → หลักหน่วย = หลักสุดท้าย)
 */
export function isScbAccount(acc: string): boolean {
  if (!/^\d{10}$/.test(acc)) return false
  const key = '432765432'
  let sum = 0
  for (let i = 0; i < 9; i++) sum += (Number(acc[i]) * Number(key[i])) % 10
  return (10 - (sum % 10)) % 10 === Number(acc[9])
}

// toolkit ห้ามอักขระเหล่านี้ในชื่อผู้รับ/หมายเหตุ และห้ามขึ้นต้นด้วยช่องว่าง (validateTextWithSpecialChar)
const SPECIAL = /[!"#$%&*+;<=>?@[\\\]^_`{|}~]/g
/** ข้อความที่ toolkit รับ: ตัดอักขระต้องห้าม ยุบช่องว่าง ตัดความยาว */
export function scbText(s: string, max: number): string {
  return s.replace(SPECIAL, ' ').replace(/\s+/g, ' ').replace(/\s+\)/g, ')').trim().slice(0, max).trim()
}

/**
 * ใบรอโอน → บรรทัดในไฟล์โอน · บัญชีปลายทางเดียวกันรวมเป็นบรรทัดเดียว (โอนครั้งเดียว)
 * ใบที่ใส่ไฟล์ไม่ได้ (ข้อมูลบัญชีไม่ครบ · ไม่ใช่ SCB · check digit ไม่ผ่าน) คืนใน problems ให้หน้าจอเตือน
 */
export function buildTransferLines(claims: TransferSource[]): { lines: TransferLine[]; problems: TransferProblem[] } {
  const problems: TransferProblem[] = []
  const byAccount = new Map<string, Omit<TransferLine, 'seq'>>()

  for (const c of claims) {
    const supplier = c.kind === 'supplier'
    const name = scbText((supplier ? c.payeeName : c.ownerFullName) ?? '', 140)
    const bank = getBank(supplier ? c.payeeBank : c.bankName)
    const acc = digits(supplier ? c.payeeAccountNo : c.bankAccountNo)

    if (!bank) {
      problems.push({ claimId: c.id, reason: supplier ? 'ยังไม่ได้เลือกธนาคารของ supplier' : 'พนักงานยังไม่ได้ใส่ธนาคาร' })
      continue
    }
    if (bank.code !== 'SCB') {
      problems.push({ claimId: c.id, reason: `บัญชี${bank.nameTh} — ไฟล์ SCB โอนได้เฉพาะบัญชี SCB` })
      continue
    }
    if (!isScbAccount(acc)) {
      problems.push({ claimId: c.id, reason: 'เลขบัญชี SCB ไม่ถูกต้อง (ต้อง 10 หลักและเลขตรวจสอบถูก)' })
      continue
    }
    if (!name) {
      problems.push({ claimId: c.id, reason: 'ไม่มีชื่อบัญชีผู้รับ' })
      continue
    }

    const key = `${bank.code}|${acc}`
    const line = byAccount.get(key)
    if (line) {
      line.amount = round2(line.amount + c.amount)
      line.claimIds.push(c.id)
      line.reference = `${line.claimIds.length} รายการ`
    } else {
      byAccount.set(key, {
        accountName: name,
        bankCode: bank.code,
        bankClearing: bank.clearing,
        accountNo: acc,
        amount: round2(c.amount),
        reference: scbText(c.description, 200),
        claimIds: [c.id],
      })
    }
  }

  const lines = [...byAccount.values()].map((l, i) => ({ ...l, seq: i + 1 }))
  return { lines, problems }
}

// ── ไฟล์ .txt สำหรับอัปโหลด ────────────────────────────────────────────────

/** ยอดเงินแบบ toolkit: ทศนิยม 2 ตำแหน่ง ไม่มีคอมมา (FormatNumber แล้วตัด ,) */
export const scbAmount = (n: number) => round2(n).toFixed(2)

const pad2 = (n: number) => String(n).padStart(2, '0')
/** DDMMYYHHMMSS ตามเวลาในเครื่อง — ref ของไฟล์/ชุดรายการ (generateCustomerBatchReferanceName) */
export function scbStamp(d: Date): string {
  return (
    pad2(d.getDate()) + pad2(d.getMonth() + 1) + pad2(d.getFullYear() % 100) +
    pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds())
  )
}

export interface ScbFileInput {
  lines: TransferLine[]
  product: ScbProduct
  /** บัญชีตัดเงินของบริษัท (SCB 10 หลัก) — ใช้หักค่าธรรมเนียมด้วย แบบ template */
  debitAccount: string
  /** วันที่รายการมีผล yyyy-mm-dd (ค.ศ.) */
  valueDate: string
  now: Date
}

/**
 * ช่องรายการโอน 28 ช่อง — ตำแหน่งตาม ExportCreditRow (ไม่ใช้ใบแจ้งหนี้/หัก ณ ที่จ่าย/แจ้งเตือน)
 * เทียบกับ Export ของ toolkit จากข้อมูลจริง 5 รายการใน template แล้ว ตรงทุกช่องยกเว้นแจ้งเตือน
 * ถ้าจะเปิดแจ้งเตือนแบบ template (บัญชีใส่อีเมล supplier + cc อีเมลบัญชี):
 *   [9]='Y' [10]=เบอร์ตัดขีด (≤3 เบอร์ คั่น ,) · [11]='Y' [12]=อีเมลคั่น , (5–100 ตัว)
 *   [20]='Y' เมื่อมีอีเมล · [25]='E' เมื่อมีอีเมล · [26]=อีเมลเดียวกับ [12]
 */
function txnRow(l: TransferLine): string {
  const f: string[] = new Array(28).fill('')
  f[0] = 'TXNDET'
  f[1] = '' // Customer Transaction Ref — template เว้นว่าง
  f[2] = l.accountNo
  f[3] = '' // PromptPay proxy type — เฉพาะ PPY
  f[4] = l.bankClearing // 014
  f[5] = '0111' // สาขา: OAT/3PT ใส่ค่าคงที่นี้ ไม่ต้องกรอก Branch Code
  f[6] = scbAmount(l.amount)
  f[7] = '' // Service Type — OAT/3PT ว่าง
  f[8] = 'BEN' // หักค่าธรรมเนียมจากผู้รับ — Recipient (BEN) แบบ template
  f[9] = 'N' // SMS
  f[11] = 'N' // Email
  f[13] = l.accountName
  f[17] = 'N' // WHT
  f[20] = 'N' // Payment advice (มีเมื่อมีอีเมล)
  f[21] = 'N' // Invoice
  f[25] = 'N' // ส่งหนังสือรับรองหัก ณ ที่จ่าย
  f[27] = l.reference // Payment Advice Remark ≤200
  return f.join('|')
}

export function validateScbFileInput(i: ScbFileInput): string | null {
  if (!i.lines.length) return 'ไม่มีรายการโอน'
  if (!isScbAccount(digits(i.debitAccount))) return 'บัญชีตัดเงินต้องเป็นเลขบัญชี SCB 10 หลักที่ถูกต้อง'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.valueDate)) return 'เลือกวันที่รายการมีผล'
  const today = `${i.now.getFullYear()}-${pad2(i.now.getMonth() + 1)}-${pad2(i.now.getDate())}`
  if (i.valueDate < today) return 'วันที่รายการมีผลต้องไม่ย้อนหลัง'
  return null
}

/** เนื้อไฟล์ + ชื่อไฟล์แบบที่ toolkit ตั้งให้ (SCB_file_reference_DDMMYYHHMMSS.txt) */
export function buildScbFile(i: ScbFileInput): { filename: string; content: string; total: number; count: number } {
  const problem = validateScbFileInput(i)
  if (problem) throw new Error(problem)
  const stamp = scbStamp(i.now)
  const debit = digits(i.debitAccount)
  const total = round2(i.lines.reduce((s, l) => s + l.amount, 0))
  const count = i.lines.length
  const rows = [
    `HEADER|${stamp}${i.product}`,
    ['BCHDET', stamp, i.product, i.valueDate.replace(/-/g, ''), debit, debit, scbAmount(total), String(count), '', ''].join('|'),
    ...i.lines.map(txnRow),
    `TRAILR|1|${count}|${scbAmount(total)}`,
  ]
  return { filename: `SCB_file_reference_${stamp}.txt`, content: rows.join('\r\n'), total, count }
}
