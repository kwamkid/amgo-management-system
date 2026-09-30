'use client'

import { 
  FileSpreadsheet, 
  Calendar, 
  Users, 
  TrendingUp,
  ArrowRight,
  Clock,
  UserCheck,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { PageHeader, StatCard } from '@/components/shared'

import { Pill, Card, CardContent, CardDescription, CardHeader, CardTitle, type CardTone } from '@/components/aoo'
const reportMenuItems = [
  {
    title: 'รายงานการเข้างาน',
    description: 'ตรวจสอบเวลาเข้า-ออก สรุปชั่วโมงทำงาน และ Export Excel',
    icon: Clock,
    href: '/reports/checkin',
    tone: 'sky' as CardTone,
    badge: 'พร้อมใช้งาน',
    badgeVariant: 'success' as const
  },
  {
    title: 'รายงานการลา',
    description: 'สรุปวันลา โควต้าคงเหลือ และประวัติการลา',
    icon: Calendar,
    href: '/reports/leave',
    tone: 'grape' as CardTone,
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงานพนักงาน',
    description: 'ข้อมูลพนักงาน สถิติการทำงาน และประสิทธิภาพ',
    icon: Users,
    href: '/reports/employee',
    tone: 'success' as CardTone,
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงาน Dashboard',
    description: 'ภาพรวมองค์กร กราฟ และสถิติสำคัญ',
    icon: TrendingUp,
    href: '/reports/dashboard',
    tone: 'accent' as CardTone,
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงาน Influencer',
    description: 'สรุปแคมเปญ ผลงาน และประสิทธิภาพ',
    icon: UserCheck,
    href: '/reports/influencer',
    tone: 'pink' as CardTone,
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงานอื่นๆ',
    description: 'รายงานเพิ่มเติม Custom Reports',
    icon: FileText,
    href: '/reports/custom',
    tone: 'muted' as CardTone,
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  }
]

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="ศูนย์รายงาน"
        description="เลือกประเภทรายงานที่ต้องการดู"
        icon={FileText}
      />
      
      {/* Report Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportMenuItems.map((item) => {
          const isActive = item.badgeVariant === 'success'
          
          return (
            <Link
              key={item.href}
              href={isActive ? item.href : '#'}
              className={!isActive ? 'pointer-events-none' : ''}
            >
              <Card padding={0} hoverable={isActive} className={isActive ? undefined : 'opacity-75'}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle icon={item.icon} tone={item.tone}>
                      {item.title}
                    </CardTitle>
                    <Pill tone={isActive ? 'success' : 'neutral'}>
                      {item.badge}
                    </Pill>
                  </div>
                  <CardDescription>
                    {item.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {isActive && (
                    <div className="flex items-center text-sm font-medium text-gray-600">
                      ดูรายงาน
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
      
      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="รายงานทั้งหมด" value={6} icon={FileSpreadsheet} tone="grape" />
        <StatCard label="พร้อมใช้งาน" value={1} tone="success" />
        <StatCard label="กำลังพัฒนา" value={5} tone="warning" />
        <StatCard label="Export วันนี้" value={0} icon={ArrowRight} tone="sky" />
      </div>
    </div>
  )
}