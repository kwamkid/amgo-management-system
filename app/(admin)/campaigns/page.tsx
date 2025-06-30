// ========== FILE: app/(admin)/campaigns/page.tsx ==========
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useInfluencers } from '@/hooks/useInfluencers'
import { useBrands } from '@/hooks/useBrands'
import { useProducts } from '@/hooks/useProducts'
import { useUsers } from '@/hooks/useUsers'
import { 
  TrendingUp,
  Plus,
  Calendar,
  Users,
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Copy,
  FileText,
  ChevronDown,
  X,
  Trash2,
  Shield
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TechLoader from '@/components/shared/TechLoader'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CampaignStatus } from '@/types/influencer'
import { cn } from '@/lib/utils'

export default function CampaignsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const isAdmin = userData?.role === 'admin'
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  const [brandFilter, setBrandFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  
  const { campaigns, loading, cancelCampaign, deleteCampaign } = useCampaigns()
  
  // Calculate stats from campaigns directly
  const stats = useMemo(() => {
    if (!campaigns.length) return null
    
    const statData = {
      total: campaigns.length,
      byStatus: {
        pending: 0,
        active: 0,
        reviewing: 0,
        completed: 0,
        cancelled: 0
      }
    }
    
    campaigns.forEach(campaign => {
      if (campaign.status && statData.byStatus[campaign.status] !== undefined) {
        statData.byStatus[campaign.status]++
      }
    })
    
    return statData
  }, [campaigns])
  const { influencers } = useInfluencers()
  const { brands } = useBrands()
  const { products } = useProducts()

  // Get unique creators from campaigns
  const uniqueCreators = useMemo(() => {
    const creators = new Map()
    campaigns.forEach(campaign => {
      if (campaign.createdBy && campaign.createdByName) {
        creators.set(campaign.createdBy, campaign.createdByName)
      }
    })
    return Array.from(creators, ([id, name]) => ({ id, name }))
  }, [campaigns])

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      // Search filter
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        campaign.name.toLowerCase().includes(searchLower) ||
        campaign.description.toLowerCase().includes(searchLower) ||
        campaign.influencers?.some(inf => 
          inf.influencerName.toLowerCase().includes(searchLower)
        ) ||
        campaign.brands?.some(brandId => {
          const brand = brands.find(b => b.id === brandId)
          return brand?.name.toLowerCase().includes(searchLower)
        }) ||
        campaign.products?.some(productId => {
          const product = products.find(p => p.id === productId)
          return product?.name.toLowerCase().includes(searchLower)
        })
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
      
      // Brand filter
      const matchesBrand = !brandFilter || campaign.brands?.some(brandId => {
        const brand = brands.find(b => b.id === brandId)
        return brand?.name.toLowerCase().includes(brandFilter.toLowerCase())
      })
      
      // Product filter
      const matchesProduct = !productFilter || campaign.products?.some(productId => {
        const product = products.find(p => p.id === productId)
        return product?.name.toLowerCase().includes(productFilter.toLowerCase())
      })
      
      // Creator filter
      const matchesCreator = creatorFilter === 'all' || campaign.createdBy === creatorFilter
      
      return matchesSearch && matchesStatus && matchesBrand && matchesProduct && matchesCreator
    })
  }, [campaigns, searchTerm, statusFilter, brandFilter, productFilter, creatorFilter, brands, products])

  // Status config
  const statusConfig: Record<CampaignStatus, { 
    label: string
    icon: any
    color: string 
    bgColor: string
  }> = {
    pending: { 
      label: 'รอดำเนินการ', 
      icon: Clock, 
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    },
    active: { 
      label: 'กำลังดำเนินการ', 
      icon: TrendingUp, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    reviewing: { 
      label: 'รอตรวจสอบ', 
      icon: AlertCircle, 
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    completed: { 
      label: 'เสร็จสิ้น', 
      icon: CheckCircle, 
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    cancelled: { 
      label: 'ยกเลิก', 
      icon: XCircle, 
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  }

  // Handle cancel campaign
  const handleCancelCampaign = async (id: string, name: string) => {
    if (confirm(`ต้องการยกเลิก Campaign "${name}" ใช่หรือไม่?`)) {
      await cancelCampaign(id)
    }
  }

  // Handle delete campaign (admin only)
  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!isAdmin) return
    
    if (confirm(`ต้องการลบ Campaign "${name}" อย่างถาวรใช่หรือไม่?\n\n⚠️ การลบจะไม่สามารถกู้คืนได้`)) {
      await deleteCampaign(id)
    }
  }

  // Copy submission link
  const copySubmissionLink = (code: string) => {
    const url = `${window.location.origin}/submit/${code}`
    navigator.clipboard.writeText(url)
      .then(() => alert('คัดลอก Link สำเร็จ!'))
      .catch(() => alert('ไม่สามารถคัดลอก Link ได้'))
  }

  // Handle stat card click
  const handleStatCardClick = (status: CampaignStatus | 'all') => {
    setStatusFilter(status)
  }

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            จัดการ Campaigns
          </h1>
          <p className="text-gray-600 mt-1">
            สร้างและติดตาม Influencer Marketing Campaigns
          </p>
        </div>
        
        <Button
          asChild
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          <Link href="/campaigns/create">
            <Plus className="w-5 h-5 mr-2" />
            สร้าง Campaign
          </Link>
        </Button>
      </div>

      {/* Stats Cards - Clickable */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <Card 
            className={cn(
              "p-3 md:p-4 cursor-pointer transition-all hover:shadow-md",
              statusFilter === 'all' && "ring-2 ring-red-500"
            )}
            onClick={() => handleStatCardClick('all')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600">ทั้งหมด</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-gray-400" />
            </div>
          </Card>
          
          <Card 
            className={cn(
              "p-3 md:p-4 bg-gradient-to-br from-blue-50 to-indigo-100 cursor-pointer transition-all hover:shadow-md",
              statusFilter === 'active' && "ring-2 ring-blue-600"
            )}
            onClick={() => handleStatCardClick('active')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-blue-700">กำลังดำเนินการ</p>
                <p className="text-lg md:text-2xl font-bold text-blue-900">{stats.byStatus.active}</p>
              </div>
              <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            </div>
          </Card>
          
          <Card 
            className={cn(
              "p-3 md:p-4 bg-gradient-to-br from-yellow-50 to-amber-100 cursor-pointer transition-all hover:shadow-md",
              statusFilter === 'reviewing' && "ring-2 ring-yellow-600"
            )}
            onClick={() => handleStatCardClick('reviewing')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-yellow-700">รอตรวจสอบ</p>
                <p className="text-lg md:text-2xl font-bold text-yellow-900">{stats.byStatus.reviewing}</p>
              </div>
              <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-yellow-600" />
            </div>
          </Card>
          
          <Card 
            className={cn(
              "p-3 md:p-4 bg-gradient-to-br from-green-50 to-emerald-100 cursor-pointer transition-all hover:shadow-md",
              statusFilter === 'completed' && "ring-2 ring-green-600"
            )}
            onClick={() => handleStatCardClick('completed')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-green-700">เสร็จสิ้น</p>
                <p className="text-lg md:text-2xl font-bold text-green-900">{stats.byStatus.completed}</p>
              </div>
              <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
            </div>
          </Card>

          <Card 
            className={cn(
              "p-3 md:p-4 bg-gradient-to-br from-red-50 to-rose-100 cursor-pointer transition-all hover:shadow-md col-span-2 lg:col-span-1",
              statusFilter === 'cancelled' && "ring-2 ring-red-600"
            )}
            onClick={() => handleStatCardClick('cancelled')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-red-700">ยกเลิก</p>
                <p className="text-lg md:text-2xl font-bold text-red-900">{stats.byStatus.cancelled}</p>
              </div>
              <XCircle className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4">
        {/* Main Search & Filter Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="ค้นหา Campaign, Influencer, Brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm md:text-base"
            />
          </div>
          
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 w-full sm:w-auto justify-center",
              showFilters && "bg-gray-100"
            )}
          >
            <Filter className="w-4 h-4" />
            <span className="sm:inline">Filters</span>
            {(brandFilter || productFilter || creatorFilter !== 'all') && (
              <Badge variant="error" className="ml-1">
                {[brandFilter, productFilter, creatorFilter !== 'all' ? creatorFilter : ''].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Brand Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Brand
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="พิมพ์เพื่อค้นหา Brand..."
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="pr-8 text-sm"
                  />
                  {brandFilter && (
                    <button
                      onClick={() => setBrandFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Product Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Product
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="พิมพ์เพื่อค้นหา Product..."
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="pr-8 text-sm"
                  />
                  {productFilter && (
                    <button
                      onClick={() => setProductFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Creator Filter */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  ผู้สร้าง
                </label>
                <Select
                  value={creatorFilter || "all"}
                  onValueChange={(value) => setCreatorFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="เลือกผู้สร้าง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {uniqueCreators.map(creator => (
                      <SelectItem key={creator.id} value={creator.id}>
                        {creator.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear All Filters */}
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBrandFilter('')
                  setProductFilter('')
                  setCreatorFilter('all')
                }}
                className="text-gray-600 text-sm"
              >
                ล้าง Filter ทั้งหมด
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Campaign Table - Mobile Card View / Desktop Table View */}
      <Card>
        {/* Mobile View - Cards */}
        <div className="lg:hidden">
          {filteredCampaigns.map((campaign) => {
            const status = statusConfig[campaign.status]
            const StatusIcon = status.icon
            
            // Calculate progress
            const totalInfluencers = campaign.influencers?.length || 0
            const submittedCount = campaign.influencers?.filter(
              inf => ['submitted', 'resubmitted', 'approved'].includes(inf.submissionStatus)
            ).length || 0
            const progress = totalInfluencers > 0 
              ? Math.round((submittedCount / totalInfluencers) * 100)
              : 0

            // Get brand names
            const brandNames = campaign.brands?.map(brandId => {
              const brand = brands.find(b => b.id === brandId)
              return brand?.name || brandId
            }).join(', ') || '-'

            return (
              <div key={campaign.id} className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${status.bgColor} flex-shrink-0`}>
                      <StatusIcon className={`w-5 h-5 ${status.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={`/campaigns/${campaign.id}`}
                        className="font-medium text-gray-900 hover:text-red-600 block truncate"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                        {campaign.description}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu
                    items={[
                      {
                        label: (
                          <Link 
                            href={`/campaigns/${campaign.id}`}
                            className="flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            ดูรายละเอียด
                          </Link>
                        ),
                        onClick: () => {}
                      },
                      {
                        label: (
                          <Link 
                            href={`/campaigns/${campaign.id}/edit`}
                            className="flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            แก้ไข
                          </Link>
                        ),
                        onClick: () => {},
                        disabled: campaign.status === 'cancelled' || campaign.status === 'completed'
                      },
                      { divider: true },
                      {
                        label: (
                          <span className="flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            ยกเลิก
                          </span>
                        ),
                        onClick: () => handleCancelCampaign(campaign.id!, campaign.name),
                        className: 'text-orange-600 hover:bg-orange-50',
                        disabled: campaign.status === 'cancelled' || campaign.status === 'completed'
                      },
                      ...(isAdmin ? [{
                        label: (
                          <span className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4" />
                            ลบถาวร
                          </span>
                        ),
                        onClick: () => handleDeleteCampaign(campaign.id!, campaign.name),
                        className: 'text-red-600 hover:bg-red-50'
                      }] : [])
                    ]}
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Influencers:</span>
                    <span className="font-medium">{totalInfluencers} คน</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Brand:</span>
                    <span className="font-medium truncate ml-2">{brandNames}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Timeline:</span>
                    <span className="font-medium">
                      {format(new Date(campaign.deadline), 'dd MMM yy', { locale: th })}
                    </span>
                  </div>
                  {campaign.status === 'active' && totalInfluencers > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <Badge className={`${status.bgColor} ${status.color}`}>
                    {status.label}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    by {campaign.createdByName || '-'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Influencers</TableHead>
                <TableHead>Brands & Products</TableHead>
                <TableHead className="w-[120px]">Timeline</TableHead>
                <TableHead className="w-[100px]">Progress</TableHead>
                <TableHead className="w-[120px]">สร้างโดย</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => {
                const status = statusConfig[campaign.status]
                const StatusIcon = status.icon
                
                // Calculate progress
                const totalInfluencers = campaign.influencers?.length || 0
                const submittedCount = campaign.influencers?.filter(
                  inf => ['submitted', 'resubmitted', 'approved'].includes(inf.submissionStatus)
                ).length || 0
                const progress = totalInfluencers > 0 
                  ? Math.round((submittedCount / totalInfluencers) * 100)
                  : 0

                // Get brand names
                const brandNames = campaign.brands?.map(brandId => {
                  const brand = brands.find(b => b.id === brandId)
                  return brand?.name || brandId
                }).join(', ') || '-'

                // Get product names with their brands
                const productInfo = campaign.products?.slice(0, 2).map(productId => {
                  const product = products.find(p => p.id === productId)
                  const brand = product ? brands.find(b => b.id === product.brandId) : null
                  return product ? {
                    name: product.name,
                    brandName: brand?.name || ''
                  } : null
                }).filter(Boolean) || []

                return (
                  <TableRow key={campaign.id} className="hover:bg-gray-50">
                    {/* Status Icon */}
                    <TableCell>
                      <div className={`p-2 rounded-lg ${status.bgColor} inline-block`}>
                        <StatusIcon className={`w-4 h-4 ${status.color}`} />
                      </div>
                    </TableCell>

                    {/* Campaign Info */}
                    <TableCell>
                      <div>
                        <Link 
                          href={`/campaigns/${campaign.id}`}
                          className="font-medium text-gray-900 hover:text-red-600"
                        >
                          {campaign.name}
                        </Link>
                        <p className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                          {campaign.description}
                        </p>
                        <Badge className={`${status.bgColor} ${status.color} mt-1`}>
                          {status.label}
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Influencers */}
                    <TableCell>
                      <div>
                        {campaign.influencers && campaign.influencers.length > 0 && (
                          <div className="text-sm text-gray-600 space-y-0.5">
                            {campaign.influencers.slice(0, 3).map((inf, idx) => (
                              <p key={inf.influencerId} className="truncate">
                                {campaign.influencers.length > 1 && `${idx + 1}. `}
                                {inf.influencerName || 'Unknown'}
                                {inf.influencerNickname && (
                                  <span className="text-gray-400"> (@{inf.influencerNickname})</span>
                                )}
                              </p>
                            ))}
                            {campaign.influencers.length > 3 && (
                              <p className="text-gray-400">+{campaign.influencers.length - 3} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Brands & Products */}
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{brandNames}</p>
                        {productInfo.length > 0 && (
                          <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                            {productInfo.map((product, idx) => (
                              <p key={idx} className="truncate">
                                • {product?.name}
                                {product?.brandName && (
                                  <span className="text-gray-400"> ({product.brandName})</span>
                                )}
                              </p>
                            ))}
                            {campaign.products && campaign.products.length > 2 && (
                              <p className="text-gray-400">+{campaign.products.length - 2} สินค้า</p>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Timeline */}
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-gray-500">
                          {format(new Date(campaign.startDate), 'dd/MM', { locale: th })}
                        </p>
                        <p className="font-medium">
                          {format(new Date(campaign.deadline), 'dd/MM/yy', { locale: th })}
                        </p>
                      </div>
                    </TableCell>

                    {/* Progress */}
                    <TableCell>
                      {campaign.status === 'active' && totalInfluencers > 0 ? (
                        <div className="w-20">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">{submittedCount}/{totalInfluencers}</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-gradient-to-r from-green-500 to-emerald-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </TableCell>

                    {/* Created By */}
                    <TableCell>
                      <p className="text-xs text-gray-600 truncate">{campaign.createdByName || '-'}</p>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu
                        items={[
                          {
                            label: (
                              <Link 
                                href={`/campaigns/${campaign.id}`}
                                className="flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                ดูรายละเอียด
                              </Link>
                            ),
                            onClick: () => {}
                          },
                          {
                            label: (
                              <Link 
                                href={`/campaigns/${campaign.id}/edit`}
                                className="flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                แก้ไข Campaign
                              </Link>
                            ),
                            onClick: () => {},
                            disabled: campaign.status === 'cancelled' || campaign.status === 'completed'
                          },
                          {
                            label: (
                              <span className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                ดู Brief
                              </span>
                            ),
                            onClick: () => campaign.briefFileUrl && window.open(campaign.briefFileUrl, '_blank'),
                            disabled: !campaign.briefFileUrl
                          },
                          { divider: true },
                          ...(campaign.influencers?.slice(0, 3).map(inf => ({
                            label: (
                              <span className="flex items-center gap-2">
                                <Copy className="w-4 h-4" />
                                Copy: {inf.influencerName}
                              </span>
                            ),
                            onClick: () => copySubmissionLink(inf.submissionLink!),
                            className: 'text-sm'
                          })) || []),
                          ...(campaign.influencers && campaign.influencers.length > 3 ? [{
                            label: (
                              <span className="text-sm text-gray-500">
                                +{campaign.influencers.length - 3} more...
                              </span>
                            ),
                            onClick: () => router.push(`/campaigns/${campaign.id}`),
                            className: 'text-sm'
                          }] : []),
                          { divider: true },
                          {
                            label: (
                              <span className="flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                ยกเลิก Campaign
                              </span>
                            ),
                            onClick: () => handleCancelCampaign(campaign.id!, campaign.name),
                            className: 'text-orange-600 hover:bg-orange-50',
                            disabled: campaign.status === 'cancelled' || campaign.status === 'completed'
                          },
                          ...(isAdmin ? [{
                            label: (
                              <span className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                ลบถาวร (Admin)
                              </span>
                            ),
                            onClick: () => handleDeleteCampaign(campaign.id!, campaign.name),
                            className: 'text-red-600 hover:bg-red-50'
                          }] : [])
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        
        {/* Empty State */}
        {filteredCampaigns.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || brandFilter || productFilter || creatorFilter !== 'all'
                ? 'ไม่พบ Campaign ที่ค้นหา' 
                : 'ยังไม่มี Campaign'}
            </p>
            {!searchTerm && statusFilter === 'all' && !brandFilter && !productFilter && creatorFilter === 'all' && (
              <Button
                asChild
                variant="ghost"
                className="mt-4 text-red-600 hover:bg-red-50"
              >
                <Link href="/campaigns/create">
                  <Plus className="w-5 h-5 mr-2" />
                  สร้าง Campaign แรก
                </Link>
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}