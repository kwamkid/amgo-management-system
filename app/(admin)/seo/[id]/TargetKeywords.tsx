'use client'

// แท็บ "คำเป้าหมาย" — อันดับรายสัปดาห์จาก DataForSEO (เฟส 2)
//
// ต่างจากแท็บคำค้น (GSC) ตรงที่: คำพวกนี้เราเลือกเองว่าอยากติด แม้ยังไม่เคยโผล่เลย
// เห็นอันดับ (หรือ "ไม่ติด") · ขึ้นลงจากรอบก่อน · หน้าที่ติดตรงกับหน้าเป้าหมายไหม
// · หน้าผลลัพธ์มี AI Overview ไหม อ้างเราไหม · กดแถวเพื่อดูคู่แข่ง 10 อันดับแรก

import { useEffect, useMemo, useState } from 'react'
import { Bot, Plus, Radar, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Alert, Button, Field, IconButton, Input, Modal, Pill, Select, Textarea, Toggle, useConfirm } from '@/components/aoo'
import { DataTable, Segmented, StatCard, StatGrid, type Column } from '@/components/shared'
import {
  addTargetKeywords,
  deleteTargetKeyword,
  fmtGscDate,
  fmtNum,
  fmtRank,
  getTargetKeywords,
  setKeywordTracked,
  type SeoSite,
  type TargetKeyword,
} from '@/lib/services/seo/seoService'

type Filter = 'all' | 'top10' | 'ranked' | 'none' | 'wrong'

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'top10', label: 'หน้าแรก' },
  { value: 'ranked', label: 'ติด 100' },
  { value: 'none', label: 'ยังไม่ติด' },
  { value: 'wrong', label: 'ติดผิดหน้า' },
]

const pathOf = (url: string | null) => {
  if (!url) return null
  try {
    return decodeURIComponent(new URL(url).pathname) || '/'
  } catch {
    return url
  }
}

/** ขยับกี่อันดับจากรอบก่อน — บวก = ดีขึ้น · null = เทียบไม่ได้ */
function delta(k: TargetKeyword): number | null {
  const [cur, prev] = k.snapshots
  if (!cur || !prev) return null
  if (cur.position == null && prev.position == null) return null
  // ไม่ติด = 101 ไว้คิดระยะ (เพิ่งติด / เพิ่งหลุด ก็ยังเห็นว่าขยับเยอะ)
  return (prev.position ?? 101) - (cur.position ?? 101)
}

const wrongPage = (k: TargetKeyword) => {
  const cur = k.snapshots[0]
  return !!(k.targetPath && cur?.rankedUrl && pathOf(cur.rankedUrl) !== k.targetPath)
}

