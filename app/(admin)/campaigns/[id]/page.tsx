// ========== FILE: app/(admin)/campaigns/[id]/page.tsx ==========
'use client'

import { use, useState } from 'react'
import { useCampaign, useCampaigns } from '@/hooks/useCampaigns'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import * as submissionService from '@/lib/services/submissionService'
import { 
  ArrowLeft,
  Edit,
  Calendar,
  Users,
  Package,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Eye,
  RefreshCw,
  Send,
  MessageSquare,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TechLoader from '@/components/shared/TechLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { safeFormatDate } from '@/lib/utils/date'
import { th } from 'date-fns/locale'
import { CampaignStatus, SubmissionStatus } from '@/types/influencer'
import { cn } from '@/lib/utils'

// Platform icons config
const PLATFORM_ICONS: Record<string, any> = {
  instagram: '📷',
  tiktok: '🎵',
  facebook: '👤',
  youtube: '📺',
  twitter: '🐦',
  lemon8: '🍋',
  website: '🌐',
  others: '🔗'
}

export default function CampaignDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const { campaign, loading, error } = useCampaign(id)
  const { updateInfluencerSubmission, cancelCampaign } = useCampaigns()
  
  const [activeTab, setActiveTab] = useState('overview')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [processingReview, setProcessingReview] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0) // Add refresh key for force update

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

  // Submission status config
  const submissionStatusConfig: Record<SubmissionStatus, {
    label: string
    color: string
    bgColor: string
  }> = {
    pending: { label: 'ยังไม่ส่ง', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    submitted: { label: 'รอตรวจสอบ', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    revision: { label: 'ต้องแก้ไข', color: 'text-orange-600', bgColor: 'bg-orange-100' },
    resubmitted: { label: 'ส่งแก้ไขแล้ว', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    approved: { label: 'ผ่าน', color: 'text-green-600', bgColor: 'bg-green-100' },
    cancelled: { label: 'ยกเลิก', color: 'text-red-600', bgColor: 'bg-red-100' }
  }

  // Copy submission link
  const copySubmissionLink = (code: string) => {
    const url = `${window.location.origin}/submit/${code}`
    navigator.clipboard.writeText(url)
      .then(() => showToast('คัดลอก Link สำเร็จ!', 'success'))
      .catch(() => showToast('ไม่สามารถคัดลอก Link ได้', 'error'))
  }

  // Handle review submission
  const handleReviewSubmission = async (
    influencerId: string,
    action: 'approve' | 'reject'
  ) => {
    if (!userData) return
    
    setProcessingReview(influencerId)
    
    try {
      const notes = action === 'reject' ? reviewNotes[influencerId] : undefined
      
      if (action === 'reject' && !notes) {
        showToast('กรุณาระบุเหตุผลที่ต้องแก้ไข', 'error')
        setProcessingReview(null)
        return
      }
      
      await submissionService.reviewSubmission(
        id,
        influencerId,
        action,
        userData.fullName || userData.lineDisplayName || 'Unknown',
        notes
      )
      
      showToast(
        action === 'approve' ? 'อนุมัติผลงานสำเร็จ' : 'ส่งคำขอแก้ไขสำเร็จ',
        'success'
      )
      
      // Clear review state
      setReviewingId(null)
      setReviewNotes({ ...reviewNotes, [influencerId]: '' })
      
      // Update local state immediately for better UX
      if (campaign && campaign.influencers) {
        const updatedInfluencers = campaign.influencers.map(inf => 
          inf.influencerId === influencerId 
            ? {
                ...inf,
                submissionStatus: action === 'approve' ? 'approved' : 'revision',
                reviewedAt: new Date(),
                reviewedBy: userData.fullName || userData.lineDisplayName || 'Unknown',
                reviewNotes: notes
              }
            : inf
        )
        
        // Force re-render with updated data
        campaign.influencers = updatedInfluencers
      }
      
      // Force component refresh
      setRefreshKey(prev => prev + 1)
      
      // Reload the page to get fresh data
      setTimeout(() => {
        router.refresh()
      }, 1000)
      
    } catch (error) {
      console.error('Error reviewing submission:', error)
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error')
    } finally {
      setProcessingReview(null)
    }
  }

  // Handle cancel
  const handleCancel = async () => {
    if (confirm('ต้องการยกเลิก Campaign นี้ใช่หรือไม่?')) {
      const success = await cancelCampaign(id)
      if (success) {
        router.push('/campaigns')
      }
    }
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !campaign) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="mb-4 text-base">
              {error || 'ไม่พบข้อมูล Campaign'}
            </p>
            <Button
              asChild
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-700"
            >
              <Link href="/campaigns">
                <ArrowLeft className="w-4 h-4 mr-2" />
                กลับไปหน้ารายการ
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const status = statusConfig[campaign.status]
  const StatusIcon = status.icon

  // Calculate stats
  const totalInfluencers = campaign.influencers?.length || 0
  const submittedCount = campaign.influencers?.filter(
    inf => ['submitted', 'resubmitted', 'approved'].includes(inf.submissionStatus)
  ).length || 0
  const approvedCount = campaign.influencers?.filter(
    inf => inf.submissionStatus === 'approved'
  ).length || 0
  const needsReviewCount = campaign.influencers?.filter(
    inf => ['submitted', 'resubmitted'].includes(inf.submissionStatus)
  ).length || 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/campaigns')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {campaign.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${status.bgColor} ${status.color}`}>
                <StatusIcon className="w-4 h-4 mr-1" />
                {status.label}
              </Badge>
              <span className="text-gray-500">•</span>
              <span className="text-sm text-gray-600">
                สร้างโดย {campaign.createdByName}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={handleCancel}
            >
              <XCircle className="w-4 h-4 mr-2" />
              ยกเลิก
            </Button>
          )}
          <Button
            asChild
            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
          >
            <Link href={`/campaigns/${id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              แก้ไข
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Influencers</p>
            <p className="text-2xl font-bold text-gray-900">{totalInfluencers}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">ส่งแล้ว</p>
            <p className="text-2xl font-bold text-gray-900">
              {submittedCount}/{totalInfluencers}
            </p>
          </CardContent>
        </Card>
        
        <Card className={needsReviewCount > 0 ? 'ring-2 ring-yellow-500' : ''}>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">รอตรวจสอบ</p>
            <p className="text-2xl font-bold text-yellow-600">
              {needsReviewCount}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">ผ่านแล้ว</p>
            <p className="text-2xl font-bold text-green-600">
              {approvedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="influencers" className="relative">
            Influencers ({totalInfluencers})
            {needsReviewCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
          {(campaign.status === 'reviewing' || campaign.status === 'completed' || submittedCount > 0) && (
            <TabsTrigger value="review" className="relative">
              ตรวจสอบผลงาน
              {needsReviewCount > 0 && (
                <Badge variant="warning" className="ml-2">
                  {needsReviewCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Campaign Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">รายละเอียด Campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">คำอธิบาย</p>
                <p className="mt-1">{campaign.description}</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    วันที่เริ่ม
                  </p>
                  <p className="mt-1 font-medium">
                    {safeFormatDate(campaign.startDate, 'dd MMMM yyyy', { locale: th })}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Deadline
                  </p>
                  <p className="mt-1 font-medium">
                    {safeFormatDate(campaign.deadline, 'dd MMMM yyyy', { locale: th })}
                  </p>
                </div>
              </div>
              
              {campaign.briefFileUrl && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Brief File</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(campaign.briefFileUrl, '_blank')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    ดู Brief
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
              
              {campaign.trackingUrl && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Link สำหรับบิลส่งของ</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(campaign.trackingUrl, '_blank')}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    ดู Link Tracking
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brands & Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brands & สินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Brands ({campaign.brands?.length || 0})</p>
                  <div className="flex flex-wrap gap-2">
                    {campaign.brands?.map(brandId => (
                      <Badge key={brandId} variant="secondary">
                        {brandId}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-2">สินค้า ({campaign.products?.length || 0})</p>
                  <div className="flex flex-wrap gap-2">
                    {campaign.products?.map(productId => (
                      <Badge key={productId} variant="secondary">
                        {productId}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Influencers Tab */}
        <TabsContent value="influencers">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                      Influencer
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                      สถานะ
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                      Submission Link
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">
                      วันที่ส่ง
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaign.influencers?.map((inf) => {
                    const subStatus = submissionStatusConfig[inf.submissionStatus]
                    
                    return (
                      <tr key={inf.influencerId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium">{inf.influencerName || 'Unknown'}</p>
                          {inf.influencerNickname && (
                            <p className="text-sm text-gray-600">@{inf.influencerNickname}</p>
                          )}
                        </td>
                        
                        <td className="px-6 py-4">
                          <Badge className={`${subStatus.bgColor} ${subStatus.color}`}>
                            {subStatus.label}
                          </Badge>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {inf.submissionLink}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => copySubmissionLink(inf.submissionLink!)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          {inf.submittedAt ? (
                            <span className="text-sm">
                              {safeFormatDate(inf.submittedAt, 'dd/MM/yyyy HH:mm')}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          {['submitted', 'resubmitted'].includes(inf.submissionStatus) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setActiveTab('review')
                                setTimeout(() => {
                                  const element = document.getElementById(`review-${inf.influencerId}`)
                                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }, 100)
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              ตรวจสอบ
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Review Tab */}
        {(campaign.status === 'reviewing' || campaign.status === 'completed' || submittedCount > 0) && (
          <TabsContent value="review" className="space-y-4" key={refreshKey}>
            {campaign.influencers?.filter(inf => 
              ['submitted', 'resubmitted', 'approved', 'revision'].includes(inf.submissionStatus)
            ).map((inf) => {
              const subStatus = submissionStatusConfig[inf.submissionStatus]
              const isReviewing = reviewingId === inf.influencerId
              const canReview = ['submitted', 'resubmitted'].includes(inf.submissionStatus)
              
              return (
                <Card 
                  key={inf.influencerId} 
                  id={`review-${inf.influencerId}`}
                  className={cn(
                    "transition-all",
                    canReview && "ring-2 ring-yellow-500"
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {inf.influencerName}
                            {inf.influencerNickname && (
                              <span className="text-gray-500 font-normal"> (@{inf.influencerNickname})</span>
                            )}
                          </h3>
                          <Badge className={`${subStatus.bgColor} ${subStatus.color} mt-1`}>
                            {subStatus.label}
                          </Badge>
                        </div>
                      </div>
                      
                      {inf.submittedAt && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">ส่งเมื่อ</p>
                          <p className="text-sm font-medium">
                            {safeFormatDate(inf.submittedAt, 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Submitted Links */}
                    {inf.submittedLinks && inf.submittedLinks.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          ผลงานที่ส่ง ({inf.submittedLinks.length} links)
                        </p>
                        
                        <div className="grid gap-2">
                          {inf.submittedLinks.map((link, idx) => (
                            <div 
                              key={link.id || idx}
                              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <span className="text-2xl">
                                {PLATFORM_ICONS[link.platform] || PLATFORM_ICONS.others}
                              </span>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-sm text-blue-600 hover:text-blue-700 hover:underline truncate"
                              >
                                {link.url}
                              </a>
                              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </div>
                          ))}
                        </div>
                        
                        {/* Review Actions */}
                        {canReview && (
                          <div className="mt-4 pt-4 border-t">
                            {!isReviewing ? (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleReviewSubmission(inf.influencerId, 'approve')}
                                  disabled={processingReview === inf.influencerId}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {processingReview === inf.influencerId ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                  )}
                                  อนุมัติ
                                </Button>
                                <Button
                                  onClick={() => setReviewingId(inf.influencerId)}
                                  variant="outline"
                                  className="text-orange-600 hover:bg-orange-50"
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  ขอแก้ไข
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <Label>เหตุผลที่ต้องแก้ไข</Label>
                                  <Textarea
                                    placeholder="ระบุรายละเอียดที่ต้องการให้แก้ไข..."
                                    value={reviewNotes[inf.influencerId] || ''}
                                    onChange={(e) => setReviewNotes({
                                      ...reviewNotes,
                                      [inf.influencerId]: e.target.value
                                    })}
                                    className="mt-1"
                                    rows={3}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleReviewSubmission(inf.influencerId, 'reject')}
                                    disabled={processingReview === inf.influencerId}
                                    className="bg-orange-600 hover:bg-orange-700"
                                  >
                                    {processingReview === inf.influencerId ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Send className="w-4 h-4 mr-2" />
                                    )}
                                    ส่งคำขอแก้ไข
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setReviewingId(null)
                                      setReviewNotes({ ...reviewNotes, [inf.influencerId]: '' })
                                    }}
                                    variant="outline"
                                  >
                                    ยกเลิก
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Review History */}
                        {inf.reviewedAt && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm text-gray-600">
                              {inf.submissionStatus === 'approved' ? 'อนุมัติโดย' : 'ตรวจสอบโดย'}: {inf.reviewedBy}
                            </p>
                            <p className="text-xs text-gray-500">
                              {safeFormatDate(inf.reviewedAt, 'dd/MM/yyyy HH:mm')}
                            </p>
                            {inf.reviewNotes && (
                              <div className="mt-2 p-3 bg-orange-50 rounded-lg">
                                <p className="text-sm text-orange-800">
                                  <MessageSquare className="w-4 h-4 inline mr-1" />
                                  {inf.reviewNotes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        ยังไม่มีการส่งผลงาน
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            
            {/* Empty State */}
            {!campaign.influencers?.some(inf => 
              ['submitted', 'resubmitted', 'approved', 'revision'].includes(inf.submissionStatus)
            ) && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Send className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      ยังไม่มี Influencer ส่งผลงาน
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}