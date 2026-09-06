// components/reports/ReportFilters.tsx

'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { Loader2, Users, Search, MapPin, Check } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { DateRangePicker, Label, Pill, Card, CardContent, CardHeader, CardTitle, Button, Select, SelectMenu } from '@/components/aoo'
import { useLocations } from '@/hooks/useLocations'
import { useUsers } from '@/hooks/useUsers'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import {
  getReportDataset,
  buildReportView,
  type ReportDataset,
  AttendanceReportData,
  AttendanceReportFilters,
  AttendanceReportResponse
} from '@/lib/services/reportService'

interface ReportFiltersProps {
  onGenerateReport: (
    data: AttendanceReportData[],
    summary: any[],
    filters: AttendanceReportFilters,
    pagination?: AttendanceReportResponse['pagination'],
    /** แถวเต็มช่วงหลังกรองคน/สาขา (รวมวันขาด) — ให้แท็บตารางวันใช้โดยไม่ต้อง query เอง */
    fullRows?: AttendanceReportData[]
  ) => void
  onLoadingChange: (loading: boolean) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
}

export default function ReportFilters({
  onGenerateReport,
  onLoadingChange,
  pageSize,
}: ReportFiltersProps) {
  const { locations } = useLocations()
  // เฉพาะพนักงานปัจจุบัน — คนที่ออกแล้วไม่ขึ้นในตัวเลือก (ประวัติยังอยู่ในรายงานตามข้อมูลจริง)
  const { users } = useUsers({ isActive: true, pageSize: 200 })
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [userSearchTerm, setUserSearchTerm] = useState('')

  // ก้อนข้อมูลเต็มช่วง (ไม่กรองคน/สาขา) — ดึงครั้งเดียวต่อช่วงวันที่ แล้วกรองสดในเบราว์เซอร์
  const datasetRef = React.useRef<{ key: string; dataset: ReportDataset } | null>(null)

  // สาขา → รายชื่อคนที่สังกัด (user_allowed_locations) — ตารางเล็ก ดึงครั้งเดียวพอ
  const [usersByLocation, setUsersByLocation] = useState<Map<string, Set<string>>>(new Map())
  useEffect(() => {
    createClient()
      .from('user_allowed_locations')
      .select('user_id, location_id')
      .then(({ data }) => {
        const m = new Map<string, Set<string>>()
        for (const r of data ?? []) {
          if (!m.has(r.location_id)) m.set(r.location_id, new Set())
          m.get(r.location_id)!.add(r.user_id)
        }
        setUsersByLocation(m)
      })
  }, [])

  /** กรอง+ตัดหน้า จากก้อน cache — งานในเบราว์เซอร์ล้วน ๆ เร็วพอทำทุกตัวอักษรที่พิมพ์ */
  const applyView = (page: number, size: number = pageSize) => {
    const cached = datasetRef.current
    if (!cached) return

    // พิมพ์ชื่อ = กรองทุกคนที่ชื่อ/ชื่อเล่น/เบอร์เข้าเค้า — ว่าง = ทั้งหมด
    const q = userSearchTerm.trim().toLowerCase()
    const matchedIds = q
      ? users
          .filter(
            (u) =>
              u.fullName?.toLowerCase().includes(q) ||
              u.nickname?.toLowerCase().includes(q) ||
              u.phone?.includes(q)
          )
          .map((u) => u.id!)
      : []

    const view = buildReportView(cached.dataset, {
      // พิมพ์แล้วไม่เจอใคร = ผลว่าง (ไม่ toast — เดี๋ยวพิมพ์ต่อก็เจอ)
      userIds: q ? (matchedIds.length ? matchedIds : ['__none__']) : undefined,
      locationUserIds: selectedLocation ? (usersByLocation.get(selectedLocation) ?? new Set()) : null,
      page,
      pageSize: size,
    })

    const filters: AttendanceReportFilters = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      userIds: matchedIds.length > 0 ? matchedIds : undefined,
      locationId: selectedLocation || undefined,
      page,
      pageSize: size,
      // แสดงทุกวันเสมอ — วันขาดคือสิ่งที่ HR ต้องเห็น (checkbox เฉพาะวันที่มา ถูกถอดแล้ว)
      showOnlyPresent: false,
    }

    onGenerateReport(view.data, view.summary || [], filters, view.pagination, view.fullRows)
  }

  const generateReport = async (page: number = 1, size?: number, force = false) => {
    const key = `${startDate}|${endDate}`

    // ช่วงวันที่เดิม + มี cache = ไม่ต้อง query — กรองจากของที่มีทันที
    if (!force && datasetRef.current?.key === key) {
      applyView(page, size)
      return
    }

    try {
      setLoading(true)
      onLoadingChange(true)
      const dataset = await getReportDataset({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      datasetRef.current = { key, dataset }
      applyView(page, size)
    } catch (error: any) {
      showToast(error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error')
    } finally {
      setLoading(false)
      onLoadingChange(false)
    }
  }

  // เลือกช่วงเวลาแล้วดึงเลย — ไม่มีปุ่ม "ดูข้อมูล" แล้ว (เจ้าของสั่ง 15 ส.ค. 69)
  // ครอบคลุมโหลดครั้งแรกด้วย (เดือนปัจจุบัน) · หน่วงกันยิงซ้ำตอน picker เซ็ตวันสองครั้ง
  React.useEffect(() => {
    const t = setTimeout(() => generateReport(1), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  // เปลี่ยนตัวกรองคน/สาขา → กรองสดจาก cache ทันที ไม่มี query เกิดขึ้นเลย
  // หน่วงนิดเดียวกันงานถี่ตอนพิมพ์รัว
  React.useEffect(() => {
    if (!datasetRef.current) return
    const t = setTimeout(() => applyView(1), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearchTerm, selectedLocation])

  // Expose generateReport to parent via window (เปลี่ยนหน้า/ขนาดหน้า/บังคับดึงใหม่หลังแก้ข้อมูล)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__generateReport = generateReport
    }
  }, [startDate, endDate, userSearchTerm, selectedLocation, pageSize, users, usersByLocation])

  return (
    <Card padding={0}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">ตัวกรองข้อมูล</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date + Location + User — ไม่มีปุ่มดูข้อมูล: เปลี่ยนอะไรระบบอัปเดตให้เอง */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* Date range picker */}
          <div>
            <Label className="text-gray-500 mb-1">ช่วงเวลา</Label>
            <DateRangePicker
              value={{ since: startDate, until: endDate }}
              onChange={(v) => { if (v) { setStartDate(v.since); setEndDate(v.until) } }}
              clearable={false}
              className="w-full"
            />
          </div>

          {/* Location filter — combobox when >7, plain select otherwise */}
          <div>
            <Label className="text-gray-500 mb-1">สถานที่</Label>
            {/* สาขา — SelectMenu ของชุดกลาง ค้นหาได้เองเมื่อมีหลายสาขา (แทน combobox ที่เขียนเองด้วย Popover) */}
            <SelectMenu
              value={selectedLocation || null}
              onChange={(v) => setSelectedLocation(v ?? '')}
              options={[{ value: '', label: 'ทั้งหมด' }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
              placeholder="ทั้งหมด"
              clearable={false}
              searchThreshold={8}
            />
          </div>

          {/* User filter — พิมพ์แล้วกรองสดทันทีจากข้อมูลที่ดึงไว้ ไม่ยิง query */}
          <div>
            <Label className="text-gray-500 mb-1">พนักงาน</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="พิมพ์ชื่อ/ชื่อเล่น — กรองทันที · ว่าง = ทั้งหมด"
                className="h-[42px] w-full rounded-md border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-red-400"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
