// app/(admin)/settings/locations/create/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { useLocations } from '@/hooks/useLocations'
import LocationForm from '@/components/locations/LocationForm'
import { LocationFormData } from '@/types/location'
import { ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { gradients } from '@/lib/theme/colors'

export default function CreateLocationPage() {
  const router = useRouter()
  const { createLocation } = useLocations()

  const handleSubmit = async (data: LocationFormData): Promise<boolean> => {
    const success = await createLocation(data)
    if (success) {
      router.push('/settings/locations')
    }
    return success
  }

  const handleCancel = () => {
    router.push('/settings/locations')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings/locations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            เพิ่มสถานที่ใหม่
          </h1>
          <p className="text-gray-600 mt-1">
            กำหนดข้อมูลสถานที่และเวลาทำงาน
          </p>
        </div>
      </div>

     

      {/* Form */}
      <LocationForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}