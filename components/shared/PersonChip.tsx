'use client'

import { X } from 'lucide-react'
import UserAvatar from './UserAvatar'

/** คน = รูป + ชื่อเล่น (ที่ทำงานเรียกกันด้วยชื่อเล่น) · ใส่ onRemove = มีปุ่ม × */
export default function PersonChip({
  userId,
  name,
  onRemove,
}: {
  userId: string
  name: string
  onRemove?: () => void
}) {
  return (
    <span className="aoo-person">
      <UserAvatar userId={userId} name={name} size="xs" />
      <span className="aoo-person__name">{name}</span>
      {onRemove && (
        <button type="button" className="aoo-person__remove" onClick={onRemove} aria-label={`เอา ${name} ออก`}>
          <X size={12} />
        </button>
      )}
    </span>
  )
}
