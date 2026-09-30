// ========== FILE: app/(admin)/campaigns/page.tsx ==========
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useInfluencers } from '@/hooks/useInfluencers'
import { useBrands } from '@/hooks/useBrands'
import { useProducts } from '@/hooks/useProducts'
import { useToast } from '@/hooks/useToast'
import {
  TrendingUp,
  Search,
  Filter,
  X,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TechLoader from '@/components/shared/TechLoader'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CampaignStatus } from '@/types/influencer'
import {
  Input,
  Pill,
  Card,
  Button,
  IconButton,
  SelectMenu,
  Field,
  ActionMenu,
  Progress,
  EmptyState,
  useConfirm,
} from '@/components/aoo'
import TableFooter from '@/components/shared/TableFooter'
import { DataTable, StatCard, PageHeader, StatusBadge } from '@/components/shared'
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

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
        revising: 0,
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

  // Pagination calculations
  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage)
  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredCampaigns.slice(start, end)
  }, [filteredCampaigns, currentPage, itemsPerPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, brandFilter, productFilter, creatorFilter])

  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()

  // Handle cancel campaign
  const handleCancelCampaign = async (id: string, name: string) => {
    const ok = await confirm({
      title: `ต้องการยกเลิก Campaign "${name}" ใช่หรือไม่?`,
      confirmLabel: 'ยกเลิก Campaign',
      cancelLabel: 'ไม่ใช่',
      tone: 'danger',
    })
    if (ok) {
      await cancelCampaign(id)
    }
  }

  // Handle delete campaign (admin only)
  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!isAdmin) return

    const ok = await confirm({
      title: `ต้องการลบ Campaign "${name}" อย่างถาวรใช่หรือไม่?`,
      description: '⚠️ การลบจะไม่สามารถกู้คืนได้',
      confirmLabel: 'ลบถาวร',
      tone: 'danger',
    })
    if (ok) {
      await deleteCampaign(id)
    }
  }

  // Copy submission link
  const copySubmissionLink = (code: string) => {
    const url = `${window.location.origin}/submit/${code}`
    navigator.clipboard.writeText(url)
      .then(() => showToast('คัดลอก Link สำเร็จ!'))
      .catch(() => showToast('ไม่สามารถคัดลอก Link ได้', 'error'))
  }

  // Handle stat card click
  const handleStatCardClick = (status: CampaignStatus | 'all') => {
    setStatusFilter(status)
  }

  const creatorOptions = [
    { value: 'all', label: 'ทั้งหมด' },
    ...uniqueCreators.map((creator) => ({ value: creator.id as string, label: creator.name as string })),
  ]

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {dialog}

      <PageHeader
        title="จัดการ Campaigns"
        description="สร้างและติดตาม Influencer Marketing Campaigns"
        icon={TrendingUp}
        actions={
          <Link href="/campaigns/create">
            <Button icon="Plus">สร้าง Campaign</Button>
          </Link>
        }
      />

      {/* Stats Cards - Clickable */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <StatCard label="ทั้งหมด" value={stats.total} icon={TrendingUp} tone="grape" onClick={() => handleStatCardClick('all')} selected={statusFilter === 'all'} />
          <StatCard label="กำลังดำเนินการ" value={stats.byStatus.active} icon={TrendingUp} tone="sky" onClick={() => handleStatCardClick('active')} selected={statusFilter === 'active'} />
          <StatCard label="รอแก้ไข" value={stats.byStatus.revising} icon={Edit} tone="accent" onClick={() => handleStatCardClick('revising')} selected={statusFilter === 'revising'} />
          <StatCard label="รอตรวจสอบ" value={stats.byStatus.reviewing} icon={AlertCircle} tone="warning" onClick={() => handleStatCardClick('reviewing')} selected={statusFilter === 'reviewing'} />
          <StatCard label="เสร็จสิ้น" value={stats.byStatus.completed} icon={CheckCircle} tone="success" onClick={() => handleStatCardClick('completed')} selected={statusFilter === 'completed'} />
          <StatCard label="ยกเลิก" value={stats.byStatus.cancelled} icon={XCircle} tone="muted" onClick={() => handleStatCardClick('cancelled')} selected={statusFilter === 'cancelled'} />
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4">
        {/* Main Search & Filter Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <Input
              prefix={<Search size={16} />}
              type="text"
              placeholder="ค้นหา Campaign, Influencer, Brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Button
            variant={showFilters ? 'secondary' : 'soft'}
            onClick={() => setShowFilters(!showFilters)}
            className="w-full sm:w-auto"
          >
            <Filter size={16} />
            Filters
            {(brandFilter || productFilter || creatorFilter !== 'all') && (
              <Pill tone="danger">
                {[brandFilter, productFilter, creatorFilter !== 'all' ? creatorFilter : ''].filter(Boolean).length}
              </Pill>
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Brand Filter */}
              <Field label="Brand" asDiv>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="พิมพ์เพื่อค้นหา Brand..."
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                  />
                  {brandFilter && (
                    <IconButton
                      icon={X}
                      title="ล้าง Brand"
                      size={28}
                      onClick={() => setBrandFilter('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    />
                  )}
                </div>
              </Field>

              {/* Product Filter */}
              <Field label="Product" asDiv>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="พิมพ์เพื่อค้นหา Product..."
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                  />
                  {productFilter && (
                    <IconButton
                      icon={X}
                      title="ล้าง Product"
                      size={28}
                      onClick={() => setProductFilter('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    />
                  )}
                </div>
              </Field>

              {/* Creator Filter */}
              <Field label="ผู้สร้าง" asDiv className="sm:col-span-2 lg:col-span-1">
                <SelectMenu
                  size="md"
                  value={creatorFilter || 'all'}
                  options={creatorOptions}
                  placeholder="เลือกผู้สร้าง"
                  onChange={(value) => setCreatorFilter(value ?? 'all')}
                />
              </Field>
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
              >
                ล้าง Filter ทั้งหมด
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Campaign Table - Mobile Card View / Desktop Table View */}
      <Card padding={0}>
        {/* Mobile View - Cards */}
        <div className="lg:hidden">
          {paginatedCampaigns.map((campaign) => {
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
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="font-medium text-gray-900 hover:text-red-600 block truncate text-base"
                    >
                      {campaign.name}
                    </Link>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                      {campaign.description}
                    </p>
                  </div>
                  <ActionMenu
                    items={[
                      {
                        label: 'ดูรายละเอียด', icon: 'Eye', onSelect: () => router.push(`/campaigns/${campaign.id}`)
                      },
                      {
                        label: 'แก้ไข', icon: 'Pencil', onSelect: () => router.push(`/campaigns/${campaign.id}/edit`),
                        disabled: campaign.status === 'cancelled' || campaign.status === 'completed'
                      },
                      { kind: 'divider' },
                      {
                        label: 'ยกเลิก', icon: 'X',
                        onSelect: () => handleCancelCampaign(campaign.id!, campaign.name),
                        disabled: campaign.status === 'cancelled' || campaign.status === 'completed'
                      },
                      ...(isAdmin ? [{
                        label: 'ลบถาวร', icon: 'Trash2',
                        onSelect: () => handleDeleteCampaign(campaign.id!, campaign.name), tone: 'danger' as const
                      }] : [])
                    ]}
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Influencers:</span>
                    <span className="font-medium text-base">{totalInfluencers} คน</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Brand:</span>
                    <span className="font-medium truncate ml-2 text-base">{brandNames}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Timeline:</span>
                    <span className="font-medium text-base">
                      {format(new Date(campaign.deadline), 'dd MMM yy', { locale: th })}
                    </span>
                  </div>
                  {['active', 'reviewing', 'revising'].includes(campaign.status) && totalInfluencers > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} tone="success" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <StatusBadge status={campaign.status} kind="campaign" />
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
          <DataTable
            columns={[
              {
                key: 'campaign', header: 'Campaign', mobilePrimary: true, sortValue: (campaign) => campaign.name,
                cell: (campaign) => (
                  <div>
                    <Link href={`/campaigns/${campaign.id}`} className="font-medium text-gray-900 hover:text-red-600 text-base">
                      {campaign.name}
                    </Link>
                    <p className="text-sm text-gray-500 line-clamp-1 max-w-xs">{campaign.description}</p>
                    <div className="mt-1">
                      <StatusBadge status={campaign.status} kind="campaign" />
                    </div>
                  </div>
                ),
              },
              {
                key: 'influencers', header: 'Influencers', hideOnMobile: true,
                cell: (campaign) =>
                  campaign.influencers && campaign.influencers.length > 0 ? (
                    <div className="text-base text-gray-600 space-y-0.5">
                      {campaign.influencers.slice(0, 3).map((inf, idx) => (
                        <p key={inf.influencerId} className="truncate">
                          {campaign.influencers.length > 1 && `${idx + 1}. `}
                          {inf.influencerName || 'Unknown'}
                          {inf.influencerNickname && <span className="text-gray-400"> (@{inf.influencerNickname})</span>}
                        </p>
                      ))}
                      {campaign.influencers.length > 3 && <p className="text-gray-400 text-sm">+{campaign.influencers.length - 3} more</p>}
                    </div>
                  ) : null,
              },
              {
                key: 'brands', header: 'Brands & Products', hideOnMobile: true,
                cell: (campaign) => {
                  const brandNames = campaign.brands?.map((brandId) => brands.find((b) => b.id === brandId)?.name || brandId).join(', ') || '-'
                  const productInfo = (campaign.products?.slice(0, 2).map((productId) => {
                    const product = products.find((p) => p.id === productId)
                    const brand = product ? brands.find((b) => b.id === product.brandId) : null
                    return product ? { name: product.name, brandName: brand?.name || '' } : null
                  }) || []).filter(Boolean)
                  return (
                    <div>
                      <p className="text-base font-medium text-gray-900">{brandNames}</p>
                      {productInfo.length > 0 && (
                        <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                          {productInfo.map((product, idx) => (
                            <p key={idx} className="truncate">
                              • {product?.name}
                              {product?.brandName && <span className="text-gray-400"> ({product.brandName})</span>}
                            </p>
                          ))}
                          {campaign.products && campaign.products.length > 2 && <p className="text-gray-400">+{campaign.products.length - 2} สินค้า</p>}
                        </div>
                      )}
                    </div>
                  )
                },
              },
              {
                key: 'timeline', header: 'Timeline', width: 120, sortValue: (campaign) => campaign.deadline ? String(campaign.deadline) : null,
                cell: (campaign) => (
                  <div className="text-sm">
                    <p className="text-gray-500">{format(new Date(campaign.startDate), 'dd/MM', { locale: th })}</p>
                    <p className="font-medium text-base">{format(new Date(campaign.deadline), 'dd/MM/yy', { locale: th })}</p>
                  </div>
                ),
              },
              {
                key: 'progress', header: 'Progress', width: 100, hideOnMobile: true,
                cell: (campaign) => {
                  const totalInfluencers = campaign.influencers?.length || 0
                  const submittedCount = campaign.influencers?.filter((inf) => ['submitted', 'resubmitted', 'approved'].includes(inf.submissionStatus)).length || 0
                  const progress = totalInfluencers > 0 ? Math.round((submittedCount / totalInfluencers) * 100) : 0
                  return ['active', 'reviewing', 'revising'].includes(campaign.status) && totalInfluencers > 0 ? (
                    <div className="w-20">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{submittedCount}/{totalInfluencers}</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} tone="success" className="h-1.5" />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )
                },
              },
              { key: 'createdBy', header: 'สร้างโดย', width: 120, hideOnMobile: true, cell: (campaign) => <p className="text-sm text-gray-600 truncate">{campaign.createdByName || '-'}</p> },
              {
                key: 'actions', header: '', align: 'right', width: 60, mobileFooterAction: true,
                cell: (campaign) => (
                  <ActionMenu
                    items={[
                      { label: 'ดูรายละเอียด', icon: 'Eye', onSelect: () => router.push(`/campaigns/${campaign.id}`) },
                      { label: 'แก้ไข Campaign', icon: 'Pencil', onSelect: () => router.push(`/campaigns/${campaign.id}/edit`), disabled: campaign.status === 'cancelled' || campaign.status === 'completed' },
                      { label: 'ดู Brief', icon: 'FileText', onSelect: () => campaign.briefFileUrl && window.open(campaign.briefFileUrl, '_blank'), disabled: !campaign.briefFileUrl },
                      { kind: 'divider' },
                      ...(campaign.influencers?.slice(0, 3).map((inf) => ({ label: `Copy: ${inf.influencerName}`, icon: 'Copy', onSelect: () => copySubmissionLink(inf.submissionLink!) })) || []),
                      ...(campaign.influencers && campaign.influencers.length > 3 ? [{ label: `+${campaign.influencers.length - 3} more...`, onSelect: () => router.push(`/campaigns/${campaign.id}`) }] : []),
                      { kind: 'divider' },
                      { label: 'ยกเลิก Campaign', icon: 'X', onSelect: () => handleCancelCampaign(campaign.id!, campaign.name), disabled: campaign.status === 'cancelled' || campaign.status === 'completed' },
                      ...(isAdmin ? [{ label: 'ลบถาวร (Admin)', icon: 'Trash2', onSelect: () => handleDeleteCampaign(campaign.id!, campaign.name), tone: 'danger' as const }] : []),
                    ]}
                  />
                ),
              },
            ]}
            rows={paginatedCampaigns}
            rowKey={(campaign) => campaign.id!}
            emptyTitle="ไม่มีแคมเปญ"
          />
        </div>

        {/* Empty State */}
        {filteredCampaigns.length === 0 && (
          <EmptyState
            icon={<TrendingUp size={40} />}
            title={
              searchTerm || statusFilter !== 'all' || brandFilter || productFilter || creatorFilter !== 'all'
                ? 'ไม่พบ Campaign ที่ค้นหา'
                : 'ยังไม่มี Campaign'
            }
            action={
              !searchTerm && statusFilter === 'all' && !brandFilter && !productFilter && creatorFilter === 'all' ? (
                <Link href="/campaigns/create">
                  <Button variant="ghost" icon="Plus">สร้าง Campaign แรก</Button>
                </Link>
              ) : undefined
            }
          />
        )}

        {/* Pagination */}
        {filteredCampaigns.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <TableFooter page={currentPage} pageSize={itemsPerPage} total={filteredCampaigns.length} onPageChange={setCurrentPage} onPageSizeChange={setItemsPerPage} />
          </div>
        )}
      </Card>
    </div>
  )
}
