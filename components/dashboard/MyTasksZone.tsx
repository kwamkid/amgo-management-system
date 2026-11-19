'use client'

// กล่อง "งานของฉัน" บนหน้าแรก — เช็คอินแล้วเห็นทันทีว่าวันนี้มีงานอะไรครบกำหนด/เลยกำหนด (เจ้าของ 20 พ.ย. 69)
// ขึ้นหลังเช็คอินวันนี้ (หรือคนที่ไม่ต้องเช็คอิน) · ไม่มีงานค้าง = ไม่ขึ้น ไม่กินที่
// แตะงาน → /tasks?task=<id> (มือถือเปิดหน้าอ่าน TaskSheet)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ListChecks } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { hasCheckedInToday } from '@/lib/services/checkinService'
import { getMyTaskAlerts, type MyTaskAlert } from '@/lib/services/taskService'
import { toYmd } from '@/lib/push/notify'
import { BrandBadge, DueBadge, ListRow, ListRows } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/aoo'

const SHOW = 5

export default function MyTasksZone() {
  const { userData } = useAuth()
  const [tasks, setTasks] = useState<MyTaskAlert[] | null>(null)

  useEffect(() => {
    if (!userData?.id) return
    const id = userData.id
    const today = toYmd(new Date())
    ;(async () => {
      const ready = userData.requiresCheckin === false || (await hasCheckedInToday(id))
      if (ready) setTasks(await getMyTaskAlerts(id, today))
    })().catch(() => {})
  }, [userData?.id, userData?.requiresCheckin])

  if (!tasks?.length) return null

  const today = toYmd(new Date())
  const late = tasks.filter((t) => t.dueDate < today).length
  const dueToday = tasks.length - late

  return (
    <Card padding={0} className="mb-5 overflow-hidden">
      <CardHeader>
        <CardTitle icon={ListChecks} tone={late ? 'danger' : 'warning'}>
          {['งานของฉัน', late && `เลยกำหนด ${late}`, dueToday && `ครบวันนี้ ${dueToday}`].filter(Boolean).join(' · ')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ListRows>
          {tasks.slice(0, SHOW).map((t) => (
            <ListRow
              key={t.id}
              href={`/tasks?task=${t.id}`}
              title={
                <>
                  <span className="font-medium text-[var(--fg-3)]">#{t.no}</span> {t.title}
                </>
              }
              meta={
                <span className="flex flex-wrap items-center gap-1.5">
                  <DueBadge dueDate={t.dueDate} />
                  {t.brand && <BrandBadge brand={t.brand} />}
                </span>
              }
            />
          ))}
        </ListRows>
        <Link href="/tasks" className="mt-2 flex items-center justify-end gap-1 text-xs font-medium text-[var(--accent)]">
          {tasks.length > SHOW ? `ดูทั้งหมด ${tasks.length} งาน` : 'ไปหน้างาน'} <ArrowRight size={13} />
        </Link>
      </CardContent>
    </Card>
  )
}
