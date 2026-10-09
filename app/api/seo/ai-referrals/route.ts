// app/api/seo/ai-referrals/route.ts
//
// รับยอด "คนที่ AI ส่งเข้าเว็บ" รายวันจากเว็บเอง (เจ้าของขอ 9 ต.ค. 69)
// เว็บ WordPress สรุปจาก access log ของตัวเอง (mu-plugin) แล้วส่งมาวันละครั้ง — นับทุกคน ไม่ขึ้นกับคุกกี้/GA4
//
// POST { domain, rows: [{ date, source, path, visits, people }] }
//   Authorization: Bearer <aiReferralToken(domain)> — คนละเว็บคนละ token (lib/services/seo/aiReferralToken.ts)
//   path "*" = ทั้งเว็บ (คนไม่ซ้ำต่อวัน) ไว้เป็นยอดรวม · ส่งซ้ำวันเดิม = ทับค่าเดิม (upsert) · คืน { saved }

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiReferralToken, normalizeDomain } from '@/lib/services/seo/aiReferralToken'

const SOURCES = new Set(['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude'])
const MAX_ROWS = 5000

type Row = { date: string; source: string; path: string; visits: number; people: number }

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { domain?: string; rows?: Row[] } | null
  if (!body?.domain || !Array.isArray(body.rows)) return NextResponse.json({ error: 'ต้องมี domain และ rows' }, { status: 400 })

  const domain = normalizeDomain(body.domain)
  const expected = aiReferralToken(domain)
  const got = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createAdminClient()
  const { data: site } = await sb.from('seo_sites').select('id').eq('domain', domain).maybeSingle()
  if (!site) return NextResponse.json({ error: `ไม่พบเว็บ ${domain} ในระบบ SEO` }, { status: 404 })

  const rows = body.rows
    .filter(
      (r) =>
        /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
        SOURCES.has(r.source) &&
        typeof r.path === 'string' &&
        (r.path === '*' || r.path.startsWith('/')) &&
        Number.isFinite(r.visits) &&
        Number.isFinite(r.people)
    )
    .slice(0, MAX_ROWS)
    .map((r) => ({
      site_id: site.id,
      date: r.date,
      source: r.source,
      path: r.path.slice(0, 300),
      visits: Math.max(0, Math.round(r.visits)),
      people: Math.max(0, Math.round(r.people)),
    }))
  if (!rows.length) return NextResponse.json({ saved: 0 })

  const { error } = await sb.from('seo_ai_referrals').upsert(rows, { onConflict: 'site_id,date,source,path' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: rows.length })
}
