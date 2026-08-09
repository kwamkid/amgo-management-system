'use client'

import UserAvatar from './UserAvatar'
import StatusBadge from './StatusBadge'

/**
 * ช่อง "รูป + ชื่อ" ในตาราง — ทุกหน้าที่มีรายชื่อคนต้องใช้
 * รวมไว้ที่เดียวจะได้ขนาดรูปกับระยะห่างเท่ากันทุกหน้า
 */
export default function UserCell({
  name,
  imageUrl,
  subtitle,
  role,
  size = 'sm',
}: {
  name: string
  imageUrl?: string | null
  /** บรรทัดล่าง เช่น หน่วยงาน ตำแหน่ง */
  subtitle?: string | null
  /** ใส่แล้วจะขึ้นป้าย role ต่อท้ายชื่อ */
  role?: string | null
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar name={name} imageUrl={imageUrl ?? undefined} size={size} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-gray-900">{name}</span>
          {role && <StatusBadge status={role} />}
        </div>
        {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  )
}
