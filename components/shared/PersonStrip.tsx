'use client'

// แถบเลือกคนแบบรูป — กดรูปกรองเป็นของคนนั้น (เจ้าของขอ 28 ต.ค. 69 "เลือกดูของแต่ละคนจะไวกว่า")
// ใช้ที่หน้างาน (ผู้รับผิดชอบ) และหน้าส่งของ (คนขับ) · ตัวเลขบนรูป = จำนวน · alert = ตัวเลขเป็นสีแบรนด์
// ลำดับมาจากผู้เรียก · สไตล์ที่ .aoo-people-strip

import type { ReactNode } from 'react'
import { Users } from 'lucide-react'
import UserAvatar from './UserAvatar'

export interface PersonStripItem {
  key: string
  name: string
  count?: number
  /** ตัวเลขสีแบรนด์ — เช่น มีงานเลยกำหนด */
  alert?: boolean
  /** user id สำหรับรูป · ไม่ส่ง = ไอคอน "ทุกคน" */
  userId?: string
  /** ข้อความเพิ่มใน tooltip */
  hint?: string
  avatar?: ReactNode
}

export default function PersonStrip({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: PersonStripItem[]
  value: string
  onChange: (key: string) => void
  ariaLabel: string
}) {
  return (
    <div className="aoo-people-strip" role="radiogroup" aria-label={ariaLabel}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="radio"
          aria-checked={value === it.key}
          className="aoo-people-strip__item"
          onClick={() => onChange(it.key)}
          title={[it.name, it.hint].filter(Boolean).join(' — ')}
        >
          <span className="aoo-people-strip__avatar">
            {it.avatar ??
              (it.userId ? (
                <UserAvatar userId={it.userId} name={it.name} size="md" />
              ) : (
                <span className="aoo-people-strip__all">
                  <Users size={18} />
                </span>
              ))}
            {!!it.count && (
              <span className="aoo-people-strip__count" data-overdue={it.alert || undefined}>
                {it.count}
              </span>
            )}
          </span>
          <span className="aoo-people-strip__name">{it.name}</span>
        </button>
      ))}
    </div>
  )
}
