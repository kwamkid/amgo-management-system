'use client'

// ปฏิทินโพสต์ — per-post calendar from aoosocial (build step 3 · project/jobs/plans/marketing-plan.md).
// Until the aoosocial link is built, show the plan's key dates so the tab is still useful.

import { CalendarDays } from 'lucide-react'
import { EmptyState } from '@/components/aoo'
import { SectionCard } from '@/components/shared'
import type { Plan } from '@/lib/services/marketingService'
import { thDateShort } from './format'

export default function CalendarTab({ plan }: { plan: Plan }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <EmptyState
          size="sm"
          icon={<CalendarDays size={28} />}
          title="ปฏิทินโพสต์จาก aoosocial กำลังเชื่อม"
          body="เมื่อเชื่อมแล้ว โพสต์ทุกช่องทางของแบรนด์นี้ (ร่าง / ตั้งเวลา / ลงแล้ว) จะขึ้นที่นี่ทีละโพสต์"
        />
      </SectionCard>
      {plan.keyDates.length > 0 && (
        <SectionCard title="วันสำคัญของแผน">
          <div className="divide-y divide-gray-100">
            {plan.keyDates.map((d, i) => (
              <div key={i} className="flex gap-3 py-2">
                <span className="w-24 shrink-0 text-xs text-gray-500">{thDateShort(d.date)}</span>
                <span className="text-gray-700">{d.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
