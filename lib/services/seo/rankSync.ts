// lib/services/seo/rankSync.ts
//
// อันดับคำเป้าหมาย — ส่งงานเข้าคิว DataForSEO แล้วเก็บผลกลับมา
//
// ── จังหวะ ─────────────────────────────────────────────────────────────
// งาน SEO รายวัน (cron ตี 4 ตัวเดียวกับ GSC — ดู seoDaily.ts):
//                  1) เก็บผลงานที่ค้างอยู่ (task_get ฟรี) — ปกติคืองานที่ส่งเมื่อวาน
//                  2) ส่งงานใหม่ เฉพาะคำที่ผลล่าสุดเก่ากว่า 7 วัน = รายสัปดาห์
// ปุ่มบนหน้าเว็บ:   ส่งเช็คทันทีทั้งเว็บ (ข้ามคำที่เช็ควันนี้แล้ว/มีงานค้าง)
//
// ── เงิน ──────────────────────────────────────────────────────────────
// ก่อนส่งทุกครั้ง: ยอดเดือนนี้ + ประมาณการรอบนี้ ต้องไม่เกินเพดาน (seo_settings)
// เกิน = ไม่ส่งเลยทั้งรอบ + แจ้ง Discord ครั้งเดียวต่อเดือน
// ประมาณการใช้ราคาจริงล่าสุดที่จ่ายไป (ไม่มีประวัติ = ใช้ค่าเผื่อสูงไว้ก่อน)

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSerpTask, parseSerp, postSerpTasks, type Device } from './dataforseo'
import { sendWebAlert } from '@/lib/services/web/webAlerts'

/** เช็คซ้ำเมื่อผลล่าสุดเก่ากว่ากี่วัน */
const RECHECK_DAYS = 7
/** ยังไม่มีประวัติราคา — เผื่อไว้สูงกว่าราคาจริง (~$0.0006–0.002) */
const FALLBACK_COST_PER_TASK = 0.003
/** งานที่ค้างนานกว่านี้ถือว่าหาย ไม่ต้องถามต่อ */
const TASK_EXPIRE_MS = 3 * 24 * 3600_000
/** เก็บผลรอบละไม่เกินเท่านี้ — กันเกินเวลา Vercel */
const COLLECT_LIMIT = 120
const COLLECT_CONCURRENCY = 8
export const RANK_BUDGET_MS = 45_000

const bangkokDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

/** เริ่มเดือนนี้ (เวลาไทย) เป็น ISO */
function monthStartIso() {
  const [y, m] = bangkokDate().split('-')
  return new Date(`${y}-${m}-01T00:00:00+07:00`).toISOString()
}

export async function monthSpend(sb: SupabaseClient) {
  const { data } = await sb.from('seo_api_costs').select('cost_usd').gte('created_at', monthStartIso())
  return (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0)
}

async function settings(sb: SupabaseClient) {
  const { data } = await sb.from('seo_settings').select('monthly_budget_usd, rank_device').maybeSingle()
  return { budget: Number(data?.monthly_budget_usd ?? 10), device: (data?.rank_device ?? 'mobile') as Device }
}

async function costPerTask(sb: SupabaseClient) {
  const { data } = await sb
    .from('seo_api_costs')
    .select('cost_usd, units')
    .eq('endpoint', 'serp/task_post')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data && data.units ? Number(data.cost_usd) / data.units : FALLBACK_COST_PER_TASK
}

// ── เก็บผล ─────────────────────────────────────────────────────────────

