// app/(admin)/settings/locations/[id]/edit/page.tsx

'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useLocation, useLocations } from '@/hooks/useLocations'
import LocationForm from '@/components/locations/LocationForm'
import { LocationFormData } from '@/types/location'
import { ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'

export default function EditLocationPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const router = useRouter()
  const { id } = use(params)
  const { location, loading, error } = useLocation(id)
  const { updateLocation } = useLocations()

  const handleSubmit = async (data: LocationFormData): Promise<boolean> => {
    const success = await updateLocation(id, data)
    if (success) {
      router.push('/settings/locations')
    }
    return success
  }

  const handleCancel = () => {
    router.push('/settings/locations')
  }

  if (loading) {
    return <TechLoader />
  }

  if (error || !location) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 mb-4 text-base">
            {error || 'ไม่พบสถานที่ที่ต้องการแก้ไข'}
          </p>
          <Link
            href="/settings/locations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้ารายการ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/settings/locations"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            แก้ไขสถานที่
          </h1>
          <p className="text-gray-600 mt-1 text-base">
            แก้ไขข้อมูล {location.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <LocationForm
        initialData={location}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}