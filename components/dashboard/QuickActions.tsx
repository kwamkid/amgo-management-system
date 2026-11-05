'use client'

// การ์ดใหญ่หน้าแรก: 2 อย่างที่พนักงานทำบ่อยสุด — เช็คอิน/เอาท์ · เบิกค่าใช้จ่าย (เจ้าของ 5 พ.ย. 69)
// การ์ดเช็คอินบอกสถานะจริงของวันนี้ · คนที่ตั้งไว้ว่า "ไม่ต้องเช็คอิน" เห็นแค่ใบเบิก
// ถามสถานะเฉพาะตอนเปิดหน้า ไม่แตะ GPS (เหตุผลเดียวกับที่หน้า Dashboard เลิกเรียก useCheckIn)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, LogOut, Receipt, type LucideIcon } from 'lucide-react'
import type { PillTone } from '@/components/aoo'
import type { UserData } from '@/hooks/useAuth'
import { getActiveCheckIn, hasCheckedInToday } from '@/lib/services/checkinService'
import { listMyClaims } from '@/lib/services/expenseService'
import { thb } from '@/components/expenses/expenseVisuals'

function QuickCard({
  href,
  icon: Icon,
  tone,
  title,
  hint,
}: {
  href: string
  icon: LucideIcon
  tone: PillTone
  title: string
  hint: string
}) {
  return (
    <Link href={href} className="aoo-quick-card" data-tone={tone}>
      <span className="aoo-quick-card__icon">
        <Icon size={32} strokeWidth={2} />
      </span>
      <span className="aoo-quick-card__title">{title}</span>
      <span className="aoo-quick-card__hint">{hint}</span>
    </Link>
  )
}

export default function QuickActions({ userData }: { userData: UserData }) {
  const needsCheckin = userData.requiresCheckin !== false
  // null = ยังโหลดไม่เสร็จ — โชว์ข้อความกลาง ๆ กันการ์ดกะพริบจาก "เช็คอิน" เป็น "เช็คเอาท์"
  const [state, setState] = useState<{ inAt: string | null; doneToday: boolean } | null>(null)
  const [waiting, setWaiting] = useState(0)

  useEffect(() => {
    if (!userData.id) return
    let alive = true
    if (needsCheckin) {
      Promise.all([getActiveCheckIn(userData.id), hasCheckedInToday(userData.id)])
        .then(([active, doneToday]) => alive && setState({ inAt: active?.checkinTime ? String(active.checkinTime) : null, doneToday }))
        .catch(() => {})
    }
    listMyClaims(userData.id)
      .then((rows) => {
        if (!alive) return
        // ยอดที่รอรับคืน — ใบจ่าย supplier ไม่ใช่เงินของพนักงาน (เกณฑ์เดียวกับหน้าใบเบิกของฉัน)
        const open = rows.filter((r) => r.kind !== 'supplier' && ['pending_finance', 'approved'].includes(r.status))
        setWaiting(open.reduce((s, r) => s + r.amount, 0))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [userData.id, needsCheckin])

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="aoo-quick-cards" data-single={needsCheckin ? undefined : ''}>
      {needsCheckin && (
        <QuickCard
          href="/checkin"
          icon={state?.inAt ? LogOut : Clock}
          tone={state?.inAt ? 'success' : 'accent'}
          title={!state ? 'เช็คอิน / เอาท์' : state.inAt ? 'เช็คเอาท์' : state.doneToday ? 'ลงเวลาแล้ว' : 'เช็คอิน'}
          hint={
            !state
              ? 'ลงเวลาทำงาน'
              : state.inAt
                ? `เข้างาน ${time(state.inAt)}`
                : state.doneToday
                  ? 'วันนี้เช็คเอาท์แล้ว'
                  : 'ยังไม่ได้เช็คอินวันนี้'
          }
        />
      )}
      <QuickCard
        href="/expenses"
        icon={Receipt}
        tone="grape"
        title="เบิกค่าใช้จ่าย"
        hint={waiting > 0 ? `รอรับคืน ${thb(waiting)}` : 'ยื่นใบเบิก · ดูสถานะ'}
      />
    </div>
  )
}
