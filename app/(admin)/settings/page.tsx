// app/(admin)/settings/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { 
  MapPin, 
  Users, 
  Calendar, 
  Bell, 
  Shield, 
  Building,
  Clock,
  FileText
} from 'lucide-react'
import Link from 'next/link'

const settingsMenu = [
  {
    title: 'สถานที่ทำงาน',
    description: 'จัดการสาขา, กำหนดเวลาทำงาน และรัศมีการเช็คอิน',
    icon: MapPin,
    href: '/settings/locations',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  {
    title: 'ตำแหน่งและแผนก',
    description: 'จัดการตำแหน่งงาน, แผนก และ Permission Groups',
    icon: Building,
    href: '/settings/departments',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  {
    title: 'วันหยุดและวันลา',
    description: 'ตั้งค่าวันหยุดประจำปี และประเภทการลา',
    icon: Calendar,
    href: '/settings/holidays',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    title: 'กะการทำงาน',
    description: 'จัดการกะการทำงาน และเวลาเข้า-ออกงาน',
    icon: Clock,
    href: '/settings/shifts',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  {
    title: 'การแจ้งเตือน',
    description: 'ตั้งค่าการแจ้งเตือนผ่าน LINE และ Discord',
    icon: Bell,
    href: '/settings/notifications',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50'
  },
  {
    title: 'ความปลอดภัย',
    description: 'จัดการสิทธิ์การเข้าถึง และความปลอดภัยของระบบ',
    icon: Shield,
    href: '/settings/security',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  }
]

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบ</h1>
        <p className="text-gray-600 mt-1 text-base">
          จัดการการตั้งค่าต่างๆ ของระบบ HR
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsMenu.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 ${item.bgColor} rounded-lg`}>
                  <Icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}