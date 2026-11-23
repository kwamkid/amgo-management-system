// Dev tracker — releases (owner 2026-11-23): a round of work per project; UAT cases + bugs are dragged in and
// progress = done / total. Client-safe. Rules in migration 20261123130000_dev_releases (managers only).

import type { BugStatus } from './bugs'
import type { UatStatus, UatTone } from './uat'

export type ReleaseStatus = 'planned' | 'active' | 'released'
export const RELEASE_STATUSES: ReleaseStatus[] = ['planned', 'active', 'released']
export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = { planned: 'วางแผน', active: 'กำลังทำ', released: 'ปล่อยแล้ว' }
export const RELEASE_STATUS_TONE: Record<ReleaseStatus, UatTone> = { planned: 'neutral', active: 'warning', released: 'success' }

export interface DevRelease {
  id: string
  projectId: string
  name: string
  goal: string | null
  startDate: string | null
  targetDate: string | null
  status: ReleaseStatus
  releasedAt: string | null
}

/** a UAT case or a bug as it appears on the release page */
export interface ReleaseItem {
  id: string
  kind: 'case' | 'bug'
  no: number
  title: string
  status: UatStatus | BugStatus
  releaseId: string | null
  sortOrder: number
  /** UAT priority 1 / bug critical|high */
  urgent: boolean
}

/** done = UAT passed/closed · bug closed/wont_fix */
export const itemDone = (i: Pick<ReleaseItem, 'kind' | 'status'>) =>
  i.kind === 'case' ? i.status === 'passed' || i.status === 'closed' : i.status === 'closed' || i.status === 'wont_fix'

export interface ReleaseProgress {
  cases: number
  casesDone: number
  bugs: number
  bugsDone: number
  total: number
  done: number
}

export function releaseProgress(items: ReleaseItem[], releaseId: string): ReleaseProgress {
  const mine = items.filter((i) => i.releaseId === releaseId)
  const cases = mine.filter((i) => i.kind === 'case')
  const bugs = mine.filter((i) => i.kind === 'bug')
  const casesDone = cases.filter(itemDone).length
  const bugsDone = bugs.filter(itemDone).length
  return { cases: cases.length, casesDone, bugs: bugs.length, bugsDone, total: mine.length, done: casesDone + bugsDone }
}
