// app/(admin)/settings/holidays/page.tsx

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button as AooButton, Input, Alert, Pill, badgeTone, Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Select } from '@/components/aoo'
import { PageHeader, DataTable } from '@/components/shared'
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
import TechLoader from '@/components/shared/TechLoader'
import { gradients } from '@/lib/theme/colors'
import TableFooter from '@/components/shared/TableFooter'
export default function HolidaysPage() {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  
  // States
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showImportDialog, setShowImportDialog] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  // Hooks
  const { holidays, loading, deleteHoliday, importPublicHolidays } = useHolidays({
    year: selectedYear,
    type: selectedType === 'all' ? undefined : selectedType as any,
    isActive: true
  })
  const { stats } = useHolidayStats(selectedYear)
  const { locations } = useLocations()
  
  // Filter holidays by search term
  const filteredHolidays = useMemo(() => {
    return holidays.filter(holiday => {
      const matchesSearch = holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           holiday.description?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [holidays, searchTerm])

  // Pagination calculations
  const totalPages = Math.ceil(filteredHolidays.length / itemsPerPage)
  const paginatedHolidays = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredHolidays.slice(start, end)
  }, [filteredHolidays, currentPage, itemsPerPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedYear, selectedType])
  
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
      <PageHeader
        title="จัดการวันหยุด"
        description="กำหนดวันหยุดประจำปีและอัตรา OT"
        icon={Calendar}
        actions={
          <>
            <AooButton variant="secondary" size="sm" icon="Download"
              onClick={() => setShowImportDialog(true)}>
              นำเข้าวันหยุดราชการ
            </AooButton>
            <AooButton size="sm" icon="Plus"
              onClick={() => router.push('/settings/holidays/create')}>
              เพิ่มวันหยุด
            </AooButton>
          </>
        }
      />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding={0}>
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
        
        <Card padding={0}>
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
        
        <Card padding={0}>
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
        
        <Card padding={0}>
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
        <Alert tone="info">
          <div className="text-red-800">
            <strong>วันหยุดถัดไป:</strong> {stats.nextHoliday.name} - {' '}
            {format(new Date(stats.nextHoliday.date), 'EEEE dd MMMM yyyy', { locale: th })}
          </div>
        </Alert>
      )}
      
      {/* Filters */}
      <Card padding={0}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
                            <Input
                prefix={<Search size={16} />}
                type="text"
                placeholder="ค้นหาชื่อวันหยุด..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select
              value={selectedYear.toString()}
              onChange={(e) => ((value) => setSelectedYear(Number(value)))(e.target.value)}
             className="w-40">
              
              
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              
            </Select>
            
            <Select
              value={selectedType}
              onChange={(e) => (setSelectedType)(e.target.value)}
             className="w-48">
              
              
                <option value="all">ทุกประเภท</option>
                <option value="public">วันหยุดราชการ</option>
                <option value="company">วันหยุดบริษัท</option>
                <option value="special">วันหยุดพิเศษ</option>
              
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Holidays Table */}
      <Card padding={0}>
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
                <Button onClick={() => setShowImportDialog(true)}
 variant="secondary"
 className="mt-4 cursor-pointer">
                  <Download className="w-5 h-5 mr-2" />
                  นำเข้าวันหยุดราชการ
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable
                columns={[
                  { key: 'date', header: 'วันที่', cell: (holiday) => format(new Date(holiday.date), 'dd MMM yyyy', { locale: th }), sortValue: (holiday) => new Date(holiday.date).getTime(), mobilePrimary: true },
                  {
                    key: 'name', header: 'ชื่อวันหยุด', sortValue: (holiday) => holiday.name,
                    cell: (holiday) => (
                      <div className="font-medium">
                        {holiday.name}
                        {holiday.description && <p className="text-sm font-normal text-gray-500">{holiday.description}</p>}
                      </div>
                    ),
                  },
                  {
                    key: 'type', header: 'ประเภท',
                    cell: (holiday) => (
                      <Pill tone={badgeTone(holiday.type === 'public' ? 'info' : holiday.type === 'company' ? 'success' : 'secondary')}>
                        {HOLIDAY_TYPE_LABELS[holiday.type]}
                      </Pill>
                    ),
                  },
                  {
                    key: 'working', header: 'การทำงาน',
                    cell: (holiday) =>
                      holiday.isWorkingDay ? (
                        <Pill tone="warning"><CheckCircle className="w-4 h-4 mr-1" />ทำงาน</Pill>
                      ) : (
                        <Pill tone="neutral"><XCircle className="w-4 h-4 mr-1" />หยุด</Pill>
                      ),
                  },
                  {
                    key: 'ot', header: 'OT Rate', hideOnMobile: true,
                    cell: (holiday) =>
                      holiday.overtimeRates ? (
                        <div className="text-sm space-y-1">
                          <div>Office: {holiday.overtimeRates.office}x</div>
                          <div>Retail: {holiday.overtimeRates.retail}x</div>
                        </div>
                      ) : null,
                  },
                  {
                    key: 'branches', header: 'สาขา', hideOnMobile: true,
                    cell: (holiday) =>
                      holiday.applicableLocationIds && holiday.applicableLocationIds.length > 0 ? (
                        <Pill tone="neutral">{holiday.applicableLocationIds.length} สาขา</Pill>
                      ) : (
                        <Pill tone="success">ทุกสาขา</Pill>
                      ),
                  },
                  {
                    key: 'actions', header: '', align: 'right', mobileFooterAction: true,
                    cell: (holiday) => (
                      <Button onClick={() => handleDelete(holiday.id!, holiday.name)} variant="ghost" size="sm" aria-label="ลบ">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ),
                  },
                ]}
                rows={paginatedHolidays}
                rowKey={(holiday) => holiday.id!}
                emptyTitle="ไม่มีวันหยุด"
              />

              {/* Pagination */}
              {filteredHolidays.length > 0 && (
                <div className="mt-4">
                  <TableFooter page={currentPage} pageSize={itemsPerPage} total={filteredHolidays.length} onPageChange={setCurrentPage} onPageSizeChange={setItemsPerPage} />
                </div>
              )}
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