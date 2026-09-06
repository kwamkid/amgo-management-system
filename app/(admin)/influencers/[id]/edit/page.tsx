// app/(admin)/influencers/[id]/edit/page.tsx

'use client'

import { use, useState } from 'react'
import { useInfluencer, useInfluencers } from '@/hooks/useInfluencers'
import InfluencerForm from '@/components/influencer/InfluencerForm'
import TechLoader from '@/components/shared/TechLoader'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

import { Alert, Button } from '@/components/aoo'
export default function EditInfluencerPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { influencer, loading, error } = useInfluencer(id)
  const { updateInfluencer } = useInfluencers()

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      const success = await updateInfluencer(id, data)
      return success
    } catch (error) {
      console.error('Error updating influencer:', error)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !influencer) {
    return (
      <div className="max-w-4xl">
        <Alert tone="error">
          <div>
            <p className="mb-4 text-base">
              {error || 'ไม่พบข้อมูล Influencer'}
            </p>
            <Link href="/influencers"><Button variant="soft">
                <ArrowLeft className="w-4 h-4 mr-2" />
                กลับไปหน้ารายการ
              </Button></Link>
          </div>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <InfluencerForm
        influencer={influencer}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}