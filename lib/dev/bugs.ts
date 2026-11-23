// Dev tracker — bug words, columns and helpers shared by the board, the modal, the bot API and the CLI
// (client-safe: no Supabase here). Owner 2026-11-23: numbers per project (BUG-0001 restarts in each project).
// Rules live in DB (migration 20261123120000_dev_bugs): status moves only through dev_bug_set_status.

import type { UatDevice, UatEnvironment, UatTone } from './uat'

export type BugStatus = 'new' | 'accepted' | 'fixing' | 'testing' | 'closed' | 'wont_fix'
export type BugSeverity = 'critical' | 'high' | 'normal' | 'low'

export const BUG_STATUSES: BugStatus[] = ['new', 'accepted', 'fixing', 'testing', 'closed', 'wont_fix']
export const BUG_SEVERITIES: BugSeverity[] = ['critical', 'high', 'normal', 'low']
export const BUG_MAX_SHOTS = 8
/** pictures of a bug: dev-shots `bugs/<project id>/<file>` (uploaded before the bug exists) */
export const bugShotFolder = (projectId: string) => `bugs/${projectId}`
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const BUG_SHOT = new RegExp(`^bugs/(${UUID})/[\\w.-]+\\.(png|jpg|webp)$`)

export interface DevBug {
  id: string
  projectId: string
  no: number
  title: string
  steps: string | null
  expected: string | null
  actual: string | null
  environment: UatEnvironment
  device: UatDevice
  pageUrl: string | null
  severity: BugSeverity
  status: BugStatus
  shots: string[]
  reportedBy: string | null
  reporterName: string | null
  assigneeId: string | null
  assigneeName: string | null
  uatCaseId: string | null
  uatCaseNo: number | null
  fixNote: string | null
  closeReason: string | null
  source: string | null
  sortOrder: number
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BugEvent {
  id: string
  actorName: string | null
  kind: 'created' | 'status' | 'assign'
  fromStatus: BugStatus | null
  toStatus: BugStatus | null
  note: string | null
  createdAt: string
}

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  new: 'ใหม่',
  accepted: 'รับเรื่อง',
  fixing: 'กำลังแก้',
  testing: 'รอเทส',
  closed: 'ปิดแล้ว',
  wont_fix: 'ไม่แก้',
}

export const BUG_STATUS_TONE: Record<BugStatus, UatTone> = {
  new: 'danger',
  accepted: 'warning',
  fixing: 'grape',
  testing: 'sky',
  closed: 'success',
  wont_fix: 'neutral',
}

export const SEVERITY_LABELS: Record<BugSeverity, string> = { critical: 'ร้ายแรง', high: 'สูง', normal: 'ปกติ', low: 'ต่ำ' }
export const SEVERITY_HINTS: Record<BugSeverity, string> = {
  critical: 'ใช้งานไม่ได้ / ข้อมูลเสีย / เงินผิด',
  high: 'ฟีเจอร์หลักพัง แต่มีทางเลี่ยง',
  normal: 'ผิดแต่ยังใช้งานได้',
  low: 'หน้าตา / คำผิด',
}
export const SEVERITY_TONE: Record<BugSeverity, UatTone> = { critical: 'danger', high: 'warning', normal: 'neutral', low: 'neutral' }

export type BugColumnKey = 'new' | 'accepted' | 'fixing' | 'testing' | 'closed'

/** บอร์ด: ใหม่ · รับเรื่อง · กำลังแก้ · รอเทส · ปิดแล้ว (ไม่แก้อยู่ในปิดแล้ว) · testerDrop = ผู้เทสวางได้ (ตรวจซ้ำใน DB) */
export const BUG_COLUMNS: { key: BugColumnKey; label: string; statuses: BugStatus[]; tone: UatTone; testerDrop: boolean }[] = [
  { key: 'new', label: 'ใหม่', statuses: ['new'], tone: 'danger', testerDrop: false },
  { key: 'accepted', label: 'รับเรื่อง', statuses: ['accepted'], tone: 'warning', testerDrop: false },
  { key: 'fixing', label: 'กำลังแก้', statuses: ['fixing'], tone: 'grape', testerDrop: true },
  { key: 'testing', label: 'รอเทส', statuses: ['testing'], tone: 'sky', testerDrop: false },
  { key: 'closed', label: 'ปิดแล้ว', statuses: ['closed', 'wont_fix'], tone: 'success', testerDrop: true },
]

export const bugColumnOf = (s: BugStatus): BugColumnKey => BUG_COLUMNS.find((c) => c.statuses.includes(s))!.key

export const bugCode = (no: number) => `BUG-${String(no).padStart(4, '0')}`
export const parseBugNo = (v: unknown): number => Number(String(v ?? '').replace(/^bug-?/i, ''))
export const isOpenBug = (s: BugStatus) => s !== 'closed' && s !== 'wont_fix'
