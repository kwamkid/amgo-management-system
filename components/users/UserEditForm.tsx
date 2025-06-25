// components/users/UserEditForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { User, UpdateUserData } from '@/types/user'
import LocationMultiSelect from './LocationMultiSelect'
import { 
  User as UserIcon, 
  Phone, 
  Calendar, 
  Shield, 
  MapPin,
  Save,
  X
} from 'lucide-react'

interface UserEditFormProps {
  user: User
  onSubmit: (data: UpdateUserData) => Promise<boolean>
  onCancel: () => void
  isLoading?: boolean
}

export default function UserEditForm({ 
  user, 
  onSubmit, 
  onCancel,
  isLoading = false 
}: UserEditFormProps) {
const [formData, setFormData] = useState<UpdateUserData>({
  fullName: user.fullName,
  phone: user.phone || '',
  birthDate: user.birthDate ? 
    (typeof user.birthDate === 'string' 
      ? user.birthDate 
      : new Date(user.birthDate).toISOString().split('T')[0]
    ) : '',
  role: user.role,
  allowedLocationIds: user.allowedLocationIds || [],
  allowCheckInOutsideLocation: user.allowCheckInOutsideLocation || false,
  isActive: user.isActive
})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    if (!formData.fullName?.trim()) {
      alert('กรุณากรอกชื่อ-นามสกุล')
      return
    }
    
    if (formData.allowedLocationIds?.length === 0 && !formData.allowCheckInOutsideLocation) {
      alert('กรุณาเลือกสาขาที่อนุญาตหรืออนุญาตให้เช็คอินนอกสถานที่')
      return
    }
    
    // Format birthDate if exists
    const dataToSubmit = {
      ...formData,
      birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : undefined
    }
    
    await onSubmit(dataToSubmit)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User Info Section */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
          <UserIcon className="w-5 h-5 text-red-600" />
          ข้อมูลส่วนตัว
        </h3>
        
        {/* LINE Info (Read-only) */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">LINE Display Name</label>
            <input
              type="text"
              value={user.lineDisplayName}
              disabled
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">LINE User ID</label>
            <input
              type="text"
              value={user.lineUserId}
              disabled
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
            />
          </div>
        </div>
        
        {/* Editable Fields */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">ชื่อ-นามสกุล *</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">เบอร์โทรศัพท์</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
                placeholder="0812345678"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">วันเกิด</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={formData.birthDate ? 
                    (typeof formData.birthDate === 'string' 
                    ? formData.birthDate 
                    : new Date(formData.birthDate).toISOString().split('T')[0]
                    ) : ''
                }
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
                disabled={isLoading}
                />
            </div>
          </div>
        </div>
      </div>

      {/* Work Info Section */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
          <Shield className="w-5 h-5 text-red-600" />
          ข้อมูลการทำงาน
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">สิทธิ์การใช้งาน</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 text-base"
              disabled={isLoading}
            >
              <option value="employee">พนักงาน</option>
              <option value="manager">ผู้จัดการ</option>
              <option value="hr">ฝ่ายบุคคล</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">สาขาที่อนุญาตให้เช็คอิน</label>
            <LocationMultiSelect
              selectedLocationIds={formData.allowedLocationIds || []}
              onChange={(locationIds) => setFormData({ ...formData, allowedLocationIds: locationIds })}
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.allowCheckInOutsideLocation}
                onChange={(e) => setFormData({ ...formData, allowCheckInOutsideLocation: e.target.checked })}
                className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                disabled={isLoading}
              />
              <span className="text-gray-700">อนุญาตให้เช็คอินนอกสถานที่</span>
            </label>
            <p className="text-sm text-gray-500 ml-8 mt-1">
              พนักงานสามารถเช็คอินจากที่ใดก็ได้ (จะแสดงในรายงานว่าเช็คอินนอกสถานที่)
            </p>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">สถานะ</h3>
        
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
            disabled={isLoading}
          />
          <span className="font-medium text-gray-700">เปิดใช้งาน</span>
        </label>
        <p className="text-sm text-gray-500 ml-8 mt-1">
          {formData.isActive 
            ? 'พนักงานสามารถเข้าใช้งานระบบได้' 
            : 'พนักงานไม่สามารถเข้าใช้งานระบบได้'}
        </p>
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