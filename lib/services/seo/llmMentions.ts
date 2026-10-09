// lib/services/seo/llmMentions.ts
//
// "AI อ้างเราที่ไหนบ้าง" — DataForSEO LLM Mentions (ฝั่งเซิร์ฟเวอร์ · รันในคิวกลาง kind 'seo.llm.mentions')
//
// ต่อเว็บต่อรอบ (เดือนละครั้ง + ปุ่มกดเอง):
//   1) cross_aggregated_metrics — เรา + คู่แข่ง: AI อ้างใครกี่คำตอบ (share of voice)       ~$0.10
//   2) search (โดเมนเรา) เรียงตามคนถาม AI — คำถามที่ AI อ้างเราอยู่แล้ว 100 ข้อ                ~$0.20
//   3) search (คู่แข่งทีละเจ้า · ตัดเราออก) — คำถามที่ AI อ้างคู่แข่งแต่ไม่อ้างเรา 50 ข้อ/เจ้า   ~$0.15/เจ้า
//      ใส่หลายเจ้าในคำขอเดียวไม่ได้ (เป็น AND = ต้องอ้างทุกเจ้าพร้อมกัน — ทดสอบ 9 ต.ค. 69)
// ภาษาไทยตอนนี้มีแต่ Google AI Overview · ใช้ค่า cost ที่ API คืนมาเสมอ

import type { SupabaseClient } from '@supabase/supabase-js'

const API = 'https://api.dataforseo.com/v3/ai_optimization/llm_mentions'
const LOC = { location_code: 2764, language_code: 'th' }
/** คู่แข่งที่เทียบได้สูงสุด (ช่องทางขายใหญ่/โซเชียลไม่นับ — ไม่ใช่คู่แข่งตรง) */
const MAX_COMPETITORS = 3
const GAP_PER_COMPETITOR = 50
const OURS_LIMIT = 100

/** ไม่ใช่คู่แข่งตรง — marketplace · โซเชียล · สื่อ · Google เอง */
const NOT_COMPETITOR = [
  'facebook.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'pantip.com', 'lemon8-app.com', 'pinterest.com',
  'shopee.co.th', 'lazada.co.th', 'google.com', 'wikipedia.org', 'sanook.com', 'thairath.co.th', 'line.me',
  'twitter.com', 'x.com', 'reddit.com', 'medium.com', 'blockdit.com', 'wongnai.com', 'kapook.com',
]

const bare = (d: string) => d.toLowerCase().replace(/^www\./, '')
const isPlatform = (d: string) => NOT_COMPETITOR.some((p) => bare(d) === p || bare(d).endsWith(`.${p}`))

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw new Error('ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD')
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function call(path: string, body: Record<string, unknown>): Promise<{ result: any; cost: number }> {
  const res = await fetch(`${API}/${path}/live`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify([{ ...LOC, ...body }]),
    signal: AbortSignal.timeout(30_000),
  })
  const json = await res.json().catch(() => ({}))
  const t = json.tasks?.[0]
  if (!res.ok || !t || t.status_code !== 20000) {
    throw new Error(`LLM Mentions ${t?.status_code ?? res.status}: ${t?.status_message ?? json.status_message ?? 'ไม่ทราบสาเหตุ'}`)
  }
  return { result: t.result?.[0] ?? null, cost: Number(t.cost ?? 0) }
}

/** คู่แข่ง: ที่ตั้งไว้ในเว็บ หรือเลือกเองจากโดเมนที่ติดอันดับคู่กับเราบ่อยสุด (ไม่นับ marketplace/โซเชียล) */
export async function competitorsFor(sb: SupabaseClient, siteId: string, ourDomain: string, preset: string[] | null) {
  if (preset?.length) return preset.slice(0, MAX_COMPETITORS).map(bare)
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
  const { data } = await sb
    .from('seo_rank_snapshots')
    .select('top_competitors, seo_keywords!inner(site_id)')
    .eq('seo_keywords.site_id', siteId)
    .gte('checked_on', since)
    .not('top_competitors', 'is', null)
    .limit(2000)
  const count = new Map<string, number>()
  for (const r of data ?? []) {
    for (const c of (r.top_competitors as { domain?: string }[]) ?? []) {
      if (!c.domain) continue
      const d = bare(c.domain)
      if (d === bare(ourDomain) || d.endsWith(`.${bare(ourDomain)}`) || isPlatform(d)) continue
      count.set(d, (count.get(d) ?? 0) + 1)
    }
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_COMPETITORS)
    .map(([d]) => d)
}