export async function collectRanks(sb: SupabaseClient, deadline: number) {
  const { data: tasks } = await sb
    .from('seo_rank_tasks')
    .select('task_id, keyword_id, device, posted_at, seo_keywords(keyword, seo_sites(domain))')
    .eq('status', 'pending')
    .order('posted_at')
    .limit(COLLECT_LIMIT)

  let done = 0
  let waiting = 0
  let failed = 0

  type Task = NonNullable<typeof tasks>[number]
  const handle = async (t: Task) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain = (t.seo_keywords as any)?.seo_sites?.domain as string | undefined
    const r = await getSerpTask(t.task_id)
    if (r.state === 'pending') {
      if (Date.now() - new Date(t.posted_at).getTime() > TASK_EXPIRE_MS) {
        await sb.from('seo_rank_tasks').update({ status: 'failed', error: 'รอเกิน 3 วัน' }).eq('task_id', t.task_id)
        failed++
      } else waiting++
      return
    }
    if (r.state === 'failed' || !domain) {
      await sb
        .from('seo_rank_tasks')
        .update({ status: 'failed', error: r.state === 'failed' ? r.error : 'ไม่พบโดเมนของเว็บ' })
        .eq('task_id', t.task_id)
      failed++
      return
    }
    const p = parseSerp(r.items, domain)
    const { error } = await sb.from('seo_rank_snapshots').upsert(
      {
        keyword_id: t.keyword_id,
        // วันที่ส่งงาน ไม่ใช่วันที่มาเก็บ — DataForSEO ค้นให้ภายในไม่กี่นาทีหลังส่ง
        // ส่วน cron มาเก็บผลวันถัดไป ถ้าใช้วันเก็บ อันดับจะเลื่อนไปผิดวันหนึ่งวัน
        checked_on: bangkokDate(new Date(t.posted_at)),
        device: t.device,
        position: p.position,
        ranked_url: p.rankedUrl,
        has_ai_overview: p.hasAiOverview,
        ai_overview_cites_us: p.aiOverviewCitesUs,
        ai_overview_refs: p.aiOverviewRefs,
        top_competitors: p.topCompetitors,
      },
      { onConflict: 'keyword_id,checked_on,device' }
    )
    if (error) throw new Error(`บันทึกอันดับไม่ได้: ${error.message}`)
    await sb.from('seo_rank_tasks').update({ status: 'done' }).eq('task_id', t.task_id)
    done++
  }

  // ถามผลพร้อมกันทีละ 8 งาน — ทีละงานใช้ ~1 วิ 44 คำไม่ทันเวลาที่เหลือหลังดึง GSC
  const list = tasks ?? []
  for (let i = 0; i < list.length && Date.now() < deadline; i += COLLECT_CONCURRENCY) {
    await Promise.all(list.slice(i, i + COLLECT_CONCURRENCY).map(handle))
  }
  return { done, waiting, failed }
}

// ── ส่งงาน ─────────────────────────────────────────────────────────────

export type PostSummary = {
  posted: number
  costUsd: number
  /** เหตุผลที่ไม่ส่ง / ส่งไม่ครบ — บอกทุกข้อ */
  skipped: string[]
}

/**
 * ส่งคำที่ถึงรอบ · force = กดจากหน้าเว็บ (ไม่สนรอบ 7 วัน แต่ยังข้ามคำที่เช็ควันนี้แล้ว/มีงานค้าง)
 */
