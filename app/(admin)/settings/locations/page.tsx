// app/(admin)/settings/locations/page.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocations } from '@/hooks/useLocations'
import { Location } from '@/types/location'
import { 
  MapPin, 
  Plus, 
  Search, 
  Clock, 
  Calendar,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  Building
} from 'lucide-react'
import TechLoader from '@/components/shared/TechLoader'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import DropdownMenu from '@/components/ui/DropdownMenu'
import { gradients, colorClasses } from '@/lib/theme/colors'

export default function LocationsPage() {
  const router = useRouter()
  const { locations, loading, deleteLocation } = useLocations()
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const filteredLocations = locations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         location.address.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesActive = showInactive || location.isActive
    return matchesSearch && matchesActive
  })

  const handleDelete = async (location: Location) => {
    if (confirm(`ต้องการลบสถานที่ "${location.name}" ใช่หรือไม่?`)) {
      await deleteLocation(location.id)
    }
  }

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            จัดการสถานที่
          </h1>
          <p className="text-gray-600 mt-1">
            จัดการสาขาและสถานที่ทำงานของพนักงาน
          </p>
        </div>
        
        <Link href="/settings/locations/create">
          <Button className={`bg-gradient-to-r ${gradients.primary}`}>
            <Plus className="w-5 h-5 mr-2" />
            เพิ่มสถานที่
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{locations.length}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.primaryLight} rounded-xl`}>
                <Building className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ใช้งาน</p>
                <p className="text-2xl font-bold text-teal-600 mt-1">
                  {locations.filter(l => l.isActive).length}
                </p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.successLight} rounded-xl`}>
                <Eye className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ปิดใช้งาน</p>
                <p className="text-2xl font-bold text-gray-500 mt-1">
                  {locations.filter(l => !l.isActive).length}
                </p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.grayLight} rounded-xl`}>
                <EyeOff className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">กะทั้งหมด</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {locations.reduce((acc, loc) => acc + loc.shifts.length, 0)}
                </p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.purpleLight} rounded-xl`}>
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="ค้นหาชื่อสถานที่หรือที่อยู่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Button
              onClick={() => setShowInactive(!showInactive)}
              variant={showInactive ? "default" : "outline"}
              className={showInactive ? `bg-gradient-to-r ${gradients.gray}` : ''}
            >
              {showInactive ? <Eye className="w-5 h-5 mr-2" /> : <EyeOff className="w-5 h-5 mr-2" />}
              {showInactive ? 'แสดงทั้งหมด' : 'เฉพาะที่ใช้งาน'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Locations Grid */}
      {filteredLocations.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'ไม่พบสถานที่ที่ค้นหา' : 'ยังไม่มีสถานที่'}
              </p>
              {!searchTerm && (
                <Link href="/settings/locations/create">
                  <Button variant="outline" className="mt-4">
                    <Plus className="w-5 h-5 mr-2" />
                    เพิ่มสถานที่แรก
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLocations.map((location) => (
            <Card
              key={location.id}
              className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
                !location.isActive && 'opacity-75'
              }`}
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{location.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {location.address}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!location.isActive && (
                      <Badge variant="error">ปิดใช้งาน</Badge>
                    )}
                    <DropdownMenu
                      items={[
                        {
                          label: (
                            <span className="flex items-center gap-2 text-gray-700">
                              <Edit className="w-4 h-4" />
                              แก้ไข
                            </span>
                          ),
                          onClick: () => router.push(`/settings/locations/${location.id}/edit`)
                        },
                        { divider: true },
                        {
                          label: (
                            <span className="flex items-center gap-2 text-red-600">
                              <Trash2 className="w-4 h-4" />
                              ลบ
                            </span>
                          ),
                          onClick: () => handleDelete(location),
                          className: 'text-red-600 hover:bg-red-50'
                        }
                      ]}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>รัศมี {location.radius} เมตร</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{location.shifts.length} กะการทำงาน</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>พักกลางวัน {location.breakHours} ชั่วโมง</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <Link href={`/settings/locations/${location.id}/edit`}>
                    <Button variant="outline" className="w-full">
                      <Edit className="w-4 h-4 mr-2" />
                      จัดการสถานที่
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}