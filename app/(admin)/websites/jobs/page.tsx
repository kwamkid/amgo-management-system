'use client'

// AOO Website — ภาพรวมฟลีต + สั่งงาน
//
// ลำดับการอ่านหน้านี้: "ตอนนี้เป็นยังไง" → "ต้องทำอะไร" → "ทำไปแล้วได้อะไร"
//   1. การ์ดสรุป + แถบสุขภาพฟลีต (เว็บกี่ตัวสะอาด/ค้างอัปเดต/ต้องสงสัย)
//   2. รายเว็บแยกตามแพลนโฮสต์ — เห็นเลยว่าเว็บไหนค้างปลั๊กอินกี่ตัว สแกนล่าสุดเป็นไง
//   3. สั่งงานได้ 3 ระดับ: ทั้งฟลีต · ทั้งโฮสต์ · เว็บเดียว
//   4. ประวัติงานเป็นอีกมุมมอง สลับด้วย Segmented ด้านบนตาราง — ไม่ใช่แท็บแพลน
//      เพราะคนละมิติกัน (แท็บแพลน = กรองเว็บกลุ่มไหน · ประวัติงาน = อีกหน้าจอ)
//
// งานทุกชนิดเข้าคิวเสมอ ไม่ยิงตรง — โฮสต์เดียวกันรันทีละงานเท่านั้น (กันโหลดพุ่ง)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  ListChecks,
  Loader2,
  PlayCircle,
  Puzzle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, HelpTooltip, Modal, TabBar, TabItem } from '@/components/aoo'
import {
  DataTable,
  PageHeader,
  SectionCard,
  Segmented,
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
  type ActiveJob,
  type WebHost,
  type WebJob,
  type WebSite,
} from '@/lib/services/web/webService'

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

/** วันที่ล้วน ไม่เอาเวลา — ใช้กับวันหมดอายุและวันสำรองล่าสุด */
const fmtDay = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

/** ผ่านมากี่วันแล้ว (ติดลบ = ยังมาไม่ถึง) */
const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

const TYPE_LABEL: Record<WebJob['type'], string> = {
  plugin_update: 'อัปเดตปลั๊กอิน',
  plugin_check: 'ตรวจปลั๊กอิน',
  scan: 'สแกนมัลแวร์',
  backup: 'สำรองข้อมูล',
  discover: 'สำรวจรายชื่อเว็บ',
}

/** ปุ่มสั่งงานรายเว็บ — คำอธิบายโผล่ตอน hover เพราะจอแคบเหลือแค่ไอคอน */
const ROW_ACTIONS = [
  {
    type: 'plugin_check',
    Icon: ListChecks,
    label: 'ตรวจ',
    help: 'ดูว่าปลั๊กอินค้างอัปเดตกี่ตัว ไม่แตะอะไรบนเว็บ',
  },
  { type: 'plugin_update', Icon: Puzzle, label: 'อัปเดต', help: 'สั่งอัปเดตปลั๊กอินที่ค้างทั้งหมดจริง' },
  { type: 'scan', Icon: ShieldCheck, label: 'สแกน', help: 'ไล่หาไฟล์ที่เข้าข่ายมัลแวร์ (อ่านอย่างเดียว)' },
  {
    type: 'backup',
    Icon: Download,
    label: 'สำรอง',
    help: 'สร้างไฟล์ .wpress เก็บไว้บนโฮสต์ เก็บย้อนหลังตามที่ตั้งไว้',
  },
] as const

/**
 * ล้างสไตล์ default ของ HelpTooltip (เส้นประใต้ข้อความ + cursor: help)
 * ส่ง {} ไม่พอ เพราะข้างในเป็น { ...default, ...ที่ส่งมา } ต้องเขียนทับทีละค่า
 * — ไม่งั้นเส้นประจะลากใต้ปุ่มทั้งแถวจนดูเหมือนเป็นปุ่มเดียว
 */
const PLAIN_TRIGGER = { borderBottom: 'none', cursor: 'inherit', display: 'inline-flex' } as const

/** ปุ่มสั่งงานทั้งแท็บ — เรียงตามความปลอดภัย ตรวจก่อน แก้ทีหลัง */
const FLEET_ACTIONS = [
  { type: 'plugin_check', Icon: ListChecks, label: 'ตรวจปลั๊กอิน' },
  { type: 'plugin_update', Icon: Puzzle, label: 'อัปเดตปลั๊กอิน' },
  { type: 'scan', Icon: ShieldCheck, label: 'สแกนมัลแวร์' },
  { type: 'backup', Icon: Download, label: 'สำรองข้อมูล' },
] as const

