'use client'

// แท็บ "AI ตอบ (AEO)" — ถาม ChatGPT · Perplexity · Gemini ด้วยคำถามแบบที่ลูกค้าถามจริง (เฟส 3)
//
// ต่อคำถามต่อ AI ดูว่า: อ้างลิงก์เว็บเรา (ดีสุด) · พูดถึงชื่อเราแต่ไม่ใส่ลิงก์ · ไม่พูดถึงเลย
// การ์ดบนสุดสรุปทุก AI รวม Google AI Overview (จากแท็บคำเป้าหมาย) — เจ้าของขอ "สรุปให้ทุก AI ที่เช็ค"
// เช็คอัตโนมัติสัปดาห์ละครั้ง (cron ตี 4) · ปุ่ม "ถาม AI ตอนนี้" ถามทันทีทีละชุด จนครบ

import { useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, Loader2, MessageSquarePlus, Send, Trash2, X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useToastOffset } from '@/hooks/useToastOffset'
import { Button, Field, IconButton, Modal, Pill, Progress, Select, Textarea, Toggle, useConfirm } from '@/components/aoo'
import { DataTable, StatCard, StatGrid, type Column } from '@/components/shared'
import {
  AEO_ENGINE_LABELS,
  addAeoPrompts,
  deleteAeoPrompt,
  fmtGscDate,
  getAeoPrompts,
  getSeoSettings,
  getTargetKeywords,
  setAeoPromptKeyword,
  setAeoPromptTracked,
  type AeoPrompt,
  type AeoResult,
  type SeoSite,
} from '@/lib/services/seo/seoService'

/** ดูความคืบหน้าหลังสั่งถามได้นานเท่านี้ — เกินแล้วถือว่าจบ (ที่ไม่ได้คำตอบจะถามซ้ำรอบ cron) */
const ASK_WATCH_MS = 20 * 60_000

const todayBangkok = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

function ResultPill({ r }: { r?: AeoResult }) {
  if (!r) return <span className="text-gray-400">—</span>
  if (r.cited) return <Pill tone="success">อ้างลิงก์เรา</Pill>
  if (r.mentioned) return <Pill tone="warning">พูดถึงเรา</Pill>
  return <span className="text-xs text-gray-400">ไม่พูดถึง</span>
}

