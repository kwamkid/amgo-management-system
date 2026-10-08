// lib/services/seo/seoBrief.ts
//
// "คัดลอกสรุปไปทำเว็บ" — รวมผล SEO/AEO ของเว็บเป็นข้อความ Markdown ก้อนเดียว
// ไว้วางในโปรเจกต์เว็บ (CLAUDE.md / memo / แชทกับ AI) แล้วสั่งทำงานต่อได้ทันที
// (เจ้าของขอ 8 ต.ค. 69: "copy ข้อมูลสรุปไปใส่ใน project ทำเว็บไซต์")
//
// ฝั่งหน้าเว็บ · อ่านอย่างเดียว (RLS เจ้าของ) · ไม่เรียก API ภายนอก ไม่เสียเงิน

import { fmtDisplayRank, RANK_DEPTH } from './rankRules'
import {
  AEO_ENGINE_LABELS,
  compareGsc,
  fmtGscDate,
  getAeoPrompts,
  getDailyTotals,
  getTargetKeywords,
  periods,
  sumTotals,
  type SeoSite,
  type TargetKeyword,
} from './seoService'

const pct = (cur: number, prev: number) => (prev ? `${cur >= prev ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)}%` : 'ไม่มีช่วงเทียบ')
const pos = (p: number | null | undefined) => (p == null ? '—' : p.toFixed(1))
const pathOf = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname) || '/'
  } catch {
    return url
  }
}

