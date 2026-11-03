#!/usr/bin/env node
// ย้ายเคส UAT เดิมจาก aoocommerce Supabase (uat_cases · uat_results · bucket uat-shots) → amgo dev tracker
// (dev_projects · dev_uat_cases · dev_uat_results · bucket dev-shots) — เจ้าของ 3 พ.ย. 69
//
//   node scripts/migrate-uat-from-aoocommerce.mjs          dry-run: นับ + โชว์แถวแรก ๆ ไม่เขียนอะไร
//   node scripts/migrate-uat-from-aoocommerce.mjs --apply   เขียนจริง (idempotent ตามเลขเคส — รันซ้ำ = 0 แถวใหม่)
//
// ต้นทาง: อ่านอย่างเดียว (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY ใน /Users/ampstark/aoo-uat/.env.local)
// ปลายทาง: amgo .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY — service role ข้าม RLS)
// คงเลขเคส (no) เดิมทุกตัว แล้วขยับ sequence ให้เคสใหม่ต่อจากเลขสูงสุด · tester_id = ผู้ใช้ amgo ที่ชื่อเล่นตรง (ไม่งั้น null)
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
const SRC_ENV = '/Users/ampstark/aoo-uat/.env.local'

function envFrom(file) {
  const out = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const src = envFrom(SRC_ENV)
const dst = envFrom(join(root, '.env.local'))
if (!src.NEXT_PUBLIC_SUPABASE_URL || !src.SUPABASE_SECRET_KEY) die(`source credentials missing in ${SRC_ENV}`)
if (!dst.NEXT_PUBLIC_SUPABASE_URL || !dst.SUPABASE_SECRET_KEY) die('amgo .env.local needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY')
if (src.NEXT_PUBLIC_SUPABASE_URL === dst.NEXT_PUBLIC_SUPABASE_URL) die('source and destination are the same project — refusing')

const from = createClient(src.NEXT_PUBLIC_SUPABASE_URL, src.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const to = createClient(dst.NEXT_PUBLIC_SUPABASE_URL, dst.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

// Source `project` → amgo project (one app = one project). Unknown slugs get a project named after the slug.
const PROJECTS = {
  aoocommerce: { slug: 'aoocommerce', name: 'AooCommerce', production_url: 'https://app.aoocommerce.com', staging_url: 'https://staging.aoocommerce.com' },
  aoosite: { slug: 'aoosite', name: 'AooSite', production_url: null, staging_url: null },
}
const projectFor = (slug) => PROJECTS[slug] ?? { slug, name: slug, production_url: null, staging_url: null }
const OWNER_ID = '31e03073-e7c4-44bd-a473-e2fedc1b20e5' // แอม (admin) — creator → manager via trigger
const TESTERS = ['014039e4-1e95-4af0-ae7f-32649ad4c71a'] // ไกด์ (owner 3 Nov 2569: testers = me + ไกด์)

function die(msg) {
  console.error(msg)
  process.exit(1)
}
function check({ data, error }) {
  if (error) die(error.message)
  return data
}

// ── read source ──────────────────────────────────────────────────────────────
const cases = check(await from.from('uat_cases').select('*').order('no'))
const results = check(await from.from('uat_results').select('*').order('created_at'))
console.log(`source: ${cases.length} cases (${cases.filter((c) => c.status !== 'closed').length} open) · ${results.length} results · projects ${[...new Set(cases.map((c) => c.project))].join(', ')}`)
const slugs = [...new Set(cases.map((c) => c.project))]

// ── destination state ────────────────────────────────────────────────────────
const existingProjects = new Map(check(await to.from('dev_projects').select('id, slug').in('slug', slugs)).map((p) => [p.slug, p.id]))
const existingNos = new Set(check(await to.from('dev_uat_cases').select('no')).map((r) => r.no))
const newCases = cases.filter((c) => !existingNos.has(c.no))
console.log(`destination: projects ${slugs.map((x) => `${x}=${existingProjects.has(x) ? 'exists' : 'missing'}`).join(' ')} · ${existingNos.size} cases already there · ${newCases.length} to add`)
for (const c of newCases.slice(0, 5)) console.log(`  UAT-${String(c.no).padStart(4, '0')}  ${c.project}  ${c.status}\t${c.title}`)

// tester match by nickname (results keep tester_name anyway)
const users = check(await to.from('users').select('id, nickname, full_name').eq('is_active', true).is('deleted_at', null))
const userByName = new Map(users.flatMap((u) => [[u.nickname, u.id], [u.full_name, u.id]]).filter(([k]) => k))

if (!APPLY) {
  console.log('\ndry-run only — add --apply to write')
  process.exit(0)
}

// ── write ────────────────────────────────────────────────────────────────────
for (const slug of slugs) {
  if (existingProjects.has(slug)) continue
  const id = check(await to.from('dev_projects').insert({ ...projectFor(slug), created_by: OWNER_ID }).select('id').single()).id
  existingProjects.set(slug, id)
  console.log(`created project ${slug}`)
}
for (const projectId of existingProjects.values())
  for (const uid of TESTERS) check(await to.from('dev_project_members').upsert({ project_id: projectId, user_id: uid, role: 'tester', added_by: OWNER_ID }, { onConflict: 'project_id,user_id', ignoreDuplicates: true }))

const KEEP = ['no', 'title', 'module', 'priority', 'environment', 'shop', 'login_as', 'menu_path', 'page_url', 'device', 'preparation', 'steps', 'source', 'status', 'round', 'fix_note', 'sort_order', 'created_at', 'updated_at']
const idMap = new Map() // source case id → dest case id
if (newCases.length) {
  const rows = newCases.map((c) => ({ ...Object.fromEntries(KEEP.map((k) => [k, c[k]])), project_id: existingProjects.get(c.project), created_by: OWNER_ID }))
  const inserted = check(await to.from('dev_uat_cases').insert(rows).select('id, no'))
  for (const r of inserted) idMap.set(newCases.find((c) => c.no === r.no).id, r.id)
  console.log(`inserted ${inserted.length} cases`)
}
// existing cases too (for results of a re-run)
for (const c of cases) {
  if (idMap.has(c.id)) continue
  const row = check(await to.from('dev_uat_cases').select('id').eq('no', c.no).maybeSingle())
  if (row) idMap.set(c.id, row.id)
}

// results: idempotent by (case no, created_at). A closed case refuses results (trigger), so open every moved case
// for the copy and restore the source status afterwards.
let addedResults = 0
const pending = results.filter((r) => idMap.get(r.case_id)).map((r) => idMap.get(r.case_id))
if (pending.length) check(await to.from('dev_uat_cases').update({ status: 'pending' }).in('id', [...new Set(pending)]))
for (const r of results) {
  const caseId = idMap.get(r.case_id)
  if (!caseId) continue
  const dup = check(await to.from('dev_uat_results').select('id').eq('case_id', caseId).eq('created_at', r.created_at).maybeSingle())
  if (dup) continue
  // pictures: copy what exists in uat-shots, keep the path otherwise (the 3 Nov 2569 row has a path with no file)
  const shots = []
  for (const path of r.shots ?? []) {
    const { data: blob } = await from.storage.from('uat-shots').download(path)
    const newPath = `${caseId}/${path.split('/').pop()}`
    if (blob) {
      const { error } = await to.storage.from('dev-shots').upload(newPath, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
      if (error) die(`upload ${newPath}: ${error.message}`)
    } else console.log(`  no file for ${path} — kept path only`)
    shots.push(newPath)
  }
  // insert bypasses the "needs 1–8 pictures / note" trigger? No — trigger runs for service role too, so keep rows valid:
  const note = r.result !== 'passed' && !r.note ? '(ย้ายมาจาก aoocommerce — ไม่มีโน้ต)' : r.note
  const { error } = await to.from('dev_uat_results').insert({
    case_id: caseId, round: r.round, tester_id: userByName.get(r.tester_name) ?? null, tester_name: r.tester_name,
    result: r.result, failed_step: r.failed_step, note, shots: shots.length ? shots : ['(no-file)'], created_at: r.created_at,
  })
  if (error) die(`result for case ${r.case_id}: ${error.message}`)
  addedResults++
}
console.log(`inserted ${addedResults} results`)

// the result trigger set case status = result; restore the source status (source is the truth for moved rows)
for (const c of cases) {
  const id = idMap.get(c.id)
  if (id) check(await to.from('dev_uat_cases').update({ status: c.status, round: c.round, fix_note: c.fix_note, updated_at: c.updated_at }).eq('id', id))
}

// sequence past the highest moved number
const maxNo = Math.max(...cases.map((c) => c.no), 0)
check(await to.rpc('dev_bump_uat_sequence', { p_min: maxNo }))

// verify
const { count } = await to.from('dev_uat_cases').select('*', { count: 'exact', head: true }).in('project_id', [...existingProjects.values()])
console.log(`done · destination cases: ${count} (source ${cases.length}) · next number ≥ ${maxNo + 1}`)
