'use client'

// Performance การส่งของ — โจทย์เจ้าของ: ส่งที่ไหน ขับไปไหนบ้าง ระยะทางกี่ กม.
// ภายในเวลาเท่าไหร่ ทำงานดีมั้ย
//
// โครง: ตารางสรุปรายคนขับ (วันวิ่ง/จุด/กม./นาทีต่อจุด/เวลาเริ่ม) → กดชื่อเจาะรายวัน:
// การ์ดตัวเลข + กราฟจุดต่อวัน + ตารางรายวัน แต่ละวันกดไปดูเส้นทางจริงบนแผนที่ได้
//
// ระยะทางทั้งหน้าเป็น "เส้นตรงระหว่างจุดตามลำดับ" — ต่ำกว่าระยะขับจริงเสมอ (บอกไว้บนหน้า)

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { Clock, ExternalLink, Gauge, MapPin, Route, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  getDeliveryPerformance,
  type DriverPerf,
} from '@/lib/services/delivery/points'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { HelpTooltip } from '@/components/aoo'
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

/* ── สรุปช่วงที่เลือกของคนขับหนึ่งคน ─────────────────────────────────── */
interface DriverSummary {
  driverId: string
  name: string
  runDays: number
  totalPoints: number
  pointsPerDay: number
  totalKm: number
  kmPerDay: number
  /** นาทีเฉลี่ยต่อ 1 ช่วงระหว่างจุด (รวมทุกวัน) — วันจุดเดียวไม่มีช่วง ไม่ถูกนับ */
  minutesPerGap: number | null
  /** เวลาเช็คอินจุดแรกเฉลี่ย HH:MM */
  avgFirstAt: string
  days: DriverPerf['days']
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const toHHMM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`

const summarize = (d: DriverPerf): DriverSummary => {
  const totalPoints = d.days.reduce((s, x) => s + x.points, 0)
  const totalKm = d.days.reduce((s, x) => s + x.distanceKm, 0)
  const gapDays = d.days.filter((x) => x.points > 1)
  const gapCount = gapDays.reduce((s, x) => s + (x.points - 1), 0)
  const gapMinutes = gapDays.reduce((s, x) => s + x.spanMinutes, 0)
  return {
    driverId: d.driverId,
    name: d.name,
    runDays: d.days.length,
    totalPoints,
    pointsPerDay: Math.round((totalPoints / d.days.length) * 10) / 10,
    totalKm: Math.round(totalKm * 10) / 10,
    kmPerDay: Math.round((totalKm / d.days.length) * 10) / 10,
    minutesPerGap: gapCount ? Math.round(gapMinutes / gapCount) : null,
    avgFirstAt: toHHMM(d.days.reduce((s, x) => s + toMinutes(x.firstAt), 0) / d.days.length),
    days: d.days,
  }
}

/* ── หัวคอลัมน์/ป้ายที่มีคำอธิบาย — HelpTooltip กลางตัวเดียวกับหน้ารายงาน ── */
const Tip = ({ text, tip }: { text: string; tip: string }) => (
  <HelpTooltip variant="tooltip" delay={100} content={tip}>
    <span>{text}</span>
  </HelpTooltip>
)

const hoursLabel = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} ชม. ${m ? `${m} น.` : ''}`.trim() : `${m} น.`
}

