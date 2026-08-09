// app/(admin)/settings/holidays/create/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { useHolidays } from '@/hooks/useHolidays'
import HolidayForm from '@/components/holidays/HolidayForm'
import { HolidayFormData } from '@/types/holiday'
import { ArrowLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { gradients } from '@/lib/theme/colors'
import { PageHeader } from '@/components/shared'

export default function CreateHolidayPage() {
  const router = useRouter()
  const { createHoliday } = useHolidays()

  const handleSubmit = async (data: HolidayFormData): Promise<boolean> => {
    const success = await createHoliday(data)
    if (success) {
      router.push('/settings/holidays')
    }
    return success
  }

  const handleCancel = () => {
    router.push('/settings/holidays')
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="เพิ่มวันหยุด"
        description="กำหนดวันหยุดและอัตรา OT"
        icon={Calendar}
        backHref="/settings/holidays"
      />

      {/* Form */}
      <HolidayForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}