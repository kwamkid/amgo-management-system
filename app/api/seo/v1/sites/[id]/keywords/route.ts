// GET /api/seo/v1/sites/{id}/keywords?all=1 — คำเป้าหมายรายคำ (ค่าเริ่มต้น: เฉพาะคำที่ติดตาม)
//   rank = ตัวตัดสินเดียวกับหน้าเว็บ (rankRules.judgeRank: ประวัติ 10 ครั้ง + หน้าที่เจอ + GSC)
//   rankReason = เหตุผลภาษาคน · rankSource: check = ระบบเช็ค · gsc = คนค้นจริง · none = ไม่ติด
import type { NextRequest } from 'next/server'
import { apiJson, apiOptions } from '@/lib/services/seo/seoApi'
import { getTargetKeywords } from '@/lib/services/seo/seoService'
import { siteFromRequest } from '../../../_shared'

export const OPTIONS = apiOptions

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await siteFromRequest(request, (await params).id)
  if ('error' in r) return r.error
  const all = request.nextUrl.searchParams.get('all') === '1'
  const kws = (await getTargetKeywords(r.site.id, r.sb)).filter((k) => all || k.isTracked)
  return apiJson({
    site: r.site,
    keywords: kws.map((k) => {
      const last = k.snapshots[0]
      return {
        keyword: k.keyword,
        group: k.groupName || null,
        searchVolume: k.searchVolume,
        targetPath: k.targetPath,
        tracked: k.isTracked,
        rank: k.rank,
        rankBefore: k.rankBefore,
        rankStatus: k.verdict.pattern,
        rankSource: k.verdict.source,
        rankReason: k.verdict.reason,
        foundInChecks: { found: k.verdict.found, of: k.verdict.total },
        rankedUrl: last?.rankedUrl ?? null,
        lastChecked: last?.checkedOn ?? null,
        gsc: { position: k.gscPosition, impressions10d: k.gscImpressions, clicks28d: k.clicks28 },
        googleAiOverview: last?.detailed ? { shown: last.hasAiOverview, citesUs: last.aiOverviewCitesUs } : null,
        ai: Object.fromEntries(
          Object.entries(k.ai).map(([engine, a]) => [engine, a && { cited: a.cited, mentioned: a.mentioned, checkedOn: a.checkedOn, prompt: a.prompt }])
        ),
      }
    }),
  })
}
