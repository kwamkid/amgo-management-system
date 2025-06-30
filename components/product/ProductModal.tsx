// ========== FILE: components/product/ProductModal.tsx ==========
'use client'

import { useState, useEffect } from 'react'
import { 
  ShoppingBag,
  FileText,
  Image as ImageIcon,
  Package,
  Loader2
} from 'lucide-react'
import { Product, Brand } from '@/types/influencer'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'เพิ่มสินค้าใหม่' : 'แก้ไขสินค้า'}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลสินค้าสำหรับใช้ใน Campaign
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Brand Selection */}
            <div>
              <Label htmlFor="product-brand">
                <Package className="inline w-4 h-4 mr-1" />
                Brand <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.brandId}
                onValueChange={(value) => {
                  setFormData({ ...formData, brandId: value })
                  setErrors({ ...errors, brandId: '' })
                }}
                disabled={mode === 'edit'}
              >
                <SelectTrigger id="product-brand" className={errors.brandId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="เลือก Brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id!}>
                      <div className="flex items-center gap-2">
                        {brand.logo && (
                          <img 
                            src={brand.logo} 
                            alt={brand.name}
                            className="w-5 h-5 object-contain"
                          />
                        )}
                        {brand.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.brandId && (
                <p className="text-sm text-red-600 mt-1">{errors.brandId}</p>
              )}
            </div>

            {/* Product Name */}
            <div>
              <Label htmlFor="product-name">
                <ShoppingBag className="inline w-4 h-4 mr-1" />
                ชื่อสินค้า <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  setErrors({ ...errors, name: '' })
                }}
                placeholder="เช่น: ลิปสติก, ครีมบำรุงผิว"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="product-description">
                <FileText className="inline w-4 h-4 mr-1" />
                รายละเอียด
              </Label>
              <Textarea
                id="product-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="รายละเอียดเกี่ยวกับสินค้านี้..."
                rows={3}
              />
            </div>

            {/* Product Image URL */}
            <div>
              <Label htmlFor="product-image">
                <ImageIcon className="inline w-4 h-4 mr-1" />
                รูปสินค้า URL
              </Label>
              <Input
                id="product-image"
                type="url"
                value={formData.image}
                onChange={(e) => {
                  setFormData({ ...formData, image: e.target.value })
                  setErrors({ ...errors, image: '' })
                }}
                placeholder="https://example.com/product.jpg"
                className={errors.image ? 'border-red-500' : ''}
              />
              {errors.image && (
                <p className="text-sm text-red-600 mt-1">{errors.image}</p>
              )}
              
              {/* Image Preview */}
              {formData.image && !errors.image && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
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
                mode === 'create' ? 'เพิ่มสินค้า' : 'บันทึกการแก้ไข'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}