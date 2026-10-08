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

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSerpTask, parseSerp, postSerpTasks, type Device } from './dataforseo'
import { sendWebAlert } from '@/lib/services/web/webAlerts'
import { DROP_CONFIRM_ROUNDS, missStreak, needsDropRecheck, MIN_SAMPLES_TO_SAY_NONE } from './rankRules'

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
  const { data } = await sb.from('seo_settings').select('monthly_budget_usd, rank_device, rank_samples').maybeSingle()
  return {
    budget: Number(data?.monthly_budget_usd ?? 10),
    device: (data?.rank_device ?? 'mobile') as Device,
    samples: Math.max(1, Math.min(5, data?.rank_samples ?? 1)),
  }
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

export type RankEvent = {
  siteId: string
  site: string
  keyword: string
  kind: 'top10' | 'dropped' | 'aio_cited' | 'aio_lost'
  from: number | null
  to: number | null
}

type PendingTask = {
  task_id: string
  keyword_id: string
  device: string
  posted_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seo_keywords: any
}

const TASK_SELECT = 'task_id, keyword_id, device, posted_at, seo_keywords(keyword, site_id, seo_sites(domain, display_name))'

/**
 * เก็บผลงานเดียว — รวมเข้าแถวของวันนั้นด้วย seo_merge_rank_sample (atomic: ตัวอย่างของคำเดียวกัน
 * มาพร้อมกันได้จาก pingback ไม่ทับกัน) · คืน 'done' | 'waiting' | 'failed' + event ถ้าเป็นตัวอย่างสุดท้ายของคำ
 */
async function collectTask(
  sb: SupabaseClient,
  t: PendingTask
): Promise<{ state: 'done' | 'waiting' | 'failed'; events: RankEvent[] }> {
  const domain = t.seo_keywords?.seo_sites?.domain as string | undefined
  const r = await getSerpTask(t.task_id)
  if (r.state === 'pending') {
    if (Date.now() - new Date(t.posted_at).getTime() > TASK_EXPIRE_MS) {
      await sb.from('seo_rank_tasks').update({ status: 'failed', error: 'รอเกิน 3 วัน' }).eq('task_id', t.task_id)
      return { state: 'failed', events: [] }
    }
    return { state: 'waiting', events: [] }
  }
  if (r.state === 'failed' || !domain) {
    await sb
      .from('seo_rank_tasks')
      .update({ status: 'failed', error: r.state === 'failed' ? r.error : 'ไม่พบโดเมนของเว็บ' })
      .eq('task_id', t.task_id)
    return { state: 'failed', events: [] }
  }

  const p = parseSerp(r.items, domain)
  // วันที่ส่งงาน ไม่ใช่วันที่มาเก็บ — DataForSEO ค้นให้ภายในไม่กี่นาทีหลังส่ง
  // ส่วน cron มาเก็บผลวันถัดไป ถ้าใช้วันเก็บ อันดับจะเลื่อนไปผิดวันหนึ่งวัน
  const checkedOn = bangkokDate(new Date(t.posted_at))
  const { error } = await sb.rpc('seo_merge_rank_sample', {
    p_keyword: t.keyword_id,
    p_checked_on: checkedOn,
    p_device: t.device,
    p_position: p.position,
    p_ranked_url: p.rankedUrl,
    p_has_aio: p.hasAiOverview,
    p_aio_cites: p.aiOverviewCitesUs,
    p_aio_refs: p.aiOverviewRefs,
    p_top: p.topCompetitors,
    p_organic_seen: p.organicSeen,
    p_features: p.features,
  })
  if (error) throw new Error(`บันทึกอันดับไม่ได้: ${error.message}`)

  // ปิดงานแบบมีเงื่อนไข — ถ้ามีอีกรอบเก็บงานนี้ไปแล้ว (pingback + หน้าเว็บพร้อมกัน) ไม่นับซ้ำ
  const { data: closed } = await sb
    .from('seo_rank_tasks')
    .update({ status: 'done' })
    .eq('task_id', t.task_id)
    .eq('status', 'pending')
    .select('task_id')
  if (!closed?.length) return { state: 'done', events: [] }

  // แจ้งเตือนเมื่อตัวอย่างสุดท้ายของคำนี้มาครบ — เทียบอันดับดีสุดของวันกับรอบก่อน
  const { count } = await sb
    .from('seo_rank_tasks')
    .select('task_id', { count: 'exact', head: true })
    .eq('keyword_id', t.keyword_id)
    .eq('status', 'pending')
  if (count) return { state: 'done', events: [] }
  return { state: 'done', events: await rankEvents(sb, t, checkedOn) }
}

/** แถว 35 วันก่อนหน้า — ไว้ตัดสินว่า "ติดหน้าแรกใหม่" / "หลุดจริง" ไม่ใช่แค่ผลแกว่ง */
const EVENT_HISTORY_DAYS = 35

