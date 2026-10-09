'use client'

// แท็บ "AI ตอบ (AEO)" — ถาม ChatGPT · Perplexity · Gemini ด้วยคำถามแบบที่ลูกค้าถามจริง (เฟส 3)
//
// ต่อคำถามต่อ AI ดูว่า: อ้างลิงก์เว็บเรา (ดีสุด) · พูดถึงชื่อเราแต่ไม่ใส่ลิงก์ · ไม่พูดถึงเลย
// การ์ดบนสุดสรุปทุก AI รวม Google AI Overview (จากแท็บคำเป้าหมาย) — เจ้าของขอ "สรุปให้ทุก AI ที่เช็ค"
// เช็คอัตโนมัติสัปดาห์ละครั้ง (cron ตี 4) · ปุ่ม "ถาม AI ตอนนี้" ถามทันทีทีละชุด จนครบ

import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  CircleCheck,
  CircleMinus,
  CircleX,
  MessageCircle,
  MessageSquarePlus,
  Send,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { getQueueGroup, type QueueGroupStatus } from '@/lib/services/queueService'
import { Button, Field, IconButton, Modal, Pill, Progress, Select, Textarea, Toggle, useConfirm } from '@/components/aoo'
import { DataTable, QueueFloat, StatCard, StatGrid, type Column } from '@/components/shared'
import {
  AEO_ENGINE_LABELS,
  addAeoPrompts,
  deleteAeoPrompt,
  fmtGscDate,
  fmtNum,
  getAeoPrompts,
  getSeoSettings,
  getAiReferrals,
  getTargetKeywords,
  type AiReferralSummary,
  setAeoPromptKeyword,
  setAeoPromptTracked,
  type AeoPrompt,
  type AeoResult,
  type SeoSite,
} from '@/lib/services/seo/seoService'

/** ชุดที่จบแล้วยังโชว์แผงค้างไว้กี่นาที — ให้เห็นว่าจบแล้ว */
const SHOW_DONE_MS = 30 * 60_000

/** ไอคอนเดียวกับคอลัมน์ "AI อ้างเราไหม" ในแท็บคำเป้าหมาย */
function ResultPill({ r }: { r?: AeoResult }) {
  const [Icon, tone, text] = !r
    ? [CircleMinus, 'neutral', 'ยังไม่ถาม']
    : r.cited
      ? [CircleCheck, 'success', 'อ้างลิงก์เรา']
      : r.mentioned
        ? [MessageCircle, 'warning', 'พูดถึงชื่อเรา']
        : [CircleX, 'danger', 'ไม่พูดถึงเรา']
  return (
    <span className="aoo-status aoo-status--sm" data-tone={tone}>
      <Icon size={14} />
      {text}
    </span>
  )
}

/** ชื่อ AI ที่ส่งคนเข้าเว็บ (seo_ai_referrals.source) */
const AI_SOURCE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  copilot: 'Copilot',
  claude: 'Claude',
}

