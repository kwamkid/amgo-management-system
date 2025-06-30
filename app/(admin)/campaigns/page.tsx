// ========== FILE: app/(admin)/campaigns/page.tsx ==========
'use client'

import { useState } from 'react'
import { useCampaigns, useCampaignStats } from '@/hooks/useCampaigns'
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
  FileText
} from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CampaignStatus } from '@/types/influencer'

export default function CampaignsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  
  const { campaigns, loading, cancelCampaign } = useCampaigns()
  const { stats } = useCampaignStats()

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

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

  // Copy submission link
  const copySubmissionLink = (code: string) => {
    const url = `${window.location.origin}/submit/${code}`
    navigator.clipboard.writeText(url)
      .then(() => alert('คัดลอก Link สำเร็จ!'))
      .catch(() => alert('ไม่สามารถคัดลอก Link ได้'))
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">กำลังดำเนินการ</p>
                <p className="text-2xl font-bold text-blue-900">{stats.byStatus.active}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-yellow-50 to-amber-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">รอตรวจสอบ</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.byStatus.reviewing}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">เสร็จสิ้น</p>
                <p className="text-2xl font-bold text-green-900">{stats.byStatus.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="ค้นหาชื่อ Campaign..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="active">กำลังดำเนินการ</TabsTrigger>
            <TabsTrigger value="reviewing">รอตรวจสอบ</TabsTrigger>
            <TabsTrigger value="completed">เสร็จสิ้น</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Campaign List */}
      <div className="grid gap-4">
        {filteredCampaigns.map((campaign) => {
          const status = statusConfig[campaign.status]
          const StatusIcon = status.icon
          
          // Calculate progress
          const totalInfluencers = campaign.influencers?.length || 0
          const submittedCount = campaign.influencers?.filter(
            inf => ['submitted', 'approved'].includes(inf.submissionStatus)
          ).length || 0
          const progress = totalInfluencers > 0 
            ? Math.round((submittedCount / totalInfluencers) * 100)
            : 0

          return (
            <Card key={campaign.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${status.bgColor}`}>
                      <StatusIcon className={`w-6 h-6 ${status.color}`} />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {campaign.name}
                      </h3>
                      
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {campaign.description}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-4 mt-3">
                        <Badge className={`${status.bgColor} ${status.color}`}>
                          {status.label}
                        </Badge>
                        
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(campaign.startDate), 'dd MMM', { locale: th })} - 
                            {format(new Date(campaign.deadline), 'dd MMM yyyy', { locale: th })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Users className="w-4 h-4" />
                          <span>{totalInfluencers} Influencers</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Package className="w-4 h-4" />
                          <span>{campaign.brands?.length || 0} Brands</span>
                        </div>
                        
                        {campaign.budget && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <DollarSign className="w-4 h-4" />
                            <span>฿{campaign.budget.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Progress Bar */}
                      {campaign.status === 'active' && totalInfluencers > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600">ความคืบหน้า</span>
                            <span className="font-medium">{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-red-500 to-rose-600 h-2 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
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
                          แก้ไข Campaign
                        </Link>
                      ),
                      onClick: () => {}
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
                    ...(campaign.influencers?.map(inf => ({
                      label: (
                        <span className="flex items-center gap-2">
                          <Copy className="w-4 h-4" />
                          Copy link: {inf.influencerName}
                        </span>
                      ),
                      onClick: () => copySubmissionLink(inf.submissionLink!),
                      className: 'text-sm'
                    })) || []),
                    { divider: true },
                    {
                      label: (
                        <span className="flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          ยกเลิก Campaign
                        </span>
                      ),
                      onClick: () => handleCancelCampaign(campaign.id!, campaign.name),
                      className: 'text-red-600 hover:bg-red-50',
                      disabled: campaign.status === 'cancelled' || campaign.status === 'completed'
                    }
                  ]}
                />
              </div>
            </Card>
          )
        })}
      </div>
      
      {/* Empty State */}
      {filteredCampaigns.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'ไม่พบ Campaign ที่ค้นหา' 
              : 'ยังไม่มี Campaign'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
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
    </div>
  )
}