/** เทียบแถววันนี้ (รวมทุกตัวอย่างแล้ว) กับประวัติก่อนหน้า */
async function rankEvents(sb: SupabaseClient, t: PendingTask, checkedOn: string): Promise<RankEvent[]> {
  const siteId = t.seo_keywords?.site_id ?? ''
  const site = t.seo_keywords?.seo_sites?.display_name ?? t.seo_keywords?.seo_sites?.domain ?? ''
  const keyword = t.seo_keywords?.keyword ?? ''
  const since = bangkokDate(new Date(new Date(`${checkedOn}T00:00:00+07:00`).getTime() - EVENT_HISTORY_DAYS * 864e5))
  const { data: rows } = await sb
    .from('seo_rank_snapshots')
    .select('checked_on, position, ai_overview_cites_us, top_competitors')
    .eq('keyword_id', t.keyword_id)
    .eq('device', t.device)
    .lte('checked_on', checkedOn)
    .gte('checked_on', since)
    .order('checked_on', { ascending: false })
  const [cur, prevRow] = rows ?? []
  if (!cur || cur.checked_on !== checkedOn || !prevRow) return []
  const events: RankEvent[] = []
  const base = { siteId, site, keyword }
  const positions = (rows ?? []).map((r) => r.position as number | null)
  const to = cur.position
  // ติดหน้าแรกใหม่ = 35 วันก่อนหน้าไม่เคยติดหน้าแรกเลย (เคยติดแล้วแค่หายไปรอบเดียวแล้วกลับมา = ผลแกว่ง ไม่แจ้ง)
  const wasTop10 = positions.slice(1).some((p) => p != null && p <= 10)
  if (to != null && to <= 10 && !wasTop10) events.push({ ...base, kind: 'top10', from: prevRow.position, to })
  // หลุดหน้าแรก = ไม่เจอครบ DROP_CONFIRM_ROUNDS รอบติดพอดีรอบนี้ (แจ้งครั้งเดียว) และก่อนนั้นติดหน้าแรก
  const { misses, before } = missStreak(positions)
  if (misses === DROP_CONFIRM_ROUNDS && before != null && before <= 10)
    events.push({ ...base, kind: 'dropped', from: before, to })
  // ประวัติที่นำเข้าไม่มีข้อมูล AI → ไม่เทียบ AI
  if (prevRow.top_competitors != null) {
    const from = prevRow.position
    if (cur.ai_overview_cites_us && !prevRow.ai_overview_cites_us) events.push({ ...base, kind: 'aio_cited', from, to })
    if (!cur.ai_overview_cites_us && prevRow.ai_overview_cites_us) events.push({ ...base, kind: 'aio_lost', from, to })
  }
  return events
}

/**
 * เก็บผลงานที่ค้าง (cron / หน้าเว็บ) · taskIds = เฉพาะงานที่ DataForSEO แจ้งว่าเสร็จ (pingback)
 * คืน events (ติดหน้าแรก/หลุดจริง/AI เริ่ม-เลิกอ้าง) ไว้แจ้ง Discord
 */
export async function collectRanks(sb: SupabaseClient, deadline: number, opts: { taskIds?: string[] } = {}) {
  let q = sb.from('seo_rank_tasks').select(TASK_SELECT).eq('status', 'pending')
  if (opts.taskIds) q = q.in('task_id', opts.taskIds)
  const { data: tasks } = await q.order('posted_at').limit(COLLECT_LIMIT)

  let done = 0
  let waiting = 0
  let failed = 0
  const events: RankEvent[] = []
  const handle = async (t: PendingTask) => {
    const r = await collectTask(sb, t)
    if (r.state === 'done') done++
    else if (r.state === 'waiting') waiting++
    else failed++
    events.push(...r.events)
  }

  // ถามผลพร้อมกันทีละ 8 งาน — ทีละงานใช้ ~1 วิ ไม่ทันเวลาที่เหลือหลังดึง GSC
  const list = (tasks ?? []) as PendingTask[]
  for (let i = 0; i < list.length && Date.now() < deadline; i += COLLECT_CONCURRENCY) {
    await Promise.all(list.slice(i, i + COLLECT_CONCURRENCY).map(handle))
  }
  return { done, waiting, failed, events }
}

/** URL ที่ DataForSEO เรียกกลับเมื่องานเสร็จ — null = ไม่มีโดเมนแอป/secret (เช่นตอน dev) ใช้การถามผลแทน */
export function rankPingbackUrl() {
  const app = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.CRON_SECRET
  if (!app || !secret || app.includes('localhost')) return null
  // $id / $tag DataForSEO แทนค่าให้เอง · token แยกจาก CRON_SECRET (ไม่ส่ง secret จริงออกไปนอกระบบ)
  return `${app}/api/seo/dataforseo-ping?id=$id&t=${pingToken()}`
}