/** อาการที่ตัวเช็คอ่านได้จากเนื้อหาหน้า — เว็บพวกนี้ตอบ 200 แต่คนเข้าไปใช้ไม่ได้ */
const ISSUE_LABEL: Record<string, string> = {
  critical_error: 'critical error',
  db_error: 'ต่อ DB ไม่ได้',
  php_error: 'PHP error',
  maintenance: 'ค้างโหมดปรับปรุง',
  blank_page: 'จอขาว',
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
  if (s.lastScanStatus === 'suspect' || s.downSince || s.pageIssue) return 'suspect'
  if (s.pendingPluginCount > 0) return 'pending'
  if (!s.lastScanAt && !s.pluginsCheckedAt) return 'unknown'
  return 'clean'
}

/** ทำไมจุดหน้าชื่อเว็บถึงเป็นสีนี้ — เจ้าของถามว่า "สแกนสะอาดแต่ทำไมเหลือง" */
function healthReason(s: WebSite): string {
  if (s.lastScanStatus === 'suspect') return 'พบไฟล์ต้องสงสัยจากการสแกน'
  if (s.downSince) return 'เว็บล่ม เข้าไม่ได้'
  if (s.pageIssue) return `หน้าเว็บผิดปกติ — ${ISSUE_LABEL[s.pageIssue] ?? s.pageIssue}`
  if (s.pendingPluginCount > 0) return `ปลั๊กอินค้างอัปเดต ${s.pendingPluginCount} ตัว`
  if (!s.lastScanAt && !s.pluginsCheckedAt) return 'ยังไม่เคยตรวจอะไรเลย'
  return 'ตรวจแล้ว ไม่มีอะไรค้าง'
}

