// Dev tracker — UAT words, columns and helpers shared by the board, the modal, the bot API and the CLI
// (client-safe: no Supabase here). Owner 3 Nov 2569: one app = one project · cases numbered UAT-0001 globally.

export type UatStatus = 'pending' | 'passed' | 'failed' | 'blocked' | 'retest' | 'closed'
export type UatResultValue = 'passed' | 'failed' | 'blocked'
export type UatEnvironment = 'production' | 'staging'
export type UatDevice = 'any' | 'mobile' | 'desktop'
export type DevRole = 'manager' | 'tester' | 'viewer'

export interface UatStep {
  action: string
  expected?: string
}

export interface DevProject {
  id: string
  slug: string
  name: string
  productionUrl: string | null
  stagingUrl: string | null
  isActive: boolean
  /** สิทธิ์ของคนที่ล็อกอินในโปรเจกต์นี้ (แอดมิน = manager เสมอ) */
  myRole: DevRole
  openCases: number
  members: DevMember[]
}

export interface DevMember {
  userId: string
  name: string
  avatarUrl: string | null
  role: DevRole
}

export interface UatCase {
  id: string
  no: number
  projectId: string
  title: string
  module: string | null
  priority: 1 | 2 | 3
  environment: UatEnvironment
  shop: string | null
  loginAs: string | null
  menuPath: string | null
  pageUrl: string | null
  device: UatDevice
  preparation: string | null
  steps: UatStep[]
  source: string | null
  status: UatStatus
  round: number
  fixNote: string | null
  sortOrder: number
  resultCount: number
  updatedAt: string
}

export interface UatShot {
  path: string
  url: string | null
}

export interface UatResult {
  id: string
  round: number
  testerName: string | null
  result: UatResultValue
  failedStep: number | null
  note: string | null
  shots: UatShot[]
  createdAt: string
}

export const UAT_RESULTS: UatResultValue[] = ['passed', 'failed', 'blocked']
export const UAT_MAX_SHOTS = 8
export const SHOT_BUCKET = 'dev-shots'

export const STATUS_LABELS: Record<UatStatus, string> = {
  pending: 'รอเทส',
  retest: 'รอเทสซ้ำ',
  passed: 'ผ่าน',
  failed: 'ไม่ผ่าน',
  blocked: 'ติดขัด',
  closed: 'ปิดแล้ว',
}

export type UatTone = 'sky' | 'danger' | 'warning' | 'success' | 'neutral' | 'grape'
export const STATUS_TONE: Record<UatStatus, UatTone> = {
  pending: 'sky',
  retest: 'grape',
  passed: 'success',
  failed: 'danger',
  blocked: 'warning',
  closed: 'neutral',
}

export type ColumnKey = 'todo' | 'failed' | 'blocked' | 'passed' | 'closed'

/** บอร์ด: คอลัมน์ตามสิ่งที่คนเทสต้องทำก่อน · managerOnly = วางได้เฉพาะผู้จัดการ/แอดมิน */
export const COLUMNS: { key: ColumnKey; label: string; statuses: UatStatus[]; tone: UatTone; managerOnly: boolean }[] = [
  { key: 'todo', label: 'รอเทส', statuses: ['pending', 'retest'], tone: 'sky', managerOnly: true },
  { key: 'failed', label: 'ไม่ผ่าน', statuses: ['failed'], tone: 'danger', managerOnly: false },
  { key: 'blocked', label: 'ติดขัด', statuses: ['blocked'], tone: 'warning', managerOnly: false },
  { key: 'passed', label: 'ผ่าน', statuses: ['passed'], tone: 'success', managerOnly: false },
  { key: 'closed', label: 'ปิดแล้ว', statuses: ['closed'], tone: 'neutral', managerOnly: true },
]

export function columnOf(status: UatStatus): ColumnKey {
  return COLUMNS.find((c) => c.statuses.includes(status))!.key
}

/** วางการ์ดบนคอลัมน์ผล = บันทึกผลนั้น */
export const COLUMN_RESULT: Partial<Record<ColumnKey, UatResultValue>> = {
  failed: 'failed',
  blocked: 'blocked',
  passed: 'passed',
}

export const PRIORITY_LABELS: Record<number, string> = { 1: 'ด่วน', 2: 'ปกติ', 3: 'ไม่ด่วน' }
export const DEVICE_LABELS: Record<UatDevice, string> = { any: 'มือถือหรือคอมก็ได้', mobile: 'มือถือ', desktop: 'คอม' }
export const ENV_LABELS: Record<UatEnvironment, string> = { production: 'ระบบจริง', staging: 'ระบบทดสอบ (staging)' }
export const ROLE_LABELS: Record<DevRole, string> = { manager: 'ผู้จัดการ', tester: 'ผู้เทส', viewer: 'ดูอย่างเดียว' }

export const uatCode = (no: number) => `UAT-${String(no).padStart(4, '0')}`

/** ลิงก์หน้าที่ต้องเทส: URL เต็มใช้ตามนั้น · `/path` ต่อท้าย URL ของโปรเจกต์ตามระบบที่เทส */
export function pageLink(
  c: Pick<UatCase, 'environment' | 'pageUrl'>,
  project: Pick<DevProject, 'productionUrl' | 'stagingUrl'> | null | undefined
): string | null {
  const url = c.pageUrl?.trim()
  if (!url) return null
  if (/^https?:\/\//.test(url)) return url
  const base = (c.environment === 'staging' ? project?.stagingUrl : project?.productionUrl)?.replace(/\/$/, '')
  return base && url.startsWith('/') ? base + url : null
}