export function pingToken() {
  return createHash('sha256')
    .update(`${process.env.CRON_SECRET ?? ''}:dataforseo-ping`)
    .digest('hex')
    .slice(0, 32)
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
  const { budget, device, samples } = await settings(sb)

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
      .select('keyword_id, checked_on, position, samples, hits')
      .eq('device', device)
      .in('keyword_id', ids)
      .order('checked_on', { ascending: false }),
  ])
  const hasPending = new Set((pending ?? []).map((p) => p.keyword_id))
  const lastChecked = new Map<string, string>()
  // รอบล่าสุดต่อคำ — ไว้ดูว่ากำลังไม่เจอแต่ยังไม่ครบรอบยืนยัน (ต้องเช็คซ้ำ) ไหม
  const lastRounds = new Map<string, (number | null)[]>()
  // หลักฐาน 35 วันล่าสุด — ยังไม่เคยเจอเลยแต่เช็คไม่ถึง 3 ครั้ง = "ยังไม่แน่ใจ" → เช็คเพิ่มวันละครั้ง
  const evidenceSince = bangkokDate(new Date(Date.now() - 35 * 864e5))
  const evidence = new Map<string, { samples: number; hits: number }>()
  for (const s of latest ?? []) {
    if (s.checked_on < evidenceSince) continue
    const e = evidence.get(s.keyword_id) ?? { samples: 0, hits: 0 }
    evidence.set(s.keyword_id, { samples: e.samples + s.samples, hits: e.hits + s.hits })
  }
  for (const s of latest ?? []) {
    if (!lastChecked.has(s.keyword_id)) lastChecked.set(s.keyword_id, s.checked_on)
    const rounds = lastRounds.get(s.keyword_id) ?? []
    if (rounds.length <= DROP_CONFIRM_ROUNDS) lastRounds.set(s.keyword_id, [...rounds, s.position])
  }

  const today = bangkokDate()
  const cutoff = bangkokDate(new Date(Date.now() - (RECHECK_DAYS - 1) * 24 * 3600_000))
  let nPending = 0
  let nToday = 0
  let nFresh = 0
  let nRecheck = 0
  let nConfirm = 0
  const due = keywords.filter((k) => {
    if (hasPending.has(k.id)) return nPending++, false
    const last = lastChecked.get(k.id)
    if (last === today) return nToday++, false
    // ไม่เจอแต่ยังไม่ครบรอบยืนยัน = เช็คซ้ำวันถัดไปเลย ไม่รอครบ 7 วัน (ผล SERP แกว่ง อย่าเพิ่งเชื่อรอบเดียว)
    if (needsDropRecheck(lastRounds.get(k.id) ?? [])) return nRecheck++, true
    const ev = evidence.get(k.id)
    if (ev && !ev.hits && ev.samples < MIN_SAMPLES_TO_SAY_NONE) return nConfirm++, true
    if (!opts.force && last && last > cutoff) return nFresh++, false
    return true
  })
  if (nPending) skipped.push(`${nPending} คำมีงานรอผลอยู่แล้ว`)
  if (nToday) skipped.push(`${nToday} คำเช็คไปแล้ววันนี้`)
  if (nFresh) skipped.push(`${nFresh} คำเช็คไปไม่ถึง ${RECHECK_DAYS} วัน`)
  if (nRecheck) skipped.push(`${nRecheck} คำรอบก่อนไม่เจอ — เช็คซ้ำให้ครบ ${DROP_CONFIRM_ROUNDS} รอบก่อนสรุปว่าหลุด`)
  if (nConfirm) skipped.push(`${nConfirm} คำยังไม่แน่ใจ (ไม่เจอแต่เช็คไม่ถึง ${MIN_SAMPLES_TO_SAY_NONE} ครั้ง) — เช็คเพิ่ม`)
  if (!due.length) return { posted: 0, costUsd: 0, skipped }

  const spent = await monthSpend(sb)
  const estimate = due.length * samples * (await costPerTask(sb))
  if (spent + estimate > budget) {
    skipped.push(
      `ไม่ส่ง ${due.length} คำ (×${samples} ครั้ง) — ใช้ไปแล้ว $${spent.toFixed(2)} + รอบนี้ ~$${estimate.toFixed(2)} เกินเพดาน $${budget.toFixed(2)}/เดือน`
    )
    await alertBudgetOnce(sb, spent, budget)
    return { posted: 0, costUsd: 0, skipped }
  }

  // คำละหลายตัวอย่าง — Google เสิร์ฟผลหลายชุดสลับกัน ค้นครั้งเดียวอาจได้ชุดที่ไม่มีเรา
  const { posted, failed } = await postSerpTasks(
    due.flatMap((k) => Array.from({ length: samples }, () => ({ keyword: k.keyword, tag: k.id }))),
    device,
    rankPingbackUrl()
  )
  const cost = posted.reduce((s, p) => s + p.cost, 0)
  if (posted.length) {
    await sb.from('seo_rank_tasks').insert(posted.map((p) => ({ task_id: p.taskId, keyword_id: p.tag, device })))
    await sb.from('seo_api_costs').insert({
      provider: 'dataforseo',
      endpoint: 'serp/task_post',
      units: posted.length,
      cost_usd: cost,
      note: `อันดับ ${device} ${due.length} คำ × ${samples} ครั้ง`,
    })
  }
  if (failed.length) skipped.push(`ส่งไม่สำเร็จ ${failed.length} คำ: ${failed[0].error}`)
  return { posted: Math.round(posted.length / samples), costUsd: cost, skipped }
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
