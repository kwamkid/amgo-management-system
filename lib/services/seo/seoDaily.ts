// lib/services/seo/seoDaily.ts
//
// งาน SEO รายวัน — cron-job.org ตี 4 → /api/cron/seo/gsc-daily → ลงคิวกลางแล้วจบ (ตอบใน ~2 วิ)
// เจ้าของขอ 6 ต.ค. 69: cron ตัวเดียวพอ · 8 ต.ค. 69: ทุกงานใช้คิวจริง (lib/queue)
//
// ชุดงานของวัน (group 'seo-daily:<วันที่>') — ตัวรันคิวทำต่อเองทีละชิ้น ไม่ติดเพดาน 60 วิ อีก:
//   seo.gsc        เว็บละงาน
//   seo.rank.post  ส่งคำที่ถึงรอบ/ต้องเช็คซ้ำ (ผลกลับมาเองทาง pingback + งานเก็บผลสำรอง)
//   seo.bing       ยอด Bing (ข้ามถ้าไม่มี key)
//   seo.aeo.ask    ถาม AI ข้อละงาน (เฉพาะคู่ที่ถึงรอบ · เช็คงบทั้งชุดก่อน)
//   seo.digest     สรุปเข้า Discord หลังชุดนี้จบ
//   queue.prune    ล้างประวัติคิวเก่า

import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueue, type QueueJobInput } from '@/lib/queue/queue'
import { hasDataForSeoCredentials } from './dataforseo'
import { planAeo } from './aeoSync'
import { AEO_ENGINES } from './aeo'

const bangkokDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  )

const engineLabel = (k: string) => AEO_ENGINES.find((e) => e.key === k)?.label ?? k

export async function enqueueSeoDaily(sb: SupabaseClient) {
  const groupKey = `seo-daily:${bangkokDate()}`

  // กันลงซ้ำ (cron-job.org ยิงซ้ำ / กดรันเอง) — ชุดของวันนี้มีแล้วก็จบ
  const { count } = await sb.from('queue_jobs').select('id', { count: 'exact', head: true }).eq('group_key', groupKey)
  if (count) return { groupKey, queued: 0, note: 'ลงคิวของวันนี้ไปแล้ว' }

  const { data: sites } = await sb.from('seo_sites').select('id, display_name').eq('is_active', true)
  const jobs: QueueJobInput[] = (sites ?? []).map((s) => ({
    kind: 'seo.gsc',
    payload: { siteId: s.id },
    groupKey,
    label: `ดึง GSC · ${s.display_name}`,
    priority: 3,
  }))

  const skipped: string[] = []
  if (hasDataForSeoCredentials()) {
    jobs.push({ kind: 'seo.rank.post', groupKey, label: 'ส่งเช็คอันดับคำที่ถึงรอบ', priority: 4 })
    const aeo = await planAeo(sb)
    skipped.push(...aeo.skipped)
    jobs.push(
      ...aeo.due.map((d) => ({
        kind: 'seo.aeo.ask',
        payload: { promptId: d.promptId, engine: d.engine },
        groupKey,
        label: `${engineLabel(d.engine)} · ${d.prompt}`,
        priority: 6,
      }))
    )
  }
  jobs.push({ kind: 'seo.bing', groupKey, label: 'ดึงยอด Bing', priority: 5 })
  jobs.push({
    kind: 'seo.digest',
    groupKey,
    label: 'สรุปเข้า Discord',
    priority: 9,
    maxAttempts: 2,
    runAfter: new Date(Date.now() + 20 * 60_000),
  })
  jobs.push({ kind: 'queue.prune', groupKey, label: 'ล้างประวัติคิวเก่า', priority: 9 })

  await enqueue(sb, jobs)
  return { groupKey, queued: jobs.length, skipped }
}
