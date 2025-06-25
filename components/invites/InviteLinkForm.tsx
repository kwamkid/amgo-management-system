// components/invites/InviteLinkForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { CreateInviteLinkData, InviteLink } from '@/types/invite'
import { useInviteLinks } from '@/hooks/useInviteLinks'
import LocationMultiSelect from '@/components/users/LocationMultiSelect'
import { 
  Save, 
  X, 
  RefreshCw, 
  Info,
  Calendar,
  Users,
  Shield,
  MapPin,
  AlertCircle
} from 'lucide-react'

interface InviteLinkFormProps {
  initialData?: InviteLink
  onSubmit: (data: CreateInviteLinkData) => Promise<boolean>
  onCancel: () => void
  isSubmitting?: boolean
}

export default function InviteLinkForm({ 
  initialData, 
  onSubmit, 
  onCancel,
  isSubmitting = false 
}: InviteLinkFormProps) {
  const { generateCode } = useInviteLinks()
  
  // Initialize with generated code if creating new
  const [formData, setFormData] = useState<CreateInviteLinkData>(() => {
    if (initialData) {
      return {
        code: initialData.code,
        defaultRole: initialData.defaultRole,
        defaultLocationIds: initialData.defaultLocationIds || [],
        allowCheckInOutsideLocation: initialData.allowCheckInOutsideLocation || false,
        requireApproval: initialData.requireApproval,
        maxUses: initialData.maxUses || undefined,
        expiresAt: initialData.expiresAt 
          ? new Date(initialData.expiresAt).toISOString().split('T')[0] 
          : '',
        note: initialData.note || ''
      }
    } else {
      // Generate code for new form
      return {
        code: generateCode(),
        defaultRole: 'employee',
        defaultLocationIds: [],
        allowCheckInOutsideLocation: false,
        requireApproval: true,
        maxUses: undefined,
        expiresAt: '',
        note: ''
      }
    }
  })

  // Remove the useEffect entirely as we're initializing in useState

  const handleGenerateCode = () => {
    setFormData(prev => ({ ...prev, code: generateCode() }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    if (!formData.code?.trim()) {
      alert('กรุณาระบุรหัสลิงก์')
      return
    }
    
    if (formData.defaultLocationIds?.length === 0 && !formData.allowCheckInOutsideLocation) {
      alert('กรุณาเลือกสาขาหรืออนุญาตให้เช็คอินนอกสถานที่')
      return
    }
    
    await onSubmit(formData)
  }

  // Calculate days until expiry
  const getDaysUntilExpiry = () => {
    if (!formData.expiresAt) return null
    const days = Math.ceil((new Date(formData.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days > 0 ? days : 0
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-red-600" />
          ข้อมูลพื้นฐาน
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              รหัสลิงก์ *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono uppercase"
                placeholder="เช่น AMGO2024"
                required
                disabled={isSubmitting || !!initialData}
                maxLength={20}
              />
              {!initialData && (
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ใช้ตัวอักษร A-Z และตัวเลข 0-9 เท่านั้น
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              หมายเหตุ
            </label>
            <input
              type="text"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="เช่น สำหรับพนักงาน Part-time"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Default Settings */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-600" />
          ค่าเริ่มต้นสำหรับพนักงานใหม่
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              สิทธิ์การใช้งาน
            </label>
            <select
              value={formData.defaultRole}
              onChange={(e) => setFormData({ ...formData, defaultRole: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={isSubmitting}
            >
              <option value="employee">พนักงาน</option>
              <option value="manager">ผู้จัดการ</option>
              <option value="hr">ฝ่ายบุคคล</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              สาขาที่อนุญาตให้เช็คอิน
            </label>
            <LocationMultiSelect
              selectedLocationIds={formData.defaultLocationIds || []}
              onChange={(locationIds) => setFormData({ ...formData, defaultLocationIds: locationIds })}
              disabled={isSubmitting}
            />
          </div>
          
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.allowCheckInOutsideLocation}
                onChange={(e) => setFormData({ ...formData, allowCheckInOutsideLocation: e.target.checked })}
                className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                disabled={isSubmitting}
              />
              <span className="text-gray-700">อนุญาตให้เช็คอินนอกสถานที่</span>
            </label>
            <p className="text-sm text-gray-500 ml-8 mt-1">
              พนักงานสามารถเช็คอินจากที่ใดก็ได้ (จะแสดงในรายงานว่าเช็คอินนอกสถานที่)
            </p>
          </div>
          
          <div className="pt-4 border-t">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.requireApproval}
                onChange={(e) => setFormData({ ...formData, requireApproval: e.target.checked })}
                className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                disabled={isSubmitting}
              />
              <span className="text-gray-700 font-medium">ต้องอนุมัติก่อนใช้งาน</span>
            </label>
            <p className="text-sm text-gray-500 ml-8 mt-1">
              {formData.requireApproval 
                ? 'HR ต้องอนุมัติก่อนจึงจะเข้าใช้งานได้' 
                : '⚠️ พนักงานสามารถเข้าใช้งานได้ทันทีหลังลงทะเบียน'}
            </p>
          </div>
        </div>
      </div>

      {/* Usage Limits */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-red-600" />
          จำกัดการใช้งาน
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              จำนวนครั้งที่ใช้ได้
            </label>
            <input
              type="number"
              value={formData.maxUses || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                maxUses: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="ไม่จำกัด"
              min="1"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              เว้นว่างหากไม่ต้องการจำกัด
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              วันหมดอายุ
            </label>
            <input
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              min={new Date().toISOString().split('T')[0]}
              disabled={isSubmitting}
            />
            {formData.expiresAt && (
              <p className="text-xs text-gray-500 mt-1">
                หมดอายุใน {getDaysUntilExpiry()} วัน
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-900">
          <AlertCircle className="w-5 h-5" />
          ตัวอย่างลิงก์
        </h3>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-gray-600 mb-2">พนักงานจะได้รับลิงก์:</p>
          <code className="block bg-gray-100 p-3 rounded text-sm break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/register/invite?invite={formData.code || 'CODE'}
          </code>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
          disabled={isSubmitting}
        >
          <X className="w-4 h-4" />
          ยกเลิก
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={isSubmitting}
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'กำลังบันทึก...' : initialData ? 'บันทึก' : 'สร้างลิงก์'}
        </button>
      </div>
    </form>
  )
}