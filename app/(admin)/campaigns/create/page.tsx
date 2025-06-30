// ========== FILE: app/(admin)/campaigns/create/page.tsx ==========
'use client'

import { useState } from 'react'
import { useCampaigns } from '@/hooks/useCampaigns'
import CampaignForm from '@/components/campaign/CampaignForm'

export default function CreateCampaignPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { createCampaign } = useCampaigns()

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      const campaignId = await createCampaign(data)
      return campaignId
    } catch (error) {
      console.error('Error creating campaign:', error)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CampaignForm
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  )
}