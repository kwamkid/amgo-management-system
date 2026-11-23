// Dev tracker ผ่าน bot API (/api/bot/dev/*) — Claude ในแชทของแต่ละโปรเจกต์เขียนเคส UAT (/memo) และอ่านผล (/uat)
// ผ่าน scripts/dev.mjs ด้วยกุญแจ scope 'dev' (ทำแทนเจ้าของ) · Jarvis (superadmin) ใช้ได้เหมือนกัน
//
// ⚠️ service role ข้าม RLS — สิทธิ์ซ้ำกับ migration 20261103100000_dev_tracker:
//   เห็น/จัดการโปรเจกต์ = แอดมิน หรือสมาชิก role manager · ผู้เทส/viewer ใช้ API นี้ไม่ได้ (เขาใช้หน้าเว็บ)
import { apiError, untyped, type BotCaller } from './botApi'
import { randomUUID } from 'node:crypto'
import {
  CASE_STEP_IMAGE,
  SHOT_BUCKET,
  STAGED_STEP_IMAGE,
  STEP_IMAGE_MAX_BYTES,
  STEP_IMAGE_TYPES,
  uatCode,
  type UatResultValue,
  type UatStatus,
  type UatStep,
} from '@/lib/dev/uat'
import { BUG_MAX_SHOTS, BUG_SEVERITIES, BUG_SHOT, BUG_STATUSES, bugCode, type BugSeverity, type BugStatus } from '@/lib/dev/bugs'

export const CASE_FIELDS = [
  'title', 'module', 'priority', 'environment', 'shop', 'login_as', 'menu_path', 'page_url', 'device', 'preparation', 'steps', 'source',
] as const

export interface DevProjectRow {
  id: string
  slug: string
  name: string
  production_url: string | null
  staging_url: string | null
  is_active: boolean
}

/** โปรเจกต์ที่ผู้เรียกจัดการได้ (slug) — ไม่พบ/ไม่มีสิทธิ์ = error response */
export async function devProject(caller: BotCaller, slug: string | null): Promise<{ project: DevProjectRow } | { error: ReturnType<typeof apiError> }> {
  if (!slug) return { error: apiError(400, 'ต้องระบุ project (slug เช่น aoocommerce)') }
  const sb = untyped(caller.sb)
  const { data: p } = await sb.from('dev_projects').select('id, slug, name, production_url, staging_url, is_active').eq('slug', slug).maybeSingle()
  if (!p) return { error: apiError(404, `ไม่พบโปรเจกต์ ${slug}`) }
  if (!caller.isAdmin) {
    const { data: m } = await sb.from('dev_project_members').select('role').match({ project_id: p.id, user_id: caller.user.id }).maybeSingle()
    if (m?.role !== 'manager') return { error: apiError(403, 'ต้องเป็นผู้จัดการของโปรเจกต์นี้') }
  }
  return { project: p as DevProjectRow }
}

export interface CaseRow {
  id: string
  no: number
  project_id: string
  title: string
  module: string | null
  priority: number
  environment: string
  shop: string | null
  login_as: string | null
  menu_path: string | null
  page_url: string | null
  device: string
  preparation: string | null
  steps: UatStep[]
  source: string | null
  status: UatStatus
  round: number
  fix_note: string | null
  sort_order: number | null
  created_at: string
  updated_at: string
}

export interface ResultRow {
  id: string
  round: number
  tester_name: string | null
  result: UatResultValue
  failed_step: number | null
  note: string | null
  shots: string[]
  created_at: string
}

export const CASE_COLS =
  'id, no, project_id, title, module, priority, environment, shop, login_as, menu_path, page_url, device, preparation, steps, source, status, round, fix_note, sort_order, created_at, updated_at'
export const RESULT_COLS = 'id, round, tester_name, result, failed_step, note, shots, created_at'