/* ── กราฟจุดต่อวันของคนที่เลือก — คอลัมน์ CSS แบบเดียวกับหน้า Performance เข้างาน ── */
function DayChart({ days }: { days: DriverPerf['days'] }) {
  const max = Math.max(...days.map((d) => d.points), 1)
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">จุดส่งต่อวัน</p>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {days.map((d) => (
            <div key={d.day} className="flex w-9 shrink-0 flex-col items-center justify-end self-stretch">
              <span className="mb-0.5 text-xs text-gray-500">{d.points}</span>
              <div
                className="w-6 rounded-t bg-red-500"
                style={{ height: `${Math.max((d.points / max) * 80, 4)}px` }}
              />
              <span className="mt-1 text-xs text-gray-400">
                {format(new Date(d.day), 'd MMM', { locale: th })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DeliveryPerformancePage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const today = new Date()
  const [range, setRange] = useState({
    start: format(startOfMonth(today), 'yyyy-MM-dd'),
    end: format(endOfMonth(today), 'yyyy-MM-dd'),
  })
  const [data, setData] = useState<DriverPerf[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  // หน้าเชิงบริหาร — จำกัดตามชุดเดียวกับ Performance การมาทำงาน
  useEffect(() => {
    if (userData && !['hr', 'admin', 'manager'].includes(userData.role)) {
      router.push('/unauthorized')
    }
  }, [userData, router])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDeliveryPerformance(range.start, range.end)
      .then((r) => {
        if (!cancelled) setData(r)
      })
      .catch((e) => showToast(e.message, 'error'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const summaries = useMemo(() => (data ?? []).map(summarize), [data])
  const sel = summaries.find((s) => s.driverId === selected) ?? null

  const totals = useMemo(
    () => ({
      points: summaries.reduce((s, x) => s + x.totalPoints, 0),
      km: Math.round(summaries.reduce((s, x) => s + x.totalKm, 0) * 10) / 10,
      manDays: summaries.reduce((s, x) => s + x.runDays, 0),
    }),
    [summaries]
  )

  // ค่าเฉลี่ยรวมทั้งทีม — ใช้ระบายสีในตาราง (ดีกว่าเฉลี่ย = เขียว, แย่กว่า = แดง)
  const fleetAvg = useMemo(() => {
    const gapDays = summaries.flatMap((x) => x.days.filter((d) => d.points > 1))
    const gapCount = gapDays.reduce((s, d) => s + d.points - 1, 0)
    const gapMinutes = gapDays.reduce((s, d) => s + d.spanMinutes, 0)
    return {
      pointsPerDay: totals.manDays ? Math.round((totals.points / totals.manDays) * 10) / 10 : 0,
      minutesPerGap: gapCount ? Math.round(gapMinutes / gapCount) : null,
    }
  }, [summaries, totals])

  const columns: Column<DriverSummary>[] = [
    {
      key: 'name',
      header: 'คนขับ',
      mobilePrimary: true,
      sortValue: (s) => s.name,
      cell: (s) => <span className="font-medium text-gray-900">{s.name}</span>,
    },
    {
      key: 'runDays',
      header: 'วันวิ่ง',
      align: 'center',
      sortValue: (s) => s.runDays,
      cell: (s) => `${s.runDays} วัน`,
    },
    {
      key: 'points',
      header: 'จุดรวม',
      align: 'center',
      sortValue: (s) => s.totalPoints,
      cell: (s) => <span className="font-semibold">{s.totalPoints}</span>,
    },
    {
      key: 'ppd',
      header: (
        <Tip
          text="จุด/วัน"
          tip={`เฉลี่ยรวมทุกคน ${fleetAvg.pointsPerDay} จุด/วัน — เขียว = ส่งได้เกินเฉลี่ย · แดง = ต่ำกว่าเฉลี่ย`}
        />
      ),
      mobileLabel: 'จุด/วัน',
      align: 'center',
      sortValue: (s) => s.pointsPerDay,
      cell: (s) => (
        <span
          className={
            s.pointsPerDay >= fleetAvg.pointsPerDay
              ? 'font-semibold text-green-600'
              : 'font-semibold text-red-600'
          }
        >
          {s.pointsPerDay}
        </span>
      ),
    },
    {
      key: 'km',
      header: 'กม.รวม*',
      align: 'center',
      sortValue: (s) => s.totalKm,
      cell: (s) => s.totalKm.toLocaleString(),
    },
    {
      key: 'kmd',
      header: 'กม./วัน',
      align: 'center',
      sortValue: (s) => s.kmPerDay,
      cell: (s) => s.kmPerDay,
    },
    {
      key: 'gap',
      header: (
        <Tip
          text="นาที/จุด"
          tip={`เวลาเฉลี่ยจากจุดหนึ่งไปอีกจุด — เฉลี่ยรวมทุกคน ${fleetAvg.minutesPerGap ?? '—'} นาที · เขียว = เร็วกว่าเฉลี่ย · แดง = ช้ากว่า`}
        />
      ),
      mobileLabel: 'นาที/จุด',
      align: 'center',
      sortValue: (s) => s.minutesPerGap ?? 0,
      cell: (s) =>
        s.minutesPerGap != null && fleetAvg.minutesPerGap != null ? (
          <span
            className={
              s.minutesPerGap <= fleetAvg.minutesPerGap
                ? 'font-semibold text-green-600'
                : 'font-semibold text-red-600'
            }
          >
            {s.minutesPerGap} น.
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'first',
      header: (
        <Tip
          text="เริ่มจุดแรกเฉลี่ย"
          tip="เวลาเช็คอินจุดส่งแรกของวัน เฉลี่ยจากทุกวันที่วิ่งในช่วงที่เลือก"
        />
      ),
      mobileLabel: 'เริ่มจุดแรกเฉลี่ย',
      align: 'center',
      sortValue: (s) => s.avgFirstAt,
      cell: (s) => `${s.avgFirstAt} น.`,
    },
  ]

  const dayColumns: Column<DriverPerf['days'][number]>[] = [
    {
      key: 'day',
      header: 'วันที่',
      mobilePrimary: true,
      sortValue: (d) => d.day,
      cell: (d) => format(new Date(d.day), 'EEE d MMM', { locale: th }),
    },
    {
      key: 'points',
      header: 'จุด',
      align: 'center',
      sortValue: (d) => d.points,
      cell: (d) => <span className="font-semibold">{d.points}</span>,
    },
    {
      key: 'time',
      header: 'เริ่ม – จุดสุดท้าย',
      align: 'center',
      cell: (d) => `${d.firstAt} – ${d.lastAt} น.`,
    },
    {
      key: 'span',
      header: 'ช่วงส่งของ',
      align: 'center',
      sortValue: (d) => d.spanMinutes,
      cell: (d) => hoursLabel(d.spanMinutes),
    },
    {
      key: 'km',
      header: 'กม.*',
      align: 'center',
      sortValue: (d) => d.distanceKm,
      cell: (d) => d.distanceKm,
    },
    {
      key: 'gap',
      header: 'นาที/จุด',
      align: 'center',
      sortValue: (d) => (d.points > 1 ? d.spanMinutes / (d.points - 1) : 0),
      cell: (d) => (d.points > 1 ? `${Math.round(d.spanMinutes / (d.points - 1))} น.` : '—'),
    },
    {
      key: 'map',
      header: 'เส้นทาง',
      align: 'center',
      cell: (d) => (
        <a
          href={`/delivery/map?date=${d.day}&driver=${selected}`}
          className="inline-flex items-center gap-1 text-red-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          ดูแผนที่ <ExternalLink className="h-3 w-3" />
        </a>
      ),
    },
  ]

  if (!data && loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <TechLoader />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance การส่งของ"
        description="ส่งกี่จุด ใช้เวลาเท่าไหร่ วิ่งไกลแค่ไหน — กดชื่อคนขับเพื่อเจาะรายวัน"
        icon={Gauge}
      />

      <FilterCard
        actions={
          <p className="text-xs text-gray-400">
            * ระยะทางคิดแบบเส้นตรงระหว่างจุด — ต่ำกว่าระยะขับจริง
          </p>
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
      </FilterCard>

      {loading ? (
        <Skeleton rows={8} />
      ) : (
        <>
          <StatGrid>
            <StatCard label="จุดส่งทั้งหมด" value={`${totals.points.toLocaleString()} จุด`} icon={MapPin} />
            <StatCard label="ระยะรวม (เส้นตรง)" value={`${totals.km.toLocaleString()} กม.`} icon={Route} tone="info" />
            <StatCard
              label={
                <Tip
                  text="วันวิ่งรวมทุกคน"
                  tip="ผลรวมวันที่ออกวิ่งของคนขับทุกคน — เช่น 2 คน วิ่งคนละ 5 วัน = 10 คน-วัน"
                />
              }
              value={`${totals.manDays} คน-วัน`}
              icon={Truck}
            />
            <StatCard
              label="เฉลี่ยต่อคน-วัน"
              value={totals.manDays ? `${Math.round((totals.points / totals.manDays) * 10) / 10} จุด` : '—'}
              icon={Gauge}
            />
          </StatGrid>

          <DataTable
            columns={columns}
            rows={summaries}
            rowKey={(s) => s.driverId}
            onRowClick={(s) => setSelected(selected === s.driverId ? null : s.driverId)}
            rowClassName={(s) => (selected === s.driverId ? 'bg-red-50/60' : undefined)}
            emptyTitle="ไม่มีงานส่งของในช่วงที่เลือก"
          />

          {/* ── เจาะรายคน ─────────────────────────────────────────── */}
          {sel && (
            <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
              <p className="font-semibold text-gray-900">{sel.name}</p>

              <StatGrid>
                <StatCard label="จุดรวม" value={`${sel.totalPoints} จุด (${sel.runDays} วัน)`} icon={MapPin} />
                <StatCard label="ระยะรวม (เส้นตรง)" value={`${sel.totalKm.toLocaleString()} กม.`} icon={Route} tone="info" />
                <StatCard
                  label="ความเร็วงาน"
                  value={sel.minutesPerGap != null ? `${sel.minutesPerGap} นาที/จุด` : '—'}
                  icon={Clock}
                  tone={sel.minutesPerGap != null && sel.minutesPerGap > 60 ? 'warning' : 'default'}
                />
                <StatCard label="เริ่มจุดแรกเฉลี่ย" value={`${sel.avgFirstAt} น.`} icon={Truck} />
              </StatGrid>

              <DayChart days={sel.days} />

              <DataTable
                columns={dayColumns}
                rows={sel.days}
                rowKey={(d) => d.day}
                emptyTitle="ไม่มีข้อมูล"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
