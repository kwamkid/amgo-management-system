// components/users/LocationMultiSelect.tsx

'use client'

import { useLocations } from '@/hooks/useLocations'
import { MapPin, Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface LocationMultiSelectProps {
  selectedLocationIds: string[]
  onChange: (locationIds: string[]) => void
  disabled?: boolean
}

export default function LocationMultiSelect({ 
  selectedLocationIds, 
  onChange, 
  disabled = false 
}: LocationMultiSelectProps) {
  const { locations, loading } = useLocations(true) // เฉพาะที่ active
  const selectAllRef = useRef<HTMLInputElement>(null)

  // จัดการ indeterminate state
  useEffect(() => {
    if (selectAllRef.current) {
      const isIndeterminate = selectedLocationIds.length > 0 && selectedLocationIds.length < locations.length
      selectAllRef.current.indeterminate = isIndeterminate
    }
  }, [selectedLocationIds.length, locations.length])

  const toggleLocation = (locationId: string) => {
    if (selectedLocationIds.includes(locationId)) {
      onChange(selectedLocationIds.filter(id => id !== locationId))
    } else {
      onChange([...selectedLocationIds, locationId])
    }
  }

  const toggleAll = () => {
    if (selectedLocationIds.length === locations.length) {
      onChange([])
    } else {
      onChange(locations.map(loc => loc.id!))
    }
  }

  if (loading) {
    return (
      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
        <span className="text-gray-500">กำลังโหลด...</span>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
        <span className="text-gray-500">ไม่มีสาขาในระบบ</span>
      </div>
    )
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4 space-y-3">
      {/* Select All */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <input
          ref={selectAllRef}
          type="checkbox"
          id="select-all-locations"
          checked={selectedLocationIds.length === locations.length && locations.length > 0}
          onChange={toggleAll}
          disabled={disabled}
          className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
        />
        <label 
          htmlFor="select-all-locations" 
          className="font-medium text-gray-700 cursor-pointer select-none"
        >
          เลือกทั้งหมด ({locations.length} สาขา)
        </label>
      </div>

      {/* Location List */}
      <div className="grid gap-3 md:grid-cols-2">
        {locations.map((location) => {
          const isSelected = selectedLocationIds.includes(location.id!)
          return (
            <div
              key={location.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                isSelected ? 'bg-red-50' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                id={`location-${location.id}`}
                checked={isSelected}
                onChange={() => toggleLocation(location.id!)}
                disabled={disabled}
                className="w-5 h-5 rounded text-red-600 focus:ring-red-500 mt-0.5"
              />
              <label 
                htmlFor={`location-${location.id}`}
                className="flex-1 cursor-pointer select-none"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{location.name}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{location.address}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>{location.shifts.length} กะ</span>
                      <span>รัศมี {location.radius}ม.</span>
                    </div>
                  </div>
                </div>
              </label>
            </div>
          )
        })}
      </div>

      {/* Selected Count */}
      {selectedLocationIds.length > 0 && (
        <div className="pt-3 border-t">
          <p className="text-sm text-gray-600">
            เลือกแล้ว {selectedLocationIds.length} สาขา
          </p>
        </div>
      )}
    </div>
  )
}