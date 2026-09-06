// app/(admin)/settings/locations/create/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { useLocations } from '@/hooks/useLocations'
import LocationForm from '@/components/locations/LocationForm'
import { LocationFormData } from '@/types/location'
import { ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import { gradients } from '@/lib/theme/colors'
import { PageHeader } from '@/components/shared'

import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@/components/aoo'
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
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="เพิ่มสถานที่ใหม่"
        description="กำหนดข้อมูลสถานที่และเวลาทำงาน"
        icon={MapPin}
        backHref="/settings/locations"
      />

     

      {/* Form */}
      <LocationForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}