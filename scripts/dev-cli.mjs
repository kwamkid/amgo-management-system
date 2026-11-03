#!/usr/bin/env node
// Dev tracker CLI — Claude ในแชทของทุกโปรเจกต์เขียนเคส UAT (/memo) และอ่านผล (/uat) ผ่าน bot API ของ amgo
// คำสั่ง/อาร์กิวเมนต์/รูปแบบ JSON เหมือน /Users/ampstark/aoo-uat/scripts/uat.mjs ทุกประการ (สกิล uat สลับมาใช้ไฟล์นี้เอง
// เมื่อ scripts/dev.mjs มีอยู่ — ไฟล์นี้ชื่อ dev-cli.mjs จนถึงวัน cutover แล้วค่อย rename เป็น dev.mjs)
//
//   node scripts/dev.mjs summary [project]          open cases + latest result (JSON)
//   node scripts/dev.mjs list [project]             open case numbers and titles (dedupe before adding)
//   node scripts/dev.mjs add <project> <cases.json>  insert one case or an array, prints the numbers
//   node scripts/dev.mjs retest <no> "<fix note>"   send back for another round
//   node scripts/dev.mjs close <no>
//   node scripts/dev.mjs shots <no> <out dir>       download every picture of a case
//   node scripts/dev.mjs case <no>                  one case with its result history (JSON)
//   node scripts/dev.mjs projects
//
// กุญแจ: AMGO_DEV_KEY ใน /Users/ampstark/amgo-management-system/memo/bot-keys.env (scope 'dev' — ใช้ได้เฉพาะ /api/bot/dev)
// ปลายทาง: AMGO_API_BASE ในไฟล์เดียวกัน (ค่าเริ่มต้น https://app.amgovenger.com/api/bot)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
try {
  process.loadEnvFile(join(root, 'memo', 'bot-keys.env'))
} catch {
  die('missing memo/bot-keys.env (needs AMGO_DEV_KEY)')
}
const KEY = process.env.AMGO_DEV_KEY
const BASE = (process.env.AMGO_API_BASE || 'https://app.amgovenger.com/api/bot').replace(/\/$/, '')
if (!KEY) die('AMGO_DEV_KEY not set in memo/bot-keys.env')

const [cmd, ...args] = process.argv.slice(2)
const DEFAULT_PROJECT = basename(process.cwd()) // run from the repo you are working in → that project

function die(msg) {
  console.error(msg)
  process.exit(1)
}
async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) die(`${res.status} ${body.error || res.statusText}`)
  return body
}
const num = (no) => Number(String(no).replace(/^uat-?/i, ''))
const code = (no) => `UAT-${String(no).padStart(4, '0')}`

if (cmd === 'summary' || cmd === 'list') {
  const project = args[0] || DEFAULT_PROJECT
  const { cases } = await api(`/dev/cases?project=${encodeURIComponent(project)}&status=open${cmd === 'list' ? '&brief=1' : ''}`)
  if (cmd === 'list') {
    for (const c of cases) console.log(`${c.no}\t${project}\t${c.status}\t${c.title}`)
  } else {
    const out = cases.map(({ steps, ...c }) => ({ no: c.no, project, title: c.title, status: c.status, priority: c.priority, round: c.round, fix_note: c.fix_note, steps: steps.length, latest: c.latest }))
    console.log(JSON.stringify(out, null, 2))
  }
} else if (cmd === 'add') {
  const [project, file] = args
  if (!project || !file) die('usage: add <project> <cases.json>')
  const input = JSON.parse(readFileSync(file, 'utf8'))
  const { added } = await api('/dev/cases', { method: 'POST', body: JSON.stringify({ project, cases: Array.isArray(input) ? input : [input] }) })
  for (const c of added) console.log(`${c.code}\t${c.title}`)
} else if (cmd === 'retest') {
  const [no, note] = args
  if (!no) die('usage: retest <no> "<fix note>"')
  const r = await api(`/dev/cases/${num(no)}`, { method: 'PATCH', body: JSON.stringify({ action: 'retest', fix_note: note || '' }) })
  console.log(`${r.code} → retest round ${r.round}`)
} else if (cmd === 'close') {
  if (!args[0]) die('usage: close <no>')
  const r = await api(`/dev/cases/${num(args[0])}`, { method: 'PATCH', body: JSON.stringify({ action: 'close' }) })
  console.log(`${r.code} → closed`)
} else if (cmd === 'shots') {
  const [no, outDir] = args
  if (!no || !outDir) die('usage: shots <no> <out dir>')
  const { shots } = await api(`/dev/cases/${num(no)}/shots`)
  mkdirSync(outDir, { recursive: true })
  for (const s of shots) {
    if (!s.url) {
      console.error(`skip (no file): ${s.path}`)
      continue
    }
    const res = await fetch(s.url)
    if (!res.ok) die(`download failed ${res.status}: ${s.path}`)
    const file = join(outDir, `round${s.round}-${s.result}-${basename(s.path)}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    console.log(file)
  }
  if (shots.length === 0) console.log(`${code(num(no))}: no pictures yet`)
} else if (cmd === 'case') {
  if (!args[0]) die('usage: case <no>')
  console.log(JSON.stringify(await api(`/dev/cases/${num(args[0])}`), null, 2))
} else if (cmd === 'projects') {
  const { projects } = await api('/dev/projects')
  for (const p of projects) console.log(`${p.slug}\t${p.open_cases} open\t${p.name}${p.is_active ? '' : '\t(inactive)'}`)
} else {
  die('commands: summary [project] · list [project] · add <project> <file> · retest <no> "<note>" · close <no> · shots <no> <dir> · case <no> · projects')
}
