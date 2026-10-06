// lib/services/seo/dataforseo.ts
//
// DataForSEO SERP API (Google organic) — ฝั่งเซิร์ฟเวอร์เท่านั้น
//
// ใช้ standard queue (task_post → task_get) ไม่ใช้ live — ถูกกว่าหลายเท่า แลกกับรอผล
// ไม่กี่นาที ซึ่งพอสำหรับงานรายสัปดาห์ · task_get ไม่เสียเงิน ยิงซ้ำได้
//
// ค่าใช้จ่ายจริงเอาจากช่อง `cost` ที่ API คืนมา (ไม่ hardcode ราคา — ราคาเปลี่ยนได้)
//
// env: DATAFORSEO_LOGIN · DATAFORSEO_PASSWORD (รหัส API จากหน้า dashboard ของ DataForSEO)

const API = 'https://api.dataforseo.com/v3'

/** ประเทศไทย · ภาษาไทย */
const LOCATION_CODE = 2764
const LANGUAGE_CODE = 'th'
/** ดูลึก 100 อันดับ — ไม่ติดในนี้ = position null */
const DEPTH = 100

export type Device = 'mobile' | 'desktop'

function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw new Error('ยังไม่ได้ตั้ง DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD')
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`
}

export const hasDataForSeoCredentials = () => !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD

/* eslint-disable @typescript-eslint/no-explicit-any */
async function call(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || (json.status_code && json.status_code >= 40000)) {
    throw new Error(`DataForSEO ${json.status_code ?? res.status}: ${json.status_message ?? 'ไม่ทราบสาเหตุ'}`)
  }
  return json
}

export type PostedTask = { taskId: string; tag: string; cost: number }

/** ส่งคำไปคิว — ครั้งละไม่เกิน 100 คำ · tag = keyword_id ไว้จับคู่ตอนได้ผล */
export async function postSerpTasks(items: { keyword: string; tag: string }[], device: Device): Promise<{
  posted: PostedTask[]
  failed: { tag: string; error: string }[]
}> {
  const posted: PostedTask[] = []
  const failed: { tag: string; error: string }[] = []
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100)
    const json = await call('/serp/google/organic/task_post', {
      method: 'POST',
      body: JSON.stringify(
        batch.map((it) => ({
          keyword: it.keyword,
          tag: it.tag,
          location_code: LOCATION_CODE,
          language_code: LANGUAGE_CODE,
          device,
          os: device === 'mobile' ? 'android' : 'windows',
          depth: DEPTH,
        }))
      ),
    })
    for (const t of json.tasks ?? []) {
      const tag = t.data?.tag ?? ''
      if (t.status_code === 20100) posted.push({ taskId: t.id, tag, cost: Number(t.cost ?? 0) })
      else failed.push({ tag, error: `${t.status_code} ${t.status_message}` })
    }
  }
  return { posted, failed }
}

export type SerpResult =
  | { state: 'pending' }
  | { state: 'failed'; error: string }
  | {
      state: 'done'
      items: any[]
    }

/** ผลของงานเดียว — ยังไม่เสร็จ = pending (ไม่เสียเงิน ถามซ้ำได้) */
export async function getSerpTask(taskId: string): Promise<SerpResult> {
  const res = await fetch(`${API}/serp/google/organic/task_get/advanced/${taskId}`, {
    headers: { Authorization: authHeader() },
  })
  const json = await res.json().catch(() => ({}))
  const t = json.tasks?.[0]
  if (!t) return { state: 'failed', error: `ไม่มีผลของงาน ${taskId}` }
  // 40601 = Task Handed · 40602 = Task in Queue — ยังไม่เสร็จ
  if (t.status_code === 40601 || t.status_code === 40602) return { state: 'pending' }
  if (t.status_code !== 20000) return { state: 'failed', error: `${t.status_code} ${t.status_message}` }
  return { state: 'done', items: t.result?.[0]?.items ?? [] }
}

/** ตรงกับโดเมนเราไหม — นับ subdomain (www., shop.) เป็นของเราด้วย */
export const isOurDomain = (domain: string | undefined, ours: string) =>
  !!domain && (domain === ours || domain.endsWith(`.${ours}`))

export type ParsedSerp = {
  position: number | null
  rankedUrl: string | null
  hasAiOverview: boolean
  aiOverviewCitesUs: boolean
  aiOverviewRefs: { domain: string; url: string }[]
  topCompetitors: { rank: number; domain: string; url: string; title: string }[]
}

/** แปลงผล SERP เป็นสิ่งที่เก็บ — อันดับ = rank_group ของผลแบบ organic */
export function parseSerp(items: any[], ourDomain: string): ParsedSerp {
  const organic = items.filter((i) => i.type === 'organic')
  const mine = organic.find((i) => isOurDomain(i.domain, ourDomain))

  const refs: { domain: string; url: string }[] = []
  const collect = (node: any) => {
    for (const r of node?.references ?? []) if (r?.url) refs.push({ domain: r.domain ?? '', url: r.url })
    for (const child of node?.items ?? []) collect(child)
  }
  const aio = items.filter((i) => i.type === 'ai_overview')
  aio.forEach(collect)
  const uniqueRefs = Array.from(new Map(refs.map((r) => [r.url, r])).values())

  return {
    position: mine?.rank_group ?? null,
    rankedUrl: mine?.url ?? null,
    hasAiOverview: aio.length > 0,
    aiOverviewCitesUs: uniqueRefs.some((r) => isOurDomain(r.domain, ourDomain)),
    aiOverviewRefs: uniqueRefs.slice(0, 20),
    topCompetitors: organic
      .filter((i) => i.rank_group <= 10)
      .map((i) => ({ rank: i.rank_group, domain: i.domain, url: i.url, title: i.title ?? '' })),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
