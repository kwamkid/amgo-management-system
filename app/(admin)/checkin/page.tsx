// app/(admin)/checkin/page.tsx

'use client'

import { useAuth } from '@/hooks/useAuth'
import { useCheckIn } from '@/hooks/useCheckIn'
import CheckInButton from '@/components/checkin/CheckInButton'
import { Clock, History } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PageHeader } from '@/components/shared'
import { Button as AooButton } from '@/components/aoo'

export default function CheckInPage() {
  const { userData } = useAuth()
  const { currentCheckIn } = useCheckIn()

  return (
    <div className="space-y-6">
      <PageHeader
        title="เช็คอิน/เอาท์"
        description={format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}
        icon={Clock}
        actions={
          <Link href="/checkin/history">
            <AooButton variant="secondary" size="sm" icon="Calendar">
              ดูประวัติ
            </AooButton>
          </Link>
        }
      />

      {/* CheckIn Button Only */}
      <CheckInButton />
    </div>
  )
}