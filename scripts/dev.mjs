#!/usr/bin/env node
// Dev tracker CLI — Claude ในแชทของทุกโปรเจกต์เขียนเคส UAT (/memo) และอ่านผล (/uat) ผ่าน bot API ของ amgo
// คำสั่ง/อาร์กิวเมนต์/รูปแบบ JSON เหมือน aoo-uat/scripts/uat.mjs เดิมทุกประการ (สกิล /uat /memo ของทุกโปรเจกต์เรียกไฟล์นี้ · cutover 3 พ.ย. 69)
//
//   node scripts/dev.mjs summary [project]          open cases + latest result (JSON)
//   node scripts/dev.mjs list [project]             open case numbers and titles (dedupe before adding)
//   node scripts/dev.mjs add <project> <cases.json>  insert one case or an array, prints the numbers
//                                                    steps[].image may be a local file path (png/jpg/webp ≤ 2 MB,
//                                                    relative to the JSON file): it is uploaded first
//   node scripts/dev.mjs upload <project> <image>   upload one step picture, prints its path for steps[].image
//   node scripts/dev.mjs retest <no> "<fix note>"   send back for another round
//   node scripts/dev.mjs close <no>
//   node scripts/dev.mjs shots <no> <out dir>       download every picture of a case
//   node scripts/dev.mjs case <no>                  one case with its result history (JSON)
//   node scripts/dev.mjs projects
//
// กุญแจ: AMGO_DEV_KEY ใน /Users/ampstark/amgo-management-system/memo/bot-keys.env (scope 'dev' — ใช้ได้เฉพาะ /api/bot/dev)
// ปลายทาง: AMGO_API_BASE ในไฟล์เดียวกัน (ค่าเริ่มต้น https://app.amgovenger.com/api/bot)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
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
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
async function upload(project, file) {
  const type = IMAGE_TYPES[extname(file).toLowerCase()]
  if (!type) die(`not a png/jpg/webp: ${file}`)
  const { path } = await api('/dev/images', { method: 'POST', body: JSON.stringify({ project, content_type: type, data_base64: readFileSync(file).toString('base64') }) })
  return path
}
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
  const cases = Array.isArray(input) ? input : [input]
  // steps[].image given as a local file → upload it and send the stored path instead
  for (const c of cases) {
    for (const s of Array.isArray(c.steps) ? c.steps : []) {
      if (!s || typeof s.image !== 'string') continue
      const local = isAbsolute(s.image) ? s.image : resolve(dirname(file), s.image)
      if (existsSync(local)) s.image = await upload(project, local)
    }
  }
  const { added } = await api('/dev/cases', { method: 'POST', body: JSON.stringify({ project, cases }) })
  for (const c of added) console.log(`${c.code}\t${c.title}`)
} else if (cmd === 'upload') {
  const [project, file] = args
  if (!project || !file) die('usage: upload <project> <image>')
  console.log(await upload(project, file))
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
  die('commands: summary [project] · list [project] · add <project> <file> · upload <project> <image> · retest <no> "<note>" · close <no> · shots <no> <dir> · case <no> · projects')
}
