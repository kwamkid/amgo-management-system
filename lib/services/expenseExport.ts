// lib/services/expenseExport.ts
//
// ไฟล์ Excel ของฝ่ายบัญชี (สร้างในเบราว์เซอร์ — exceljs โหลดตอนกดเท่านั้น) · 3 พ.ย. 69
//   1. ไฟล์โอน SCB (.txt) — ใบรอโอน (เบิกคืนแบบโอน + จ่าย supplier) · รูปแบบอยู่ bankTransferFile.ts
//   2. สรุปค่าใช้จ่ายสิ้นเดือน — ชีตละคนตามฟอร์ม "EXPENSES REIMBURSEMENT" ที่บัญชีใช้อยู่
//      (เดิมทำมือใน Reimbursement.xlsx) + ชีตจ่าย supplier + ชีตสรุปหน้าแรก

import type { Workbook, Worksheet } from 'exceljs'
import { getBank } from '@/lib/constants/banks'
import { buildScbFile, buildTransferLines, type ScbProduct, type TransferProblem } from './bankTransferFile'
import { FORM_SECTIONS, formSectionOf, type FormSection } from './expenseRules'
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
  product: ScbProduct
  debitAccount: string
  valueDate: string // yyyy-mm-dd
}

/** สร้างไฟล์โอนแล้วดาวน์โหลด · คืนใบที่ใส่ไฟล์ได้ และใบที่ใส่ไม่ได้พร้อมเหตุผล */
export async function downloadTransferFile(
  claims: ExpenseClaim[],
  opts: TransferFileOptions
): Promise<{
  includedIds: string[]
  total: number
  problems: TransferProblem[]
  /** ไฟล์ที่ดาวน์โหลด — เก็บสำเนาไว้ดาวน์โหลดซ้ำ (saveExportFile) */
  file?: { filename: string; content: string; count: number; total: number }
}> {
  const { lines, problems } = buildTransferLines(claims)
  if (!lines.length) return { includedIds: [], total: 0, problems }

  const file = buildScbFile({ lines, ...opts, now: new Date() })
  const { saveAs } = await import('file-saver')
  // UTF-8 ไม่มี BOM — toolkit เขียนแบบนี้ (ตัด BOM ทิ้งก่อนเซฟ)
  saveAs(new Blob([new TextEncoder().encode(file.content)], { type: 'text/plain' }), file.filename)

  return { includedIds: lines.flatMap((l) => l.claimIds), total: file.total, problems, file }
}

// ── 2. สรุปสิ้นเดือน ─────────────────────────────────────────────────────

export interface MonthlyReportInput {
  month: string // yyyy-mm
  companyName: string // หัวฟอร์ม เช่น AG Dragon Co., Ltd.
  companyCode: string
  claims: ExpenseClaim[]
}

const thin = { style: 'thin' as const }
const BOX = { top: thin, left: thin, bottom: thin, right: thin }

