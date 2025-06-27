// components/locations/LocationForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { Location, LocationFormData, WorkingHours, Shift } from '@/types/location'
import { MapPin, Clock, Calendar, Plus, Trash2, Save, X, Building } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'

// Dynamic import for Google Maps (client-side only)
const LocationMapPicker = dynamic(
  () => import('./LocationMapPicker'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-600">Loading map...</p>
      </div>
    )
  }
)

interface LocationFormProps {
  initialData?: Location
  onSubmit: (data: LocationFormData) => Promise<boolean>
  onCancel: () => void
  isLoading?: boolean
}

const defaultWorkingHours: WorkingHours = {
  open: '10:00',
  close: '22:00',
  isClosed: false
}

const defaultShift: Omit<Shift, 'id'> = {
  name: '',
  startTime: '10:00',
  endTime: '18:00',
  graceMinutes: 15
}

const DAYS = [
  { key: 'monday', label: 'จันทร์' },
  { key: 'tuesday', label: 'อังคาร' },
  { key: 'wednesday', label: 'พุธ' },
  { key: 'thursday', label: 'พฤหัสบดี' },
  { key: 'friday', label: 'ศุกร์' },
  { key: 'saturday', label: 'เสาร์' },
  { key: 'sunday', label: 'อาทิตย์' }
] as const

// Preset configurations
const PRESET_HOURS = {
  departmentStore: {
    name: 'Department Store',
    label: 'ห้าง (ทุกวัน)',
    hours: {
      open: '10:00',
      close: '22:00',
      isClosed: false
    },
    applyDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  },
  standAlone: {
    name: 'Stand Alone Shop',
    label: 'ร้านค้า (ทุกวัน)',
    hours: {
      open: '10:00',
      close: '19:00',
      isClosed: false
    },
    applyDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  },
  office: {
    name: 'Office',
    label: 'สำนักงาน (จ-ศ)',
    hours: {
      open: '09:00',
      close: '18:00',
      isClosed: false
    },
    applyDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    closedDays: ['saturday', 'sunday']
  }
}

