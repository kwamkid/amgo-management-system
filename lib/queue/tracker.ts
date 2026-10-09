// lib/queue/tracker.ts
//
// ฝั่งหน้าเว็บ: จำว่าเราสั่งงานคิวอะไรไว้บ้าง เพื่อให้แผงคิวลอย (GlobalQueue) ตามไปทุกหน้า
// จนกว่าผู้ใช้จะกดปิดเอง (เจ้าของ 9 ต.ค. 69: "เปลี่ยนหน้าก็ต้องตามมา จนกว่าจะกดปิด")
//
// เก็บใน localStorage (ต่อเครื่อง ต่อเบราว์เซอร์) + ยิง event ให้แผงอัปเดตทันที
// งานเดินฝั่งเซิร์ฟเวอร์อยู่แล้ว — ตรงนี้แค่ "จะโชว์ความคืบหน้าของอะไร"
//
// ชนิด:
//   group = ชุดงานในคิวกลาง (queue_jobs.group_key) เช่น ถาม AI
//   rank  = เช็คอันดับของเว็บ (seo_rank_tasks ของ site นั้น — ผลกลับมาทาง pingback)
//   fleet = ชุดงานฟลีต (web_run_batches.id)

export type TrackedQueue = {
  id: string
  kind: 'group' | 'rank' | 'fleet'
  /** groupKey / siteId / batchId */
  ref: string
  title: string
  /** หน่วยที่นับ เช่น คำ · ข้อ · งาน */
  unit: string
  /** กดชื่อแล้วไปหน้านี้ */
  href?: string
  startedAt: number
}

const KEY = 'aoo-tracked-queues'
const EVENT = 'aoo-queues-changed'
/** เก็บนานสุดเท่านี้ ถ้าลืมกดปิด (กันค้างข้ามสัปดาห์) */
const MAX_AGE_MS = 3 * 864e5

export function listTracked(): TrackedQueue[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as TrackedQueue[]
    return all.filter((q) => Date.now() - q.startedAt < MAX_AGE_MS)
  } catch {
    return []
  }
}

function save(list: TrackedQueue[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* localStorage ใช้ไม่ได้ (โหมดส่วนตัว) — แผงยังโชว์ในหน้านี้จาก event */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** เริ่มติดตามคิว (ซ้ำ id เดิม = แทนที่ + ย้ายขึ้นบนสุด) */
export function trackQueue(q: Omit<TrackedQueue, 'id' | 'startedAt'> & { id?: string }) {
  const id = q.id ?? `${q.kind}:${q.ref}`
  const list = listTracked().filter((x) => x.id !== id)
  save([{ ...q, id, startedAt: Date.now() }, ...list])
}

export function untrackQueue(id: string) {
  save(listTracked().filter((x) => x.id !== id))
}

/** ฟังการเปลี่ยนแปลง (ในแท็บนี้ + แท็บอื่น) */
export function onTrackedChange(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb()
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}
