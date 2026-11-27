// lib/services/expenseExport.ts
//
// ไฟล์ Excel ของฝ่ายบัญชี (สร้างในเบราว์เซอร์ — exceljs โหลดตอนกดเท่านั้น) · 3 พ.ย. 69
//   1. ไฟล์โอน SCB (.txt) — ใบรอโอน (เบิกคืนแบบโอน + จ่าย supplier) · รูปแบบอยู่ bankTransferFile.ts
//   2. สรุปค่าใช้จ่ายสิ้นเดือน — สรุปตามรหัสบัญชี + ตามหมวดย่อย + รายการทุกใบ
//      (27 พ.ย. 69 แทนฟอร์ม "EXPENSES REIMBURSEMENT" เดิม)

import type { Workbook, Worksheet } from 'exceljs'
import {
  buildScbFile,
  buildTransferLines,
  splitByProduct,
  type FileProduct,
  type TransferProblem,
} from './bankTransferFile'
import {
  ACCOUNT_GROUPS,
  SECTION_LABEL,
  accountName,
  accountOf,
  formSectionOf,
  groupOfSection,
  type FormSection,
} from './expenseRules'
import type { ExpenseClaim } from './expenseService'

const MONEY = '#,##0.00'
const DATE = 'dd/mm/yyyy'

/** 'yyyy-mm-dd' → Date ที่ Excel อ่านเป็นวันเดียวกัน (exceljs เขียนวันที่แบบ UTC) */
const xlDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'amgo'
  wb.created = new Date()
  return wb
}

