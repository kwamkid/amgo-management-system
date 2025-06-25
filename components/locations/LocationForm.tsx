// components/locations/LocationForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { Location, LocationFormData, WorkingHours, Shift } from '@/types/location'
import { MapPin, Clock, Calendar, Plus, Trash2, Save, X } from 'lucide-react'
import dynamic from 'next/dynamic'

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
        // วันที่ปิดทำการ
        newWorkingHours[key as keyof typeof formData.workingHours] = {
          open: '10:00',
          close: '18:00',
          isClosed: true
        }
      } else if (presetConfig.applyDays.includes(key)) {
        // วันที่เปิดทำการ
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
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
          <MapPin className="w-5 h-5 text-red-600" />
          ข้อมูลพื้นฐาน
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-1 text-gray-700">ชื่อสถานที่ *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
              placeholder="เช่น สาขาสยาม"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-1 text-gray-700">รัศมี Geofencing (เมตร)</label>
            <input
              type="number"
              value={formData.radius}
              onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) || 100 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
              min="50"
              max="1000"
              step="50"
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-base font-medium mb-1 text-gray-700">ที่อยู่ *</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
            placeholder="999 ถ.พระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330"
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="mt-4">
          <label className="block text-base font-medium mb-2 text-gray-700">ตำแหน่งบนแผนที่ *</label>
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
      </div>

      {/* Working Hours */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
            <Calendar className="w-5 h-5 text-red-600" />
            เวลาทำการ
          </h3>
          
          {/* Preset Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyPreset('office')}
              className="text-sm px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              disabled={isLoading}
            >
              <span className="font-medium">สำนักงาน</span>
              <span className="text-xs text-gray-500 ml-1">(จ-ศ)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('departmentStore')}
              className="text-sm px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              disabled={isLoading}
            >
              <span className="font-medium">ห้าง</span>
              <span className="text-xs text-gray-500 ml-1">(ทุกวัน)</span>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('standAlone')}
              className="text-sm px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              disabled={isLoading}
            >
              <span className="font-medium">ร้านค้า</span>
              <span className="text-xs text-gray-500 ml-1">(ทุกวัน)</span>
            </button>
          </div>
        </div>
        {/* Preset info */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-1">Preset เวลาทำการ:</p>
          <ul className="space-y-1 text-sm">
            <li>• <span className="font-medium">สำนักงาน:</span> จันทร์-ศุกร์ 09:00-18:00 (ปิด ส-อา)</li>
            <li>• <span className="font-medium">ห้าง:</span> เปิดทุกวัน 10:00-22:00</li>
            <li>• <span className="font-medium">ร้านค้า:</span> เปิดทุกวัน 10:00-19:00</li>
          </ul>
        </div>
        
        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const hours = formData.workingHours[key as keyof typeof formData.workingHours]
            return (
              <div key={key} className="flex items-center gap-4">
                <label className="w-20 text-base font-medium text-gray-700">{label}</label>
                
                <input
                  type="checkbox"
                  checked={!hours.isClosed}
                  onChange={(e) => handleWorkingHoursChange(key, 'isClosed', !e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                  disabled={isLoading}
                />
                
                {!hours.isClosed && (
                  <>
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) => handleWorkingHoursChange(key, 'open', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 text-base"
                      disabled={isLoading}
                    />
                    <span className="text-gray-500">ถึง</span>
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) => handleWorkingHoursChange(key, 'close', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 text-base"
                      disabled={isLoading}
                    />
                  </>
                )}
                
                {hours.isClosed && (
                  <span className="text-sm text-gray-500">ปิดทำการ</span>
                )}
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <label className="text-base font-medium text-gray-700">เวลาพักกลางวัน</label>
          <input
            type="number"
            value={formData.breakHours}
            onChange={(e) => setFormData({ ...formData, breakHours: parseFloat(e.target.value) || 1 })}
            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 text-base"
            min="0"
            max="2"
            step="0.5"
            disabled={isLoading}
          />
          <span className="text-sm text-gray-500">ชั่วโมง</span>
        </div>
      </div>

      {/* Shifts */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
            <Clock className="w-5 h-5 text-red-600" />
            กะการทำงาน
          </h3>
          <button
            type="button"
            onClick={handleAddShift}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4" />
            เพิ่มกะ
          </button>
        </div>
        
        <div className="space-y-3">
          {formData.shifts.map((shift, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="text"
                value={shift.name}
                onChange={(e) => handleShiftChange(index, 'name', e.target.value)}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 text-base"
                placeholder="ชื่อกะ"
                disabled={isLoading}
              />
              
              <input
                type="time"
                value={shift.startTime}
                onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 text-base"
                disabled={isLoading}
              />
              
              <span className="text-gray-500">-</span>
              
              <input
                type="time"
                value={shift.endTime}
                onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 text-base"
                disabled={isLoading}
              />
              
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">±</span>
                <input
                  type="number"
                  value={shift.graceMinutes}
                  onChange={(e) => handleShiftChange(index, 'graceMinutes', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 text-base"
                  min="0"
                  max="60"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-500">นาที</span>
              </div>
              
              <button
                type="button"
                onClick={() => handleRemoveShift(index)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                disabled={isLoading || formData.shifts.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
            disabled={isLoading}
          />
          <span className="font-medium text-gray-700">เปิดใช้งานสถานที่นี้</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
          disabled={isLoading}
        >
          <X className="w-4 h-4" />
          ยกเลิก
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={isLoading}
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </form>
  )
}