const toQuestion = (it: any) => ({
  question: String(it.question ?? '').slice(0, 500),
  platform: it.platform ?? null,
  ai_search_volume: it.ai_search_volume ?? null,
  sources: Array.from(new Set(((it.sources ?? []) as any[]).map((s) => bare(s.domain ?? '')).filter(Boolean))).slice(0, 10),
  first_seen: it.first_response_at ? new Date(it.first_response_at).toISOString() : null,
  last_seen: it.last_response_at ? new Date(it.last_response_at).toISOString() : null,
})

export async function fetchLlmMentions(sb: SupabaseClient, siteId: string) {
  const { data: site, error } = await sb.from('seo_sites').select('id, domain, competitors').eq('id', siteId).single()
  if (error || !site) throw new Error(error?.message ?? 'ไม่พบเว็บ')
  const ours = bare(site.domain)
  const comps = await competitorsFor(sb, siteId, ours, site.competitors)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  let cost = 0

  // 1) share of voice — เรา + คู่แข่ง
  const targets = [ours, ...comps].map((d) => ({ aggregation_key: d, target: [{ domain: d }] }))
  const cross = await call('cross_aggregated_metrics', { targets })
  cost += cross.cost
  const shareRows: Record<string, unknown>[] = []
  for (const item of cross.result?.items ?? []) {
    const total = (item.location ?? [])[0] ?? { mentions: 0, ai_search_volume: 0 }
    shareRows.push({ site_id: siteId, fetched_on: today, domain: item.key, is_us: item.key === ours, platform: 'all', mentions: total.mentions ?? 0, ai_search_volume: total.ai_search_volume ?? 0 })
    for (const p of item.platform ?? [])
      shareRows.push({ site_id: siteId, fetched_on: today, domain: item.key, is_us: item.key === ours, platform: p.key, mentions: p.mentions ?? 0, ai_search_volume: p.ai_search_volume ?? 0 })
  }

  // 2) คำถามที่อ้างเราอยู่แล้ว
  const oursRes = await call('search', { target: [{ domain: ours }], order_by: ['ai_search_volume,desc'], limit: OURS_LIMIT })
  cost += oursRes.cost
  const questions: Record<string, unknown>[] = (oursRes.result?.items ?? []).map((it: any) => ({
    site_id: siteId, kind: 'ours', competitor: null, fetched_on: today, ...toQuestion(it),
  }))

  // 3) โอกาส — อ้างคู่แข่งแต่ไม่อ้างเรา (ทีละเจ้า แล้วรวม ตัดคำถามซ้ำ)
  const seenGap = new Map<string, Record<string, unknown>>()
  for (const c of comps) {
    const g = await call('search', {
      target: [{ domain: c }, { domain: ours, search_filter: 'exclude' }],
      order_by: ['ai_search_volume,desc'],
      limit: GAP_PER_COMPETITOR,
    })
    cost += g.cost
    for (const it of g.result?.items ?? []) {
      const q = toQuestion(it)
      const prev = seenGap.get(q.question)
      if (prev) prev.competitor = `${prev.competitor}, ${c}`
      else seenGap.set(q.question, { site_id: siteId, kind: 'gap', competitor: c, fetched_on: today, ...q })
    }
  }
  questions.push(...seenGap.values())

  // บันทึก — คำถามแทนที่ทั้งชุด · share เก็บเป็นประวัติรายรอบ
  await sb.from('seo_llm_questions').delete().eq('site_id', siteId)
  if (questions.length) {
    const { error: qErr } = await sb.from('seo_llm_questions').insert(questions)
    if (qErr) throw new Error(qErr.message)
  }
  if (shareRows.length) {
    const { error: sErr } = await sb.from('seo_llm_share').upsert(shareRows, { onConflict: 'site_id,fetched_on,domain,platform' })
    if (sErr) throw new Error(sErr.message)
  }
  await sb.from('seo_api_costs').insert({
    provider: 'dataforseo',
    endpoint: 'llm_mentions',
    units: 2 + comps.length,
    cost_usd: cost,
    note: `AI อ้างเรา/คู่แข่ง · ${ours} vs ${comps.join(', ') || '-'}`,
  })
  return { competitors: comps, ours: questions.filter((q) => q.kind === 'ours').length, gap: seenGap.size, cost }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
