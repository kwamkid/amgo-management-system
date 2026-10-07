'use client'

// แผงคิวลอยมุมขวาล่าง — ใช้ทุกหน้าที่มีงานในคิว (เช็คอันดับ · ถาม AI · สั่งงานทั้งฟลีต …)
//
// พื้นเข้มแบบ toast ไม่มีเงา · กด ✕ ย่อเป็นปุ่มกลม (มีตัวเลขงานที่เหลือ) กดแล้วกางกลับ
// จองที่ใน --toast-offset ให้ toast ต่อ stack ขึ้นไปข้างบน ไม่ทับกัน
// งานเดินฝั่งเซิร์ฟเวอร์ (คิวกลาง) — แผงนี้แค่โชว์ ปิดหน้าเว็บได้เสมอ
// สไตล์อยู่ที่ .aoo-queue* ใน globals.css

import type { ReactNode } from 'react'
import { CheckCircle2, ListChecks, Loader2, X } from 'lucide-react'
import { Progress } from '@/components/aoo'
import { useToastOffset } from '@/hooks/useToastOffset'

export interface QueueFloatProps {
  /** ข้อความหัว เช่น "กำลังเช็คอันดับ" — ต่อท้ายด้วยตัวเลขให้เอง */
  title: string
  /** จบแล้ว (สำเร็จ + ล้มเหลว) */
  done: number
  total: number
  failed?: number
  /** ยังมีงานค้าง (หมุน) — false = จบแล้ว (ติ๊กถูก) */
  active: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** บรรทัดเล็กใต้แถบ */
  meta?: ReactNode
  /** ปุ่ม/ลิงก์มุมล่างขวา */
  action?: ReactNode
  /** หน่วยของตัวเลข (ค่าเริ่มต้น "งาน") */
  unit?: string
}

export function QueueFloat({
  title,
  done,
  total,
  failed = 0,
  active,
  open,
  onOpenChange,
  meta,
  action,
  unit = 'งาน',
}: QueueFloatProps) {
  const floatRef = useToastOffset()
  const left = Math.max(0, total - done)

  if (!open) {
    return (
      <button
        ref={floatRef}
        type="button"
        className="aoo-queue-fab"
        onClick={() => onOpenChange(true)}
        aria-label={`เปิดคิว ${title}`}
      >
        {active ? <Loader2 size={22} className="animate-spin" /> : <ListChecks size={22} />}
        {active && left > 0 && <span className="aoo-queue-fab__badge">{left}</span>}
      </button>
    )
  }

  return (
    <div ref={floatRef} className="aoo-queue" role="status">
      <div className="aoo-queue__head">
        {active ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        <span>
          {title} — {active ? `เสร็จ ${done}/${total} ${unit}` : `เสร็จแล้ว ${done - failed}/${total} ${unit}`}
          {failed ? ` · ล้มเหลว ${failed}` : ''}
        </span>
        <button type="button" className="aoo-queue__close" onClick={() => onOpenChange(false)} aria-label="ย่อคิว">
          <X size={16} />
        </button>
      </div>
      <Progress
        className="mt-2"
        value={done}
        max={total || 1}
        tone={active ? 'grape' : failed ? 'warning' : 'success'}
        aria-label={`ความคืบหน้า ${title}`}
      />
      {meta && <div className="aoo-queue__meta">{meta}</div>}
      {action && <div className="aoo-queue__foot">{action}</div>}
    </div>
  )
}
