// app/(admin)/settings/locations/[id]/edit/page.tsx

'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useLocation, useLocations } from '@/hooks/useLocations'
import LocationForm from '@/components/locations/LocationForm'
import { LocationFormData } from '@/types/location'
import { ArrowLeft, MapPin, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import TechLoader from '@/components/shared/TechLoader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'

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
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
          <AlertDescription>
            {error || 'ไม่พบสถานที่ที่ต้องการแก้ไข'}
          </AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <Link href="/settings/locations">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับไปหน้ารายการ
            </Button>
          </Link>
        </div>
      </div>
    )
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            แก้ไขสถานที่
          </h1>
          <p className="text-gray-600 mt-1">
            แก้ไขข้อมูล {location.name}
          </p>
        </div>
      </div>

      {/* Current Info Card */}
      <Card className={`border-0 shadow-md bg-gradient-to-r ${gradients.infoLight}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <MapPin className="w-5 h-5" />
            ข้อมูลปัจจุบัน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700 font-medium">ชื่อสถานที่</p>
              <p className="text-blue-900">{location.name}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">สถานะ</p>
              <p className="text-blue-900">{location.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">รัศมี</p>
              <p className="text-blue-900">{location.radius} เมตร</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">จำนวนกะ</p>
              <p className="text-blue-900">{location.shifts.length} กะ</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <LocationForm
        initialData={location}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}