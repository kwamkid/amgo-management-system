'use client'

import type { ReactNode } from 'react'

/** ตัวกรองแบบไอคอนวงกลมล้วน ไม่มีตัวเลขหรือป้าย · ชื่อขึ้นตอนชี้ · เลื่อนซ้ายขวาได้ · สไตล์ .aoo-icon-filter */
export default function IconFilter({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: { key: string; label: string; icon: ReactNode }[]
  value: string
  onChange: (key: string) => void
  ariaLabel: string
}) {
  return (
    <div className="aoo-icon-filter" role="group" aria-label={ariaLabel}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className="aoo-icon-filter__item"
          aria-pressed={value === it.key}
          aria-label={it.label}
          title={it.label}
          onClick={() => onChange(it.key)}
        >
          {it.icon}
        </button>
      ))}
    </div>
  )
}
