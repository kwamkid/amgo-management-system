// lib/services/seo/gsc.ts
//
// ต่อ Google Search Console API ด้วย service account — ฝั่งเซิร์ฟเวอร์เท่านั้น
//
// amgo ล็อกอินด้วย LINE ไม่มี Google OAuth จึงใช้ service account
// (seo-reporting@codelab-school.iam.gserviceaccount.com) ที่เจ้าของเพิ่มเป็นผู้ใช้
// แบบ Restricted ใน GSC ของแต่ละเว็บ · เว็บใหม่ต้องเพิ่มเองทุกครั้ง
//
// ไม่ใช้แพ็กเกจ googleapis (หนักมากสำหรับ 3 endpoint) — เซ็น JWT เองด้วย
// node:crypto แล้วแลกเป็น access token ตามขั้นตอนมาตรฐานของ Google
//
// env: GSC_SERVICE_ACCOUNT_JSON = เนื้อไฟล์ JSON key ทั้งก้อน (บรรทัดเดียว)

import { createSign } from 'node:crypto'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const API = 'https://www.googleapis.com/webmasters/v3'

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string }

let cached: { token: string; expiresAt: number } | null = null

function loadAccount(): ServiceAccount {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('ยังไม่ได้ตั้ง GSC_SERVICE_ACCOUNT_JSON')
  let sa: ServiceAccount
  try {
    sa = JSON.parse(raw)
  } catch {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON ไม่ใช่ JSON ที่ถูกต้อง')
  }
  if (!sa.client_email || !sa.private_key) throw new Error('GSC_SERVICE_ACCOUNT_JSON ขาด client_email / private_key')
  // บาง UI ของ env เก็บ \n เป็นตัวอักษร 2 ตัว
  return { ...sa, private_key: sa.private_key.replace(/\\n/g, '\n') }
}

/** อีเมลของ service account — โชว์ในหน้าตั้งค่าให้ก๊อปไปเพิ่มใน GSC (ไม่ใช่ความลับ) */
export function serviceAccountEmail(): string | null {
  try {
    return loadAccount().client_email
  } catch {
    return null
  }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const sa = loadAccount()
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)
  const unsigned =
    b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) +
    '.' +
    b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }))
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key)
  const assertion = `${unsigned}.${b64url(signature)}`

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token) {
    throw new Error(`ขอ token จาก Google ไม่ได้: ${json.error_description || json.error || res.status}`)
  }
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return cached.token
}

/** error ที่บอกว่า "service account ไม่มีสิทธิ์ property นี้" แยกจาก error อื่น */
export class GscAccessError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 403 || res.status === 404) {
    throw new GscAccessError(json?.error?.message || 'service account ไม่มีสิทธิ์ property นี้')
  }
  if (!res.ok) throw new Error(`GSC ${res.status}: ${json?.error?.message || 'ไม่ทราบสาเหตุ'}`)
  return json as T
}

export type GscSiteEntry = { siteUrl: string; permissionLevel: string }

/** property ทั้งหมดที่ service account เห็น */
export async function listProperties(): Promise<GscSiteEntry[]> {
  const json = await call<{ siteEntry?: GscSiteEntry[] }>('/sites')
  return json.siteEntry ?? []
}

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

/** GSC คืนได้สูงสุดครั้งละ 25,000 แถว */
export const GSC_PAGE_SIZE = 25_000

export async function searchAnalytics(
  property: string,
  body: {
    startDate: string
    endDate: string
    dimensions: ('date' | 'query' | 'page')[]
    startRow?: number
  }
): Promise<GscRow[]> {
  const json = await call<{ rows?: GscRow[] }>(
    `/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        type: 'web',
        // 'all' = รวมข้อมูลสด 1–2 วันล่าสุดที่ยังไม่นิ่ง · ดึงซ้ำทุกวันจนนิ่งเอง
        dataState: 'all',
        rowLimit: GSC_PAGE_SIZE,
        startRow: body.startRow ?? 0,
      }),
    }
  )
  return json.rows ?? []
}

// ── URL Inspection — Google เก็บหน้านี้เข้า index หรือยัง (ฟรี · วันละ 2,000 URL ต่อ property) ──
// ใช้ token เดิม (webmasters.readonly พอ) แต่คนละ host กับ searchAnalytics

export type UrlInspection = {
  /** PASS = อยู่ใน index · NEUTRAL = ยังไม่ index · FAIL = มีปัญหา */
  verdict: string | null
  /** ข้อความจาก Google เช่น "Submitted and indexed" · "Crawled - currently not indexed" */
  coverageState: string | null
  lastCrawlTime: string | null
  googleCanonical: string | null
  userCanonical: string | null
  robotsTxtState: string | null
  indexingState: string | null
  pageFetchState: string | null
}

export async function inspectUrl(property: string, url: string): Promise<UrlInspection> {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: 'th' }),
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 403) throw new GscAccessError(json?.error?.message || 'service account ไม่มีสิทธิ์ property นี้')
  if (!res.ok) throw new Error(`URL Inspection ${res.status}: ${json?.error?.message || 'ไม่ทราบสาเหตุ'}`)
  const r = json?.inspectionResult?.indexStatusResult ?? {}
  return {
    verdict: r.verdict ?? null,
    coverageState: r.coverageState ?? null,
    lastCrawlTime: r.lastCrawlTime ?? null,
    googleCanonical: r.googleCanonical ?? null,
    userCanonical: r.userCanonical ?? null,
    robotsTxtState: r.robotsTxtState ?? null,
    indexingState: r.indexingState ?? null,
    pageFetchState: r.pageFetchState ?? null,
  }
}
