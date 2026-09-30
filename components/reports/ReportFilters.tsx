// components/reports/ReportFilters.tsx

'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { Users } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { DateRangePicker, Input, SelectMenu, Spinner } from '@/components/aoo'
import FilterCard, { FilterField } from '@/components/shared/FilterCard'
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
    // ไม่มีปุ่มดูข้อมูล: เปลี่ยนอะไรระบบอัปเดตให้เอง · วงหมุนด้านขวาบอกว่ากำลังดึง
    <FilterCard actions={loading ? <Spinner size="xs" /> : undefined}>
      <FilterField label="ช่วงเวลา" width={280}>
        <DateRangePicker
          value={{ since: startDate, until: endDate }}
          onChange={(v) => { if (v) { setStartDate(v.since); setEndDate(v.until) } }}
          clearable={false}
          className="w-full"
        />
      </FilterField>

      {/* สาขา — SelectMenu ของชุดกลาง ค้นหาได้เองเมื่อมีหลายสาขา */}
      <FilterField label="สถานที่" width={220}>
        <SelectMenu
          value={selectedLocation || null}
          onChange={(v) => setSelectedLocation(v ?? '')}
          options={[{ value: '', label: 'ทั้งหมด' }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
          placeholder="ทั้งหมด"
          clearable={false}
          searchThreshold={8}
        />
      </FilterField>

      {/* พนักงาน — พิมพ์แล้วกรองสดทันทีจากข้อมูลที่ดึงไว้ ไม่ยิง query */}
      <FilterField label="พนักงาน" width={320}>
        <Input
          prefix={<Users size={14} />}
          value={userSearchTerm}
          onChange={(e) => setUserSearchTerm(e.target.value)}
          placeholder="พิมพ์ชื่อ/ชื่อเล่น — กรองทันที · ว่าง = ทั้งหมด"
        />
      </FilterField>
    </FilterCard>
  )
}
