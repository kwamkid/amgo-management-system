// app/(admin)/settings/holidays/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useHolidays, useHolidayStats } from '@/hooks/useHolidays'
import { useLocations } from '@/hooks/useLocations'
import { HOLIDAY_TYPE_LABELS } from '@/types/holiday'
import ImportHolidaysDialog from '@/components/holidays/ImportHolidaysDialog'
import { 
  Calendar,
  Plus,
  Upload,
  Search,
  Trash2,
  Sun,
  Briefcase,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Download
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import TechLoader from '@/components/shared/TechLoader'
import { gradients } from '@/lib/theme/colors'

export default function HolidaysPage() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  
  // States
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)
  
  // Hooks
  const { holidays, loading, deleteHoliday, importPublicHolidays } = useHolidays({
    year: selectedYear,
    type: selectedType === 'all' ? undefined : selectedType as any,
    isActive: true
  })
  const { stats } = useHolidayStats(selectedYear)
  const { locations } = useLocations()
  
  // Filter holidays by search term
  const filteredHolidays = holidays.filter(holiday => {
    const matchesSearch = holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         holiday.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })
  
  // Get existing holiday dates for comparison
  const existingHolidayDates = holidays.map(h => 
    format(new Date(h.date), 'yyyy-MM-dd')
  )
  
  // Handle delete
  const handleDelete = async (holidayId: string, holidayName: string) => {
    if (confirm(`ต้องการลบวันหยุด "${holidayName}" ใช่หรือไม่?`)) {
      await deleteHoliday(holidayId)
    }
  }
  
  if (loading) {
    return <TechLoader />
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            จัดการวันหยุด
          </h1>
          <p className="text-gray-600 mt-1">
            กำหนดวันหยุดประจำปีและอัตรา OT
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setShowImportDialog(true)}
            variant="outline"
            className="cursor-pointer"
          >
            <Download className="w-5 h-5 mr-2" />
            นำเข้าวันหยุดราชการ
          </Button>
          <Button
            onClick={() => router.push('/settings/holidays/create')}
            className={`bg-gradient-to-r ${gradients.primary} cursor-pointer`}
          >
            <Plus className="w-5 h-5 mr-2" />
            เพิ่มวันหยุด
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.primaryLight} rounded-xl`}>
                <Calendar className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">วันหยุดราชการ</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.public}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.infoLight} rounded-xl`}>
                <Sun className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">วันหยุดบริษัท</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.company}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.successLight} rounded-xl`}>
                <Briefcase className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">วันหยุดพิเศษ</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{stats.special}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.purpleLight} rounded-xl`}>
                <Star className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Next Holiday Alert */}
      {stats.nextHoliday && (
        <Alert className="border-red-200 bg-red-50">
          <Calendar className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>วันหยุดถัดไป:</strong> {stats.nextHoliday.name} - {' '}
            {format(new Date(stats.nextHoliday.date), 'EEEE dd MMMM yyyy', { locale: th })}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="ค้นหาชื่อวันหยุด..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={selectedType}
              onValueChange={setSelectedType}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="public">วันหยุดราชการ</SelectItem>
                <SelectItem value="company">วันหยุดบริษัท</SelectItem>
                <SelectItem value="special">วันหยุดพิเศษ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Holidays Table */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>รายการวันหยุด</CardTitle>
          <CardDescription>
            วันหยุดทั้งหมดในปี {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredHolidays.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'ไม่พบวันหยุดที่ค้นหา' : 'ยังไม่มีวันหยุด'}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setShowImportDialog(true)}
                  variant="outline"
                  className="mt-4 cursor-pointer"
                >
                  <Download className="w-5 h-5 mr-2" />
                  นำเข้าวันหยุดราชการ
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ชื่อวันหยุด</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>การทำงาน</TableHead>
                    <TableHead>OT Rate</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHolidays.map(holiday => (
                    <TableRow key={holiday.id}>
                      <TableCell>
                        {format(new Date(holiday.date), 'dd MMM yyyy', { locale: th })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {holiday.name}
                        {holiday.description && (
                          <p className="text-sm text-gray-500">{holiday.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          holiday.type === 'public' ? 'info' : 
                          holiday.type === 'company' ? 'success' : 
                          'secondary'
                        }>
                          {HOLIDAY_TYPE_LABELS[holiday.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {holiday.isWorkingDay ? (
                          <Badge variant="warning">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            ทำงาน
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-4 h-4 mr-1" />
                            หยุด
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {holiday.overtimeRates && (
                          <div className="text-sm space-y-1">
                            <div>Office: {holiday.overtimeRates.office}x</div>
                            <div>Retail: {holiday.overtimeRates.retail}x</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {holiday.applicableLocationIds && holiday.applicableLocationIds.length > 0 ? (
                          <Badge variant="outline">
                            {holiday.applicableLocationIds.length} สาขา
                          </Badge>
                        ) : (
                          <Badge variant="success">ทุกสาขา</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleDelete(holiday.id!, holiday.name)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Import Dialog */}
      {showImportDialog && (
        <ImportHolidaysDialog
          year={selectedYear}
          existingHolidays={existingHolidayDates}
          onImport={(holidays) => importPublicHolidays(holidays, selectedYear)}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  )
}