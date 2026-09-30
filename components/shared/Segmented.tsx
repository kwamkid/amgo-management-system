'use client'

import type { ComponentType } from 'react'

// ปุ่มเลือกแบบกดสลับ (segmented) — ใช้แทน dropdown เมื่อตัวเลือกน้อย (2-3 ตัว)
// เห็นทุกตัวเลือกพร้อมกัน กดทีเดียวจบ ไม่ต้องกางเมนู · สไตล์อยู่ที่ .aoo-segmented
//
// <Segmented value={type} onChange={setType}
//   options={[{ value: 'monthly', label: 'รายเดือน' }, { value: 'daily', label: 'รายวัน', icon: Calendar }]} />

export default function Segmented({
  value,
  options,
  onChange,
  disabled,
  className = '',
}: {
  value: string
  options: { value: string; label: string; icon?: ComponentType<{ size?: number }> }[]
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={className ? `aoo-segmented ${className}` : 'aoo-segmented'} role="group">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button" // อยู่ในฟอร์ม — กันเผลอ submit
          disabled={disabled}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className="aoo-segmented__opt"
        >
          {Icon && <Icon size={15} />}
          {label}
        </button>
      ))}
    </div>
  )
}