/** เคสตามเลข (ต้องอยู่ในโปรเจกต์ที่ผู้เรียกจัดการได้) */
export async function devCaseByNo(caller: BotCaller, no: number): Promise<{ c: CaseRow; project: DevProjectRow } | { error: ReturnType<typeof apiError> }> {
  if (!Number.isInteger(no) || no < 1) return { error: apiError(400, 'เลขเคสไม่ถูกต้อง') }
  const sb = untyped(caller.sb)
  const { data } = await sb.from('dev_uat_cases').select(`${CASE_COLS}, dev_projects(slug)`).eq('no', no).maybeSingle()
  if (!data) return { error: apiError(404, `ไม่พบ ${uatCode(no)}`) }
  const slug = (data as unknown as { dev_projects: { slug: string } | null }).dev_projects?.slug ?? null
  const p = await devProject(caller, slug)
  if ('error' in p) return p
  return { c: data as unknown as CaseRow, project: p.project }
}

/** รูปของผล → signed URL (1 ชม.) */
export async function signShots(caller: BotCaller, paths: string[]): Promise<{ path: string; url: string | null }[]> {
  if (paths.length === 0) return []
  const { data } = await caller.sb.storage.from(SHOT_BUCKET).createSignedUrls(paths, 3600)
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return paths.map((path) => ({ path, url: byPath.get(path) ?? null }))
}

export const toBotCase = (c: CaseRow, project?: DevProjectRow) => ({
  no: c.no,
  code: uatCode(c.no),
  ...(project ? { project: project.slug } : {}),
  title: c.title,
  module: c.module,
  priority: c.priority,
  environment: c.environment,
  shop: c.shop,
  login_as: c.login_as,
  menu_path: c.menu_path,
  page_url: c.page_url,
  device: c.device,
  preparation: c.preparation,
  steps: c.steps,
  source: c.source,
  status: c.status,
  round: c.round,
  fix_note: c.fix_note,
  created_at: c.created_at,
  updated_at: c.updated_at,
})

/** ตรวจเคสที่บอทส่งมาเพิ่ม — คืนแถวพร้อม insert หรือข้อความผิด */
export function parseCaseInput(raw: unknown): { row: Record<string, unknown> } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'เคสต้องเป็น object' }
  const c = raw as Record<string, unknown>
  const title = typeof c.title === 'string' ? c.title.trim() : ''
  if (!title) return { error: 'เคสต้องมี title' }
  const steps = Array.isArray(c.steps)
    ? c.steps
        .map((s) => (typeof s === 'string' ? { action: s } : s))
        .filter((s): s is { action: string; expected?: string; image?: unknown } => !!s && typeof s === 'object' && typeof (s as { action?: unknown }).action === 'string' && !!(s as { action: string }).action.trim())
        .map((s) => ({
          action: s.action.trim(),
          ...(typeof s.expected === 'string' && s.expected.trim() ? { expected: s.expected.trim() } : {}),
          ...(typeof s.image === 'string' && s.image.trim() ? { image: s.image.trim() } : {}),
        }))
    : []
  if (steps.length === 0) return { error: `เคส "${title.slice(0, 40)}" ต้องมี steps อย่างน้อย 1 ข้อ` }
  const badImage = steps.find((s) => s.image && !STAGED_STEP_IMAGE.test(s.image) && !CASE_STEP_IMAGE.test(s.image))
  if (badImage) return { error: `steps[].image "${badImage.image}" ไม่ใช่ path จาก uat_upload_image` }
  const row: Record<string, unknown> = { title, steps }
  const text = (k: string) => {
    if (c[k] === undefined || c[k] === null) return
    row[k] = String(c[k]).trim() || null
  }
  for (const k of ['module', 'shop', 'login_as', 'menu_path', 'page_url', 'preparation', 'source']) text(k)
  if (c.priority !== undefined) {
    const p = Number(c.priority)
    if (![1, 2, 3].includes(p)) return { error: 'priority ต้องเป็น 1, 2 หรือ 3' }
    row.priority = p
  }
  if (c.environment !== undefined) {
    if (!['production', 'staging'].includes(String(c.environment))) return { error: 'environment ต้องเป็น production หรือ staging' }
    row.environment = c.environment
  }
  if (c.device !== undefined) {
    if (!['any', 'mobile', 'desktop'].includes(String(c.device))) return { error: 'device ต้องเป็น any, mobile หรือ desktop' }
    row.device = c.device
  }
  return { row }
}