/** ชีตตามฟอร์ม EXPENSES REIMBURSEMENT — คอลัมน์ A..J แบบเดียวกับไฟล์ของบัญชี */
function writeForm(ws: Worksheet, companyName: string, person: string, formDate: string, claims: ExpenseClaim[]) {
  ws.columns = [12, 18, 14, 12, 10, 12, 10, 12, 12, 14].map((width) => ({ width }))
  ws.getCell('A2').value = 'EXPENSES  REIMBURSEMENT'
  ws.getCell('A2').font = { bold: true, size: 14 }
  ws.getCell('A3').value = companyName
  ws.getCell('A3').font = { bold: true }
  ws.getCell('A5').value = '( Please complete report using Thai Baht )'
  ws.getCell('H5').value = 'Name  :'
  ws.getCell('I5').value = person
  ws.getCell('H6').value = 'Date    :'
  ws.getCell('I6').value = xlDate(formDate)
  ws.getCell('I6').numFmt = DATE

  let r = 8
  const totals: Partial<Record<FormSection, string>> = {}
  const bySection = new Map<FormSection, ExpenseClaim[]>()
  for (const c of claims) {
    const k = formSectionOf(c.category, c.vatAmount)
    bySection.set(k, [...(bySection.get(k) ?? []), c])
  }

  const header = (cells: [string, string][]) => {
    mergeRow(currentKey)
    for (const [addr, text] of cells) {
      const cell = ws.getCell(`${addr}${r}`)
      cell.value = text
      cell.font = { bold: true }
    }
    for (let col = 1; col <= 10; col++) ws.getCell(r, col).border = BOX
    r++
  }
  // ช่องที่รวมเซลล์ต่อหมวด — หัวตารางกับแถวข้อมูลใช้ชุดเดียวกัน
  const MERGES: Record<FormSection, [string, string][]> = {
    taxi: [['B', 'C'], ['D', 'E'], ['F', 'G'], ['H', 'I']],
    entertain: [['B', 'C'], ['D', 'E'], ['F', 'I']],
    phone: [['A', 'I']],
    other_vat: [['B', 'G']],
    toll: [['B', 'I']],
    gas: [['B', 'I']],
    other: [['B', 'I']],
  }
  const mergeRow = (key: FormSection) => {
    for (const [from, to] of MERGES[key]) ws.mergeCells(`${from}${r}:${to}${r}`)
  }
  const money = (addr: string, v: number | { formula: string }) => {
    const cell = ws.getCell(`${addr}${r}`)
    cell.value = v
    cell.numFmt = MONEY
  }

  let currentKey: FormSection = 'taxi'
  const section = (key: FormSection) => {
    currentKey = key
    const title = FORM_SECTIONS.find((s) => s.key === key)!.title
    ws.getCell(`A${r}`).value = title
    ws.getCell(`A${r}`).font = { bold: true }
    r++
    const items = bySection.get(key) ?? []

    if (key === 'taxi') header([['A', 'Date'], ['B', 'Description'], ['D', 'From'], ['F', 'To '], ['H', 'Distance in km'], ['J', 'Amount']])
    else if (key === 'entertain') header([['A', 'Date'], ['B', 'Place of Entertainment'], ['D', 'Business Purpose'], ['F', 'Persons Entertained and Business Relationship'], ['J', 'Amount']])
    else if (key === 'phone') header([['A', 'Description'], ['J', 'Amount']])
    else if (key === 'other_vat') header([['A', 'Date'], ['B', 'Description '], ['H', 'ยอดก่อน Vat'], ['I', 'Vat 7%'], ['J', 'Amount']])
    else header([['A', key === 'toll' ? 'Date / Period' : 'Date'], ['B', key === 'gas' ? 'Reason' : 'Description '], ['J', 'Amount']])

    const first = r
    // อย่างน้อย 1 บรรทัดว่าง — ฟอร์มเปล่าก็ยังมีช่องให้เห็น
    for (const c of items.length ? items : [null]) {
      if (c && key !== 'phone') {
        ws.getCell(`A${r}`).value = xlDate(c.expenseDate)
        ws.getCell(`A${r}`).numFmt = DATE
      }
      mergeRow(key)
      if (key === 'taxi') {
        if (c) {
          ws.getCell(`B${r}`).value = c.description
          ws.getCell(`D${r}`).value = c.routeFrom ?? ''
          ws.getCell(`F${r}`).value = c.routeTo ?? ''
          if (c.distanceKm != null) ws.getCell(`H${r}`).value = c.distanceKm
        }
      } else if (key === 'entertain') {
        if (c) {
          ws.getCell(`B${r}`).value = c.description
          ws.getCell(`D${r}`).value = c.purpose ?? ''
          ws.getCell(`F${r}`).value = c.attendees ?? ''
        }
      } else if (key === 'phone') {
        if (c) ws.getCell(`A${r}`).value = c.description
      } else if (key === 'other_vat') {
        if (c) {
          ws.getCell(`B${r}`).value = c.description
          money('H', Math.round((c.amount - c.vatAmount) * 100) / 100)
          money('I', c.vatAmount)
        }
      } else {
        if (c) {
          const route = key === 'gas' && (c.routeFrom || c.routeTo) ? ` (${c.routeFrom ?? ''} → ${c.routeTo ?? ''})` : ''
          ws.getCell(`B${r}`).value = c.description + route
        }
      }
      if (c) money('J', c.amount)
      for (let col = 1; col <= 10; col++) ws.getCell(r, col).border = BOX
      r++
    }
    money('J', { formula: `SUM(J${first}:J${r - 1})` })
    ws.getCell(`J${r}`).font = { bold: true }
    totals[key] = `J${r}`
    return r++
  }

  ws.getCell(`A${r}`).value = '(A)  TRANSPORT  CLAIMS'
  ws.getCell(`A${r}`).font = { bold: true }
  r += 2
  section('taxi'); r++
  section('toll'); r++
  section('gas')
  ws.getCell(`A${r}`).value = 'Total  Transport  Claim '
  ws.getCell(`A${r}`).font = { bold: true }
  money('J', { formula: `${totals.taxi}+${totals.toll}+${totals.gas}` })
  ws.getCell(`J${r}`).font = { bold: true }
  const transport = `J${r}`
  r += 2

  const labelled = (key: FormSection, label: string) => {
    const at = section(key)
    ws.getCell(`A${at}`).value = label
    ws.getCell(`A${at}`).font = { bold: true }
    r++
  }
  labelled('entertain', 'Total Entertainment Claim for Month')
  labelled('phone', 'Total Telephone Claim for Month')
  labelled('other', 'Total Others')
  labelled('other_vat', 'Total Others Vat 7%')

  ws.getCell(`A${r}`).value = 'Grand Total'
  ws.getCell(`A${r}`).font = { bold: true, size: 12 }
  money('J', { formula: [transport, totals.entertain, totals.phone, totals.other, totals.other_vat].join('+') })
  ws.getCell(`J${r}`).font = { bold: true, size: 12 }
  ws.getCell(`J${r}`).border = { top: thin, bottom: { style: 'double' } }
  r += 5
  ws.getCell(`B${r}`).value = "Requestor's Signature"
  ws.getCell(`G${r}`).value = "Approver's Signature"
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
}

