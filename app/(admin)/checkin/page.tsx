// app/(admin)/checkin/page.tsx

'use client'

import { useAuth } from '@/hooks/useAuth'
import { useCheckIn } from '@/hooks/useCheckIn'
import CheckInButton from '@/components/checkin/CheckInButton'
import { Clock } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import { PageHeader } from '@/components/shared'
import { Button as AooButton } from '@/components/aoo'

// มือถือ: ทุกอย่างต้องอยู่ใน 1 จอ (เจ้าของขอ 4 ก.ย. 69) — หัวหน้าแบบเต็มของ PageHeader
// กินไป ~150px (ไอคอน+ชื่อ+วันที่+ปุ่มซ้อนกันเป็น 3 บรรทัด) จึงใช้หัวแถวเดียวบนจอเล็ก
// และคง PageHeader ไว้บนจอใหญ่ให้เหมือนหน้าอื่น
export default function CheckInPage() {
  useAuth()
  useCheckIn()
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: th })

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <Clock size={18} className="text-red-600" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-gray-900">เช็คอิน/เอาท์</h1>
            <p className="truncate text-sm leading-tight text-gray-500">{today}</p>
          </div>
        </div>
        <Link href="/checkin/history" className="shrink-0">
          <AooButton variant="secondary" size="sm" icon="Calendar">
            ประวัติ
          </AooButton>
        </Link>
      </div>

      <div className="hidden sm:block">
        <PageHeader
          title="เช็คอิน/เอาท์"
          description={today}
          icon={Clock}
          actions={
            <Link href="/checkin/history">
              <AooButton variant="secondary" size="sm" icon="Calendar">
                ดูประวัติ
              </AooButton>
            </Link>
          }
        />
      </div>

      <CheckInButton />
    </div>
  )
}
