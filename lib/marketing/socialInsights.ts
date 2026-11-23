// Step 3b of the marketing plan — followers / reach / views per platform per day from aoosocial's
// account_insights_daily (snapshot written there by its cron sync-account-insights at 06:00 Bangkok).
// Server only. aoosocial is READ ONLY from amgo.
//   followers = sum of the brand's accounts on that platform (Stokke FB + Babyzen FB …), KPI shows the latest
//   reach / views = sum per day. IG has followers only (aoosocial lacks Meta's IG insights permission).

import type { SupabaseClient } from '@supabase/supabase-js'
import { aoosocialDb } from '@/lib/aoosocial/db'
import type { Database } from '@/types/database'
import { brandAccountIds } from './socialPosts'

type Db = SupabaseClient<Database>

const METRICS = ['followers', 'reach', 'views'] as const

interface InsightRow {
  date: string
  followers: number | null
  reach: number | null
  views: number | null
  account: { platform: string } | null
}

export async function syncBrandInsights(db: Db, brand: string, from: string, to: string) {
  const ids = await brandAccountIds(db, brand)
  if (!ids.length) return { brand, skipped: 'ยังไม่ได้ผูกบัญชี aoosocial' }

  const { data, error } = await aoosocialDb()
    .from('account_insights_daily')
    .select('date, followers, reach, views, account:social_accounts(platform)')
    .in('social_account_id', ids)
    .gte('date', from)
    .lte('date', to)
    .limit(5000)
  if (error) throw new Error(`aoosocial: ${error.message}`)

  const sum = new Map<string, number>()
  for (const r of (data ?? []) as unknown as InsightRow[]) {
    if (!r.account) continue
    for (const m of METRICS) {
      const v = r[m]
      if (v == null) continue
      const k = `${m}|${r.account.platform}|${r.date}`
      sum.set(k, (sum.get(k) ?? 0) + v)
    }
  }

  const del = await db
    .from('marketing_metric_daily')
    .delete()
    .eq('brand', brand)
    .eq('source', 'aoosocial')
    .in('metric', [...METRICS])
    .gte('date', from)
    .lte('date', to)
  if (del.error) throw del.error
  const now = new Date().toISOString()
  const insert = [...sum].map(([k, value]) => {
    const [metric, channel, date] = k.split('|')
    return { brand, metric, channel, date, value, source: 'aoosocial', synced_at: now }
  })
  for (let i = 0; i < insert.length; i += 500) {
    const { error: e } = await db.from('marketing_metric_daily').insert(insert.slice(i, i + 500))
    if (e) throw e
  }
  return { brand, from, to, rows: insert.length }
}

export const SOCIAL_INSIGHTS_KIND = 'marketing.social.insights'

export const socialInsightsJob = (brand: string, from: string, to: string, groupKey: string, label: string) => ({
  kind: SOCIAL_INSIGHTS_KIND,
  payload: { brand, from, to },
  groupKey,
  label: `ผู้ติดตาม/reach aoosocial · ${label}`,
})