async function save(wb: Workbook, filename: string) {
  const { saveAs } = await import('file-saver')
  const out = await wb.xlsx.writeBuffer()
  saveAs(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

// ── 1. ไฟล์โอน SCB (.txt แบบ CPX toolkit — อัปโหลดเข้า SCB Business Anywhere ได้เลย) ──

export interface TransferFileOptions {
  debitAccount: string
  valueDate: string // yyyy-mm-dd
}

/**
 * สร้างไฟล์โอนแล้วดาวน์โหลด · 1 ไฟล์ = 1 บริการ: ใบ SCB → ไฟล์ OAT/3PT · ธนาคารอื่น → ไฟล์ ORFT
 * (เลือกปนกันได้ 2 ไฟล์) · คืนใบที่ใส่ไฟล์ได้ และใบที่ใส่ไม่ได้พร้อมเหตุผล
 */
export async function downloadTransferFile(
  claims: ExpenseClaim[],
  opts: TransferFileOptions
): Promise<{
  includedIds: string[]
  total: number
  problems: TransferProblem[]
  /** ไฟล์ที่ดาวน์โหลด — เก็บสำเนาไว้ดาวน์โหลดซ้ำ (saveExportFile) */
  files: { filename: string; content: string; count: number; total: number; product: FileProduct }[]
}> {
  const { lines, problems } = buildTransferLines(claims)
  if (!lines.length) return { includedIds: [], total: 0, problems, files: [] }

  // ไฟล์ที่ 2 เลื่อนเวลา 1 วินาที — ref/ชื่อไฟล์ใช้ DDMMYYHHMMSS ห้ามซ้ำกัน
  const start = Date.now()
  const files = splitByProduct(lines).map((g, i) => ({
    ...buildScbFile({ ...opts, lines: g.lines, product: g.product, now: new Date(start + i * 1000) }),
    product: g.product,
  }))
  const { saveAs } = await import('file-saver')
  // UTF-8 ไม่มี BOM — toolkit เขียนแบบนี้ (ตัด BOM ทิ้งก่อนเซฟ)
  for (const f of files) saveAs(new Blob([new TextEncoder().encode(f.content)], { type: 'text/plain' }), f.filename)

  return {
    includedIds: lines.flatMap((l) => l.claimIds),
    total: files.reduce((s, f) => s + f.total, 0),
    problems,
    files,
  }
}

// ── 2. สรุปสิ้นเดือน — ตามรหัสบัญชี (เจ้าของ 27 พ.ย. 69: เลิกฟอร์ม EXPENSES REIMBURSEMENT) ──

export interface MonthlyReportInput {
  month: string // yyyy-mm
  companyName: string // หัวชีต เช่น AG Dragon Co., Ltd.
  companyCode: string
  claims: ExpenseClaim[]
  /** companyId → รหัสบริษัท (คอลัมน์บริษัทในชีตรายการ) */
  companyCodes?: Record<string, string>
}

const r2 = (n: number) => Math.round(n * 100) / 100
const NO_CODE = 'ยังไม่ระบุ'

/** แถวหัวตาราง ตัวหนา มีเส้นใต้ */
function header(ws: Worksheet, cols: string[]) {
  const row = ws.addRow(cols)
  row.font = { bold: true }
  row.eachCell((c) => {
    c.border = { bottom: { style: 'thin' } }
  })
}

/** ตารางสรุป: กลุ่ม · ชื่อ · จำนวนใบ · ยอดรวม · VAT · ก่อน VAT + แถวรวม */
function summaryTable(ws: Worksheet, title: string, cols: [string, string], groups: { key: string; name: string; list: ExpenseClaim[] }[]) {
  ws.addRow([title]).font = { bold: true, size: 13 }
  ws.addRow([])
  header(ws, [...cols, 'จำนวนใบ', 'ยอดรวม', 'VAT', 'ยอดก่อน VAT'])
  const first = ws.rowCount + 1
  for (const g of groups) {
    const total = r2(g.list.reduce((s, c) => s + c.amount, 0))
    const vat = r2(g.list.reduce((s, c) => s + c.vatAmount, 0))
    ws.addRow([g.key, g.name, g.list.length, total, vat, r2(total - vat)])
  }
  const last = ws.rowCount
  const sum = ws.addRow(['รวมทั้งเดือน', null,
    { formula: `SUM(C${first}:C${last})` }, { formula: `SUM(D${first}:D${last})` },
    { formula: `SUM(E${first}:E${last})` }, { formula: `SUM(F${first}:F${last})` }])
  sum.font = { bold: true }
  sum.eachCell((c) => {
    c.border = { top: { style: 'thin' }, bottom: { style: 'double' } }
  })
  ws.columns = [14, 36, 10, 16, 14, 16].map((width) => ({ width }))
  for (const col of [4, 5, 6]) ws.getColumn(col).numFmt = MONEY
}

/** workbook สรุปสิ้นเดือน — แยกจากการดาวน์โหลดเพื่อสร้างไฟล์ตัวอย่างนอกเบราว์เซอร์ได้ */
export async function buildMonthlyReport({ month, companyName, claims, companyCodes = {} }: MonthlyReportInput): Promise<Workbook> {
  const [y, m] = month.split('-').map(Number)
  const period = `${String(m).padStart(2, '0')}/${y}`
  const wb = await newWorkbook()

  // 1. ตามรหัสบัญชี (หมวดบัญชี) — เรียงตามรหัส · ไม่มีรหัสรวมเป็น "ยังไม่ระบุ" ไว้ท้าย
  const byCode = new Map<string, ExpenseClaim[]>()
  for (const c of claims) {
    const k = accountOf(c) ?? NO_CODE
    byCode.set(k, [...(byCode.get(k) ?? []), c])
  }
  const codeKeys = [...byCode.keys()].sort((a, b) => (a === NO_CODE ? 1 : b === NO_CODE ? -1 : a.localeCompare(b)))
  summaryTable(
    wb.addWorksheet('สรุปตามรหัสบัญชี'),
    `สรุปค่าใช้จ่ายตามรหัสบัญชี ${companyName} — เดือน ${period}`,
    ['รหัสบัญชี', 'ชื่อบัญชี'],
    codeKeys.map((k) => ({
      key: k,
      name: k === NO_CODE ? 'ยังไม่ระบุรหัสบัญชี' : accountName(k),
      list: byCode.get(k)!,
    }))
  )

  // 2. ตามหมวดย่อย (ไว้ดูสถิติ) — เรียงตามหมวดบัญชีแล้วหมวดย่อย
  const order = ACCOUNT_GROUPS.flatMap((g) => g.subs)
  const bySub = new Map<FormSection, ExpenseClaim[]>()
  for (const c of claims) {
    const k = formSectionOf(c.category)
    bySub.set(k, [...(bySub.get(k) ?? []), c])
  }
  summaryTable(
    wb.addWorksheet('สรุปตามหมวดย่อย'),
    `สรุปค่าใช้จ่ายตามหมวดย่อย ${companyName} — เดือน ${period}`,
    ['หมวดบัญชี', 'หมวดย่อย'],
    order
      .filter((k) => bySub.has(k))
      .map((k) => ({ key: groupOfSection(k).short, name: SECTION_LABEL[k], list: bySub.get(k)! }))
  )

  // 3. รายการทุกใบ
  const ws = wb.addWorksheet('รายการ')
  header(ws, ['วันที่', 'ผู้เบิก', 'แบบ', 'รายการ', 'หมวดย่อย', 'รหัสบัญชี', 'ชื่อบัญชี', 'ยอด', 'VAT', 'บริษัท', 'สถานะ'])
  const sorted = [...claims].sort((a, b) => a.expenseDate.localeCompare(b.expenseDate) || a.userName.localeCompare(b.userName, 'th'))
  for (const c of sorted) {
    const code = accountOf(c)
    const row = ws.addRow([
      xlDate(c.expenseDate),
      c.ownerFullName || c.userName,
      c.kind === 'supplier' ? 'จ่าย supplier' : 'เบิกคืน',
      c.kind === 'supplier' && c.payeeName ? `${c.payeeName} · ${c.description}` : c.description,
      SECTION_LABEL[formSectionOf(c.category)],
      code ?? NO_CODE,
      code ? accountName(code) : '',
      c.amount,
      c.vatAmount,
      (c.companyId && companyCodes[c.companyId]) || '',
      c.status === 'paid' ? 'จ่ายแล้ว' : 'อนุมัติแล้ว รอจ่าย',
    ])
    row.getCell(1).numFmt = DATE
  }
  const n = ws.rowCount
  const total = ws.addRow(['รวม', null, null, null, null, null, null, { formula: `SUM(H2:H${n})` }, { formula: `SUM(I2:I${n})` }])
  total.font = { bold: true }
  ws.columns = [12, 22, 12, 40, 30, 11, 30, 14, 12, 10, 16].map((width) => ({ width }))
  for (const col of [8, 9]) ws.getColumn(col).numFmt = MONEY
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  return wb
}

export async function downloadMonthlyReport(input: MonthlyReportInput) {
  const wb = await buildMonthlyReport(input)
  await save(wb, `ค่าใช้จ่าย-${input.companyCode}-${input.month}.xlsx`)
}