export default function AiAnswers({ site }: { site: SeoSite }) {
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()
  const [rows, setRows] = useState<AeoPrompt[] | null>(null)
  const [googleAi, setGoogleAi] = useState<{ cited: number; total: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const [lines, setLines] = useState('')
  /** คำเป้าหมายที่จะผูกกับคำถามที่เพิ่ม — ผลไปโชว์ในตารางคำเป้าหมายด้วย */
  const [linkKw, setLinkKw] = useState('')
  const [keywords, setKeywords] = useState<{ id: string; keyword: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<AeoPrompt | null>(null)
  const askKey = `seo-aeo-asked:${site.id}`
  /** เวลาที่สั่งถาม (จำไว้ในเครื่อง) — null = ไม่ได้สั่ง */
  const [askedAt, setAskedAt] = useState<number | null>(null)
  // อ่านหลัง mount (ฝั่งเซิร์ฟเวอร์ไม่มี localStorage — อ่านตอน render จะ hydrate ไม่ตรง)
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(`seo-aeo-asked:${site.id}`))
      setAskedAt(v && Date.now() - v < ASK_WATCH_MS ? v : null)
    } catch {
      setAskedAt(null)
    }
  }, [site.id])
  const [starting, setStarting] = useState(false)
  const [queueOpen, setQueueOpen] = useState(true)
  const [engineCount, setEngineCount] = useState(AEO_ENGINE_LABELS.length)
  const [now, setNow] = useState(() => Date.now())
  const floatRef = useToastOffset()

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
    ])

  useEffect(() => {
    load()
    getSeoSettings()
      .then((st) => setEngineCount(st.aeoEngines.length))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id])

  /**
   * สั่งถามแล้วจบ — เซิร์ฟเวอร์ถามต่อเองเป็นช่วง ๆ จนครบ (ปิดหน้าได้)
   * หน้าเว็บแค่ดูความคืบหน้าจากคำตอบของวันนี้ (โหลดใหม่ทุก 15 วิ) · จำเวลาที่สั่งไว้ในเครื่อง
   * เปิดหน้ากลับมาก็ยังเห็นแผงคิว
   */
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
      const now = Date.now()
      setAskedAt(now)
      try {
        localStorage.setItem(askKey, String(now))
      } catch {
        /* ไม่มี localStorage ก็แค่จำไม่ได้ตอนเปิดหน้าใหม่ */
      }
      setQueueOpen(true)
      showToast('เริ่มถาม AI แล้ว — ปิดหน้านี้ได้ ระบบถามต่อเองจนครบ')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setStarting(false)
    }
  }

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
          <div className="text-xs text-gray-400">{p.keyword ? `คำเป้าหมาย: ${p.keyword}` : 'ยังไม่ผูกคำเป้าหมาย'}</div>
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
  const today = todayBangkok()
  const answeredToday = (rows ?? [])
    .filter((p) => p.isTracked)
    .reduce((n, p) => n + Object.values(p.latest).filter((r) => r?.checkedOn === today).length, 0)
  const expected = tracked * engineCount
  const watching = !!askedAt && now - askedAt < ASK_WATCH_MS
  const finished = watching && answeredToday >= expected

  // ระหว่างรอ: โหลดตารางใหม่ทุก 15 วิ · ครบแล้วหยุด
  useEffect(() => {
    if (!watching || finished) return
    const t = setInterval(() => {
      setNow(Date.now())
      load()
    }, 15_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, finished, site.id])

  return (
    <div>
      {dialog}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">ถาม AI แบบค้นเว็บ สัปดาห์ละครั้ง · ติดตาม {tracked} คำถาม</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={MessageSquarePlus} onClick={() => setAdding(true)}>
            เพิ่มคำถาม
          </Button>
          <Button size="sm" icon={Send} loading={starting} onClick={askNow} disabled={!tracked || (watching && !finished)}>
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

      {watching && !queueOpen && (
        <button
          ref={floatRef}
          type="button"
          className="aoo-queue-fab"
          onClick={() => setQueueOpen(true)}
          aria-label="เปิดคิวถาม AI"
        >
          {finished ? <CheckCircle2 size={22} /> : <Loader2 size={22} className="animate-spin" />}
        </button>
      )}
      {watching && queueOpen && (
        <div ref={floatRef} className="aoo-queue" role="status">
          <div className="aoo-queue__head">
            {finished ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="animate-spin" />}
            <span>
              {finished ? 'ถาม AI ครบแล้ว' : 'กำลังถาม AI'} — ได้คำตอบวันนี้ {Math.min(answeredToday, expected)}/{expected}
            </span>
            <button type="button" className="aoo-queue__close" onClick={() => setQueueOpen(false)} aria-label="ย่อคิว">
              <X size={16} />
            </button>
          </div>
          <Progress
            className="mt-2"
            value={Math.min(answeredToday, expected)}
            max={expected || 1}
            tone={finished ? 'success' : 'grape'}
            aria-label="ความคืบหน้าการถาม AI"
          />
          <div className="aoo-queue__meta">
            {finished
              ? 'ผลอยู่ในตารางแล้ว'
              : 'เซิร์ฟเวอร์ถามต่อเองทีละชุด (~40 วิ ต่อชุด) · ปิดหน้านี้ได้ ผลไม่หาย · ข้อที่ไม่ได้คำตอบจะถามซ้ำรอบ cron'}
          </div>
        </div>
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
          label="ผูกกับคำเป้าหมาย"
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
            <Field label="ผูกกับคำเป้าหมาย">
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
