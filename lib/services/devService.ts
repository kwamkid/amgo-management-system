// Dev tracker — browser-side data access (RLS does the permission work, see migration 20261103100000_dev_tracker)
// Projects + members · UAT cases on the board · results with pictures (bucket dev-shots, path <case id>/…)
// Rules enforced in DB triggers, repeated here only for the UI: testers reorder only · a result needs 1–8 pictures ·
// failed/blocked need a note · results are history (never edited) · a closed case takes no results.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { resizeImage } from '@/lib/utils/resizeImage'
import {
  SHOT_BUCKET,
  UAT_MAX_SHOTS,
  type DevMember,
  type DevProject,
  type DevRole,
  type UatCase,
  type UatResult,
  type UatResultValue,
  type UatShot,
  type UatStep,
} from '@/lib/dev/uat'

// dev_* tables are not in types/database.ts yet (types:gen needs the owner's CLI login) — untyped until then
const db = () => createClient() as unknown as SupabaseClient
const SIGNED_TTL = 60 * 60 * 24 // 1 วัน — ดูย้อนหลังในประวัติได้ แต่ไม่ตลอดกาล

type ProjectRow = {
  id: string
  slug: string
  name: string
  production_url: string | null
  staging_url: string | null
  is_active: boolean
  dev_project_members: { user_id: string; role: DevRole; users: { full_name: string; nickname: string | null } | null }[]
  dev_uat_cases: { count: number }[]
}

const personName = (u: { full_name: string; nickname: string | null } | null) => u?.nickname || u?.full_name || '?'

function toProject(r: ProjectRow, me: string, isAdmin: boolean): DevProject {
  const members: DevMember[] = (r.dev_project_members ?? []).map((m) => ({
    userId: m.user_id,
    name: personName(m.users),
    avatarUrl: null,
    role: m.role,
  }))
  const mine = members.find((m) => m.userId === me)?.role
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    productionUrl: r.production_url,
    stagingUrl: r.staging_url,
    isActive: r.is_active,
    myRole: isAdmin ? 'manager' : (mine ?? 'viewer'),
    openCases: r.dev_uat_cases?.[0]?.count ?? 0,
    members,
  }
}

const PROJECT_COLS =
  'id, slug, name, production_url, staging_url, is_active, ' +
  'dev_project_members(user_id, role, users!dev_project_members_user_id_fkey(full_name, nickname)), dev_uat_cases(count)'

/** โปรเจกต์ที่ฉันอยู่ (แอดมิน = ทุกโปรเจกต์) พร้อมจำนวนเคสที่ยังเปิด */
export async function getDevProjects(me: string, isAdmin: boolean): Promise<DevProject[]> {
  const { data, error } = await db()
    .from('dev_projects')
    .select(PROJECT_COLS)
    .neq('dev_uat_cases.status', 'closed')
    .order('name')
  if (error) throw new Error(`ดึงโปรเจกต์ไม่สำเร็จ: ${error.message}`)
  return ((data ?? []) as unknown as ProjectRow[]).map((r) => toProject(r, me, isAdmin))
}

export async function getDevProject(slug: string, me: string, isAdmin: boolean): Promise<DevProject | null> {
  const { data, error } = await db()
    .from('dev_projects')
    .select(PROJECT_COLS)
    .eq('slug', slug)
    .neq('dev_uat_cases.status', 'closed')
    .maybeSingle()
  if (error) throw new Error(`ดึงโปรเจกต์ไม่สำเร็จ: ${error.message}`)
  return data ? toProject(data as unknown as ProjectRow, me, isAdmin) : null
}

export async function createDevProject(input: {
  slug: string
  name: string
  productionUrl?: string | null
  stagingUrl?: string | null
}): Promise<void> {
  const { error } = await db().from('dev_projects').insert({
    slug: input.slug.trim().toLowerCase(),
    name: input.name.trim(),
    production_url: input.productionUrl?.trim() || null,
    staging_url: input.stagingUrl?.trim() || null,
  })
  if (error) throw new Error(error.code === '23505' ? 'มีโปรเจกต์ slug นี้แล้ว' : `สร้างโปรเจกต์ไม่สำเร็จ: ${error.message}`)
}

