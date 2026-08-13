'use client'

// Performance การมาทำงาน — โจทย์เจ้าของ (13 ส.ค. 69):
// ใครมาทำงานวันไหน ที่ไหน · เข้าออฟฟิศกี่วันจากที่ควรมา (ช่วงไม่เต็มเดือนก็ดูได้)
// · นอกสถานที่กี่วัน ที่ไหนบ้าง · ความถี่ในการเช็คอิน — ไล่ดู performance รายคน
//
// โครง: ตารางสรุปรายคน (แถบสัดส่วนต่อคน เรียงตาม % มา) → กดชื่อเจาะรายคน:
// การ์ดตัวเลข + กราฟแท่งรายสัปดาห์ (ความถี่) + รายการจุดเช็คอินนอกสถานที่ (เปิดแผนที่ได้)
//
// สีตามชุดที่ผ่าน validator ของ dataviz (ตรงกับตารางวัน):
//   เข้าสาขา green-500 → WFH teal-600 → นอกสถานที่ purple-500 → ลา sky-500 → ขาด red-500
// contrast ต่ำกว่า 3:1 บางสี — ชดเชยด้วยตัวเลขในตาราง + ป้ายบนกราฟตามข้อบังคับ validator

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, endOfMonth, startOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { Building2, Clock, ExternalLink, MapPin, TrendingUp, Route } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import { getAttendanceReportForExport } from '@/lib/services/reportService'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  DataTable,
  FilterCard,
  FilterField,
  PageHeader,
  Skeleton,
  StatCard,
  StatGrid,
  TechLoader,
  type Column,
} from '@/components/shared'

/* ── ประเภทวัน + สีชุดที่ validate แล้ว (เรียงตามลำดับใน stack) ───────── */
const DAY_TYPES = [
  { key: 'office', label: 'เข้าสาขา', cls: 'bg-green-500' },
  { key: 'wfh', label: 'ทำงานที่บ้าน', cls: 'bg-teal-600' },
  { key: 'offsite', label: 'นอกสถานที่', cls: 'bg-purple-500' },
  { key: 'leave', label: 'ลา', cls: 'bg-sky-500' },
  { key: 'absent', label: 'ขาด', cls: 'bg-red-500' },
] as const
type DayTypeKey = (typeof DAY_TYPES)[number]['key']

type PersonStat = {
  userId: string
  name: string
  office: number
  wfh: number
  offsite: number
  leave: number
  absent: number
  late: number
  holidayWorked: number
  /** วันที่ควรมา = มา + ลา + ขาด */
  scheduled: number
  present: number
  /** สัปดาห์ (วันจันทร์ของสัปดาห์) → จำนวนวันต่อประเภท — กราฟความถี่ */
  weeks: Map<string, Record<DayTypeKey, number>>
}

type OffsitePoint = { date: string; time: string; note: string; lat: number; lng: number }

/** วันจันทร์ของสัปดาห์ที่วันนั้นอยู่ — ที่เก็บ bucket ของกราฟรายสัปดาห์ */
const weekStart = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return format(d, 'yyyy-MM-dd')
}

