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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings/holidays">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            เพิ่มวันหยุด
          </h1>
          <p className="text-gray-600 mt-1">
            กำหนดวันหยุดและอัตรา OT
          </p>
        </div>
      </div>

      {/* Form */}
      <HolidayForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}