// app/(admin)/checkin/pending/page.tsx
//
// รอดำเนินการ — ใบลืมเช็คเอาท์ที่ HR ต้องตรวจ (30 ก.ย. 69)
//
// เดิมหน้านี้มี 2 ส่วน: กะที่เปิดค้าง + "รออนุมัติ OT" · คิว OT ปิดทิ้งแล้ว
// (payroll ไม่เคยอ่าน ค้าง 1,926 ใบ) และตอนนี้ cron 00:05 ปิดทุกกะที่ข้ามวัน
// เหลือสิ่งที่ HR ต้องทำจริงคือตรวจใบที่ระบบปิดให้ — ส่วนกะเปิดค้างยังอยู่
// เผื่อ cron พลาด

'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { PageHeader, SectionCard } from '@/components/shared'
import TechLoader from '@/components/shared/TechLoader'
import { Alert, EmptyState } from '@/components/aoo'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { CheckInRecord } from '@/types/checkin'
import { getPendingCheckouts, manualCheckout } from '@/lib/services/checkinService'
import { fetchHrInbox, type ForgotItem } from '@/lib/services/hrInboxService'
import PendingCheckouts from '@/components/checkin/PendingCheckouts'
import ForgotReviewList from '@/components/checkin/ForgotReviewList'

export default function PendingCheckoutsPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [forgot, setForgot] = useState<ForgotItem[]>([])
  const [open, setOpen] = useState<CheckInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const canManage = ['admin', 'hr'].includes(userData?.role || '')

  const load = useCallback(async () => {
    try {
      const [inbox, pending] = await Promise.all([fetchHrInbox(), getPendingCheckouts()])
      setForgot(inbox.forgot)
      // กะที่ยังไม่ปิดของวันก่อน ๆ — วันนี้ยังทำงานอยู่ ไม่นับ
      const today = format(new Date(), 'yyyy-MM-dd')
      setOpen(
        pending.filter(
          (r) => r.status === 'checked-in' && format(new Date(r.checkinTime), 'yyyy-MM-dd') < today
        )
      )
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (canManage) load()
  }, [canManage, load])

  const closeOpenShift = async (
    record: CheckInRecord,
    checkoutTime: Date,
    reason: string,
    approveOvertime = false
  ) => {
    if (!userData) return
    try {
      setProcessing(record.id!)
      await manualCheckout(
        record.id!,
        format(new Date(record.checkinTime), 'yyyy-MM-dd'),
        checkoutTime,
        userData.id!,
        userData.displayName || userData.fullName,
        reason,
        approveOvertime
      )
      showToast('ปิดกะแล้ว', 'success')
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setProcessing(null)
    }
  }

  if (!canManage) {
    return (
      <Alert tone="error">
        <p className="font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <div>เฉพาะ HR และผู้ดูแลระบบ</div>
      </Alert>
    )
  }

  if (loading) return <TechLoader />

  const claimed = forgot.filter((f) => f.claimed_checkout_time).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="ลืมเช็คเอาท์ รอตรวจ"
        description="ระบบปิดกะให้ที่เวลาเลิกงานปกติ ไม่มี OT — ตรวจเฉพาะงวดที่ยังไม่ตัดยอด"
        icon={Clock}
      />

      <SectionCard
        title={`รอตรวจ ${forgot.length} ใบ${claimed ? ` · พนักงานแจ้งเวลาแล้ว ${claimed}` : ''}`}
      >
        {forgot.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={28} />}
            title="ตรวจครบแล้ว"
            body="ไม่มีใบลืมเช็คเอาท์ค้างในงวดนี้"
          />
        ) : (
          <>
            <p className="mb-1 text-xs text-gray-500">
              ใบที่พนักงานแจ้งเวลาจริงมาแล้วอยู่บนสุด · อนุมัติ/แก้เวลา = คิดชั่วโมงใหม่ตามกติกาเดียวกับกดเช็คเอาท์เอง
              (ตัดที่เวลาปิดสาขา) · ใช้เวลาระบบ = ชั่วโมงเดิม
            </p>
            <ForgotReviewList items={forgot} onChanged={load} />
          </>
        )}
      </SectionCard>

      {open.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              กะที่ยังเปิดค้างข้ามวัน {open.length} ใบ
            </span>
          }
        >
          <p className="mb-2 text-xs text-gray-500">
            ปกติระบบปิดให้ทุกคืน 00:05 — ถ้ายังค้างแปลว่า cron พลาด ปิดให้ที่นี่ได้
          </p>
          <PendingCheckouts
            records={open}
            onApprove={closeOpenShift}
            processing={processing}
            type="forgot"
          />
        </SectionCard>
      )}
    </div>
  )
}