export default function AttendancePerformancePage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [range, setRange] = useState(() => ({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  }))
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState<PersonStat[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PersonStat | null>(null)
  const [offsitePoints, setOffsitePoints] = useState<OffsitePoint[] | null>(null)

  useEffect(() => {
    if (userData && !['hr', 'admin', 'manager'].includes(userData.role)) {
      router.push('/unauthorized')
    }
  }, [userData, router])

  /* ── รวมยอดรายคนจากรายงานเข้างาน (กติกาเดียวกับตารางวันของ HR) ───── */
  useEffect(() => {
    let alive = true
    setLoading(true)
    setSelected(null)
    ;(async () => {
      try {
        const report = await getAttendanceReportForExport({
          startDate: new Date(`${range.start}T00:00:00`),
          endDate: new Date(`${range.end}T00:00:00`),
          showOnlyPresent: false,
        })
        if (!alive) return

        const byUser = new Map<string, PersonStat>()
        for (const r of report.data) {
          let p = byUser.get(r.userId)
          if (!p) {
            p = {
              userId: r.userId,
              name: r.userName,
              office: 0, wfh: 0, offsite: 0, leave: 0, absent: 0,
              late: 0, holidayWorked: 0, scheduled: 0, present: 0,
              weeks: new Map(),
            }
            byUser.set(r.userId, p)
          }

          const wk = weekStart(r.date)
          const bump = (k: DayTypeKey) => {
            const w = p!.weeks.get(wk) ?? { office: 0, wfh: 0, offsite: 0, leave: 0, absent: 0 }
            w[k]++
            p!.weeks.set(wk, w)
          }

          const present = r.status === 'normal' || r.status === 'late'
          const holidayWorked = r.status === 'holiday' && r.totalHours > 0
          if (present || holidayWorked) {
            const type: DayTypeKey =
              r.checkinType === 'offsite' ? 'offsite' : r.checkinType === 'wfh' ? 'wfh' : 'office'
            p[type]++
            p.present++
            if (r.isLate) p.late++
            if (holidayWorked) p.holidayWorked++
            else p.scheduled++
            bump(type)
          } else if (r.status === 'holiday' && (r.note || '').includes('ลา')) {
            p.leave++
            p.scheduled++
            bump('leave')
          } else if (r.status === 'absent') {
            p.absent++
            p.scheduled++
            bump('absent')
          }
        }

        // เรียงคนมาน้อย (% ต่ำ) ขึ้นก่อน — performance ที่ต้องดูก่อนคือคนมีปัญหา
        const list = [...byUser.values()].sort(
          (a, b) =>
            (a.scheduled ? a.present / a.scheduled : 1) -
            (b.scheduled ? b.present / b.scheduled : 1)
        )
        setStats(list)
        setLoading(false)
      } catch (e) {
        showToast((e as Error).message, 'error')
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  /* ── เจาะรายคน: จุดนอกสถานที่จากเช็คอินจริง (พิกัด + ใกล้สาขาไหน) ── */
  useEffect(() => {
    if (!selected) return
    let alive = true
    setOffsitePoints(null)
    createClient()
      .from('checkins')
      .select('work_date, checkin_time, checkin_lat, checkin_lng, note')
      .eq('user_id', selected.userId)
      .eq('checkin_type', 'offsite')
      .gte('work_date', range.start)
      .lte('work_date', range.end)
      .order('work_date')
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          showToast(`ดึงจุดนอกสถานที่ไม่สำเร็จ: ${error.message}`, 'error')
          return
        }
        setOffsitePoints(
          (data ?? []).map((c) => ({
            date: c.work_date,
            time: c.checkin_time ? format(new Date(c.checkin_time), 'HH:mm') : '',
            note: (c.note ?? '').replace('เช็คอินนอกสถานที่', '').replace(/^[\s·]+/, ''),
            lat: c.checkin_lat,
            lng: c.checkin_lng,
          }))
        )
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  if (!stats) return <TechLoader />

  const visible = stats.filter(
    (p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  const pct = (p: PersonStat) => (p.scheduled ? Math.round((p.present / p.scheduled) * 100) : 0)

  /* ── แถบสัดส่วนต่อคน — segment เรียงตามชุดสี มีช่องว่างขาว 2px คั่น ── */
  const StackBar = ({ p }: { p: PersonStat }) => {
    const total = p.scheduled || 1
    return (
      <div className="flex h-3.5 w-44 overflow-hidden rounded-sm bg-gray-100">
        {DAY_TYPES.map((t) => {
          const n = p[t.key]
          if (!n) return null
          return (
            <div
              key={t.key}
              title={`${t.label} ${n} วัน`}
              className={`${t.cls} mr-0.5 last:mr-0`}
              style={{ width: `${(n / total) * 100}%` }}
            />
          )
        })}
      </div>
    )
  }

  const columns: Column<PersonStat>[] = [
    {
      key: 'name',
      header: 'พนักงาน',
      mobilePrimary: true,
      sortValue: (p) => p.name,
      cell: (p) => <span className="font-medium text-gray-900">{p.name}</span>,
    },
    {
      key: 'ratio',
      header: 'มา/ควรมา',
      align: 'center',
      sortValue: (p) => pct(p),
      cell: (p) => (
        <span className="whitespace-nowrap font-mono tabular-nums">
          <b className={pct(p) < 80 ? 'text-red-600' : 'text-green-700'}>{p.present}</b>
          <span className="text-gray-400">/{p.scheduled}</span>
          <span className="ml-1 text-xs text-gray-400">({pct(p)}%)</span>
        </span>
      ),
    },
    {
      key: 'bar',
      header: 'สัดส่วน',
      hideOnMobile: true,
      cell: (p) => <StackBar p={p} />,
    },
    { key: 'office', header: 'เข้าสาขา', align: 'center', sortValue: (p) => p.office, cell: (p) => num(p.office) },
    { key: 'offsite', header: 'นอกสถานที่', align: 'center', sortValue: (p) => p.offsite, cell: (p) => num(p.offsite, 'text-purple-700') },
    { key: 'wfh', header: 'WFH', align: 'center', hideOnMobile: true, sortValue: (p) => p.wfh, cell: (p) => num(p.wfh, 'text-teal-700') },
    { key: 'late', header: 'สาย (ครั้ง)', align: 'center', sortValue: (p) => p.late, cell: (p) => num(p.late, 'text-amber-600') },
    { key: 'leave', header: 'ลา', align: 'center', hideOnMobile: true, sortValue: (p) => p.leave, cell: (p) => num(p.leave, 'text-sky-700') },
    { key: 'absent', header: 'ขาด', align: 'center', sortValue: (p) => p.absent, cell: (p) => num(p.absent, 'text-red-600') },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance การมาทำงาน"
        description="ใครมาแค่ไหน เช็คอินที่ไหน — เรียงคนที่ต้องดูก่อนขึ้นบนสุด · กดชื่อเพื่อเจาะรายคน"
        icon={TrendingUp}
      />

      <FilterCard
        actions={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {DAY_TYPES.map((t) => (
              <span key={t.key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`h-2.5 w-2.5 rounded-sm ${t.cls}`} /> {t.label}
              </span>
            ))}
          </div>
        }
      >
        <FilterField label="ช่วงเวลา" width={280}>
          <DateRangePicker
            startDate={range.start}
            endDate={range.end}
            onChange={(s, e) => setRange({ start: s, end: e })}
            className="w-full"
          />
        </FilterField>
        <FilterField label="พนักงาน" width={200}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ..."
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-red-400"
          />
        </FilterField>
      </FilterCard>

      {loading ? (
        <Skeleton rows={10} />
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(p) => p.userId}
          onRowClick={(p) => setSelected(selected?.userId === p.userId ? null : p)}
          rowClassName={(p) => (selected?.userId === p.userId ? 'bg-red-50/60' : undefined)}
          emptyTitle="ไม่พบข้อมูลในช่วงที่เลือก"
        />
      )}

      {/* ── เจาะรายคน ─────────────────────────────────────────────── */}
      {selected && !loading && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <p className="font-semibold text-gray-900">{selected.name}</p>

          <StatGrid>
            <StatCard
              label="มาทำงาน / ควรมา"
              value={`${selected.present}/${selected.scheduled} วัน`}
              icon={TrendingUp}
              tone={pct(selected) < 80 ? 'danger' : 'success'}
            />
            <StatCard label="เข้าสาขา" value={`${selected.office} วัน`} icon={Building2} />
            <StatCard
              label="นอกสถานที่"
              value={`${selected.offsite} วัน`}
              icon={Route}
              tone="info"
            />
            <StatCard
              label="มาสาย"
              value={`${selected.late} ครั้ง`}
              icon={Clock}
              tone={selected.late > 0 ? 'warning' : 'default'}
            />
          </StatGrid>
          {selected.holidayWorked > 0 && (
            <p className="text-xs text-gray-500">
              + มาทำงานวันหยุดอีก {selected.holidayWorked} วัน (ไม่นับในวันที่ควรมา)
            </p>
          )}

          {/* ความถี่รายสัปดาห์ — คอลัมน์ต่อสัปดาห์ สูงตามจำนวนวัน แยกสีตามประเภท */}
          <WeeklyChart weeks={selected.weeks} />

          {/* นอกสถานที่ไปไหนบ้าง */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              จุดเช็คอินนอกสถานที่ ({selected.offsite} วัน)
            </p>
            {offsitePoints === null ? (
              <Skeleton bare rows={2} />
            ) : offsitePoints.length === 0 ? (
              <p className="text-sm text-gray-400">ช่วงนี้ไม่มีเช็คอินนอกสถานที่</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-100">
                {offsitePoints.map((o, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-50 px-3 py-2 text-sm last:border-0"
                  >
                    <span className="w-24 whitespace-nowrap text-gray-700">
                      {format(new Date(`${o.date}T00:00:00`), 'EEE d MMM', { locale: th })}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-gray-500">{o.time}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-600">
                      {o.note || 'นอกสถานที่'}
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${o.lat},${o.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                    >
                      <MapPin size={12} /> เปิดแผนที่ <ExternalLink size={10} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const num = (n: number, cls = 'text-gray-700') => (
  <span className={`font-mono tabular-nums ${n ? cls : 'text-gray-300'}`}>{n || '—'}</span>
)

/* ── กราฟความถี่รายสัปดาห์ — แท่งซ้อนประเภทวัน สูงตามจำนวนวัน ─────────
   ป้ายเลขรวมบนหัวแท่ง (ข้อบังคับ contrast จาก validator) · hover บอกละเอียด */
function WeeklyChart({
  weeks,
}: {
  weeks: Map<string, Record<DayTypeKey, number>>
}) {
  const keys = [...weeks.keys()].sort()
  if (keys.length === 0) return null
  const max = Math.max(...keys.map((k) => Object.values(weeks.get(k)!).reduce((s, n) => s + n, 0)))
  const H = 96 // สูงสุดของแท่ง (px)

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">ความถี่การเช็คอินรายสัปดาห์</p>
      <div className="flex items-end gap-3 overflow-x-auto pb-1">
        {keys.map((k) => {
          const w = weeks.get(k)!
          const total = Object.values(w).reduce((s, n) => s + n, 0)
          return (
            <div key={k} className="flex shrink-0 flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-700">{total || ''}</span>
              <div
                className="flex w-9 flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: (Math.max(total, 0) / max) * H || 2 }}
                title={DAY_TYPES.filter((t) => w[t.key])
                  .map((t) => `${t.label} ${w[t.key]}`)
                  .join(' · ')}
              >
                {DAY_TYPES.map((t) =>
                  w[t.key] ? (
                    <div
                      key={t.key}
                      className={`${t.cls} mt-0.5 first:mt-0`}
                      style={{ flexGrow: w[t.key] }}
                    />
                  ) : null
                )}
              </div>
              <span className="whitespace-nowrap text-[10px] text-gray-400">
                {format(new Date(`${k}T00:00:00`), 'd MMM', { locale: th })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