export async function updateDevProject(
  id: string,
  input: { name?: string; productionUrl?: string | null; stagingUrl?: string | null; isActive?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.productionUrl !== undefined) patch.production_url = input.productionUrl?.trim() || null
  if (input.stagingUrl !== undefined) patch.staging_url = input.stagingUrl?.trim() || null
  if (input.isActive !== undefined) patch.is_active = input.isActive
  const { error } = await db().from('dev_projects').update(patch).eq('id', id)
  if (error) throw new Error(`บันทึกโปรเจกต์ไม่สำเร็จ: ${error.message}`)
}

export async function setDevMember(projectId: string, userId: string, role: DevRole): Promise<void> {
  const { error } = await db()
    .from('dev_project_members')
    .upsert({ project_id: projectId, user_id: userId, role }, { onConflict: 'project_id,user_id' })
  if (error) throw new Error(`เพิ่มสมาชิกไม่สำเร็จ: ${error.message}`)
}

export async function removeDevMember(projectId: string, userId: string): Promise<void> {
  const { error } = await db().from('dev_project_members').delete().match({ project_id: projectId, user_id: userId })
  if (error) throw new Error(`ลบสมาชิกไม่สำเร็จ: ${error.message}`)
}

/** พนักงานที่เพิ่มเป็นสมาชิกได้ */
export async function getDevPeople(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db()
    .from('users')
    .select('id, full_name, nickname')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name')
  if (error) throw new Error(`ดึงรายชื่อไม่สำเร็จ: ${error.message}`)
  return (data ?? []).map((u: { id: string; full_name: string; nickname: string | null }) => ({ id: u.id, name: personName(u) }))
}

// ── cases ────────────────────────────────────────────────────────────────────

type CaseRow = {
  id: string
  no: number
  project_id: string
  title: string
  module: string | null
  priority: 1 | 2 | 3
  environment: UatCase['environment']
  shop: string | null
  login_as: string | null
  menu_path: string | null
  page_url: string | null
  device: UatCase['device']
  preparation: string | null
  steps: UatStep[]
  source: string | null
  status: UatCase['status']
  round: number
  fix_note: string | null
  sort_order: number | null
  updated_at: string
  dev_uat_results: { count: number }[]
}

const CASE_COLS =
  'id, no, project_id, title, module, priority, environment, shop, login_as, menu_path, page_url, device, ' +
  'preparation, steps, source, status, round, fix_note, sort_order, updated_at, dev_uat_results(count)'

const toCase = (r: CaseRow): UatCase => ({
  id: r.id,
  no: r.no,
  projectId: r.project_id,
  title: r.title,
  module: r.module,
  priority: r.priority,
  environment: r.environment,
  shop: r.shop,
  loginAs: r.login_as,
  menuPath: r.menu_path,
  pageUrl: r.page_url,
  device: r.device,
  preparation: r.preparation,
  steps: Array.isArray(r.steps) ? r.steps : [],
  source: r.source,
  status: r.status,
  round: r.round,
  fixNote: r.fix_note,
  sortOrder: r.sort_order ?? r.no,
  resultCount: r.dev_uat_results?.[0]?.count ?? 0,
  updatedAt: r.updated_at,
})

const CLOSED_SHOWN = 60

/** เคสของโปรเจกต์: ทุกเคสที่ยังเปิด + เคสที่ปิดล่าสุด (บอร์ดไม่ต้องโหลดประวัติทั้งหมด) */
export async function getUatCases(projectId: string): Promise<UatCase[]> {
  const [open, closed] = await Promise.all([
    db().from('dev_uat_cases').select(CASE_COLS).eq('project_id', projectId).neq('status', 'closed')
      .order('sort_order', { nullsFirst: false }).order('no').limit(2000),
    db().from('dev_uat_cases').select(CASE_COLS).eq('project_id', projectId).eq('status', 'closed')
      .order('updated_at', { ascending: false }).limit(CLOSED_SHOWN),
  ])
  const error = open.error ?? closed.error
  if (error) throw new Error(`ดึงเคสไม่สำเร็จ: ${error.message}`)
  return [...((open.data ?? []) as unknown as CaseRow[]), ...((closed.data ?? []) as unknown as CaseRow[])].map(toCase)
}