/** ชื่อชีต Excel: ≤31 ตัว ห้าม : \ / ? * [ ] และห้ามซ้ำ */
function sheetName(base: string, used: Set<string>) {
  const clean = base.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 28) || 'Sheet'
  let name = clean
  for (let i = 2; used.has(name); i++) name = `${clean.slice(0, 26)} ${i}`
  used.add(name)
  return name
}

/** workbook สรุปสิ้นเดือน — แยกจากการดาวน์โหลดเพื่อสร้างไฟล์ตัวอย่างนอกเบราว์เซอร์ได้ */
export async function buildMonthlyReport({ month, companyName, claims }: MonthlyReportInput): Promise<Workbook> {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const formDate = `${month}-${String(lastDay).padStart(2, '0')}`
  const tag = `${String(m).padStart(2, '0')}${String(y).slice(2)}` // 1026 = ต.ค. 2026 แบบชื่อชีตเดิม

  const reimburse = claims.filter((c) => c.kind !== 'supplier')
  const supplier = claims.filter((c) => c.kind === 'supplier')
  const people = new Map<string, ExpenseClaim[]>()
  for (const c of reimburse) people.set(c.userId, [...(people.get(c.userId) ?? []), c])
  const sortedPeople = [...people.values()].sort((a, b) => a[0].userName.localeCompare(b[0].userName, 'th'))

  const wb = await newWorkbook()
  const used = new Set<string>()

  // หน้าสรุป — ต่อคน/ต่อช่องของฟอร์ม + supplier
  const sum = wb.addWorksheet(sheetName('สรุป', used))
  sum.addRow([`สรุปค่าใช้จ่าย ${companyName} — เดือน ${String(m).padStart(2, '0')}/${y}`]).font = { bold: true, size: 13 }
  sum.addRow([])
  const sectionKeys = FORM_SECTIONS.map((s) => s.key)
  const head = sum.addRow(['ผู้เบิก', 'Taxi', 'ทางด่วน/จอด', 'น้ำมัน', 'รับรอง', 'โทรศัพท์', 'อื่นๆ', 'อื่นๆ VAT', 'VAT', 'รวม', 'จ่ายแล้ว', 'ค้างจ่าย'])
  head.font = { bold: true }
  const sumOf = (list: ExpenseClaim[]) => Math.round(list.reduce((s, c) => s + c.amount, 0) * 100) / 100
  const firstData = sum.rowCount + 1
  for (const list of sortedPeople) {
    const per = sectionKeys.map((k) => sumOf(list.filter((c) => formSectionOf(c.category, c.vatAmount) === k)))
    sum.addRow([
      list[0].ownerFullName || list[0].userName,
      ...per,
      Math.round(list.reduce((s, c) => s + c.vatAmount, 0) * 100) / 100,
      sumOf(list),
      sumOf(list.filter((c) => c.status === 'paid')),
      sumOf(list.filter((c) => c.status !== 'paid')),
    ])
  }
  if (supplier.length) {
    sum.addRow([
      'จ่าย supplier (ดูชีต Supplier)', null, null, null, null, null, null, null,
      Math.round(supplier.reduce((s, c) => s + c.vatAmount, 0) * 100) / 100,
      sumOf(supplier),
      sumOf(supplier.filter((c) => c.status === 'paid')),
      sumOf(supplier.filter((c) => c.status !== 'paid')),
    ])
  }
  const lastData = sum.rowCount
  if (lastData >= firstData) {
    const total = sum.addRow(['รวมทั้งเดือน'])
    for (let col = 2; col <= 12; col++) {
      const L = String.fromCharCode(64 + col)
      total.getCell(col).value = { formula: `SUM(${L}${firstData}:${L}${lastData})` }
    }
    total.font = { bold: true }
  }
  sum.columns.forEach((c, i) => {
    c.width = i === 0 ? 30 : 13
    if (i > 0) c.numFmt = MONEY
  })

  // ชีตละคนตามฟอร์มเดิม
  for (const list of sortedPeople) {
    const person = list[0].ownerFullName || list[0].userName
    const ws = wb.addWorksheet(sheetName(`${list[0].userName} ${tag}`, used))
    writeForm(ws, companyName, person, formDate, list)
  }

  // จ่าย supplier
  if (supplier.length) {
    const ws = wb.addWorksheet(sheetName(`Supplier ${tag}`, used))
    ws.addRow(['วันที่ใบแจ้งหนี้', 'Supplier (ชื่อบัญชี)', 'ธนาคาร', 'เลขบัญชี', 'รายละเอียด', 'ผู้ขอจ่าย', 'ยอดก่อน VAT', 'VAT 7%', 'ยอดรวม', 'สถานะ', 'วันที่จ่าย']).font = { bold: true }
    for (const c of supplier) {
      const row = ws.addRow([
        xlDate(c.expenseDate),
        c.payeeName ?? '',
        getBank(c.payeeBank)?.nameTh ?? c.payeeBank ?? '',
        c.payeeAccountNo ?? '',
        c.description,
        c.userName,
        Math.round((c.amount - c.vatAmount) * 100) / 100,
        c.vatAmount,
        c.amount,
        c.status === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย',
        c.paidAt ? xlDate(c.paidAt) : null,
      ])
      row.getCell(1).numFmt = DATE
      row.getCell(11).numFmt = DATE
    }
    const n = ws.rowCount
    const total = ws.addRow(['รวม', null, null, null, null, null,
      { formula: `SUM(G2:G${n})` }, { formula: `SUM(H2:H${n})` }, { formula: `SUM(I2:I${n})` }])
    total.font = { bold: true }
    ws.columns.forEach((c, i) => {
      c.width = [14, 28, 14, 16, 36, 14, 14, 12, 14, 10, 14][i]
    })
    for (const col of [7, 8, 9]) ws.getColumn(col).numFmt = MONEY
    ws.getColumn(4).numFmt = '@'
  }

  return wb
}

export async function downloadMonthlyReport(input: MonthlyReportInput) {
  const wb = await buildMonthlyReport(input)
  await save(wb, `ค่าใช้จ่าย-${input.companyCode}-${input.month}.xlsx`)
}
