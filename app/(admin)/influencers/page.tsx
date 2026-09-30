// app/(admin)/influencers/page.tsx

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useInfluencers, useInfluencerStats } from '@/hooks/useInfluencers'
import { 
  InfluencerTier, 
  SocialPlatform, 
  PLATFORM_INFO,
  calculateInfluencerTier
} from '@/types/influencer'
import {
  Users,
  Eye,
  Baby,
  TrendingUp,
  Facebook,
  Instagram,
  Music2,
  Youtube,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TechLoader from '@/components/shared/TechLoader'
import { Pill, Card, Button, ActionMenu, useConfirm } from '@/components/aoo'
import TableFooter from '@/components/shared/TableFooter'
import { StatCard, PageHeader, StatusBadge, FilterBar, FilterSelect, DataTable } from '@/components/shared'
// Platform icon mapping
const PLATFORM_ICONS: Record<string, any> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube
}

export default function InfluencersPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  const { 
    influencers, 
    loading, 
    hasMore, 
    loadMore, 
    searchInfluencers,
    deleteInfluencer 
  } = useInfluencers({
    tier: tierFilter === 'all' ? undefined : tierFilter,
    platform: platformFilter === 'all' ? undefined : platformFilter
  })
  
  const { stats } = useInfluencerStats()
  const { confirm, dialog } = useConfirm()

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchInfluencers(searchTerm)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Pagination calculations
  const totalPages = Math.ceil(influencers.length / itemsPerPage)
  const paginatedInfluencers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return influencers.slice(start, end)
  }, [influencers, currentPage, itemsPerPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, tierFilter, platformFilter])

  // Format follower count
  const formatFollowers = (count?: number) => {
    if (!count) return '0'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `ต้องการลบ ${name} ใช่หรือไม่?`,
      confirmLabel: 'ลบ',
      tone: 'danger',
    })
    if (ok) {
      await deleteInfluencer(id)
    }
  }

  if (loading && influencers.length === 0) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {dialog}

      <PageHeader
        title="จัดการ Influencers"
        description="ฐานข้อมูล Influencer และข้อมูลลูก"
        icon={Users}
        actions={
          <Link href="/influencers/create">
            <Button icon="Plus">เพิ่ม Influencer</Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="ทั้งหมด" value={stats.total} icon={Users} tone="sky" />
          <StatCard label="Mega" value={stats.byTier.mega} icon={TrendingUp} tone="grape" />
          <StatCard label="Macro" value={stats.byTier.macro} icon={Users} tone="pink" />
          <StatCard label="Total Reach" value={formatFollowers(stats.totalReach)} icon={Eye} tone="accent" />
        </div>
      )}

      {/* Filters */}
      <FilterBar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="ค้นหาชื่อ, ชื่อเล่น, อีเมล, เบอร์โทร..."
        sticky={false}
      >
        <FilterSelect
          label="ทุกระดับ"
          width={180}
          value={tierFilter === 'all' ? null : tierFilter}
          onChange={(v) => setTierFilter(v ?? 'all')}
          options={[
            { value: 'nano', label: 'Nano (<10K)' },
            { value: 'micro', label: 'Micro (10K-100K)' },
            { value: 'macro', label: 'Macro (100K-1M)' },
            { value: 'mega', label: 'Mega (>1M)' },
          ]}
        />
        <FilterSelect
          label="ทุก Platform"
          width={180}
          value={platformFilter === 'all' ? null : platformFilter}
          onChange={(v) => setPlatformFilter(v ?? 'all')}
          options={[
            { value: 'facebook', label: 'Facebook' },
            { value: 'instagram', label: 'Instagram' },
            { value: 'tiktok', label: 'TikTok' },
            { value: 'youtube', label: 'YouTube' },
            { value: 'twitter', label: 'Twitter/X' },
            { value: 'lemon8', label: 'Lemon8' },
          ]}
        />
      </FilterBar>

      {/* Influencer List */}
      <Card padding={0}>
        <DataTable
          loading={loading && influencers.length === 0}
          rows={paginatedInfluencers}
          rowKey={(influencer) => influencer.id!}
          emptyTitle={searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูล Influencer'}
          emptyAction={
            !searchTerm ? (
              <Link href="/influencers/create">
                <Button variant="ghost" icon="Plus">เพิ่ม Influencer คนแรก</Button>
              </Link>
            ) : undefined
          }
          columns={[
            {
              key: 'influencer', header: 'Influencer', mobilePrimary: true,
              cell: (influencer) => (
                <div>
                  <p className="font-medium text-gray-900">{influencer.fullName}</p>
                  <p className="text-sm text-gray-500">{influencer.nickname}</p>
                  <div className="mt-1">
                    {/* Use the stored tier directly, don't recalculate */}
                    <StatusBadge status={influencer.tier || 'nano'} kind="tier" />
                  </div>
                </div>
              ),
            },
            {
              key: 'social', header: 'Social Media',
              cell: (influencer) => (
                <div className="flex flex-wrap gap-2">
                  {influencer.socialChannels?.slice(0, 4).map((channel) => {
                    const Icon = PLATFORM_ICONS[channel.platform]
                    const platformInfo = PLATFORM_INFO[channel.platform]

                    return (
                      <span
                        key={channel.id}
                        title={`${platformInfo.name}: ${formatFollowers(channel.followerCount)}`}
                      >
                        <Pill tone="neutral" className="gap-1">
                          {Icon ? (
                            <Icon className="w-4 h-4" style={{ color: platformInfo.color }} />
                          ) : (
                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: platformInfo.color }} />
                          )}
                          {formatFollowers(channel.followerCount)}
                        </Pill>
                      </span>
                    )
                  })}
                  {(influencer.socialChannels?.length || 0) > 4 && (
                    <span className="text-xs text-gray-500">
                      +{influencer.socialChannels!.length - 4}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'reach', header: 'Total Reach',
              cell: (influencer) => (
                <p className="font-semibold text-gray-900">{formatFollowers(influencer.totalFollowers)}</p>
              ),
            },
            {
              key: 'children', header: 'ข้อมูลลูก',
              cell: (influencer) =>
                influencer.children && influencer.children.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <Baby className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{influencer.children.length} คน</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                ),
            },
            {
              key: 'contact', header: 'ติดต่อ', hideOnMobile: true,
              cell: (influencer) => (
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">{influencer.phone}</p>
                  <p className="text-sm text-gray-500">{influencer.email}</p>
                </div>
              ),
            },
            {
              key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', mobileFooterAction: true,
              cell: (influencer) => (
                <ActionMenu
                  items={[
                    { label: 'ดูรายละเอียด', icon: 'Eye', onSelect: () => router.push(`/influencers/${influencer.id}`) },
                    { label: 'แก้ไขข้อมูล', icon: 'Pencil', onSelect: () => router.push(`/influencers/${influencer.id}/edit`) },
                    { kind: 'divider' },
                    { label: 'ลบ', icon: 'Trash2', onSelect: () => handleDelete(influencer.id!, influencer.fullName), tone: 'danger' },
                  ]}
                />
              ),
            },
          ]}
        />

        {/* Pagination */}
        {influencers.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <TableFooter page={currentPage} pageSize={itemsPerPage} total={influencers.length} onPageChange={setCurrentPage} onPageSizeChange={setItemsPerPage} />
          </div>
        )}
      </Card>
    </div>
  )
}