export default function AiAnswers({ site }: { site: SeoSite }) {
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()
  const [rows, setRows] = useState<AeoPrompt[] | null>(null)
  const [googleAi, setGoogleAi] = useState<{ cited: number; total: number } | null>(null)
  /** คนที่ AI ส่งเข้าเว็บ 28 วัน (จาก access log ของเว็บเอง) */
  const [visits, setVisits] = useState<AiReferralSummary | null>(null)
  const [adding, setAdding] = useState(false)
  const [lines, setLines] = useState('')
  /** คำเป้าหมายที่จะผูกกับคำถามที่เพิ่ม — ผลไปโชว์ในตารางคำเป้าหมายด้วย */
  const [linkKw, setLinkKw] = useState('')
  const [keywords, setKeywords] = useState<{ id: string; keyword: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<AeoPrompt | null>(null)
  const askKey = `seo-aeo-group:${site.id}`
  /** ชุดงานถาม AI ล่าสุดที่สั่งจากหน้านี้ (จำไว้ในเครื่อง) — แผงคิวอ่านความคืบหน้าจากคิวกลาง */
  const [group, setGroup] = useState<{ key: string; at: number } | null>(null)
  const [progress, setProgress] = useState<QueueGroupStatus | null>(null)
  // อ่านหลัง mount (ฝั่งเซิร์ฟเวอร์ไม่มี localStorage — อ่านตอน render จะ hydrate ไม่ตรง)
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(askKey) ?? 'null')
      setGroup(v?.key ? v : null)
    } catch {
      setGroup(null)
    }
  }, [askKey])
  const [starting, setStarting] = useState(false)
  const [queueOpen, setQueueOpen] = useState(true)

  const load = () =>
    Promise.all([
      getAeoPrompts(site.id)
        .then(setRows)
        .catch((e) => {
          showToast(e.message, 'error')
          setRows([])
        }),
      // Google AI Overview มาจากผลเช็คอันดับ — นับเฉพาะรอบที่มีข้อมูล AI (ไม่นับประวัติที่นำเข้า)
      getTargetKeywords(site.id)
        .then((kws) => {
          setKeywords(kws.map((k) => ({ id: k.id, keyword: k.keyword })))
          const withAio = kws.filter((k) => k.snapshots[0]?.detailed && k.snapshots[0].hasAiOverview)
          setGoogleAi({ cited: withAio.filter((k) => k.snapshots[0].aiOverviewCitesUs).length, total: withAio.length })
        })
        .catch(() => setGoogleAi(null)),
      getAiReferrals(site.id)
        .then(setVisits)
        .catch(() => setVisits(null)),
    ])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id])

  /** สั่งถามแล้วจบ — ลงคิวกลาง งานเดินฝั่งเซิร์ฟเวอร์จนครบ (ปิดหน้าได้) · หน้าเว็บแค่ดูความคืบหน้า */
  const askNow = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/seo/aeo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ถาม AI ไม่สำเร็จ')
      if (!json.groupKey) {
        showToast(json.message ?? 'ไม่มีอะไรต้องถาม')
        return
      }
      const g = { key: json.groupKey as string, at: Date.now() }
      setGroup(g)
      setProgress(null)
      try {
        localStorage.setItem(askKey, JSON.stringify(g))
      } catch {
        /* ไม่มี localStorage ก็แค่จำไม่ได้ตอนเปิดหน้าใหม่ */
      }
      setQueueOpen(true)
      showToast(`ลงคิวถาม AI ${json.queued} ครั้งแล้ว — ปิดหน้านี้ได้ ระบบถามต่อเองจนครบ`)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setStarting(false)
    }
  }

  // ติดตามชุดงาน: ทุก 10 วิ ระหว่างยังไม่จบ · ได้คำตอบเพิ่ม = โหลดตารางใหม่
  useEffect(() => {
    if (!group) return
    let stop = false
    let lastDone = -1
    const tick = async () => {
      const st = await getQueueGroup(group.key).catch(() => null)
      if (stop || !st) return
      setProgress(st)
      if (st.done !== lastDone) {
        lastDone = st.done
        load()
      }
      if (!st.active) stop = true
    }
    tick()
    const t = setInterval(() => !stop && tick(), 10_000)
    return () => {
      stop = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.key])

  const add = async () => {
    setSaving(true)
    try {
      const n = await addAeoPrompts(site.id, lines, linkKw || null)
      showToast(`เพิ่ม ${n} คำถาม`)
      setAdding(false)
      setLines('')
      setLinkKw('')
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: AeoPrompt) => {
    const ok = await confirm({
      title: 'ลบคำถามนี้?',
      description: 'คำตอบที่เก็บไว้จะหายด้วย ถ้าแค่ไม่อยากเสียเงินถาม ให้ปิดสวิตช์ติดตามแทน',
      confirmLabel: 'ลบ',
      tone: 'danger',
    })
    if (!ok) return
    await deleteAeoPrompt(p.id).catch((e) => showToast(e.message, 'error'))
    load()
  }

  const toggle = async (p: AeoPrompt, v: boolean) => {
    setRows((r) => r?.map((x) => (x.id === p.id ? { ...x, isTracked: v } : x)) ?? null)
    await setAeoPromptTracked(p.id, v).catch((e) => showToast(e.message, 'error'))
  }

  /** สรุปต่อ AI จากคำตอบล่าสุดของแต่ละคำถาม */
  const summary = useMemo(
    () =>
      AEO_ENGINE_LABELS.map((e) => {
        const latest = (rows ?? []).map((p) => p.latest[e.key]).filter((r): r is AeoResult => !!r)
        return {
          ...e,
          total: latest.length,
          cited: latest.filter((r) => r.cited).length,
          mentioned: latest.filter((r) => r.mentioned).length,
        }
      }),
    [rows]
  )

  const columns: Column<AeoPrompt>[] = [
    {
      key: 'prompt',
      header: 'คำถาม',
      mobilePrimary: true,
      sticky: true,
      width: 280,
      cell: (p) => (
        <div className="min-w-0">
          <div className="break-words font-medium text-gray-900">{p.prompt}</div>
          <div className="text-xs text-gray-400">{p.keyword ? `คำเป้าหมาย: ${p.keyword}` : 'ยังไม่ได้เลือกคำเป้าหมาย'}</div>
        </div>
      ),
    },
    ...AEO_ENGINE_LABELS.map(
      (e): Column<AeoPrompt> => ({
        key: e.key,
        header: e.label,
        sortValue: (p) => (p.latest[e.key] ? (p.latest[e.key]!.cited ? 2 : p.latest[e.key]!.mentioned ? 1 : 0) : null),
        cell: (p) => <ResultPill r={p.latest[e.key]} />,
      })
    ),
    {
      key: 'checked',
      header: 'ถามล่าสุด',
      sortValue: (p) => p.history[0]?.checkedOn ?? null,
      cell: (p) =>
        p.history[0] ? (
          <span className="whitespace-nowrap text-sm">{fmtGscDate(p.history[0].checkedOn)}</span>
        ) : (
          <span className="text-gray-400">ยังไม่ถาม</span>
        ),
    },
    {
      key: 'tracked',
      header: 'ติดตาม',
      align: 'center',
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle checked={p.isTracked} onChange={(v) => toggle(p, v)} size="sm" aria-label="ติดตามคำถามนี้" />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <IconButton icon={Trash2} tone="danger" aria-label="ลบคำถาม" onClick={() => remove(p)} />
        </div>
      ),
    },
  ]

  const tracked = (rows ?? []).filter((p) => p.isTracked).length
  const showPanel = !!group && !!progress && progress.total > 0 && (progress.active || Date.now() - group.at < SHOW_DONE_MS)

  return (
    <div>
      {dialog}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">ถาม AI แบบค้นเว็บ สัปดาห์ละครั้ง · ติดตาม {tracked} คำถาม</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={MessageSquarePlus} onClick={() => setAdding(true)}>
            เพิ่มคำถาม
          </Button>
          <Button size="sm" icon={Send} loading={starting} onClick={askNow} disabled={!tracked || !!progress?.active}>
            ถาม AI ตอนนี้
          </Button>
        </div>
      </div>

      <StatGrid cols={4}>
        <StatCard
          label="Google AI อ้างเรา"
          value={googleAi?.total ? `${googleAi.cited}/${googleAi.total}` : '—'}
          icon={Bot}
          tone="success"
          hint="จากคำเป้าหมายที่มีกล่อง AI"
        />
        {summary.map((s, i) => (
          <StatCard
            key={s.key}
            label={`${s.label} อ้างเรา`}
            value={s.total ? `${s.cited}/${s.total}` : '—'}
            icon={Bot}
            tone={(['accent', 'grape', 'warning'] as const)[i]}
            hint={s.total ? `พูดถึงชื่อเรา ${s.mentioned}/${s.total}` : 'ยังไม่ได้ถาม'}
          />
        ))}
      </StatGrid>

      {/* คนที่ AI ส่งเข้าเว็บจริง (เจ้าของขอ 9 ต.ค. 69 "ดูได้มั้ยว่ามีคนคลิกจากผลกี่คน") */}
      <div className="aoo-card mb-3 mt-3 p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-gray-800">คนที่ AI ส่งเข้าเว็บ (28 วัน)</p>
          <p className="text-xs text-gray-500">
            นับจาก log ของเว็บเอง ทุกคน ไม่ขึ้นกับคุกกี้ · AI ไม่บอกว่าคนถามอะไรมา จึงแยกได้แค่ AI ตัวไหนส่งเข้าหน้าไหน
            {visits?.lastDate ? ` · ถึง ${fmtGscDate(visits.lastDate)}` : ''}
          </p>
        </div>
        {!visits?.lastDate ? (
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูล — เว็บนี้ยังไม่ได้ติดตัวนับ (ทำได้กับเว็บ WordPress ที่เราดูแล)</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ul className="space-y-1 text-sm">
              {visits.bySource.map((s) => (
                <li key={s.source} className="flex justify-between gap-2">
                  <span>{AI_SOURCE_LABEL[s.source] ?? s.source}</span>
                  <span>
                    <b>{fmtNum(s.people)}</b> คน <span className="text-gray-400">· {fmtNum(s.visits)} ครั้ง</span>
                  </span>
                </li>
              ))}
            </ul>
            <ul className="space-y-1 text-sm">
              {visits.topPages.map((p) => (
                <li key={`${p.source}${p.path}`} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate" title={p.path}>
                    {decodeURIComponent(p.path)}
                  </span>
                  <span className="whitespace-nowrap text-gray-500">
                    {fmtNum(p.people)} คน · {AI_SOURCE_LABEL[p.source] ?? p.source}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ul className="mb-3 mt-1 space-y-0.5 text-xs text-gray-500">
        <li>
          <b>อ้างลิงก์เรา</b> = AI ใส่ลิงก์เว็บเราเป็นที่มา (ดีสุด) · <b>พูดถึงเรา</b> = เอ่ยชื่อแบรนด์แต่ไม่ใส่ลิงก์ ·{' '}
          <b>ไม่พูดถึง</b> = แนะนำเจ้าอื่น (โอกาสงาน AEO) · กดแถวเพื่ออ่านคำตอบเต็มและดูว่า AI อ้างเว็บไหน
        </li>
        <li>คำถามควรเป็นแบบที่ลูกค้าพิมพ์ถาม AI จริง เช่น &quot;แนะนำร้านกระเช้าผลไม้ ส่งด่วนในกรุงเทพ&quot; — ไม่ใช่คำค้นสั้น ๆ</li>
      </ul>

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(p) => p.id}
        loading={rows === null}
        onRowClick={(p) => setDetail(p)}
        emptyTitle="ยังไม่มีคำถาม"
        emptyBody='กด "เพิ่มคำถาม" แล้ววางคำถามบรรทัดละข้อ'
      />

      {showPanel && progress && (
        <QueueFloat
          title="ถาม AI"
          unit="ข้อ"
          done={progress.done}
          total={progress.total}
          failed={progress.failed}
          active={progress.active}
          open={queueOpen}
          onOpenChange={setQueueOpen}
          meta={
            progress.active
              ? `${progress.running.length ? `กำลังถาม: ${progress.running.slice(0, 2).join(' · ')} · ` : ''}เซิร์ฟเวอร์ถามต่อเองทีละข้อ · ปิดหน้านี้ได้ ผลไม่หาย`
              : progress.failed
                ? 'ข้อที่ล้มเหลวระบบลองใหม่ให้แล้ว 3 ครั้ง — จะถามอีกรอบ cron'
                : 'ผลอยู่ในตารางแล้ว'
          }
        />
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="เพิ่มคำถามที่จะถาม AI"
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              ยกเลิก
            </Button>
            <Button loading={saving} onClick={add} disabled={!lines.trim()}>
              บันทึก
            </Button>
          </>
        }
      >
        <Field
          label="คำถาม (บรรทัดละข้อ)"
          required
          help="ถามแบบลูกค้าจริง · ถาม 3 AI ต่อคำถาม ~$0.08 ต่อสัปดาห์ — 5–10 คำถามต่อเว็บก็พอเห็นภาพ"
        >
          <Textarea
            rows={8}
            autoFocus
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            placeholder={'แนะนำร้านกระเช้าผลไม้ ส่งด่วนในกรุงเทพ\nซื้อกระเช้าเยี่ยมคนป่วยที่ไหนดี'}
          />
        </Field>
        <Field
          label="เกี่ยวกับคำเป้าหมาย"
          help="ไม่บังคับ · ผลของ AI แต่ละตัวจะไปโชว์ในตารางคำเป้าหมายของคำนั้นด้วย"
          className="mt-4"
        >
          <Select value={linkKw} onChange={(e) => setLinkKw(e.target.value)}>
            <option value="">— ไม่ผูก —</option>
            {keywords.map((k) => (
              <option key={k.id} value={k.id}>
                {k.keyword}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.prompt ?? ''}
        description={detail?.history[0] ? `ถามล่าสุด ${fmtGscDate(detail.history[0].checkedOn)}` : 'ยังไม่ได้ถาม'}
        maxWidth={720}
      >
        {detail && (
          <div className="space-y-5 text-sm">
            <Field label="เกี่ยวกับคำเป้าหมาย">
              <Select
                value={detail.keywordId ?? ''}
                onChange={async (e) => {
                  const v = e.target.value || null
                  setDetail({ ...detail, keywordId: v, keyword: keywords.find((k) => k.id === v)?.keyword ?? null })
                  await setAeoPromptKeyword(detail.id, v).catch((err) => showToast(err.message, 'error'))
                  load()
                }}
              >
                <option value="">— ไม่ผูก —</option>
                {keywords.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.keyword}
                  </option>
                ))}
              </Select>
            </Field>
            {AEO_ENGINE_LABELS.map((e) => {
              const r = detail.latest[e.key]
              return (
                <section key={e.key}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{e.label}</span>
                    <ResultPill r={r} />
                    {r && <span className="text-xs text-gray-400">{fmtGscDate(r.checkedOn)}</span>}
                  </div>
                  {!r ? (
                    <p className="text-gray-400">ยังไม่ได้ถาม</p>
                  ) : (
                    <>
                      <div className="aoo-answer">{r.answer || '(ไม่มีข้อความ)'}</div>
                      {r.sources.length > 0 && (
                        <div className="mt-2">
                          <p className="mb-1 text-xs font-semibold text-gray-500">ที่มาที่ AI อ้าง</p>
                          <ul className="flex flex-wrap gap-1.5">
                            {r.sources.map((s) => {
                              const ours = s.domain === site.domain || s.domain.endsWith(`.${site.domain}`)
                              return (
                                <li key={s.url}>
                                  <a href={s.url} target="_blank" rel="noreferrer">
                                    <Pill tone={ours ? 'success' : 'neutral'}>
                                      {ours && <CheckCircle2 size={12} className="mr-1 inline" />}
                                      {s.domain || s.title || 'ลิงก์'}
                                    </Pill>
                                  </a>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