/** วันหมดอายุที่ใกล้ที่สุดในสามอย่าง — โดเมนหมดคือเว็บหาย ไม่ใช่แค่ช้า */
function nextExpiry(s: WebSite): { label: string; date: string } | null {
  const all = [
    { label: 'โดเมน', date: s.domainExpiresAt },
    { label: 'โฮสต์', date: s.hostingExpiresAt },
    { label: 'SSL', date: s.sslExpiresAt },
  ].filter((x): x is { label: string; date: string } => !!x.date)
  return all.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

function summaryText(job: WebJob): string {
  const s = job.summary
  if (!s) return '—'
  if (job.type === 'plugin_check') {
    const names = (s.pendingNames as string[]) ?? []
    const total = (s.total as number) ?? 0
    if (!names.length) return `ครบทุกตัว (${total} ปลั๊กอิน)`
    return `ค้าง ${names.length}/${total}: ${names.join(', ')}`
  }
  if (job.type === 'plugin_update') {
    const updated = (s.pluginsUpdated as string[]) ?? []
    const pending = (s.stillPending as string[]) ?? []
    const gaveUp = (s.gaveUp as string[]) ?? []
    const more =
      (s.continued ? ` · เหลือ ${pending.length} ตัว ต่อคิวแล้ว` : '') +
      (gaveUp.length ? ` · เลิกลอง ${gaveUp.length} ตัว: ${gaveUp.join(', ')}` : '')
    if (updated.length) return `อัปเดต ${updated.length} ตัว: ${updated.join(', ')}${more}`
    return pending.length || gaveUp.length ? `ยังค้าง ${pending.length} ตัว${more}` : 'ไม่มีอะไรค้าง'
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
  const [queue, setQueue] = useState<{ queued: number; running: number; active: ActiveJob[] }>({
    queued: 0,
    running: 0,
    active: [],
  })
  const [busy, setBusy] = useState('')
  const [tab, setTab] = useState('all')
  /** มุมมองหลักของหน้า — รายเว็บ หรือ ประวัติงาน */
  const [view, setView] = useState('sites')
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

  /**
   * เว็บไหนมีงานค้างอยู่บ้าง — ใช้ปิดปุ่มกันกดซ้ำระหว่างรอคิว
   * "กำลังทำ" ชนะ "รอคิว" เสมอ จะได้โชว์สถานะที่คืบหน้ากว่า
   */
  const activeBySite = useMemo(() => {
    const m = new Map<string, ActiveJob>()
    for (const a of queue.active) {
      if (!a.siteId) continue
      const cur = m.get(a.siteId)
      if (!cur || (cur.status === 'queued' && a.status === 'running')) m.set(a.siteId, a)
    }
    return m
  }, [queue.active])

  /** ชนิดงานที่กำลังเดินอยู่ทั้งฟลีต — ใช้กับปุ่มสั่งงานแถบบน */
  const activeTypes = useMemo(
    () => new Set(queue.active.map((a) => a.type)),
    [queue.active]
  )

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
      broken: workable.filter((s) => s.pageIssue && !s.downSince).length,
      malware: workable.filter((s) => s.lastScanStatus === 'suspect').length,
      noBackup: workable.filter((s) => !s.lastBackupAt).length,
      staleBackup: workable.filter((s) => s.lastBackupAt && daysAgo(s.lastBackupAt) > 30).length,
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
      const r = await enqueueJobs({ type, hostId: opts?.hostId, siteIds })
      const where = opts?.label ?? (tab === 'all' ? 'ทั้งฟลีต' : tab)

      // บอกให้ตรงกับที่เกิดขึ้นจริง — สั่ง 49 แล้วเข้าคิว 32 ต้องรู้ว่าอีก 17 หายไปไหน
      const skipped = [
        r.skippedUpToDate ? `ข้าม ${r.skippedUpToDate} เว็บที่ปลั๊กอินครบแล้ว` : '',
        r.skippedQueued ? `ข้าม ${r.skippedQueued} เว็บที่มีงานค้างอยู่` : '',
      ].filter(Boolean)

      if (!r.jobs) showToast(r.message ?? 'ไม่มีเว็บที่ต้องทำ', 'success')
      else
        showToast(
          `เข้าคิวแล้ว ${r.jobs} เว็บ — ${where}${skipped.length ? ` · ${skipped.join(' · ')}` : ''}`,
          'success'
        )
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
      width: 280,
      sticky: true,
      cell: (s) => {
        const h = healthOf(s)
        const exp = nextExpiry(s)
        const expDays = exp ? -daysAgo(exp.date) : null
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <HelpTooltip
                variant="tooltip"
                delay={200}
                triggerStyle={PLAIN_TRIGGER}
                content={`${HEALTH[h].label} — ${healthReason(s)}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH[h].bar}`} />
              </HelpTooltip>
              <span className="truncate font-medium text-gray-900">{s.siteName}</span>
              {s.downSince && (
                <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">ล่ม</span>
              )}
              {/* ตอบ 200 แต่หน้าใช้ไม่ได้ — ต้องเห็นแยกจาก "ล่ม" ไม่งั้นเข้าใจผิดว่าปกติ */}
              {s.pageIssue && !s.downSince && (
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                  {ISSUE_LABEL[s.pageIssue] ?? s.pageIssue}
                </span>
              )}
              {expDays !== null && expDays <= 30 && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${expDays < 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
                  title={`${exp!.label}หมดอายุ ${fmtDay(exp!.date)}`}
                >
                  {exp!.label} {expDays < 0 ? 'หมดแล้ว' : `${expDays} วัน`}
                </span>
              )}
            </div>
            {/* ชื่อแพลนมาไว้บรรทัดล่าง — คอลัมน์ชื่อเว็บกว้างอยู่แล้ว ได้ใช้พื้นที่
                และไม่ต้องมีคอลัมน์โฮสต์แยกที่ดันตารางจนทุกช่องตัดบรรทัด
                ตัดส่วนหลัง " — " ทิ้ง เพราะ SiteGround ตั้งชื่อโฮสต์ตามโดเมนอยู่แล้ว ซ้ำกับชื่อเว็บ */}
            {tab === 'all' && s.hostName && (
              <p className="mt-0.5 truncate pl-4 text-xs text-gray-400">
                {s.hostName.split(' — ')[0]}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'up',
      header: 'โหลด',
      align: 'right',
      hideOnMobile: true,
      sortValue: (s) => (s.downSince ? 999999 : (s.responseMs ?? 999998)),
      cell: (s) => {
        if (s.downSince)
          return (
            <span className={`rounded-md px-2 py-0.5 font-medium ${HEALTH.suspect.chip}`}>ล่ม</span>
          )
        if (!s.lastCheckedAt) return <span className="text-gray-300">—</span>
        const ms = s.responseMs ?? 0
        // เกิน 3 วิ = ผู้ใช้เริ่มรู้สึกช้า · เกิน 6 วิ = คนส่วนใหญ่กดปิดไปแล้ว
        // หลอดเต็ม = 8 วิ กวาดตาลงมาทั้งคอลัมน์แล้วเห็นเลยว่าเว็บไหนช้ากว่าเพื่อน
        const bar = ms > 6000 ? HEALTH.suspect.bar : ms > 3000 ? HEALTH.pending.bar : HEALTH.clean.bar
        return (
          <HelpTooltip
            variant="tooltip"
            delay={300}
            triggerStyle={PLAIN_TRIGGER}
            content={`ใช้เวลาโหลด ${(ms / 1000).toFixed(2)} วินาที · ตอบกลับ ${s.httpStatus ?? '—'} · เช็คล่าสุด ${fmt(s.lastCheckedAt)}`}
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                <span
                  className={`block h-full rounded-full ${bar}`}
                  style={{ width: `${Math.max(6, Math.min(100, (ms / 8000) * 100))}%` }}
                />
              </span>
              <span className="w-11 text-right tabular-nums text-gray-600">
                {(ms / 1000).toFixed(1)} วิ
              </span>
            </span>
          </HelpTooltip>
        )
      },
    },
    {
      key: 'plugins',
      header: 'ปลั๊กอิน',
      align: 'center',
      sortValue: (s) => (s.pluginsCheckedAt ? s.pendingPluginCount : -1),
      // "ค้าง/ทั้งหมด" — ค้าง 3 จาก 5 กับ ค้าง 3 จาก 40 คนละเรื่องกัน ตัวเลขเดี่ยวบอกไม่ได้
      cell: (s) => {
        if (!s.pluginsCheckedAt) return <span className="text-gray-300">—</span>
        const chip = s.pendingPluginCount > 0 ? HEALTH.pending.chip : HEALTH.clean.chip
        return (
          <HelpTooltip
            variant="tooltip"
            delay={300}
            triggerStyle={PLAIN_TRIGGER}
            content={
              (s.pendingPluginCount > 0
                ? `ค้างอัปเดต ${s.pendingPluginCount} ตัว จากทั้งหมด ${s.pluginCount}`
                : `ปลั๊กอิน ${s.pluginCount} ตัว ใหม่ล่าสุดทั้งหมด`) +
              (s.blockedPluginCount
                ? ` · อีก ${s.blockedPluginCount} ตัวระบบอัปเดตให้ไม่ได้ ต้องทำมือ (มักเป็นตัว pro ที่ license หมด)`
                : '') +
              ` · ตรวจล่าสุด ${fmt(s.pluginsCheckedAt)}`
            }
          >
            <span className="inline-flex items-center gap-1">
              {/* ไม่มีอะไรค้าง = บอกเป็นคำ อ่านแล้วจบ ไม่ต้องแปล "0/27" ในหัวอีกที */}
              <span className={`rounded-md px-2 py-0.5 font-medium tabular-nums ${chip}`}>
                {s.pendingPluginCount > 0 ? `${s.pendingPluginCount}/${s.pluginCount}` : 'UTD'}
              </span>
              {/* แยกกองให้ชัด — ของที่ระบบทำต่อได้ กับของที่ต้องคนตัดสินใจ
                  ต้องการการกระทำคนละแบบ ปนกันแล้วสีเหลืองจะไม่มีความหมาย */}
              {s.blockedPluginCount > 0 && (
                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  ทำมือ {s.blockedPluginCount}
                </span>
              )}
            </span>
          </HelpTooltip>
        )
      },
    },
    {
      key: 'scan',
      header: 'สแกน',
      align: 'center',
      sortValue: (s) => (s.lastScanStatus === 'suspect' ? 2 : s.lastScanAt ? 1 : 0),
      cell: (s) =>
        s.lastScanStatus === 'suspect' ? (
          <span className={`rounded-md px-2 py-0.5 font-medium ${HEALTH.suspect.chip}`}>
            ต้องสงสัย
          </span>
        ) : s.lastScanAt ? (
          // วันเวลาไปอยู่ใน tooltip — ถ้าโชว์ทั้งก้อนช่องจะกว้างจนตารางแตก
          <span
            className={`rounded-md px-2 py-0.5 font-medium ${HEALTH.clean.chip}`}
            title={`สแกนล่าสุด ${fmt(s.lastScanAt)}`}
          >
            สะอาด
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'backup',
      header: 'สำรอง',
      align: 'right',
      hideOnMobile: true,
      sortValue: (s) => (s.lastBackupAt ? daysAgo(s.lastBackupAt) : 99999),
      cell: (s) => {
        // ยังไม่เคยสำรองเลยสักเว็บ — ขึ้นแดงทั้ง 49 แถวคือเสียงรบกวน
        // ไปสรุปเป็นตัวเลขเดียวบนการ์ดข้างบนแทน ตรงนี้เงียบไว้
        if (!s.lastBackupAt) return <span className="text-gray-300">—</span>
        const d = daysAgo(s.lastBackupAt)
        // เกิน 30 วันถือว่าเก่าเกินจะกู้ได้จริง — งานเว็บเปลี่ยนแปลงเยอะกว่านั้น
        const tone = d > 30 ? 'text-red-600' : d > 7 ? 'text-amber-600' : 'text-gray-600'
        return (
          <span className={`whitespace-nowrap ${tone}`} title={fmtDay(s.lastBackupAt)}>
            {d === 0 ? 'วันนี้' : `${d} วัน`}
          </span>
        )
      },
    },
    {
      key: 'wp',
      header: 'WP',
      align: 'right',
      hideOnMobile: true,
      cell: (s) => <span className="whitespace-nowrap text-gray-500">{s.wpVersion || '—'}</span>,
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      width: 300,
      // จอกว้างโชว์ข้อความด้วย เพราะไอคอนล้วนเดาไม่ออกว่าปุ่มไหนทำอะไร
      // จอแคบลงเหลือไอคอน แต่ยังมี tooltip บอกชื่อ + คำอธิบายว่าปุ่มนี้ทำอะไรกับเว็บ
      cell: (s) => {
        // เว็บนี้มีงานค้างอยู่ = ปิดปุ่มทั้งแถว กันสั่งซ้ำระหว่างรอคิว
        // (คิวเดินทีละงานต่อโฮสต์ กดเพิ่มไปก็แค่ต่อแถวยาวขึ้น)
        const act = activeBySite.get(s.id)
        return (
          <div className="flex justify-end gap-1.5">
            {ROW_ACTIONS.map(({ type, Icon, label, help }) => {
              const mine = act?.type === type
              const running = mine && act?.status === 'running'
              // ปลั๊กอินครบแล้วก็ไม่มีอะไรให้อัปเดต — ปิดปุ่มไปเลย กันกดแล้วงงว่าไม่เกิดอะไร
              // แต่ถ้ามีตัว "ทำมือ" ค้างอยู่ ยังต้องกดได้ เพราะนี่คือทางลองใหม่หลังต่ออายุ license
              const nothingToDo =
                type === 'plugin_update' &&
                !!s.pluginsCheckedAt &&
                s.pendingPluginCount === 0 &&
                s.blockedPluginCount === 0
              return (
                <HelpTooltip
                  key={type}
                  variant="tooltip"
                  delay={300}
                  triggerStyle={PLAIN_TRIGGER}
                  content={
                    mine
                      ? running
                        ? `${label} — กำลังทำอยู่`
                        : `${label} — เข้าคิวแล้ว รอโฮสต์ว่าง`
                      : act
                        ? `เว็บนี้มีงานค้างอยู่ รอให้เสร็จก่อน`
                        : nothingToDo
                          ? 'ปลั๊กอินครบทุกตัวแล้ว ไม่มีอะไรต้องอัปเดต'
                          : type === 'plugin_update' && s.blockedPluginCount > 0
                            ? `ลองใหม่ทุกตัว รวม ${s.blockedPluginCount} ตัวที่เคยอัปเดตไม่ผ่าน (กดหลังต่ออายุ license)`
                            : `${label} — ${help}`
                  }
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`${label} ${s.siteName}`}
                    disabled={busy === s.id || !!act || nothingToDo}
                    onClick={(e) => {
                      e.stopPropagation()
                      fire(type, { siteIds: [s.id], label: s.siteName })
                    }}
                  >
                    {mine ? (
                      <Loader2
                        size={15}
                        className={running ? 'animate-spin' : 'opacity-60'}
                      />
                    ) : (
                      <Icon size={15} />
                    )}
                    <span className="hidden 2xl:inline">
                      {mine ? (running ? 'กำลังทำ' : 'รอคิว') : label}
                    </span>
                  </Button>
                </HelpTooltip>
              )
            })}
          </div>
        )
      },
    },
  ]

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
        {/* รวมทุกเหตุที่ต้องลงมือ แล้วบอกสัดส่วนในบรรทัดล่าง — ดูใบเดียวรู้ว่าวันนี้มีงานไหม */}
        <StatCard
          label="ต้องดูด่วน"
          value={stats.suspect}
          unit="เว็บ"
          tone={stats.suspect ? 'danger' : 'success'}
          hint={
            stats.suspect
              ? [
                  stats.malware && `มัลแวร์ ${stats.malware}`,
                  stats.down && `ล่ม ${stats.down}`,
                  stats.broken && `หน้าพัง ${stats.broken}`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'ไม่มีเว็บที่ต้องแก้'
          }
        />
        {/* ไม่เคยสำรอง = ความเสี่ยงระดับธุรกิจ ต้องเห็นเป็นตัวเลขเดียว
            ไม่ใช่ป้ายแดงซ้ำ 49 แถวจนชินตาแล้วเลิกมอง */}
        <StatCard
          label="ไม่มีไฟล์สำรอง"
          value={stats.noBackup}
          unit="เว็บ"
          tone={stats.noBackup ? 'danger' : 'success'}
          hint={stats.staleBackup ? `เก่าเกิน 30 วันอีก ${stats.staleBackup} เว็บ` : 'สำรองครบทุกเว็บ'}
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
          {/* ปิดเฉพาะปุ่มของงานชนิดที่กำลังเดินอยู่ ไม่ปิดทั้งแถบ — ระหว่างรออัปเดต
              ยังต้องสั่งสแกนหรือสำรองได้ · งานซ้ำถูกกรองที่ฝั่งเซิร์ฟเวอร์อยู่แล้ว */}
          <span className="flex flex-wrap gap-2">
            {FLEET_ACTIONS.map(({ type, Icon, label }, i) => {
              const mine = activeTypes.has(type)
              return (
                <Button
                  key={type}
                  variant={i === 0 ? 'primary' : 'secondary'}
                  onClick={() => fire(type)}
                  disabled={!!busy || mine}
                >
                  {mine ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                  {mine ? `${label} — กำลังทำ` : label}
                </Button>
              )
            })}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          ปุ่มทำกับ &quot;แท็บที่เปิดอยู่&quot; เท่านั้น · <strong>ตรวจปลั๊กอิน</strong> แค่ดูว่าค้างกี่ตัว
          ไม่แตะเว็บเลย รันทั้งฟลีตได้สบาย ส่วน <strong>อัปเดตปลั๊กอิน</strong> แก้ของจริง
          และทำเฉพาะเว็บที่ยังค้างจริง ๆ (เว็บที่ขึ้น UTD ถูกข้ามอัตโนมัติ) ลองแท็บแพลนเล็ก ๆ ก่อน ·
          งานเข้าคิวแล้วระบบทยอยทำทีละเว็บต่อโฮสต์ จบรอบสรุปเข้า Discord
        </p>
      </SectionCard>

      {/* สลับมุมมองคนละชั้นกับแท็บแพลน — แท็บแพลนคือ "กรองเว็บกลุ่มไหน"
          ส่วนประวัติงานคืออีกหน้าจอ ถ้าเอามารวมแถวเดียวกันจะอ่านแล้วสะดุด */}
      <SectionCard
        className="mb-5"
        title={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'sites', label: `รายเว็บ (${workable.length})` },
                { value: 'jobs', label: 'ประวัติงาน' },
              ]}
            />
            {view === 'jobs' && (
              <span className="text-xs font-normal text-gray-400">
                คลิกแถวเพื่อดู log เต็ม ๆ · แสดง 40 งานล่าสุด
              </span>
            )}
          </div>
        }
      >
        {view === 'sites' ? (
          <>
            <TabBar ariaLabel="เลือกแพลนโฮสต์" className="mb-4">
              <TabItem
                active={tab === 'all'}
                onClick={() => setTab('all')}
                label={`ทุกเว็บ (${workable.length})`}
              />
              {plans.map((p) => {
                const bad = p.sites.filter(
                  (s) => healthOf(s) !== 'clean' && healthOf(s) !== 'unknown'
                ).length
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
              columns={siteColumns}
              rows={tabSites}
              rowKey={(s) => s.id}
              onRowClick={(s) => router.push(`/websites/${s.id}`)}
              emptyTitle="ไม่มีเว็บในแท็บนี้"
            />
          </>
        ) : (
          <DataTable
            columns={jobColumns}
            rows={jobs}
            rowKey={(j) => j.id}
            onRowClick={setDetail}
            emptyTitle="ยังไม่มีงาน"
          />
        )}
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