export interface UatCaseInput {
  title: string
  module?: string | null
  priority?: 1 | 2 | 3
  environment?: UatCase['environment']
  shop?: string | null
  loginAs?: string | null
  menuPath?: string | null
  pageUrl?: string | null
  device?: UatCase['device']
  preparation?: string | null
  steps: UatStep[]
  source?: string | null
}

function caseRow(input: Partial<UatCaseInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  const text = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null)
  if (input.title !== undefined) p.title = input.title.trim()
  if (input.module !== undefined) p.module = text(input.module)
  if (input.priority !== undefined) p.priority = input.priority
  if (input.environment !== undefined) p.environment = input.environment
  if (input.shop !== undefined) p.shop = text(input.shop)
  if (input.loginAs !== undefined) p.login_as = text(input.loginAs)
  if (input.menuPath !== undefined) p.menu_path = text(input.menuPath)
  if (input.pageUrl !== undefined) p.page_url = text(input.pageUrl)
  if (input.device !== undefined) p.device = input.device
  if (input.preparation !== undefined) p.preparation = text(input.preparation)
  if (input.steps !== undefined)
    p.steps = input.steps.map((s) => ({
      action: s.action.trim(),
      ...(s.expected?.trim() ? { expected: s.expected.trim() } : {}),
      ...(s.image ? { image: s.image } : {}), // step pictures come from Claude's tester; the form only keeps them
    }))
      .filter((s) => s.action)
  if (input.source !== undefined) p.source = text(input.source)
  return p
}

/** ผู้จัดการเพิ่มเคสจากหน้าเว็บ (Claude เพิ่มผ่าน bot API) — ต่อท้ายคอลัมน์รอเทส */
export async function createUatCase(projectId: string, input: UatCaseInput): Promise<number> {
  if (!input.title.trim()) throw new Error('ใส่ชื่อเคสก่อน')
  if (!input.steps.some((s) => s.action.trim())) throw new Error('ใส่ขั้นตอนอย่างน้อย 1 ข้อ')
  const { data, error } = await db()
    .from('dev_uat_cases')
    .insert({ project_id: projectId, sort_order: Date.now() / 1000, ...caseRow(input) })
    .select('no')
    .single()
  if (error) throw new Error(`เพิ่มเคสไม่สำเร็จ: ${error.message}`)
  return (data as { no: number }).no
}

export async function updateUatCase(id: string, input: Partial<UatCaseInput>): Promise<void> {
  const { error } = await db().from('dev_uat_cases').update(caseRow(input)).eq('id', id)
  if (error) throw new Error(`บันทึกเคสไม่สำเร็จ: ${error.message}`)
}

export async function deleteUatCase(id: string): Promise<void> {
  const { error } = await db().from('dev_uat_cases').delete().eq('id', id)
  if (error) throw new Error(`ลบเคสไม่สำเร็จ: ${error.message}`)
}

/** ลากเรียงในคอลัมน์ (ผู้เทสทำได้) */
export async function moveUatCase(id: string, sortOrder: number): Promise<void> {
  const { error } = await db().from('dev_uat_cases').update({ sort_order: sortOrder }).eq('id', id)
  if (error) throw new Error(`ย้ายไม่สำเร็จ: ${error.message}`)
}

