// ========== FILE: app/(admin)/campaigns/[id]/edit/page.tsx ==========
'use client'

import { use, useState } from 'react'
import { useCampaign, useCampaigns } from '@/hooks/useCampaigns'
import CampaignForm from '@/components/campaign/CampaignForm'
import TechLoader from '@/components/shared/TechLoader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function EditCampaignPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { campaign, loading, error } = useCampaign(id)
  const { updateCampaign } = useCampaigns()

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      // Clean data - remove undefined values
      const cleanData: any = {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        deadline: data.deadline,
        brands: data.brandIds || [],
        products: data.productIds || []
      }
      
      // Only add optional fields if they have values
      if (data.budget !== undefined && data.budget !== null && data.budget !== '') {
        cleanData.budget = data.budget
      }
      if (data.briefFileUrl) {
        cleanData.briefFileUrl = data.briefFileUrl
      }
      if (data.trackingUrl) {
        cleanData.trackingUrl = data.trackingUrl
      }
      
      // For edit mode, we need to preserve existing influencer data
      cleanData.influencers = data.influencerIds.map((influencerId: string) => {
        // Find existing influencer data or create new
        const existing = campaign?.influencers?.find(inf => inf.influencerId === influencerId)
        return existing || {
          influencerId,
          influencerName: '', // Will need to be filled from influencer data
          assignedAt: new Date(),
          submissionStatus: 'pending' as const,
          submissionLink: `${Date.now()}-${influencerId}`
        }
      })
      
      const success = await updateCampaign(id, cleanData)
      return success
    } catch (error) {
      console.error('Error updating campaign:', error)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !campaign) {
    return (
      <div className="max-w-2xl mx-auto">
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

  return (
    <CampaignForm
      campaign={campaign}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  )
}