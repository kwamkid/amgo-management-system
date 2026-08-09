// app/(admin)/employees/invite-links/create/page.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInviteLinks } from '@/hooks/useInviteLinks'
import { CreateInviteLinkData } from '@/types/invite'
import InviteLinkForm from '@/components/invites/InviteLinkForm'
import { ArrowLeft, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import TechLoader from '@/components/shared/TechLoader'
import { PageHeader } from '@/components/shared'

export default function CreateInviteLinkPage() {
  const router = useRouter()
  const { createInviteLink } = useInviteLinks()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: CreateInviteLinkData): Promise<boolean> => {
    setIsSubmitting(true)
    const success = await createInviteLink(data)
    setIsSubmitting(false)
    
    if (success) {
      router.push('/employees/invite-links')
    }
    return success
  }

  const handleCancel = () => {
    router.push('/employees/invite-links')
  }

  if (isSubmitting) {
    return <TechLoader />
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="สร้าง Invite Link"
        description="สร้างลิงก์สำหรับเชิญพนักงานใหม่"
        icon={LinkIcon}
        backHref="/employees/invite-links"
      />

      {/* Form */}
      <InviteLinkForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}