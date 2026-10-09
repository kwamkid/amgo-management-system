'use client'

// "AI อ้างเราที่ไหนบ้าง" — ส่วนบนของแท็บ AI ตอบ (DataForSEO LLM Mentions · เจ้าของ 9 ต.ค. 69)
//
// ต่างจากตารางคำถามข้างล่าง (เราตั้งคำถามเอง) — ชุดนี้คือคำตอบ AI จริงที่ DataForSEO เก็บไว้:
//   · AI อ้างเรา vs คู่แข่ง กี่คำตอบ (share of voice)
//   · คำถามที่ AI อ้างเราอยู่แล้ว (รู้ว่าบทความไหนได้ผล)
//   · โอกาส: คำถามที่ AI อ้างคู่แข่งแต่ไม่อ้างเรา (งานที่ควรทำต่อ) — สีแดง
// ภาษาไทยตอนนี้มีเฉพาะ Google AI Overview · ดึงเดือนละครั้ง (cron) + ปุ่มกดเอง ~$0.7/ครั้ง

import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, CircleX, RefreshCw, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { trackQueue } from '@/lib/queue/tracker'
import { Button, HelpTooltip, Progress, TabBar, TabItem } from '@/components/aoo'
import { DataTable, SectionCard, TableFooter, type Column } from '@/components/shared'
import { fmtGscDate, fmtNum, getLlmMentions, type LlmQuestion, type LlmShare, type SeoSite } from '@/lib/services/seo/seoService'

const PAGE = 15
const PLAIN_TRIGGER = { textDecoration: 'none', cursor: 'inherit' }