// ── step pictures (owner 9 Nov 2569) ────────────────────────────────────────
// Upload first → `<project id>/<uuid>.<ext>` (no case yet). Saving a case moves each picture to
// `<case id>/steps/…`, where the existing dev-shots read policy (first folder = case id) lets
// the board sign it. A staged picture never attached stays in the project folder, unread.

/** store one picture (base64) for a step of this project; returns its path */
export async function uploadStepImage(
  caller: BotCaller,
  project: DevProjectRow,
  base64: unknown,
  contentType: unknown
): Promise<{ path: string; url: string | null } | { error: string }> {
  const ext = typeof contentType === 'string' ? STEP_IMAGE_TYPES[contentType] : undefined
  if (!ext) return { error: `content_type ต้องเป็น ${Object.keys(STEP_IMAGE_TYPES).join(', ')}` }
  if (typeof base64 !== 'string' || !base64.trim()) return { error: 'ต้องส่ง data_base64' }
  const bytes = Buffer.from(base64.replace(/^data:[^,]*,/, ''), 'base64')
  if (bytes.length === 0) return { error: 'data_base64 ว่างหรือไม่ใช่ base64' }
  if (bytes.length > STEP_IMAGE_MAX_BYTES) return { error: `รูปใหญ่เกิน ${STEP_IMAGE_MAX_BYTES / 1_000_000} MB ย่อก่อนส่ง` }
  const path = `${project.id}/${randomUUID()}.${ext}`
  const { error } = await caller.sb.storage.from(SHOT_BUCKET).upload(path, bytes, { contentType: contentType as string })
  if (error) return { error: error.message }
  const [signed] = await signShots(caller, [path])
  return { path, url: signed.url }
}

/** before insert: every staged picture must belong to this project and exist */
export async function checkStepImages(caller: BotCaller, projectId: string, steps: UatStep[], caseId?: string): Promise<string | null> {
  const staged: string[] = []
  for (const s of steps) {
    if (!s.image) continue
    const own = CASE_STEP_IMAGE.exec(s.image)
    if (own) {
      if (own[1] !== caseId) return `รูป ${s.image} เป็นของเคสอื่น`
      continue
    }
    const m = STAGED_STEP_IMAGE.exec(s.image)
    if (!m || m[1] !== projectId) return `รูป ${s.image} ไม่ได้อัปโหลดให้โปรเจกต์นี้`
    staged.push(s.image)
  }
  if (staged.length === 0) return null
  const signed = await signShots(caller, staged)
  const missing = signed.find((x) => !x.url)
  return missing ? `ไม่พบรูป ${missing.path} อัปโหลดใหม่ด้วย uat_upload_image` : null
}

/** after insert/update: move staged pictures under the case and return the steps to store */
export async function attachStepImages(caller: BotCaller, caseId: string, steps: UatStep[]): Promise<{ steps: UatStep[]; moved: boolean }> {
  let moved = false
  const out: UatStep[] = []
  for (const s of steps) {
    const m = s.image ? STAGED_STEP_IMAGE.exec(s.image) : null
    if (!m) {
      out.push(s)
      continue
    }
    const to = `${caseId}/steps/${m[2]}.${m[3]}`
    const { error } = await caller.sb.storage.from(SHOT_BUCKET).move(s.image as string, to)
    if (error) throw new Error(`ย้ายรูป ${s.image} ไม่ได้: ${error.message}`)
    out.push({ ...s, image: to })
    moved = true
  }
  return { steps: out, moved }
}