function kwLine(k: TargetKeyword, ours: string) {
  const bits = [
    `**${k.keyword}**`,
    k.searchVolume != null ? `ค้น ${k.searchVolume.toLocaleString()}/ด.` : null,
    `อันดับ ${fmtDisplayRank(k.rank)}`,
    k.gscPosition != null ? `คนค้นจริงเห็นเฉลี่ย ~${k.gscPosition.toFixed(1)}` : null,
  ].filter(Boolean)
  const cur = k.snapshots[0]
  const ranked = cur?.rankedUrl ? pathOf(cur.rankedUrl) : null
  const extra: string[] = []
  if (k.targetPath) extra.push(`หน้าเป้าหมาย ${k.targetPath}${ranked && ranked !== k.targetPath ? ` แต่ Google เอา ${ranked} ไปติดแทน ⚠️` : ''}`)
  else if (ranked) extra.push(`หน้าที่ติด ${ranked}`)
  if (cur?.detailed && cur.hasAiOverview)
    extra.push(cur.aiOverviewCitesUs ? 'กล่อง AI ของ Google อ้างเรา' : 'มีกล่อง AI ของ Google แต่ไม่อ้างเรา')
  const top = (cur?.topCompetitors ?? []).filter((t) => !t.domain.endsWith(ours)).slice(0, 3)
  if (top.length) extra.push(`คู่แข่งอันดับต้น: ${top.map((t) => `${t.domain} (#${t.rank})`).join(', ')}`)
  return `- ${bits.join(' · ')}${extra.length ? `\n  - ${extra.join('\n  - ')}` : ''}`
}

export async function buildSeoBrief(site: SeoSite, days = 28): Promise<string> {
  const lines: string[] = []
  const today = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date())
  lines.push(`# สรุป SEO / AEO — ${site.displayName} (${site.domain})`, `ดึงจากระบบ AMGO เมื่อ ${today}`, '')

  // ── 1) ภาพรวมจาก Search Console ─────────────────────────────────────────
  if (site.syncedThrough) {
    const per = periods(site.syncedThrough, days, 'prev')
    const yoy = periods(site.syncedThrough, days, 'yoy')
    const totals = (await getDailyTotals([site.id], yoy.prev.from)).get(site.id) ?? []
    const earliest = totals.reduce((m, t) => (!m || t.date < m ? t.date : m), '')
    const cur = sumTotals(totals, per.cur.from, per.cur.to)
    const prev = sumTotals(totals, per.prev.from, per.prev.to)
    const ly = sumTotals(totals, yoy.prev.from, yoy.prev.to)
    const lyOk = !!earliest && yoy.prev.from >= earliest
    lines.push(
      `## 1. คนค้นจริงจาก Google (Search Console) ${days} วัน: ${fmtGscDate(per.cur.from)} – ${fmtGscDate(per.cur.to)}`,
      `- คลิก ${cur.clicks.toLocaleString()} (เทียบ ${days} วันก่อนหน้า ${pct(cur.clicks, prev.clicks)}${lyOk ? ` · เทียบปีที่แล้ว ${pct(cur.clicks, ly.clicks)}` : ''})`,
      `- การแสดงผล ${cur.impressions.toLocaleString()} (${pct(cur.impressions, prev.impressions)}${lyOk ? ` · ปีที่แล้ว ${pct(cur.impressions, ly.impressions)}` : ''})`,
      `- CTR ${(cur.ctr * 100).toFixed(1)}% · อันดับเฉลี่ย ${pos(cur.position)} (ก่อนหน้า ${pos(prev.position)})`,
      ''
    )

    const [queries, pages] = await Promise.all([
      compareGsc(site.id, 'query', per.cur, per.prev),
      compareGsc(site.id, 'page', per.cur, per.prev),
    ])
    const byClicks = [...queries].sort((a, b) => b.clicks - a.clicks).slice(0, 15)
    lines.push('### คำค้นที่พาคนเข้าเว็บมากสุด', ...byClicks.map((q) => `- ${q.key} — คลิก ${q.clicks} · แสดง ${q.impressions} · อันดับ ${pos(q.position)}`), '')

    // โอกาส: คนเห็นเยอะ แต่อันดับ 5–20 (ดันขึ้นอีกนิดได้คลิกเพิ่มมาก)
    const opp = queries
      .filter((q) => q.position != null && q.position >= 5 && q.position <= 20 && q.impressions >= 50)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 12)
    if (opp.length)
      lines.push(
        '### โอกาส — คนเห็นเยอะแต่ยังอันดับ 5–20 (ดันขึ้นหน้าแรก/top 3 ได้คลิกเพิ่มมากสุด)',
        ...opp.map((q) => `- ${q.key} — แสดง ${q.impressions} · อันดับ ${pos(q.position)} · คลิก ${q.clicks}`),
        ''
      )
    const lost = queries
      .filter((q) => q.prevClicks >= 3 && q.clicks < q.prevClicks * 0.5)
      .sort((a, b) => b.prevClicks - b.clicks - (a.prevClicks - a.clicks))
      .slice(0, 8)
    if (lost.length)
      lines.push(
        '### คำที่คลิกลดลงครึ่งหนึ่งขึ้นไป (เช็คว่าอันดับตก หรือคนค้นน้อยลงตามฤดู)',
        ...lost.map(
          (q) =>
            `- ${q.key} — คลิก ${q.prevClicks}→${q.clicks} · แสดง ${q.prevImpressions}→${q.impressions} · อันดับ ${pos(q.prevPosition)}→${pos(q.position)}`
        ),
        ''
      )
    const topPages = [...pages].sort((a, b) => b.clicks - a.clicks).slice(0, 10)
    lines.push(
      '### หน้าที่ได้คลิกมากสุด',
      ...topPages.map((p) => `- ${pathOf(p.key)} — คลิก ${p.prevClicks}→${p.clicks} · อันดับ ${pos(p.position)}`),
      ''
    )
  }

  // ── 2) คำเป้าหมาย ─────────────────────────────────────────────────────
  const kws = (await getTargetKeywords(site.id)).filter((k) => k.isTracked)
  if (kws.length) {
    const groups = {
      top10: kws.filter((k) => k.rank != null && k.rank <= 10),
      top30: kws.filter((k) => k.rank != null && k.rank > 10),
      none: kws.filter((k) => k.rank == null && k.snapshots.length),
    }
    lines.push(
      `## 2. คำเป้าหมาย (Google ไทย · อันดับ = ค่ากลางของ 5 ครั้งล่าสุด · ดู ${RANK_DEPTH} อันดับแรก)`,
      ''
    )
    for (const [st, title] of [
      ['top10', '### ✅ ติดหน้าแรก (1–10) — รักษาไว้ / ดันขึ้น top 3'],
      ['top30', `### ◌ ติดอันดับ 11–${RANK_DEPTH} — ใกล้หน้าแรกแล้ว ควรทำต่อก่อน`],
      ['none', `### ⊘ ไม่ติด ${RANK_DEPTH} อันดับแรก — ต้องมีหน้า/เนื้อหาที่ตรงคำนี้`],
    ] as const) {
      const g = groups[st]
      if (g.length) lines.push(title, ...g.map((k) => kwLine(k, site.domain)), '')
    }
  }

  // ── 3) AI ตอบถึงเราไหม ────────────────────────────────────────────────
  const prompts = (await getAeoPrompts(site.id)).filter((p) => p.isTracked)
  if (prompts.length) {
    lines.push('## 3. AI ตอบถึงเราไหม (ถามแบบค้นเว็บ)', '')
    for (const e of AEO_ENGINE_LABELS) {
      const res = prompts.map((p) => p.latest[e.key]).filter(Boolean)
      if (!res.length) continue
      lines.push(`- ${e.label}: อ้างลิงก์เรา ${res.filter((r) => r!.cited).length}/${res.length} · พูดถึงชื่อเรา ${res.filter((r) => r!.mentioned).length}/${res.length}`)
    }
    lines.push('', '### คำถามที่ AI ยังไม่อ้างเรา (งาน AEO) — AI ไปอ้างเว็บไหนแทน')
    for (const p of prompts) {
      const miss = AEO_ENGINE_LABELS.filter((e) => p.latest[e.key] && !p.latest[e.key]!.cited)
      if (!miss.length) continue
      const others = Array.from(
        new Set(miss.flatMap((e) => p.latest[e.key]!.sources.map((s) => s.domain)).filter((d) => d && !d.endsWith(site.domain)))
      ).slice(0, 6)
      lines.push(`- "${p.prompt}" — ไม่อ้างใน ${miss.map((e) => e.label).join(', ')}${others.length ? ` · อ้าง ${others.join(', ')} แทน` : ''}`)
    }
    lines.push('')
  }

  lines.push(
    '## สิ่งที่อยากให้ช่วย',
    '1. ดูคำ "โผล่บางครั้ง" และ "โอกาส อันดับ 5–20" ก่อน — เสนอว่าจะแก้หน้าไหน (title / H1 / เนื้อหา / ลิงก์ภายใน) ให้ติดจริง',
    '2. คำที่ "ติดผิดหน้า" — ปรับลิงก์ภายใน/เนื้อหาให้ Google เลือกหน้าเป้าหมาย',
    '3. คำที่ "ยังไม่ติด" — ต้องสร้างหน้าใหม่หรือเติมหัวข้อในหน้าเดิม',
    '4. คำถามที่ AI ยังไม่อ้างเรา — ดูว่าเว็บที่ AI อ้างมีอะไรที่เราไม่มี (ตอบตรงคำถาม · ตาราง/ราคา · FAQ · schema) แล้วเสริมให้',
    '5. เรียงลำดับงานตามผลที่จะได้ (คนค้นเยอะ + ใกล้ติด ก่อน)'
  )
  return lines.join('\n')
}
