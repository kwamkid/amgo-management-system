// app/(admin)/influencers/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useInfluencers, useInfluencerStats } from '@/hooks/useInfluencers'
import { 
  InfluencerTier, 
  SocialPlatform, 
  PLATFORM_INFO,
  calculateInfluencerTier
} from '@/types/influencer'
import { 
  Users, 
  Search, 
  Plus,
  Edit,
  Trash2,
  Eye,
  Baby,
  TrendingUp,
  Filter,
  Facebook,
  Instagram,
  Music2,
  Youtube,
  MoreVertical
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TechLoader from '@/components/shared/TechLoader'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchInfluencers(searchTerm)
      }
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Format follower count
  const formatFollowers = (count?: number) => {
    if (!count) return '0'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  // Get tier badge
  const getTierBadge = (tier: InfluencerTier) => {
    const tierConfig = {
      nano: { label: 'Nano', variant: 'secondary' as const },
      micro: { label: 'Micro', variant: 'info' as const },
      macro: { label: 'Macro', variant: 'warning' as const },
      mega: { label: 'Mega', variant: 'error' as const }
    }
    
    const config = tierConfig[tier] || tierConfig.nano
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`ต้องการลบ ${name} ใช่หรือไม่?`)) {
      await deleteInfluencer(id)
    }
  }

  if (loading && influencers.length === 0) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            จัดการ Influencers
          </h1>
          <p className="text-gray-600 mt-1">
            ฐานข้อมูล Influencer และข้อมูลลูก
          </p>
        </div>
        
        <Button
          asChild
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          <Link href="/influencers/create">
            <Plus className="w-5 h-5 mr-2" />
            เพิ่ม Influencer
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">ทั้งหมด</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Mega</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.byTier.mega}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-violet-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Macro</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.byTier.macro}</p>
                </div>
                <Users className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-orange-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700">Total Reach</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {formatFollowers(stats.totalReach)}
                  </p>
                </div>
                <Eye className="w-8 h-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="ค้นหาชื่อ, ชื่อเล่น, อีเมล, เบอร์โทร..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select
          value={tierFilter}
          onValueChange={setTierFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ทุกระดับ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกระดับ</SelectItem>
            <SelectItem value="nano">Nano (&lt;10K)</SelectItem>
            <SelectItem value="micro">Micro (10K-100K)</SelectItem>
            <SelectItem value="macro">Macro (100K-1M)</SelectItem>
            <SelectItem value="mega">Mega (&gt;1M)</SelectItem>
          </SelectContent>
        </Select>
        
        <Select
          value={platformFilter}
          onValueChange={setPlatformFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ทุก Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุก Platform</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="twitter">Twitter/X</SelectItem>
            <SelectItem value="lemon8">Lemon8</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Influencer List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                  Influencer
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                  Social Media
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                  Total Reach
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                  ข้อมูลลูก
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                  ติดต่อ
                </th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {influencers.map((influencer) => {
                // Use the stored tier directly, don't recalculate
                const displayTier = influencer.tier || 'nano'
                
                return (
                  <tr key={influencer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {influencer.fullName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {influencer.nickname}
                        </p>
                        <div className="mt-1">
                          {getTierBadge(displayTier)}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {influencer.socialChannels?.slice(0, 4).map((channel) => {
                          const Icon = PLATFORM_ICONS[channel.platform]
                          const platformInfo = PLATFORM_INFO[channel.platform]
                          
                          return (
                            <div
                              key={channel.id}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full"
                              title={`${platformInfo.name}: ${formatFollowers(channel.followerCount)}`}
                            >
                              {Icon ? (
                                <Icon 
                                  className="w-4 h-4" 
                                  style={{ color: platformInfo.color }}
                                />
                              ) : (
                                <div 
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: platformInfo.color }}
                                />
                              )}
                              <span className="text-xs font-medium">
                                {formatFollowers(channel.followerCount)}
                              </span>
                            </div>
                          )
                        })}
                        {(influencer.socialChannels?.length || 0) > 4 && (
                          <span className="text-xs text-gray-500">
                            +{influencer.socialChannels!.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {formatFollowers(influencer.totalFollowers)}
                      </p>
                    </td>
                    
                    <td className="px-6 py-4">
                      {influencer.children && influencer.children.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <Baby className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {influencer.children.length} คน
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">{influencer.phone}</p>
                        <p className="text-sm text-gray-500">{influencer.email}</p>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu
                        items={[
                          {
                            label: (
                              <Link 
                                href={`/influencers/${influencer.id}`} 
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
                                href={`/influencers/${influencer.id}/edit`} 
                                className="flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                แก้ไขข้อมูล
                              </Link>
                            ),
                            onClick: () => {}
                          },
                          { divider: true },
                          {
                            label: (
                              <span className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                ลบ
                              </span>
                            ),
                            onClick: () => handleDelete(influencer.id!, influencer.fullName),
                            className: 'text-red-600 hover:bg-red-50'
                          }
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {/* Empty State */}
        {influencers.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูล Influencer'}
            </p>
            {!searchTerm && (
              <Button
                asChild
                variant="ghost"
                className="mt-4 text-red-600 hover:bg-red-50"
              >
                <Link href="/influencers/create">
                  <Plus className="w-5 h-5 mr-2" />
                  เพิ่ม Influencer คนแรก
                </Link>
              </Button>
            )}
          </div>
        )}
        
        {/* Load More */}
        {hasMore && influencers.length > 0 && (
          <div className="p-4 text-center border-t border-gray-100">
            <Button
              onClick={loadMore}
              disabled={loading}
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
            >
              {loading ? 'กำลังโหลด...' : 'แสดงเพิ่มเติม'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}