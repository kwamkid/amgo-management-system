// GET /api/seo/v1/sites/{id}/ai — AEO
//   engines: AI แต่ละตัว (Google AI Overview / ChatGPT / Perplexity / Gemini) อ้างเราข้อไหน (30 วัน)
//            state: cited = ใส่ลิงก์เรา · mentioned = เอ่ยชื่อ ไม่มีลิงก์ · none = ไม่พูดถึงเรา
//   aiOverview: คำตอบ AI จริงจาก DataForSEO (เดือนละครั้ง) — share เทียบคู่แข่ง + คำถามที่อ้างเรา / อ้างคู่แข่งแต่ไม่อ้างเรา
import type { NextRequest } from 'next/server'
import { apiJson, apiOptions } from '@/lib/services/seo/seoApi'
import { AI_ENGINES, getAiSummaries } from '@/lib/services/seo/aiSummary'
import { getLlmMentions } from '@/lib/services/seo/seoService'
import { siteFromRequest } from '../../../_shared'

export const OPTIONS = apiOptions

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await siteFromRequest(request, (await params).id)
  if ('error' in r) return r.error
  const [ai, llm] = await Promise.all([getAiSummaries(r.sb, [r.site.id]), getLlmMentions(r.site.id, r.sb)])
  const sum = ai.get(r.site.id)
  return apiJson({
    site: r.site,
    engines: Object.fromEntries(AI_ENGINES.map((e) => [e.key, { label: e.label, ...(sum?.[e.key] ?? { cited: 0, mentioned: 0, total: 0, items: [] }) }])),
    aiOverview: {
      fetchedOn: llm.fetchedOn,
      share: llm.share,
      citedUs: llm.questions.filter((q) => q.kind === 'ours'),
      opportunities: llm.questions.filter((q) => q.kind === 'gap'),
    },
  })
}
