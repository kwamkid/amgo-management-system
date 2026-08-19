'use client'

// รายงานรายบุคคล — กดชื่อคนในรายงานเช็คอินแล้วเห็นทั้งช่วง ลงรายวัน
//
// ── ทำไมต้องมี (เจ้าของสั่ง 18 ส.ค. 69) ──────────────────────────────
// ของเดิมดูภาพรวมได้ (ตารางวัน/สรุปรายคน) แต่พอเห็นว่าใครขาด 3 วัน
// ต้องไปไล่หาในแท็บรายวันเองว่าเป็นวันไหน · หน้านี้ตอบ "คนนี้ทั้งเดือน
// เป็นยังไง" ในที่เดียว
//
// ไม่ query ใหม่เลย — ใช้ fullData ที่หน้าแม่โหลดไว้แล้ว (ทุกวันรวมวันขาด
// ทุกหน้า) กดแล้วขึ้นทันที และตัวเลขตรงกับแท็บอื่นเสมอเพราะมาจากก้อนเดียวกัน

import { useMemo } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarDays, Clock, MapPin, Settings2 } from 'lucide-react'
import { Button, Modal } from '@/components/aoo'
import type { AttendanceReportData } from '@/lib/services/reportService'

const hhmmToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}
const minutesToHhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  normal: { label: 'มาทำงาน', cls: 'bg-green-100 text-green-700' },
  late: { label: 'มาสาย', cls: 'bg-amber-100 text-amber-700' },
  absent: { label: 'ขาด', cls: 'bg-red-100 text-red-700' },
  holiday: { label: 'วันหยุด', cls: 'bg-gray-100 text-gray-600' },
}

const TYPE_LABEL: Record<string, string> = {
  onsite: 'สาขา',
  wfh: 'WFH',
  offsite: 'นอกสถานที่',
}

