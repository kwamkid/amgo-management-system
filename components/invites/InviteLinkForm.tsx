// components/invites/InviteLinkForm.tsx

'use client'

import { useState } from 'react'
import { CreateInviteLinkData, InviteLink } from '@/types/invite'
import { useInviteLinks } from '@/hooks/useInviteLinks'
import LocationMultiSelect from '@/components/users/LocationMultiSelect'
import { RefreshCw, Info, Users, Shield } from 'lucide-react'
import { Checkbox, Label, Input, Alert, Card, CardContent, CardHeader, CardTitle, Button, IconButton, SelectMenu, Field } from '@/components/aoo'
import { InfoPanel } from '@/components/shared'
import { useToast } from '@/hooks/useToast'

const ROLE_OPTIONS = [
  { value: 'employee', label: 'พนักงาน' },
  { value: 'manager', label: 'ผู้จัดการ' },
  { value: 'hr', label: 'ฝ่ายบุคคล' },
  { value: 'driver', label: 'พนักงานขับรถ' },
]

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
  const { showToast } = useToast()
  
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
      showToast('กรุณาระบุรหัสลิงก์', 'error')
      return
    }
    
    if (formData.defaultLocationIds?.length === 0 && !formData.allowCheckInOutsideLocation) {
      showToast('กรุณาเลือกสาขาหรืออนุญาตให้เช็คอินนอกสถานที่', 'error')
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
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Info} tone="sky">ข้อมูลพื้นฐาน</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="รหัสลิงก์" required help="ใช้ตัวอักษร A-Z และตัวเลข 0-9 เท่านั้น" asDiv>
              <div className="flex gap-2">
                <Input
                  id="code"
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="flex-1 uppercase"
                  mono
                  placeholder="เช่น AMGO2024"
                  required
                  disabled={isSubmitting || !!initialData}
                  maxLength={20}
                />
                {!initialData && (
                  <IconButton icon={RefreshCw} title="สุ่มรหัสใหม่" tone="sunken" size={40} onClick={handleGenerateCode} disabled={isSubmitting} />
                )}
              </div>
            </Field>

            <Field label="หมายเหตุ">
              <Input
                id="note"
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="เช่น สำหรับพนักงาน Part-time"
                disabled={isSubmitting}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Default Settings */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Shield} tone="grape">ค่าเริ่มต้นสำหรับพนักงานใหม่</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Field label="สิทธิ์การใช้งาน" asDiv>
              <SelectMenu
                size="md"
                value={formData.defaultRole}
                options={ROLE_OPTIONS}
                onChange={(value) => value && setFormData({ ...formData, defaultRole: value as any })}
                disabled={isSubmitting}
              />
            </Field>

            <Field label="สาขาที่อนุญาตให้เช็คอิน" asDiv>
              <LocationMultiSelect
                selectedLocationIds={formData.defaultLocationIds || []}
                onChange={(locationIds) => setFormData({ ...formData, defaultLocationIds: locationIds })}
                disabled={isSubmitting}
              />
            </Field>
            
            <div className="flex items-center space-x-3 pt-2">
              <Checkbox
                id="allowCheckInOutsideLocation"
                checked={!!(formData.allowCheckInOutsideLocation)}
                onChange={(checked) => 
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
                  checked={!!(formData.requireApproval)}
                  onChange={(checked) => 
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
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Users} tone="warning">จำกัดการใช้งาน</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="จำนวนครั้งที่ใช้ได้" help="เว้นว่างหากไม่ต้องการจำกัด">
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
            </Field>

            <Field
              label="วันหมดอายุ"
              help={formData.expiresAt ? `หมดอายุใน ${getDaysUntilExpiry()} วัน` : undefined}
            >
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                disabled={isSubmitting}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Alert tone="info" title="ตัวอย่างลิงก์">
        <p className="mb-2">พนักงานจะได้รับลิงก์:</p>
        <InfoPanel>
          <code className="block text-sm break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/register/invite?invite={formData.code || 'CODE'}
          </code>
        </InfoPanel>
      </Alert>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" onClick={onCancel} variant="soft" icon="X" disabled={isSubmitting}>
          ยกเลิก
        </Button>
        <Button type="submit" icon="Save" loading={isSubmitting}>
          {isSubmitting ? 'กำลังบันทึก...' : initialData ? 'บันทึก' : 'สร้างลิงก์'}
        </Button>
      </div>
    </form>
  )
}