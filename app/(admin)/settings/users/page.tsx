// app/(admin)/settings/users/page.tsx

'use client'

import { useState } from 'react'
import { 
  Users, 
  UserPlus, 
  Shield, 
  Building,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { PageHeader, StatCard, FilterBar, ListRows, ListRow } from '@/components/shared'
import { Button as AooButton, Alert, Pill, Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@/components/aoo'
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
      <PageHeader
        title="จัดการผู้ใช้"
        description="จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึง"
        icon={Users}
        actions={
          <AooButton size="sm" icon="UserPlus">
            เพิ่มผู้ใช้ใหม่
          </AooButton>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="ผู้ใช้ทั้งหมด" value={stats.total} icon={Users} tone="grape" />
        <StatCard label="ใช้งาน" value={stats.active} icon={CheckCircle} tone="success" />
        <StatCard label="รออนุมัติ" value={stats.pending} icon={Clock} tone="warning" />
        <StatCard label="ระงับใช้งาน" value={stats.inactive} icon={XCircle} tone="muted" />
      </div>

      {/* Search Bar */}
      <FilterBar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="ค้นหาด้วยชื่อ, อีเมล หรือเบอร์โทร..."
        sticky={false}
      />

      {/* Coming Soon Notice */}
      <Alert tone="warning" title="กำลังพัฒนา">
        <p>ฟีเจอร์จัดการผู้ใช้กำลังอยู่ในช่วงการพัฒนา คาดว่าจะเปิดใช้งานได้ในเร็วๆ นี้</p>
        <div className="mt-4 space-y-2">
          <p className="font-medium">ฟีเจอร์ที่กำลังพัฒนา:</p>
          <ul className="space-y-1">
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
      </Alert>

      {/* Mock User List */}
      <Card padding={0} className="opacity-50">
        <CardHeader>
          <CardTitle icon={Users} tone="grape">รายชื่อผู้ใช้</CardTitle>
          <CardDescription>แสดงรายชื่อผู้ใช้ทั้งหมดในระบบ</CardDescription>
        </CardHeader>
        <CardContent>
          <ListRows variant="boxed">
            {[1, 2, 3].map((i) => (
              <ListRow
                key={i}
                leading={<div className="w-10 h-10 shrink-0 bg-gray-300 rounded-full animate-pulse" />}
                title={<div className="h-4 w-32 bg-gray-300 rounded animate-pulse mb-1" />}
                meta={<div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />}
                trailing={
                  <>
                    <Pill tone="neutral">Loading...</Pill>
                    <Button size="sm" variant="soft" disabled>
                      จัดการ
                    </Button>
                  </>
                }
              />
            ))}
          </ListRows>
        </CardContent>
      </Card>
    </div>
  )
}