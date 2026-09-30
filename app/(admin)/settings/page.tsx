// app/(admin)/settings/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import { Bell, Building, Calendar, Clock, FileText, MapPin, Settings, Shield, Users } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared'
import { Card, type CardTone } from '@/components/aoo'

const settingsMenu = [
  {
    title: 'สถานที่ทำงาน',
    description: 'จัดการสาขา, กำหนดเวลาทำงาน และรัศมีการเช็คอิน',
    icon: MapPin,
    href: '/settings/locations',
    tone: 'accent' as CardTone
  },
  {
    title: 'ตำแหน่งและแผนก',
    description: 'จัดการตำแหน่งงาน, แผนก และ Permission Groups',
    icon: Building,
    href: '/settings/departments',
    tone: 'sky' as CardTone
  },
  {
    title: 'วันหยุดและวันลา',
    description: 'ตั้งค่าวันหยุดประจำปี และประเภทการลา',
    icon: Calendar,
    href: '/settings/holidays',
    tone: 'success' as CardTone
  },
  {
    title: 'กะการทำงาน',
    description: 'จัดการกะการทำงาน และเวลาเข้า-ออกงาน',
    icon: Clock,
    href: '/settings/shifts',
    tone: 'grape' as CardTone
  },
  {
    title: 'การแจ้งเตือน',
    description: 'ตั้งค่าการแจ้งเตือนผ่าน LINE และ Discord',
    icon: Bell,
    href: '/settings/notifications',
    tone: 'warning' as CardTone
  },
  {
    title: 'ความปลอดภัย',
    description: 'จัดการสิทธิ์การเข้าถึง และความปลอดภัยของระบบ',
    icon: Shield,
    href: '/settings/security',
    tone: 'muted' as CardTone
  }
]

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่าระบบ"
        description="จัดการการตั้งค่าต่างๆ ของระบบ HR"
        icon={Settings}
      />

      {/* Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsMenu.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="group block">
              <Card hoverable className="h-full">
                <div className="flex items-start gap-4">
                  <span className="aoo-title-icon" data-tone={item.tone}>
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}