/** steps with a signed `image_url` (1 hour) beside each picture path */
export async function signStepImages(caller: BotCaller, steps: UatStep[]) {
  const signed = await signShots(caller, steps.map((s) => s.image).filter((p): p is string => !!p))
  const byPath = new Map(signed.map((x) => [x.path, x.url]))
  return steps.map((s) => (s.image ? { ...s, image_url: byPath.get(s.image) ?? null } : s))
}

/** insert cases, then move their staged pictures under each new case */
export async function insertCases(caller: BotCaller, rows: Record<string, unknown>[]): Promise<{ no: number; title: string }[]> {
  const sb = untyped(caller.sb)
  const { data, error } = await sb.from('dev_uat_cases').insert(rows).select('id, no, title, steps')
  if (error) throw new Error(error.message)
  const made = (data ?? []) as { id: string; no: number; title: string; steps: UatStep[] }[]
  for (const c of made) {
    const r = await attachStepImages(caller, c.id, c.steps)
    if (r.moved) {
      const { error: e } = await sb.from('dev_uat_cases').update({ steps: r.steps }).eq('id', c.id)
      if (e) throw new Error(e.message)
    }
  }
  return made.map(({ no, title }) => ({ no, title }))
}


// ── bugs (owner 2026-11-23, migration 20261123120000_dev_bugs) ──────────────
// Numbers are per project → a bug is addressed by project slug + no. Status moves go through the
// dev_bug_set_status RPC with p_actor (service role passes the guard; the manager check is devProject()).

export const BUG_FIELDS = ['title', 'steps', 'expected', 'actual', 'environment', 'device', 'page_url', 'severity', 'shots', 'source'] as const

export const BUG_COLS =
  'id, project_id, no, title, steps, expected, actual, environment, device, page_url, severity, status, shots, reported_by, assignee_id, ' +
  'uat_case_id, fix_note, close_reason, source, created_at, updated_at, closed_at'

export interface BugRow {
  id: string
  project_id: string
  no: number
  title: string
  steps: string | null
  expected: string | null
  actual: string | null
  environment: string
  device: string
  page_url: string | null
  severity: BugSeverity
  status: BugStatus
  shots: string[]
  reported_by: string | null
  assignee_id: string | null
  uat_case_id: string | null
  fix_note: string | null
  close_reason: string | null
  source: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

export const toBotBug = (b: BugRow, project: DevProjectRow, uatNo?: number | null) => ({
  no: b.no,
  code: bugCode(b.no),
  project: project.slug,
  title: b.title,
  severity: b.severity,
  status: b.status,
  steps: b.steps,
  expected: b.expected,
  actual: b.actual,
  environment: b.environment,
  device: b.device,
  page_url: b.page_url,
  fix_note: b.fix_note,
  close_reason: b.close_reason,
  source: b.source,
  uat_case: uatNo ? uatCode(uatNo) : null,
  shots: Array.isArray(b.shots) ? b.shots.length : 0,
  created_at: b.created_at,
  updated_at: b.updated_at,
  closed_at: b.closed_at,
})

/** check a bug the bot sends (add, or update with `partial`) — returns the row to write or an error */
export function parseBugInput(raw: unknown, partial = false): { row: Record<string, unknown>; uatNo?: number } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'บั๊กต้องเป็น object' }
  const b = raw as Record<string, unknown>
  const unknown = Object.keys(b).filter((k) => !(BUG_FIELDS as readonly string[]).includes(k) && k !== 'uat_case')
  if (unknown.length) return { error: `unknown field(s): ${unknown.join(', ')} — allowed: ${[...BUG_FIELDS, 'uat_case'].join(', ')}` }
  const row: Record<string, unknown> = {}
  if (b.title !== undefined || !partial) {
    const title = typeof b.title === 'string' ? b.title.trim() : ''
    if (!title) return { error: 'บั๊กต้องมี title' }
    row.title = title
  }
  for (const k of ['steps', 'expected', 'actual', 'page_url', 'source']) {
    if (b[k] === undefined) continue
    row[k] = b[k] === null ? null : Array.isArray(b[k]) ? (b[k] as unknown[]).map(String).join('\n') : String(b[k]).trim() || null
  }
  if (b.severity !== undefined) {
    if (!BUG_SEVERITIES.includes(b.severity as BugSeverity)) return { error: `severity ต้องเป็น ${BUG_SEVERITIES.join(', ')}` }
    row.severity = b.severity
  }
  if (b.environment !== undefined) {
    if (!['production', 'staging'].includes(String(b.environment))) return { error: 'environment ต้องเป็น production หรือ staging' }
    row.environment = b.environment
  }
  if (b.device !== undefined) {
    if (!['any', 'mobile', 'desktop'].includes(String(b.device))) return { error: 'device ต้องเป็น any, mobile หรือ desktop' }
    row.device = b.device
  }
  if (b.shots !== undefined) {
    if (!Array.isArray(b.shots) || b.shots.some((s) => typeof s !== 'string')) return { error: 'shots ต้องเป็น array ของ path จาก uat_upload_image' }
    if (b.shots.length > BUG_MAX_SHOTS) return { error: `รูปไม่เกิน ${BUG_MAX_SHOTS}` }
    row.shots = b.shots
  }
  let uatNo: number | undefined
  if (b.uat_case !== undefined && b.uat_case !== null) {
    uatNo = Number(String(b.uat_case).replace(/^uat-?/i, ''))
    if (!Number.isInteger(uatNo) || uatNo < 1) return { error: 'uat_case ต้องเป็นเลขเคส เช่น 89 หรือ "UAT-0089"' }
  }
  return { row, uatNo }
}

