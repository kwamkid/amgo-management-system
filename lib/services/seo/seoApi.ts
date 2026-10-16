// lib/services/seo/seoApi.ts
//
// API ภายนอกของ SEO / AEO (/api/seo/v1/...) — เว็บ/ระบบอื่นดึงข้อมูลไปใช้ (เจ้าของขอ 17 ต.ค. 69)
//
// กุญแจ: seo_api_keys (เก็บแค่ sha256) · ส่งมาทาง  Authorization: Bearer amgo_seo_…  หรือ  x-api-key
// กุญแจผูกเว็บได้ (site_ids) — ว่าง = ทุกเว็บ · เพิกถอนแล้วใช้ไม่ได้ทันที
// ตัวเลขทั้งหมดใช้ฟังก์ชันเดียวกับหน้าเว็บ (seoService + rankRules.judgeRank) — ห้ามคิดใหม่ที่นี่
//
// ⚠️ กุญแจอ่านข้อมูลได้ทั้งเว็บ — เรียกจากฝั่ง server ของเว็บปลายทาง อย่าฝังใน JavaScript หน้าเว็บ

import { createHash, randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PREFIX = 'amgo_seo_'

export const hashApiKey = (key: string) => createHash('sha256').update(key).digest('hex')

/** กุญแจใหม่ — คืนตัวเต็ม (โชว์ครั้งเดียว) + hash ไว้เก็บ */
export function newApiKey() {
  const key = PREFIX + randomBytes(24).toString('base64url')
  return { key, hash: hashApiKey(key), prefix: key.slice(0, PREFIX.length + 4) }
}

export type SeoApiCaller = { keyId: string; siteIds: string[] | null }

/** ตรวจกุญแจ — null = ไม่ผ่าน */
export async function authSeoApi(request: NextRequest): Promise<SeoApiCaller | null> {
  const auth = request.headers.get('authorization')
  const key = (auth?.startsWith('Bearer ') ? auth.slice(7) : request.headers.get('x-api-key'))?.trim()
  if (!key?.startsWith(PREFIX) || key.length > 100) return null
  const sb = createAdminClient()
  const { data } = await sb
    .from('seo_api_keys')
    .select('id, site_ids, last_used_at')
    .eq('key_hash', hashApiKey(key))
    .is('revoked_at', null)
    .maybeSingle()
  if (!data) return null
  // บันทึกว่าใช้ล่าสุดเมื่อไหร่ — ไม่เกินนาทีละครั้ง ไม่ต้องเขียนทุกคำขอ
  if (!data.last_used_at || Date.now() - new Date(data.last_used_at).getTime() > 60_000)
    await sb.from('seo_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return { keyId: data.id, siteIds: data.site_ids }
}

export const canSeeSite = (c: SeoApiCaller, siteId: string) => !c.siteIds || c.siteIds.includes(siteId)

/** ให้เว็บอื่นเรียกได้ (CORS) — กุญแจคือตัวคุมสิทธิ์ ไม่ใช่ origin */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Api-Key, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export const apiOptions = () => new NextResponse(null, { status: 204, headers: CORS })

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    // ข้อมูลอัปเดตวันละครั้ง (cron ตี 4) — ให้ปลายทาง cache ได้ 5 นาที
    headers: { ...CORS, 'Cache-Control': status === 200 ? 'private, max-age=300' : 'no-store' },
  })
}

export const apiError = (status: number, error: string) => apiJson({ error }, status)
