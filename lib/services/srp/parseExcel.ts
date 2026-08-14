// lib/services/srp/parseExcel.ts
//
// แปลงไฟล์ Excel / ข้อความวางจาก Excel-Sheets (TSV) เป็นรายการสินค้า SRP
// — port ตรงจาก srp-calculator เดิม: จับหัวคอลัมน์ด้วยชื่อ (มี alias เยอะ
// รวมถึงคำสะกดผิดที่เคยเจอจริง) ลำดับคอลัมน์ไม่สำคัญ · แถวไม่มีชื่อสินค้า = ข้าม
// unmerge เซลล์ merge ก่อนอ่าน กันแถวเพี้ยน · ตัดแถวซ้ำด้วย ชื่อ+SKU

import * as XLSX from 'xlsx'

export interface ParsedProduct {
  name: string
  category: string
  sku: string
  fob_usd: number
  fob_eur: number
  freight_do: number
  import_tax_pct: number
  shipping_cost: number
  srp_usd: number
  srp_eur: number
  multiplier: number
  notes: string
}

type Field = keyof ParsedProduct

const COLUMN_MAP: Record<string, Field> = {
  product: 'name',
  'product name': 'name',
  name: 'name',
  category: 'category',
  'product category': 'category',
  sku: 'sku',
  'product code': 'sku',
  code: 'sku',
  'fob (usd)': 'fob_usd',
  'fob usd': 'fob_usd',
  fob: 'fob_usd',
  'cost usd': 'fob_usd',
  'cost (usd)': 'fob_usd',
  'fob (eur)': 'fob_eur',
  'fob eur': 'fob_eur',
  'cost eur': 'fob_eur',
  'cost (eur)': 'fob_eur',
  'freight + d/o': 'freight_do',
  'freight + d/o (thb)': 'freight_do',
  'freigth + d/o (thb)': 'freight_do', // สะกดผิดที่เจอจริงในไฟล์เก่า
  'freight+d/o': 'freight_do',
  'freight+do': 'freight_do',
  'freight & d/o': 'freight_do',
  freight: 'freight_do',
  'freight/do': 'freight_do',
  'import tax (%)': 'import_tax_pct',
  'import tax': 'import_tax_pct',
  tax: 'import_tax_pct',
  'tax %': 'import_tax_pct',
  'tax (%)': 'import_tax_pct',
  'shipping cost': 'shipping_cost',
  'shipping cost (thb)': 'shipping_cost',
  shipping: 'shipping_cost',
  'ship cost': 'shipping_cost',
  'srp (usd)': 'srp_usd',
  'srp usd': 'srp_usd',
  'rrp (usd)': 'srp_usd',
  'rrp usd': 'srp_usd',
  'retail usd': 'srp_usd',
  'srp (eur)': 'srp_eur',
  'srp eur': 'srp_eur',
  'rrp (eur)': 'srp_eur',
  'rrp eur': 'srp_eur',
  rrp: 'srp_eur',
  'retail eur': 'srp_eur',
  srp: 'srp_eur',
  multiplier: 'multiplier',
  x: 'multiplier',
  notes: 'notes',
  note: 'notes',
  remark: 'notes',
  remarks: 'notes',
}

function rowsToProducts(rows: Record<string, unknown>[], defaultMultiplier: number): ParsedProduct[] {
  if (rows.length === 0) return []
  const headers = Object.keys(rows[0])
  const mapping: Record<string, Field> = {}
  for (const h of headers) {
    const norm = h.toString().trim().toLowerCase()
    if (COLUMN_MAP[norm]) mapping[h] = COLUMN_MAP[norm]
  }

  const out: ParsedProduct[] = []
  for (const row of rows) {
    const nameKey = headers.find((h) => mapping[h] === 'name')
    const name = nameKey ? String(row[nameKey] ?? '').trim() : ''
    if (!name) continue

    const getStr = (f: Field) => {
      const k = headers.find((h) => mapping[h] === f)
      return k ? String(row[k] ?? '').trim() : ''
    }
    const getNum = (f: Field) => {
      const k = headers.find((h) => mapping[h] === f)
      if (!k) return 0
      const v = row[k]
      if (typeof v === 'number') return v
      const s = String(v)
        .replace(/[฿€$£¥₩₹₪₫₱​ ,\s]/g, '')
        .replace('%', '')
      return parseFloat(s) || 0
    }

    out.push({
      name,
      category: getStr('category'),
      sku: getStr('sku'),
      fob_usd: getNum('fob_usd'),
      fob_eur: getNum('fob_eur'),
      freight_do: getNum('freight_do'),
      import_tax_pct: getNum('import_tax_pct') || 5,
      shipping_cost: getNum('shipping_cost'),
      srp_usd: getNum('srp_usd'),
      srp_eur: getNum('srp_eur'),
      multiplier: getNum('multiplier') || defaultMultiplier,
      notes: getStr('notes'),
    })
  }
  return out
}

export function parseExcel(buffer: ArrayBuffer, defaultMultiplier = 3): ParsedProduct[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // เซลล์ merge ทำให้ sheet_to_json สร้างแถวว่าง/ซ้ำ — ก๊อปค่ามุมซ้ายบนไปทั้งช่วงก่อน
  if (ws['!merges']) {
    for (const merge of ws['!merges']) {
      const topLeft = ws[XLSX.utils.encode_cell(merge.s)]
      if (!topLeft) continue
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r === merge.s.r && c === merge.s.c) continue
          ws[XLSX.utils.encode_cell({ r, c })] = { ...topLeft }
        }
      }
    }
    delete ws['!merges']
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  const products = rowsToProducts(rows, defaultMultiplier)

  const seen = new Set<string>()
  return products.filter((p) => {
    const key = `${p.name}|||${p.sku}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** ข้อความที่วางจาก Excel/Google Sheets (คั่นด้วย tab) — บรรทัดแรกต้องเป็นหัวตาราง */
export function parseTSV(text: string, defaultMultiplier = 3): ParsedProduct[] {
  const lines: string[] = []
  let current = ''
  let inQuote = false
  for (const ch of text) {
    if (ch === '\r') continue
    if (ch === '"') {
      inQuote = !inQuote
      current += ch
    } else if (ch === '\n' && !inQuote) {
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)
  if (lines.length < 2) return []

  const headers = lines[0].split('\t').map((h) => h.replace(/^"|"$/g, '').trim())
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t').map((c) => c.replace(/^"|"$/g, '').trim())
    const row: Record<string, unknown> = {}
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? ''
    })
    rows.push(row)
  }
  return rowsToProducts(rows, defaultMultiplier)
}
