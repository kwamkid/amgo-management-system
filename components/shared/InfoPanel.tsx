import type { ReactNode } from 'react'
import type { PillTone } from '@/components/aoo'

/**
 * กล่องย่อยในการ์ด — แทน `bg-gray-50 rounded-lg p-3` ที่เขียนเองกว่า 28 จุด
 * ไม่ใส่ tone = พื้นเทาอ่อน · ใส่ tone = พื้นสีอ่อน+ขอบตามสี (ข้อความเตือนให้ใช้ Alert)
 * สไตล์อยู่ที่ .aoo-well ใน globals.css
 */
export default function InfoPanel({
  children,
  tone,
  className,
}: {
  children: ReactNode
  tone?: PillTone
  className?: string
}) {
  return (
    <div className={className ? `aoo-well ${className}` : 'aoo-well'} data-tone={tone}>
      {children}
    </div>
  )
}