export default function AiMentions({ site }: { site: SeoSite }) {
  const { showToast } = useToast()
  const [data, setData] = useState<{ fetchedOn: string | null; share: LlmShare[]; questions: LlmQuestion[] } | null>(null)
  const [tab, setTab] = useState<'gap' | 'ours'>('gap')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)

  const load = () => getLlmMentions(site.id).then(setData).catch((e) => showToast(e.message, 'error'))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id])
  useEffect(() => setPage(1), [tab])

  const refresh = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/seo/llm-mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ไม่สำเร็จ')
      trackQueue({ kind: 'group', ref: json.groupKey, title: `AI อ้างเรา · ${site.displayName}`, unit: 'งาน', href: `/seo/${site.id}` })
      showToast('ลงคิวดึงข้อมูลแล้ว — ใช้เวลาประมาณ 1 นาที กลับมาเปิดแท็บนี้ใหม่ได้เลย')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const list = useMemo(() => (data?.questions ?? []).filter((q) => q.kind === tab), [data, tab])
  const counts = { ours: data?.questions.filter((q) => q.kind === 'ours').length ?? 0, gap: data?.questions.filter((q) => q.kind === 'gap').length ?? 0 }
  const maxMentions = Math.max(1, ...(data?.share ?? []).map((s) => s.mentions))

  const columns: Column<LlmQuestion>[] = [
    {
      key: 'q',
      header: 'คำถามที่คนถาม AI',
      mobilePrimary: true,
      cell: (q) => (
        <div className={tab === 'gap' ? 'text-[var(--ruby-700)]' : 'text-gray-900'}>
          <span className="font-medium">{q.question}</span>
          {q.competitor && <div className="text-xs text-gray-500">AI อ้าง {q.competitor} แทน</div>}
        </div>
      ),
    },
    {
      key: 'vol',
      header: 'คนถาม AI/เดือน',
      align: 'right',
      sortValue: (q) => q.aiSearchVolume,
      cell: (q) => (q.aiSearchVolume != null ? fmtNum(q.aiSearchVolume) : '—'),
    },
    {
      key: 'src',
      header: 'AI อ้างเว็บไหนบ้าง',
      hideOnMobile: true,
      cell: (q) => (
        <div className="flex flex-wrap gap-1">
          {q.sources.slice(0, 6).map((d) => (
            <span key={d} className="aoo-pop__chip" data-ours={d === site.domain || d.endsWith(`.${site.domain}`) ? '' : undefined}>
              {d}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'seen',
      header: 'เห็นล่าสุด',
      hideOnMobile: true,
      sortValue: (q) => q.lastSeen,
      cell: (q) => <span className="whitespace-nowrap text-sm text-gray-500">{q.lastSeen ? fmtGscDate(q.lastSeen.slice(0, 10)) : '—'}</span>,
    },
  ]

  return (
    <SectionCard
      className="mb-6"
      title={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <Sparkles size={18} /> AI อ้างเราที่ไหนบ้าง
            <span className="aoo-source-badge">Google AI Overview · DataForSEO</span>
          </span>
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy} onClick={refresh}>
            ดึงข้อมูลใหม่ (~$0.7)
          </Button>
        </div>
      }
      description={
        data?.fetchedOn
          ? `คำตอบ AI จริงที่เก็บไว้ (ไม่ใช่คำถามที่เราตั้งเอง) · ข้อมูลรอบ ${fmtGscDate(data.fetchedOn)} · ดึงใหม่อัตโนมัติเดือนละครั้ง`
          : 'ยังไม่เคยดึง — ระบบดึงให้เดือนละครั้งในรอบตี 4 หรือกด "ดึงข้อมูลใหม่"'
      }
    >
      {data?.share.length ? (
        <>
          {/* share of voice — AI อ้างใครกี่คำตอบ */}
          <p className="mb-2 text-sm font-semibold text-gray-700">AI อ้างใครบ่อยแค่ไหน (เทียบคู่แข่ง)</p>
          <ul className="mb-5 space-y-2">
            {data.share.map((s) => (
              <li key={s.domain} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 text-sm">
                <span className={`truncate ${s.isUs ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                  {s.domain}
                  {s.isUs ? ' (เรา)' : ''}
                </span>
                <Progress value={s.mentions} max={maxMentions} tone={s.isUs ? 'success' : 'neutral'} aria-label={s.domain} />
                <HelpTooltip
                  delay={150}
                  width={280}
                  triggerStyle={PLAIN_TRIGGER}
                  content={`AI อ้าง ${s.domain} ใน ${fmtNum(s.mentions)} คำตอบ · คำถามเหล่านั้นมีคนถาม AI รวม ~${fmtNum(s.aiSearchVolume)} ครั้ง/เดือน`}
                >
                  <span className="whitespace-nowrap font-semibold">{fmtNum(s.mentions)} คำตอบ</span>
                </HelpTooltip>
              </li>
            ))}
          </ul>

          <TabBar ariaLabel="คำถาม" className="mb-3">
            <TabItem
              active={tab === 'gap'}
              onClick={() => setTab('gap')}
              label={
                <HelpTooltip delay={150} width={300} triggerStyle={PLAIN_TRIGGER} content="คำถามที่ AI อ้างคู่แข่ง แต่ไม่อ้างเรา — ทำเนื้อหาที่ตอบคำถามนี้ตรง ๆ ให้ AI หยิบเราไปอ้างแทน">
                  <span className="inline-flex items-center gap-1.5">
                    <CircleX size={15} /> โอกาส: อ้างคู่แข่งแต่ไม่อ้างเรา · {counts.gap}
                  </span>
                </HelpTooltip>
              }
            />
            <TabItem
              active={tab === 'ours'}
              onClick={() => setTab('ours')}
              label={
                <HelpTooltip delay={150} width={300} triggerStyle={PLAIN_TRIGGER} content="คำถามที่ AI อ้างเว็บเราอยู่แล้ว — ดูว่าบทความไหนได้ผล ควรรักษาและอัปเดตให้สดเสมอ">
                  <span className="inline-flex items-center gap-1.5">
                    <CircleCheck size={15} /> AI อ้างเราอยู่แล้ว · {counts.ours}
                  </span>
                </HelpTooltip>
              }
            />
          </TabBar>
          <DataTable columns={columns} rows={list.slice((page - 1) * PAGE, page * PAGE)} rowKey={(q) => `${q.kind}:${q.question}`} emptyTitle="ไม่มีคำถามในกลุ่มนี้" />
          <TableFooter page={page} pageSize={PAGE} total={list.length} onPageChange={setPage} unit="คำถาม" />
        </>
      ) : (
        data && <p className="text-sm text-gray-500">ยังไม่มีข้อมูล</p>
      )}
    </SectionCard>
  )
}