export default function PersonalReport({
  userName,
  rows,
  summary,
  onClose,
  onEditSchedule,
}: {
  userName: string
  /** ทุกวันในช่วงของคนนี้ (รวมวันขาด) */
  rows: AttendanceReportData[]
  /** แถวสรุปของคนนี้จากแท็บสรุปรายคน — คิดกะหมุนเวียน/เลื่อนวันหยุดให้แล้ว */
  summary?: {
    presentDays?: number
    absentDays?: number
    leaveDays?: number
    lateDays?: number
    expectedDays?: number
    totalHours?: number
    workingHolidayDays?: number
  }
  onClose: () => void
  /** มีสิทธิ์แก้ตารางเท่านั้นถึงจะส่งเข้ามา */
  onEditSchedule?: () => void
}) {
  const days = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows]
  )

  const stats = useMemo(() => {
    const worked = days.filter((d) => d.status === 'normal' || d.status === 'late')
    const lateDays = days.filter((d) => d.isLate)
    const ins = worked.map((d) => hhmmToMinutes(d.firstCheckIn)).filter((m): m is number => m != null)
    const byType = new Map<string, number>()
    for (const d of worked) byType.set(d.checkinType ?? 'onsite', (byType.get(d.checkinType ?? 'onsite') ?? 0) + 1)

    const longest = worked.reduce<AttendanceReportData | null>(
      (best, d) => (!best || d.totalHours > best.totalHours ? d : best),
      null
    )

    return {
      workedCount: worked.length,
      hours: worked.reduce((s, d) => s + d.totalHours, 0),
      avgIn: ins.length ? minutesToHhmm(ins.reduce((s, m) => s + m, 0) / ins.length) : null,
      lateCount: lateDays.length,
      avgLate: lateDays.length
        ? Math.round(lateDays.reduce((s, d) => s + d.lateMinutes, 0) / lateDays.length)
        : 0,
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
      longest,
      swaps: days.filter((d) => d.swapNote).length,
    }
  }, [days])

  const present = summary?.presentDays ?? stats.workedCount
  const expected = summary?.expectedDays ?? present + (summary?.absentDays ?? 0)
  const pct = expected > 0 ? Math.round((present / expected) * 100) : null

  const card = (label: string, value: string, tone = 'text-gray-900') => (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  )

  return (
    <Modal open onClose={onClose} title={userName} maxWidth={900}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarDays size={14} />
            {days.length > 0
              ? `${format(new Date(days[0].date), 'd MMM', { locale: th })} – ${format(
                  new Date(days[days.length - 1].date),
                  'd MMM yyyy',
                  { locale: th }
                )} · ${days.length} วัน`
              : 'ไม่มีข้อมูลในช่วงนี้'}
          </p>
          {onEditSchedule && (
            <Button variant="secondary" size="sm" onClick={onEditSchedule}>
              <Settings2 size={14} /> แก้ตารางวันทำงาน
            </Button>
          )}
        </div>

        {/* ตัวเลขรวม — ใช้ของแท็บสรุปเพื่อให้ตรงกันเป๊ะ */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {card('มาทำงาน', pct != null ? `${present}/${expected} วัน` : `${present} วัน`)}
          {card('ขาด', `${summary?.absentDays ?? 0} วัน`, (summary?.absentDays ?? 0) > 0 ? 'text-red-600' : 'text-gray-900')}
          {card('ลา', `${summary?.leaveDays ?? 0} วัน`)}
          {card('ชั่วโมงรวม', `${Math.round(stats.hours * 10) / 10} ชม.`)}
        </div>

        {/* วิเคราะห์ — สิ่งที่ตารางรวมบอกไม่ได้ */}
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <p className="flex items-center gap-1.5">
              <Clock size={13} className="text-gray-400" />
              เข้างานเฉลี่ย <span className="font-medium">{stats.avgIn ?? '-'}</span>
            </p>
            <p>
              มาสาย <span className="font-medium">{stats.lateCount}</span> วัน
              {stats.lateCount > 0 && <span className="text-gray-500"> · เฉลี่ย {stats.avgLate} นาที</span>}
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin size={13} className="text-gray-400" />
              {stats.byType.length
                ? stats.byType.map(([t, n]) => `${TYPE_LABEL[t] ?? t} ${n} วัน`).join(' · ')
                : '-'}
            </p>
            <p>
              เฉลี่ย{' '}
              <span className="font-medium">
                {stats.workedCount ? Math.round((stats.hours / stats.workedCount) * 10) / 10 : 0}
              </span>{' '}
              ชม./วันที่มา
              {stats.longest && stats.longest.totalHours > 0 && (
                <span className="text-gray-500">
                  {' '}· ยาวสุด {stats.longest.totalHours} ชม. (
                  {format(new Date(stats.longest.date), 'd MMM', { locale: th })})
                </span>
              )}
            </p>
            {stats.swaps > 0 && (
              <p className="sm:col-span-2 text-indigo-700">สลับวันหยุด {stats.swaps} วันในช่วงนี้</p>
            )}
          </div>
        </div>

        {/* รายวัน */}
        <div className="max-h-[45vh] overflow-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">วันที่</th>
                <th className="px-3 py-2 text-left font-medium">สถานะ</th>
                <th className="px-3 py-2 text-center font-medium">เข้า–ออก</th>
                <th className="px-3 py-2 text-center font-medium">ชม.</th>
                <th className="px-3 py-2 text-left font-medium">ที่</th>
                <th className="px-3 py-2 text-left font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {days.map((d) => {
                const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.holiday
                return (
                  <tr key={d.date} className={d.status === 'absent' ? 'bg-red-50/50' : undefined}>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {format(new Date(d.date), 'EEE d MMM', { locale: th })}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${st.cls}`}>
                        {st.label}
                        {d.isLate && d.lateMinutes > 0 && ` ${d.lateMinutes} น.`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-center text-gray-600">
                      {d.firstCheckIn !== '-' ? `${d.firstCheckIn}–${d.lastCheckOut}` : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-center">{d.totalHours > 0 ? d.totalHours : '-'}</td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {d.locationName ?? (d.checkinType ? TYPE_LABEL[d.checkinType] : '-')}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{d.note || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