export default function TargetKeywords({ site }: { site: SeoSite }) {
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()
  const [rows, setRows] = useState<TargetKeyword[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<'check' | 'collect' | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ lines: '', groupName: '', targetPath: '', priority: '2' })
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<TargetKeyword | null>(null)

  const load = () =>
    getTargetKeywords(site.id)
      .then(setRows)
      .catch((e) => {
        showToast(e.message, 'error')
        setRows([])
      })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id])

  /** silent = ดึงผลเองเบื้องหลัง ไม่เด้งข้อความ (บอกเฉพาะตอนได้ผล) */
  const call = async (action: 'check' | 'collect', silent = false) => {
    if (!silent) setBusy(action)
    try {
      const res = await fetch('/api/cron/seo/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ไม่สำเร็จ')
      const c = json.collected
      const p = json.posted
      if (silent) {
        if (c.done || c.failed) {
          showToast(`ได้ผลอันดับแล้ว ${c.done} คำ${c.failed ? ` · ล้มเหลว ${c.failed}` : ''}`, c.failed ? 'error' : 'success')
          await load()
        }
        return
      }
      const parts = [
        c.done ? `ได้ผลแล้ว ${c.done} คำ` : null,
        c.waiting ? `รอผลอีก ${c.waiting} คำ` : null,
        c.failed ? `ล้มเหลว ${c.failed} คำ` : null,
        p?.posted ? `ส่งเช็ค ${p.posted} คำ ($${p.costUsd.toFixed(3)}) — ผลมาในไม่กี่นาที หน้านี้ดึงให้เอง` : null,
        ...(p?.skipped ?? []),
      ].filter(Boolean)
      showToast(parts.join(' · ') || 'ไม่มีงานค้าง', 'success')
      await load()
    } catch (e) {
      if (!silent) showToast((e as Error).message, 'error')
    } finally {
      if (!silent) setBusy(null)
    }
  }

  // มีคำรอผล = ดึงผลให้เองทุก 30 วิ เหมือนหน้าคิวงานปลั๊กอิน (ถามผลไม่เสียเงิน)
  // หยุดเองเมื่อไม่มีงานค้าง หรือออกจากหน้า
  const pendingCount = rows?.filter((k) => k.pending).length ?? 0
  useEffect(() => {
    if (!pendingCount) return
    const t = setInterval(() => call('collect', true), 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, site.id])

  const add = async () => {
    setSaving(true)
    try {
      const n = await addTargetKeywords(site.id, { ...form, priority: Number(form.priority) })
      showToast(`บันทึก ${n} คำ`)
      setAdding(false)
      setForm({ lines: '', groupName: '', targetPath: '', priority: '2' })
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (k: TargetKeyword) => {
    const ok = await confirm({
      title: `ลบคำ "${k.keyword}"?`,
      description: 'ประวัติอันดับของคำนี้จะหายด้วย ถ้าแค่ไม่อยากเสียเงินเช็ค ให้ปิดสวิตช์ติดตามแทน',
      confirmLabel: 'ลบ',
      tone: 'danger',
    })
    if (!ok) return
    await deleteTargetKeyword(k.id).catch((e) => showToast(e.message, 'error'))
    load()
  }

  const toggle = async (k: TargetKeyword, v: boolean) => {
    setRows((r) => r?.map((x) => (x.id === k.id ? { ...x, isTracked: v } : x)) ?? null)
    await setKeywordTracked(k.id, v).catch((e) => showToast(e.message, 'error'))
  }

  const stats = useMemo(() => {
    const list = rows ?? []
    const checked = list.filter((k) => k.snapshots[0])
    const detailed = checked.filter((k) => k.snapshots[0].detailed)
    return {
      checked: checked.length,
      top10: checked.filter((k) => (k.snapshots[0].position ?? 999) <= 10).length,
      ranked: checked.filter((k) => k.snapshots[0].position != null).length,
      aio: detailed.filter((k) => k.snapshots[0].hasAiOverview).length,
      aioUs: detailed.filter((k) => k.snapshots[0].aiOverviewCitesUs).length,
      aioChecked: detailed.length,
      lastCheck: checked.map((k) => k.snapshots[0].checkedOn).sort().pop() ?? null,
      pending: list.filter((k) => k.pending).length,
    }
  }, [rows])

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((k) => {
        const p = k.snapshots[0]?.position
        if (filter === 'top10') return p != null && p <= 10
        if (filter === 'ranked') return p != null
        if (filter === 'none') return !!k.snapshots[0] && p == null
        if (filter === 'wrong') return wrongPage(k)
        return true
      }),
    [rows, filter]
  )

  const columns: Column<TargetKeyword>[] = [
    {
      key: 'keyword',
      header: 'คำเป้าหมาย',
      mobilePrimary: true,
      sticky: true,
      width: 200,
      sortValue: (k) => k.keyword,
      cell: (k) => (
        <div className="min-w-0">
          <div className="break-words font-medium text-gray-900">
            {k.keyword}
            {k.priority === 1 && <Pill tone="accent" className="ml-1.5">หลัก</Pill>}
          </div>
          <div className="text-xs text-gray-400">
            {[k.groupName, k.targetPath].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'volume',
      header: 'ค้นหา/เดือน',
      align: 'right',
      hideOnMobile: true,
      sortValue: (k) => k.searchVolume,
      cell: (k) => (k.searchVolume != null ? fmtNum(k.searchVolume) : '—'),
    },
    {
      // อันดับ + แนวโน้มในช่องเดียว (เจ้าของขอ) — ขึ้น = เขียวสด · ลง = แดง
      key: 'rank',
      header: 'อันดับ',
      align: 'right',
      sortValue: (k) => (k.snapshots[0] ? (k.snapshots[0].position ?? 101) : null),
      cell: (k) => {
        const cur = k.snapshots[0]
        const d = delta(k)
        if (!cur) return <span className="text-gray-400">{k.pending ? 'รอผล…' : 'ยังไม่เช็ค'}</span>
        const tone = d == null || d === 0 ? undefined : d > 0 ? 'success' : 'danger'
        return (
          <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
            <span className="aoo-rank" data-tone={tone}>
              {fmtRank(cur.position)}
            </span>
            {d != null && d !== 0 && (
              <span className="aoo-delta inline-flex items-center gap-0.5" data-tone={tone}>
                {d > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(d) > 90 ? (d > 0 ? 'เพิ่งติด' : 'หลุด') : Math.abs(d)}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'page',
      header: 'หน้าที่ติด',
      hideOnMobile: true,
      cell: (k) => {
        const cur = k.snapshots[0]
        const p = pathOf(cur?.rankedUrl ?? null)
        if (!p) return <span className="text-gray-400">—</span>
        return (
          <div>
            <div className="break-all text-sm">{p}</div>
            {wrongPage(k) && (
              <div className="aoo-delta" data-tone="warning">
                ติดผิดหน้า (เป้า {k.targetPath})
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'aio',
      header: 'AI Overview',
      cell: (k) => {
        const cur = k.snapshots[0]
        // ประวัติที่นำเข้ามีแค่อันดับ — ไม่รู้ว่ามี AI Overview ไหม อย่าเดาว่า "ไม่มี"
        if (!cur?.detailed) return <span className="text-gray-400">—</span>
        if (!cur.hasAiOverview) return <span className="text-xs text-gray-400">ไม่มี</span>
        return cur.aiOverviewCitesUs ? <Pill tone="success">อ้างเรา</Pill> : <Pill tone="neutral">มี · ไม่อ้างเรา</Pill>
      },
    },
    {
      key: 'checked',
      header: 'เช็คล่าสุด',
      sortValue: (k) => k.snapshots[0]?.checkedOn ?? null,
      cell: (k) => {
        const cur = k.snapshots[0]
        if (!cur) return <span className="text-gray-400">{k.pending ? 'รอผล…' : '—'}</span>
        return (
          <div className="whitespace-nowrap text-sm">
            {fmtGscDate(cur.checkedOn)}
            {k.pending && <div className="text-xs text-gray-400">มีรอบใหม่รอผล</div>}
          </div>
        )
      },
    },
    {
      key: 'tracked',
      header: 'ติดตาม',
      align: 'center',
      cell: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle checked={k.isTracked} onChange={(v) => toggle(k, v)} size="sm" aria-label="ติดตามคำนี้" />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (k) => (
        <div onClick={(e) => e.stopPropagation()}>
          <IconButton icon={Trash2} tone="danger" aria-label="ลบคำ" onClick={() => remove(k)} />
        </div>
      ),
    },
  ]

  const tracked = (rows ?? []).filter((k) => k.isTracked).length

  return (
    <div>
      {dialog}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          เช็คอัตโนมัติสัปดาห์ละครั้ง (Google ประเทศไทย) · ติดตาม {tracked} คำ
          {stats.lastCheck ? ` · ล่าสุด ${fmtGscDate(stats.lastCheck)}` : ''}
          {stats.pending ? ` · ⏳ กำลังรอผล ${stats.pending} คำ (ดึงให้เองทุก 30 วิ)` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>
            เพิ่มคำ
          </Button>
          <Button size="sm" icon={Radar} loading={busy === 'check'} onClick={() => call('check')} disabled={!tracked}>
            เช็คอันดับตอนนี้
          </Button>
        </div>
      </div>

      {rows && rows.length > 0 && (
        <StatGrid cols={4}>
          <StatCard label="ติดหน้าแรก" value={`${stats.top10}/${stats.checked}`} icon={Trophy} tone="accent" hint="อันดับ 1–10" />
          <StatCard label="ติด 100 อันดับ" value={`${stats.ranked}/${stats.checked}`} icon={Target} tone="grape" hint="ที่เหลือยังไม่ติดเลย" />
          <StatCard label="มี AI Overview" value={stats.aioChecked ? `${stats.aio}/${stats.aioChecked}` : '—'} icon={Bot} tone="success" hint={stats.aioChecked ? 'หน้าผลลัพธ์มีคำตอบ AI' : 'รู้หลังเช็คผ่าน amgo รอบแรก'} />
          <StatCard label="AI อ้างเรา" value={stats.aioChecked ? `${stats.aioUs}/${stats.aio}` : '—'} icon={Sparkles} tone="warning" hint="จากที่มี AI Overview" />
        </StatGrid>
      )}

      {rows && rows.length > 0 && (
        <div className="mb-3">
          <Segmented value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(k) => k.id}
        loading={rows === null}
        onRowClick={(k) => k.snapshots[0] && setDetail(k)}
        emptyTitle={rows?.length ? 'ไม่มีคำในตัวกรองนี้' : 'ยังไม่มีคำเป้าหมาย'}
        emptyBody={rows?.length ? undefined : 'กด "เพิ่มคำ" แล้ววางรายการคำ บรรทัดละคำ'}
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="เพิ่มคำเป้าหมาย"
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              ยกเลิก
            </Button>
            <Button loading={saving} onClick={add} disabled={!form.lines.trim()}>
              บันทึก
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="คำ (บรรทัดละคำ)" required help='ใส่ยอดค้นหาท้ายบรรทัดได้ เช่น "รวมแชท, 210" · คำที่มีอยู่แล้วจะอัปเดตแทนเพิ่มซ้ำ'>
            <Textarea
              rows={6}
              value={form.lines}
              onChange={(e) => setForm({ ...form, lines: e.target.value })}
              placeholder={'รวมแชท, 210\nระบบรวมแชท, 140'}
            />
          </Field>
          <Field label="กลุ่มคำ">
            <Input value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} placeholder="แชท" />
          </Field>
          <Field label="หน้าเป้าหมาย" help="path ของหน้าที่อยากให้ติด เช่น /features/chat — ใช้เตือนเมื่อ Google เอาหน้าอื่นไปติดแทน">
            <Input value={form.targetPath} onChange={(e) => setForm({ ...form, targetPath: e.target.value })} placeholder="/features/chat" />
          </Field>
          <Field label="ความสำคัญ">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="1">1 · คำหลักของหน้า</option>
              <option value="2">2 · คำรอง</option>
              <option value="3">3 · ติดตามไว้ดู</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `"${detail.keyword}" · ${fmtRank(detail.snapshots[0]?.position)}` : ''}
        description={detail?.snapshots[0] ? `เช็คเมื่อ ${fmtGscDate(detail.snapshots[0].checkedOn)} · Google ประเทศไทย` : undefined}
        maxWidth={640}
      >
        {detail?.snapshots[0] && (
          <div className="space-y-4 text-sm">
            {!detail.snapshots[0].detailed && (
              <p className="text-gray-500">ผลรอบนี้นำเข้าจากระบบแผน SEO เดิม มีแค่อันดับ — คู่แข่งและ AI Overview จะเห็นหลังเช็คผ่าน amgo</p>
            )}
            <div>
              <p className="mb-2 font-semibold text-gray-700">10 อันดับแรก</p>
              <ol className="space-y-1">
                {detail.snapshots[0].topCompetitors.map((c) => (
                  <li key={`${c.rank}-${c.url}`} className="flex gap-2">
                    <span className="w-6 shrink-0 text-right text-gray-400">{c.rank}</span>
                    <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 break-words hover:underline">
                      <span className={c.domain.endsWith(site.domain) ? 'font-semibold' : ''}>{c.domain}</span>
                      <span className="block text-xs text-gray-400">{c.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            {detail.snapshots[0].hasAiOverview && (
              <div>
                <p className="mb-2 font-semibold text-gray-700">AI Overview อ้างถึง</p>
                {detail.snapshots[0].aiOverviewRefs.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(detail.snapshots[0].aiOverviewRefs.map((r) => r.domain))).map((d) => (
                      <Pill key={d} tone={d.endsWith(site.domain) ? 'success' : 'neutral'}>
                        {d}
                      </Pill>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">ไม่มีลิงก์อ้างอิง</p>
                )}
              </div>
            )}
            {detail.snapshots.length > 1 && (
              <Alert tone="info" compact>
                ประวัติ:{' '}
                {detail.snapshots
                  .slice(0, 8)
                  .map((s) => `${fmtGscDate(s.checkedOn)} ${fmtRank(s.position)}`)
                  .join(' · ')}
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
