// lib/services/seo/aeoSync.ts
//
// AEO — ถาม AI ด้วยคำถามที่ถึงรอบ แล้วบันทึกว่าคำตอบพูดถึง/อ้างเราไหม
//
// ทำผ่านคิวกลาง (lib/queue): planAeo หาคู่ (คำถาม × AI) ที่ถึงรอบ + เช็คงบ แล้วลงคิว
// งานละ 1 ข้อ (kind 'seo.aeo.ask') → askOne ถาม ~5–15 วิ บันทึกผล + ค่าใช้จ่าย
//   · cron ตี 4: คู่ที่คำตอบล่าสุดเก่ากว่ารอบของมัน — คำถามของคำหลัก (priority 1) ทุก 7 วัน · คำรอง 30 วัน
//     (เจ้าของเลือก 9 ต.ค. 69 ให้อยู่ในงบ) · คำถามที่ไม่ได้ผูกคำ = aeo_recheck_days
//   · ปุ่มบนหน้าเว็บ: ทุกคู่ของเว็บนั้นที่ยังไม่ได้ถามวันนี้ (ปิดหน้าได้ คิวเดินเอง)
// เพดานงบเดือนเดียวกับอันดับ (seo_settings.monthly_budget_usd) — เช็คทั้งชุดก่อนลงคิว

import type { SupabaseClient } from '@supabase/supabase-js'
import { AEO_ENGINES, analyzeAnswer, askAi, type AeoEngine } from './aeo'
import { monthSpend } from './rankSync'

/** รอบถามซ้ำ (วัน) — คำถามของคำหลัก / คำรอง */
const MAIN_RECHECK_DAYS = 7
const MINOR_RECHECK_DAYS = 30

const bangkokDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export type AeoEvent = { siteId: string; site: string; prompt: string; engine: AeoEngine; kind: 'cited' | 'lost' }

/** คู่ (คำถาม × AI) ที่ถึงรอบถาม — ใช้ตอนลงคิว */
export type AeoDue = { promptId: string; prompt: string; engine: AeoEngine; site: string }

/**
 * หาคู่ที่ถึงรอบ + เช็คงบทั้งชุดก่อน (ไม่พอ = ไม่ลงคิวเลย ไม่ถามครึ่ง ๆ กลาง ๆ)
 * force = กดจากหน้าเว็บ (ไม่สนรอบ 7 วัน แต่ข้ามคู่ที่ถามไปแล้ววันนี้)
 */
export async function planAeo(
  sb: SupabaseClient,
  opts: { siteId?: string; force?: boolean } = {}
): Promise<{ due: AeoDue[]; skipped: string[] }> {
  const { data: cfg } = await sb
    .from('seo_settings')
    .select('monthly_budget_usd, aeo_engines, aeo_recheck_days')
    .maybeSingle()
  const engines = AEO_ENGINES.filter((e) => (cfg?.aeo_engines ?? ['chatgpt', 'perplexity', 'gemini']).includes(e.key))
  const recheckDays = cfg?.aeo_recheck_days ?? 7
  const budget = Number(cfg?.monthly_budget_usd ?? 10)
  if (!engines.length) return { due: [], skipped: ['ปิด AI ทุกตัวไว้ในตั้งค่า'] }

  let q = sb
    .from('seo_aeo_prompts')
    .select('id, prompt, site_id, seo_sites!inner(display_name, is_active), seo_keywords(priority)')
    .eq('is_tracked', true)
  q = opts.siteId ? q.eq('site_id', opts.siteId) : q.eq('seo_sites.is_active', true)
  const { data: prompts, error } = await q
  if (error) throw new Error(error.message)
  if (!prompts?.length) return { due: [], skipped: ['ยังไม่มีคำถามที่เปิดติดตาม'] }

  const { data: last } = await sb
    .from('seo_aeo_results')
    .select('prompt_id, engine, checked_on')
    .in(
      'prompt_id',
      prompts.map((p) => p.id)
    )
    .order('checked_on', { ascending: false })
  const latest = new Map<string, string>()
  for (const r of last ?? []) {
    const key = `${r.prompt_id}|${r.engine}`
    if (!latest.has(key)) latest.set(key, r.checked_on)
  }

  const today = bangkokDate()
  const cutoffFor = (days: number) => bangkokDate(new Date(Date.now() - (days - 1) * 24 * 3600_000))
  const due: AeoDue[] = []
  let estimate = 0
  for (const p of prompts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priority = (p.seo_keywords as any)?.priority as number | undefined
    const cutoff = cutoffFor(priority == null ? recheckDays : priority === 1 ? MAIN_RECHECK_DAYS : MINOR_RECHECK_DAYS)
    for (const e of engines) {
      const l = latest.get(`${p.id}|${e.key}`)
      if (l === today) continue
      if (!opts.force && l && l > cutoff) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      due.push({ promptId: p.id, prompt: p.prompt, engine: e.key, site: (p.seo_sites as any).display_name })
      estimate += e.estCost
    }
  }
  if (!due.length) return { due, skipped: [] }

  const spent = await monthSpend(sb)
  if (spent + estimate > budget) {
    return {
      due: [],
      skipped: [
        `ไม่ถาม AI ${due.length} ครั้ง — ใช้ไปแล้ว $${spent.toFixed(2)} + รอบนี้ ~$${estimate.toFixed(2)} เกินเพดาน $${budget.toFixed(2)}/เดือน`,
      ],
    }
  }
  return { due, skipped: [] }
}

/** ถาม AI 1 ข้อ (งานในคิว) — บันทึกคำตอบ + ค่าใช้จ่าย · คืน event ถ้าการอ้างเราเปลี่ยนจากรอบก่อน */
export async function askOne(
  sb: SupabaseClient,
  promptId: string,
  engine: AeoEngine
): Promise<{ cited: boolean; mentioned: boolean; cost: number; event: AeoEvent | null }> {
  const { data: p, error } = await sb
    .from('seo_aeo_prompts')
    .select('id, prompt, site_id, seo_sites(domain, display_name)')
    .eq('id', promptId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!p) return { cited: false, mentioned: false, cost: 0, event: null } // คำถามถูกลบไปแล้ว
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const site = p.seo_sites as any as { domain: string; display_name: string }
  const today = bangkokDate()

  const { data: prev } = await sb
    .from('seo_aeo_results')
    .select('cited')
    .eq('prompt_id', promptId)
    .eq('engine', engine)
    .lt('checked_on', today)
    .order('checked_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  const a = await askAi(engine, p.prompt)
  const { mentioned, cited } = analyzeAnswer(a, { domain: site.domain, displayName: site.display_name })
  const { error: insErr } = await sb.from('seo_aeo_results').upsert(
    {
      prompt_id: promptId,
      engine,
      checked_on: today,
      mentioned,
      cited,
      sources: a.sources,
      answer: a.text,
      model: a.model,
      cost_usd: a.cost,
    },
    { onConflict: 'prompt_id,engine,checked_on' }
  )
  if (insErr) throw new Error(insErr.message)
  await sb.from('seo_api_costs').insert({
    provider: 'dataforseo',
    endpoint: `aeo/${engine}`,
    units: 1,
    cost_usd: a.cost,
    note: `ถาม AI: ${p.prompt.slice(0, 60)}`,
  })
  const event: AeoEvent | null =
    prev && prev.cited !== cited ? { siteId: p.site_id, site: site.display_name, prompt: p.prompt, engine, kind: cited ? 'cited' : 'lost' } : null
  return { cited, mentioned, cost: a.cost, event }
}
