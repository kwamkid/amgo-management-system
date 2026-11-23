// Dev tracker — releases, browser-side (RLS: everyone in the project reads, managers write — migration 20261123130000)

import { createClient } from '@/lib/supabase/client'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import type { DevRelease, ReleaseItem, ReleaseStatus } from '@/lib/dev/releases'

const db = () => createClient()

type ReleaseRow = {
  id: string
  project_id: string
  name: string
  goal: string | null
  start_date: string | null
  target_date: string | null
  status: ReleaseStatus
  released_at: string | null
}

const toRelease = (r: ReleaseRow): DevRelease => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  goal: r.goal,
  startDate: r.start_date,
  targetDate: r.target_date,
  status: r.status,
  releasedAt: r.released_at,
})

export async function getReleases(projectId: string): Promise<DevRelease[]> {
  const { data, error } = await db()
    .from('dev_releases')
    .select('id, project_id, name, goal, start_date, target_date, status, released_at')
    .eq('project_id', projectId)
    .order('status')
    .order('target_date', { nullsFirst: false })
    .order('created_at')
  if (error) throw new Error(`ดึงรอบไม่สำเร็จ: ${error.message}`)
  const order: Record<ReleaseStatus, number> = { active: 0, planned: 1, released: 2 }
  return ((data ?? []) as ReleaseRow[]).map(toRelease).sort((a, b) => order[a.status] - order[b.status])
}

/**
 * every case + bug the release page needs: everything already in a release (progress counts closed ones too)
 * + open ones in no release (the backlog to drag from)
 */
export async function getReleaseItems(projectId: string): Promise<ReleaseItem[]> {
  const caseCols = 'id, no, title, status, release_id, sort_order, priority'
  const bugCols = 'id, no, title, status, release_id, sort_order, severity'
  const [inCases, openCases, inBugs, openBugs] = await Promise.all([
    db().from('dev_uat_cases').select(caseCols).eq('project_id', projectId).not('release_id', 'is', null).limit(2000),
    db().from('dev_uat_cases').select(caseCols).eq('project_id', projectId).is('release_id', null).neq('status', 'closed').limit(2000),
    db().from('dev_bugs').select(bugCols).eq('project_id', projectId).not('release_id', 'is', null).limit(2000),
    db().from('dev_bugs').select(bugCols).eq('project_id', projectId).is('release_id', null).not('status', 'in', '(closed,wont_fix)').limit(2000),
  ])
  const error = inCases.error ?? openCases.error ?? inBugs.error ?? openBugs.error
  if (error) throw new Error(`ดึงเคส/บั๊กไม่สำเร็จ: ${error.message}`)
  type Row = { id: string; no: number; title: string; status: string; release_id: string | null; sort_order: number | null; priority?: number; severity?: string }
  const cases = [...(inCases.data ?? []), ...(openCases.data ?? [])] as Row[]
  const bugs = [...(inBugs.data ?? []), ...(openBugs.data ?? [])] as Row[]
  return [
    ...bugs.map((r): ReleaseItem => ({
      id: r.id, kind: 'bug', no: r.no, title: r.title, status: r.status as ReleaseItem['status'], releaseId: r.release_id,
      sortOrder: r.severity === 'critical' ? 0 : r.severity === 'high' ? 1 : 2, urgent: r.severity === 'critical' || r.severity === 'high',
    })),
    ...cases.map((r): ReleaseItem => ({
      id: r.id, kind: 'case', no: r.no, title: r.title, status: r.status as ReleaseItem['status'], releaseId: r.release_id,
      sortOrder: 10 + (r.priority ?? 2), urgent: r.priority === 1,
    })),
  ]
}

export interface ReleaseInput {
  name: string
  goal?: string | null
  startDate?: string | null
  targetDate?: string | null
  status?: ReleaseStatus
}

const releaseRow = (i: Partial<ReleaseInput>) => {
  const p: TablesUpdate<'dev_releases'> = {}
  if (i.name !== undefined) p.name = i.name.trim()
  if (i.goal !== undefined) p.goal = i.goal?.trim() || null
  if (i.startDate !== undefined) p.start_date = i.startDate || null
  if (i.targetDate !== undefined) p.target_date = i.targetDate || null
  if (i.status !== undefined) p.status = i.status
  return p
}

export async function createRelease(projectId: string, input: ReleaseInput): Promise<string> {
  if (!input.name.trim()) throw new Error('ตั้งชื่อรอบก่อน')
  const { data, error } = await db().from('dev_releases').insert({ project_id: projectId, ...releaseRow(input) } as TablesInsert<'dev_releases'>).select('id').single()
  if (error) throw new Error(`สร้างรอบไม่สำเร็จ: ${error.message}`)
  return (data as { id: string }).id
}

export async function updateRelease(id: string, input: Partial<ReleaseInput>): Promise<void> {
  const { error } = await db().from('dev_releases').update(releaseRow(input)).eq('id', id)
  if (error) throw new Error(`บันทึกรอบไม่สำเร็จ: ${error.message}`)
}

/** ลบรอบ — เคส/บั๊กในรอบไม่หาย แค่กลับไปไม่อยู่ในรอบไหน */
export async function deleteRelease(id: string): Promise<void> {
  const { error } = await db().from('dev_releases').delete().eq('id', id)
  if (error) throw new Error(`ลบรอบไม่สำเร็จ: ${error.message}`)
}

/** เอาเคส/บั๊กเข้ารอบ (releaseId) หรือออกจากรอบ (null) */
export async function setItemRelease(item: Pick<ReleaseItem, 'id' | 'kind'>, releaseId: string | null): Promise<void> {
  const { error } = await db().from(item.kind === 'case' ? 'dev_uat_cases' : 'dev_bugs').update({ release_id: releaseId }).eq('id', item.id)
  if (error) throw new Error(error.message.replace(/^.*?: /, ''))
}
