// app/(admin)/employees/invite-links/create/page.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInviteLinks } from '@/hooks/useInviteLinks'
import { CreateInviteLinkData } from '@/types/invite'
import InviteLinkForm from '@/components/invites/InviteLinkForm'
import { ArrowLeft, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/employees/invite-links"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <LinkIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              สร้าง Invite Link
            </h1>
            <p className="text-gray-600 mt-1">
              สร้างลิงก์สำหรับเชิญพนักงานใหม่
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <InviteLinkForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}