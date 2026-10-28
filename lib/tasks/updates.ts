// lib/tasks/updates.ts
//
// ไทม์ไลน์ความคืบหน้าของงาน — ประเภทรายการ + ข้อความสั้นที่ใช้ทั้งบนการ์ดและในแจ้งเตือน
// กติกาล้วน ไม่แตะฐานข้อมูล (ทดสอบด้วย node ตรง ๆ ได้ → ห้ามใช้ '@/' alias)
//
// งานส่วนใหญ่ "ติดอยู่ที่อีกฝ่าย" ไม่ได้มีนัดจริง (เจ้าของ 28 ต.ค. 69) — จึงเริ่มจาก "รอเขา"
// ที่บังคับวันตามอีกที · วันในรายการกลายเป็นวันครบกำหนดของงาน (trigger ใน DB)

export type TaskUpdateKind = 'waiting' | 'follow_up' | 'appointment' | 'note' | 'due_change'

/** ประเภทที่คนกดเพิ่มเองได้ — due_change เขียนโดย trigger ตอนเลื่อนวันจากช่องครบกำหนด */
export type ManualUpdateKind = Exclude<TaskUpdateKind, 'due_change'>

/** ต้องมีวันไหม — ตรงกับ check constraint ใน migration 20261028014843 */
export const DATE_REQUIRED: Record<ManualUpdateKind, boolean> = {
  waiting: true,
  follow_up: true,
  appointment: true,
  note: false,
}

/** "รออะไร" ที่เจอบ่อย — กดเลือกได้เลย หรือพิมพ์เอง */
export const WAITING_PRESETS = [
  'รอคำตอบ/confirm',
  'รอใบเสนอราคา',
  'รออีเมล/เอกสาร',
  'รอเขานัดวัน',
] as const

/** ปุ่มลัดวันตามอีกที (นับจากวันนี้) */
export const FOLLOW_UP_DAYS = [1, 2, 3, 5, 7] as const

export const KIND_LABEL: Record<TaskUpdateKind, string> = {
  waiting: 'รอเขา',
  follow_up: 'ตามแล้ว ยังรออยู่',
  appointment: 'นัดหมาย',
  note: 'อัปเดต',
  due_change: 'เลื่อนวัน',
}

export const KIND_EMOJI: Record<TaskUpdateKind, string> = {
  waiting: '⏳',
  follow_up: '🔁',
  appointment: '📅',
  note: '📝',
  due_change: '🗓',
}

/** สถานะล่าสุดของงาน (view task_status_line) */
export interface TaskStatusLine {
  kind: ManualUpdateKind
  waitingFor: string | null
  waitingOn: string | null
  body: string
  /** yyyy-mm-dd — วันตาม/วันนัด/วันขั้นถัดไป */
  eventDate: string | null
  /** HH:MM:SS */
  eventTime: string | null
  /** ตามไปแล้วกี่ครั้งนับจาก "รอเขา" ครั้งล่าสุด */
  followUps: number
  createdAt: string
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** 'yyyy-mm-dd' → '31 ต.ค.' */
export function thaiDay(ymd: string): string {
  const [, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return `${d} ${TH_MONTHS[m - 1]}`
}

/** 'HH:MM:SS' → '14:30' */
export const shortTime = (t: string | null) => (t ? t.slice(0, 5) : '')

/** เรื่องที่รอ + คนที่รอ เช่น "รอใบเสนอราคา (ผู้รับเหมา)" */
export function waitingText(s: Pick<TaskStatusLine, 'waitingFor' | 'waitingOn'>): string {
  const what = s.waitingFor?.trim() || 'รอคำตอบ'
  return s.waitingOn?.trim() ? `${what} (${s.waitingOn.trim()})` : what
}

/**
 * บรรทัดสั้นบอกว่างานติดอยู่ตรงไหน — บนการ์ดและในแจ้งเตือน
 *   ⏳ รอใบเสนอราคา (ผู้รับเหมา) · ตาม 31 ต.ค.
 *   ⏳ รอคำตอบ/confirm · ตามแล้ว 2 ครั้ง · ตาม 3 พ.ย.
 *   📅 นัด 2 พ.ย. 14:00 · ที่ร้าน
 *   📝 ได้ใบเสนอราคาแล้ว 45,000
 */
export function statusLineText(s: TaskStatusLine): string {
  const parts: string[] = []
  switch (s.kind) {
    case 'waiting':
    case 'follow_up':
      parts.push(`${KIND_EMOJI.waiting} ${waitingText(s)}`)
      if (s.followUps > 0) parts.push(`ตามแล้ว ${s.followUps} ครั้ง`)
      if (s.eventDate) parts.push(`ตาม ${thaiDay(s.eventDate)}`)
      break
    case 'appointment':
      parts.push(`${KIND_EMOJI.appointment} นัด ${s.eventDate ? thaiDay(s.eventDate) : ''}${s.eventTime ? ` ${shortTime(s.eventTime)}` : ''}`.trimEnd())
      if (s.body.trim()) parts.push(s.body.trim())
      break
    case 'note':
      parts.push(`${KIND_EMOJI.note} ${s.body.trim() || 'อัปเดต'}`)
      if (s.eventDate) parts.push(`ถัดไป ${thaiDay(s.eventDate)}`)
      break
  }
  return parts.join(' · ')
}

/** 'yyyy-mm-dd' + n วัน (ไม่ผ่าน toISOString — เที่ยงคืนไทยจะกลายเป็นเมื่อวานใน UTC) */
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
