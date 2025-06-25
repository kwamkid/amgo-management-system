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
  MoreVertical
} from 'lucide-react'
import TechLoader from '@/components/shared/TechLoader'
import Link from 'next/link'

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
        
        <Link
          href="/settings/locations/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          เพิ่มสถานที่
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสถานที่หรือที่อยู่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
            showInactive 
              ? 'bg-gray-100 border-gray-300 text-gray-700' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {showInactive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          {showInactive ? 'แสดงทั้งหมด' : 'เฉพาะที่ใช้งาน'}
        </button>
      </div>

      {/* Locations Grid */}
      {filteredLocations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? 'ไม่พบสถานที่ที่ค้นหา' : 'ยังไม่มีสถานที่'}
          </p>
          {!searchTerm && (
            <Link
              href="/settings/locations/create"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Plus className="w-5 h-5" />
              เพิ่มสถานที่แรก
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLocations.map((location) => (
            <div
              key={location.id}
              className={`bg-white rounded-lg border p-6 hover:shadow-md transition-shadow ${
                location.isActive 
                  ? 'border-gray-200' 
                  : 'border-red-200 opacity-75'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{location.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {location.address}
                  </p>
                </div>
                {!location.isActive && (
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">
                    ปิดใช้งาน
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
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

              <div className="flex gap-2">
                <Link
                  href={`/settings/locations/${location.id}/edit`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  แก้ไข
                </Link>
                <button
                  onClick={() => handleDelete(location)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}