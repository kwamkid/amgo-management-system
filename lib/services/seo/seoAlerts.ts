// lib/services/seo/seoAlerts.ts
//
// แจ้งเตือน SEO เข้า Discord (ห้อง alerts) — รวมเป็นข้อความเดียวต่อรอบ cron ไม่ยิงทีละเรื่อง
//
// แจ้งเมื่อ:
//   · คำเป้าหมายเพิ่งติดหน้าแรก / หลุดจากหน้าแรก (หลุด = หลังเช็คซ้ำยืนยันแล้วเท่านั้น)
//   · กล่อง AI ของ Google / ChatGPT / Perplexity / Gemini เริ่มอ้าง หรือเลิกอ้างเว็บเรา
//   · วันจันทร์: คลิกจาก Google 7 วันล่าสุดลด ≥ 30% จาก 7 วันก่อน (เว็บที่มีคลิก ≥ 50)
//   · สรุป AI อ้างเรา แยกทีละ AI ต่อเว็บ — ทุกวันจันทร์ และวันที่ AI มีความเปลี่ยนแปลง
// ปิดได้ที่หน้าตั้งค่า SEO (seo_settings.alerts_enabled)

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWebAlert } from '@/lib/services/web/webAlerts'
import type { RankEvent } from './rankSync'
import type { AeoEvent } from './aeoSync'
import { AEO_ENGINES } from './aeo'
import { fmtAiSummary, getAiSummaries } from './aiSummary'

const DROP_PCT = 0.3
const MIN_CLICKS = 50

const bangkokDay = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' }).format(new Date())

/** คลิก 7 วันล่าสุด vs 7 วันก่อนหน้า (ตามวันที่มีข้อมูลล่าสุดของแต่ละเว็บ) */
async function gscWeeklyDrops(sb: SupabaseClient) {
  const since = new Date(Date.now() - 20 * 24 * 3600_000).toISOString().slice(0, 10)
  const [{ data: sites }, { data: totals }] = await Promise.all([
    sb.from('seo_sites').select('id, display_name').eq('is_active', true),
    sb.from('seo_gsc_totals').select('site_id, date, clicks').gte('date', since).order('date', { ascending: false }),
  ])
  const lines: string[] = []
  for (const s of sites ?? []) {
    const rows = (totals ?? []).filter((t) => t.site_id === s.id)
    if (rows.length < 14) continue
    const cur = rows.slice(0, 7).reduce((a, r) => a + r.clicks, 0)
    const prev = rows.slice(7, 14).reduce((a, r) => a + r.clicks, 0)
    if (prev >= MIN_CLICKS && cur <= prev * (1 - DROP_PCT))
      lines.push(`**${s.display_name}** คลิก ${prev} → ${cur} (${Math.round((cur / prev - 1) * 100)}%)`)
  }
  return lines
}

export async function sendSeoDigest(sb: SupabaseClient, rankEvents: RankEvent[], aeoEvents: AeoEvent[]) {
  const { data: cfg } = await sb.from('seo_settings').select('alerts_enabled').maybeSingle()
  if (cfg && !cfg.alerts_enabled) return 'ปิดแจ้งเตือนไว้'

  const fields: { name: string; value: string }[] = []
  const list = (xs: string[]) => {
    const shown = xs.slice(0, 10).join('\n')
    return xs.length > 10 ? `${shown}\n…และอีก ${xs.length - 10}` : shown
  }

  const top10 = rankEvents.filter((e) => e.kind === 'top10')
  // collectRanks ส่งมาเฉพาะที่ยืนยันแล้ว (ร่วงหนักรอบแรกรอเช็คซ้ำก่อน)
  const dropped = rankEvents.filter((e) => e.kind === 'dropped')
  const pos = (n: number | null) => (n == null ? 'ไม่ติด' : `#${n}`)
  if (top10.length)
    fields.push({ name: '🏆 ติดหน้าแรก', value: list(top10.map((e) => `${e.site} · ${e.keyword} ${pos(e.from)} → ${pos(e.to)}`)) })
  if (dropped.length)
    fields.push({ name: '📉 หลุดหน้าแรก', value: list(dropped.map((e) => `${e.site} · ${e.keyword} ${pos(e.from)} → ${pos(e.to)}`)) })

  const label = (k: string) => AEO_ENGINES.find((e) => e.key === k)?.label ?? k
  const cited = [
    ...rankEvents.filter((e) => e.kind === 'aio_cited').map((e) => `Google AI · ${e.site} · ${e.keyword}`),
    ...aeoEvents.filter((e) => e.kind === 'cited').map((e) => `${label(e.engine)} · ${e.site} · ${e.prompt}`),
  ]
  const lost = [
    ...rankEvents.filter((e) => e.kind === 'aio_lost').map((e) => `Google AI · ${e.site} · ${e.keyword}`),
    ...aeoEvents.filter((e) => e.kind === 'lost').map((e) => `${label(e.engine)} · ${e.site} · ${e.prompt}`),
  ]
  // เรียงตามชื่อ AI ให้อ่านทีละตัว
  if (cited.length) fields.push({ name: '✨ AI เริ่มอ้างเรา', value: list(cited.sort()) })
  if (lost.length) fields.push({ name: '⚠️ AI เลิกอ้างเรา', value: list(lost.sort()) })

  // สรุปแยกทีละ AI ต่อเว็บ (เจ้าของขอ 7 ต.ค. 69) — แนบเมื่อ AI มีความเปลี่ยนแปลง และทุกวันจันทร์
  const monday = bangkokDay() === 'Mon'
  if (monday || cited.length || lost.length) {
    const { data: sites } = await sb.from('seo_sites').select('id, display_name').eq('is_active', true)
    const sums = await getAiSummaries(
      sb,
      (sites ?? []).map((x) => x.id)
    )
    const lines = (sites ?? [])
      .map((x) => {
        const t = fmtAiSummary(sums.get(x.id)!)
        return t ? `**${x.display_name}** — ${t}` : null
      })
      .filter((x): x is string => !!x)
    if (lines.length) fields.push({ name: '🤖 AI อ้างลิงก์เรา (อ้าง/ทั้งหมด แยกทีละ AI)', value: list(lines) })
  }

  if (monday) {
    const drops = await gscWeeklyDrops(sb)
    if (drops.length)
      fields.push({ name: '🔻 คลิกจาก Google ลดลงเยอะ (สัปดาห์นี้ vs ก่อน)', value: `${list(drops)}\nเช็คก่อนว่าเป็นช่วงเทศกาลหรือเปล่า` })
  }

  // สรุป AI อย่างเดียว (วันจันทร์ที่ไม่มีอะไรเปลี่ยน) ก็ส่ง — เป็นรายงานประจำสัปดาห์
  if (!fields.length) return 'ไม่มีเรื่องต้องแจ้ง'
  const ok = await sendWebAlert({
    title: '📊 SEO / AEO — สรุปความเปลี่ยนแปลง',
    color: dropped.length || lost.length ? 'amber' : 'green',
    fields,
  }).catch(() => false)
  return ok ? `แจ้ง Discord ${fields.length} หัวข้อ` : 'ส่ง Discord ไม่สำเร็จ'
}
