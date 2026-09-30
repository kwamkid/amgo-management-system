// ========== FILE: components/brand/BrandModal.tsx ==========
'use client'

import { useState, useEffect } from 'react'
import { Brand } from '@/types/influencer'
import { Textarea, Input, Field, Button, Modal } from '@/components/aoo'
import { InfoPanel } from '@/components/shared'
interface BrandModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  brand?: Brand | null
  onSubmit: (data: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>
}

export default function BrandModal({
  open,
  onOpenChange,
  mode,
  brand,
  onSubmit
}: BrandModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && brand) {
      setFormData({
        name: brand.name || '',
        description: brand.description || '',
        logo: brand.logo || ''
      })
    } else {
      setFormData({
        name: '',
        description: '',
        logo: ''
      })
    }
    setErrors({})
  }, [mode, brand, open])

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อ Brand'
    }
    
    if (formData.logo && !isValidUrl(formData.logo)) {
      newErrors.logo = 'URL รูปภาพไม่ถูกต้อง'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Check if URL is valid
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    try {
      const data: any = {
        name: formData.name.trim(),
        isActive: true
      }
      
      // Only add optional fields if they have values
      if (formData.description.trim()) {
        data.description = formData.description.trim()
      }
      
      if (formData.logo.trim()) {
        data.logo = formData.logo.trim()
      }
      
      const success = await onSubmit(data)
      if (success) {
        onOpenChange(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={mode === 'create' ? 'เพิ่ม Brand ใหม่' : 'แก้ไข Brand'}
      description="กรอกข้อมูล Brand สำหรับใช้ใน Campaign"
      maxWidth={500}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
          {/* Brand Name */}
          <Field label="ชื่อ Brand" required error={errors.name || undefined}>
            <Input
              id="brand-name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                setErrors({ ...errors, name: '' })
              }}
              placeholder="เช่น: AMGO, Brand A"
              error={!!errors.name}
            />
          </Field>

          {/* Description */}
          <Field label="รายละเอียด">
            <Textarea
              id="brand-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="รายละเอียดเกี่ยวกับ Brand นี้..."
              rows={3}
            />
          </Field>

          {/* Logo URL */}
          <div>
            <Field label="Logo URL" error={errors.logo || undefined}>
              <Input
                id="brand-logo"
                type="url"
                value={formData.logo}
                onChange={(e) => {
                  setFormData({ ...formData, logo: e.target.value })
                  setErrors({ ...errors, logo: '' })
                }}
                placeholder="https://example.com/logo.png"
                error={!!errors.logo}
              />
            </Field>

            {/* Logo Preview */}
            {formData.logo && !errors.logo && (
              <InfoPanel className="mt-3">
                <p className="text-sm text-gray-600 mb-2">ตัวอย่าง Logo:</p>
                <img
                  src={formData.logo}
                  alt="Logo preview"
                  className="h-16 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    setErrors({ ...errors, logo: 'ไม่สามารถโหลดรูปภาพได้' })
                  }}
                />
              </InfoPanel>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="soft" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            ยกเลิก
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก...' : mode === 'create' ? 'เพิ่ม Brand' : 'บันทึกการแก้ไข'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
