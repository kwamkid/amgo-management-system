// GET /api/seo/v1/sites — เว็บที่กุญแจนี้ดูได้
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError, apiJson, apiOptions, authSeoApi } from '@/lib/services/seo/seoApi'

export const OPTIONS = apiOptions

export async function GET(request: NextRequest) {
  const caller = await authSeoApi(request)
  if (!caller) return apiError(401, 'API key ไม่ถูกต้องหรือถูกเพิกถอนแล้ว')
  let q = createAdminClient().from('seo_sites').select('id, display_name, domain, synced_through').eq('is_active', true).order('display_name')
  if (caller.siteIds) q = q.in('id', caller.siteIds)
  const { data, error } = await q
  if (error) return apiError(500, error.message)
  return apiJson({
    sites: (data ?? []).map((s) => ({ id: s.id, name: s.display_name, domain: s.domain, dataThrough: s.synced_through })),
  })
}
