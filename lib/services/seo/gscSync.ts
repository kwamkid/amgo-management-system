// lib/services/seo/gscSync.ts
//
// ดึงข้อมูล GSC ลง seo_gsc_totals + seo_gsc_daily — เรียกจาก cron รายวันและปุ่มบนหน้าเว็บ
//
// ── ลำดับงานในหนึ่งรอบ ────────────────────────────────────────────────
// 1. ช่วงล่าสุด (ทุกเว็บก่อน) — ดึงย้อน 5 วันซ้ำทุกวัน เพราะ GSC ช้า 2–3 วัน
//    และข้อมูลสดยังขยับได้ · ถ้า cron หายไปหลายวัน ดึงต่อจากวันล่าสุดที่มี
// 2. ย้อนหลัง (backfill) — ยอดรวมรายวัน 16 เดือนเต็ม (ครั้งเดียวได้ทั้งก้อน ~500 แถว)
//    + คำค้น × หน้า ย้อนทีละ 14 วันจนครบ 90 วัน · จดความคืบหน้าทุกก้อน
// 3. ลบคำค้น × หน้า ที่เก่ากว่า 90 วัน
//
// ── ทำไมเก็บละเอียดแค่ 90 วัน (เจ้าของตกลง 6 ต.ค. 69) ───────────────────
// adayfresh มีวันละ ~2,000 แถว · 16 เดือน = ~1 ล้านแถว ~350 MB ซึ่งเกินแผน Free
// (500 MB ทั้งฐาน) · คำถาม "คำไหนขึ้น/ตก/ใหม่" ดูช่วงล่าสุดก็พอ ส่วนการเทียบปีก่อน
// (ฤดูกาล/เทศกาล) กับฐานก่อนเริ่มทำ SEO ใช้ยอดรวมรายวัน ซึ่งเก็บไว้ตลอดไม่ลบ
// (GSC ลบของเกิน 16 เดือนทิ้งเรื่อย ๆ ถ้าเราไม่เก็บ ฐานเดิมจะหายถาวร)
//
// ช่วงที่ดึงซ้ำ = ลบของเดิมในช่วงนั้นแล้วใส่ใหม่ (ไม่ใช่ upsert) เพราะคำค้นที่
// เคยโผล่ในข้อมูลสดอาจหายไปเมื่อข้อมูลนิ่ง — upsert จะทิ้งแถวผีค้างไว้
//
// วันที่ทั้งหมดเป็นเวลา Pacific ตาม GSC — ห้ามใช้วันไทย

import type { SupabaseClient } from '@supabase/supabase-js'
import { GSC_PAGE_SIZE, GscAccessError, searchAnalytics, type GscRow } from './gsc'
import { sendWebAlert } from '@/lib/services/web/webAlerts'

/** GSC เก็บย้อนหลัง 16 เดือน — เผื่อขอบไว้ไม่ให้ขอวันที่ GSC ไม่มีแล้ว */
const HISTORY_DAYS = 485
/** คำค้น × หน้า เก็บย้อนหลังกี่วัน */
export const DETAIL_DAYS = 90
/** ดึงซ้ำย้อนกี่วันทุกรอบ (ข้อมูลยังไม่นิ่ง) */
const RECENT_DAYS = 5
/** backfill ก้อนละกี่วัน — เล็กพอให้เขียนลง DB ทันใน 1 ก้อน */
const BACKFILL_CHUNK_DAYS = 14
/** ทั้งรอบต้องจบก่อน Vercel ตัดที่ 60 วิ */
export const RUN_BUDGET_MS = 40_000
/** เหลือเวลาไม่ถึงนี้ ไม่เริ่มก้อน backfill ใหม่ — ก้อนของ adayfresh (ยอดรวม + คำค้น 14 วัน ~25,000 แถว) ใช้ ~12–15 วิ */
const MIN_CHUNK_MS = 20_000
/** ล็อกเก่ากว่านี้ = รอบก่อนโดนตัดกลางคัน ถือว่าว่าง */
const LOCK_STALE_MS = 2 * 60_000
const INSERT_BATCH = 1000

export type SeoSiteRow = {
  id: string
  domain: string
  display_name: string
  gsc_property: string | null
  is_active: boolean
  synced_through: string | null
  backfill_from: string | null
  backfill_done: boolean
  last_error: string | null
}

export type SyncResult = {
  site: string
  status: 'ok' | 'skipped' | 'error'
  /** บอกเหตุผลเสมอ ไม่ว่าจะสำเร็จหรือข้าม */
  detail: string
}

// ── วันที่ (Pacific) ────────────────────────────────────────────────────

