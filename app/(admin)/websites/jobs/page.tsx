'use client'

// AOO Website — ภาพรวมฟลีต + สั่งงาน
//
// ลำดับการอ่านหน้านี้: "ตอนนี้เป็นยังไง" → "ต้องทำอะไร" → "ทำไปแล้วได้อะไร"
//   1. การ์ดสรุป + แถบสุขภาพฟลีต (เว็บกี่ตัวสะอาด/ค้างอัปเดต/ต้องสงสัย)
//   2. รายเว็บแยกตามแพลนโฮสต์ — เห็นเลยว่าเว็บไหนค้างปลั๊กอินกี่ตัว สแกนล่าสุดเป็นไง
//   3. สั่งงานได้ 3 ระดับ: ทั้งฟลีต · ทั้งโฮสต์ · เว็บเดียว
//   4. ประวัติงานล่าสุดอยู่ล่างสุด
//
// งานทุกชนิดเข้าคิวเสมอ ไม่ยิงตรง — โฮสต์เดียวกันรันทีละงานเท่านั้น (กันโหลดพุ่ง)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Download,
  ListChecks,
  PlayCircle,
  Puzzle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Modal, TabBar, TabItem } from '@/components/aoo'
import {
  DataTable,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  TechLoader,
  type Column,
} from '@/components/shared'
import {
  enqueueJobs,
  getHosts,
  getJobs,
  getQueueStatus,
  getSites,
  runQueueNow,
  type WebHost,
  type WebJob,
  type WebSite,
} from '@/lib/services/web/webService'

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

const TYPE_LABEL: Record<WebJob['type'], string> = {
  plugin_update: 'อัปเดตปลั๊กอิน',
  scan: 'สแกนมัลแวร์',
  backup: 'สำรองข้อมูล',
  discover: 'สำรวจรายชื่อเว็บ',
}

const STATUS: Record<WebJob['status'], { label: string; cls: string }> = {
  queued: { label: 'รอคิว', cls: 'bg-gray-100 text-gray-600' },
  running: { label: 'กำลังทำ', cls: 'bg-blue-50 text-blue-700' },
  done: { label: 'เสร็จ', cls: 'bg-green-50 text-green-700' },
  failed: { label: 'ล้มเหลว', cls: 'bg-red-50 text-red-600' },
}