/** shots: staged uploads (`<project id>/<uuid>.<ext>`) move to `bugs/<project id>/…`; bug paths of this project stay */
export async function attachBugShots(caller: BotCaller, projectId: string, shots: string[]): Promise<string[]> {
  const out: string[] = []
  for (const s of shots) {
    const own = BUG_SHOT.exec(s)
    if (own) {
      if (own[1] !== projectId) throw new Error(`รูป ${s} เป็นของโปรเจกต์อื่น`)
      out.push(s)
      continue
    }
    const m = STAGED_STEP_IMAGE.exec(s)
    if (!m || m[1] !== projectId) throw new Error(`รูป ${s} ไม่ได้อัปโหลดให้โปรเจกต์นี้ (ใช้ uat_upload_image ก่อน)`)
    const to = `bugs/${projectId}/${m[2]}.${m[3]}`
    const { error } = await caller.sb.storage.from(SHOT_BUCKET).move(s, to)
    if (error) throw new Error(`ย้ายรูป ${s} ไม่ได้: ${error.message}`)
    out.push(to)
  }
  return out
}

/** UAT case number of this project → id (for uat_case) */
export async function uatCaseId(caller: BotCaller, projectId: string, no: number): Promise<string> {
  const { data } = await untyped(caller.sb).from('dev_uat_cases').select('id').match({ project_id: projectId, no }).maybeSingle()
  if (!data) throw new Error(`ไม่พบ ${uatCode(no)} ในโปรเจกต์นี้`)
  return (data as { id: string }).id
}

/** a bug by project + number (caller must manage the project) */
export async function devBugByNo(
  caller: BotCaller,
  slug: string | null,
  no: number
): Promise<{ b: BugRow; project: DevProjectRow; uatNo: number | null } | { error: ReturnType<typeof apiError> }> {
  if (!Number.isInteger(no) || no < 1) return { error: apiError(400, 'เลขบั๊กไม่ถูกต้อง (เช่น 3 หรือ "BUG-0003")') }
  const p = await devProject(caller, slug)
  if ('error' in p) return p
  const { data } = await untyped(caller.sb)
    .from('dev_bugs')
    .select(`${BUG_COLS}, dev_uat_cases(no)`)
    .match({ project_id: p.project.id, no })
    .maybeSingle()
  if (!data) return { error: apiError(404, `ไม่พบ ${bugCode(no)} ใน ${p.project.slug}`) }
  const uatNo = (data as unknown as { dev_uat_cases: { no: number } | null }).dev_uat_cases?.no ?? null
  return { b: data as unknown as BugRow, project: p.project, uatNo }
}

