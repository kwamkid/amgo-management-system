// app/api/seo/v1/_shared.ts — ตรวจกุญแจ + ดึงเว็บที่กุญแจนี้เห็นได้ (ใช้ร่วมทุก route ใน v1)

import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, authSeoApi, canSeeSite } from '@/lib/services/seo/seoApi'

export type ApiSite = { id: string; name: string; domain: string; dataThrough: string | null }

/** คืน { sb, site } หรือ Response error */
export async function siteFromRequest(request: NextRequest, id: string) {
  const caller = await authSeoApi(request)
  if (!caller) return { error: apiError(401, 'API key ไม่ถูกต้องหรือถูกเพิกถอนแล้ว') }
  if (!/^[0-9a-f-]{36}$/i.test(id) || !canSeeSite(caller, id)) return { error: apiError(404, 'ไม่พบเว็บนี้') }
  const sb = createAdminClient()
  const { data } = await sb.from('seo_sites').select('id, display_name, domain, synced_through').eq('id', id).eq('is_active', true).maybeSingle()
  if (!data) return { error: apiError(404, 'ไม่พบเว็บนี้') }
  const site: ApiSite = { id: data.id, name: data.display_name, domain: data.domain, dataThrough: data.synced_through }
  return { sb, site }
}
