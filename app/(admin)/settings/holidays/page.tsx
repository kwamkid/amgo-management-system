// app/(admin)/settings/holidays/page.tsx

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button as AooButton, Alert, Pill, Card, CardContent, CardHeader, CardTitle, CardDescription, EmptyState, IconButton, SelectMenu, useConfirm, type PillTone } from '@/components/aoo'
import { PageHeader, DataTable, StatCard, FilterBar, FilterSelect } from '@/components/shared'
import { useRouter } from 'next/navigation'
import { useHolidays, useHolidayStats } from '@/hooks/useHolidays'
import { useLocations } from '@/hooks/useLocations'
import { HOLIDAY_TYPE_LABELS } from '@/types/holiday'
import ImportHolidaysDialog from '@/components/holidays/ImportHolidaysDialog'
import { 
  Calendar,
  Trash2,
  Sun,
  Briefcase,
  Star,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import TechLoader from '@/components/shared/TechLoader'
import TableFooter from '@/components/shared/TableFooter'
const TYPE_TONE: Record<string, PillTone> = { public: 'sky', company: 'accent', special: 'pink' }

export default function HolidaysPage() {
  const router = useRouter()
  const { confirm, dialog: confirmDialog } = useConfirm()
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
    const ok = await confirm({
      title: 'ลบวันหยุด',
      description: `ต้องการลบวันหยุด "${holidayName}" ใช่หรือไม่?`,
      confirmLabel: 'ลบ',
      tone: 'danger',
    })
    if (ok) {
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
        <StatCard label="ทั้งหมด" value={stats.total} icon={Calendar} tone="plum" />
        <StatCard label="วันหยุดราชการ" value={stats.public} icon={Sun} tone="sky" />
        <StatCard label="วันหยุดบริษัท" value={stats.company} icon={Briefcase} tone="accent" />
        <StatCard label="วันหยุดพิเศษ" value={stats.special} icon={Star} tone="pink" />
      </div>
      
      {/* Next Holiday Alert */}
      {stats.nextHoliday && (
        <Alert tone="info">
          <strong>วันหยุดถัดไป:</strong> {stats.nextHoliday.name} - {' '}
          {format(new Date(stats.nextHoliday.date), 'EEEE dd MMMM yyyy', { locale: th })}
        </Alert>
      )}
      
      {/* Filters */}
      <FilterBar search={searchTerm} onSearch={setSearchTerm} placeholder="ค้นหาชื่อวันหยุด..." sticky={false}>
        <div className="w-40">
          <SelectMenu
            value={selectedYear.toString()}
            options={[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => ({ value: year.toString(), label: year.toString() }))}
            onChange={(value) => { if (value) setSelectedYear(Number(value)) }}
          />
        </div>
        <FilterSelect
          label="ทุกประเภท"
          value={selectedType === 'all' ? null : selectedType}
          options={[
            { value: 'public', label: 'วันหยุดราชการ' },
            { value: 'company', label: 'วันหยุดบริษัท' },
            { value: 'special', label: 'วันหยุดพิเศษ' },
          ]}
          onChange={(v) => setSelectedType(v ?? 'all')}
          width={192}
        />
      </FilterBar>
      
      {/* Holidays Table */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Calendar} tone="plum">รายการวันหยุด</CardTitle>
          <CardDescription>
            วันหยุดทั้งหมดในปี {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredHolidays.length === 0 ? (
            <EmptyState
              icon={<Calendar size={40} />}
              title={searchTerm ? 'ไม่พบวันหยุดที่ค้นหา' : 'ยังไม่มีวันหยุด'}
              action={!searchTerm && (
                <AooButton onClick={() => setShowImportDialog(true)} variant="secondary" icon="Download">
                  นำเข้าวันหยุดราชการ
                </AooButton>
              )}
            />
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
                      <Pill tone={TYPE_TONE[holiday.type] ?? 'neutral'}>
                        {HOLIDAY_TYPE_LABELS[holiday.type]}
                      </Pill>
                    ),
                  },
                  {
                    key: 'working', header: 'การทำงาน',
                    cell: (holiday) =>
                      holiday.isWorkingDay ? (
                        <Pill tone="warning"><CheckCircle size={14} />ทำงาน</Pill>
                      ) : (
                        <Pill tone="neutral"><XCircle size={14} />หยุด</Pill>
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
                      <IconButton icon={Trash2} tone="danger" title="ลบ" onClick={() => handleDelete(holiday.id!, holiday.name)} />
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

      {confirmDialog}
    </div>
  )
}