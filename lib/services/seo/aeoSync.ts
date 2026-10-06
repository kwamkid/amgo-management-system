// lib/services/seo/aeoSync.ts
//
// AEO — ถามคำถามที่ถึงรอบกับ AI แต่ละตัว แล้วบันทึกว่าคำตอบพูดถึง/อ้างเราไหม
//
// ── จังหวะ ─────────────────────────────────────────────────────────────
// งาน SEO รายวัน (cron ตี 4): ถามคู่ (คำถาม × AI) ที่คำตอบล่าสุดเก่ากว่า aeo_recheck_days (7 วัน)
//   ทำเท่าที่เวลาเหลือ — ที่ค้างไว้ทำต่อพรุ่งนี้ (ปกติสัปดาห์ละ ~45 คู่ ใช้ไม่กี่วันก็ครบ)
// ปุ่มบนหน้าเว็บ: ถามทุกคู่ของเว็บนั้นที่ยังไม่ได้ถามวันนี้ · หน้าเว็บเรียกซ้ำจนครบ (remaining = 0)
//
// ── เงิน ──────────────────────────────────────────────────────────────
// เพดานเดือนเดียวกับอันดับ (seo_settings.monthly_budget_usd) · เช็คก่อนเริ่มทุกรอบ
// บันทึกค่าใช้จ่ายรวมต่อ AI ต่อรอบใน seo_api_costs (endpoint 'aeo/<engine>')

import type { SupabaseClient } from '@supabase/supabase-js'
import { AEO_ENGINES, analyzeAnswer, askAi, type AeoEngine } from './aeo'
import { monthSpend } from './rankSync'

const CONCURRENCY = 6

const bangkokDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export type AeoEvent = { site: string; prompt: string; engine: AeoEngine; kind: 'cited' | 'lost' }

export type AeoSummary = {
  done: number
  failed: number
  /** คู่ที่ถึงรอบแต่ยังไม่ได้ถาม (เวลาหมด) */
  remaining: number
  costUsd: number
  skipped: string[]
  events: AeoEvent[]
}

export async function runDueAeo(
  sb: SupabaseClient,
  opts: { siteId?: string; force?: boolean; deadline: number }
): Promise<AeoSummary> {
  const out: AeoSummary = { done: 0, failed: 0, remaining: 0, costUsd: 0, skipped: [], events: [] }

  const { data: cfg } = await sb
    .from('seo_settings')
    .select('monthly_budget_usd, aeo_engines, aeo_recheck_days')
    .maybeSingle()
  const engines = AEO_ENGINES.filter((e) => (cfg?.aeo_engines ?? ['chatgpt', 'perplexity', 'gemini']).includes(e.key))
  const recheckDays = cfg?.aeo_recheck_days ?? 7
  const budget = Number(cfg?.monthly_budget_usd ?? 10)
  if (!engines.length) return { ...out, skipped: ['ปิด AI ทุกตัวไว้ในตั้งค่า'] }

  let q = sb
    .from('seo_aeo_prompts')
    .select('id, prompt, site_id, seo_sites!inner(domain, display_name, is_active)')
    .eq('is_tracked', true)
  q = opts.siteId ? q.eq('site_id', opts.siteId) : q.eq('seo_sites.is_active', true)
  const { data: prompts, error } = await q
  if (error) throw new Error(error.message)
  if (!prompts?.length) return { ...out, skipped: ['ยังไม่มีคำถามที่เปิดติดตาม'] }

  const { data: last } = await sb
    .from('seo_aeo_results')
    .select('prompt_id, engine, checked_on, cited')
    .in(
      'prompt_id',
      prompts.map((p) => p.id)
    )
    .order('checked_on', { ascending: false })
  const latest = new Map<string, { checked_on: string; cited: boolean }>()
  for (const r of last ?? []) {
    const key = `${r.prompt_id}|${r.engine}`
    if (!latest.has(key)) latest.set(key, r)
  }

  const today = bangkokDate()
  const cutoff = bangkokDate(new Date(Date.now() - (recheckDays - 1) * 24 * 3600_000))
  type Job = { prompt: (typeof prompts)[number]; engine: (typeof engines)[number] }
  const due: Job[] = []
  for (const p of prompts)
    for (const e of engines) {
      const l = latest.get(`${p.id}|${e.key}`)
      if (l?.checked_on === today) continue
      if (!opts.force && l && l.checked_on > cutoff) continue
      due.push({ prompt: p, engine: e })
    }
  if (!due.length) return out

  // ประมาณการทั้งรอบด้วยราคาเผื่อ — ไม่พอ = ไม่ถามเลย (ไม่ถามครึ่ง ๆ กลาง ๆ)
  const spent = await monthSpend(sb)
  const estimate = due.reduce((s, j) => s + j.engine.estCost, 0)
  if (spent + estimate > budget) {
    out.remaining = due.length
    out.skipped.push(
      `ไม่ถาม AI ${due.length} ครั้ง — ใช้ไปแล้ว $${spent.toFixed(2)} + รอบนี้ ~$${estimate.toFixed(2)} เกินเพดาน $${budget.toFixed(2)}/เดือน`
    )
    return out
  }

  const costByEngine = new Map<AeoEngine, { cost: number; n: number }>()
  const run = async (j: Job) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const site = j.prompt.seo_sites as any as { domain: string; display_name: string }
    try {
      const a = await askAi(j.engine.key, j.prompt.prompt)
      const { mentioned, cited } = analyzeAnswer(a, { domain: site.domain, displayName: site.display_name })
      const { error: insErr } = await sb.from('seo_aeo_results').upsert(
        {
          prompt_id: j.prompt.id,
          engine: j.engine.key,
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
      const c = costByEngine.get(j.engine.key) ?? { cost: 0, n: 0 }
      costByEngine.set(j.engine.key, { cost: c.cost + a.cost, n: c.n + 1 })
      out.done++
      const prev = latest.get(`${j.prompt.id}|${j.engine.key}`)
      if (prev && prev.cited !== cited)
        out.events.push({ site: site.display_name, prompt: j.prompt.prompt, engine: j.engine.key, kind: cited ? 'cited' : 'lost' })
    } catch (e) {
      out.failed++
      if (out.failed <= 2) out.skipped.push((e as Error).message)
    }
  }

  let i = 0
  for (; i < due.length && Date.now() < opts.deadline; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(run))
  }
  out.remaining = Math.max(0, due.length - i)

  const rows = [...costByEngine.entries()].map(([engine, c]) => ({
    provider: 'dataforseo',
    endpoint: `aeo/${engine}`,
    units: c.n,
    cost_usd: c.cost,
    note: `ถาม AI ${c.n} คำถาม`,
  }))
  if (rows.length) await sb.from('seo_api_costs').insert(rows)
  out.costUsd = rows.reduce((s, r) => s + r.cost_usd, 0)
  return out
}