/** insert bugs reported by the bot (reporter = caller), shots moved under bugs/<project id>/ */
export async function insertBugs(caller: BotCaller, project: DevProjectRow, list: unknown[]): Promise<{ no: number; code: string; title: string }[]> {
  const rows: Record<string, unknown>[] = []
  for (const raw of list) {
    const r = parseBugInput(raw)
    if ('error' in r) throw new Error(r.error)
    if (r.row.shots) r.row.shots = await attachBugShots(caller, project.id, r.row.shots as string[])
    if (r.uatNo) r.row.uat_case_id = await uatCaseId(caller, project.id, r.uatNo)
    rows.push({ ...r.row, project_id: project.id, reported_by: caller.user.id, sort_order: Date.now() / 1000 + rows.length })
  }
  const { data, error } = await untyped(caller.sb).from('dev_bugs').insert(rows).select('no, title')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { no: number; title: string }[]).map((b) => ({ no: b.no, code: bugCode(b.no), title: b.title }))
}

/** move a bug (fixing · testing with fix note · closed · wont_fix with reason …) — rules in dev_bug_set_status */
export async function setBugStatusAs(caller: BotCaller, bugId: string, status: unknown, note: unknown): Promise<string | null> {
  if (!BUG_STATUSES.includes(status as BugStatus)) return `status ต้องเป็น ${BUG_STATUSES.join(', ')}`
  const { error } = await untyped(caller.sb).rpc('dev_bug_set_status', {
    p_bug_id: bugId,
    p_status: status,
    p_note: typeof note === 'string' && note.trim() ? note.trim() : null,
    p_actor: caller.user.id,
  })
  return error ? error.message : null
}

/** bug with history and signed picture URLs (1 hour) */
export async function bugDetail(caller: BotCaller, r: { b: BugRow; project: DevProjectRow; uatNo: number | null }) {
  const { data } = await untyped(caller.sb)
    .from('dev_bug_events')
    .select('kind, actor_name, from_status, to_status, note, created_at')
    .eq('bug_id', r.b.id)
    .order('created_at', { ascending: false })
  return {
    bug: { ...toBotBug(r.b, r.project, r.uatNo), shots: await signShots(caller, Array.isArray(r.b.shots) ? r.b.shots : []) },
    history: data ?? [],
  }
}

// ── releases (owner 2026-11-23, migration 20261123130000_dev_releases) ──────
export const RELEASE_COLS = 'id, name, goal, start_date, target_date, status, released_at, created_at'
export const RELEASE_STATUS_VALUES = ['planned', 'active', 'released'] as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** releases of a project with progress (done = UAT passed/closed · bug closed/wont_fix) and their items */
export async function listReleases(caller: BotCaller, project: DevProjectRow, withItems: boolean) {
  const sb = untyped(caller.sb)
  const [{ data: rel, error }, { data: cases }, { data: bugs }] = await Promise.all([
    sb.from('dev_releases').select(RELEASE_COLS).eq('project_id', project.id).order('created_at'),
    sb.from('dev_uat_cases').select('no, title, status, release_id').eq('project_id', project.id).not('release_id', 'is', null),
    sb.from('dev_bugs').select('no, title, status, release_id').eq('project_id', project.id).not('release_id', 'is', null),
  ])
  if (error) throw new Error(error.message)
  type It = { no: number; title: string; status: string; release_id: string }
  return ((rel ?? []) as Record<string, unknown>[]).map((r) => {
    const c = ((cases ?? []) as It[]).filter((x) => x.release_id === r.id)
    const b = ((bugs ?? []) as It[]).filter((x) => x.release_id === r.id)
    const cDone = c.filter((x) => x.status === 'passed' || x.status === 'closed').length
    const bDone = b.filter((x) => x.status === 'closed' || x.status === 'wont_fix').length
    return {
      ...r,
      progress: { cases: c.length, cases_done: cDone, bugs: b.length, bugs_done: bDone, percent: c.length + b.length ? Math.round(((cDone + bDone) / (c.length + b.length)) * 100) : 0 },
      ...(withItems
        ? { cases: c.map((x) => ({ code: uatCode(x.no), title: x.title, status: x.status })), bugs: b.map((x) => ({ code: bugCode(x.no), title: x.title, status: x.status })) }
        : {}),
    }
  })
}

