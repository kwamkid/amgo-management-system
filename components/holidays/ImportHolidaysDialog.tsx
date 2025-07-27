// components/holidays/ImportHolidaysDialog.tsx

'use client'

import { useState, useEffect } from 'react'
import { PublicHolidayImport } from '@/types/holiday'
import { useToast } from '@/hooks/useToast'
import { 
  Calendar,
  Download,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Check
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { gradients } from '@/lib/theme/colors'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-red-600" />
                เลือกวันหยุดราชการ
              </CardTitle>
              <CardDescription>
                เลือกวันหยุดราชการประจำปี {year} ที่ต้องการนำเข้า
              </CardDescription>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-grow overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : publicHolidays.length === 0 ? (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ไม่พบข้อมูลวันหยุดราชการสำหรับปี {year}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  พบวันหยุดราชการ {publicHolidays.length} วัน 
                  {existingHolidays.length > 0 && ` (มีอยู่แล้ว ${existingHolidays.length} วัน)`}
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm font-medium">เลือกทั้งหมด</span>
                </label>
                <Badge variant="secondary">
                  เลือก {selectedHolidays.length} วัน
                </Badge>
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
                          onCheckedChange={() => toggleHoliday(holiday.date)}
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
                        <Badge variant="secondary" className="ml-2">
                          มีอยู่แล้ว
                        </Badge>
                      )}
                      {!isExisting && isSelected && (
                        <Check className="w-5 h-5 text-green-600 ml-2" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
        
        <div className="flex-shrink-0 border-t p-6 flex gap-3 justify-end">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={importing}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || loading || selectedHolidays.length === 0}
            className={`bg-gradient-to-r ${gradients.primary}`}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังนำเข้า...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                นำเข้า {selectedHolidays.length} วัน
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}