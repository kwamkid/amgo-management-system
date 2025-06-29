// components/users/UserEditForm.tsx

'use client'

import { useState } from 'react'
import { User, UpdateUserData } from '@/types/user'
import { toDate } from '@/lib/utils/date'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  // Convert birthDate to proper format for input[type="date"]
  const formatDateForInput = (date: any): string => {
    const dateObj = toDate(date)
    if (!dateObj) return ''
    
    // Format as YYYY-MM-DD for HTML date input
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [formData, setFormData] = useState<UpdateUserData>({
    fullName: user.fullName,
    phone: user.phone || '',
    birthDate: formatDateForInput(user.birthDate), // This is already a string
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

    if (!formData.phone?.trim()) {
      alert('กรุณากรอกเบอร์โทรศัพท์')
      return
    }

    if (!formData.birthDate) {
      alert('กรุณาระบุวันเกิด')
      return
    }
    
    if (formData.allowedLocationIds?.length === 0 && !formData.allowCheckInOutsideLocation) {
      alert('กรุณาเลือกสาขาที่อนุญาตหรืออนุญาตให้เช็คอินนอกสถานที่')
      return
    }
    
    // Format birthDate as ISO string for Firebase
    const dataToSubmit = {
      ...formData,
      birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : undefined
    }
    
    await onSubmit(dataToSubmit)
  }

  // Helper function to ensure birthDate is always a string for the input
  const getBirthDateValue = (): string => {
    if (typeof formData.birthDate === 'string') {
      return formData.birthDate
    }
    if (formData.birthDate instanceof Date) {
      return formatDateForInput(formData.birthDate)
    }
    return ''
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User Info Section */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            <UserIcon className="w-5 h-5 text-red-600" />
            ข้อมูลส่วนตัว
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* LINE Info (Read-only) */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="lineDisplayName">LINE Display Name</Label>
              <Input
                id="lineDisplayName"
                type="text"
                value={user.lineDisplayName}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div>
              <Label htmlFor="lineUserId">LINE User ID</Label>
              <Input
                id="lineUserId"
                type="text"
                value={user.lineUserId}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>
          
          {/* Editable Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">ชื่อ-นามสกุล *</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            
            <div>
              <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-10"
                  placeholder="0812345678"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="birthDate">วันเกิด *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="birthDate"
                  type="date"
                  value={getBirthDateValue()}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
              {/* Debug info - ลบออกเมื่อใช้งานจริง */}
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-gray-500 mt-1">
                  Original: {JSON.stringify(user.birthDate)} | 
                  Formatted: {formatDateForInput(user.birthDate)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Info Section */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-red-50 to-rose-100">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            <Shield className="w-5 h-5 text-red-600" />
            ข้อมูลการทำงาน
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="role">สิทธิ์การใช้งาน</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as User['role'] })}
                disabled={isLoading}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">พนักงาน</SelectItem>
                  <SelectItem value="manager">ผู้จัดการ</SelectItem>
                  <SelectItem value="hr">ฝ่ายบุคคล</SelectItem>
                  <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>สาขาที่อนุญาตให้เช็คอิน</Label>
              <LocationMultiSelect
                selectedLocationIds={formData.allowedLocationIds || []}
                onChange={(locationIds) => setFormData({ ...formData, allowedLocationIds: locationIds })}
                disabled={isLoading}
              />
            </div>
            
            <div className="flex items-center space-x-3 pt-2">
              <Checkbox
                id="allowCheckInOutsideLocation"
                checked={formData.allowCheckInOutsideLocation}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, allowCheckInOutsideLocation: checked as boolean })
                }
                disabled={isLoading}
              />
              <div className="space-y-1">
                <Label 
                  htmlFor="allowCheckInOutsideLocation" 
                  className="text-base font-normal cursor-pointer"
                >
                  อนุญาตให้เช็คอินนอกสถานที่
                </Label>
                <p className="text-sm text-gray-500">
                  พนักงานสามารถเช็คอินจากที่ใดก็ได้ (จะแสดงในรายงานว่าเช็คอินนอกสถานที่)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Section */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">สถานะ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, isActive: checked as boolean })
              }
              disabled={isLoading}
            />
            <div className="space-y-1">
              <Label 
                htmlFor="isActive" 
                className="text-base font-medium cursor-pointer"
              >
                เปิดใช้งาน
              </Label>
              <p className="text-sm text-gray-500">
                {formData.isActive 
                  ? 'พนักงานสามารถเข้าใช้งานระบบได้' 
                  : 'พนักงานไม่สามารถเข้าใช้งานระบบได้'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          disabled={isLoading}
        >
          <X className="w-4 h-4 mr-2" />
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </form>
  )
}