// Bulk import: turns text copied from a Google Sheet into vault rows. Pure, runs in the browser;
// the values only leave through POST /api/vault/import.

import { canonicalPlatform, splitPlatform } from './platforms'
import { EMPTY_SECRET, type VaultSecret } from './types'

export type ImportField = 'skip' | 'both' | 'platform' | 'name' | 'username' | 'password' | 'otpPhone' | 'note'

export const IMPORT_FIELDS: { value: ImportField; label: string }[] = [
  { value: 'skip', label: 'ไม่ใช้คอลัมน์นี้' },
  { value: 'both', label: 'แพลตฟอร์ม + ชื่อร้าน' },
  { value: 'platform', label: 'แพลตฟอร์ม' },
  { value: 'name', label: 'ชื่อร้าน' },
  { value: 'username', label: 'User' },
  { value: 'password', label: 'รหัสผ่าน' },
  { value: 'otpPhone', label: 'เบอร์รับ OTP' },
  { value: 'note', label: 'โน้ต' },
]

// The usual sheet: "Shopee ABC" | login | password | OTP phone | note
const DEFAULT_ORDER: ImportField[] = ['both', 'username', 'password', 'otpPhone', 'note']

const HEADER_WORDS: [RegExp, ImportField][] = [
  [/otp|เบอร์|phone|โทร/i, 'otpPhone'],
  [/pass|รหัส/i, 'password'],
  [/user|login|ล็อกอิน|อีเมล|email/i, 'username'],
  [/note|โน้ต|หมายเหตุ/i, 'note'],
  [/platform|แพลตฟอร์ม|ช่องทาง/i, 'platform'],
  [/name|ชื่อ|ร้าน|shop|account|บัญชี/i, 'name'],
]

export interface ImportRow {
  platform: string
  name: string
  secret: VaultSecret
}

/**
 * Tab-separated text with one row per line. Sheets wraps a cell that holds a line break in
 * quotes and doubles the quotes inside. A password that merely starts with " stays as typed.
 */
export function parseSheet(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0

  const closingQuote = () => {
    let k = i + 1
    for (;;) {
      const q = text.indexOf('"', k)
      if (q < 0) return -1
      if (text[q + 1] === '"') {
        k = q + 2
        continue
      }
      return q + 1 === text.length || /[\t\r\n]/.test(text[q + 1]) ? q : -1
    }
  }

  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' && cell === '') {
      const end = closingQuote()
      if (end > 0) {
        cell = text.slice(i + 1, end).replace(/""/g, '"')
        i = end + 1
        continue
      }
    }
    if (ch === '\t') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      rows.push([...row, cell])
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
    i++
  }
  rows.push([...row, cell])
  return rows.filter((r) => r.some((c) => c.trim()))
}

export function looksLikeHeader(first: string[] | undefined): boolean {
  if (!first) return false
  // A login or a phone number means real data, whatever words sit beside it.
  if (first.some((c) => c.includes('@') || /\d{6,}/.test(c))) return false
  return first.filter((c) => c.length < 30 && HEADER_WORDS.some(([re]) => re.test(c))).length >= 2
}

/** Column meanings from the header words, else the usual order. */
export function guessColumns(first: string[] | undefined, hasHeader: boolean): ImportField[] {
  if (!first) return []
  if (!hasHeader) return first.map((_, i) => DEFAULT_ORDER[i] ?? 'skip')
  const used = new Set<ImportField>()
  const columns = first.map((c) => {
    const hit = HEADER_WORDS.find(([re, f]) => re.test(c) && !used.has(f))?.[1] ?? 'skip'
    if (hit !== 'skip') used.add(hit)
    return hit
  })
  // One column for the platform and no shop column: it holds both, as in "Shopee ABC".
  return used.has('name') ? columns : columns.map((c) => (c === 'platform' ? 'both' : c))
}

export function toRow(cells: string[], columns: ImportField[]): ImportRow {
  const out: ImportRow = { platform: '', name: '', secret: { ...EMPTY_SECRET } }
  columns.forEach((field, i) => {
    const value = cells[i] ?? ''
    if (field === 'skip') return
    if (field === 'both') {
      Object.assign(out, splitPlatform(value))
    } else if (field === 'platform' || field === 'name') {
      out[field] = value.trim()
    } else {
      out.secret[field] = value
    }
  })
  out.platform = canonicalPlatform(out.platform)
  out.name = out.name || out.secret.username.trim() // "Gmail" alone: the login names the account
  return out
}

/**
 * One sheet line can be several accounts: "Email/Canva/Dropbox" shares a login across services,
 * so each service becomes its own account with the same login and password.
 */
export function toRows(cells: string[], columns: ImportField[]): ImportRow[] {
  const i = columns.findIndex((f) => f === 'both' || f === 'platform')
  const parts = i < 0 ? [] : (cells[i] ?? '').split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return [toRow(cells, columns)]
  return parts.map((part) => toRow(cells.map((c, n) => (n === i ? part : c)), columns))
}

export const vaultKey = (a: { platform: string; name: string }) =>
  `${a.platform} ${a.name}`.trim().toLowerCase()