export function todayPacific(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const maxDate = (a: string, b: string) => (a > b ? a : b)
const minDate = (a: string, b: string) => (a < b ? a : b)

// ── ดึง + เขียน ─────────────────────────────────────────────────────────

/** ยอดรวมรายวัน — 1 request ได้ทั้งช่วง (16 เดือน = ~500 แถว ไม่ถึงเพดาน 25,000) */
async function pullTotals(sb: SupabaseClient, site: SeoSiteRow, start: string, end: string) {
  const totals = await searchAnalytics(site.gsc_property!, { startDate: start, endDate: end, dimensions: ['date'] })

  // ดึงสำเร็จก่อนค่อยลบ — ถ้า GSC พังกลางทาง ของเดิมยังอยู่
  const { error: del } = await sb
    .from('seo_gsc_totals')
    .delete()
    .eq('site_id', site.id)
    .gte('date', start)
    .lte('date', end)
  if (del) throw new Error(`ลบยอดรวมเดิมไม่ได้: ${del.message}`)

  if (totals.length) {
    const { error } = await sb.from('seo_gsc_totals').insert(
      totals.map((r) => ({
        site_id: site.id,
        date: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }))
    )
    if (error) throw new Error(`บันทึกยอดรวมไม่ได้: ${error.message}`)
  }
  return totals.reduce<string | null>((m, r) => (!m || r.keys[0] > m ? r.keys[0] : m), null)
}

/** คำค้น × หน้า รายวัน */
async function pullDetail(sb: SupabaseClient, site: SeoSiteRow, start: string, end: string) {
  const rows: GscRow[] = []
  for (let startRow = 0; ; startRow += GSC_PAGE_SIZE) {
    const page = await searchAnalytics(site.gsc_property!, {
      startDate: start,
      endDate: end,
      dimensions: ['date', 'query', 'page'],
      startRow,
    })
    rows.push(...page)
    if (page.length < GSC_PAGE_SIZE) break
  }

  const { error: del } = await sb
    .from('seo_gsc_daily')
    .delete()
    .eq('site_id', site.id)
    .gte('date', start)
    .lte('date', end)
  if (del) throw new Error(`ลบคำค้นเดิมไม่ได้: ${del.message}`)

  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error } = await sb.from('seo_gsc_daily').insert(
      rows.slice(i, i + INSERT_BATCH).map((r) => ({
        site_id: site.id,
        date: r.keys[0],
        query: r.keys[1],
        page: r.keys[2],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }))
    )
    if (error) throw new Error(`บันทึกคำค้นไม่ได้: ${error.message}`)
  }
  return rows.length
}

// ── ล็อก ────────────────────────────────────────────────────────────────

async function claim(sb: SupabaseClient, siteId: string): Promise<boolean> {
  const stale = new Date(Date.now() - LOCK_STALE_MS).toISOString()
  const { data } = await sb
    .from('seo_sites')
    .update({ sync_locked_at: new Date().toISOString() })
    .eq('id', siteId)
    .or(`sync_locked_at.is.null,sync_locked_at.lt.${stale}`)
    .select('id')
  return !!data?.length
}

// ── รอบเต็ม ─────────────────────────────────────────────────────────────

/**
 * ดึงข้อมูลของเว็บที่ส่งมา (หรือทุกเว็บที่เปิดใช้) — คืนผลทุกเว็บพร้อมเหตุผล
 * sb ต้องเป็น service role (เขียนตาราง seo_gsc_* ได้เฉพาะ service role)
 */
