// ========== FILE: components/campaign/CampaignForm.tsx ==========
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Calendar,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Package,
  ShoppingBag,
  Users,
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Check,
  Search,
  Edit,
  Trash2,
  TrendingUp
} from 'lucide-react'
import { 
  Campaign,
  CreateCampaignData,
  Influencer,
  Brand,
  Product
} from '@/types/influencer'
import { useInfluencers } from '@/hooks/useInfluencers'
import { useBrands } from '@/hooks/useBrands'
import { useProducts } from '@/hooks/useProducts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import BrandModal from '@/components/brand/BrandModal'
import ProductModal from '@/components/product/ProductModal'

interface CampaignFormProps {
  campaign?: Campaign | null
  onSubmit: (data: CreateCampaignData) => Promise<string | null | boolean>
  isSubmitting?: boolean
}

export default function CampaignForm({
  campaign,
  onSubmit,
  isSubmitting = false
}: CampaignFormProps) {
  const router = useRouter()
  const isEditMode = !!campaign
  
  const { influencers, loading: influencersLoading } = useInfluencers()
  const { brands, createBrand, updateBrand, deleteBrand } = useBrands()
  const { products, createProduct, updateProduct, deleteProduct } = useProducts()
  
  // Form data
  const [formData, setFormData] = useState<CreateCampaignData>({
    name: '',
    description: '',
    briefFileUrl: '',
    trackingUrl: '',
    budget: undefined,
    startDate: new Date().toISOString().split('T')[0],
    deadline: '',
    influencerIds: [],
    brandIds: [],
    productIds: []
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Search states
  const [influencerSearch, setInfluencerSearch] = useState('')
  
  // Modal states
  const [brandModal, setBrandModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    brand?: Brand | null
  }>({ open: false, mode: 'create' })
  
  const [productModal, setProductModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    product?: Product | null
    defaultBrandId?: string
  }>({ open: false, mode: 'create' })

  // Initialize form data for edit mode
  useEffect(() => {
    if (campaign && isEditMode) {
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        briefFileUrl: campaign.briefFileUrl || '',
        trackingUrl: campaign.trackingUrl || '',
        budget: campaign.budget || undefined,
        startDate: typeof campaign.startDate === 'string' 
          ? campaign.startDate 
          : new Date(campaign.startDate).toISOString().split('T')[0],
        deadline: typeof campaign.deadline === 'string'
          ? campaign.deadline
          : new Date(campaign.deadline).toISOString().split('T')[0],
        influencerIds: campaign.influencers?.map(inf => inf.influencerId) || [],
        brandIds: campaign.brands || [],
        productIds: campaign.products || []
      })
    }
  }, [campaign, isEditMode])

  // Calculate default deadline
  useEffect(() => {
    if (formData.startDate && !formData.deadline && !isEditMode) {
      const start = new Date(formData.startDate)
      const deadline = new Date(start)
      deadline.setMonth(deadline.getMonth() + 1)
      setFormData(prev => ({
        ...prev,
        deadline: deadline.toISOString().split('T')[0]
      }))
    }
  }, [formData.startDate, isEditMode])

  // Filter influencers by search
  const filteredInfluencers = influencers.filter(inf =>
    inf.fullName.toLowerCase().includes(influencerSearch.toLowerCase()) ||
    inf.nickname.toLowerCase().includes(influencerSearch.toLowerCase())
  )

  // Filter products by selected brands
  const availableProducts = products.filter(product => 
    formData.brandIds.includes(product.brandId)
  )

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อ Campaign'
    }
    if (!formData.description.trim()) {
      newErrors.description = 'กรุณากรอกรายละเอียด'
    }
    if (!formData.deadline) {
      newErrors.deadline = 'กรุณากำหนด Deadline'
    }
    if (formData.influencerIds.length === 0) {
      newErrors.influencers = 'กรุณาเลือก Influencer อย่างน้อย 1 คน'
    }
    if (formData.brandIds.length === 0) {
      newErrors.brands = 'กรุณาเลือก Brand อย่างน้อย 1 แบรนด์'
    }
    if (formData.productIds.length === 0) {
      newErrors.products = 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.border-red-500')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    
    const result = await onSubmit(formData)
    
    if (result) {
      router.push('/campaigns')
    }
  }

  // Toggle selections
  const toggleInfluencer = (influencerId: string) => {
    setFormData(prev => ({
      ...prev,
      influencerIds: prev.influencerIds.includes(influencerId)
        ? prev.influencerIds.filter(id => id !== influencerId)
        : [...prev.influencerIds, influencerId]
    }))
    setErrors({ ...errors, influencers: '' })
  }

  const toggleBrand = (brandId: string) => {
    setFormData(prev => {
      const newBrandIds = prev.brandIds.includes(brandId)
        ? prev.brandIds.filter(id => id !== brandId)
        : [...prev.brandIds, brandId]
      
      // Remove products from deselected brands
      const newProductIds = prev.productIds.filter(productId => {
        const product = products.find(p => p.id === productId)
        return product && newBrandIds.includes(product.brandId)
      })
      
      return {
        ...prev,
        brandIds: newBrandIds,
        productIds: newProductIds
      }
    })
    setErrors({ ...errors, brands: '' })
  }

  const toggleProduct = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId]
    }))
    setErrors({ ...errors, products: '' })
  }

  // Handle brand modal
  const handleBrandSubmit = async (data: any) => {
    let success = false
    if (brandModal.mode === 'create') {
      const id = await createBrand(data)
      success = !!id
    } else if (brandModal.brand?.id) {
      success = await updateBrand(brandModal.brand.id, data)
    }
    
    if (success) {
      setBrandModal({ open: false, mode: 'create' })
    }
    return success
  }

  // Handle product modal
  const handleProductSubmit = async (data: any) => {
    let success = false
    if (productModal.mode === 'create') {
      const id = await createProduct(data)
      success = !!id
    } else if (productModal.product?.id) {
      success = await updateProduct(productModal.product.id, data)
    }
    
    if (success) {
      setProductModal({ open: false, mode: 'create' })
    }
    return success
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push('/campaigns')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'แก้ไข Campaign' : 'สร้าง Campaign ใหม่'}
          </h1>
        </div>

        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-600" />
              ข้อมูล Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">
                ชื่อ Campaign <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  setErrors({ ...errors, name: '' })
                }}
                placeholder="เช่น: Summer Beauty Campaign 2024"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">
                รายละเอียด Campaign <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value })
                  setErrors({ ...errors, description: '' })
                }}
                placeholder="อธิบายรายละเอียดของ Campaign..."
                rows={4}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1">{errors.description}</p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  วันที่เริ่ม
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label htmlFor="deadline">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Deadline <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => {
                    setFormData({ ...formData, deadline: e.target.value })
                    setErrors({ ...errors, deadline: '' })
                  }}
                  min={formData.startDate}
                  className={errors.deadline ? 'border-red-500' : ''}
                />
                {errors.deadline && (
                  <p className="text-sm text-red-600 mt-1">{errors.deadline}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budget">
                  <DollarSign className="inline w-4 h-4 mr-1" />
                  งบประมาณ (บาท)
                </Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    budget: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  placeholder="ไม่ระบุ = ไม่มีงบประมาณ"
                />
              </div>

              <div>
                <Label htmlFor="briefFileUrl">
                  <FileText className="inline w-4 h-4 mr-1" />
                  Link Brief File
                </Label>
                <Input
                  id="briefFileUrl"
                  type="url"
                  value={formData.briefFileUrl}
                  onChange={(e) => setFormData({ ...formData, briefFileUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="trackingUrl">
                <LinkIcon className="inline w-4 h-4 mr-1" />
                Link สำหรับบิลส่งของ
              </Label>
              <Input
                id="trackingUrl"
                type="url"
                value={formData.trackingUrl}
                onChange={(e) => setFormData({ ...formData, trackingUrl: e.target.value })}
                placeholder="https://tracking.example.com/..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Select Influencers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              เลือก Influencer <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="ค้นหาชื่อ Influencer..."
                value={influencerSearch}
                onChange={(e) => setInfluencerSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Selected count */}
            <div className="mb-3">
              <Badge variant="secondary">
                เลือกแล้ว {formData.influencerIds.length} คน
              </Badge>
            </div>

            {errors.influencers && (
              <Alert variant="error" className="mb-4">
                <AlertDescription>{errors.influencers}</AlertDescription>
              </Alert>
            )}

            {/* Influencer grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {influencersLoading ? (
                <p className="col-span-full text-center py-8 text-gray-500">กำลังโหลด...</p>
              ) : filteredInfluencers.length === 0 ? (
                <p className="col-span-full text-center py-8 text-gray-500">
                  {influencerSearch ? 'ไม่พบ Influencer ที่ค้นหา' : 'ไม่มีข้อมูล Influencer'}
                </p>
              ) : (
                filteredInfluencers.map((influencer) => (
                  <div
                    key={influencer.id}
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer transition-all",
                      formData.influencerIds.includes(influencer.id!)
                        ? "bg-red-50 border-red-300"
                        : "hover:bg-gray-50 border-gray-200"
                    )}
                    onClick={() => toggleInfluencer(influencer.id!)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={formData.influencerIds.includes(influencer.id!)}
                        onCheckedChange={() => toggleInfluencer(influencer.id!)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{influencer.fullName}</p>
                        <p className="text-xs text-gray-600">
                          @{influencer.nickname}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {influencer.tier}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {influencer.totalFollowers?.toLocaleString() || 0} followers
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Select Brands & Products */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Brands */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-red-600" />
                  เลือก Brand <span className="text-red-500">*</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setBrandModal({ open: true, mode: 'create' })}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errors.brands && (
                <Alert variant="error" className="mb-4">
                  <AlertDescription>{errors.brands}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer transition-all",
                      formData.brandIds.includes(brand.id!)
                        ? "bg-red-50 border-red-300"
                        : "hover:bg-gray-50 border-gray-200"
                    )}
                    onClick={() => toggleBrand(brand.id!)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={formData.brandIds.includes(brand.id!)}
                        onCheckedChange={() => toggleBrand(brand.id!)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {brand.logo && (
                        <img 
                          src={brand.logo} 
                          alt={brand.name}
                          className="w-8 h-8 object-contain"
                        />
                      )}
                      <span className="font-medium flex-1">{brand.name}</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation()
                            setBrandModal({ open: true, mode: 'edit', brand })
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`ลบ Brand "${brand.name}"?`)) {
                              deleteBrand(brand.id!)
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-red-600" />
                  เลือกสินค้า <span className="text-red-500">*</span>
                </div>
                {formData.brandIds.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setProductModal({ 
                      open: true, 
                      mode: 'create',
                      defaultBrandId: formData.brandIds[0]
                    })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errors.products && (
                <Alert variant="error" className="mb-4">
                  <AlertDescription>{errors.products}</AlertDescription>
                </Alert>
              )}

              {formData.brandIds.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  กรุณาเลือก Brand ก่อน
                </p>
              ) : availableProducts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  ไม่มีสินค้าจาก Brand ที่เลือก
                </p>
              ) : (
                <div className="space-y-2">
                  {availableProducts.map((product) => {
                    const brand = brands.find(b => b.id === product.brandId)
                    
                    return (
                      <div
                        key={product.id}
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer transition-all",
                          formData.productIds.includes(product.id!)
                            ? "bg-red-50 border-red-300"
                            : "hover:bg-gray-50 border-gray-200"
                        )}
                        onClick={() => toggleProduct(product.id!)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={formData.productIds.includes(product.id!)}
                            onCheckedChange={() => toggleProduct(product.id!)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {product.image && (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-8 h-8 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-gray-600">{brand?.name}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation()
                                setProductModal({ open: true, mode: 'edit', product })
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(`ลบสินค้า "${product.name}"?`)) {
                                  deleteProduct(product.id!)
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/campaigns')}
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
              <>
                {isEditMode ? 'บันทึกการแก้ไข' : 'สร้าง Campaign'}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Brand Modal */}
      <BrandModal
        open={brandModal.open}
        onOpenChange={(open) => setBrandModal(prev => ({ ...prev, open }))}
        mode={brandModal.mode}
        brand={brandModal.brand}
        onSubmit={handleBrandSubmit}
      />

      {/* Product Modal */}
      <ProductModal
        open={productModal.open}
        onOpenChange={(open) => setProductModal(prev => ({ ...prev, open }))}
        mode={productModal.mode}
        product={productModal.product}
        defaultBrandId={productModal.defaultBrandId}
        brands={brands}
        onSubmit={handleProductSubmit}
      />
    </>
  )
}