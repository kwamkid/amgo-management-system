// ========== FILE: components/brand/BrandModal.tsx ==========
'use client'

import { useState, useEffect } from 'react'
import { 
  Package,
  FileText,
  Image as ImageIcon,
  Loader2
} from 'lucide-react'
import { Brand } from '@/types/influencer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'เพิ่ม Brand ใหม่' : 'แก้ไข Brand'}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูล Brand สำหรับใช้ใน Campaign
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Brand Name */}
            <div>
              <Label htmlFor="brand-name">
                <Package className="inline w-4 h-4 mr-1" />
                ชื่อ Brand <span className="text-red-500">*</span>
              </Label>
              <Input
                id="brand-name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  setErrors({ ...errors, name: '' })
                }}
                placeholder="เช่น: AMGO, Brand A"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="brand-description">
                <FileText className="inline w-4 h-4 mr-1" />
                รายละเอียด
              </Label>
              <Textarea
                id="brand-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="รายละเอียดเกี่ยวกับ Brand นี้..."
                rows={3}
              />
            </div>

            {/* Logo URL */}
            <div>
              <Label htmlFor="brand-logo">
                <ImageIcon className="inline w-4 h-4 mr-1" />
                Logo URL
              </Label>
              <Input
                id="brand-logo"
                type="url"
                value={formData.logo}
                onChange={(e) => {
                  setFormData({ ...formData, logo: e.target.value })
                  setErrors({ ...errors, logo: '' })
                }}
                placeholder="https://example.com/logo.png"
                className={errors.logo ? 'border-red-500' : ''}
              />
              {errors.logo && (
                <p className="text-sm text-red-600 mt-1">{errors.logo}</p>
              )}
              
              {/* Logo Preview */}
              {formData.logo && !errors.logo && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
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
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                mode === 'create' ? 'เพิ่ม Brand' : 'บันทึกการแก้ไข'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}