// ========== FILE: components/product/ProductModal.tsx ==========
'use client'

import { useState, useEffect } from 'react'
import { Product, Brand } from '@/types/influencer'
import { Textarea, Input, Field, Button, SelectMenu, Modal } from '@/components/aoo'
import { InfoPanel } from '@/components/shared'
interface ProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  product?: Product | null
  defaultBrandId?: string
  brands: Brand[]
  onSubmit: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>
}

export default function ProductModal({
  open,
  onOpenChange,
  mode,
  product,
  defaultBrandId,
  brands,
  onSubmit
}: ProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    brandId: defaultBrandId || '',
    name: '',
    description: '',
    image: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && product) {
      setFormData({
        brandId: product.brandId || '',
        name: product.name || '',
        description: product.description || '',
        image: product.image || ''
      })
    } else {
      setFormData({
        brandId: defaultBrandId || '',
        name: '',
        description: '',
        image: ''
      })
    }
    setErrors({})
  }, [mode, product, defaultBrandId, open])

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.brandId) {
      newErrors.brandId = 'กรุณาเลือก Brand'
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อสินค้า'
    }
    
    if (formData.image && !isValidUrl(formData.image)) {
      newErrors.image = 'URL รูปภาพไม่ถูกต้อง'
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
      const selectedBrand = brands.find(b => b.id === formData.brandId)
      
      const data: any = {
        brandId: formData.brandId,
        brandName: selectedBrand?.name || '',
        name: formData.name.trim(),
        isActive: true
      }
      
      // Only add optional fields if they have values
      if (formData.description.trim()) {
        data.description = formData.description.trim()
      }
      
      if (formData.image.trim()) {
        data.image = formData.image.trim()
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
      title={mode === 'create' ? 'เพิ่มสินค้าใหม่' : 'แก้ไขสินค้า'}
      description="กรอกข้อมูลสินค้าสำหรับใช้ใน Campaign"
      maxWidth={500}
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
          {/* Brand Selection */}
          <Field label="Brand" required asDiv error={errors.brandId || undefined}>
            <SelectMenu
              size="md"
              value={formData.brandId || null}
              options={brands.map((brand) => ({ value: brand.id!, label: brand.name }))}
              placeholder="เลือก Brand"
              onChange={(value) => {
                setFormData({ ...formData, brandId: value ?? '' })
                setErrors({ ...errors, brandId: '' })
              }}
              disabled={mode === 'edit'}
              invalid={!!errors.brandId}
            />
          </Field>

          {/* Product Name */}
          <Field label="ชื่อสินค้า" required error={errors.name || undefined}>
            <Input
              id="product-name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                setErrors({ ...errors, name: '' })
              }}
              placeholder="เช่น: ลิปสติก, ครีมบำรุงผิว"
              error={!!errors.name}
            />
          </Field>

          {/* Description */}
          <Field label="รายละเอียด">
            <Textarea
              id="product-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="รายละเอียดเกี่ยวกับสินค้านี้..."
              rows={3}
            />
          </Field>

          {/* Product Image URL */}
          <div>
            <Field label="รูปสินค้า URL" error={errors.image || undefined}>
              <Input
                id="product-image"
                type="url"
                value={formData.image}
                onChange={(e) => {
                  setFormData({ ...formData, image: e.target.value })
                  setErrors({ ...errors, image: '' })
                }}
                placeholder="https://example.com/product.jpg"
                error={!!errors.image}
              />
            </Field>

            {/* Image Preview */}
            {formData.image && !errors.image && (
              <InfoPanel className="mt-3">
                <p className="text-sm text-gray-600 mb-2">ตัวอย่างรูปสินค้า:</p>
                <img
                  src={formData.image}
                  alt="Product preview"
                  className="h-24 object-contain rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    setErrors({ ...errors, image: 'ไม่สามารถโหลดรูปภาพได้' })
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
            {isSubmitting ? 'กำลังบันทึก...' : mode === 'create' ? 'เพิ่มสินค้า' : 'บันทึกการแก้ไข'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
