// app/(admin)/influencers/create/page.tsx

'use client'

import { useState } from 'react'
import { useInfluencers } from '@/hooks/useInfluencers'
import InfluencerForm from '@/components/influencer/InfluencerForm'
import TechLoader from '@/components/shared/TechLoader'

export default function CreateInfluencerPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { createInfluencer } = useInfluencers()

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      const influencerId = await createInfluencer(data)
      return influencerId // Will redirect to edit page if successful
    } catch (error) {
      console.error('Error creating influencer:', error)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitting) {
    return <TechLoader />
  }

  return (
    <div className="max-w-4xl mx-auto">
      <InfluencerForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}