export default function LocationForm({ 
  initialData, 
  onSubmit, 
  onCancel,
  isLoading = false 
}: LocationFormProps) {
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    lat: 0,
    lng: 0,
    radius: 100,
    workingHours: {
      monday: { ...defaultWorkingHours },
      tuesday: { ...defaultWorkingHours },
      wednesday: { ...defaultWorkingHours },
      thursday: { ...defaultWorkingHours },
      friday: { ...defaultWorkingHours },
      saturday: { ...defaultWorkingHours },
      sunday: { ...defaultWorkingHours, isClosed: true }
    },
    shifts: [
      { ...defaultShift, name: 'กะเช้า', startTime: '10:00', endTime: '18:00' },
      { ...defaultShift, name: 'กะบ่าย', startTime: '14:00', endTime: '22:00' }
    ],
    breakHours: 1,
    isActive: true
  })

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        address: initialData.address,
        lat: initialData.lat,
        lng: initialData.lng,
        radius: initialData.radius,
        workingHours: initialData.workingHours,
        shifts: initialData.shifts.map(({ id, ...shift }) => shift),
        breakHours: initialData.breakHours,
        isActive: initialData.isActive
      })
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    if (!formData.name || !formData.address) {
      alert('กรุณากรอกชื่อและที่อยู่')
      return
    }
    
    if (formData.lat === 0 || formData.lng === 0) {
      alert('กรุณาเลือกตำแหน่งบนแผนที่')
      return
    }
    
    if (formData.shifts.length === 0) {
      alert('กรุณาเพิ่มกะการทำงานอย่างน้อย 1 กะ')
      return
    }
    
    await onSubmit(formData)
  }

  const handleAddShift = () => {
    setFormData({
      ...formData,
      shifts: [...formData.shifts, { ...defaultShift, name: `กะที่ ${formData.shifts.length + 1}` }]
    })
  }

  const handleRemoveShift = (index: number) => {
    setFormData({
      ...formData,
      shifts: formData.shifts.filter((_, i) => i !== index)
    })
  }

  const handleShiftChange = (index: number, field: keyof Omit<Shift, 'id'>, value: any) => {
    const newShifts = [...formData.shifts]
    newShifts[index] = { ...newShifts[index], [field]: value }
    setFormData({ ...formData, shifts: newShifts })
  }

  const handleWorkingHoursChange = (day: string, field: keyof WorkingHours, value: any) => {
    setFormData({
      ...formData,
      workingHours: {
        ...formData.workingHours,
        [day]: {
          ...formData.workingHours[day as keyof typeof formData.workingHours],
          [field]: value
        }
      }
    })
  }

  const applyPreset = (preset: 'departmentStore' | 'standAlone' | 'office') => {
    const presetConfig = PRESET_HOURS[preset]
    const newWorkingHours = {} as typeof formData.workingHours
    
    DAYS.forEach(({ key }) => {
      if ('closedDays' in presetConfig && presetConfig.closedDays?.includes(key)) {
        newWorkingHours[key as keyof typeof formData.workingHours] = {
          open: '10:00',
          close: '18:00',
          isClosed: true
        }
      } else if (presetConfig.applyDays.includes(key)) {
        newWorkingHours[key as keyof typeof formData.workingHours] = { ...presetConfig.hours }
      }
    })
    
    setFormData({
      ...formData,
      workingHours: newWorkingHours
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-600" />
            ข้อมูลพื้นฐาน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>ชื่อสถานที่ *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น สาขาสยาม"
                required
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Label>รัศมี Geofencing (เมตร)</Label>
              <Input
                type="number"
                value={formData.radius}
                onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) || 100 })}
                min="50"
                max="1000"
                step="50"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div>
            <Label>ที่อยู่ *</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="999 ถ.พระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <Label>ตำแหน่งบนแผนที่ *</Label>
            <LocationMapPicker
              lat={formData.lat}
              lng={formData.lng}
              radius={formData.radius}
              onLocationChange={(lat, lng) => {
                setFormData({ ...formData, lat, lng })
              }}
              onAddressChange={(address) => {
                setFormData(prev => ({ ...prev, address }))
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-600" />
              เวลาทำการ
            </CardTitle>
            
            {/* Preset Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPreset('office')}
                disabled={isLoading}
              >
                สำนักงาน
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPreset('departmentStore')}
                disabled={isLoading}
              >
                ห้าง
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPreset('standAlone')}
                disabled={isLoading}
              >
                ร้านค้า
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset info */}
          
          
          <div className="space-y-3">
            {DAYS.map(({ key, label }) => {
              const hours = formData.workingHours[key as keyof typeof formData.workingHours]
              return (
                <div key={key} className="flex items-center gap-4">
                  <Label className="w-20 font-medium">{label}</Label>
                  
                  <Checkbox
                    checked={!hours.isClosed}
                    onCheckedChange={(checked) => handleWorkingHoursChange(key, 'isClosed', !checked)}
                    disabled={isLoading}
                  />
                  
                  {!hours.isClosed && (
                    <>
                      <Input
                        type="time"
                        value={hours.open}
                        onChange={(e) => handleWorkingHoursChange(key, 'open', e.target.value)}
                        className="w-32"
                        disabled={isLoading}
                      />
                      <span className="text-gray-500">ถึง</span>
                      <Input
                        type="time"
                        value={hours.close}
                        onChange={(e) => handleWorkingHoursChange(key, 'close', e.target.value)}
                        className="w-32"
                        disabled={isLoading}
                      />
                    </>
                  )}
                  
                  {hours.isClosed && (
                    <Badge variant="error">ปิดทำการ</Badge>
                  )}
                </div>
              )
            })}
          </div>
          
          <div className="flex items-center gap-4 pt-4 border-t">
            <Label>เวลาพักกลางวัน</Label>
            <Input
              type="number"
              value={formData.breakHours}
              onChange={(e) => setFormData({ ...formData, breakHours: parseFloat(e.target.value) || 1 })}
              className="w-20"
              min="0"
              max="2"
              step="0.5"
              disabled={isLoading}
            />
            <span className="text-sm text-gray-500">ชั่วโมง</span>
          </div>
        </CardContent>
      </Card>

      {/* Shifts */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" />
              กะการทำงาน
            </CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={handleAddShift}
              variant="outline"
              disabled={isLoading}
            >
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มกะ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {formData.shifts.map((shift, index) => (
              <Card key={index} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Input
                      value={shift.name}
                      onChange={(e) => handleShiftChange(index, 'name', e.target.value)}
                      className="flex-1"
                      placeholder="ชื่อกะ"
                      disabled={isLoading}
                    />
                    
                    <Input
                      type="time"
                      value={shift.startTime}
                      onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
                      className="w-32"
                      disabled={isLoading}
                    />
                    
                    <span className="text-gray-500">-</span>
                    
                    <Input
                      type="time"
                      value={shift.endTime}
                      onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
                      className="w-32"
                      disabled={isLoading}
                    />
                    
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">±</span>
                      <Input
                        type="number"
                        value={shift.graceMinutes}
                        onChange={(e) => handleShiftChange(index, 'graceMinutes', parseInt(e.target.value) || 0)}
                        className="w-16"
                        min="0"
                        max="60"
                        disabled={isLoading}
                      />
                      <span className="text-sm text-gray-500">นาที</span>
                    </div>
                    
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveShift(index)}
                      disabled={isLoading || formData.shifts.length === 1}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <label className="flex items-center gap-3">
            <Checkbox
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
              disabled={isLoading}
            />
            <span className="font-medium text-gray-700">เปิดใช้งานสถานที่นี้</span>
          </label>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          <X className="w-4 h-4 mr-2" />
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className={`bg-gradient-to-r ${gradients.primary}`}
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </form>
  )
}