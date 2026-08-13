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

export type StatTone = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const TONES: Record<StatTone, { fg: string; bg: string; icon: string }> = {
  default: { fg: 'var(--fg-1)', bg: 'var(--warm-100)', icon: 'var(--fg-3)' },
  accent: { fg: 'var(--brand-coral-600)', bg: 'var(--brand-coral-50)', icon: 'var(--brand-coral-500)' },
  success: { fg: 'var(--leaf-700)', bg: 'var(--leaf-50)', icon: 'var(--leaf-500)' },
  warning: { fg: 'var(--sun-700)', bg: 'var(--sun-50)', icon: 'var(--sun-500)' },
  danger: { fg: 'var(--ruby-700)', bg: 'var(--ruby-50)', icon: 'var(--ruby-500)' },
  info: { fg: 'var(--grape-700)', bg: 'var(--grape-50)', icon: 'var(--grape-500)' },
  muted: { fg: 'var(--fg-3)', bg: 'var(--warm-100)', icon: 'var(--fg-4)' },
}

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
  /** การ์ดที่กำลังใช้กรองอยู่ — ขึ้นกรอบสีตาม tone (ใช้คู่กับ onClick) */
  selected?: boolean
}) {
  const t = TONES[tone]
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      data-button-fx={onClick ? 'ghost' : undefined}
      className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-4 text-left ${
        selected ? 'border-transparent' : 'border-gray-200'
      } ${onClick ? 'w-full' : ''}`}
      style={selected ? { boxShadow: `inset 0 0 0 2px ${t.icon}` } : undefined}
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-gray-500">{label}</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums" style={{ color: t.fg }}>
            {value}
          </span>
          {unit && <span className="text-sm text-gray-500">{unit}</span>}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-gray-400">{hint}</p>}
      </div>

      {Icon && (
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: t.bg }}
        >
          <Icon size={20} strokeWidth={1.75} style={{ color: t.icon }} />
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
