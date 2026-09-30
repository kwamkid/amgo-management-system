'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * การ์ดตัวเลขสรุป — ของเดิมเขียนซ้ำใบละ ~15 บรรทัด อยู่ 23 หน้า
 *
 * <StatGrid>
 *   <StatCard label="ทั้งหมด" value={15} icon={Building} />
 *   <StatCard label="ใช้งาน" value={13} icon={Eye} tone="success" />
 * </StatGrid>
 */

/** สีของการ์ด — ความหมาย (success/warning/…) หรือเลือกสีตรง ๆ · สีจริงอยู่ที่ [data-tone] ใน globals.css */
export type StatTone =
  | 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'neutral'
  | 'sky' | 'pink' | 'grape' | 'plum'

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'default',
  hint,
  onClick,
  selected,
}: {
  label: ReactNode
  value: ReactNode
  /** หน่วยต่อท้ายตัวเลข เช่น "ชม." "คน" */
  unit?: string
  icon?: LucideIcon
  tone?: StatTone
  /** บรรทัดเล็กใต้ตัวเลข ใช้บอกที่มา */
  hint?: ReactNode
  onClick?: () => void
  /** การ์ดที่กำลังใช้กรองอยู่ — ขึ้นกรอบเข้ม (ใช้คู่กับ onClick) */
  selected?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className="aoo-stat"
      data-tone={tone}
      data-selected={selected || undefined}
    >
      <div className="min-w-0">
        <p className="aoo-stat__label truncate">{label}</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="aoo-stat__value">{value}</span>
          {unit && <span className="aoo-stat__unit">{unit}</span>}
        </p>
        {hint && <p className="aoo-stat__hint mt-0.5 truncate">{hint}</p>}
      </div>

      {Icon && (
        <div className="aoo-stat__icon">
          <Icon size={22} strokeWidth={2} />
        </div>
      )}
    </Tag>
  )
}

/** ตะแกรงวางการ์ด — ปรับจำนวนคอลัมน์ตามความกว้างเอง */
export function StatGrid({
  children,
  cols = 4,
}: {
  children: ReactNode
  cols?: 2 | 3 | 4 | 5
}) {
  const map = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-5',
  }
  return <div className={`mb-6 grid grid-cols-1 gap-3 ${map[cols]}`}>{children}</div>
}
