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
  Calendar,
  FileText,
  Copy,
  ExternalLink,
  MessageSquare,
  DollarSign,
  Package,
  ShoppingBag,
  Users,
  Inbox,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TechLoader from '@/components/shared/TechLoader'
import { safeFormatDate } from '@/lib/utils/date'
import { th } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import {
  Textarea,
  Field,
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
import { PageHeader, StatusBadge, InfoPanel, ListRows, ListRow } from '@/components/shared'
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
  const { confirm, dialog } = useConfirm()

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
    const ok = await confirm({
      title: 'ต้องการยกเลิก Campaign นี้ใช่หรือไม่?',
      confirmLabel: 'ยกเลิก Campaign',
      cancelLabel: 'ไม่ใช่',
      tone: 'danger',
    })
    if (ok) {
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
      <div className="max-w-4xl px-4">
        <Alert
          tone="error"
          action={
            <Link href="/campaigns">
              <Button variant="soft" size="sm" icon="ChevronLeft">กลับไปหน้ารายการ</Button>
            </Link>
          }
        >
          {error || 'ไม่พบข้อมูล Campaign'}
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl px-4 space-y-4 md:space-y-6 pb-8">
      {dialog}

      {/* Header */}
      <PageHeader
        title={campaign.name}
        backHref="/campaigns"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} kind="campaign" />
            <span>•</span>
            <span>สร้างโดย {campaign.createdByName}</span>
          </span>
        }
        actions={
          <>
            {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
              <Button variant="soft" size="sm" icon="X" onClick={handleCancel}>
                ยกเลิก
              </Button>
            )}
            <Link href={`/campaigns/${id}/edit`}>
              <Button size="sm" icon="Pencil">แก้ไข</Button>
            </Link>
          </>
        }
      />

      {/* Campaign Info */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={FileText} tone="accent">รายละเอียด Campaign</CardTitle>
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
                variant="soft"
                size="sm"
                icon="FileText"
                iconRight="ExternalLink"
                onClick={() => window.open(campaign.briefFileUrl, '_blank')}
              >
                ดู Brief
              </Button>
            )}

            {campaign.trackingUrl && (
              <Button
                variant="soft"
                size="sm"
                icon="Link"
                iconRight="ExternalLink"
                onClick={() => window.open(campaign.trackingUrl, '_blank')}
              >
                Link ส่งของ
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
                  <Pill key={brandId} tone="plum">
                    {getBrandName(brandId)}
                  </Pill>
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
                  <Pill key={productId} tone="sky">
                    {getProductName(productId)}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Influencers & Submissions */}
      <div className="space-y-4">
        <CardTitle icon={Users} tone="pink">Influencers & ผลงาน</CardTitle>

        {campaign.influencers?.map((inf) => {
          const isReviewing = reviewingId === inf.influencerId
          const canReview = ['submitted', 'resubmitted'].includes(inf.submissionStatus)
          const busy = processingReview === inf.influencerId

          return (
            <Card padding={0} key={inf.influencerId} className={cn('transition-all', canReview && 'ring-2 ring-yellow-500')}>
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
                      <StatusBadge status={inf.submissionStatus} kind="submission" />
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Link:</span>
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                          {inf.submissionLink}
                        </code>
                        <IconButton
                          icon={Copy}
                          title="คัดลอก Link"
                          size={24}
                          onClick={() => copySubmissionLink(inf.submissionLink!)}
                        />
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

                    <ListRows variant="boxed">
                      {inf.submittedLinks.map((link, idx) => {
                        const platformIcon = link.platform
                          ? PLATFORM_ICONS[link.platform] || PLATFORM_ICONS.others
                          : PLATFORM_ICONS.others

                        return (
                          <ListRow
                            key={link.id || idx}
                            leading={<span className="text-xl flex-shrink-0">{platformIcon}</span>}
                            title={
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm text-blue-600 hover:text-blue-700 hover:underline truncate"
                              >
                                {link.url}
                              </a>
                            }
                            trailing={<ExternalLink className="w-4 h-4 text-gray-400" />}
                          />
                        )
                      })}
                    </ListRows>

                    {/* Review Actions */}
                    {canReview && (
                      <div className="pt-3 border-t">
                        {!isReviewing ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              size="sm"
                              icon="Check"
                              loading={busy}
                              onClick={() => handleReviewSubmission(inf.influencerId, 'approve')}
                            >
                              อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon="RefreshCw"
                              onClick={() => setReviewingId(inf.influencerId)}
                            >
                              ขอแก้ไข
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Field label="เหตุผลที่ต้องแก้ไข">
                              <Textarea
                                placeholder="ระบุรายละเอียดที่ต้องการให้แก้ไข..."
                                value={reviewNotes[inf.influencerId] || ''}
                                onChange={(e) => setReviewNotes({
                                  ...reviewNotes,
                                  [inf.influencerId]: e.target.value
                                })}
                                rows={3}
                              />
                            </Field>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                size="sm"
                                icon="Send"
                                loading={busy}
                                onClick={() => handleReviewSubmission(inf.influencerId, 'reject')}
                              >
                                ส่งคำขอแก้ไข
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setReviewingId(null)
                                  setReviewNotes({ ...reviewNotes, [inf.influencerId]: '' })
                                }}
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
                          <InfoPanel tone="accent" className="mt-2">
                            <p className="text-sm">
                              <MessageSquare className="w-4 h-4 inline mr-1" />
                              {inf.reviewNotes}
                            </p>
                          </InfoPanel>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    size="sm"
                    icon={<Inbox size={28} />}
                    body={inf.submissionStatus === 'pending' ? 'ยังไม่มีการส่งผลงาน' : 'รอส่งผลงาน'}
                  />
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* Empty state */}
        {(!campaign.influencers || campaign.influencers.length === 0) && (
          <Card>
            <EmptyState size="sm" icon={<Users size={28} />} title="ยังไม่มี Influencer ในแคมเปญนี้" />
          </Card>
        )}
      </div>
    </div>
  )
}
