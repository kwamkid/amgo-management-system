// components/reports/ReportResults.tsx - Updated with pagination

'use client'

import { Skeleton } from '@/components/shared'

import { useEffect, useState } from 'react'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { HelpTooltip } from '@/components/aoo'
import { createClient } from '@/lib/supabase/client'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AttendanceReportData, AttendanceReportFilters, AttendanceReportResponse } from '@/lib/services/reportService'
import { backfillWorkDay } from '@/lib/services/checkinService'
import UserScheduleDialog from '@/components/users/UserScheduleDialog'
import { getAttendanceReportForExport } from '@/lib/services/reportService'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface ReportResultsProps {
  reportData: AttendanceReportData[]
  summaryData: any[]
  loading: boolean
  filters: AttendanceReportFilters | null
  pagination?: AttendanceReportResponse['pagination']
  onPageChange?: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
  /** เรียกหลัง HR เติมวันทำงานสำเร็จ — ให้หน้าแม่ดึงรายงานใหม่ */
  onDataChanged?: () => void
}

export default function ReportResults({
  reportData,
  summaryData,
  loading,
  filters,
  pagination,
  onPageChange,
  pageSize = 50,
  onPageSizeChange,
  onDataChanged,
}: ReportResultsProps) {
  // ตารางวันขึ้นก่อน — เจ้าของบอกดูง่ายที่สุด เห็นทั้งเดือนในตาเดียว
  const [activeTab, setActiveTab] = useState('calendar')
  const [loadingPage, setLoadingPage] = useState(false)
  const { userData } = useAuth()
  // เติมวันได้เฉพาะ HR/แอดมิน — RLS ฝั่งฐานข้อมูลกันซ้ำอีกชั้น
  const canBackfill = userData?.role === 'hr' || userData?.role === 'admin'
  const [backfillFor, setBackfillFor] = useState<AttendanceReportData | null>(null)
  // กดชื่อพนักงาน → แก้ตารางวันทำงาน (วันทำงาน/สัปดาห์ · วันหยุดประจำ) ได้ตรงนั้นเลย
  const [scheduleFor, setScheduleFor] = useState<{ userId: string; name: string } | null>(null)
  const [scheduleReload, setScheduleReload] = useState(0)
  const openSchedule = canBackfill
    ? (userId: string, name: string) => setScheduleFor({ userId, name })
    : undefined
  
  // Handle page change with loading state
  const handlePageChange = async (page: number) => {
    if (!onPageChange || loadingPage) return
    
    // เพิ่ม delay เล็กน้อยเพื่อให้เห็น loading state
    setLoadingPage(true)
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    try {
      await onPageChange(page)
    } finally {
      // เพิ่ม delay เล็กน้อยเพื่อให้ UX ดีขึ้น
      setTimeout(() => {
        setLoadingPage(false)
      }, 300)
    }
  }
  
  // Empty State
  if (!loading && reportData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            เลือกช่วงเวลาและกดปุ่ม "ดูข้อมูล" เพื่อดูรายงาน
          </p>
        </CardContent>
      </Card>
    )
  }
  
  // Loading State
  if (loading) {
    return null
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">
            ผลลัพธ์รายงาน
            {pagination && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({reportData.length} / {pagination.totalRecords} รายการ)
              </span>
            )}
          </CardTitle>
          {filters && (
            <Badge variant="secondary" className="text-xs">
              {format(filters.startDate, 'dd MMM', { locale: th })} –{' '}
              {format(filters.endDate, 'dd MMM yyyy', { locale: th })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar">ตารางวัน</TabsTrigger>
            <TabsTrigger value="daily">รายวัน</TabsTrigger>
            <TabsTrigger value="summary">สรุปรายคน</TabsTrigger>
          </TabsList>

          {/* Day slot — ช่องวันของทุกคนเรียงตรงกัน เห็นทั้งเดือนในตาเดียว */}
          <TabsContent value="calendar" className="mt-4">
            {activeTab === 'calendar' && (
              <DaySlotGrid
                filters={filters}
                reloadKey={scheduleReload}
                onNameClick={openSchedule}
              />
            )}
          </TabsContent>


          {/* Daily Report */}
          <TabsContent value="daily" className="mt-4">
            {loadingPage ? (
              <div className="space-y-2">
                <Skeleton rows={10} />
              </div>
            ) : (
              <>
                <DailyReportTable
                  data={reportData}
                  canBackfill={canBackfill}
                  onBackfill={setBackfillFor}
                />
                <PaginationControls
                  pagination={pagination}
                  onPageChange={handlePageChange}
                  loading={loadingPage}
                  pageSize={pageSize}
                  onPageSizeChange={onPageSizeChange}
                />
              </>
            )}
          </TabsContent>
          
          {/* Summary Report */}
          <TabsContent value="summary" className="mt-4">
            <SummaryReportTable data={summaryData} onNameClick={openSchedule} />
          </TabsContent>
        </Tabs>
      </CardContent>

      {backfillFor && (
        <BackfillDayDialog
          record={backfillFor}
          onClose={() => setBackfillFor(null)}
          onSaved={() => {
            setBackfillFor(null)
            onDataChanged?.()
          }}
        />
      )}

      {scheduleFor && (
        <UserScheduleDialog
          userId={scheduleFor.userId}
          name={scheduleFor.name}
          onClose={() => {
            setScheduleFor(null)
            // ตารางเวรเปลี่ยน = มา/ขาดเปลี่ยน — ดึงรายงานใหม่ทั้งตารางวันและแท็บอื่น
            setScheduleReload((k) => k + 1)
            onDataChanged?.()
          }}
        />
      )}
    </Card>
  )
}

/**
 * HR เติมวันทำงานย้อนหลัง — ใช้กับวันที่ขึ้น "ขาด" แต่พิสูจน์ได้ว่ามาทำงานจริง
 * บังคับกรอกเหตุผล และรายงานจะติดหมายเหตุ "HR เติมวันทำงานย้อนหลัง" เสมอ
 */
function BackfillDayDialog({
  record,
  onClose,
  onSaved,
}: {
  record: AttendanceReportData
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToast()
  const [inTime, setInTime] = useState('09:00')
  const [outTime, setOutTime] = useState('18:00')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    try {
      setSaving(true)
      await backfillWorkDay({
        userId: record.userId,
        userName: record.userName,
        workDate: record.date,
        inTime,
        outTime,
        reason,
      })
      showToast('เติมวันทำงานแล้ว', 'success')
      onSaved()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-semibold text-gray-900">เติมวันทำงานย้อนหลัง</h3>
            <p className="mt-0.5 text-sm text-gray-600">
              {record.userName} · {format(new Date(record.date), 'dd MMM yyyy', { locale: th })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">เวลาเข้า</label>
              <Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">เวลาออก</label>
              <Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">เหตุผล / หลักฐาน (บังคับ)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น มีรูปถ่ายหน้างาน · หัวหน้ายืนยันว่ามาทำงาน แต่ลืมเช็คอิน"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !reason.trim()}>
              {saving ? 'กำลังบันทึก...' : 'เติมวันนี้ให้'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Pagination Controls Component
function PaginationControls({
  pagination,
  onPageChange,
  loading = false,
  pageSize,
  onPageSizeChange,
}: {
  pagination?: AttendanceReportResponse['pagination']
  onPageChange?: (page: number) => void
  loading?: boolean
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}) {
  const getPageNumbers = (currentPage: number, totalPages: number) => {
    const pages: (number | string)[] = []
    const max = 7
    const half = Math.floor(max / 2)
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, currentPage + half)
    if (currentPage <= half) end = Math.min(totalPages, max)
    if (currentPage + half >= totalPages) start = Math.max(1, totalPages - max + 1)
    if (start > 1) { pages.push(1); if (start > 2) pages.push('...') }
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages) }
    return pages
  }

  const showPages = pagination && pagination.totalPages > 1

  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 px-1">
      {/* Left: rows per page */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">แสดง</span>
        <Select
          value={String(pageSize ?? 50)}
          onValueChange={(v) => onPageSizeChange?.(Number(v))}
        >
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[20, 50, 100, 200].map(n => (
              <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-500">รายการ/หน้า</span>
        {pagination && (
          <span className="text-xs text-gray-400 ml-2">
            หน้า {pagination.currentPage} / {pagination.totalPages}
          </span>
        )}
      </div>

      {/* Right: page navigation */}
      {showPages && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(pagination!.currentPage - 1)}
            disabled={!pagination!.hasPrev || loading}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {getPageNumbers(pagination!.currentPage, pagination!.totalPages).map((page, i) => (
            <div key={i}>
              {page === '...' ? (
                <span className="px-1.5 text-xs text-gray-400">...</span>
              ) : (
                <Button
                  variant={page === pagination!.currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange?.(page as number)}
                  disabled={loading}
                  className="h-7 min-w-[28px] px-1.5 text-xs"
                >
                  {page}
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(pagination!.currentPage + 1)}
            disabled={!pagination!.hasNext || loading}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// Daily Report Table Component
function DailyReportTable({
  data,
  canBackfill,
  onBackfill,
}: {
  data: AttendanceReportData[]
  canBackfill: boolean
  onBackfill: (r: AttendanceReportData) => void
}) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</p>
      </div>
    )
  }
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>วันที่</TableHead>
            <TableHead>ชื่อพนักงาน</TableHead>
            <TableHead>เวลาเข้า</TableHead>
            <TableHead>เวลาออก</TableHead>
            <TableHead>รวม (ชม.)</TableHead>
            <TableHead>สถานที่</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>หมายเหตุ</TableHead>
            {canBackfill && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record, index) => (
            <TableRow key={`${record.date}-${record.userId}-${index}`}>
              <TableCell>
                {format(new Date(record.date), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>{record.userName}</TableCell>
              <TableCell>
                <Badge variant={record.firstCheckIn === '-' ? 'secondary' : 'default'}>
                  {record.firstCheckIn}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={record.lastCheckOut === '-' ? 'secondary' : 'default'}>
                  {record.lastCheckOut}
                </Badge>
              </TableCell>
              <TableCell>
                {record.totalHours > 0 ? (
                  <span className="font-medium">{record.totalHours}</span>
                ) : '-'}
              </TableCell>
              <TableCell>{record.locationName || 'เช็คอินนอกสถานที่'}</TableCell>
              <TableCell>
                <AttendanceStatusBadge 
                  status={record.status} 
                  isLate={record.isLate}
                  lateMinutes={record.lateMinutes}
                />
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {record.note || '-'}
              </TableCell>
              {canBackfill && (
                <TableCell className="text-right">
                  {record.status === 'absent' && (
                    <Button variant="outline" size="sm" onClick={() => onBackfill(record)}>
                      เติมวัน
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Summary Report Table Component
function SummaryReportTable({
  data,
  onNameClick,
}: {
  data: any[]
  onNameClick?: (userId: string, name: string) => void
}) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">ไม่มีข้อมูลสรุป</p>
      </div>
    )
  }
  
  // คนมีปัญหา (ขาดงาน) ขึ้นก่อนเสมอ — ขาดมากอยู่บนสุด ที่เหลือไล่ตามชื่อ
  const sorted = [...data].sort(
    (a, b) => (b.absentDays - a.absentDays) || a.userName.localeCompare(b.userName, 'th')
  )
  const problemCount = sorted.filter((s) => s.absentDays > 0).length

  return (
    <div className="overflow-x-auto">
      {problemCount > 0 && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          มีพนักงานขาดงาน (ไม่เช็คอินในวันทำงาน) {problemCount} คนในช่วงนี้ — แสดงไว้บนสุดแล้ว
          ถ้าพิสูจน์ได้ว่ามาทำงานจริง กดเติมวันได้ในแท็บรายวัน
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ชื่อพนักงาน</TableHead>
            <TableHead className="text-center">ควรมา</TableHead>
            <TableHead className="text-center">มาจริง</TableHead>
            <TableHead className="text-center">วันขาด</TableHead>
            <TableHead className="text-center">วันสาย</TableHead>
            <TableHead className="text-center">รวมชั่วโมง</TableHead>
            <TableHead className="text-center">เฉลี่ย/วัน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((summary, index) => (
            <TableRow
              key={summary.userId || index}
              className={summary.absentDays > 0 ? 'bg-red-50/60' : undefined}
            >
              <TableCell className="font-medium">
                {onNameClick && summary.userId ? (
                  <button
                    type="button"
                    onClick={() => onNameClick(summary.userId, summary.userName)}
                    className="text-left hover:text-indigo-600 hover:underline"
                    title="กดเพื่อแก้ตารางวันทำงาน"
                  >
                    {summary.userName}
                  </button>
                ) : (
                  summary.userName
                )}
              </TableCell>
              <TableCell className="text-center text-gray-600">
                {summary.expectedDays ?? summary.presentDays + summary.absentDays}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="success">{summary.presentDays}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={summary.absentDays > 0 ? 'error' : 'secondary'}>
                  {summary.absentDays}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={summary.lateDays > 0 ? 'warning' : 'secondary'}>
                  {summary.lateDays}
                </Badge>
              </TableCell>
              <TableCell className="text-center font-medium">
                {summary.totalHours.toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                {(summary.averageHoursPerDay || 0).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Status Badge Component
function AttendanceStatusBadge({ 
  status, 
  isLate, 
  lateMinutes 
}: { 
  status: string
  isLate: boolean
  lateMinutes: number
}) {
  if (status === 'absent') {
    return <Badge variant="error">ขาด</Badge>
  }
  
  if (status === 'holiday') {
    return <Badge variant="secondary">วันหยุด</Badge>
  }
  
  if (status === 'late' || isLate) {
    return (
      <Badge variant="warning">
        สาย {lateMinutes > 0 ? `${lateMinutes} นาที` : ''}
      </Badge>
    )
  }
  
  return <Badge variant="success">ปกติ</Badge>
}

/* ------------------------------------------------------------------ *
 *  Day slot — แต่ละคนหนึ่งแถว ช่องวันที่เรียงตรงกันทุกคน
 *  เขียว=มา · ส้ม=มาสาย · แดง=ขาด · ฟ้า=ลา · เทา=วันหยุด/ไม่ต้องเช็คอิน
 * ------------------------------------------------------------------ */
type DaySlotSummary = { present: number; absent: number; leave: number; total: number }

function DaySlotGrid({
  filters,
  reloadKey = 0,
  onNameClick,
}: {
  filters: AttendanceReportFilters | null
  /** bump เมื่อแก้ตารางเวรเสร็จ — ให้ดึงข้อมูลใหม่ */
  reloadKey?: number
  onNameClick?: (userId: string, name: string) => void
}) {
  const [rows, setRows] = useState<AttendanceReportData[] | null>(null)
  const [sumByUser, setSumByUser] = useState<Map<string, DaySlotSummary>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!filters) return
    let cancelled = false
    setLoading(true)
    // ดึงทั้งช่วง (ไม่ใช่หน้าเดียว) และเอาวันขาด/วันหยุดมาด้วย
    getAttendanceReportForExport({
      startDate: filters.startDate,
      endDate: filters.endDate,
      userIds: filters.userIds,
      locationId: filters.locationId,
      showOnlyPresent: false,
    })
      .then((r) => {
        if (cancelled) return
        setRows(r.data)
        // เลขใช้ของแท็บสรุป — คิดกะหมุนเวียน/เลื่อนวันหยุดให้แล้ว
        setSumByUser(
          new Map(
            (r.summary || []).map((x) => [
              x.userId,
              {
                present: x.presentDays,
                absent: x.absentDays,
                leave: x.leaveDays ?? 0,
                total: x.totalDays,
              },
            ])
          )
        )
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, reloadKey])

  if (!filters) return null
  if (loading || !rows) return <Skeleton rows={10} />

  // รายการวันในช่วง (ตัดที่วันนี้ — วันอนาคตยังไม่มีอะไรให้ดู)
  // เทียบเป็นวันล้วน ไม่ใช่ Date ตรง ๆ — เวลาที่ติดมากับ filters ทำให้วันสุดท้ายหลุด
  const today = format(new Date(), 'yyyy-MM-dd')
  const endStr = format(filters.endDate, 'yyyy-MM-dd')
  const lastDay = endStr < today ? endStr : today
  const days: string[] = []
  for (let d = new Date(filters.startDate); format(d, 'yyyy-MM-dd') <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(format(d, 'yyyy-MM-dd'))
  }

  type Cell = { status: string; late: boolean; note: string; hours: number; ctype?: string; loc?: string; inAt?: string; outAt?: string; lateMin?: number }
  const byUser = new Map<
    string,
    { userId: string; name: string; cells: Map<string, Cell>; sum: DaySlotSummary }
  >()
  for (const r of rows) {
    let u = byUser.get(r.userId)
    if (!u) {
      u = {
        userId: r.userId,
        name: r.userName,
        cells: new Map(),
        sum: sumByUser.get(r.userId) ?? { present: 0, absent: 0, leave: 0, total: 0 },
      }
      byUser.set(r.userId, u)
    }
    u.cells.set(r.date, {
      status: r.status,
      late: r.isLate,
      note: r.note || '',
      hours: r.totalHours,
      ctype: r.checkinType,
      loc: r.locationName,
      inAt: r.firstCheckIn,
      outAt: r.lastCheckOut,
      lateMin: r.lateMinutes,
    })
  }

  // คนขาดมากอยู่บนสุด — เหมือนแท็บสรุป
  const people = [...byUser.values()].sort(
    (a, b) => b.sum.absent - a.sum.absent || a.name.localeCompare(b.name, 'th')
  )

  // จุดนอกสถานที่กดเปิดแผนที่ได้ — พิกัดไม่ได้ติดมากับรายงาน จึงไปดึงจากเช็คอินตอนกด
  // (เปิดแท็บก่อน await — ไม่งั้น popup blocker กันการเปิดหลัง async)
  const openCheckinMap = async (userId: string, date: string) => {
    const win = window.open('about:blank', '_blank')
    const { data } = await createClient()
      .from('checkins')
      .select('checkin_lat, checkin_lng')
      .eq('user_id', userId)
      .eq('work_date', date)
      .order('checkin_time')
      .limit(1)
      .maybeSingle()
    if (data && win) win.location.href = `https://maps.google.com/?q=${data.checkin_lat},${data.checkin_lng}`
    else win?.close()
  }

  // สีของ "มา" แยกตามที่เช็คอิน — เจ้าของขอให้เห็นจากสีเลยว่าเข้าสาขาหรือนอกสถานที่
  const presenceClass = (c: Cell): string =>
    c.ctype === 'offsite' ? 'bg-purple-500' : c.ctype === 'wfh' ? 'bg-teal-600' : 'bg-green-500'

  const cellClass = (c?: Cell): string => {
    if (!c) return 'bg-gray-50'
    if (c.status === 'absent') return 'bg-red-500'
    if (c.status === 'late') return 'bg-amber-400'
    if (c.status === 'normal') return presenceClass(c)
    // holiday รวม ลา/วันหยุดตามตาราง/ไม่ต้องเช็คอิน — แยกด้วยหมายเหตุ
    if (c.hours > 0) return `${presenceClass(c)} ring-1 ring-green-800` // มาทำงานวันหยุด
    if (c.note.includes('ลา')) return 'bg-sky-500'
    return 'bg-gray-200'
  }

  // ช่วงยาวกว่า 1 เดือน: คงขนาดจุดไว้แล้วเลื่อนแนวนอนแทน (ชื่อตรึงซ้าย มา/ขาดตรึงขวา)
  // — บีบ 90+ จุดลงจอเดียวจะดูไม่ออก ส่วนภาพรวมแบบย่อมีหน้า Performance อยู่แล้ว
  const scrollMode = days.length > 31
  const monthSegs: { label: string; count: number }[] = []
  if (scrollMode) {
    for (const d of days) {
      const label = format(new Date(d), 'MMM yyyy', { locale: th })
      const last = monthSegs[monthSegs.length - 1]
      if (last && last.label === label) last.count++
      else monthSegs.push({ label, count: 1 })
    }
  }
  const monthStart = (d: string) => scrollMode && d.slice(8) === '01'

  const dayHead = (d: string) => (
    <th
      key={d}
      className={`border-b border-gray-100 bg-gray-50 px-0.5 py-1 text-center font-normal text-gray-400 ${
        scrollMode ? 'min-w-6' : ''
      } ${monthStart(d) ? 'border-l-2 border-l-gray-200' : ''}`}
    >
      <span className="block text-[10px] leading-tight">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][new Date(d).getDay()]}
      </span>
      <span className="block leading-tight">{Number(d.slice(8))}</span>
    </th>
  )

  const legend = [
    ['bg-green-500', 'มาทำงาน (สาขา)'],
    ['bg-purple-500', 'นอกสถานที่'],
    ['bg-teal-600', 'ทำงานที่บ้าน'],
    ['bg-amber-400', 'มาสาย'],
    ['bg-red-500', 'ขาด'],
    ['bg-sky-500', 'ลา'],
    ['bg-gray-200', 'วันหยุด/ไม่ต้องเช็คอิน'],
  ] as const

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
        {legend.map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
            {label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className={`${scrollMode ? '' : 'w-full table-fixed'} border-collapse text-xs`}>
          <thead>
            <tr>
              <th
                rowSpan={scrollMode ? 2 : 1}
                className="sticky left-0 z-10 w-44 min-w-44 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-left font-medium text-gray-600"
              >
                พนักงาน
              </th>
              {scrollMode
                ? monthSegs.map((seg) => (
                    <th
                      key={seg.label}
                      colSpan={seg.count}
                      className="border-b border-l-2 border-gray-100 border-l-gray-200 bg-gray-50 px-2 py-1 text-left text-[11px] font-medium text-gray-500"
                    >
                      {seg.label}
                    </th>
                  ))
                : days.map(dayHead)}
              <th
                rowSpan={scrollMode ? 2 : 1}
                className={`w-28 min-w-28 border-b border-gray-100 bg-gray-50 px-2 py-1.5 text-center font-medium text-gray-600 ${
                  scrollMode ? 'sticky right-0 z-10 border-l border-l-gray-100' : ''
                }`}
              >
                มา/ขาด
              </th>
            </tr>
            {scrollMode && <tr>{days.map(dayHead)}</tr>}
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.userId} className="border-b border-gray-50 last:border-0">
                <td className="sticky left-0 z-10 max-w-44 truncate bg-white px-3 py-1 text-gray-800">
                  {onNameClick ? (
                    <button
                      type="button"
                      onClick={() => onNameClick(p.userId, p.name)}
                      className="max-w-full truncate text-left hover:text-indigo-600 hover:underline"
                      title="กดเพื่อแก้ตารางวันทำงาน"
                    >
                      {p.name}
                    </button>
                  ) : (
                    p.name
                  )}
                </td>
                {days.map((d) => {
                  const c = p.cells.get(d)
                  return (
                    <td
                      key={d}
                      className={`px-0.5 py-1 text-center ${
                        monthStart(d) ? 'border-l-2 border-l-gray-100' : ''
                      }`}
                    >
                      <HelpTooltip
                        variant="tooltip"
                        delay={100}
                        content={(() => {
                          const dateStr = format(new Date(d), 'dd MMM', { locale: th })
                          if (!c) return dateStr
                          if (c.status === 'absent') return `${dateStr} · ขาด`
                          const present = c.status === 'normal' || c.status === 'late' || c.hours > 0
                          if (!present) return `${dateStr} · ${c.note || 'วันหยุด'}`
                          const where =
                            c.ctype === 'offsite'
                              ? 'นอกสถานที่'
                              : c.ctype === 'wfh'
                                ? 'ทำงานที่บ้าน'
                                : c.loc || 'สาขา'
                          const lateTxt =
                            c.status === 'late'
                              ? `มาสาย${c.lateMin ? ` ${c.lateMin} นาที` : ''}`
                              : 'มาทำงาน'
                          // 2 บรรทัด: สถานะ · เวลา — อ่านแยกกันง่ายกว่ายัดบรรทัดเดียว
                          return (
                            <span className="block text-left leading-5">
                              <span className="block">
                                {dateStr} · {lateTxt} · {where}
                              </span>
                              {c.inAt && (
                                <span className="block opacity-75">
                                  เข้า {c.inAt}
                                  {c.outAt ? ` – ออก ${c.outAt}` : ' (ยังไม่เช็คเอาท์)'}
                                </span>
                              )}
                              {c.ctype === 'offsite' && (
                                <span className="block opacity-75">กดจุดเพื่อเปิดแผนที่</span>
                              )}
                            </span>
                          )
                        })()}
                        triggerStyle={{ borderBottom: 'none', cursor: 'default', display: 'inline-flex' }}
                      >
                        <span
                          onClick={
                            c?.ctype === 'offsite' ? () => openCheckinMap(p.userId, d) : undefined
                          }
                          title={c?.ctype === 'offsite' ? 'เปิดแผนที่จุดเช็คอิน' : undefined}
                          className={`inline-block h-4 w-4 rounded-sm ${cellClass(c)} ${
                            c?.ctype === 'offsite'
                              ? 'cursor-pointer hover:ring-2 hover:ring-purple-300'
                              : ''
                          }`}
                        />
                      </HelpTooltip>
                    </td>
                  )
                })}
                {(() => {
                  // คู่เลขต้องบวกกันได้เท่าวันที่แสดงของคนนั้น (30/31 ถ้าดูทั้งเดือน)
                  // "ไม่มา" รวมทุกอย่างที่ไม่ได้มา — แตกให้ดูข้างล่างว่าเป็นขาดจริง/ลา/หยุดกี่วัน
                  const missed = Math.max(0, p.sum.total - p.sum.present)
                  const off = Math.max(0, missed - p.sum.absent - p.sum.leave)
                  const breakdown = [
                    p.sum.absent > 0 && `ขาด ${p.sum.absent}`,
                    p.sum.leave > 0 && `ลา ${p.sum.leave}`,
                    off > 0 && `หยุด ${off}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <td
                      className={`whitespace-nowrap px-2 py-1 text-center ${
                        scrollMode ? 'sticky right-0 z-10 border-l border-l-gray-100 bg-white' : ''
                      }`}
                    >
                      <span className="font-semibold text-green-600">{p.sum.present}</span>
                      <span className="text-gray-300">/</span>
                      <span
                        className={
                          p.sum.absent > 0 ? 'font-semibold text-red-600' : 'text-gray-400'
                        }
                      >
                        {missed}
                      </span>
                      {breakdown && (
                        <span className="block text-[10px] leading-tight text-gray-400">
                          {breakdown}
                        </span>
                      )}
                    </td>
                  )
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