/** สีของแถบสุขภาพ + ป้าย — ใช้ชุดเดียวกันทั้งหน้าเพื่อให้อ่านซ้ำได้ */
const HEALTH = {
  suspect: { label: 'พบไฟล์ต้องสงสัย', bar: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
  pending: { label: 'ค้างอัปเดตปลั๊กอิน', bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700' },
  clean: { label: 'เรียบร้อย', bar: 'bg-green-500', chip: 'bg-green-50 text-green-700' },
  unknown: { label: 'ยังไม่เคยตรวจ', bar: 'bg-gray-300', chip: 'bg-gray-100 text-gray-500' },
} as const

type Health = keyof typeof HEALTH

/** สถานะของเว็บ 1 ตัว — เรียงตามความเร่งด่วน มัลแวร์มาก่อนเสมอ */
function healthOf(s: WebSite): Health {
  if (s.lastScanStatus === 'suspect') return 'suspect'
  if (s.pendingPluginCount > 0) return 'pending'
  if (!s.lastScanAt && !s.pluginsCheckedAt) return 'unknown'
  return 'clean'
}

function summaryText(job: WebJob): string {
  const s = job.summary
  if (!s) return '—'
  if (job.type === 'plugin_update') {
    const updated = (s.pluginsUpdated as string[]) ?? []
    const pending = (s.stillPending as string[]) ?? []
    if (updated.length) return `อัปเดต ${updated.length} ตัว: ${updated.join(', ')}`
    return pending.length ? `ยังค้าง ${pending.length} ตัว` : 'ไม่มีอะไรค้าง'
  }
  if (job.type === 'scan') {
    const f = (s.findings as string[]) ?? []
    return f.length ? `⚠️ ต้องสงสัย ${f.length} ไฟล์` : 'สะอาด'
  }
  if (job.type === 'backup') return s.pending ? 'กำลังทำเบื้องหลัง' : `${s.file ?? ''} ${s.size ?? ''}`
  if (job.type === 'discover')
    return `เจอ ${s.found ?? 0} เว็บ · ผูก ${s.linked ?? 0} · สร้างใหม่ ${s.created ?? 0}`
  return JSON.stringify(s).slice(0, 120)
}

export default function WebJobsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [sites, setSites] = useState<WebSite[] | null>(null)
  const [hosts, setHosts] = useState<WebHost[]>([])
  const [jobs, setJobs] = useState<WebJob[]>([])
  const [queue, setQueue] = useState({ queued: 0, running: 0 })
  const [busy, setBusy] = useState('')
  const [tab, setTab] = useState('all')
  const [detail, setDetail] = useState<WebJob | null>(null)

  const canSee = !!userData && !!userData.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  /** โหลดใหม่ทั้งก้อน — ใช้ตอนเปิดหน้าและหลังกดสั่งงาน */
  const load = useCallback(() => {
    getSites().then(setSites).catch((e) => showToast(e.message, 'error'))
    getHosts().then(setHosts).catch(() => {})
    getJobs({ limit: 40 }).then(setJobs).catch(() => {})
    getQueueStatus().then(setQueue).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // รอบตามคิว — ถามแค่คิวกับประวัติงาน (ไม่กี่สิบแถว) แล้วค่อยดึงเว็บทั้ง 50 ตัวใหม่
  // เฉพาะตอนมีงานเพิ่งเสร็จ · ของเดิมยิงทั้ง 4 ก้อนทุก 15 วิ ตลอดเวลาที่เปิดแท็บทิ้งไว้
  const lastFinished = useRef('')
  const tick = useCallback(async () => {
    const [q, j] = await Promise.all([getQueueStatus(), getJobs({ limit: 40 })])
    setQueue(q)
    setJobs(j)
    const newest = j.reduce((m, x) => (x.finishedAt && x.finishedAt > m ? x.finishedAt : m), '')
    if (newest !== lastFinished.current) {
      lastFinished.current = newest
      getSites().then(setSites).catch(() => {})
    }
  }, [])

  // ให้ตัวจับเวลาอ่านสถานะคิวล่าสุดได้ โดยไม่ต้องตั้ง interval ใหม่ทุกครั้งที่คิวเปลี่ยน
  const queueBusy = queue.queued + queue.running > 0
  const queueBusyRef = useRef(false)
  useEffect(() => {
    queueBusyRef.current = queueBusy
  }, [queueBusy])

  useEffect(() => {
    if (!canSee) return
    load()
    let n = 0
    const t = setInterval(() => {
      if (document.hidden) return // สลับแท็บออกไปทำอย่างอื่น = ไม่ยิงเลย
      n++
      // มีงานเดินอยู่ = ทุก 10 วิ · คิวว่าง = ทุก 60 วิ พอให้เห็นงานที่ cron สั่งเอง
      if (queueBusyRef.current || n % 6 === 0) tick()
    }, 10_000)
    return () => clearInterval(t)
  }, [canSee, load, tick])

  /** เฉพาะเว็บที่สั่งงานได้จริง (ยังดูแลอยู่ + รู้ path บนโฮสต์) */
  const workable = useMemo(
    () => (sites ?? []).filter((s) => s.isActive && s.publicHtmlPath && s.hostId),
    [sites]
  )

  const stats = useMemo(() => {
    const byHealth = { suspect: 0, pending: 0, clean: 0, unknown: 0 }
    let pluginCount = 0
    for (const s of workable) {
      byHealth[healthOf(s)]++
      pluginCount += s.pendingPluginCount
    }
    return {
      total: workable.length,
      ...byHealth,
      pluginCount,
      down: workable.filter((s) => s.downSince).length,
    }
  }, [workable])

  /**
   * จัดกลุ่มเป็น "แพลน" ไม่ใช่โฮสต์เดี่ยว — SiteGround แยก SSH รายเว็บ
   * แต่ทั้งหมดอยู่แพลน AMGO Hosting เดียวกัน (ชื่อโฮสต์ตั้งเป็น "แพลน — โดเมน")
   */
  const planOf = (h: WebHost) => h.name.split(' — ')[0]

  const plans = useMemo(() => {
    const byHost = new Map(hosts.map((h) => [h.id, h]))
    const map = new Map<string, { name: string; hostIds: string[]; sites: WebSite[]; own: boolean }>()
    for (const s of workable) {
      const h = byHost.get(s.hostId!)
      if (!h) continue
      const key = planOf(h)
      if (!map.has(key)) map.set(key, { name: key, hostIds: [], sites: [], own: h.isOwnBusiness })
      const g = map.get(key)!
      if (!g.hostIds.includes(h.id)) g.hostIds.push(h.id)
      g.sites.push(s)
    }
    return [...map.values()].sort((a, b) => b.sites.length - a.sites.length)
  }, [hosts, workable])

  /** เว็บที่แท็บปัจจุบันครอบอยู่ — ใช้ทั้งตารางและปุ่มสั่งงาน */
  const tabSites = useMemo(
    () => (tab === 'all' ? workable : (plans.find((p) => p.name === tab)?.sites ?? [])),
    [tab, workable, plans]
  )

  const fire = async (
    type: WebJob['type'],
    opts?: { hostId?: string; siteIds?: string[]; label?: string }
  ) => {
    const key = opts?.siteIds?.[0] ?? opts?.hostId ?? type
    setBusy(key)
    try {
      // ไม่ระบุมา = ทำกับเว็บในแท็บที่เปิดอยู่ (แท็บ "ทุกเว็บ" = ทั้งฟลีต)
      const siteIds = opts?.siteIds ?? (tab === 'all' ? undefined : tabSites.map((s) => s.id))
      const { jobs: n } = await enqueueJobs({ type, hostId: opts?.hostId, siteIds })
      const where = opts?.label ?? (tab === 'all' ? 'ทั้งฟลีต' : tab)
      showToast(`เข้าคิวแล้ว ${n} เว็บ — ${where}`, 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const runNow = async () => {
    setBusy('run')
    try {
      const ran = await runQueueNow()
      showToast(ran ? `รันไป ${ran} งาน` : 'ไม่มีงานในคิว', 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const siteColumns: Column<WebSite>[] = [
    {
      key: 'name',
      header: 'เว็บ',
      mobilePrimary: true,
      sortValue: (s) => s.siteName,
      cell: (s) => {
        const h = healthOf(s)
        return (
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH[h].bar}`} aria-hidden />
            <span className="font-medium text-gray-900">{s.siteName}</span>
            {s.downSince && (
              <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-600">
                <AlertTriangle size={10} /> ล่ม
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'plugins',
      header: 'ปลั๊กอินค้าง',
      align: 'center',
      sortValue: (s) => s.pendingPluginCount,
      cell: (s) =>
        s.pendingPluginCount > 0 ? (
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${HEALTH.pending.chip}`}>
            {s.pendingPluginCount} ตัว
          </span>
        ) : s.pluginsCheckedAt ? (
          <span className="text-xs text-gray-400">ครบ</span>
        ) : (
          <span className="text-xs text-gray-300">ยังไม่ตรวจ</span>
        ),
    },
    {
      key: 'scan',
      header: 'สแกนมัลแวร์',
      cell: (s) =>
        s.lastScanStatus === 'suspect' ? (
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${HEALTH.suspect.chip}`}>
            พบต้องสงสัย
          </span>
        ) : s.lastScanAt ? (
          <span className="text-xs text-gray-500">สะอาด · {fmt(s.lastScanAt)}</span>
        ) : (
          <span className="text-xs text-gray-300">ยังไม่เคยสแกน</span>
        ),
    },
    {
      key: 'wp',
      header: 'WordPress',
      hideOnMobile: true,
      cell: (s) => <span className="text-xs text-gray-500">{s.wpVersion || '—'}</span>,
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy === s.id}
            onClick={(e) => {
              e.stopPropagation()
              fire('plugin_update', { siteIds: [s.id], label: s.siteName })
            }}
          >
            <Puzzle size={13} />
            อัปเดต
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy === s.id}
            onClick={(e) => {
              e.stopPropagation()
              fire('scan', { siteIds: [s.id], label: s.siteName })
            }}
          >
            <ShieldCheck size={13} />
            สแกน
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy === s.id}
            onClick={(e) => {
              e.stopPropagation()
              fire('backup', { siteIds: [s.id], label: s.siteName })
            }}
          >
            <Download size={13} />
            สำรอง
          </Button>
        </div>
      ),
    },
  ]

  /** โชว์เฉพาะตอนแท็บครอบหลายโฮสต์ (เช่น AMGO Hosting ที่แยก SSH รายเว็บ) */
  const hostColumn: Column<WebSite> = {
    key: 'host',
    header: 'โฮสต์',
    hideOnMobile: true,
    cell: (s) => <span className="text-xs text-gray-500">{s.hostName || '—'}</span>,
  }

  const jobColumns: Column<WebJob>[] = [
    {
      key: 'site',
      header: 'เว็บ / โฮสต์',
      mobilePrimary: true,
      cell: (j) => (
        <div>
          <span className="font-medium text-gray-900">{j.siteName || j.hostName || '—'}</span>
          {!j.siteName && j.hostName && (
            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">ทั้งโฮสต์</span>
          )}
        </div>
      ),
    },
    { key: 'type', header: 'งาน', cell: (j) => <span className="text-gray-600">{TYPE_LABEL[j.type]}</span> },
    {
      key: 'status',
      header: 'สถานะ',
      align: 'center',
      cell: (j) => (
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS[j.status].cls}`}>
          {STATUS[j.status].label}
        </span>
      ),
    },
    { key: 'summary', header: 'ผล', cell: (j) => <span className="text-sm text-gray-600">{summaryText(j)}</span> },
    {
      key: 'time',
      header: 'เมื่อ',
      hideOnMobile: true,
      cell: (j) => <span className="text-xs text-gray-500">{fmt(j.finishedAt ?? j.startedAt ?? j.queuedAt)}</span>,
    },
  ]

  if (!canSee || !sites) return <TechLoader />

  const bar = (['suspect', 'pending', 'unknown', 'clean'] as Health[]).filter((k) => stats[k] > 0)

  return (
    <div>
      <PageHeader
        backHref="/websites"
        title="สั่งงานทั้งฟลีต"
        description="ดูสถานะทุกเว็บก่อน แล้วสั่งงานได้ทั้งฟลีต ทั้งโฮสต์ หรือเว็บเดียว"
        icon={ListChecks}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={load}>
              <RefreshCw size={15} />
              รีเฟรช
            </Button>
            <Button variant="secondary" onClick={runNow} disabled={!!busy}>
              <PlayCircle size={15} />
              เร่งคิวเดี๋ยวนี้
            </Button>
          </div>
        }
      />

      <StatGrid>
        <StatCard
          label="เว็บที่ดูแลอยู่"
          value={stats.total}
          hint={
            queueBusy
              ? `กำลังเดินคิว ${queue.queued + queue.running} งาน · หน้านี้อัปเดตเองทุก 10 วิ`
              : 'คิวว่าง'
          }
        />
        <StatCard
          label="ค้างอัปเดตปลั๊กอิน"
          value={stats.pending}
          unit="เว็บ"
          tone={stats.pending ? 'warning' : 'success'}
          hint={stats.pluginCount ? `รวม ${stats.pluginCount} ตัว` : 'ไม่มีค้าง'}
        />
        <StatCard
          label="พบไฟล์ต้องสงสัย"
          value={stats.suspect}
          unit="เว็บ"
          tone={stats.suspect ? 'danger' : 'success'}
          hint={stats.suspect ? 'กดสแกนซ้ำหรือเปิดดูรายชื่อไฟล์' : 'ไม่พบมัลแวร์'}
        />
        <StatCard
          label="ยังไม่เคยตรวจ"
          value={stats.unknown}
          unit="เว็บ"
          tone={stats.unknown ? 'muted' : 'success'}
          hint={stats.unknown ? 'สั่งสแกน/อ่านปลั๊กอินรอบแรก' : 'ตรวจครบทุกเว็บ'}
        />
      </StatGrid>

      {/* แถบสุขภาพฟลีต — สัดส่วนเว็บตามความเร่งด่วน */}
      <SectionCard title="ภาพรวมฟลีต" className="mb-5">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
          {bar.map((k) => (
            <div
              key={k}
              className={HEALTH[k].bar}
              style={{ width: `${(stats[k] / Math.max(stats.total, 1)) * 100}%` }}
              title={`${HEALTH[k].label} ${stats[k]} เว็บ`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {(['suspect', 'pending', 'unknown', 'clean'] as Health[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${HEALTH[k].bar}`} aria-hidden />
              {HEALTH[k].label} <strong className="text-gray-900">{stats[k]}</strong>
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <span className="text-sm text-gray-500">
            สั่งงานกับ <strong className="text-gray-800">{tab === 'all' ? 'ทุกเว็บทั้งฟลีต' : tab}</strong>{' '}
            ({tabSites.length} เว็บ)
          </span>
          <span className="flex flex-wrap gap-2">
            <Button onClick={() => fire('plugin_update')} disabled={!!busy}>
              <Puzzle size={15} />
              อัปเดตปลั๊กอิน
            </Button>
            <Button variant="secondary" onClick={() => fire('scan')} disabled={!!busy}>
              <ShieldCheck size={15} />
              สแกนมัลแวร์
            </Button>
            <Button variant="secondary" onClick={() => fire('backup')} disabled={!!busy}>
              <Download size={15} />
              สำรองข้อมูล
            </Button>
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          ปุ่มทำกับ &quot;แท็บที่เปิดอยู่&quot; เท่านั้น — ลองครั้งแรกเลือกแท็บแพลนเล็ก ๆ ก่อน ดูผลว่าเรียบร้อย
          ค่อยกลับมาแท็บทุกเว็บ · งานเข้าคิวแล้วระบบทยอยทำทีละเว็บต่อโฮสต์ จบรอบสรุปเข้า Discord
        </p>
      </SectionCard>

      {/* รายเว็บ — แยกแท็บทีละแพลนโฮสต์ */}
      <SectionCard className="mb-5">
        <TabBar ariaLabel="เลือกแพลนโฮสต์" className="mb-4">
          <TabItem active={tab === 'all'} onClick={() => setTab('all')} label={`ทุกเว็บ (${workable.length})`} />
          {plans.map((p) => {
            const bad = p.sites.filter((s) => healthOf(s) !== 'clean' && healthOf(s) !== 'unknown').length
            return (
              <TabItem
                key={p.name}
                active={tab === p.name}
                onClick={() => setTab(p.name)}
                label={`${p.name} (${p.sites.length})`}
                sub={bad ? `⚠ ต้องดู ${bad}` : p.own ? 'ของเราเอง' : 'ของลูกค้า'}
              />
            )
          })}
        </TabBar>

        <DataTable
          columns={tab === 'all' || (plans.find((p) => p.name === tab)?.hostIds.length ?? 0) > 1
            ? [siteColumns[0], hostColumn, ...siteColumns.slice(1)]
            : siteColumns}
          rows={tabSites}
          rowKey={(s) => s.id}
          onRowClick={(s) => router.push(`/websites/${s.id}`)}
          emptyTitle="ไม่มีเว็บในแท็บนี้"
        />
      </SectionCard>

      <SectionCard title="ประวัติงานล่าสุด">
        <DataTable
          columns={jobColumns}
          rows={jobs}
          rowKey={(j) => j.id}
          onRowClick={setDetail}
          emptyTitle="ยังไม่มีงาน"
        />
      </SectionCard>

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`${TYPE_LABEL[detail.type]} — ${detail.siteName || detail.hostName || ''}`}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{summaryText(detail)}</p>
            <pre className="max-h-80 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
              {detail.rawLog || '(ไม่มี log)'}
            </pre>
          </div>
        </Modal>
      )}
    </div>
  )
}
