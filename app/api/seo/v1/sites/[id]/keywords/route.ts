// GET /api/seo/v1/sites/{id}/keywords?all=1 — คำเป้าหมายรายคำ (ค่าเริ่มต้น: เฉพาะคำที่ติดตาม)
//   rank = ตัวตัดสินเดียวกับหน้าเว็บ (rankRules.judgeRank: ประวัติ 10 ครั้ง + หน้าที่เจอ + GSC)
//   rankReason = เหตุผลภาษาคน · rankSource: check = ระบบเช็ค · gsc = คนค้นจริง · none = ไม่ติด
//
// POST /api/seo/v1/sites/{id}/keywords — เพิ่มคำเป้าหมาย (กุญแจต้องติ๊ก "เพิ่มคำได้" · can_write)
//   { keywords: ["กระเช้าผลไม้", "ของเยี่ยมไข้"], group?, targetPath?: "/get-well-soon/", priority?: 1|2|3 }
//   คำที่มีอยู่แล้ว = อัปเดตกลุ่ม/หน้าเป้าหมายแทนเพิ่มซ้ำ · คำใหม่ได้คำถาม AI อัตโนมัติ
//   เช็คอันดับครั้งแรกในรอบ cron ตี 4 ถัดไป (เสียเงิน ~$0.006/คำ/รอบ)
import type { NextRequest } from 'next/server'
import { apiError, apiJson, apiOptions } from '@/lib/services/seo/seoApi'
import { addTargetKeywords, getTargetKeywords } from '@/lib/services/seo/seoService'
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

/** ต่อครั้งเพิ่มได้สูงสุด — กันพลาดยิงทีละพันคำแล้วเงินเช็คอันดับบาน */
const MAX_ADD = 100

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await siteFromRequest(request, (await params).id)
  if ('error' in r) return r.error
  if (!r.caller.canWrite) return apiError(403, 'กุญแจนี้อ่านได้อย่างเดียว — เปิด "เพิ่มคำเป้าหมายได้" ที่หน้าตั้งค่า SEO ก่อน')
  const body = await request.json().catch(() => null)
  const raw: unknown[] = Array.isArray(body?.keywords) ? body.keywords : typeof body?.keywords === 'string' ? body.keywords.split('\n') : []
  // บรรทัดละคำ — ตัดขึ้นบรรทัดในคำ · ยาวเกิน 100 ตัวทิ้ง · ซ้ำในชุดเดียวกันนับครั้งเดียว
  const words = [...new Set(raw.filter((k): k is string => typeof k === 'string').map((k) => k.replace(/\s+/g, ' ').trim().toLowerCase()).filter((k) => k && k.length <= 100))]
  if (!words.length) return apiError(400, 'ต้องส่ง keywords เป็นรายการคำ เช่น { "keywords": ["กระเช้าผลไม้"] }')
  if (words.length > MAX_ADD) return apiError(400, `เพิ่มได้ครั้งละไม่เกิน ${MAX_ADD} คำ`)
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
  const priority = [1, 2, 3].includes(Number(body?.priority)) ? Number(body.priority) : undefined
  try {
    const saved = await addTargetKeywords(
      r.site.id,
      { lines: words.join('\n'), groupName: str(body?.group, 60), targetPath: str(body?.targetPath, 300), priority },
      r.sb
    )
    return apiJson({ site: r.site, saved, keywords: words, note: 'เช็คอันดับครั้งแรกในรอบตี 4 ถัดไป' }, 201)
  } catch (e) {
    return apiError(500, (e as Error).message)
  }
}
