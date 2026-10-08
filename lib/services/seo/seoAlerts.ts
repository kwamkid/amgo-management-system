// lib/services/seo/seoAlerts.ts
//
// แจ้งเตือน SEO เข้า Discord (ห้อง alerts) — ข้อความละเว็บ มีชื่อ + ไอคอนเว็บ (เจ้าของ 9 ต.ค. 69)
//
// จังหวะ: ผลอันดับกลับมาทีละคำ (pingback) → recordSeoEvents เก็บลง seo_alert_events ก่อน
//         → งาน seo.alerts.flush ในคิว (15 นาทีหลัง event แรก) รอผลชุดนั้นครบ แล้วส่งรวมทีละเว็บ
//         เดิมส่งทันทีที่ผลคำนั้นกลับมา = 1 คำ 1 ข้อความ ไหลเป็นสิบข้อความ อ่านไม่ออก
//
// แจ้งเมื่อ:
//   · อันดับที่โชว์ (ค่ากลาง 5 ครั้งล่าสุด) ขยับเยอะ: ข้ามเส้นหน้าแรก · ติด/หลุด 30 อันดับ · ขยับ ≥ 5 (rankRules.bigMove)
//   · กล่อง AI ของ Google / ChatGPT / Perplexity / Gemini เริ่มอ้าง หรือเลิกอ้างเว็บเรา
//   · วันจันทร์: คลิกจาก Google 7 วันล่าสุดลด ≥ 30% จาก 7 วันก่อน (เว็บที่มีคลิก ≥ 50)
//   · สรุป AI อ้างเรา แยกทีละ AI — ทุกวันจันทร์ และเว็บที่ AI มีความเปลี่ยนแปลง
// ปิดได้ที่หน้าตั้งค่า SEO (seo_settings.alerts_enabled)

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWebAlert, type AlertColor } from '@/lib/services/web/webAlerts'
import type { RankEvent } from './rankSync'
import type { AeoEvent } from './aeoSync'
import { AEO_ENGINES } from './aeo'
import { fmtAiSummary, getAiSummaries } from './aiSummary'
import { fmtDisplayRank } from './rankRules'

