'use client'

// รายงานการส่งของ — วันไหนใครส่งกี่เจ้า สรุปทั้งเดือนในตาเดียว
//
// เปิดให้ทั้งทีม: คนขับ + Call Center + แอดมิน/HR/ผู้จัดการ (เมนูกลุ่มรายงาน)
//
// แถว = วันที่ "ครบทุกวัน" ของเดือน (รวมอาทิตย์/วันหยุด — เจ้าของสั่งให้เห็นวันหยุดด้วย
// ไม่ใช่ข้ามหาย) ตัดเฉพาะวันอนาคต · คอลัมน์ = คนขับ · หัวคอลัมน์กดเรียงได้
// ช่องที่ไม่มีงานส่ง บอกสถานะวันนั้น (มาทำงาน/หยุด/ลา/ขาด) จากรายงานเข้างานตัวเดียวกับ HR

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, endOfMonth, startOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'
import { ArrowDown, ArrowUp, ChevronsUpDown, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { canSeeDelivery } from '@/lib/services/user/access'
import { useToast } from '@/hooks/useToast'
import { getDeliveryRangeSummary } from '@/lib/services/delivery/points'
import { getAttendanceReportForExport } from '@/lib/services/reportService'
import { FilterCard, FilterField, PageHeader, Skeleton, TechLoader } from '@/components/shared'
import { DateRangePicker } from '@/components/ui/date-range-picker'

type Summary = Awaited<ReturnType<typeof getDeliveryRangeSummary>>
/** `${YYYY-MM-DD}|${userId}` → สถานะจากรายงานเข้างาน */
type AttMap = Map<string, { status: string; note: string; hours: number }>
type Sort = { key: string; dir: 'asc' | 'desc' } // key: 'date' | driverId | 'total'

export default function DeliveryReportPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  // ช่วงวันแบบเดียวกับรายงานการเข้างาน — ค่าเริ่มต้นเดือนนี้ทั้งเดือน
  const [range, setRange] = useState(() => ({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  }))
  const [data, setData] = useState<Summary | null>(null)
  const [att, setAtt] = useState<AttMap>(new Map())
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: 'asc' })
  // เปลี่ยนเดือนไม่ล้างจอ — ตารางเดิมจางรอจนข้อมูลใหม่มาแทน (ไม่เด้งทั้งหน้า)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userData && !canSeeDelivery(userData)) router.push('/unauthorized')
  }, [userData, router])

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const summary = await getDeliveryRangeSummary(range.start, range.end)
        if (!alive) return

        // สถานะเข้างานของคนขับ — ไว้อธิบายช่องที่ไม่มีงานส่ง (มาทำงาน/หยุด/ลา/ขาด)
        const map: AttMap = new Map()
        if (summary.drivers.length) {
          const report = await getAttendanceReportForExport({
            startDate: new Date(`${range.start}T00:00:00`),
            endDate: new Date(`${range.end}T00:00:00`),
            userIds: summary.drivers.map((d) => d.id),
            showOnlyPresent: false,
          })
          for (const r of report.data) {
            map.set(`${r.date}|${r.userId}`, {
              status: r.status,
              note: r.note ?? '',
              hours: r.totalHours,
            })
          }
        }
        if (!alive) return
        setAtt(map)
        setData(summary)
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

  if (!data) return <TechLoader />

  // ครบทุกวันในช่วงที่เลือก (รวมวันหยุด) — ตัดเฉพาะวันที่ยังมาไม่ถึง
  const today = format(new Date(), 'yyyy-MM-dd')
  const allDays: string[] = []
  for (
    let d = new Date(`${range.start}T00:00:00`);
    ;
    d.setDate(d.getDate() + 1)
  ) {
    const s = format(d, 'yyyy-MM-dd')
    if (s > range.end || s > today) break
    allDays.push(s)
  }

  const count = (d: string, driverId: string) => data.counts.get(`${d}|${driverId}`) ?? 0
  const rows = allDays.map((d) => ({
    date: d,
    total: data.drivers.reduce((s, dr) => s + count(d, dr.id), 0),
  }))
  const totalOf = (driverId: string) =>
    allDays.reduce((s, d) => s + count(d, driverId), 0)
  const grand = rows.reduce((s, r) => s + r.total, 0)

  const sortValue = (r: (typeof rows)[number]) =>
    sort.key === 'date' ? r.date : sort.key === 'total' ? r.total : count(r.date, sort.key)
  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(a)
    const vb = sortValue(b)
    const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb))
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key !== key ? { key, dir: key === 'date' ? 'asc' : 'desc' } : { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    )

  const SortHead = ({
    label,
    sortKey,
    className = '',
  }: {
    label: string
    sortKey: string
    className?: string
  }) => (
    <th className={`whitespace-nowrap border-b border-gray-200 px-4 py-2.5 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-gray-900"
      >
        {label}
        {sort.key === sortKey ? (
          sort.dir === 'asc' ? (
            <ArrowUp size={13} className="shrink-0" />
          ) : (
            <ArrowDown size={13} className="shrink-0" />
          )
        ) : (
          <ChevronsUpDown size={13} className="shrink-0 text-gray-300" />
        )}
      </button>
    </th>
  )

  /** ช่องไม่มีงานส่ง — บอกสถานะวันนั้น (font-sans: ข้อความไทยไม่ใช้ฟอนต์ตัวเลข) */
  const emptyCell = (day: string, driverId: string) => {
    const a = att.get(`${day}|${driverId}`)
    if (!a) return <span className="text-gray-300">—</span>
    if (a.status === 'absent')
      return <span className="font-sans text-xs font-medium text-red-600">ขาด</span>
    if (a.status === 'normal' || a.status === 'late' || a.hours > 0) {
      return (
        <span className="text-gray-400" title="มาทำงาน แต่ไม่มีงานส่งวันนี้">
          0
        </span>
      )
    }
    if (a.note.includes('ลา'))
      return <span className="font-sans text-xs font-medium text-sky-600">ลา</span>
    return <span className="font-sans text-xs text-gray-400">หยุด</span>
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="รายงานการส่งของ"
        description="วันไหนใครส่งกี่เจ้า — นับจากจุดส่งที่เช็คอินแล้ว"
        icon={Truck}
      />

      <FilterCard
        actions={
          <>
            <span className="text-sm text-gray-500">
              รวมทั้งช่วง{' '}
              <b className="font-semibold text-gray-900">{grand.toLocaleString('th-TH')}</b> เจ้า
            </span>
            <span className="text-xs text-gray-400">
              0 = มาทำงานแต่ไม่มีงานส่ง · ขาด/ลา/หยุด ตามรายงานเข้างาน
            </span>
          </>
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
        <Skeleton rows={10} />
      ) : allDays.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center text-gray-500">
          ช่วงที่เลือกยังมาไม่ถึง
        </div>
      ) : (
        <div className="w-fit max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <SortHead label="วันที่" sortKey="date" className="text-left" />
                {data.drivers.map((dr) => (
                  <SortHead
                    key={dr.id}
                    label={dr.name}
                    sortKey={dr.id}
                    className="min-w-28 text-center"
                  />
                ))}
                <SortHead label="รวม" sortKey="total" className="bg-gray-100/70 text-center" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.date}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-gray-800">
                    {format(new Date(`${r.date}T00:00:00`), 'EEE d MMM', { locale: th })}
                  </td>
                  {data.drivers.map((dr) => {
                    const n = count(r.date, dr.id)
                    return (
                      <td key={dr.id} className="px-4 py-2 text-center font-mono tabular-nums">
                        {n ? (
                          <span className="font-medium text-gray-900">{n}</span>
                        ) : (
                          emptyCell(r.date, dr.id)
                        )}
                      </td>
                    )
                  })}
                  <td className="bg-gray-50/70 px-4 py-2 text-center font-mono font-semibold tabular-nums">
                    {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-2.5">รวมต่อคน</td>
                {data.drivers.map((dr) => (
                  <td key={dr.id} className="px-4 py-2.5 text-center font-mono tabular-nums">
                    {totalOf(dr.id)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-center font-mono tabular-nums text-red-700">
                  {grand}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
