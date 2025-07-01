// ========== FILE: app/(admin)/campaigns/[id]/page.tsx ==========
'use client'

import { use, useState } from 'react'
import { useCampaign, useCampaigns } from '@/hooks/useCampaigns'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useBrands } from '@/hooks/useBrands'
import { useProducts } from '@/hooks/useProducts'
import * as submissionService from '@/lib/services/submissionService'
import { 
  ArrowLeft,
  Edit,
  Calendar,
  FileText,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Send,
  MessageSquare,
  Loader2,
  DollarSign,
  Package,
  ShoppingBag
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TechLoader from '@/components/shared/TechLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  const { brands } = useBrands()
  const { products } = useProducts()
  
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [processingReview, setProcessingReview] = useState<string | null>(null)

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
    revising: { 
      label: 'รอแก้ไข', 
      icon: Edit, 
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
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
      
      // Reload the page to get fresh data
      setTimeout(() => {
        router.refresh()
        window.location.reload()
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

  // Get brand/product names
  const getBrandName = (brandId: string) => {
    return brands.find(b => b.id === brandId)?.name || brandId
  }

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || productId
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !campaign) {
    return (
      <div className="max-w-4xl mx-auto px-4">
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

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/campaigns')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 break-words">
              {campaign.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge className={`${status.bgColor} ${status.color}`}>
                <StatusIcon className="w-4 h-4 mr-1" />
                {status.label}
              </Badge>
              <span className="text-gray-500 text-sm">•</span>
              <span className="text-sm text-gray-600">
                สร้างโดย {campaign.createdByName}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 self-end sm:self-auto">
          {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={handleCancel}
            >
              <XCircle className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">ยกเลิก</span>
              <span className="sm:hidden">ยกเลิก</span>
            </Button>
          )}
          <Button
            asChild
            size="sm"
            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
          >
            <Link href={`/campaigns/${id}/edit`}>
              <Edit className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">แก้ไข</span>
              <span className="sm:hidden">แก้ไข</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียด Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Description */}
          <div>
            <p className="text-sm text-gray-600 mb-1">คำอธิบาย</p>
            <p className="text-gray-900">{campaign.description}</p>
          </div>
          
          {/* Timeline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                <Calendar className="w-4 h-4" />
                วันที่เริ่ม
              </p>
              <p className="font-medium">
                {safeFormatDate(campaign.startDate, 'dd MMMM yyyy', { locale: th })}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                <Calendar className="w-4 h-4" />
                Deadline
              </p>
              <p className="font-medium">
                {safeFormatDate(campaign.deadline, 'dd MMMM yyyy', { locale: th })}
              </p>
            </div>
          </div>

          {/* Budget */}
          {campaign.budget && (
            <div>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
                <DollarSign className="w-4 h-4" />
                งบประมาณ
              </p>
              <p className="font-medium">฿{campaign.budget.toLocaleString()}</p>
            </div>
          )}
          
          {/* Files */}
          <div className="flex flex-col sm:flex-row gap-2">
            {campaign.briefFileUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(campaign.briefFileUrl, '_blank')}
                className="justify-start"
              >
                <FileText className="w-4 h-4 mr-2" />
                ดู Brief
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            )}
            
            {campaign.trackingUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(campaign.trackingUrl, '_blank')}
                className="justify-start"
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Link ส่งของ
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            )}
          </div>
          
          {/* Brands & Products */}
          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                <Package className="w-4 h-4" />
                Brands ({campaign.brands?.length || 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {campaign.brands?.map(brandId => (
                  <Badge key={brandId} variant="secondary" className="text-xs">
                    {getBrandName(brandId)}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                <ShoppingBag className="w-4 h-4" />
                สินค้า ({campaign.products?.length || 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {campaign.products?.map(productId => (
                  <Badge key={productId} variant="secondary" className="text-xs">
                    {getProductName(productId)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Influencers & Submissions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Influencers & ผลงาน</h2>
        
        {campaign.influencers?.map((inf) => {
          const subStatus = submissionStatusConfig[inf.submissionStatus]
          const isReviewing = reviewingId === inf.influencerId
          const canReview = ['submitted', 'resubmitted'].includes(inf.submissionStatus)
          
          return (
            <Card 
              key={inf.influencerId}
              className={cn(
                "transition-all",
                canReview && "ring-2 ring-yellow-500"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {inf.influencerName}
                      {inf.influencerNickname && (
                        <span className="text-gray-500 font-normal text-base"> (@{inf.influencerNickname})</span>
                      )}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge className={`${subStatus.bgColor} ${subStatus.color} text-xs`}>
                        {subStatus.label}
                      </Badge>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Link:</span>
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                          {inf.submissionLink}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => copySubmissionLink(inf.submissionLink!)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {inf.submittedAt && (
                    <div className="text-right text-sm">
                      <p className="text-gray-600">ส่งเมื่อ</p>
                      <p className="font-medium">
                        {safeFormatDate(inf.submittedAt, 'dd/MM/yy HH:mm')}
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Submitted Links */}
                {inf.submittedLinks && inf.submittedLinks.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">
                      ผลงานที่ส่ง ({inf.submittedLinks.length} links)
                    </p>
                    
                    <div className="space-y-2">
                      {inf.submittedLinks.map((link, idx) => {
                        const platformIcon = link.platform 
                          ? PLATFORM_ICONS[link.platform] || PLATFORM_ICONS.others
                          : PLATFORM_ICONS.others
                        
                        return (
                          <div 
                            key={link.id || idx}
                            className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-xl flex-shrink-0">
                              {platformIcon}
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
                        )
                      })}
                    </div>
                    
                    {/* Review Actions */}
                    {canReview && (
                      <div className="pt-3 border-t">
                        {!isReviewing ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              onClick={() => handleReviewSubmission(inf.influencerId, 'approve')}
                              disabled={processingReview === inf.influencerId}
                              className="bg-green-600 hover:bg-green-700"
                              size="sm"
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
                              size="sm"
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              ขอแก้ไข
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-sm">เหตุผลที่ต้องแก้ไข</Label>
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
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                onClick={() => handleReviewSubmission(inf.influencerId, 'reject')}
                                disabled={processingReview === inf.influencerId}
                                className="bg-orange-600 hover:bg-orange-700"
                                size="sm"
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
                                size="sm"
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
                      <div className="pt-3 border-t">
                        <p className="text-sm text-gray-600">
                          {inf.submissionStatus === 'approved' ? 'อนุมัติโดย' : 'ตรวจสอบโดย'}: {inf.reviewedBy}
                        </p>
                        <p className="text-xs text-gray-500">
                          {safeFormatDate(inf.reviewedAt, 'dd/MM/yyyy HH:mm')}
                        </p>
                        {inf.reviewNotes && (
                          <div className="mt-2 p-2.5 bg-orange-50 rounded-lg">
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
                  <div className="text-center py-6">
                    <p className="text-gray-500 text-sm">
                      {inf.submissionStatus === 'pending' 
                        ? 'ยังไม่มีการส่งผลงาน' 
                        : 'รอส่งผลงาน'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
        
        {/* Empty state */}
        {(!campaign.influencers || campaign.influencers.length === 0) && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-gray-500">
                ยังไม่มี Influencer ในแคมเปญนี้
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}