export async function postDueRanks(
  sb: SupabaseClient,
  opts: { siteId?: string; force?: boolean } = {}
): Promise<PostSummary> {
  const skipped: string[] = []
  const { budget, device } = await settings(sb)

  let q = sb.from('seo_keywords').select('id, keyword, site_id, seo_sites!inner(is_active)').eq('is_tracked', true)
  q = opts.siteId ? q.eq('site_id', opts.siteId) : q.eq('seo_sites.is_active', true)
  const { data: keywords, error } = await q
  if (error) throw new Error(error.message)
  if (!keywords?.length) return { posted: 0, costUsd: 0, skipped: ['ไม่มีคำที่เปิดติดตาม'] }

  const ids = keywords.map((k) => k.id)
  const [{ data: pending }, { data: latest }] = await Promise.all([
    sb.from('seo_rank_tasks').select('keyword_id').eq('status', 'pending').in('keyword_id', ids),
    sb
      .from('seo_rank_snapshots')
      .select('keyword_id, checked_on')
      .eq('device', device)
      .in('keyword_id', ids)
      .order('checked_on', { ascending: false }),
  ])
  const hasPending = new Set((pending ?? []).map((p) => p.keyword_id))
  const lastChecked = new Map<string, string>()
  for (const s of latest ?? []) if (!lastChecked.has(s.keyword_id)) lastChecked.set(s.keyword_id, s.checked_on)

  const today = bangkokDate()
  const cutoff = bangkokDate(new Date(Date.now() - (RECHECK_DAYS - 1) * 24 * 3600_000))
  let nPending = 0
  let nToday = 0
  let nFresh = 0
  const due = keywords.filter((k) => {
    if (hasPending.has(k.id)) return nPending++, false
    const last = lastChecked.get(k.id)
    if (last === today) return nToday++, false
    if (!opts.force && last && last > cutoff) return nFresh++, false
    return true
  })
  if (nPending) skipped.push(`${nPending} คำมีงานรอผลอยู่แล้ว`)
  if (nToday) skipped.push(`${nToday} คำเช็คไปแล้ววันนี้`)
  if (nFresh) skipped.push(`${nFresh} คำเช็คไปไม่ถึง ${RECHECK_DAYS} วัน`)
  if (!due.length) return { posted: 0, costUsd: 0, skipped }

  const spent = await monthSpend(sb)
  const estimate = due.length * (await costPerTask(sb))
  if (spent + estimate > budget) {
    skipped.push(
      `ไม่ส่ง ${due.length} คำ — ใช้ไปแล้ว $${spent.toFixed(2)} + รอบนี้ ~$${estimate.toFixed(2)} เกินเพดาน $${budget.toFixed(2)}/เดือน`
    )
    await alertBudgetOnce(sb, spent, budget)
    return { posted: 0, costUsd: 0, skipped }
  }

  const { posted, failed } = await postSerpTasks(
    due.map((k) => ({ keyword: k.keyword, tag: k.id })),
    device
  )
  const cost = posted.reduce((s, p) => s + p.cost, 0)
  if (posted.length) {
    await sb.from('seo_rank_tasks').insert(posted.map((p) => ({ task_id: p.taskId, keyword_id: p.tag, device })))
    await sb.from('seo_api_costs').insert({
      provider: 'dataforseo',
      endpoint: 'serp/task_post',
      units: posted.length,
      cost_usd: cost,
      note: `อันดับ ${device} ${posted.length} คำ`,
    })
  }
  if (failed.length) skipped.push(`ส่งไม่สำเร็จ ${failed.length} คำ: ${failed[0].error}`)
  return { posted: posted.length, costUsd: cost, skipped }
}

/** แจ้ง Discord ว่าชนเพดาน — เดือนละครั้ง (จดไว้ใน note ของ seo_api_costs แถวศูนย์บาท) */
async function alertBudgetOnce(sb: SupabaseClient, spent: number, budget: number) {
  const { data } = await sb
    .from('seo_api_costs')
    .select('id')
    .eq('endpoint', 'budget_alert')
    .gte('created_at', monthStartIso())
    .limit(1)
  if (data?.length) return
  await sb.from('seo_api_costs').insert({ provider: 'system', endpoint: 'budget_alert', units: 0, cost_usd: 0 })
  await sendWebAlert({
    title: '💸 SEO — ค่า DataForSEO ถึงเพดานเดือนนี้แล้ว',
    description: `ใช้ไป $${spent.toFixed(2)} จากเพดาน $${budget.toFixed(2)} · หยุดเช็คอันดับจนถึงต้นเดือนหน้า หรือเพิ่มเพดานที่หน้า ตั้งค่าเว็บ SEO`,
    color: 'amber',
  }).catch(() => {})
}
