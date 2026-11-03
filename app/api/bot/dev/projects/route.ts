// GET /api/bot/dev/projects — โปรเจกต์ dev tracker ที่ผู้เรียกจัดการได้ (แอดมิน/กุญแจ dev = ทุกโปรเจกต์) พร้อมจำนวนเคสเปิด
import type { NextRequest } from 'next/server'
import { apiJson, authBotApi, untyped } from '@/lib/services/bot/botApi'

export async function GET(request: NextRequest) {
  const a = await authBotApi(request)
  if ('error' in a) return a.error
  const { caller } = a
  const sb = untyped(caller.sb)
  let q = sb.from('dev_projects').select('id, slug, name, production_url, staging_url, is_active, dev_uat_cases(count)').neq('dev_uat_cases.status', 'closed').order('slug')
  if (!caller.isAdmin) {
    const { data: m } = await sb.from('dev_project_members').select('project_id').eq('user_id', caller.user.id).eq('role', 'manager')
    q = q.in('id', (m ?? []).map((x: { project_id: string }) => x.project_id))
  }
  const { data, error } = await q
  if (error) return apiJson({ error: error.message }, 500)
  return apiJson({
    projects: (data ?? []).map((p: Record<string, unknown>) => ({
      slug: p.slug,
      name: p.name,
      production_url: p.production_url,
      staging_url: p.staging_url,
      is_active: p.is_active,
      open_cases: (p.dev_uat_cases as { count: number }[])?.[0]?.count ?? 0,
    })),
  })
}
