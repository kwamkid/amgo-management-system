#!/usr/bin/env node
// Live stock + sales for the order-plan builder, read through aoo's MCP (read-only key AOO_MCP_KEY in ./.env.local).
//
//   node scripts/aoo-live.mjs <brand> --out <file.json> [--since 2026-10-22] [--codes <file> ...]
//
// --codes: any text/JSON files (e.g. an invoice's inv-lines.json); every item code in them (E1234 / 123456) that the
//   brand pass didn't find is looked up one by one — new models are often created in aoo with no brand, no barcode,
//   an English name without the brand and a letter suffix (Hape INV-2626437: E6620 → sku "E6620A", 30 Oct 2026).
// codes: item code → the key used in stock/sales, so callers can look up rows that have no barcode.
//
// stock: barcode → available (all warehouses, on hand − reserved) + in transit.
// sales: barcode → { 'YYYY-MM': { u, b2b } } from --since to today. Sales before the cutover come from the OLD aoo
//   (legacy export, e.g. AGD legacy-hape/hape-sku-24m.csv) — never add both for the same days: marketplace orders were
//   synced into both systems, staff moved to the new aoo in October 2026 (dealer bills from 21 Oct, legacy dump 22 Oct
//   06:04) → owner 30 Oct 2026: cutover = 2026-10-22.
// Flows: w_* / b_credit = b2b (wholesale sell-in) · c_consign and d_* are stock moves to dealers / stores, not counted
//   (their sell-out arrives as pc_counter) · everything else = retail. u includes b2b, like the legacy file.

import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const MCP = process.env.AOO_MCP_URL || 'https://app.aoocommerce.com/api/mcp'
const B2B = new Set(['w_cash', 'w_credit', 'b_credit'])
const SKIP = /^(c_|d_)/

const args = process.argv.slice(2)
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const brand = args[0]
const out = opt('--out')
const since = opt('--since', '2026-10-22')
const codeFiles = args.flatMap((a, i) => (args[i - 1] === '--codes' ? [a] : []))
if (!brand || brand.startsWith('--') || !out) {
  console.error('usage: node scripts/aoo-live.mjs <brand> --out <file.json> [--since YYYY-MM-DD]')
  process.exit(1)
}

const env = Object.fromEntries(
  (await fs.readFile(path.join(ROOT, '.env.local'), 'utf8')).split('\n').map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, '')])
)
const key = process.env.AOO_MCP_KEY || env.AOO_MCP_KEY
if (!key) throw new Error('AOO_MCP_KEY missing in .env.local')

let id = 0
async function tool(name, args) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }),
  })
  if (!res.ok) throw new Error(`aoo MCP ${name}: HTTP ${res.status}`)
  const r = (await res.json()).result
  const text = r?.content?.[0]?.text
  if (!text || r.isError) throw new Error(`aoo MCP ${name}: ${text ?? 'no answer'}`)
  return JSON.parse(text)
}

const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) // Thai date

// Some products have no brand in aoo (brand null, e.g. Hape markers / sand toys) → also take brand-less rows whose
// name mentions the brand. Sales are then read for all brands and kept only for these barcodes.
const stock = {}
const byBrand = await tool('stock', { brands: [brand], include_zero: true, limit: 2000 })
const byName = (await tool('stock', { q: brand, include_zero: true, limit: 2000 })).filter(
  (x) => !x.brand && new RegExp(`\\b${brand}\\b`, 'i').test(x.name)
)
if (byBrand.length >= 2000 || byName.length >= 2000) throw new Error('stock: 2000-row cap hit — split the query')
const noBrand = new Set()
const CODE = /^(?:\d{2}-[A-Z]+-)?(E\d{4}|\d{6})[A-Z]?$/i // 00-HAPE-E1552 · E6620A → E1552 · E6620
const codeOf = (x) => [x.code, x.sku].map((v) => CODE.exec(String(v ?? '').trim())?.[1]?.toUpperCase()).find(Boolean)
const wanted = new Set()
for (const f of codeFiles) for (const m of (await fs.readFile(f, 'utf8')).matchAll(/\b(E\d{4}|\d{6})\b/gi)) wanted.add(m[1].toUpperCase())
const found = new Set([...byBrand, ...byName].map(codeOf).filter(Boolean))
const byCode = []
const asked = [...wanted].filter((c) => !found.has(c))
for (const c of asked) {
  const hit = (await tool('stock', { q: c, include_zero: true, limit: 20 })).filter(
    (x) => codeOf(x) === c && (!x.brand || x.brand.toLowerCase() === brand.toLowerCase())
  )
  byCode.push(...hit)
  for (const x of hit) noBrand.add(String(x.barcode || x.sku).trim())
}
const codes = {}
const alias = {} // barcode / sku / code → the barcode we key on (sales labels end with any of them)
const seen = new Set()
for (const x of [...byBrand, ...byName, ...byCode]) {
  const bar = String(x.barcode || x.sku || '').trim()
  if (!bar || x.is_composite || seen.has(`${x.sku}|${x.variation_label}`)) continue
  seen.add(`${x.sku}|${x.variation_label}`)
  if (!x.brand) noBrand.add(bar)
  for (const k of [x.barcode, x.sku, x.code]) if (k) alias[String(k).trim()] ??= bar
  if (codeOf(x)) codes[codeOf(x)] ??= bar
  const s = (stock[bar] ??= { available: 0, inTransit: 0, code: x.code })
  s.available += Number(x.available) || 0
  s.inTransit += Number(x.in_transit) || 0
}
// sales label = "<sku> <name> [· <variation>] · <barcode | code | sku>"
const barOf = (label) => {
  const parts = String(label).split(' · ')
  return alias[parts[parts.length - 1].trim()] ?? alias[parts[0].split(/\s/)[0]]
}

// one call per month keeps each answer under the 1000-row cap
const sales = {}
let flows = {}
for (let m = since.slice(0, 7); m <= today.slice(0, 7); ) {
  const from = m === since.slice(0, 7) ? since : `${m}-01`
  const [y, mo] = m.split('-').map(Number)
  const next = `${mo === 12 ? y + 1 : y}-${String((mo % 12) + 1).padStart(2, '0')}`
  const last = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10)
  const to = last < today ? last : today
  const r = await tool('sales_summary', { date_from: from, date_to: to, group_by: ['variation', 'flow'], limit: 1000 })
  if (r.length >= 1000) throw new Error(`sales ${m}: 1000-row cap hit — split the month`)
  for (const x of r) {
    const bar = barOf(x.variation)
    if (!bar) continue
    flows[x.flow] = (flows[x.flow] || 0) + x.qty
    if (SKIP.test(x.flow)) continue
    const cell = ((sales[bar] ??= {})[m] ??= { u: 0, b2b: 0 })
    cell.u += x.qty
    if (B2B.has(x.flow)) cell.b2b += x.qty
  }
  m = next
}

await fs.writeFile(out, JSON.stringify({ source: 'aoo MCP', brand, asOf: today, since, noBrand: [...noBrand], codes, stock, sales }, null, 1))
console.log(`${brand}: stock ${Object.keys(stock).length} barcodes (${noBrand.size} with no brand in aoo, ${byCode.length} found by code of ${asked.length} asked) · sales ${since}…${today} ${Object.keys(sales).length} barcodes · by flow ${JSON.stringify(flows)} → ${out}`)
