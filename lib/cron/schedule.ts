// lib/cron/schedule.ts
//
// ตารางงานตามเวลาทั้งหมดของระบบ — ที่เดียว (เจ้าของ 20 พ.ย. 69 "ปรับ cron ให้เป็นแบบกลาง ๆ")
// cron-job.org เหลืองานเดียว: GET /api/cron/tick ทุก 10 นาที · tick ดูตารางนี้ว่างานไหนถึงรอบ
// เพิ่มงานใหม่ = เพิ่มแถวที่นี่ (+ ตัวรันใน lib/cron/runner.ts) ไม่ต้องเข้า cron-job.org อีก
//
// กติกาล้วน ไม่แตะฐานข้อมูล (ทดสอบด้วย node ตรง ๆ ได้ → ห้ามใช้ '@/' alias)
//
// ── รอบ (slot) ────────────────────────────────────────────────────────
// daily  'HH:MM' (+ until)  → รอบละวัน · tick แรกที่เลยเวลา (และยังไม่เลย until) ได้ทำ
//                             tick หายไปบางรอบก็ตามทันในวันเดียวกัน · ไม่ข้ามไปทำวันถัดไป
// every  N นาที              → รอบละ N นาทีนับจากเที่ยงคืนไทย · tick แรกในช่วงนั้นได้ทำ
// ล็อกรอบอยู่ที่ cron_runs (primary key job+slot) — tick ซ้ำ/ชนกันได้ทำแค่ครั้งเดียว
//
// ── inline / http ─────────────────────────────────────────────────────
// inline = เรียกฟังก์ชันใน tick เลย (งานเบา ไม่เสีย invocation เพิ่ม)
// http   = ยิงไปที่ route ของงานนั้น (งานหนัก มีเวลา maxDuration ของตัวเอง)
// whenQueued = ยิงเฉพาะตอนมีงานค้างในคิว (ปกติงานเริ่มเองตอนลงคิว — tick เป็นตัวสำรอง)

export type CronWhen = { daily: string; until?: string } | { every: number }

export interface CronJob {
  key: string
  label: string
  when: CronWhen
  run: 'inline' | { http: string }
  whenQueued?: boolean
}

export const CRON_JOBS: CronJob[] = [
  // คน
  { key: 'auto-checkout', label: 'ปิดกะให้คนที่ลืมเช็คเอาท์', when: { daily: '00:05', until: '06:00' }, run: 'inline' },
  { key: 'checkout-reminder', label: 'เตือนให้เช็คเอาท์ (push)', when: { every: 30 }, run: 'inline' },
  { key: 'task-reminders', label: 'เตือนงานรายวัน (push)', when: { daily: '08:30', until: '20:00' }, run: 'inline' },
  { key: 'birthday', label: 'อวยพรวันเกิด (Discord)', when: { daily: '09:30', until: '21:00' }, run: 'inline' },
  // ตัดยอดต้องจบในวันนั้น — ข้ามเที่ยงคืนแล้ว "วันนี้" เปลี่ยน ห้ามตามทำ
  { key: 'payroll-cutoff', label: 'ตัดยอดเงินเดือน', when: { daily: '23:30', until: '23:59' }, run: 'inline' },
  { key: 'cleanup-photos', label: 'ลบรูปเก่าเกิน 60 วัน + เสียงเก่า', when: { daily: '03:30', until: '08:00' }, run: { http: '/api/cron/cleanup-photos' } },
  // เว็บ
  { key: 'web-nightly', label: 'ตรวจเว็บประจำคืน', when: { daily: '02:00', until: '06:00' }, run: { http: '/api/web/nightly' } },
  { key: 'web-expiry', label: 'เตือนวันหมดอายุ โดเมน/โฮสต์/SSL', when: { daily: '09:00', until: '18:00' }, run: { http: '/api/web/expiry' } },
  { key: 'web-uptime', label: 'เช็คเว็บล่ม', when: { every: 180 }, run: { http: '/api/web/uptime' } },
  { key: 'web-jobs', label: 'ไล่คิวงานเว็บ + คิวกลาง (สำรอง)', when: { every: 10 }, run: { http: '/api/web/jobs/next' }, whenQueued: true },
  // SEO
  { key: 'seo-daily', label: 'SEO รายวัน: GSC + อันดับ + AEO + Bing', when: { daily: '04:00', until: '08:00' }, run: { http: '/api/cron/seo/gsc-daily' } },
]

const BKK_OFFSET_MS = 7 * 3_600_000
const pad = (n: number) => String(n).padStart(2, '0')
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** เวลาไทยตอนนี้: วันที่ + นาทีนับจากเที่ยงคืน */
export function bangkokNow(now: Date): { date: string; min: number } {
  const t = new Date(now.getTime() + BKK_OFFSET_MS)
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    min: t.getUTCHours() * 60 + t.getUTCMinutes(),
  }
}

/** รอบปัจจุบันของงานนี้ — null = ยังไม่ถึง / เลยกรอบเวลาของวันนี้แล้ว */
export function slotFor(job: CronJob, now: Date): string | null {
  const { date, min } = bangkokNow(now)
  if ('daily' in job.when) {
    if (min < toMin(job.when.daily)) return null
    if (job.when.until && min > toMin(job.when.until)) return null
    return date
  }
  const start = Math.floor(min / job.when.every) * job.when.every
  return `${date}T${pad(Math.floor(start / 60))}:${pad(start % 60)}`
}

/** งานที่อยู่ในรอบตอนนี้ (ยังไม่รู้ว่าทำไปหรือยัง — ล็อกที่ cron_runs ตัดสิน) */
export function currentSlots(now: Date, jobs: CronJob[] = CRON_JOBS): { job: CronJob; slot: string }[] {
  return jobs.flatMap((job) => {
    const slot = slotFor(job, now)
    return slot ? [{ job, slot }] : []
  })
}