export async function syncGsc(
  sb: SupabaseClient,
  opts: { siteId?: string; budgetMs?: number } = {}
): Promise<SyncResult[]> {
  const startedAt = Date.now()
  const budget = opts.budgetMs ?? RUN_BUDGET_MS
  const timeLeft = () => budget - (Date.now() - startedAt)

  let q = sb
    .from('seo_sites')
    .select('id, domain, display_name, gsc_property, is_active, synced_through, backfill_from, backfill_done, last_error')
    .order('created_at')
  q = opts.siteId ? q.eq('id', opts.siteId) : q.eq('is_active', true)
  const { data: sites, error } = await q
  if (error) throw new Error(error.message)

  const results: SyncResult[] = []
  const working: SeoSiteRow[] = []

  for (const site of (sites ?? []) as SeoSiteRow[]) {
    if (!site.gsc_property) {
      results.push({ site: site.domain, status: 'skipped', detail: 'ยังไม่ได้ใส่ GSC property' })
    } else if (!(await claim(sb, site.id))) {
      results.push({ site: site.domain, status: 'skipped', detail: 'มีอีกรอบกำลังดึงเว็บนี้อยู่' })
    } else {
      working.push(site)
    }
  }

  const today = todayPacific()
  const earliest = addDays(today, -HISTORY_DAYS)
  const detailEarliest = addDays(today, -(DETAIL_DAYS - 1))
  const notes = new Map<string, string[]>()
  const failed = new Set<string>()

  const fail = async (site: SeoSiteRow, e: unknown) => {
    failed.add(site.id)
    const msg = (e as Error).message
    const denied = e instanceof GscAccessError
    await sb
      .from('seo_sites')
      .update({
        last_error: msg,
        sync_locked_at: null,
        ...(denied ? { gsc_access: 'denied', gsc_checked_at: new Date().toISOString() } : {}),
      })
      .eq('id', site.id)
    results.push({ site: site.domain, status: 'error', detail: msg })
    // แจ้งครั้งแรกที่พัง ไม่ใช่ทุกวัน
    if (!site.last_error) {
      await sendWebAlert({
        title: `🔎 ดึงข้อมูล Search Console ไม่ได้ — ${site.display_name}`,
        description: denied
          ? `service account ไม่มีสิทธิ์ใน \`${site.gsc_property}\` — เพิ่มเป็นผู้ใช้แบบ Restricted ใน GSC ของเว็บนี้`
          : msg,
        color: 'amber',
      }).catch(() => {})
    }
  }

  // 1) ช่วงล่าสุด — ทุกเว็บก่อน backfill เสมอ
  for (const site of working) {
    try {
      let from = addDays(today, -RECENT_DAYS)
      if (site.synced_through) from = minDate(from, addDays(site.synced_through, -RECENT_DAYS + 1))
      from = maxDate(from, detailEarliest)
      const latest = await pullTotals(sb, site, from, today)
      const rows = await pullDetail(sb, site, from, today)
      site.synced_through = latest && (!site.synced_through || latest > site.synced_through) ? latest : site.synced_through
      if (!site.backfill_from) site.backfill_from = from
      notes.set(site.id, [`ล่าสุด ${from}→${today} (${rows.toLocaleString()} แถว)`])

      await sb
        .from('seo_sites')
        .update({
          synced_through: site.synced_through,
          backfill_from: site.backfill_from,
          last_synced_at: new Date().toISOString(),
          last_error: null,
          gsc_access: 'ok',
          gsc_checked_at: new Date().toISOString(),
        })
        .eq('id', site.id)
    } catch (e) {
      await fail(site, e)
    }
  }

  // 2) ย้อนหลัง — ยอดรวม 16 เดือนก้อนเดียว แล้วคำค้นทีละ 14 วัน วนเว็บละก้อน
  //    เวลาหมดก็หยุด รอบหน้าทำต่อ · backfill_from = วันเก่าสุดของคำค้นที่ดึงแล้ว
  const totalsDone = new Set<string>()
  let progressed = true
  while (progressed && timeLeft() > MIN_CHUNK_MS) {
    progressed = false
    for (const site of working) {
      if (failed.has(site.id) || site.backfill_done || timeLeft() <= MIN_CHUNK_MS) continue
      try {
        if (!totalsDone.has(site.id)) {
          await pullTotals(sb, site, earliest, addDays(site.backfill_from!, -1))
          totalsDone.add(site.id)
          notes.get(site.id)?.push('ยอดรวมย้อน 16 เดือน')
        }
        const end = addDays(site.backfill_from!, -1)
        if (end >= detailEarliest) {
          const start = maxDate(addDays(end, -(BACKFILL_CHUNK_DAYS - 1)), detailEarliest)
          const rows = await pullDetail(sb, site, start, end)
          site.backfill_from = start
          notes.get(site.id)?.push(`คำค้น ${start}→${end} (${rows.toLocaleString()} แถว)`)
        }
        site.backfill_done = site.backfill_from! <= detailEarliest
        await sb
          .from('seo_sites')
          .update({ backfill_from: site.backfill_from, backfill_done: site.backfill_done })
          .eq('id', site.id)
        progressed = true
      } catch (e) {
        await fail(site, e)
      }
    }
  }

  // 3) คำค้น × หน้า เก่ากว่า 90 วัน ลบทิ้ง (ยอดรวมรายวันไม่ลบ)
  const { error: pruneErr } = await sb.from('seo_gsc_daily').delete().lt('date', detailEarliest)
  if (pruneErr) console.error('[seo] ลบคำค้นเก่าไม่ได้', pruneErr.message)

  for (const site of working) {
    if (failed.has(site.id)) continue
    await sb.from('seo_sites').update({ sync_locked_at: null }).eq('id', site.id)
    const n = notes.get(site.id) ?? []
    n.push(
      site.backfill_done
        ? 'ย้อนหลังครบแล้ว (ยอดรวม 16 เดือน · คำค้น 90 วัน)'
        : `คำค้นย้อนถึง ${site.backfill_from} (ยังไม่ครบ 90 วัน รอบหน้าทำต่อ)`
    )
    results.push({ site: site.domain, status: 'ok', detail: n.join(' · ') })
  }

  return results
}