/** ส่งกลับไปเทสซ้ำ (ผู้จัดการ): รอบ + 1 พร้อมบอกว่าแก้อะไร */
export async function retestUatCase(c: Pick<UatCase, 'id' | 'round'>, fixNote: string, sortOrder?: number): Promise<void> {
  const patch: Record<string, unknown> = { status: 'retest', round: c.round + 1, fix_note: fixNote.trim() || null }
  if (sortOrder !== undefined) patch.sort_order = sortOrder
  const { error } = await db().from('dev_uat_cases').update(patch).eq('id', c.id)
  if (error) throw new Error(`ส่งเทสซ้ำไม่สำเร็จ: ${error.message}`)
}

export async function closeUatCase(id: string, sortOrder?: number): Promise<void> {
  const patch: Record<string, unknown> = { status: 'closed' }
  if (sortOrder !== undefined) patch.sort_order = sortOrder
  const { error } = await db().from('dev_uat_cases').update(patch).eq('id', id)
  if (error) throw new Error(`ปิดเคสไม่สำเร็จ: ${error.message}`)
}

// ── results ──────────────────────────────────────────────────────────────────

async function signShots(paths: string[]): Promise<UatShot[]> {
  if (paths.length === 0) return []
  const { data } = await db().storage.from(SHOT_BUCKET).createSignedUrls(paths, SIGNED_TTL)
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return paths.map((path) => ({ path, url: byPath.get(path) ?? null }))
}

/** step pictures → signed URLs, keyed by path (read policy on dev-shots: first folder = case id) */
export async function signStepImages(steps: UatStep[]): Promise<Record<string, string>> {
  const paths = steps.map((s) => s.image).filter((p): p is string => !!p)
  return Object.fromEntries((await signShots(paths)).filter((s) => s.url).map((s) => [s.path, s.url as string]))
}

export async function getUatResults(caseId: string): Promise<UatResult[]> {
  const { data, error } = await db()
    .from('dev_uat_results')
    .select('id, round, tester_name, result, failed_step, note, shots, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`ดึงผลเทสไม่สำเร็จ: ${error.message}`)
  return Promise.all(
    (data ?? []).map(async (r: Record<string, unknown>) => ({
      id: r.id as string,
      round: r.round as number,
      testerName: r.tester_name as string | null,
      result: r.result as UatResultValue,
      failedStep: r.failed_step as number | null,
      note: r.note as string | null,
      shots: await signShots(Array.isArray(r.shots) ? (r.shots as string[]) : []),
      createdAt: r.created_at as string,
    }))
  )
}

/** บันทึกผล: ย่อรูปในเบราว์เซอร์ อัปทีละรูป (Vercel จำกัด body) แล้วค่อยบันทึกแถวผล · สถานะเคสเปลี่ยนตามใน DB */
export async function addUatResult(
  c: Pick<UatCase, 'id'>,
  input: { result: UatResultValue; failedStep: number | null; note: string; files: File[]; sortOrder?: number },
  testerId: string
): Promise<void> {
  if (input.files.length < 1) throw new Error('แนบรูปผลการเทสอย่างน้อย 1 รูป')
  if (input.files.length > UAT_MAX_SHOTS) throw new Error(`แนบได้ไม่เกิน ${UAT_MAX_SHOTS} รูป`)
  if (input.result !== 'passed' && !input.note.trim()) throw new Error('บอกหน่อยว่าเจออะไร')
  const sb = db()
  const paths: string[] = []
  for (const file of input.files) {
    const blob = await resizeImage(file, { maxSide: 1600, quality: 0.82 })
    const path = `${c.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
    const { error } = await sb.storage.from(SHOT_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`)
    paths.push(path)
  }
  const { error } = await sb.from('dev_uat_results').insert({
    case_id: c.id,
    round: 0, // trigger ใส่รอบปัจจุบันของเคสให้
    tester_id: testerId,
    result: input.result,
    failed_step: input.failedStep,
    note: input.note.trim() || null,
    shots: paths,
  })
  if (error) {
    await sb.storage.from(SHOT_BUCKET).remove(paths)
    throw new Error(error.message.replace(/^.*?: /, ''))
  }
  if (input.sortOrder !== undefined) await moveUatCase(c.id, input.sortOrder).catch(() => {})
}
