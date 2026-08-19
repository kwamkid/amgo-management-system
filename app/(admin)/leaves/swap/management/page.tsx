'use client'

// อนุมัติใบสลับวันหยุด + ตามคนที่ยังไม่ยื่นใบ
//
// พออนุมัติ trigger ในฐานข้อมูลเขียน schedule_exceptions ให้ 2 แถว
// (วันที่มาทำงาน = onsite · วันที่ไปหยุด = off) รายงานกับการนับวันขาด
// จึงถูกต้องเองโดยไม่ต้องมีโค้ดพิเศษ
//
// กล่องล่าง "ยังไม่ได้ยื่นใบ" คือคนที่เช็คอินตรงวันหยุดประจำแต่ไม่มีใบ —
// ของเดิมรายงานหักลบให้เงียบ ๆ ไม่มีใครเห็น ตอนนี้เอาขึ้นมาให้ตามได้

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarSync, Check, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState } from '@/components/aoo'
import { PageHeader, SectionCard, Skeleton, StatusBadge, UserCell } from '@/components/shared'
import {
  approveSwap,
  rejectSwap,
  listSwaps,
  listUnfiledSwapDays,
  type ScheduleSwap,
} from '@/lib/services/scheduleSwapService'

const thaiDate = (iso: string) =>
  format(new Date(`${iso}T00:00:00`), 'EEE d MMM', { locale: th })

export default function SwapManagementPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [pending, setPending] = useState<ScheduleSwap[]>([])
  const [recent, setRecent] = useState<ScheduleSwap[]>([])
  const [unfiled, setUnfiled] = useState<{ userId: string; userName: string; workDate: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userData && !['hr', 'admin', 'manager'].includes(userData.role)) {
      router.push('/unauthorized')
    }
  }, [userData, router])

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      const [all, un] = await Promise.all([
        listSwaps(),
        listUnfiledSwapDays(subDays(new Date(), 60), new Date()),
      ])
      setPending(all.filter((s) => s.status === 'pending'))
      setRecent(all.filter((s) => s.status !== 'pending').slice(0, 20))
      setUnfiled(un)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const approve = async (id: string) => {
    try {
      await approveSwap(id, userData!.id!)
      showToast('อนุมัติแล้ว — ตารางวันทำงานอัปเดตให้อัตโนมัติ', 'success')
      reload()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const reject = async (id: string) => {
    const reason = window.prompt('เหตุผลที่ไม่อนุมัติ')
    if (reason === null) return
    try {
      await rejectSwap(id, userData!.id!, reason)
      showToast('บันทึกแล้ว', 'success')
      reload()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const swapLine = (s: ScheduleSwap) => (
    <>
      <span className="text-gray-500">มาทำงาน</span>{' '}
      <span className="font-medium">{thaiDate(s.workedDate)}</span>
      <span className="mx-2 text-gray-400">→</span>
      <span className="text-gray-500">ไปหยุด</span>{' '}
      <span className="font-medium">{thaiDate(s.offDate)}</span>
    </>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="จัดการใบสลับวันหยุด"
        description="อนุมัติแล้วตารางวันทำงานของคนนั้นจะเปลี่ยนตามทันที"
        icon={CalendarSync}
      />

      <SectionCard title={`รออนุมัติ (${pending.length})`}>
        {loading ? (
          <Skeleton rows={3} />
        ) : pending.length === 0 ? (
          <EmptyState icon={<Check size={28} />} title="ไม่มีใบรออนุมัติ" size="sm" />
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <UserCell name={s.userName} />
                <div className="min-w-0 flex-1 text-sm">
                  <p>{swapLine(s)}</p>
                  {s.reason && <p className="mt-0.5 text-xs text-gray-500">{s.reason}</p>}
                </div>
                <Button size="sm" onClick={() => approve(s.id)}>
                  <Check size={14} /> อนุมัติ
                </Button>
                <Button variant="secondary" size="sm" onClick={() => reject(s.id)}>
                  <X size={14} /> ไม่อนุมัติ
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={`มาทำงานวันหยุดแต่ยังไม่ได้ยื่นใบ (${unfiled.length})`}
        description="ย้อนหลัง 60 วัน — รายงานยังหักลบวันขาดให้อยู่ แต่ไม่มีบันทึกว่าไปหยุดชดเชยวันไหน"
      >
        {loading ? (
          <Skeleton rows={2} />
        ) : unfiled.length === 0 ? (
          <EmptyState icon={<Check size={28} />} title="ไม่มีรายการค้าง" size="sm" />
        ) : (
          <div className="divide-y divide-gray-100">
            {unfiled.map((u) => (
              <div key={`${u.userId}|${u.workDate}`} className="flex items-center gap-3 py-2.5">
                <UserCell name={u.userName} />
                <span className="text-sm text-gray-600">{thaiDate(u.workDate)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="ใบที่ตัดสินแล้ว">
        {loading ? (
          <Skeleton rows={2} />
        ) : recent.length === 0 ? (
          <EmptyState icon={<CalendarSync size={28} />} title="ยังไม่มีประวัติ" size="sm" />
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <UserCell name={s.userName} />
                <div className="min-w-0 flex-1 text-sm">{swapLine(s)}</div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
