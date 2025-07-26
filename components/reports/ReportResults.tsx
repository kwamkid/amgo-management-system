// components/reports/ReportResults.tsx

'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { AttendanceReportData, AttendanceReportFilters } from '@/lib/services/reportService'

interface ReportResultsProps {
  reportData: AttendanceReportData[]
  summaryData: any[]
  loading: boolean
  filters: AttendanceReportFilters | null
}

export default function ReportResults({ 
  reportData, 
  summaryData,
  loading,
  filters
}: ReportResultsProps) {
  const [activeTab, setActiveTab] = useState('daily')
  
  // Empty State
  if (!loading && reportData.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            เลือกช่วงเวลาและกดปุ่ม "สร้างรายงาน" เพื่อดูข้อมูล
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
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            ผลลัพธ์รายงาน ({reportData.length} รายการ)
          </CardTitle>
          {filters && (
            <Badge variant="secondary">
              {format(filters.startDate, 'dd MMM', { locale: th })} - 
              {format(filters.endDate, 'dd MMM yyyy', { locale: th })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">รายวัน</TabsTrigger>
            <TabsTrigger value="summary">สรุปรายคน</TabsTrigger>
          </TabsList>
          
          {/* Daily Report */}
          <TabsContent value="daily" className="mt-4">
            <DailyReportTable data={reportData} />
          </TabsContent>
          
          {/* Summary Report */}
          <TabsContent value="summary" className="mt-4">
            <SummaryReportTable data={summaryData} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Daily Report Table Component
function DailyReportTable({ data }: { data: AttendanceReportData[] }) {
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record, index) => (
            <TableRow key={index}>
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
              <TableCell>{record.locationName || 'นอกสถานที่'}</TableCell>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Summary Report Table Component
function SummaryReportTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ชื่อพนักงาน</TableHead>
            <TableHead className="text-center">วันทำงาน</TableHead>
            <TableHead className="text-center">วันขาด</TableHead>
            <TableHead className="text-center">วันสาย</TableHead>
            <TableHead className="text-center">รวมชั่วโมง</TableHead>
            <TableHead className="text-center">เฉลี่ย/วัน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((summary, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {summary.userName}
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