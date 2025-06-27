// app/(admin)/settings/users/page.tsx

'use client'

import { useState } from 'react'
import { 
  Users, 
  UserPlus, 
  Search, 
  Shield, 
  Building,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { gradients } from '@/lib/theme/colors'

export default function UsersSettingsPage() {
  const [searchTerm, setSearchTerm] = useState('')

  // Placeholder stats
  const stats = {
    total: 45,
    active: 40,
    pending: 3,
    inactive: 2
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้</h1>
          <p className="text-gray-600 mt-1">
            จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึง
          </p>
        </div>
        
        <Button className={`bg-gradient-to-r ${gradients.primary}`}>
          <UserPlus className="w-5 h-5 mr-2" />
          เพิ่มผู้ใช้ใหม่
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ผู้ใช้ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.primaryLight} rounded-xl`}>
                <Users className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ใช้งาน</p>
                <p className="text-2xl font-bold text-teal-600 mt-1">{stats.active}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.successLight} rounded-xl`}>
                <CheckCircle className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">รออนุมัติ</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.pending}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.warningLight} rounded-xl`}>
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ระงับใช้งาน</p>
                <p className="text-2xl font-bold text-gray-500 mt-1">{stats.inactive}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${gradients.grayLight} rounded-xl`}>
                <XCircle className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="ค้นหาด้วยชื่อ, อีเมล หรือเบอร์โทร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Notice */}
      <Card className={`border-0 shadow-md bg-gradient-to-r ${gradients.primaryLight}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertCircle className="w-5 h-5" />
            กำลังพัฒนา
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-800">
            ฟีเจอร์จัดการผู้ใช้กำลังอยู่ในช่วงการพัฒนา คาดว่าจะเปิดใช้งานได้ในเร็วๆ นี้
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-red-700 font-medium">ฟีเจอร์ที่กำลังพัฒนา:</p>
            <ul className="space-y-1 text-sm text-red-700">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>ดูรายละเอียดผู้ใช้ทั้งหมด</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>แก้ไขข้อมูลและสิทธิ์ผู้ใช้</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>อนุมัติ/ปฏิเสธผู้ใช้ใหม่</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>ระงับ/เปิดใช้งานบัญชี</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>กำหนดสถานที่ทำงานและทีม</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Export รายชื่อพนักงาน</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Mock User List */}
      <Card className="border-0 shadow-md opacity-50">
        <CardHeader>
          <CardTitle>รายชื่อผู้ใช้</CardTitle>
          <CardDescription>แสดงรายชื่อผู้ใช้ทั้งหมดในระบบ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full animate-pulse" />
                  <div>
                    <div className="h-4 w-32 bg-gray-300 rounded animate-pulse mb-1" />
                    <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Loading...</Badge>
                  <Button size="sm" variant="outline" disabled>
                    จัดการ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}