// app/(admin)/settings/locations/page.tsx

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLocations } from '@/hooks/useLocations'
import { Location } from '@/types/location'
import {
  MapPin,
  Plus,
  Clock,
  Calendar,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Building,
} from 'lucide-react'
import { Button, ActionMenu, Pill } from '@/components/aoo'
import { PageHeader, StatCard, StatGrid, FilterBar, TechLoader } from '@/components/shared'

/** ชนิดสถานที่ → คำไทย + สี (ตรงกับที่ตั้งไว้ใน DB) */
const TYPE_LABEL: Record<string, { label: string; tone: 'accent' | 'info' | 'success' }> = {
  office: { label: 'สำนักงาน', tone: 'success' },
  mall: { label: 'เคาน์เตอร์ห้าง', tone: 'accent' },
  event: { label: 'ออกบูธ', tone: 'info' },
}

export default function LocationsPage() {
  const router = useRouter()
  const { locations, loading, deleteLocation } = useLocations()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return locations.filter((l) => {
      if (!showInactive && !l.isActive) return false
      if (!q) return true
      return l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
    })
  }, [locations, search, showInactive])

  const handleDelete = async (location: Location) => {
    if (confirm(`ต้องการลบสถานที่ "${location.name}" ใช่หรือไม่?`)) {
      await deleteLocation(location.id)
    }
  }

  if (loading) return <TechLoader />

  const active = locations.filter((l) => l.isActive).length

  return (
    <>
      <PageHeader
        title="จัดการสถานที่"
        description="จัดการสาขาและสถานที่ทำงานของพนักงาน"
        icon={Building}
        actions={
          <Link href="/settings/locations/create">
            <Button icon="Plus">เพิ่มสถานที่</Button>
          </Link>
        }
      />

      <StatGrid>
        <StatCard label="ทั้งหมด" value={locations.length} unit="แห่ง" icon={Building} />
        <StatCard label="ใช้งาน" value={active} unit="แห่ง" icon={Eye} tone="success" />
        <StatCard
          label="ปิดใช้งาน"
          value={locations.length - active}
          unit="แห่ง"
          icon={EyeOff}
          tone="muted"
        />
        <StatCard
          label="กะทั้งหมด"
          value={locations.reduce((n, l) => n + l.shifts.length, 0)}
          unit="กะ"
          icon={Clock}
          tone="info"
        />
      </StatGrid>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="ค้นหาชื่อสถานที่หรือที่อยู่"
        actions={
          <Button
            size="sm"
            variant={showInactive ? 'secondary' : 'ghost'}
            onClick={() => setShowInactive((v) => !v)}
            icon={showInactive ? 'Eye' : 'EyeOff'}
          >
            {showInactive ? 'แสดงทั้งหมด' : 'เฉพาะที่ใช้งาน'}
          </Button>
        }
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <MapPin size={40} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="font-medium text-gray-900">
            {search ? 'ไม่พบสถานที่ที่ค้นหา' : 'ยังไม่มีสถานที่'}
          </p>
          {!search && (
            <Link href="/settings/locations/create" className="mt-4 inline-block">
              <Button variant="secondary" icon="Plus">
                เพิ่มสถานที่แรก
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((location) => {
            const type = TYPE_LABEL[(location as Location & { locationType?: string }).locationType ?? '']
            return (
              <div
                key={location.id}
                className={`flex flex-col rounded-xl border border-gray-200 bg-white p-4 ${
                  !location.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">{location.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{location.address}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {!location.isActive && <Pill tone="danger">ปิดใช้งาน</Pill>}
                    <ActionMenu
                      items={[
                        {
                          label: 'แก้ไข',
                          icon: 'Pencil',
                          onSelect: () => router.push(`/settings/locations/${location.id}/edit`),
                        },
                        { kind: 'divider' },
                        {
                          label: 'ลบ',
                          icon: 'Trash2',
                          tone: 'danger',
                          onSelect: () => handleDelete(location),
                        },
                      ]}
                    />
                  </div>
                </div>

                <dl className="mt-3 space-y-1.5 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="shrink-0 text-gray-400" />
                    <span>
                      รัศมี <span className="font-mono tabular-nums">{location.radius}</span> เมตร
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="shrink-0 text-gray-400" />
                    <span>{location.shifts.length} กะการทำงาน</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="shrink-0 text-gray-400" />
                    <span>พักกลางวัน {location.breakHours} ชั่วโมง</span>
                  </div>
                  {type && (
                    <div className="pt-1">
                      <Pill tone={type.tone}>{type.label}</Pill>
                    </div>
                  )}
                </dl>

                <Link
                  href={`/settings/locations/${location.id}/edit`}
                  className="mt-4 block border-t border-gray-100 pt-3"
                >
                  <Button variant="secondary" size="sm" className="w-full" icon="Pencil">
                    จัดการสถานที่
                  </Button>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
