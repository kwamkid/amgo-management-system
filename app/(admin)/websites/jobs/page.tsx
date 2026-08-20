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
  ClipboardCopy,
  Clock,
  Download,
  ExternalLink,
  ListChecks,
  Loader2,
  PlayCircle,
  Puzzle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, HelpTooltip, Modal, TabBar, TabItem, useConfirm } from '@/components/aoo'
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
  getLatestJob,
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

/**
 * ปุ่มสั่งงานรายเว็บ — คำอธิบายโผล่ตอน hover เพราะจอแคบเหลือแค่ไอคอน
 *
 * ไม่มี "ตรวจปลั๊กอิน" รายเว็บ เพราะแทบไม่มีเหตุให้กด: cron ตรวจให้ทุกคืนอยู่แล้ว
 * และตอนอัปเดตเสร็จระบบก็อ่านค่าใหม่ให้ในตัว · ถ้าอยากตรวจเดี๋ยวนี้ใช้ปุ่มด้านบน
 */
const ROW_ACTIONS = [
  { type: 'plugin_update', Icon: Puzzle, label: 'อัปเดต', help: 'สั่งอัปเดตปลั๊กอินที่ค้างทั้งหมดจริง' },
  { type: 'scan', Icon: ShieldCheck, label: 'Malware', help: 'ไล่หาไฟล์ที่เข้าข่ายมัลแวร์ (อ่านอย่างเดียว)' },
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

/**
 * งานนี้ไปทำอะไรกับเว็บจริง ๆ — โผล่ในกล่องยืนยันก่อนสั่งทั้งฟลีต
 * เขียนให้ต่างกันชัดว่า "อ่านอย่างเดียว" กับ "แก้ของจริง" คนละเรื่องกัน
 */
const FLEET_RISK: Record<
  (typeof FLEET_ACTIONS)[number]['type'],
  { tone: 'danger' | 'primary'; note: string }
> = {
  plugin_check: {
    tone: 'primary',
    note: 'อ่านอย่างเดียว ไม่แตะไฟล์บนเว็บ · cron ตรวจให้ทุกคืนอยู่แล้ว กดเองเมื่ออยากได้ตัวเลขสดเดี๋ยวนี้',
  },
  plugin_update: {
    tone: 'danger',
    note: 'แก้ของจริงบนเว็บลูกค้า — ปลั๊กอินบางตัวอัปเดตแล้วหน้าเว็บเปลี่ยนได้ และสั่งแล้วยกเลิกกลางทางไม่ได้',
  },
  scan: {
    tone: 'primary',
    note: 'อ่านอย่างเดียว ไม่แตะไฟล์บนเว็บ · แต่กิน CPU โฮสต์ตอนไล่อ่านทุกไฟล์',
  },
  backup: {
    tone: 'primary',
    note: 'สร้างไฟล์ .wpress เก็บไว้บนโฮสต์ — กินพื้นที่ดิสก์ตามขนาดเว็บ',
  },
}

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

/**
 * ตัวกรองด่วนจากการ์ดสรุป — กดตัวเลขแล้วเห็นเว็บที่นับอยู่ในตัวเลขนั้นเลย
 *
 * การ์ดบอกว่า "ค้างอัปเดต 20 เว็บ" แล้วให้ไปไล่หาเองในตาราง 49 แถวคือทางตัน ·
 * เงื่อนไขต้องตรงกับที่ `stats` นับเป๊ะ ๆ ไม่งั้นกดแล้วได้คนละจำนวนกับที่เห็น
 */
const QUICK = {
  pending: { label: 'ค้างอัปเดตปลั๊กอิน', match: (s: WebSite) => healthOf(s) === 'pending' },
  urgent: { label: 'ต้องดูด่วน', match: (s: WebSite) => healthOf(s) === 'suspect' },
  nobackup: { label: 'ไม่มีไฟล์สำรอง', match: (s: WebSite) => !s.lastBackupAt },
} as const

type QuickKey = keyof typeof QUICK

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

/** หลักฐาน 1 ไฟล์ที่ตัวสแกนเก็บมา — ตรงกับ ScanHit ฝั่งเซิร์ฟเวอร์ */
type ScanFinding = {
  path: string
  lines?: { no: number; text: string }[]
  modifiedAt?: string | null
  bytes?: number | null
}

/**
 * ก้อนข้อความพร้อมวางให้ AI — ต้องมีครบพอที่มันตัดสินได้โดยไม่ต้องถามกลับ
 * และต้องบอกกติกาความปลอดภัยไปด้วย เพราะมัลแวร์ WordPress ส่วนใหญ่
 * แทรกอยู่ในไฟล์ที่ถูกต้อง การ "ลบไฟล์ที่เจอ" คือลบเว็บทิ้ง
 */
function aiReport(job: WebJob): string {
  const f = (job.summary?.findings ?? []) as ScanFinding[]
  const ignored = (job.summary?.knownIgnored as number) ?? 0

  const body = f
    .map((x, i) => {
      const when = x.modifiedAt ? new Date(x.modifiedAt).toLocaleString('th-TH') : 'ไม่ทราบ'
      const code = (x.lines ?? []).map((l) => `${l.no}: ${l.text}`).join('\n')
      return [
        `### ${i + 1}. ${x.path}`,
        `- แก้ไขล่าสุด: ${when}`,
        `- ขนาด: ${x.bytes ?? '?'} bytes`,
        '',
        '```php',
        code || '(ไม่มีบรรทัดที่บันทึกไว้)',
        '```',
      ].join('\n')
    })
    .join('\n\n')

  return [
    `# ผลสแกนมัลแวร์ — ${job.siteName || job.hostName || 'ไม่ทราบเว็บ'}`,
    `สแกนเมื่อ ${fmt(job.finishedAt ?? job.queuedAt)} · พบต้องสงสัย ${f.length} ไฟล์` +
      (ignored ? ` · ตัดที่รู้ว่าไม่ใช่ออกแล้ว ${ignored} ไฟล์` : ''),
    '',
    'ตัวสแกนจับด้วย pattern เช่น `eval(base64_decode`, `shell_exec(`, `assert($_`',
    'ซึ่ง**ไลบรารีปกติก็มีใช้** — ต้องดูโค้ดจริงก่อนตัดสิน',
    '',
    body,
    '',
    '---',
    '## สิ่งที่อยากให้ช่วย',
    '1. แยกให้หน่อยว่าไฟล์ไหนเป็นมัลแวร์จริง ไฟล์ไหนเป็นของปกติ (false positive)',
    '2. ถ้าเป็นมัลแวร์ บอกด้วยว่าเป็น **ไฟล์แปลกปลอมทั้งไฟล์** (ลบทิ้งได้)',
    '   หรือ **ไฟล์ที่ถูกต้องแต่โดนแทรกโค้ด** (ต้องลบเฉพาะส่วนที่แทรก ห้ามลบทั้งไฟล์)',
    '3. ถ้าเป็น false positive บอกด้วยว่าควรใส่ pattern อะไรลงรายการยกเว้น',
    '',
    '⚠️ ก่อนแก้ไฟล์ใด ๆ ให้สำรองไฟล์นั้นไว้ก่อนเสมอ',
  ].join('\n')
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

/**
 * ลำดับที่ `web_claim_jobs` หยิบงานจริง — running ก่อน แล้ว `queued_at` แล้ว `id`
 *
 * ต้องตรงกับฝั่ง SQL เป๊ะ ไม่งั้นเลขคิวที่โชว์กับตัวที่ระบบหยิบจริงจะคนละใบ
 */
const claimOrder = (x: ActiveJob, y: ActiveJob) =>
  x.status !== y.status
    ? x.status === 'running'
      ? -1
      : 1
    : x.queuedAt === y.queuedAt
      ? x.id.localeCompare(y.id)
      : x.queuedAt.localeCompare(y.queuedAt)

/** วินาที → "3 นาที" / "1 ชม. 20 นาที" — ต่ำกว่านาทีไม่ต้องละเอียด เดี๋ยวก็ถึงแล้ว */
const fmtWait = (secs: number) => {
  const m = Math.round(secs / 60)
  if (m < 1) return 'อีกไม่ถึงนาที'
  if (m < 60) return `~${m} นาที`
  const h = Math.floor(m / 60)
  const r = m % 60
  return `~${h} ชม.${r ? ` ${r} นาที` : ''}`
}

/**
 * ลิงก์ดาวน์โหลดไฟล์สำรอง — ชี้ตรงไปที่โฮสต์ของเว็บนั้น ไม่ผ่านแอปเรา
 *
 * ai1wm วางไฟล์ไว้ใต้ public_html ซึ่งเปิดจากเน็ตได้อยู่แล้ว (.htaccess ของมัน
 * ปิดแค่การไล่ดูรายชื่อไฟล์ = 403 · ตัวไฟล์ตอบ 200 และรองรับโหลดต่อ)
 * ไฟล์ 5 GB จึงวิ่งจากโฮสต์ไปเครื่องผู้ใช้ตรง ๆ ไม่ชนเพดาน 60 วิของ Vercel
 *
 * ⚠️ ลิงก์นี้เท่ากับรหัสผ่านของเว็บนั้นทั้งเว็บ — ใครมีก็โหลดฐานข้อมูลทั้งก้อนได้
 * ที่ยังปลอดภัยเพราะชื่อไฟล์มีตัวสุ่มต่อท้ายและไล่ดูรายชื่อไฟล์ไม่ได้
 */
const backupUrl = (s: WebSite) =>
  `https://${s.siteName}/wp-content/ai1wm-backups/${s.lastBackupFile}`

/** คำสั่งโหลดทั้งรายการ — curl มากับ macOS อยู่แล้ว (wget ไม่มี) · -C - คือโหลดต่อได้ */
const DOWNLOAD_CMD = 'xargs -n1 curl -C - -O < amgo-backups.txt'

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
  /** ตัวกรองด่วนที่กดมาจากการ์ดสรุป — ซ้อนบนแท็บแพลน (แท็บเลือกกลุ่ม การ์ดเลือกอาการ) */
  const [quick, setQuick] = useState<QuickKey | ''>('')
  /** มุมมองหลักของหน้า — รายเว็บ หรือ ประวัติงาน */
  const [view, setView] = useState('sites')
  /** กางคิวเต็มไว้ไหม — ปิดไว้ก่อน เพราะปกติดูแค่ "ตอนนี้ทำอะไร" ก็พอ
      จะกางก็ต่อเมื่ออยากรู้ว่าเว็บของตัวเองอยู่ตรงไหนของคิว 98 ใบ */
  const [queueOpen, setQueueOpen] = useState(false)
  const [detail, setDetail] = useState<WebJob | null>(null)
  const { confirm, dialog: confirmDialog } = useConfirm()

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

  // รอบตามคิว — ถามแค่คิวกับประวัติงาน (ไม่กี่สิบแถว) แล้วค่อยดึงเว็บทั้ง 49 ตัวใหม่
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
   * งานค้างของแต่ละเว็บ แยกตาม "ชนิดงาน" — ปุ่มแต่ละใบดูเฉพาะชนิดของตัวเอง
   *
   * เก็บเป็น map ซ้อน map ไม่ใช่งานเดียวต่อเว็บ เพราะเว็บหนึ่งมีงานค้างพร้อมกัน
   * หลายชนิดได้จริง (ตรวจปลั๊กอินทั้งฟลีต + สั่งสำรองรายตัว) · ถ้าเก็บตัวเดียว
   * งานชนิดอื่นจะบังปุ่มที่ยังกดได้จนหมดแถว
   * "กำลังทำ" ชนะ "รอคิว" เสมอ จะได้โชว์สถานะที่คืบหน้ากว่า
   */
  const activeBySite = useMemo(() => {
    const m = new Map<string, Map<WebJob['type'], ActiveJob>>()
    for (const a of queue.active) {
      if (!a.siteId) continue
      let byType = m.get(a.siteId)
      if (!byType) m.set(a.siteId, (byType = new Map()))
      const cur = byType.get(a.type)
      if (!cur || (cur.status === 'queued' && a.status === 'running')) byType.set(a.type, a)
    }
    return m
  }, [queue.active])

  /** ชนิดงานที่กำลังเดินอยู่ทั้งฟลีต — ใช้กับปุ่มสั่งงานแถบบน */
  const activeTypes = useMemo(
    () => new Set(queue.active.map((a) => a.type)),
    [queue.active]
  )

  /** คิวเก็บแค่ id — ชื่อเว็บ/ชื่อโฮสต์ต้องแปลงเองที่หน้า ถึงจะบอกได้ว่ากำลังทำ "เว็บไหน" */
  const siteNameOf = useMemo(() => new Map((sites ?? []).map((s) => [s.id, s.siteName])), [sites])
  const hostNameOf = useMemo(() => new Map(hosts.map((h) => [h.id, h.name])), [hosts])

  /** งานที่กำลังทำอยู่จริงเดี๋ยวนี้ — โฮสต์ละไม่เกิน 1 ตัวตามกติกาคิว */
  const runningNow = useMemo(() => queue.active.filter((a) => a.status === 'running'), [queue.active])
  const runningByHost = useMemo(
    () => new Map(runningNow.filter((a) => a.hostId).map((a) => [a.hostId!, a])),
    [runningNow]
  )

  /** ที่รออยู่เป็นงานอะไรบ้าง — "รออีก 30 งาน" เฉย ๆ ไม่บอกว่ารออะไร */
  const queuedByType = useMemo(() => {
    const m = new Map<WebJob['type'], number>()
    for (const a of queue.active) if (a.status === 'queued') m.set(a.type, (m.get(a.type) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [queue.active])

  /**
   * งานใบนี้ต้องรออีกกี่คิว — เรียงตามกติกาที่ web_claim_jobs หยิบจริง
   * (โฮสต์เดียวกันทำทีละงาน เรียงตาม queued_at แล้ว id)
   *
   * ป้าย "รอคิว" เฉย ๆ ตอบไม่ได้ว่ารออะไรอยู่ — สั่งตรวจปลั๊กอินทั้งฟลีตทีเดียว
   * ดองคิวโฮสต์นั้นไว้ 20 กว่างาน แล้วงานที่กดทีหลังดูเหมือนค้างไม่ไปไหน
   */
  /**
   * จังหวะที่คิวเดินจริง — ระยะจาก "ใบก่อนหน้าเริ่ม" ถึง "ใบถัดไปเริ่ม" บนโฮสต์เดียวกัน
   *
   * ห้ามเอา "เวลาที่งานใช้ทำ" มาประมาณ ETA · ตัวไล่คิวหยิบรอบละ 2 ใบแล้วจบ request
   * (`drain(2)` ไม่มีลูป) ความเร็วคิวจึงถูกกำหนดด้วยจังหวะ cron ไม่ใช่ความเร็วงาน —
   * ของจริงวัดได้ ~120 วิ/ใบ ขณะที่ตัวงานเองใช้ ~12 วิ ต่างกัน 10 เท่า
   *
   * นับเฉพาะคู่ที่ใบหลัง "รออยู่แล้ว" ตอนใบหน้าเริ่ม ไม่งั้นช่วงที่คิวว่าง ๆ
   * จะถูกนับเป็นความช้าของคิว · วัดไม่ได้ก็ไม่โชว์ ETA ดีกว่าโชว์เลขที่ผิด
   */
  const slotSecs = useMemo(() => {
    const byHost = new Map<string, WebJob[]>()
    for (const j of jobs) {
      if (!j.hostId || !j.startedAt) continue
      const l = byHost.get(j.hostId)
      if (l) l.push(j)
      else byHost.set(j.hostId, [j])
    }
    const gaps: number[] = []
    for (const l of byHost.values()) {
      l.sort((a, b) => a.startedAt!.localeCompare(b.startedAt!))
      for (let i = 1; i < l.length; i++) {
        const prev = l[i - 1].startedAt!
        const cur = l[i]
        if (cur.queuedAt > prev) continue
        const g = (new Date(cur.startedAt!).getTime() - new Date(prev).getTime()) / 1000
        if (g >= 1 && g <= 3600) gaps.push(g)
      }
    }
    if (gaps.length < 3) return null
    gaps.sort((a, b) => a - b)
    return gaps[Math.floor(gaps.length / 2)]
  }, [jobs])

  /**
   * คิวเต็มแยกตามโฮสต์ เรียงตามลำดับที่ระบบจะหยิบจริง + เวลาที่คาดว่าจะได้เริ่ม
   *
   * แยกตามโฮสต์เพราะแต่ละโฮสต์เดินคิวของตัวเองขนานกัน (ทีละงานต่อโฮสต์) —
   * เอามากองรวมเป็นลิสต์เดียวจะอ่านเหมือนต้องรอต่อคิวกันทั้งหมด ซึ่งไม่จริง
   *
   * เวลารอ = ลำดับที่ × จังหวะคิว — ใบที่อยู่หน้าสุดได้คิวรอบถัดไป ใบถัดไปอีกรอบ
   * เป็นการประมาณจากจังหวะที่วัดได้ ไม่ใช่นาฬิกาจับเวลา
   */
  const queueByHost = useMemo(() => {
    const byHost = new Map<string, ActiveJob[]>()
    for (const a of queue.active) {
      const k = a.hostId ?? '—'
      const list = byHost.get(k)
      if (list) list.push(a)
      else byHost.set(k, [a])
    }
    return [...byHost.entries()]
      .map(([hostId, list]) => {
        const rows = [...list].sort(claimOrder).map((job, i) => ({
          job,
          waitSecs: slotSecs === null || job.status === 'running' ? null : i * slotSecs,
        }))
        return {
          hostId,
          hostName: hostNameOf.get(hostId) ?? 'ไม่ทราบโฮสต์',
          rows,
          totalSecs: slotSecs === null ? null : rows.length * slotSecs,
        }
      })
      .sort((a, b) => b.rows.length - a.rows.length)
  }, [queue.active, slotSecs, hostNameOf])

  /**
   * งานใบนี้ต้องรออีกกี่คิว — อ่านจากลำดับที่ `queueByHost` จัดไว้แล้ว
   *
   * ป้าย "รอคิว" เฉย ๆ ตอบไม่ได้ว่ารออะไรอยู่ — สั่งตรวจปลั๊กอินทั้งฟลีตทีเดียว
   * ดองคิวโฮสต์นั้นไว้ 20 กว่างาน แล้วงานที่กดทีหลังดูเหมือนค้างไม่ไปไหน
   */
  const aheadOf = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of queueByHost) h.rows.forEach((r, i) => m.set(r.job.id, i))
    return m
  }, [queueByHost])

  /** งานหนึ่งใบเขียนเป็นประโยคเดียว: "ตรวจปลั๊กอิน — bebbykids.com" */
  const jobLabel = useCallback(
    (a: ActiveJob) =>
      `${TYPE_LABEL[a.type]} — ${
        a.siteId
          ? (siteNameOf.get(a.siteId) ?? 'เว็บที่ถูกลบไปแล้ว')
          : `ทั้งโฮสต์ ${hostNameOf.get(a.hostId ?? '') ?? ''}`.trim()
      }`,
    [siteNameOf, hostNameOf]
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
      // มีงานเดินอยู่ = ทุก 5 วิ ให้แถบความคืบหน้าขยับพอเห็น
      // คิวว่าง = ทุก 60 วิ พอให้เห็นงานที่ cron สั่งเอง
      if (queueBusyRef.current || n % 12 === 0) tick()
    }, 5_000)
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

  /** เว็บที่แท็บปัจจุบันครอบอยู่ */
  const tabSites = useMemo(
    () => (tab === 'all' ? workable : (plans.find((p) => p.name === tab)?.sites ?? [])),
    [tab, workable, plans]
  )

  /**
   * เว็บที่เห็นอยู่ตรงหน้าจริง ๆ = แท็บแพลน + ตัวกรองด่วนจากการ์ด
   *
   * ปุ่มสั่งงานยึดชุดนี้ ไม่ใช่ทั้งแท็บ — กด "ค้างอัปเดต 20 เว็บ" แล้วกดอัปเดต
   * ต้องได้ 20 เว็บนั้น ไม่ใช่ 49 · ตารางกับปุ่มต้องพูดถึงของชุดเดียวกันเสมอ
   */
  const viewSites = useMemo(
    () => (quick ? tabSites.filter(QUICK[quick].match) : tabSites),
    [quick, tabSites]
  )

  /** กดการ์ดใบเดิมซ้ำ = เลิกกรอง — ไม่ต้องไปตามหาปุ่มล้างที่อื่น */
  const toggleQuick = (k: QuickKey) => setQuick((cur) => (cur === k ? '' : k))

  /** "ทั้งฟลีตแบบไม่กรองอะไรเลย" — ตัวกรอง UTD ฝั่งเซิร์ฟเวอร์ทำงานเฉพาะเคสนี้ */
  const wholeFleet = tab === 'all' && !quick
  /** ขอบเขตที่ปุ่มจะไปทำ เขียนเป็นคำ — ใช้ทั้งบนปุ่ม ในกล่องยืนยัน และใน toast */
  const scopeLabel = `${tab === 'all' ? 'ทุกเว็บทั้งฟลีต' : tab}${quick ? ` · เฉพาะที่${QUICK[quick].label}` : ''}`

  /**
   * ปุ่มรวมแต่ละใบจะได้ทำจริงกี่เว็บ — ต้องรู้ "ก่อนกด" ไม่ใช่รู้ตอนกดไปแล้ว
   *
   * เจ้าของถาม 16 ส.ค. 69 ว่าตอนงานเดินอยู่น่าจะกดไม่ได้ไหม จะได้ไม่กดซ้ำ ·
   * ล็อกทั้งใบตอนมีงานเดินไม่ได้ เพราะ 15 ส.ค. เพิ่งปลดล็อกไปตามที่เจ้าของสั่งเอง
   * (ล็อกแล้วสั่ง "เว็บที่เหลือ" ไม่ได้เลย — กดรายเว็บไป 2 ตัวก็สั่งทั้งกลุ่มไม่ได้)
   * ทางออกคือล็อกเฉพาะตอน "ไม่เหลืออะไรให้ทำจริง ๆ" แล้วบอกจำนวนที่เหลือบนปุ่ม
   *
   * เซิร์ฟเวอร์ข้ามเว็บที่ปลั๊กอินครบ "เฉพาะตอนสั่งทั้งฟลีตแบบไม่กรอง" — พอกรอง
   * ด้วยแท็บหรือการ์ด หน้าเว็บจะส่ง siteIds ไปตรง ๆ จึงไม่โดนกรองชั้นนั้น
   *
   * ยังมีชั้นพัก 10 นาทีที่เซิร์ฟเวอร์อีกชั้นซึ่งหน้าเว็บมองไม่เห็น เลขบนปุ่มจึงเป็น
   * "อย่างมากที่สุด" ไม่ใช่คำมั่น · กดแล้วโดนข้ามหมด เซิร์ฟเวอร์จะตอบเหตุผลมาเอง
   */
  const fleetCounts = useMemo(() => {
    const m = new Map<
      (typeof FLEET_ACTIONS)[number]['type'],
      { willRun: number; skipUtd: number; skipQueued: number }
    >()
    for (const { type } of FLEET_ACTIONS) {
      let skipUtd = 0
      let skipQueued = 0
      let willRun = 0
      for (const s of viewSites) {
        if (type === 'plugin_update' && wholeFleet && s.pluginsCheckedAt && s.pendingPluginCount === 0)
          skipUtd++
        else if (activeBySite.get(s.id)?.has(type)) skipQueued++
        else willRun++
      }
      m.set(type, { willRun, skipUtd, skipQueued })
    }
    return m
  }, [viewSites, wholeFleet, activeBySite])

  const fire = async (
    type: WebJob['type'],
    opts?: { hostId?: string; siteIds?: string[]; label?: string }
  ) => {
    // ไม่ระบุมา = ทำกับเว็บที่เห็นอยู่ตรงหน้า · ส่ง undefined ได้เฉพาะตอน
    // "ทุกเว็บ ไม่กรองอะไรเลย" เพราะนั่นแปลว่าทั้งฟลีตจริง ๆ
    const siteIds = opts?.siteIds ?? (wholeFleet ? undefined : viewSites.map((s) => s.id))

    // กรองจนไม่เหลือเว็บแล้วยังกดปุ่ม = ต้องไม่ส่งอะไรออกไปเลย
    // เซิร์ฟเวอร์เช็ค `siteIds?.length` ลิสต์ว่างจึงถูกมองว่า "ไม่ได้ระบุ"
    // แล้วไปทำทั้ง 49 เว็บแทน — พลาดชั้นนี้ทีเดียวคือยิงทั้งฟลีตโดยไม่ได้ตั้งใจ
    if (siteIds && !siteIds.length) {
      showToast('ไม่มีเว็บให้สั่งงานในมุมมองนี้ — ลองล้างตัวกรองหรือเปลี่ยนแท็บ', 'error')
      return
    }

    const key = opts?.siteIds?.[0] ?? opts?.hostId ?? type
    setBusy(key)
    try {
      const r = await enqueueJobs({ type, hostId: opts?.hostId, siteIds })
      const where = opts?.label ?? scopeLabel

      // บอกให้ตรงกับที่เกิดขึ้นจริง — สั่ง 49 แล้วเข้าคิว 32 ต้องรู้ว่าอีก 17 หายไปไหน
      const skipped = [
        r.skippedUpToDate ? `ข้าม ${r.skippedUpToDate} เว็บที่ปลั๊กอินครบแล้ว` : '',
        r.skippedQueued ? `ข้าม ${r.skippedQueued} เว็บที่มีงานค้างอยู่` : '',
        r.skippedRecent ? `ข้าม ${r.skippedRecent} เว็บที่เพิ่งทำไป` : '',
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

  /**
   * ปุ่มฟลีตยิงทีเดียวหลายสิบเว็บ — ถามก่อนเสมอ แต่ถามแบบมีตัวเลข
   *
   * กล่องที่ถามแค่ "แน่ใจไหม" คนกดตกลงอัตโนมัติภายในสองวัน · ต้องบอกว่า
   * "กี่เว็บ ข้ามกี่เว็บ เพราะอะไร งานนี้ไปแตะอะไรบ้าง" ถึงจะมีค่าพอให้หยุดอ่าน
   * — นับด้วยกติกาเดียวกับที่ enqueue กรองจริง จะได้ไม่หลอกกันเอง
   */
  /**
   * ดาวน์โหลดทั้งฟลีต — ให้ "ไฟล์รายการลิงก์" ไม่ใช่ยิง 49 แท็บพร้อมกัน
   *
   * ไฟล์สำรองเว็บละหลาย GB (abcthebaby 4.9 GB) เบราว์เซอร์โหลดพร้อมกัน 49 ไฟล์
   * ไม่รอด และเน็ตหลุดทีเดียวเริ่มใหม่หมด · โหลดผ่าน curl ทีละไฟล์แทน
   * โฮสต์รองรับ range request ทำให้ `-C -` โหลดต่อจากที่ค้างได้
   */
  const downloadList = () => {
    const ready = viewSites.filter((s) => s.lastBackupFile)
    if (!ready.length) {
      showToast('ยังไม่มีเว็บไหนที่รู้ชื่อไฟล์สำรอง — สั่งสำรองหรือรอรอบตรวจคืนนี้ก่อน', 'error')
      return
    }
    const blob = new Blob([ready.map(backupUrl).join('\n') + '\n'], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'amgo-backups.txt'
    a.click()
    URL.revokeObjectURL(url)
    const skipped = viewSites.length - ready.length
    showToast(
      `ได้รายการ ${ready.length} ลิงก์แล้ว${skipped ? ` (ข้าม ${skipped} เว็บที่ยังไม่มีไฟล์)` : ''} — ` +
        `เปิด Terminal ในโฟลเดอร์ที่ไฟล์อยู่แล้วรัน: ${DOWNLOAD_CMD}`,
      'success'
    )
  }

  const fireFleet = async (type: (typeof FLEET_ACTIONS)[number]['type'], label: string) => {
    const { willRun, skipUtd, skipQueued } = fleetCounts.get(type)!

    // ไม่มีอะไรให้ทำ = ไม่ต้องถาม ปล่อยให้เซิร์ฟเวอร์ตอบเหตุผลเต็ม ๆ ผ่าน toast
    // (ยังไงก็ไม่มีอะไรเกิดขึ้น จะขึ้นกล่องยืนยันให้กดเล่นทำไม)
    if (!willRun) return fire(type)

    const risk = FLEET_RISK[type]
    const ok = await confirm({
      title: `${label} — ${scopeLabel}?`,
      tone: risk.tone,
      confirmLabel: `สั่งเลย ${willRun} เว็บ`,
      children: (
        <div className="space-y-2.5 text-sm text-gray-600">
          <p>
            จะเข้าคิว <strong className="text-gray-900">{willRun} เว็บ</strong> จาก{' '}
            {viewSites.length} เว็บที่เห็นอยู่
            {tab === 'all' ? '' : ` ในแพลน ${tab}`}
            {quick ? ` (กรอง "${QUICK[quick].label}" อยู่)` : ''}
          </p>
          {(skipUtd > 0 || skipQueued > 0) && (
            <ul className="list-inside list-disc space-y-0.5 text-gray-500">
              {skipUtd > 0 && <li>ข้าม {skipUtd} เว็บที่ปลั๊กอินครบแล้ว</li>}
              {skipQueued > 0 && <li>ข้าม {skipQueued} เว็บที่มีงานนี้ค้างคิวอยู่</li>}
            </ul>
          )}
          <p className={risk.tone === 'danger' ? 'text-red-600' : ''}>{risk.note}</p>
          <p className="text-xs text-gray-400">
            เว็บที่เพิ่งทำงานนี้ไปไม่ถึง 10 นาทีจะถูกข้ามอีกชั้นที่เซิร์ฟเวอร์ · คิวเดินทีละเว็บต่อโฮสต์
            จบรอบสรุปเข้า Discord
          </p>
        </div>
      ),
    })
    if (ok) fire(type)
  }

  /** เปิดรายละเอียดผลสแกนล่าสุดของเว็บนั้น (ดึงแยก เพราะประวัติหน้าเว็บมีแค่ 40 แถว) */
  const [openingScan, setOpeningScan] = useState('')
  const openScan = async (s: WebSite) => {
    setOpeningScan(s.id)
    try {
      const j = await getLatestJob(s.id, 'scan')
      if (j) setDetail(j)
      else showToast('ยังไม่มีผลสแกนที่บันทึกไว้ — ลองสั่งสแกนใหม่', 'error')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setOpeningScan('')
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
              {/* เปิดเว็บจริงในแท็บใหม่ — แยกเป็นไอคอน ไม่ผูกกับตัวชื่อ เพราะคลิกแถว
                  พาไปหน้ารายละเอียดเว็บอยู่แล้ว · ชื่อที่กดแล้วไปคนละที่กับแถว = กับดัก
                  โดเมนต่อ https:// ตรง ๆ แบบเดียวกับที่ตัวเช็คเว็บล่มใช้ยิงจริง */}
              <HelpTooltip
                variant="tooltip"
                delay={300}
                triggerStyle={PLAIN_TRIGGER}
                content={`เปิด ${s.siteName} ในแท็บใหม่`}
              >
                <a
                  href={`https://${s.siteName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`เปิด ${s.siteName} ในแท็บใหม่`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                >
                  <ExternalLink size={13} />
                </a>
              </HelpTooltip>
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
      header: 'สถานะเว็บ',
      align: 'right',
      hideOnMobile: true,
      width: 150,
      sortValue: (s) => (s.downSince ? 999999 : (s.responseMs ?? 999998)),
      // 2 บรรทัด: บนบอก "ใช้ได้ไหม/เร็วแค่ไหน" ล่างบอก "ข้อมูลนี้สดแค่ไหน"
      // เวลาเช็คต้องเห็นด้วยตา ไม่ใช่ซ่อนใน tooltip — ตัวเลขที่ไม่รู้ว่าของเมื่อไหร่ เชื่อไม่ได้
      cell: (s) => {
        const when = s.lastCheckedAt ? (
          <p className="mt-0.5 text-xs text-gray-400">เช็ค {fmt(s.lastCheckedAt)}</p>
        ) : null

        if (s.downSince)
          return (
            <div>
              <span className={`rounded-md px-2 py-0.5 font-medium ${HEALTH.suspect.chip}`}>
                ล่ม
              </span>
              {when}
            </div>
          )
        if (!s.lastCheckedAt) return <span className="text-gray-300">ยังไม่เคยเช็ค</span>

        const ms = s.responseMs ?? 0
        // เกิน 3 วิ = ผู้ใช้เริ่มรู้สึกช้า · เกิน 6 วิ = คนส่วนใหญ่กดปิดไปแล้ว
        // หลอดเต็ม = 8 วิ กวาดตาลงมาทั้งคอลัมน์แล้วเห็นเลยว่าเว็บไหนช้ากว่าเพื่อน
        const bar = ms > 6000 ? HEALTH.suspect.bar : ms > 3000 ? HEALTH.pending.bar : HEALTH.clean.bar
        return (
          <div>
            <HelpTooltip
              variant="tooltip"
              delay={300}
              triggerStyle={PLAIN_TRIGGER}
              content={`เปิดได้ปกติ · ตอบกลับ ${s.httpStatus ?? '—'} · ใช้เวลาโหลด ${(ms / 1000).toFixed(2)} วินาที`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100">
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
            {when}
          </div>
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
        // กำลังอัปเดตอยู่จริง = โชว์ความคืบหน้าแทนตัวเลขนิ่ง ๆ
        // มีแถบเฉพาะงานที่นับขั้นได้ (อัปเดตทีละตัว) งานอื่น progressTotal = 0
        const job = activeBySite.get(s.id)?.get('plugin_update')
        if (job?.status === 'running' && job.progressTotal > 0) {
          const pct = Math.round((job.progressDone / job.progressTotal) * 100)
          return (
            <HelpTooltip
              variant="tooltip"
              delay={200}
              triggerStyle={PLAIN_TRIGGER}
              content={
                job.progressNote
                  ? `กำลังอัปเดต ${job.progressNote} (${job.progressDone}/${job.progressTotal})`
                  : `อัปเดตไปแล้ว ${job.progressDone} จาก ${job.progressTotal} ตัว`
              }
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-amber-100">
                  <span
                    className="block h-full rounded-full bg-amber-400 transition-[width] duration-500"
                    style={{ width: `${Math.max(6, pct)}%` }}
                  />
                </span>
                <span className="tabular-nums text-xs text-amber-700">
                  {job.progressDone}/{job.progressTotal}
                </span>
              </span>
            </HelpTooltip>
          )
        }

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
                : '')
            }
          >
            {/* วันเวลาที่ตรวจอยู่ใต้ป้าย ไม่ใช่ใน tooltip — "4/27" ของเมื่อวาน
                กับของเมื่อชั่วโมงที่แล้วคนละความหมาย ต้องเห็นพร้อมตัวเลข
                (แถวสูง 2 บรรทัดอยู่แล้วจากคอลัมน์สถานะเว็บ บรรทัดนี้จึงไม่กินที่เพิ่ม) */}
            <span className="inline-block">
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
              <span className="mt-0.5 block whitespace-nowrap text-xs text-gray-400">
                ตรวจ {fmt(s.pluginsCheckedAt)}
              </span>
            </span>
          </HelpTooltip>
        )
      },
    },
    {
      key: 'scan',
      header: 'Malware',
      align: 'center',
      sortValue: (s) => (s.lastScanStatus === 'suspect' ? 2 : s.lastScanAt ? 1 : 0),
      cell: (s) =>
        s.lastScanStatus === 'suspect' ? (
          // กดแล้วเปิดรายละเอียดงานสแกนล่าสุด — เห็นว่าไฟล์ไหนผิดตรงไหน
          // พร้อมปุ่มคัดลอกให้ AI · ป้ายที่บอกแค่ "ต้องสงสัย" แล้วจบคือทางตัน
          <button
            type="button"
            className={`rounded-md px-2 py-0.5 font-medium underline decoration-dotted underline-offset-2 hover:brightness-95 ${HEALTH.suspect.chip}`}
            onClick={(e) => {
              e.stopPropagation()
              openScan(s)
            }}
          >
            {openingScan === s.id ? 'กำลังเปิด…' : 'ต้องสงสัย'}
          </button>
        ) : s.lastScanAt ? (
          <div>
            <span className={`rounded-md px-2 py-0.5 font-medium ${HEALTH.clean.chip}`}>สะอาด</span>
            <p className="mt-0.5 text-xs text-gray-400">{fmt(s.lastScanAt)}</p>
          </div>
        ) : (
          <span className="text-gray-300">ยังไม่เคยสแกน</span>
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
          <div className="flex items-center justify-end gap-1.5">
            <div>
              <span className={`whitespace-nowrap ${tone}`}>{d === 0 ? 'วันนี้' : `${d} วัน`}</span>
              {/* "12 วัน" บอกว่าเก่าแค่ไหน วันที่จริงบอกว่าไฟล์ไหน — ตอนจะกู้ต้องใช้ทั้งคู่
                  และไม่ควรต้องเอาเมาส์ไปจิ้มทีละแถวเพื่อดู */}
              <p className="mt-0.5 whitespace-nowrap text-xs text-gray-400">{fmtDay(s.lastBackupAt)}</p>
            </div>
            {s.lastBackupFile && (
              <HelpTooltip
                variant="tooltip"
                delay={300}
                triggerStyle={PLAIN_TRIGGER}
                content={`ดาวน์โหลด ${s.lastBackupFile}`}
              >
                <a
                  href={backupUrl(s)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`ดาวน์โหลดไฟล์สำรองของ ${s.siteName}`}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Download size={15} />
                </a>
              </HelpTooltip>
            )}
          </div>
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
      width: 240,
      // จอกว้างโชว์ข้อความด้วย เพราะไอคอนล้วนเดาไม่ออกว่าปุ่มไหนทำอะไร
      // จอแคบลงเหลือไอคอน แต่ยังมี tooltip บอกชื่อ + คำอธิบายว่าปุ่มนี้ทำอะไรกับเว็บ
      cell: (s) => {
        // ปิดเฉพาะปุ่มที่มี "งานชนิดเดียวกัน" ค้างอยู่ — ชนิดอื่นยังกดต่อคิวได้
        // (ตรวจปลั๊กอินทั้งฟลีตค้างคิวอยู่ ไม่ใช่เหตุผลที่จะสั่งสำรองไม่ได้ ·
        //  ฝั่ง API ก็กันซ้ำเฉพาะชนิดเดียวกันอยู่แล้ว ล็อกทั้งแถวคือหน้าเว็บ
        //  เข้มเกินของจริง แล้วกลายเป็นปุ่มตายที่ไม่บอกเหตุผล)
        const jobs = activeBySite.get(s.id)
        // โฮสต์นี้กำลังทำอะไรอยู่ — ใช้อธิบายว่าทำไมงานที่กดยังไม่เริ่มสักที
        const hostBusy = s.hostId ? runningByHost.get(s.hostId) : undefined
        return (
          <div className="flex justify-end gap-1.5">
            {ROW_ACTIONS.map(({ type, Icon, label, help }) => {
              const act = jobs?.get(type)
              const mine = !!act
              const running = act?.status === 'running'
              // รออีกกี่งานบนโฮสต์นี้ — "รอคิว" เฉย ๆ ไม่บอกว่าอีกนานแค่ไหน
              const ahead = act && !running ? (aheadOf.get(act.id) ?? 0) : 0
              const waitNote =
                (ahead ? `คิวที่ ${ahead + 1} ของโฮสต์นี้ รออีก ${ahead} งาน` : 'เป็นคิวถัดไปของโฮสต์นี้') +
                (hostBusy ? ` · ตอนนี้โฮสต์กำลัง${jobLabel(hostBusy)}` : ' · รอระบบหยิบคิว (ทุก 1–2 นาที)')
              // งานชนิดอื่นที่ค้างอยู่ — ไม่ปิดปุ่ม แต่บอกไว้ว่ากดแล้วจะไปต่อคิวหลังตัวนี้
              const others = jobs ? [...jobs.values()].filter((j) => j.type !== type) : []
              const other = others.find((j) => j.status === 'running') ?? others[0]
              const otherNow = other
                ? `ตอนนี้เว็บนี้${other.status === 'running' ? 'กำลัง' : 'รอคิว'}${TYPE_LABEL[other.type]}อยู่`
                : ''
              const queueNote = other ? ` · ${otherNow} กดได้เลย ระบบจะต่อคิวให้ทำหลังจากนั้น` : ''
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
                        : `${label} — เข้าคิวแล้ว · ${waitNote}`
                      : nothingToDo
                        ? // ปุ่มนี้ปิดอยู่จริง เลยบอกแค่ว่ามีอะไรค้าง ไม่ต้องชวนให้กด
                          `ปลั๊กอินครบทุกตัวแล้ว ไม่มีอะไรต้องอัปเดต${other ? ` · ${otherNow}` : ''}`
                        : type === 'plugin_update' && s.blockedPluginCount > 0
                          ? `ลองใหม่ทุกตัว รวม ${s.blockedPluginCount} ตัวที่เคยอัปเดตไม่ผ่าน (กดหลังต่ออายุ license)${queueNote}`
                          : `${label} — ${help}${queueNote}`
                  }
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`${label} ${s.siteName}`}
                    disabled={busy === s.id || mine || nothingToDo}
                    onClick={(e) => {
                      e.stopPropagation()
                      fire(type, { siteIds: [s.id], label: s.siteName })
                    }}
                  >
                    {/* รอคิวใช้นาฬิกา ไม่ใช่ spinner ที่ค้างนิ่ง — spinner ไม่หมุน
                        อ่านเหมือนระบบแฮงก์ ทั้งที่จริงแค่ยังไม่ถึงคิว */}
                    {mine ? (
                      running ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Clock size={15} className="opacity-60" />
                      )
                    ) : (
                      <Icon size={15} />
                    )}
                    {/* ติดเลขคิวไปกับป้ายเลย — "รอคิว" เฉย ๆ ดูไม่ออกว่าขยับอยู่ไหม
                        เห็น #13 ค่อย ๆ ลดลงทุกรอบ อ่านได้ว่าระบบยังเดินอยู่ */}
                    <span className="hidden 2xl:inline">
                      {mine ? (running ? 'กำลังทำ' : ahead ? `รอคิว #${ahead + 1}` : 'รอคิว') : label}
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
        {/* ใบรวมทำหน้าที่ "กลับไปดูทั้งหมด" ตอนกรองอยู่ — ตำแหน่งซ้ายสุดของแถว
            เป็นที่ที่คนจะกดกลับอยู่แล้ว ไม่ต้องสอนว่าปุ่มล้างอยู่ตรงไหน */}
        <StatCard
          label="เว็บที่ดูแลอยู่"
          value={stats.total}
          hint={
            quick
              ? 'กดเพื่อกลับไปดูทุกเว็บ'
              : queueBusy
                ? `กำลังเดินคิว ${queue.queued + queue.running} งาน · หน้านี้อัปเดตเองทุก 5 วิ`
                : 'คิวว่าง'
          }
          onClick={quick ? () => setQuick('') : undefined}
        />
        {/* กดการ์ด = กรองตารางเหลือเฉพาะเว็บที่นับอยู่ในตัวเลขนั้น แล้วปุ่มสั่งงาน
            ก็ทำกับชุดนั้นต่อได้เลย — "เห็นตัวเลขแล้วต้องไปหาเองใน 49 แถว" คือทางตัน */}
        <StatCard
          label="ค้างอัปเดตปลั๊กอิน"
          value={stats.pending}
          unit="เว็บ"
          tone={stats.pending ? 'warning' : 'success'}
          hint={stats.pluginCount ? `รวม ${stats.pluginCount} ตัว` : 'ไม่มีค้าง'}
          onClick={stats.pending ? () => toggleQuick('pending') : undefined}
          selected={quick === 'pending'}
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
          onClick={stats.suspect ? () => toggleQuick('urgent') : undefined}
          selected={quick === 'urgent'}
        />
        {/* ไม่เคยสำรอง = ความเสี่ยงระดับธุรกิจ ต้องเห็นเป็นตัวเลขเดียว
            ไม่ใช่ป้ายแดงซ้ำ 49 แถวจนชินตาแล้วเลิกมอง */}
        <StatCard
          label="ไม่มีไฟล์สำรอง"
          value={stats.noBackup}
          unit="เว็บ"
          tone={stats.noBackup ? 'danger' : 'success'}
          hint={stats.staleBackup ? `เก่าเกิน 30 วันอีก ${stats.staleBackup} เว็บ` : 'สำรองครบทุกเว็บ'}
          onClick={stats.noBackup ? () => toggleQuick('nobackup') : undefined}
          selected={quick === 'nobackup'}
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

        {/* "ตอนนี้ทำอะไรอยู่" ต้องเห็นด้วยตา ไม่ใช่ซ่อนใน tooltip ของปุ่ม —
            ป้าย "รอคิว" ที่ไม่บอกว่ารออะไร อ่านแล้วเหมือนระบบค้าง (เจ้าของทัก 15 ส.ค. 69) */}
        {queueBusy && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5">
            {runningNow.length > 0 ? (
              <>
                <p className="flex items-center gap-2 text-lg font-semibold text-blue-900">
                  <Loader2 size={18} className="animate-spin" />
                  ตอนนี้กำลังทำ {runningNow.length} งาน (โฮสต์ละงานเดียว)
                </p>
                <ul className="mt-1.5 space-y-1 text-base text-blue-800">
                  {runningNow.map((a) => (
                    <li key={a.id}>
                      {jobLabel(a)}
                      {a.progressTotal > 0 && (
                        <span className="text-blue-700/70">
                          {' '}
                          ({a.progressDone}/{a.progressTotal}
                          {a.progressNote ? ` · ${a.progressNote}` : ''})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              // ช่วงระหว่างรอบ cron — ไม่มีอะไรเดินอยู่จริง ต้องบอกตรง ๆ
              // ไม่งั้น spinner หมุนทั้งที่ไม่มีงานทำ อ่านแล้วเข้าใจผิดหนักกว่าเดิม
              <p className="flex items-center gap-2 text-lg font-semibold text-blue-900">
                <Clock size={18} />
                ยังไม่มีงานที่กำลังทำ — รอระบบหยิบคิวรอบถัดไป (ทุก 1–2 นาที)
              </p>
            )}
            {queue.queued > 0 && (
              <p className="mt-2 text-base text-blue-700/90">
                รอคิวอีก {queue.queued} งาน — {queuedByType.map(([t, n]) => `${TYPE_LABEL[t]} ${n}`).join(' · ')}{' '}
                · โฮสต์หนึ่งทำทีละงาน กด &quot;เร่งคิวเดี๋ยวนี้&quot; ข้างบนได้ถ้าไม่อยากรอรอบ cron
              </p>
            )}

            {/* คิวเต็มไปอยู่ใน modal — ตัวหนังสือต้องใหญ่พอที่จะอ่านออก (เจ้าของบอก
                16 ส.ค. 69 ว่า 12px เล็กไป 14px ก็ยังไม่เห็น) กางในการ์ดแล้วดันของ
                ที่อยู่ข้างล่างหายไปทั้งจอ · ~98 ใบต้องเลื่อนดู modal เหมาะกว่า */}
            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              className="mt-2.5 flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-base font-semibold text-blue-800 hover:bg-blue-50"
            >
              <ListChecks size={18} />
              ดูคิวทั้งหมด {queue.queued + queue.running} งาน
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <span className="text-sm text-gray-500">
            สั่งงานกับ <strong className="text-gray-800">{scopeLabel}</strong> ({viewSites.length} เว็บ)
          </span>
          {/* ปุ่มรวมกดได้เสมอ แม้จะมีงานชนิดเดียวกันเดินอยู่ — มันจะไปทำ "เว็บที่เหลือ"
              ซึ่งเป็นสิ่งที่ควรทำจริง ๆ · ฝั่งเซิร์ฟเวอร์กรองเว็บที่มีงานค้าง /
              เพิ่งทำไป / UTD ออกให้อยู่แล้ว กดซ้ำจึงไม่ทำให้งานซ้ำ
              spinner เป็นแค่ป้ายบอกสถานะ ไม่ใช่การล็อกปุ่ม (เจ้าของทัก 15 ส.ค. 69)
              ทุกปุ่มถามยืนยันก่อน เพราะกดทีเดียวโดน 49 เว็บ และปุ่มแรกอยู่ติดปุ่ม
              อัปเดตที่แก้ของจริง — กล่องยืนยันบอกจำนวนเว็บที่จะโดนจริงก่อนตัดสินใจ */}
          <span className="flex flex-wrap gap-2">
            {FLEET_ACTIONS.map(({ type, Icon, label }, i) => {
              const mine = activeTypes.has(type)
              const { willRun } = fleetCounts.get(type)!
              // ปิดปุ่มเฉพาะตอนไม่เหลือเว็บให้ทำจริง ๆ · ไม่ปิดตอนกรองจนไม่เหลือเว็บ
              // เพราะเหตุผลคนละอย่าง ปล่อยให้ toast เดิมบอกว่า "ล้างตัวกรองก่อน"
              const done = viewSites.length > 0 && willRun === 0
              return (
                <Button
                  key={type}
                  variant={i === 0 ? 'primary' : 'secondary'}
                  onClick={() => fireFleet(type, label)}
                  disabled={!!busy || done}
                >
                  {mine ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                  {done
                    ? `${label} — เข้าคิวครบแล้ว`
                    : mine
                      ? `${label} — เว็บที่เหลือ ${willRun}`
                      : label}
                </Button>
              )
            })}
          </span>
          {/* แยกจากปุ่มสั่งงาน — อันนี้ไม่เข้าคิว ไม่แตะโฮสต์ แค่รวมลิงก์ให้ */}
          <Button variant="ghost" onClick={downloadList}>
            <Download size={15} />
            ดาวน์โหลดไฟล์สำรอง ({viewSites.filter((s) => s.lastBackupFile).length})
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          ปุ่มทำกับ &quot;เว็บที่เห็นอยู่ในตาราง&quot; เท่านั้น (แท็บแพลน + การ์ดที่กดกรองไว้) ·{' '}
          <strong>ตรวจปลั๊กอิน</strong> ระบบทำให้เองทุกคืนอยู่แล้ว
          กดเองเมื่ออยากได้ตัวเลขสดเดี๋ยวนี้ ส่วน <strong>อัปเดตปลั๊กอิน</strong> แก้ของจริง
          และทำเฉพาะเว็บที่ยังค้าง (เว็บที่ขึ้น UTD ถูกข้ามอัตโนมัติ) ลองแท็บแพลนเล็ก ๆ ก่อน ·
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

            {/* กรองอยู่ = ต้องเห็นชัดว่าทำไมตารางเหลือไม่กี่แถว พร้อมทางออกในที่เดียวกัน
                (กรอบสีบนการ์ดอยู่คนละที่กับตาราง เลื่อนลงมาแล้วลืมว่ากรองไว้) */}
            {quick && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>
                  กรองอยู่: <strong>{QUICK[quick].label}</strong> — เห็น {viewSites.length} จาก{' '}
                  {tabSites.length} เว็บ{tab === 'all' ? 'ทั้งฟลีต' : `ในแพลน ${tab}`}
                </span>
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 font-medium underline decoration-dotted underline-offset-2 hover:bg-amber-100"
                  onClick={() => setQuick('')}
                >
                  ล้างตัวกรอง
                </button>
              </div>
            )}

            <DataTable
              columns={siteColumns}
              rows={viewSites}
              rowKey={(s) => s.id}
              onRowClick={(s) => router.push(`/websites/${s.id}`)}
              emptyTitle={quick ? `ไม่มีเว็บที่${QUICK[quick].label}ในแท็บนี้` : 'ไม่มีเว็บในแท็บนี้'}
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

      {/* คิวเต็ม — แยกตามโฮสต์เพราะแต่ละโฮสต์เดินคิวของตัวเองขนานกัน (ทีละงานต่อโฮสต์)
          กองรวมเป็นลิสต์เดียวจะอ่านเหมือนทุกใบต้องรอต่อคิวกันหมด ซึ่งไม่จริง */}
      {queueOpen && (
        <Modal
          open
          onClose={() => setQueueOpen(false)}
          maxWidth={720}
          title={`คิวงาน ${queue.queued + queue.running} ใบ`}
          description={
            slotSecs === null
              ? 'ยังประมาณเวลาไม่ได้ — ต้องมีประวัติงานที่เดินติดกันก่อน'
              : `คิวเดินจริงประมาณ ${Math.round(slotSecs)} วินาทีต่อ 1 งาน ต่อโฮสต์ — ความเร็วมาจากรอบ cron ไม่ใช่ความเร็วของงาน กด "เร่งคิวเดี๋ยวนี้" แล้วจะเร็วกว่านี้`
          }
        >
          <div className="max-h-[65vh] space-y-6 overflow-y-auto">
            {queueByHost.map((h) => (
              <section key={h.hostId}>
                <h3 className="sticky top-0 bg-white pb-1.5 text-lg font-semibold text-gray-900">
                  {h.hostName}
                  <span className="ml-2 text-base font-normal text-gray-500">
                    {h.rows.length} งาน
                    {h.totalSecs !== null && ` · น่าจะหมดใน ${fmtWait(h.totalSecs)}`}
                  </span>
                </h3>
                <ol className="divide-y divide-gray-100">
                  {h.rows.map((r, i) => (
                    <li
                      key={r.job.id}
                      className={`flex items-baseline gap-3 py-2 text-base ${
                        r.job.status === 'running'
                          ? 'font-semibold text-blue-900'
                          : 'text-gray-700'
                      }`}
                    >
                      <span className="w-7 shrink-0 text-right tabular-nums text-gray-400">
                        {r.job.status === 'running' ? '▶' : i}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{jobLabel(r.job)}</span>
                      <span className="shrink-0 tabular-nums text-gray-500">
                        {r.job.status === 'running'
                          ? r.job.progressTotal > 0
                            ? `${r.job.progressDone}/${r.job.progressTotal}`
                            : 'กำลังทำ'
                          : r.waitSecs !== null
                            ? fmtWait(r.waitSecs)
                            : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </Modal>
      )}

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`${TYPE_LABEL[detail.type]} — ${detail.siteName || detail.hostName || ''}`}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm text-gray-600">{summaryText(detail)}</p>
              {/* งานสแกนที่เจอของ = ก้อนหลักฐานพร้อมวางให้ AI อ่านแล้วบอกได้เลย
                  ว่าอันไหนของจริง อันไหนหลอก โดยไม่ต้องเปิดเซิร์ฟเวอร์ดูเอง */}
              {detail.type === 'scan' && (detail.summary?.findings as unknown[])?.length ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(aiReport(detail))
                      showToast('คัดลอกแล้ว — เอาไปวางให้ AI อ่านได้เลย', 'success')
                    } catch {
                      showToast('คัดลอกไม่ได้ ให้เลือกข้อความใน log เอาแทน', 'error')
                    }
                  }}
                >
                  <ClipboardCopy size={14} />
                  คัดลอกให้ AI
                </Button>
              ) : null}
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
              {detail.rawLog || '(ไม่มี log)'}
            </pre>
          </div>
        </Modal>
      )}

      {confirmDialog}
    </div>
  )
}
