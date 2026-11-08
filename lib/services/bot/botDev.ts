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

