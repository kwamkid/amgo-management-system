// lib/services/seo/aiSummary.ts
//
// สรุป "AI ตัวไหนอ้างเรา" แยกทีละ AI ต่อเว็บ — ใช้ทั้งหน้ารายการ SEO (client) และ Discord (cron)
// รับ SupabaseClient จากผู้เรียก: หน้าเว็บส่ง client ของผู้ใช้ (RLS เจ้าของเท่านั้น) · cron ส่ง service role
//
// Google = AI Overview จากผลเช็คอันดับรอบล่าสุดของแต่ละคำ (นับเฉพาะคำที่มีกล่อง AI)
// ChatGPT / Perplexity / Gemini = คำตอบล่าสุดของแต่ละคำถามในแท็บ AI ตอบ
// ดูย้อนแค่ 30 วัน — เก่ากว่านั้นไม่ใช่ภาพปัจจุบันแล้ว

import type { SupabaseClient } from '@supabase/supabase-js'

export type AiEngineKey = 'google' | 'chatgpt' | 'perplexity' | 'gemini'

export const AI_ENGINES: { key: AiEngineKey; label: string }[] = [
  { key: 'google', label: 'Google AI' },
  { key: 'chatgpt', label: 'ChatGPT' },
  { key: 'perplexity', label: 'Perplexity' },
  { key: 'gemini', label: 'Gemini' },
]

/** cited = ใส่ลิงก์เรา · mentioned = เอ่ยชื่อเรา (รวมที่ใส่ลิงก์) · total = จำนวนที่ถาม/มีกล่อง AI */
export type AiCount = { cited: number; mentioned: number; total: number }
export type AiSummary = Record<AiEngineKey, AiCount>

const empty = (): AiSummary => ({
  google: { cited: 0, mentioned: 0, total: 0 },
  chatgpt: { cited: 0, mentioned: 0, total: 0 },
  perplexity: { cited: 0, mentioned: 0, total: 0 },
  gemini: { cited: 0, mentioned: 0, total: 0 },
})

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getAiSummaries(sb: SupabaseClient, siteIds: string[]): Promise<Map<string, AiSummary>> {
  const out = new Map<string, AiSummary>(siteIds.map((id) => [id, empty()]))
  if (!siteIds.length) return out
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString().slice(0, 10)

  const [{ data: snaps }, { data: answers }] = await Promise.all([
    sb
      .from('seo_rank_snapshots')
      .select('keyword_id, checked_on, has_ai_overview, ai_overview_cites_us, top_competitors, seo_keywords!inner(site_id)')
      .in('seo_keywords.site_id', siteIds)
      .gte('checked_on', since)
      .not('top_competitors', 'is', null) // ประวัติที่นำเข้าไม่มีข้อมูล AI
      .order('checked_on', { ascending: false })
      .limit(5000),
    sb
      .from('seo_aeo_results')
      .select('prompt_id, engine, checked_on, cited, mentioned, seo_aeo_prompts!inner(site_id, is_tracked)')
      .in('seo_aeo_prompts.site_id', siteIds)
      .eq('seo_aeo_prompts.is_tracked', true)
      .gte('checked_on', since)
      .order('checked_on', { ascending: false })
      .limit(5000),
  ])

  const seenKw = new Set<string>()
  for (const s of (snaps ?? []) as any[]) {
    if (seenKw.has(s.keyword_id)) continue
    seenKw.add(s.keyword_id)
    if (!s.has_ai_overview) continue
    const c = out.get(s.seo_keywords.site_id)?.google
    if (!c) continue
    c.total++
    if (s.ai_overview_cites_us) {
      c.cited++
      c.mentioned++
    }
  }

  const seenAns = new Set<string>()
  for (const a of (answers ?? []) as any[]) {
    const key = `${a.prompt_id}|${a.engine}`
    if (seenAns.has(key)) continue
    seenAns.add(key)
    const c = out.get(a.seo_aeo_prompts.site_id)?.[a.engine as AiEngineKey]
    if (!c) continue
    c.total++
    if (a.cited) c.cited++
    if (a.mentioned || a.cited) c.mentioned++
  }
  return out
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** "Google AI 4/18 · ChatGPT 2/5 · …" — ข้าม AI ที่ยังไม่มีข้อมูล */
export function fmtAiSummary(s: AiSummary) {
  return AI_ENGINES.filter((e) => s[e.key].total)
    .map((e) => `${e.label} ${s[e.key].cited}/${s[e.key].total}`)
    .join(' · ')
}