const DROP_PCT = 0.3
const MIN_CLICKS = 50
/** รอผลชุดเดียวกันกลับมาก่อนส่ง */
const FLUSH_DELAY_MS = 15 * 60_000
/** รอผลค้างได้นานสุดเท่านี้ แล้วส่งเท่าที่มี */
const FLUSH_MAX_WAIT_MS = 3 * 3600_000
const LIST_MAX = 10

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.amgovenger.com'
const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`

const bangkokDay = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' }).format(new Date())

type EventRow = {
  id: number
  site_id: string
  kind: string
  label: string
  from_pos: number | null
  to_pos: number | null
  engine: string | null
  created_at: string
}

/** เก็บ event ไว้ส่งรวม + ลงงานส่ง (ถ้ายังไม่มีงานรออยู่) */
export async function recordSeoEvents(sb: SupabaseClient, rankEvents: RankEvent[], aeoEvents: AeoEvent[]) {
  const rows = [
    ...rankEvents
      .filter((e) => e.siteId)
      .map((e) => ({ site_id: e.siteId, kind: e.kind, label: e.keyword, from_pos: e.from, to_pos: e.to })),
    ...aeoEvents
      .filter((e) => e.siteId)
      .map((e) => ({ site_id: e.siteId, kind: e.kind === 'cited' ? 'ai_cited' : 'ai_lost', label: e.prompt, engine: e.engine })),
  ]
  if (!rows.length) return 0
  const { error } = await sb.from('seo_alert_events').insert(rows)
  if (error) throw new Error(`เก็บแจ้งเตือนไม่ได้: ${error.message}`)

  const { count } = await sb
    .from('queue_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'seo.alerts.flush')
    .eq('status', 'queued')
  if (!count) {
    await sb.from('queue_jobs').insert({
      kind: 'seo.alerts.flush',
      label: 'สรุปแจ้งเตือน SEO เข้า Discord',
      priority: 9,
      max_attempts: 3,
      run_after: new Date(Date.now() + FLUSH_DELAY_MS).toISOString(),
    })
  }
  return rows.length
}

/** คลิก 7 วันล่าสุด vs 7 วันก่อนหน้า (ตามวันที่มีข้อมูลล่าสุดของแต่ละเว็บ) → site_id: ข้อความ */
async function gscWeeklyDrops(sb: SupabaseClient, siteIds: string[]) {
  const since = new Date(Date.now() - 20 * 24 * 3600_000).toISOString().slice(0, 10)
  const { data: totals } = await sb
    .from('seo_gsc_totals')
    .select('site_id, date, clicks')
    .in('site_id', siteIds)
    .gte('date', since)
    .order('date', { ascending: false })
  const out = new Map<string, string>()
  for (const id of siteIds) {
    const rows = (totals ?? []).filter((t) => t.site_id === id)
    if (rows.length < 14) continue
    const cur = rows.slice(0, 7).reduce((a, r) => a + r.clicks, 0)
    const prev = rows.slice(7, 14).reduce((a, r) => a + r.clicks, 0)
    if (prev >= MIN_CLICKS && cur <= prev * (1 - DROP_PCT))
      out.set(id, `${prev} → ${cur} คลิก (${Math.round((cur / prev - 1) * 100)}%) · เช็คก่อนว่าเป็นช่วงเทศกาลหรือเปล่า`)
  }
  return out
}

const engineLabel = (k: string) => AEO_ENGINES.find((e) => e.key === k)?.label ?? k

function section(title: string, lines: string[]) {
  if (!lines.length) return null
  const shown = lines.slice(0, LIST_MAX).map((l) => `• ${l}`)
  if (lines.length > LIST_MAX) shown.push(`…และอีก ${lines.length - LIST_MAX}`)
  return `**${title}**\n${shown.join('\n')}`
}

/**
 * ส่ง event ที่ค้างอยู่ — ข้อความละเว็บ
 * weekly = รายงานวันจันทร์ (สรุป AI + คลิกลด ทุกเว็บ แม้ไม่มี event)
 * waitForRanks = ยังมีงานอันดับค้าง → รอก่อน (คืน retryAfterMs) จนเกิน FLUSH_MAX_WAIT_MS
 */
export async function flushSeoAlerts(
  sb: SupabaseClient,
  opts: { weekly?: boolean; waitForRanks?: boolean } = {}
): Promise<{ result: string; retryAfterMs?: number }> {
  const [{ data: cfg }, { data: pending }] = await Promise.all([
    sb.from('seo_settings').select('alerts_enabled').maybeSingle(),
    sb.from('seo_alert_events').select('*').is('sent_at', null).order('created_at').limit(500),
  ])
  const events = (pending ?? []) as EventRow[]
  const markSent = async (ids: number[]) => {
    if (ids.length) await sb.from('seo_alert_events').update({ sent_at: new Date().toISOString() }).in('id', ids)
  }
  if (cfg && !cfg.alerts_enabled) {
    await markSent(events.map((e) => e.id))
    return { result: 'ปิดแจ้งเตือนไว้' }
  }

  if (opts.waitForRanks && events.length) {
    const { count } = await sb.from('seo_rank_tasks').select('task_id', { count: 'exact', head: true }).eq('status', 'pending')
    const age = Date.now() - new Date(events[0].created_at).getTime()
    if (count && age < FLUSH_MAX_WAIT_MS) return { result: `รอผลอันดับอีก ${count} งาน`, retryAfterMs: 10 * 60_000 }
  }

  const { data: sites } = await sb.from('seo_sites').select('id, domain, display_name').eq('is_active', true).order('display_name')
  const bySite = new Map<string, EventRow[]>()
  for (const e of events) bySite.set(e.site_id, [...(bySite.get(e.site_id) ?? []), e])

  const aiChanged = (rows: EventRow[]) => rows.some((e) => e.kind.startsWith('ai_') || e.kind.startsWith('aio_'))
  const targets = (sites ?? []).filter((s) => bySite.has(s.id) || opts.weekly)
  if (!targets.length) return { result: 'ไม่มีเรื่องต้องแจ้ง' }

  const needAi = targets.filter((s) => opts.weekly || aiChanged(bySite.get(s.id) ?? [])).map((s) => s.id)
  const [aiSums, drops] = await Promise.all([
    needAi.length ? getAiSummaries(sb, needAi) : Promise.resolve(new Map()),
    opts.weekly ? gscWeeklyDrops(sb, targets.map((s) => s.id)) : Promise.resolve(new Map<string, string>()),
  ])

  let sent = 0
  for (const s of targets) {
    const rows = bySite.get(s.id) ?? []
    const of = (kind: string) => rows.filter((e) => e.kind === kind)
    // top10 / dropped = ชนิดเก่าก่อน 9 ต.ค. 69 ที่อาจค้างในตาราง
    const up = [...of('up'), ...of('top10')]
    const down = [...of('down'), ...of('dropped')]
    const move = (e: EventRow) => {
      const page1 = (p: number | null) => p != null && p <= 10
      const note = !page1(e.from_pos) && page1(e.to_pos) ? ' (ติดหน้าแรก)' : page1(e.from_pos) && !page1(e.to_pos) ? ' (หลุดหน้าแรก)' : ''
      return `${e.label}  ${fmtDisplayRank(e.from_pos)} → **${fmtDisplayRank(e.to_pos)}**${note}`
    }
    const aiCited = [
      ...of('aio_cited').map((e) => `Google AI · ${e.label}`),
      ...of('ai_cited').map((e) => `${engineLabel(e.engine ?? '')} · ${e.label}`),
    ].sort()
    const aiLost = [
      ...of('aio_lost').map((e) => `Google AI · ${e.label}`),
      ...of('ai_lost').map((e) => `${engineLabel(e.engine ?? '')} · ${e.label}`),
    ].sort()
    const aiSum = aiSums.get(s.id) ? fmtAiSummary(aiSums.get(s.id)) : ''
    const drop = drops.get(s.id)

    const parts = [
      section(`📈 อันดับขึ้น (${up.length})`, up.map(move)),
      section(`📉 อันดับลง (${down.length})`, down.map(move)),
      section(`✨ AI เริ่มอ้างเรา (${aiCited.length})`, aiCited),
      section(`⚠️ AI เลิกอ้างเรา (${aiLost.length})`, aiLost),
      aiSum ? `**🤖 AI อ้างลิงก์เรา** (อ้าง/ทั้งหมด)\n${aiSum}` : null,
      drop ? `**🔻 คลิกจาก Google สัปดาห์นี้**\n${drop}` : null,
    ].filter((x): x is string => !!x)
    if (!parts.length) {
      await markSent(rows.map((e) => e.id))
      continue
    }

    const color: AlertColor = down.length ? 'red' : aiLost.length || drop ? 'amber' : 'green'
    const ok = await sendWebAlert({
      title: opts.weekly && !rows.length ? '📊 สรุป SEO / AEO ประจำสัปดาห์' : '📊 สรุป SEO / AEO',
      url: `${APP_URL}/seo/${s.id}`,
      author: { name: s.display_name, url: `https://${s.domain}`, icon_url: favicon(s.domain) },
      description: parts.join('\n\n'),
      color,
    }).catch(() => false)
    if (ok) {
      sent++
      await markSent(rows.map((e) => e.id))
    }
    // webhook จำกัด ~5 ข้อความ / 2 วิ
    await new Promise((r) => setTimeout(r, 700))
  }
  return { result: `แจ้ง Discord ${sent}/${targets.length} เว็บ` }
}
