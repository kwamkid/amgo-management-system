// components/invites/InviteLinkForm.tsx

'use client'

import { useState } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            <Info className="w-5 h-5 text-red-600" />
            ข้อมูลพื้นฐาน
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">รหัสลิงก์ *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="font-mono uppercase"
                  placeholder="เช่น AMGO2024"
                  required
                  disabled={isSubmitting || !!initialData}
                  maxLength={20}
                />
                {!initialData && (
                  <Button
                    type="button"
                    onClick={handleGenerateCode}
                    variant="outline"
                    size="icon"
                    disabled={isSubmitting}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ใช้ตัวอักษร A-Z และตัวเลข 0-9 เท่านั้น
              </p>
            </div>
            
            <div>
              <Label htmlFor="note">หมายเหตุ</Label>
              <Input
                id="note"
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="เช่น สำหรับพนักงาน Part-time"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Settings */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-red-50 to-rose-100">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            <Shield className="w-5 h-5 text-red-600" />
            ค่าเริ่มต้นสำหรับพนักงานใหม่
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="defaultRole">สิทธิ์การใช้งาน</Label>
              <Select
                value={formData.defaultRole}
                onValueChange={(value) => setFormData({ ...formData, defaultRole: value as any })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="defaultRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">พนักงาน</SelectItem>
                  <SelectItem value="manager">ผู้จัดการ</SelectItem>
                  <SelectItem value="hr">ฝ่ายบุคคล</SelectItem>
                  <SelectItem value="marketing">Influ Marketing</SelectItem>
                  <SelectItem value="driver">พนักงานขับรถ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>สาขาที่อนุญาตให้เช็คอิน</Label>
              <LocationMultiSelect
                selectedLocationIds={formData.defaultLocationIds || []}
                onChange={(locationIds) => setFormData({ ...formData, defaultLocationIds: locationIds })}
                disabled={isSubmitting}
              />
            </div>
            
            <div className="flex items-center space-x-3 pt-2">
              <Checkbox
                id="allowCheckInOutsideLocation"
                checked={formData.allowCheckInOutsideLocation}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, allowCheckInOutsideLocation: checked as boolean })
                }
                disabled={isSubmitting}
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
            
            <div className="pt-4 border-t">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="requireApproval"
                  checked={formData.requireApproval}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, requireApproval: checked as boolean })
                  }
                  disabled={isSubmitting}
                />
                <div className="space-y-1">
                  <Label 
                    htmlFor="requireApproval" 
                    className="text-base font-medium cursor-pointer"
                  >
                    ต้องอนุมัติก่อนใช้งาน
                  </Label>
                  <p className="text-sm text-gray-500">
                    {formData.requireApproval 
                      ? 'HR ต้องอนุมัติก่อนจึงจะเข้าใช้งานได้' 
                      : '⚠️ พนักงานสามารถเข้าใช้งานได้ทันทีหลังลงทะเบียน'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Limits */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-100">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            <Users className="w-5 h-5 text-orange-600" />
            จำกัดการใช้งาน
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxUses">จำนวนครั้งที่ใช้ได้</Label>
              <Input
                id="maxUses"
                type="number"
                value={formData.maxUses || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  maxUses: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                placeholder="ไม่จำกัด"
                min="1"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                เว้นว่างหากไม่ต้องการจำกัด
              </p>
            </div>
            
            <div>
              <Label htmlFor="expiresAt">วันหมดอายุ</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
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
        </CardContent>
      </Card>

      {/* Preview */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          <h3 className="font-semibold mb-2 text-blue-900">ตัวอย่างลิงก์</h3>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-gray-600 mb-2">พนักงานจะได้รับลิงก์:</p>
            <code className="block bg-gray-100 p-3 rounded text-sm break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/register/invite?invite={formData.code || 'CODE'}
            </code>
          </div>
        </AlertDescription>
      </Alert>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          disabled={isSubmitting}
        >
          <X className="w-4 h-4 mr-2" />
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'กำลังบันทึก...' : initialData ? 'บันทึก' : 'สร้างลิงก์'}
        </Button>
      </div>
    </form>
  )
}