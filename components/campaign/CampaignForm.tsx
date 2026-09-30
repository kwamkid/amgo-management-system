// ========== FILE: components/campaign/CampaignForm.tsx ==========
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  FileText,
  Link as LinkIcon,
  Package,
  ShoppingBag,
  Users,
  Plus,
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
import { cn } from '@/lib/utils'
import BrandModal from '@/components/brand/BrandModal'
import ProductModal from '@/components/product/ProductModal'
import {
  Textarea,
  Input,
  Field,
  DatePicker,
  Checkbox,
  Alert,
  Pill,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  IconButton,
  EmptyState,
  useConfirm,
} from '@/components/aoo'
import { PageHeader, StatusBadge } from '@/components/shared'
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
  const { products: allProducts, createProduct, updateProduct, deleteProduct } = useProducts()
  
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
  const { confirm, dialog } = useConfirm()
  
  // Search states
  const [influencerSearch, setInfluencerSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  // Modal states - แยก open state ออกมาเพื่อป้องกัน re-render
  const [brandModalOpen, setBrandModalOpen] = useState(false)
  const [brandModalData, setBrandModalData] = useState<{
    mode: 'create' | 'edit'
    brand?: Brand | null
  }>({ mode: 'create' })
  
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalData, setProductModalData] = useState<{
    mode: 'create' | 'edit'
    product?: Product | null
    defaultBrandId?: string
  }>({ mode: 'create' })

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

  // Filter influencers by search (including phone number)
  const filteredInfluencers = useMemo(() => {
    if (!influencerSearch.trim()) return influencers
    
    const searchLower = influencerSearch.toLowerCase()
    return influencers.filter(inf =>
      inf.fullName.toLowerCase().includes(searchLower) ||
      inf.nickname.toLowerCase().includes(searchLower) ||
      inf.phone.includes(influencerSearch) ||
      inf.email.toLowerCase().includes(searchLower)
    )
  }, [influencers, influencerSearch])

  // Filter products by selected brands - use memoization to prevent re-renders
  const availableProducts = useMemo(() => {
    return allProducts.filter(product => 
      formData.brandIds.includes(product.brandId)
    )
  }, [allProducts, formData.brandIds])

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

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  if (!validateForm()) {
    // Scroll to first error
    const firstError = document.querySelector('[role="alert"]')
    firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  
  // Create data with influencer info for edit mode
  const submitData: CreateCampaignData = {
    ...formData,
    // For edit mode, include existing influencer data
    influencerIds: formData.influencerIds,
  }
  
  // For edit mode, we need to pass the influencer data separately
  if (isEditMode && campaign) {
    // Map the selected influencer IDs with their names
    const influencersWithNames = formData.influencerIds.map(influencerId => {
      // Find from existing campaign data first
      const existing = campaign.influencers?.find(inf => inf.influencerId === influencerId)
      if (existing) {
        return existing
      }
      
      // Otherwise find from influencers list
      const influencer = influencers.find(inf => inf.id === influencerId)
      return {
        influencerId,
        influencerName: influencer?.fullName || 'Unknown',
        influencerNickname: influencer?.nickname,
        assignedAt: new Date(),
        submissionStatus: 'pending' as const,
        submissionLink: `${Date.now()}-${influencerId.substring(0, 8)}`
      }
    })
    
    // Pass the influencers array in the update
    const updateData: any = {
      ...submitData,
      influencers: influencersWithNames
    }
    
    const result = await onSubmit(updateData)
    
    if (result) {
      router.push('/campaigns')
    }
  } else {
    // For create mode, just pass the data as is
    const result = await onSubmit(submitData)
    
    if (result) {
      router.push('/campaigns')
    }
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
        const product = allProducts.find(p => p.id === productId)
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
    if (brandModalData.mode === 'create') {
      const id = await createBrand(data)
      success = !!id
    } else if (brandModalData.brand?.id) {
      success = await updateBrand(brandModalData.brand.id, data)
    }
    
    if (success) {
      setBrandModalOpen(false)
      setBrandModalData({ mode: 'create' })
    }
    return success
  }

  // Handle product modal
  const handleProductSubmit = async (data: any) => {
    let success = false
    if (productModalData.mode === 'create') {
      const id = await createProduct(data)
      success = !!id
    } else if (productModalData.product?.id) {
      success = await updateProduct(productModalData.product.id, data)
    }
    
    if (success) {
      setProductModalOpen(false)
      setProductModalData({ mode: 'create' })
    }
    return success
  }

  const handleDeleteBrand = async (brand: Brand) => {
    const ok = await confirm({ title: `ลบ Brand "${brand.name}"?`, confirmLabel: 'ลบ', tone: 'danger' })
    if (ok) {
      deleteBrand(brand.id!)
    }
  }

  const handleDeleteProduct = async (product: Product) => {
    const ok = await confirm({ title: `ลบสินค้า "${product.name}"?`, confirmLabel: 'ลบ', tone: 'danger' })
    if (ok) {
      deleteProduct(product.id!)
    }
  }

  // กล่องเลือก (Influencer/Brand/สินค้า) — เลือกแล้วขึ้นพื้นเขียว
  const pickClass = (selected: boolean) =>
    cn(
      'p-3 border rounded-lg cursor-pointer transition-all',
      selected ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50 border-gray-200'
    )

  return (
    <>
      {dialog}
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title={isEditMode ? 'แก้ไข Campaign' : 'สร้าง Campaign ใหม่'}
          onBack={() => router.push('/campaigns')}
        />

        {/* Campaign Details */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={TrendingUp} tone="accent">ข้อมูล Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="ชื่อ Campaign" required error={errors.name || undefined}>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value })
                  setErrors({ ...errors, name: '' })
                }}
                placeholder="เช่น: Summer Beauty Campaign 2024"
                error={!!errors.name}
              />
            </Field>

            <Field label="รายละเอียด Campaign" required error={errors.description || undefined}>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value })
                  setErrors({ ...errors, description: '' })
                }}
                placeholder="อธิบายรายละเอียดของ Campaign..."
                rows={4}
                error={!!errors.description}
              />
            </Field>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="วันที่เริ่ม" asDiv>
                <DatePicker
                  value={formData.startDate}
                  onChange={(v) => setFormData({ ...formData, startDate: v })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </Field>

              <Field label="Deadline" required asDiv error={errors.deadline || undefined}>
                <DatePicker
                  value={formData.deadline}
                  onChange={(v) => {
                    setFormData({ ...formData, deadline: v })
                    setErrors({ ...errors, deadline: '' })
                  }}
                  min={formData.startDate}
                />
              </Field>
            </div>

            {/* Budget, Brief, and Tracking URL in one row */}
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="งบประมาณ (บาท)">
                <Input
                  id="budget"
                  type="number"
                  prefix={<DollarSign size={16} />}
                  value={formData.budget || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    budget: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                  placeholder="ไม่ระบุ = ไม่มีงบ"
                />
              </Field>

              <Field label="Link Brief File">
                <Input
                  id="briefFileUrl"
                  type="url"
                  prefix={<FileText size={16} />}
                  value={formData.briefFileUrl}
                  onChange={(e) => setFormData({ ...formData, briefFileUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                />
              </Field>

              <Field label="Link บิลส่งของ">
                <Input
                  id="trackingUrl"
                  type="url"
                  prefix={<LinkIcon size={16} />}
                  value={formData.trackingUrl}
                  onChange={(e) => setFormData({ ...formData, trackingUrl: e.target.value })}
                  placeholder="https://tracking.example.com/..."
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Select Influencers */}
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Users} tone="pink">
              เลือก Influencer <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-4">
              <Input
                prefix={<Search size={16} />}
                type="text"
                placeholder="ค้นหาชื่อ, ชื่อเล่น, เบอร์โทร, อีเมล..."
                value={influencerSearch}
                onChange={(e) => {
                  setInfluencerSearch(e.target.value)
                  setIsSearching(true)
                  setTimeout(() => setIsSearching(false), 300)
                }}
              />
            </div>

            {/* Selected count */}
            <div className="mb-3">
              <Pill tone={formData.influencerIds.length > 0 ? 'success' : 'neutral'}>
                เลือกแล้ว {formData.influencerIds.length} คน
              </Pill>
            </div>

            {errors.influencers && (
              <Alert tone="error" className="mb-4">{errors.influencers}</Alert>
            )}

            {/* Influencer grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {isSearching ? (
                <EmptyState size="sm" className="col-span-full" body="กำลังค้นหา..." />
              ) : filteredInfluencers.length === 0 ? (
                <EmptyState
                  size="sm"
                  className="col-span-full"
                  icon={<Users size={28} />}
                  body={influencerSearch ? 'ไม่พบ Influencer ที่ค้นหา' : 'ไม่มีข้อมูล Influencer'}
                />
              ) : (
                filteredInfluencers.map((influencer) => (
                  <div
                    key={influencer.id}
                    className={pickClass(formData.influencerIds.includes(influencer.id!))}
                    onClick={() => toggleInfluencer(influencer.id!)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-1 flex">
                        <Checkbox
                          checked={formData.influencerIds.includes(influencer.id!)}
                          onChange={() => toggleInfluencer(influencer.id!)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{influencer.fullName}</p>
                        <p className="text-xs text-gray-600">
                          @{influencer.nickname}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={influencer.tier} kind="tier" />
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
          <Card padding={0}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle icon={Package} tone="plum">
                  เลือก Brand <span className="text-red-500">*</span>
                </CardTitle>
                <IconButton
                  icon={Plus}
                  title="เพิ่ม Brand"
                  onClick={() => {
                    setBrandModalData({ mode: 'create' })
                    setBrandModalOpen(true)
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {errors.brands && (
                <Alert tone="error" className="mb-4">{errors.brands}</Alert>
              )}

              <div className="space-y-2">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className={pickClass(formData.brandIds.includes(brand.id!))}
                    onClick={() => toggleBrand(brand.id!)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={formData.brandIds.includes(brand.id!)}
                        onChange={() => toggleBrand(brand.id!)}
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
                        <IconButton
                          icon={Edit}
                          title="แก้ไข Brand"
                          size={28}
                          onClick={(e) => {
                            e.stopPropagation()
                            setBrandModalData({ mode: 'edit', brand })
                            setBrandModalOpen(true)
                          }}
                        />
                        <IconButton
                          icon={Trash2}
                          title="ลบ Brand"
                          tone="danger"
                          size={28}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteBrand(brand)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <Card padding={0}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle icon={ShoppingBag} tone="sky">
                  เลือกสินค้า <span className="text-red-500">*</span>
                </CardTitle>
                {formData.brandIds.length > 0 && (
                  <IconButton
                    icon={Plus}
                    title="เพิ่มสินค้า"
                    onClick={() => {
                      setProductModalData({
                        mode: 'create',
                        defaultBrandId: formData.brandIds[0]
                      })
                      setProductModalOpen(true)
                    }}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {errors.products && (
                <Alert tone="error" className="mb-4">{errors.products}</Alert>
              )}

              {formData.brandIds.length === 0 ? (
                <EmptyState size="sm" icon={<Package size={28} />} body="กรุณาเลือก Brand ก่อน" />
              ) : availableProducts.length === 0 ? (
                <EmptyState size="sm" icon={<ShoppingBag size={28} />} body="ไม่มีสินค้าจาก Brand ที่เลือก" />
              ) : (
                <div className="space-y-2">
                  {availableProducts.map((product) => {
                    const brand = brands.find(b => b.id === product.brandId)

                    return (
                      <div
                        key={product.id}
                        className={pickClass(formData.productIds.includes(product.id!))}
                        onClick={() => toggleProduct(product.id!)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={formData.productIds.includes(product.id!)}
                            onChange={() => toggleProduct(product.id!)}
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
                            <IconButton
                              icon={Edit}
                              title="แก้ไขสินค้า"
                              size={28}
                              onClick={(e) => {
                                e.stopPropagation()
                                setProductModalData({ mode: 'edit', product })
                                setProductModalOpen(true)
                              }}
                            />
                            <IconButton
                              icon={Trash2}
                              title="ลบสินค้า"
                              tone="danger"
                              size={28}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteProduct(product)
                              }}
                            />
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
          <Button type="button" variant="soft" onClick={() => router.push('/campaigns')} disabled={isSubmitting}>
            ยกเลิก
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'กำลังบันทึก...' : isEditMode ? 'บันทึกการแก้ไข' : 'สร้าง Campaign'}
          </Button>
        </div>
      </form>

      {/* Brand Modal */}
      <BrandModal
        open={brandModalOpen}
        onOpenChange={setBrandModalOpen}
        mode={brandModalData.mode}
        brand={brandModalData.brand}
        onSubmit={handleBrandSubmit}
      />

      {/* Product Modal */}
      <ProductModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        mode={productModalData.mode}
        product={productModalData.product}
        defaultBrandId={productModalData.defaultBrandId}
        brands={brands}
        onSubmit={handleProductSubmit}
      />
    </>
  )
}
