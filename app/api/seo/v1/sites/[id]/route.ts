// GET /api/seo/v1/sites/{id}?days=28&compare=prev|yoy — ภาพรวมเว็บ
//   gsc: คลิก/การแสดงผล/CTR/อันดับเฉลี่ย ช่วงนี้ vs ช่วงเทียบ + รายวัน
//   keywords: คำเป้าหมายติดอันดับกี่คำ (ตัวตัดสินเดียวกับหน้าเว็บ — rankRules.judgeRank)
//   ai: AI แต่ละตัวอ้างเรากี่ข้อ (30 วัน) · aiOverview: คำตอบ Google AI Overview จริง (LLM Mentions รายเดือน)
import type { NextRequest } from 'next/server'
import { apiJson, apiOptions } from '@/lib/services/seo/seoApi'
import { AI_ENGINES, getAiSummaries } from '@/lib/services/seo/aiSummary'
import {
  addDays,
  getDailyTotals,
  getKeywordSummaries,
  getLlmSummaries,
  pctChange,
  periods,
  sumTotals,
  type CompareMode,
} from '@/lib/services/seo/seoService'
import { siteFromRequest } from '../../_shared'

export const OPTIONS = apiOptions

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await siteFromRequest(request, (await params).id)
  if ('error' in r) return r.error
  const { sb, site } = r
  const q = request.nextUrl.searchParams
  const days = Math.min(365, Math.max(7, Number(q.get('days')) || 28))
  const compare: CompareMode = q.get('compare') === 'yoy' ? 'yoy' : 'prev'

  const per = site.dataThrough ? periods(site.dataThrough, days, compare) : null
  const [totals, kw, ai, llm] = await Promise.all([
    per ? getDailyTotals([site.id], addDays(per.prev.from, 0), sb) : Promise.resolve(new Map()),
    getKeywordSummaries([site.id], sb),
    getAiSummaries(sb, [site.id]),
    getLlmSummaries([site.id], sb),
  ])

  let gsc = null
  if (per) {
    const rows = totals.get(site.id) ?? []
    const cur = sumTotals(rows, per.cur.from, per.cur.to)
    const prev = sumTotals(rows, per.prev.from, per.prev.to)
    const earliest = rows[0]?.date
    const comparable = !!earliest && earliest <= per.prev.from
    gsc = {
      period: per.cur,
      comparedWith: per.prev,
      current: cur,
      previous: comparable ? prev : null,
      changePct: comparable
        ? { clicks: pctChange(cur.clicks, prev.clicks), impressions: pctChange(cur.impressions, prev.impressions) }
        : null,
      daily: rows.filter((d: { date: string }) => d.date >= per.cur.from && d.date <= per.cur.to),
    }
  }
  const aiSum = ai.get(site.id)
  return apiJson({
    site,
    gsc,
    keywords: kw.get(site.id) ?? null,
    ai: Object.fromEntries(
      AI_ENGINES.map((e) => {
        const c = aiSum?.[e.key]
        return [e.key, { label: e.label, cited: c?.cited ?? 0, mentioned: c?.mentioned ?? 0, total: c?.total ?? 0 }]
      })
    ),
    aiOverview: llm.get(site.id) ?? null,
  })
}
