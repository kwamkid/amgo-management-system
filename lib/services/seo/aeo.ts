// lib/services/seo/aeo.ts
//
// ถาม AI (ChatGPT · Perplexity · Gemini) ผ่าน DataForSEO LLM Responses — ฝั่งเซิร์ฟเวอร์เท่านั้น
//
// ใช้แบบ live (ตอบใน ~5–10 วิ) ไม่ใช้คิว — Perplexity ไม่มีคิวให้ใช้อยู่แล้ว และเร็วพอ
// เปิดค้นเว็บ (web_search) เสมอ — ลูกค้าจริงใช้ AI แบบค้นเว็บ คำตอบจึงอ้างลิงก์ได้
//
// ราคาจริง 6 ต.ค. 69 (ต่อคำถาม): ChatGPT gpt-5-mini ~$0.015 · Perplexity sonar ~$0.006
// · Gemini 2.5 flash ~$0.038 — ส่วนใหญ่คือค่าค้นเว็บ · ใช้ค่า cost ที่ API คืนมาเสมอ

import { isOurDomain } from './dataforseo'

const API = 'https://api.dataforseo.com/v3/ai_optimization'

export type AeoEngine = 'chatgpt' | 'perplexity' | 'gemini'

/** models = ลองตามลำดับ — ตัวแรกติด rate limit / ล่ม (ฝั่งผู้ให้บริการ) ใช้ตัวถัดไป */
export const AEO_ENGINES: { key: AeoEngine; label: string; path: string; models: string[]; estCost: number }[] = [
  // gpt-5-mini: ถูกกว่าและตอบด้วยเว็บจริง — gpt-4o-mini ชอบตอบชื่อร้านลอย ๆ + ลิงก์ Google Maps (ทดสอบ 6 ต.ค. 69)
  { key: 'chatgpt', label: 'ChatGPT', path: 'chat_gpt', models: ['gpt-5-mini', 'gpt-5.4-mini'], estCost: 0.02 },
  { key: 'perplexity', label: 'Perplexity', path: 'perplexity', models: ['sonar'], estCost: 0.01 },
  // gemini-2.5-flash ติด rate_limit_exceeded ทั้งวัน 7 ต.ค. 69 → ใช้ 3.5-flash-lite เป็นหลัก
  { key: 'gemini', label: 'Gemini', path: 'gemini', models: ['gemini-3.5-flash-lite', 'gemini-2.5-flash'], estCost: 0.04 },
]

/** เก็บคำตอบไว้ไม่เกินเท่านี้ — พอให้อ่านว่า AI พูดถึงใครบ้าง */
const MAX_ANSWER = 6000

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw new Error('ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD')
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

export type AeoSource = { domain: string; title: string; url: string }
export type AeoAnswer = { text: string; sources: AeoSource[]; cost: number; model: string }

/** โดเมนของลิงก์ที่ AI อ้าง — Gemini ส่งลิงก์ redirect ของ Google มา แต่ title คือโดเมนจริง */
function sourceDomain(url: string, title: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (!host.endsWith('vertexaisearch.cloud.google.com')) return host
  } catch {
    /* url แปลก ๆ — ลองใช้ title */
  }
  const t = title.trim().toLowerCase().replace(/^www\./, '')
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(t) ? t : ''
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function askAi(engine: AeoEngine, prompt: string): Promise<AeoAnswer> {
  const cfg = AEO_ENGINES.find((e) => e.key === engine)!
  let lastErr: Error | null = null
  for (const model of cfg.models) {
    try {
      return await askModel(cfg, model, prompt)
    } catch (e) {
      lastErr = e as Error
      // ลองรุ่นถัดไปเฉพาะตอนฝั่งผู้ให้บริการไม่พร้อม (5xxxx) — คำถามผิด/เงินหมด ไม่ต้องลองต่อ
      if (!/\b5\d{4}\b|rate_limit|unavailable/i.test(lastErr.message)) throw lastErr
    }
  }
  throw lastErr ?? new Error(`${cfg.label}: ไม่มีรุ่นให้ใช้`)
}

async function askModel(cfg: (typeof AEO_ENGINES)[number], model: string, prompt: string): Promise<AeoAnswer> {
  const res = await fetch(`${API}/${cfg.path}/llm_responses/live`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify([{ user_prompt: prompt, model_name: model, web_search: true }]),
    // ปกติ 5–15 วิ · ตัดที่ 18 วิ ไม่ให้งาน cron เกิน 60 วิ ของ Vercel (ครั้งที่หลุดถามใหม่รอบหน้า)
    signal: AbortSignal.timeout(18_000),
  })
  const json = await res.json().catch(() => ({}))
  const t = json.tasks?.[0]
  if (!res.ok || !t || t.status_code !== 20000) {
    throw new Error(`${cfg.label} ${t?.status_code ?? res.status}: ${t?.status_message ?? json.status_message ?? 'ไม่ทราบสาเหตุ'}`)
  }
  const r = t.result?.[0] ?? {}
  const texts: string[] = []
  const sources: AeoSource[] = []
  for (const item of r.items ?? []) {
    // รุ่นที่คิดก่อนตอบ (gpt-5-mini) ส่งบันทึกความคิดภาษาอังกฤษมาด้วย — เอาเฉพาะคำตอบจริง
    if (item.type === 'reasoning') continue
    for (const sec of item.sections ?? []) {
      if (sec.text) texts.push(sec.text)
      for (const a of sec.annotations ?? []) {
        if (!a?.url) continue
        const title = a.title ?? ''
        sources.push({ domain: sourceDomain(a.url, title), title, url: a.url })
      }
    }
  }
  const unique = Array.from(new Map(sources.map((s) => [s.url, s])).values())
  return {
    text: texts.join('\n\n').slice(0, MAX_ANSWER),
    sources: unique.slice(0, 30),
    cost: Number(t.cost ?? 0),
    model: r.model_name ?? model,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * คำตอบพูดถึงเราไหม / อ้างลิงก์เราไหม
 * พูดถึง = มีชื่อแบรนด์ (ไม่สนช่องว่าง/ตัวพิมพ์) หรือโดเมนในเนื้อความ · อ้าง = ลิงก์ที่มาเป็นโดเมนเรา
 */
export function analyzeAnswer(a: AeoAnswer, site: { domain: string; displayName: string }) {
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const body = squash(a.text)
  const stem = site.domain.split('.')[0]
  const terms = [squash(site.displayName), site.domain.toLowerCase(), stem].filter((t) => t.length >= 4)
  const cited = a.sources.some((s) => isOurDomain(s.domain, site.domain))
  return { mentioned: cited || terms.some((t) => body.includes(t)), cited }
}