/** release by id or exact name inside the project */
export async function releaseRef(caller: BotCaller, project: DevProjectRow, ref: unknown): Promise<{ id: string; name: string }> {
  const v = typeof ref === 'string' ? ref.trim() : ''
  if (!v) throw new Error('ต้องระบุ release (id หรือชื่อรอบ)')
  const sb = untyped(caller.sb)
  const isId = /^[0-9a-f-]{36}$/.test(v)
  const { data } = await sb.from('dev_releases').select('id, name').eq('project_id', project.id).eq(isId ? 'id' : 'name', v).limit(2)
  const rows = (data ?? []) as { id: string; name: string }[]
  if (rows.length === 0) throw new Error(`ไม่พบรอบ "${v}" ใน ${project.slug}`)
  if (rows.length > 1) throw new Error(`มีรอบชื่อ "${v}" มากกว่า 1 รอบ ใช้ id แทน`)
  return rows[0]
}

/** fields for insert/update (name required on insert) */
export function parseReleaseInput(raw: Record<string, unknown>, partial: boolean): { row: Record<string, unknown> } | { error: string } {
  const row: Record<string, unknown> = {}
  if (raw.name !== undefined || !partial) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!name) return { error: 'ต้องมี name' }
    row.name = name
  }
  if (raw.goal !== undefined) row.goal = raw.goal === null ? null : String(raw.goal).trim() || null
  for (const k of ['start_date', 'target_date']) {
    if (raw[k] === undefined) continue
    if (raw[k] !== null && raw[k] !== '' && !ISO_DATE.test(String(raw[k]))) return { error: `${k} ต้องเป็น YYYY-MM-DD` }
    row[k] = raw[k] || null
  }
  if (raw.status !== undefined) {
    if (!(RELEASE_STATUS_VALUES as readonly string[]).includes(String(raw.status))) return { error: `status ต้องเป็น ${RELEASE_STATUS_VALUES.join(', ')}` }
    row.status = raw.status
  }
  return { row }
}

/** put case/bug numbers of this project into a release (releaseId), or take them out of `from` (releaseId null) */
export async function setReleaseItems(caller: BotCaller, project: DevProjectRow, releaseId: string | null, cases: unknown, bugs: unknown, from?: string) {
  const nums = (v: unknown, re: RegExp) => (Array.isArray(v) ? v.map((x) => Number(String(x).replace(re, ''))) : [])
  const c = nums(cases, /^uat-?/i)
  const b = nums(bugs, /^bug-?/i)
  if ([...c, ...b].some((n) => !Number.isInteger(n) || n < 1)) throw new Error('เลขเคส/บั๊กไม่ถูกต้อง')
  const sb = untyped(caller.sb)
  let moved = 0
  if (c.length) {
    let q = sb.from('dev_uat_cases').update({ release_id: releaseId }).eq('project_id', project.id).in('no', c)
    if (from) q = q.eq('release_id', from)
    const { data, error } = await q.select('no')
    if (error) throw new Error(error.message)
    moved += (data ?? []).length
  }
  if (b.length) {
    let q = sb.from('dev_bugs').update({ release_id: releaseId }).eq('project_id', project.id).in('no', b)
    if (from) q = q.eq('release_id', from)
    const { data, error } = await q.select('no')
    if (error) throw new Error(error.message)
    moved += (data ?? []).length
  }
  return moved
}
