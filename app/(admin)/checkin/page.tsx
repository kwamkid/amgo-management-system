// app/(admin)/checkin/page.tsx

'use client'

import { useAuth } from '@/hooks/useAuth'
import { useCheckIn } from '@/hooks/useCheckIn'
import CheckInButton from '@/components/checkin/CheckInButton'
import { History } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function CheckInPage() {
  const { userData } = useAuth()
  const { currentCheckIn } = useCheckIn()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เช็คอิน/เอาท์</h1>
          <p className="text-gray-600 mt-1">
            {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: th })}
          </p>
        </div>
        
        <Link href="/checkin/history">
          <Button variant="outline" className="gap-2">
            <History className="w-4 h-4" />
            ดูประวัติ
          </Button>
        </Link>
      </div>

      {/* CheckIn Button Only */}
      <CheckInButton />
    </div>
  )
}