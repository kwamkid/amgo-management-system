// components/holidays/HolidayForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { 
  Holiday, 
  HolidayFormData, 
  HOLIDAY_TYPE_LABELS,
  DEFAULT_OT_RATES 
} from '@/types/holiday'
import { useLocations } from '@/hooks/useLocations'
import { useToast } from '@/hooks/useToast'
import { 
  Calendar,
  Save,
  X,
  Loader2,
  Info,
  DollarSign,
  CalendarRange
} from 'lucide-react'
import { format, eachDayOfInterval, addDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'

interface HolidayFormProps {
  initialData?: Holiday
  onSubmit: (data: HolidayFormData) => Promise<boolean>
  onCancel: () => void
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'driver', label: 'Driver' }
]

export default function HolidayForm({ 
  initialData, 
  onSubmit, 
  onCancel 
}: HolidayFormProps) {
  const { showToast } = useToast()
  const { locations } = useLocations()
  const [loading, setLoading] = useState(false)
  const [useRangeDate, setUseRangeDate] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<HolidayFormData>({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'public',
    isWorkingDay: false,
    overtimeRates: DEFAULT_OT_RATES,
    applicableLocationIds: [],
    applicableRoles: [],
    description: '',
    recurring: false
  })
  
  // Additional state for date range
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        date: format(new Date(initialData.date), 'yyyy-MM-dd'),
        type: initialData.type,
        isWorkingDay: initialData.isWorkingDay,
        overtimeRates: initialData.overtimeRates || DEFAULT_OT_RATES,
        applicableLocationIds: initialData.applicableLocationIds || [],
        applicableRoles: initialData.applicableRoles || [],
        description: initialData.description || '',
        recurring: initialData.recurring || false,
        recurringDay: initialData.recurringDay,
        recurringMonth: initialData.recurringMonth
      })
    }
  }, [initialData])
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name.trim()) {
      showToast('กรุณาระบุชื่อวันหยุด', 'error')
      return
    }
    
    if (!formData.date) {
      showToast('กรุณาเลือกวันที่', 'error')
      return
    }
    
    if (useRangeDate && new Date(endDate) < new Date(formData.date)) {
      showToast('วันที่สิ้นสุดต้องมากกว่าวันที่เริ่มต้น', 'error')
      return
    }
    
    try {
      setLoading(true)
      
      if (useRangeDate) {
        // Create holidays for date range
        const dates = eachDayOfInterval({
          start: new Date(formData.date),
          end: new Date(endDate)
        })
        
        let successCount = 0
        for (const date of dates) {
          const holidayData = {
            ...formData,
            date: format(date, 'yyyy-MM-dd'),
            name: dates.length > 1 ? `${formData.name} (${format(date, 'dd/MM', { locale: th })})` : formData.name
          }
          
          const success = await onSubmit(holidayData)
          if (success) successCount++
        }
        
        if (successCount === dates.length) {
          showToast(`เพิ่มวันหยุด ${successCount} วันสำเร็จ`, 'success')
        } else if (successCount > 0) {
          showToast(`เพิ่มวันหยุดสำเร็จ ${successCount} จาก ${dates.length} วัน`, 'warning')
        } else {
          showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error')
        }
      } else {
        // Single holiday
        const success = await onSubmit(formData)
        if (!success) {
          showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error')
        }
      }
    } finally {
      setLoading(false)
    }
  }
  
  // Toggle location selection
  const toggleLocation = (locationId: string) => {
    setFormData(prev => ({
      ...prev,
      applicableLocationIds: prev.applicableLocationIds.includes(locationId)
        ? prev.applicableLocationIds.filter(id => id !== locationId)
        : [...prev.applicableLocationIds, locationId]
    }))
  }
  
  // Toggle role selection
  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      applicableRoles: prev.applicableRoles.includes(role)
        ? prev.applicableRoles.filter(r => r !== role)
        : [...prev.applicableRoles, role]
    }))
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-red-600" />
            ข้อมูลวันหยุด
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">ชื่อวันหยุด *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="เช่น วันสงกรานต์"
              required
            />
          </div>
          
          {/* Date Range Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="useRangeDate"
              checked={useRangeDate}
              onCheckedChange={setUseRangeDate}
            />
            <Label htmlFor="useRangeDate" className="cursor-pointer flex items-center gap-2">
              <CalendarRange className="w-4 h-4" />
              เพิ่มช่วงวันหยุด
            </Label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">{useRangeDate ? 'วันที่เริ่มต้น' : 'วันที่'} *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>
            
            {useRangeDate && (
              <div>
                <Label htmlFor="endDate">วันที่สิ้นสุด *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={formData.date}
                  required
                />
              </div>
            )}
          </div>
          
          {useRangeDate && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                ระบบจะสร้างวันหยุดสำหรับทุกวันในช่วงที่กำหนด โดยจะเพิ่มวันที่ต่อท้ายชื่อวันหยุด
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">ประเภทวันหยุด</Label>
              <Select
                value={formData.type}
                onValueChange={(value: Holiday['type']) => setFormData({...formData, type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HOLIDAY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isWorkingDay"
                  checked={formData.isWorkingDay}
                  onCheckedChange={(checked) => setFormData({...formData, isWorkingDay: checked})}
                />
                <Label htmlFor="isWorkingDay" className="cursor-pointer">
                  วันหยุดทำการ
                </Label>
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">รายละเอียด</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* OT Rates */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            อัตรา OT สำหรับวันหยุด
          </CardTitle>
          <CardDescription>
            กำหนดอัตราค่าล่วงเวลาสำหรับแต่ละประเภทพนักงาน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="ot-office">Office</Label>
              <div className="relative">
                <Input
                  id="ot-office"
                  type="number"
                  step="0.5"
                  min="1"
                  value={formData.overtimeRates.office}
                  onChange={(e) => setFormData({
                    ...formData,
                    overtimeRates: {
                      ...formData.overtimeRates,
                      office: parseFloat(e.target.value) || 1
                    }
                  })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">x</span>
              </div>
            </div>

            <div>
              <Label htmlFor="ot-retail">Retail</Label>
              <div className="relative">
                <Input
                  id="ot-retail"
                  type="number"
                  step="0.5"
                  min="1"
                  value={formData.overtimeRates.retail}
                  onChange={(e) => setFormData({
                    ...formData,
                    overtimeRates: {
                      ...formData.overtimeRates,
                      retail: parseFloat(e.target.value) || 1
                    }
                  })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">x</span>
              </div>
            </div>

            <div>
              <Label htmlFor="ot-driver">Driver</Label>
              <div className="relative">
                <Input
                  id="ot-driver"
                  type="number"
                  step="0.5"
                  min="1"
                  value={formData.overtimeRates.driver}
                  onChange={(e) => setFormData({
                    ...formData,
                    overtimeRates: {
                      ...formData.overtimeRates,
                      driver: parseFloat(e.target.value) || 1
                    }
                  })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">x</span>
              </div>
            </div>

            <div>
              <Label htmlFor="ot-marketing">Marketing</Label>
              <div className="relative">
                <Input
                  id="ot-marketing"
                  type="number"
                  step="0.5"
                  min="1"
                  value={formData.overtimeRates.marketing}
                  onChange={(e) => setFormData({
                    ...formData,
                    overtimeRates: {
                      ...formData.overtimeRates,
                      marketing: parseFloat(e.target.value) || 1
                    }
                  })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">x</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Applicable Locations */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>สาขาที่ใช้</CardTitle>
          <CardDescription>
            เลือกสาขาที่ใช้วันหยุดนี้ (ไม่เลือก = ทุกสาขา)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                ยังไม่มีข้อมูลสาขา
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {locations.map(location => (
                <label
                  key={location.id}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <Checkbox
                    checked={formData.applicableLocationIds.includes(location.id)}
                    onCheckedChange={(checked: boolean) => toggleLocation(location.id)}
                  />
                  <span className="text-sm">{location.name}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Applicable Roles */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>ประเภทพนักงานที่ใช้</CardTitle>
          <CardDescription>
            เลือกประเภทพนักงานที่ใช้วันหยุดนี้ (ไม่เลือก = ทุกประเภท)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ROLES.map(role => (
              <label
                key={role.value}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <Checkbox
                  checked={formData.applicableRoles.includes(role.value)}
                  onCheckedChange={(checked: boolean) => toggleRole(role.value)}
                />
                <span className="text-sm">{role.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          <X className="w-4 h-4 mr-2" />
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className={`bg-gradient-to-r ${gradients.primary}`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              สร้างวันหยุด
            </>
          )}
        </Button>
      </div>
    </form>
  )
}