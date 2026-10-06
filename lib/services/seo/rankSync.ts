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
import { isSuspiciousDrop } from './rankRules'

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
    samples: Math.max(1, Math.min(5, data?.rank_samples ?? 3)),
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
  site: string
  keyword: string
  kind: 'top10' | 'dropped' | 'aio_cited' | 'aio_lost'
  from: number | null
  to: number | null
}

/** ผลของงานเดียวที่ได้มาแล้ว — รอรวมกับงานอื่นของคำเดียวกันวันเดียวกัน */
type Sample = { taskId: string; keywordId: string; device: string; checkedOn: string; site: string; keyword: string; p: ReturnType<typeof parseSerp> }

/**
 * เก็บผลงานที่ค้าง · คำหนึ่งส่งหลายตัวอย่าง (rank_samples) → รวมเป็นแถวเดียวต่อวัน:
 * อันดับ = ดีสุดที่เจอ · hits = เจอเรากี่ครั้ง · AI Overview = มีในตัวอย่างไหนก็นับ
 * คืน events (ติดหน้าแรก/หลุดจริง/AI เริ่ม-เลิกอ้าง) ไว้แจ้ง Discord
 */
export async function collectRanks(sb: SupabaseClient, deadline: number) {
  const { data: tasks } = await sb
    .from('seo_rank_tasks')
    .select('task_id, keyword_id, device, posted_at, seo_keywords(keyword, seo_sites(domain, display_name))')
    .eq('status', 'pending')
    .order('posted_at')
    .limit(COLLECT_LIMIT)

  let waiting = 0
  let failed = 0
  const samples: Sample[] = []

  type Task = NonNullable<typeof tasks>[number]
  const handle = async (t: Task) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kw = t.seo_keywords as any
    const domain = kw?.seo_sites?.domain as string | undefined
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
    samples.push({
      taskId: t.task_id,
      keywordId: t.keyword_id,
      device: t.device,
      // วันที่ส่งงาน ไม่ใช่วันที่มาเก็บ — DataForSEO ค้นให้ภายในไม่กี่นาทีหลังส่ง
      // ส่วน cron มาเก็บผลวันถัดไป ถ้าใช้วันเก็บ อันดับจะเลื่อนไปผิดวันหนึ่งวัน
      checkedOn: bangkokDate(new Date(t.posted_at)),
      site: kw?.seo_sites?.display_name ?? domain,
      keyword: kw?.keyword ?? '',
      p: parseSerp(r.items, domain),
    })
  }

  // ถามผลพร้อมกันทีละ 8 งาน — ทีละงานใช้ ~1 วิ ไม่ทันเวลาที่เหลือหลังดึง GSC
  const list = tasks ?? []
  for (let i = 0; i < list.length && Date.now() < deadline; i += COLLECT_CONCURRENCY) {
    await Promise.all(list.slice(i, i + COLLECT_CONCURRENCY).map(handle))
  }

  // รวมตัวอย่างของคำเดียวกันวันเดียวกัน (รวมกับที่บันทึกไว้แล้วจากรอบก่อน ถ้ามี)
  const groups = new Map<string, Sample[]>()
  for (const x of samples) {
    const key = `${x.keywordId}|${x.checkedOn}|${x.device}`
    groups.set(key, [...(groups.get(key) ?? []), x])
  }
  const events: RankEvent[] = []
  for (const group of groups.values()) {
    const { keywordId, checkedOn, device, site, keyword } = group[0]
    const [{ data: existing }, { data: prevRows }] = await Promise.all([
      sb
        .from('seo_rank_snapshots')
        .select('position, ranked_url, has_ai_overview, ai_overview_cites_us, ai_overview_refs, top_competitors, samples, hits')
        .eq('keyword_id', keywordId)
        .eq('checked_on', checkedOn)
        .eq('device', device)
        .maybeSingle(),
      sb
        .from('seo_rank_snapshots')
        .select('position, ai_overview_cites_us, has_ai_overview, top_competitors')
        .eq('keyword_id', keywordId)
        .eq('device', device)
        .lt('checked_on', checkedOn)
        .order('checked_on', { ascending: false })
        .limit(2),
    ])
    const [prevRow, prev2] = prevRows ?? []
    // ตัวอย่างที่เจอเราอันดับดีสุดเป็นตัวหลัก (คู่แข่ง/AI Overview เอาจากตัวนั้น)
    const sorted = [...group].sort((a, b) => (a.p.position ?? 999) - (b.p.position ?? 999))
    const best = sorted[0].p
    const prevSamples = existing?.samples ?? 0
    const keepExisting = existing && (existing.position ?? 999) <= (best.position ?? 999)
    const merged = {
      keyword_id: keywordId,
      checked_on: checkedOn,
      device,
      position: keepExisting ? existing!.position : best.position,
      ranked_url: keepExisting ? existing!.ranked_url : best.rankedUrl,
      has_ai_overview: !!existing?.has_ai_overview || group.some((g) => g.p.hasAiOverview),
      ai_overview_cites_us: !!existing?.ai_overview_cites_us || group.some((g) => g.p.aiOverviewCitesUs),
      ai_overview_refs: keepExisting ? existing!.ai_overview_refs : best.aiOverviewRefs,
      top_competitors: keepExisting ? existing!.top_competitors : best.topCompetitors,
      samples: prevSamples + group.length,
      hits: (existing?.hits ?? 0) + group.filter((g) => g.p.position != null).length,
    }
    const { error } = await sb.from('seo_rank_snapshots').upsert(merged, { onConflict: 'keyword_id,checked_on,device' })
    if (error) throw new Error(`บันทึกอันดับไม่ได้: ${error.message}`)
    await sb
      .from('seo_rank_tasks')
      .update({ status: 'done' })
      .in('task_id', group.map((g) => g.taskId))

    // แจ้งเตือนเฉพาะรอบแรกของวันนั้น (กันแจ้งซ้ำตอนตัวอย่างทยอยมา) · ประวัติที่นำเข้าไม่มีข้อมูล AI → ไม่เทียบ AI
    if (!existing && prevRow) {
      const from = prevRow.position
      const to = merged.position
      if (to != null && to <= 10 && (from == null || from > 10)) events.push({ site, keyword, kind: 'top10', from, to })
      const bad = to == null || to > 20
      // หลุดหน้าแรก — ร่วงหนักรอบแรกยังไม่แจ้ง (อาจแค่ Google สลับชุดผล) รอรอบเช็คซ้ำยืนยันก่อน
      const prevWasSuspect = !!prev2 && isSuspiciousDrop(from, prev2.position)
      if (prevWasSuspect && bad && prev2.position != null && prev2.position <= 10)
        events.push({ site, keyword, kind: 'dropped', from: prev2.position, to })
      else if (from != null && from <= 10 && bad && !isSuspiciousDrop(to, from))
        events.push({ site, keyword, kind: 'dropped', from, to })
      if (prevRow.top_competitors != null) {
        if (merged.ai_overview_cites_us && !prevRow.ai_overview_cites_us)
          events.push({ site, keyword, kind: 'aio_cited', from, to })
        if (!merged.ai_overview_cites_us && prevRow.ai_overview_cites_us)
          events.push({ site, keyword, kind: 'aio_lost', from, to })
      }
    }
  }
  return { done: samples.length, waiting, failed, events }
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
      .select('keyword_id, checked_on, position')
      .eq('device', device)
      .in('keyword_id', ids)
      .order('checked_on', { ascending: false }),
  ])
  const hasPending = new Set((pending ?? []).map((p) => p.keyword_id))
  const lastChecked = new Map<string, string>()
  // 2 รอบล่าสุดต่อคำ — ไว้ดูว่ารอบล่าสุดร่วงหนักจนต้องเช็คซ้ำไหม
  const lastTwo = new Map<string, (number | null)[]>()
  for (const s of latest ?? []) {
    if (!lastChecked.has(s.keyword_id)) lastChecked.set(s.keyword_id, s.checked_on)
    const two = lastTwo.get(s.keyword_id) ?? []
    if (two.length < 2) lastTwo.set(s.keyword_id, [...two, s.position])
  }

  const today = bangkokDate()
  const cutoff = bangkokDate(new Date(Date.now() - (RECHECK_DAYS - 1) * 24 * 3600_000))
  let nPending = 0
  let nToday = 0
  let nFresh = 0
  let nRecheck = 0
  const due = keywords.filter((k) => {
    if (hasPending.has(k.id)) return nPending++, false
    const last = lastChecked.get(k.id)
    if (last === today) return nToday++, false
    // รอบล่าสุดร่วงหนัก = เช็คซ้ำวันถัดไปเลย ไม่รอครบ 7 วัน (ผล SERP แกว่ง อย่าเพิ่งเชื่อรอบเดียว)
    const [cur, prev] = lastTwo.get(k.id) ?? []
    if (prev !== undefined && isSuspiciousDrop(cur ?? null, prev)) return nRecheck++, true
    if (!opts.force && last && last > cutoff) return nFresh++, false
    return true
  })
  if (nPending) skipped.push(`${nPending} คำมีงานรอผลอยู่แล้ว`)
  if (nToday) skipped.push(`${nToday} คำเช็คไปแล้ววันนี้`)
  if (nFresh) skipped.push(`${nFresh} คำเช็คไปไม่ถึง ${RECHECK_DAYS} วัน`)
  if (nRecheck) skipped.push(`${nRecheck} คำร่วงหนักรอบก่อน — เช็คซ้ำยืนยัน`)
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
