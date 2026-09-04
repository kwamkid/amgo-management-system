'use client'

// AOO Website — รายการเว็บไซต์ที่ดูแลอยู่ (ย้ายจากระบบเดี่ยว aoo-student-website)
//
// เมนูส่วนตัวของเจ้าของ: RLS ปล่อยเฉพาะคนใน web_owners — แอดมินคนอื่นเปิดไม่ได้
// ตารางรวม 3 เรื่องที่ต้องดูทุกวันไว้แถวเดียว: ใกล้หมดอายุ · เว็บล่ม · บิลค้าง

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ExternalLink, Globe, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/aoo'
import {
  DataTable,
  FilterBar,
  FilterSelect,
  PageHeader,
  StatCard,
  StatGrid,
  TechLoader,
  type Column,
} from '@/components/shared'
import { daysLeft, getCourses, getSites, nearestExpiry, type WebCourse, type WebSite } from '@/lib/services/web/webService'

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

/** สีของวันหมดอายุ — แดง=เลยแล้ว/ใกล้มาก ส้ม=ภายในเดือน เทา=ยังอีกนาน */
const expiryTone = (days: number) =>
  days < 0 ? 'text-red-600' : days <= 7 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-gray-600'

export default function WebsitesPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [sites, setSites] = useState<WebSite[] | null>(null)
  const [courses, setCourses] = useState<WebCourse[]>([])
  const [q, setQ] = useState('')
  const [courseId, setCourseId] = useState('all')
  const [view, setView] = useState('active')
  const [checking, setChecking] = useState(false)

  const canSee = !!userData && !!userData.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () => {
    getSites()
      .then(setSites)
      .catch((e) => showToast(e.message, 'error'))
    getCourses()
      .then(setCourses)
      .catch(() => {})
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  // กดเช็คเดี๋ยวนี้ — ปกติ cron ยิงเองรายชั่วโมง ปุ่มนี้ไว้เช็คทันทีหลังแก้อะไร
  const checkNow = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/web/uptime', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'เช็คไม่สำเร็จ')
      showToast(`เช็คแล้ว ${json.checked} เว็บ · ล่ม ${json.down}`, json.down ? 'error' : 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setChecking(false)
    }
  }

  const rows = useMemo(() => {
    let list = sites ?? []
    if (view === 'active') list = list.filter((s) => s.isActive)
    if (view === 'inactive') list = list.filter((s) => !s.isActive)
    if (view === 'expiring')
      list = list.filter((s) => {
        const n = nearestExpiry(s)
        return n && n.days <= 30
      })
    if (view === 'down') list = list.filter((s) => !!s.downSince)
    if (view === 'unpaid') list = list.filter((s) => (s.unpaidCount ?? 0) > 0)
    if (courseId !== 'all') list = list.filter((s) => s.courseId === courseId)
    const key = q.trim().toLowerCase()
    if (key)
      list = list.filter(
        (s) =>
          s.siteName.toLowerCase().includes(key) ||
          s.studentName.toLowerCase().includes(key) ||
          s.hostingProvider.toLowerCase().includes(key)
      )
    return list
  }, [sites, q, courseId, view])

  const stats = useMemo(() => {
    const list = (sites ?? []).filter((s) => s.isActive)
    return {
      total: list.length,
      expiring: list.filter((s) => {
        const n = nearestExpiry(s)
        return n && n.days <= 30
      }).length,
      down: list.filter((s) => !!s.downSince).length,
      unpaid: list.filter((s) => (s.unpaidCount ?? 0) > 0).length,
    }
  }, [sites])

  const columns: Column<WebSite>[] = [
    {
      key: 'site',
      header: 'เว็บไซต์',
      sticky: true,
      mobilePrimary: true,
      sortValue: (s) => s.siteName,
      cell: (s) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{s.siteName}</span>
          {s.downSince && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
              <AlertTriangle size={11} /> ล่ม
            </span>
          )}
          {!s.isActive && (
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">ปิดแล้ว</span>
          )}
        </div>
      ),
    },
    {
      key: 'student',
      header: 'เจ้าของเว็บ',
      sortValue: (s) => s.studentName,
      cell: (s) => <span className="text-gray-700">{s.studentName || '—'}</span>,
    },
    {
      key: 'hosting',
      header: 'โฮสต์',
      hideOnMobile: true,
      cell: (s) => <span className="text-gray-600">{s.hostingProvider || '—'}</span>,
    },
    {
      key: 'expiry',
      header: 'ใกล้หมดอายุ',
      sortValue: (s) => nearestExpiry(s)?.days ?? 99999,
      cell: (s) => {
        const n = nearestExpiry(s)
        if (!n) return <span className="text-gray-400">ยังไม่ได้กรอก</span>
        return (
          <span className={expiryTone(n.days)}>
            {n.label} {fmtDate(n.date)}
            <span className="ml-1 text-xs opacity-80">
              ({n.days < 0 ? `เลย ${-n.days} วัน` : `อีก ${n.days} วัน`})
            </span>
          </span>
        )
      },
    },
    {
      key: 'bill',
      header: 'บิล',
      align: 'center',
      sortValue: (s) => s.unpaidCount ?? 0,
      cell: (s) =>
        (s.unpaidCount ?? 0) > 0 ? (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            ค้าง {s.unpaidCount}
          </span>
        ) : (
          <span className="text-xs text-gray-400">ครบ</span>
        ),
    },
    {
      key: 'checked',
      header: 'เช็คล่าสุด',
      hideOnMobile: true,
      cell: (s) =>
        s.lastCheckedAt ? (
          <span className="text-xs text-gray-500">
            {s.httpStatus ?? '—'} · {s.responseMs ?? '—'} ms
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (s) => (
        <a
          href={`https://${s.siteName}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label={`เปิด ${s.siteName}`}
        >
          <ExternalLink size={15} />
        </a>
      ),
    },
  ]

  if (!canSee || !sites) return <TechLoader />

  return (
    <div>
      <PageHeader
        title="AOO Website"
        description="เว็บไซต์ลูกค้าที่ดูแลอยู่ — วันหมดอายุ ค่าบริการ และสถานะเว็บ"
        icon={Globe}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={checkNow} disabled={checking}>
              <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
              เช็คเว็บเดี๋ยวนี้
            </Button>
            <Button onClick={() => router.push('/websites/new')}>
              <Plus size={15} />
              เพิ่มเว็บ
            </Button>
          </div>
        }
      />

      <StatGrid>
        <StatCard label="เว็บที่ดูแลอยู่" value={stats.total} icon={Globe} />
        <StatCard label="ใกล้หมดอายุ (30 วัน)" value={stats.expiring} tone={stats.expiring ? 'warning' : 'default'} />
        <StatCard label="เว็บล่มตอนนี้" value={stats.down} tone={stats.down ? 'danger' : 'default'} />
        <StatCard label="มีบิลค้าง" value={stats.unpaid} tone={stats.unpaid ? 'warning' : 'default'} />
      </StatGrid>

      <FilterBar search={q} onSearch={setQ} placeholder="ค้นหาโดเมน / เจ้าของ / โฮสต์">
        <FilterSelect
          label="มุมมอง"
          value={view}
          onChange={(v) => setView(v ?? 'all')}
          options={[
            { value: 'active', label: 'ที่ดูแลอยู่' },
            { value: 'expiring', label: 'ใกล้หมดอายุ' },
            { value: 'down', label: 'เว็บล่ม' },
            { value: 'unpaid', label: 'มีบิลค้าง' },
            { value: 'inactive', label: 'ปิดแล้ว' },
            { value: 'all', label: 'ทั้งหมด' },
          ]}
        />
        <FilterSelect
          label="รุ่น"
          value={courseId}
          onChange={(v) => setCourseId(v ?? 'all')}
          options={[
            { value: 'all', label: 'ทุกรุ่น' },
            ...courses.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={(s) => router.push(`/websites/${s.id}`)}
        emptyTitle="ยังไม่มีเว็บในเงื่อนไขนี้"
      />
    </div>
  )
}
