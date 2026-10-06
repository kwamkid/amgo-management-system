// lib/services/seo/bing.ts
//
// Bing Webmaster Tools API — คลิก/การแสดงผลรายวันจาก Bing (รวม Copilot / ChatGPT search ที่ใช้ดัชนี Bing)
//
// env: BING_WEBMASTER_API_KEY — สร้างที่ bing.com/webmasters → Settings → API access
//   ไม่ได้ตั้ง = ข้ามเงียบ ๆ (งานรายวันไม่ล้ม)
// siteUrl ต้องตรงกับที่ยืนยันไว้ใน Bing Webmaster เป๊ะ ๆ — เดาให้ (https://www. / https://) ครั้งแรก
//   แล้วจำไว้ใน seo_sites.bing_site_url

import type { SupabaseClient } from '@supabase/supabase-js'

const API = 'https://ssl.bing.com/webmaster/api.svc/json'

export const hasBingKey = () => !!process.env.BING_WEBMASTER_API_KEY

/** "/Date(1316156400000-0700)/" → '2011-09-16' */
function bingDate(s: string) {
  const ms = Number(/\d+/.exec(s)?.[0] ?? NaN)
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null
}

async function rankAndTraffic(siteUrl: string) {
  const url = `${API}/GetRankAndTrafficStats?siteUrl=${encodeURIComponent(siteUrl)}&apikey=${process.env.BING_WEBMASTER_API_KEY}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json().catch(() => null)
  return (json?.d ?? null) as { Date: string; Clicks: number; Impressions: number }[] | null
}

export async function syncBing(sb: SupabaseClient) {
  if (!hasBingKey()) return 'ข้าม — ยังไม่ได้ตั้ง BING_WEBMASTER_API_KEY'
  const { data: sites } = await sb.from('seo_sites').select('id, domain, bing_site_url').eq('is_active', true)
  const results: string[] = []
  for (const s of sites ?? []) {
    const candidates = s.bing_site_url ? [s.bing_site_url] : [`https://www.${s.domain}/`, `https://${s.domain}/`]
    let rows: Awaited<ReturnType<typeof rankAndTraffic>> = null
    let used = ''
    for (const c of candidates) {
      rows = await rankAndTraffic(c)
      if (rows) {
        used = c
        break
      }
    }
    if (!rows) {
      results.push(`${s.domain}: ไม่พบใน Bing Webmaster`)
      continue
    }
    if (!s.bing_site_url) await sb.from('seo_sites').update({ bing_site_url: used }).eq('id', s.id)
    const upserts = rows
      .map((r) => ({ site_id: s.id, date: bingDate(r.Date), clicks: r.Clicks ?? 0, impressions: r.Impressions ?? 0 }))
      .filter((r): r is { site_id: string; date: string; clicks: number; impressions: number } => !!r.date)
    if (upserts.length) await sb.from('seo_bing_daily').upsert(upserts, { onConflict: 'site_id,date' })
    results.push(`${s.domain}: ${upserts.length} วัน`)
  }
  return results.join(' · ')
}
