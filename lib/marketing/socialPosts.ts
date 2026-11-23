// Step 3a of the marketing plan — a brand's posts from aoosocial (posts + post_targets of the
// accounts in marketing_brand_links.aoosocial_account_ids). Server only.
//   brandPosts()      → the ปฏิทินโพสต์ tab (read live, one query)
//   syncBrandPosts()  → metric 'posts' per platform per day (published targets) in marketing_metric_daily

import type { SupabaseClient } from '@supabase/supabase-js'
import { aoosocialDb } from '@/lib/aoosocial/db'
import type { Database } from '@/types/database'

type Db = SupabaseClient<Database>

export interface CalendarPost {
  id: string
  /** published time, else scheduled time (ISO) */
  at: string
  status: string
  caption: string
  targets: { platform: string; account: string; status: string; url: string | null }[]
}

interface TargetRow {
  status: string
  platform_url: string | null
  completed_at: string | null
  account: { platform: string; display_name: string } | null
  post: { id: string; caption: string; status: string; scheduled_at: string | null; published_at: string | null } | null
}

/** Facebook returns relative paths ('/reel/123/') */
const absUrl = (u: string | null) => (u && u.startsWith('/') ? `https://www.facebook.com${u}` : u)

const thDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10)

export async function brandAccountIds(db: Db, brand: string): Promise<string[]> {
  const { data, error } = await db.from('marketing_brand_links').select('aoosocial_account_ids').eq('brand', brand).maybeSingle()
  if (error) throw error
  return data?.aoosocial_account_ids ?? []
}

/** targets of these accounts whose post is published or scheduled inside [from, to] (Thai dates) */
async function targets(accountIds: string[], from: string, to: string): Promise<TargetRow[]> {
  if (!accountIds.length) return []
  const lo = `${from}T00:00:00+07:00`
  const hi = `${to}T23:59:59+07:00`
  const { data, error } = await aoosocialDb()
    .from('post_targets')
    .select(
      'status, platform_url, completed_at, account:social_accounts(platform, display_name), post:posts!inner(id, caption, status, scheduled_at, published_at, deleted_at)'
    )
    .in('social_account_id', accountIds)
    .is('post.deleted_at', null)
    .or(`and(published_at.gte.${lo},published_at.lte.${hi}),and(scheduled_at.gte.${lo},scheduled_at.lte.${hi})`, { referencedTable: 'posts' })
    .limit(1000)
  if (error) throw new Error(`aoosocial: ${error.message}`)
  return (data ?? []) as unknown as TargetRow[]
}

export async function brandPosts(db: Db, brand: string, from: string, to: string): Promise<CalendarPost[]> {
  const rows = await targets(await brandAccountIds(db, brand), from, to)
  const byPost = new Map<string, CalendarPost>()
  for (const r of rows) {
    if (!r.post) continue
    const at = r.post.published_at ?? r.post.scheduled_at
    if (!at) continue
    const p = byPost.get(r.post.id) ?? { id: r.post.id, at, status: r.post.status, caption: r.post.caption.slice(0, 200), targets: [] }
    p.targets.push({ platform: r.account?.platform ?? "", account: r.account?.display_name ?? "", status: r.status, url: absUrl(r.platform_url) })
    byPost.set(r.post.id, p)
  }
  return [...byPost.values()].sort((a, b) => a.at.localeCompare(b.at))
}

/** replace the brand's aoosocial 'posts' rows in [from, to]: published targets per platform per day */
export async function syncBrandPosts(db: Db, brand: string, from: string, to: string) {
  const ids = await brandAccountIds(db, brand)
  if (!ids.length) return { brand, skipped: 'ยังไม่ได้ผูกบัญชี aoosocial' }
  const rows = await targets(ids, from, to)
  const count = new Map<string, number>()
  for (const r of rows) {
    if (r.status !== 'success' || !r.account) continue
    const at = r.post?.published_at ?? r.completed_at
    if (!at) continue
    const day = thDay(at)
    if (day < from || day > to) continue
    const k = `${r.account.platform}|${day}`
    count.set(k, (count.get(k) ?? 0) + 1)
  }
  const del = await db
    .from('marketing_metric_daily')
    .delete()
    .eq('brand', brand)
    .eq('source', 'aoosocial')
    .eq('metric', 'posts')
    .gte('date', from)
    .lte('date', to)
  if (del.error) throw del.error
  const now = new Date().toISOString()
  const insert = [...count].map(([k, value]) => {
    const [channel, date] = k.split('|')
    return { brand, metric: 'posts', channel, date, value, source: 'aoosocial', synced_at: now }
  })
  if (insert.length) {
    const { error } = await db.from('marketing_metric_daily').insert(insert)
    if (error) throw error
  }
  return { brand, from, to, posts: insert.reduce((s, r) => s + r.value, 0) }
}

export const SOCIAL_POSTS_KIND = 'marketing.social.posts'

export const socialPostsJob = (brand: string, from: string, to: string, groupKey: string, label: string) => ({
  kind: SOCIAL_POSTS_KIND,
  payload: { brand, from, to },
  groupKey,
  label: `นับโพสต์ aoosocial · ${label}`,
})
