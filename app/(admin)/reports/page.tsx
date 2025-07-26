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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const reportMenuItems = [
  {
    title: 'รายงานการเข้างาน',
    description: 'ตรวจสอบเวลาเข้า-ออก สรุปชั่วโมงทำงาน และ Export Excel',
    icon: Clock,
    href: '/reports/checkin',
    color: 'from-blue-500 to-cyan-600',
    badge: 'พร้อมใช้งาน',
    badgeVariant: 'success' as const
  },
  {
    title: 'รายงานการลา',
    description: 'สรุปวันลา โควต้าคงเหลือ และประวัติการลา',
    icon: Calendar,
    href: '/reports/leave',
    color: 'from-purple-500 to-pink-600',
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงานพนักงาน',
    description: 'ข้อมูลพนักงาน สถิติการทำงาน และประสิทธิภาพ',
    icon: Users,
    href: '/reports/employee',
    color: 'from-green-500 to-emerald-600',
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงาน Dashboard',
    description: 'ภาพรวมองค์กร กราฟ และสถิติสำคัญ',
    icon: TrendingUp,
    href: '/reports/dashboard',
    color: 'from-orange-500 to-red-600',
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงาน Influencer',
    description: 'สรุปแคมเปญ ผลงาน และประสิทธิภาพ',
    icon: UserCheck,
    href: '/reports/influencer',
    color: 'from-indigo-500 to-purple-600',
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  },
  {
    title: 'รายงานอื่นๆ',
    description: 'รายงานเพิ่มเติม Custom Reports',
    icon: FileText,
    href: '/reports/custom',
    color: 'from-gray-500 to-slate-600',
    badge: 'เร็วๆ นี้',
    badgeVariant: 'secondary' as const
  }
]

export default function ReportsPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">ศูนย์รายงาน</h1>
        <p className="mt-2 text-gray-600">เลือกประเภทรายงานที่ต้องการดู</p>
      </div>
      
      {/* Report Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportMenuItems.map((item) => {
          const Icon = item.icon
          const isActive = item.badgeVariant === 'success'
          
          return (
            <Link
              key={item.href}
              href={isActive ? item.href : '#'}
              className={!isActive ? 'pointer-events-none' : ''}
            >
              <Card 
                className={`
                  relative overflow-hidden transition-all duration-300 group
                  ${isActive ? 'hover:shadow-lg hover:-translate-y-1 cursor-pointer' : 'opacity-75'}
                `}
              >
                {/* Gradient Background */}
                <div 
                  className={`
                    absolute inset-0 bg-gradient-to-br ${item.color} opacity-5
                    ${isActive ? 'group-hover:opacity-10' : ''}
                  `}
                />
                
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div 
                      className={`
                        p-3 rounded-lg bg-gradient-to-br ${item.color} 
                        text-white shadow-lg
                      `}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant={item.badgeVariant}>
                      {item.badge}
                    </Badge>
                  </div>
                  
                  <CardTitle className="mt-4 text-lg">
                    {item.title}
                  </CardTitle>
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
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">รายงานทั้งหมด</p>
                <p className="text-2xl font-bold">6</p>
              </div>
              <FileSpreadsheet className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">พร้อมใช้งาน</p>
                <p className="text-2xl font-bold text-green-600">1</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">กำลังพัฒนา</p>
                <p className="text-2xl font-bold text-orange-600">5</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Export วันนี้</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-gray-500 rotate-90" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}