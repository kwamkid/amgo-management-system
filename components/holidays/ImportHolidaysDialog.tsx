// components/holidays/ImportHolidaysDialog.tsx

'use client'

import { useState, useEffect } from 'react'
import { PublicHolidayImport } from '@/types/holiday'
import { useToast } from '@/hooks/useToast'
import { Check } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Checkbox, Alert, Pill, Button, Modal, Spinner } from '@/components/aoo'
interface ImportHolidaysDialogProps {
  year: number
  existingHolidays: string[] // existing holiday dates
  onImport: (holidays: PublicHolidayImport[]) => Promise<boolean>
  onClose: () => void
}

export default function ImportHolidaysDialog({
  year,
  existingHolidays,
  onImport,
  onClose
}: ImportHolidaysDialogProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [publicHolidays, setPublicHolidays] = useState<PublicHolidayImport[]>([])
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Fetch public holidays from API
  useEffect(() => {
    const fetchPublicHolidays = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/holidays/public?year=${year}`)
        
        if (!response.ok) {
          throw new Error('ไม่สามารถดึงข้อมูลวันหยุดราชการได้')
        }
        
        const data = await response.json()
        setPublicHolidays(data)
        
        // Auto-select holidays that don't exist yet
        const newHolidays = data.filter((h: PublicHolidayImport) => 
          !existingHolidays.includes(h.date)
        ).map((h: PublicHolidayImport) => h.date)
        
        setSelectedHolidays(newHolidays)
        setSelectAll(newHolidays.length === data.length)
        
      } catch (error) {
        console.error('Error fetching public holidays:', error)
        showToast('ไม่สามารถดึงข้อมูลวันหยุดราชการได้', 'error')
      } finally {
        setLoading(false)
      }
    }

    fetchPublicHolidays()
  }, [year, existingHolidays])

  // Toggle holiday selection
  const toggleHoliday = (date: string) => {
    setSelectedHolidays(prev => {
      if (prev.includes(date)) {
        return prev.filter(d => d !== date)
      } else {
        return [...prev, date]
      }
    })
  }

  // Toggle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedHolidays([])
    } else {
      setSelectedHolidays(publicHolidays.map(h => h.date))
    }
    setSelectAll(!selectAll)
  }

  // Handle import
  const handleImport = async () => {
    if (selectedHolidays.length === 0) {
      showToast('กรุณาเลือกวันหยุดที่ต้องการนำเข้า', 'error')
      return
    }

    setImporting(true)
    try {
      const holidaysToImport = publicHolidays.filter(h => 
        selectedHolidays.includes(h.date)
      )
      
      const success = await onImport(holidaysToImport)
      
      if (success) {
        showToast(`นำเข้าวันหยุด ${holidaysToImport.length} วันสำเร็จ`, 'success')
        onClose()
      }
    } catch (error) {
      console.error('Import error:', error)
      showToast('เกิดข้อผิดพลาดในการนำเข้าวันหยุด', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth={672}
      title="เลือกวันหยุดราชการ"
      description={`เลือกวันหยุดราชการประจำปี ${year} ที่ต้องการนำเข้า`}
      footer={
        <>
          <Button onClick={onClose} variant="soft" disabled={importing}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleImport}
            variant="primary"
            icon="Download"
            loading={importing}
            disabled={loading || selectedHolidays.length === 0}
          >
            {importing ? 'กำลังนำเข้า...' : `นำเข้า ${selectedHolidays.length} วัน`}
          </Button>
        </>
      }
    >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : publicHolidays.length === 0 ? (
            <Alert tone="warning">
              ไม่พบข้อมูลวันหยุดราชการสำหรับปี {year}
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert tone="info">
                พบวันหยุดราชการ {publicHolidays.length} วัน 
                {existingHolidays.length > 0 && ` (มีอยู่แล้ว ${existingHolidays.length} วัน)`}
              </Alert>

              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                  <span className="text-sm font-medium">เลือกทั้งหมด</span>
                </label>
                <Pill tone="neutral">
                  เลือก {selectedHolidays.length} วัน
                </Pill>
              </div>

              <div className="space-y-2">
                {publicHolidays.map(holiday => {
                  const isExisting = existingHolidays.includes(holiday.date)
                  const isSelected = selectedHolidays.includes(holiday.date)
                  
                  return (
                    <div
                      key={holiday.date}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isExisting 
                          ? 'bg-gray-50 border-gray-200' 
                          : isSelected 
                            ? 'bg-red-50 border-red-200' 
                            : 'bg-white border-gray-200'
                      }`}
                    >
                      <label className="flex items-center space-x-3 cursor-pointer flex-grow">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleHoliday(holiday.date)}
                          disabled={isExisting}
                        />
                        <div className="flex-grow">
                          <p className={`font-medium ${isExisting ? 'text-gray-400' : 'text-gray-900'}`}>
                            {holiday.name}
                          </p>
                          <p className={`text-sm ${isExisting ? 'text-gray-400' : 'text-gray-600'}`}>
                            {format(new Date(holiday.date), 'EEEE dd MMMM yyyy', { locale: th })}
                          </p>
                        </div>
                      </label>
                      
                      {isExisting && (
                        <Pill tone="neutral" className="ml-2">
                          มีอยู่แล้ว
                        </Pill>
                      )}
                      {!isExisting && isSelected && (
                        <Check size={20} className="text-green-600 ml-2" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
    </Modal>
  )
}
