'use client'

// เลือกขั้นแบบลูกศรต่อกัน (step funnel) — สถานะที่เดินไปข้างหน้าทีละขั้น เช่น ต้องทำ → กำลังทำ → เสร็จแล้ว
// ขั้นที่ผ่านมาแล้วสีอ่อน · ขั้นปัจจุบันสีเต็ม · ขั้นถัดไปสีพื้น · แต่ละขั้นมีสีของตัวเองได้ (tone) — เห็นว่าอยู่ตรงไหนของทาง
// กดขั้นไหนก็ได้ (ย้อนได้) · สไตล์อยู่ที่ .aoo-steps ใน globals.css
//
// <StepSelect value={status} onChange={setStatus}
//   options={[{ value: 'todo', label: 'ต้องทำ', icon: Circle }, ...]} />

import type { ComponentType } from 'react'

/** สีของขั้น — ขั้นปัจจุบันสีเต็ม ขั้นที่ผ่านแล้วสีอ่อนของตัวเอง (ไม่ใส่ = สีแบรนด์) */
export type StepTone = 'accent' | 'warning' | 'sky' | 'success' | 'danger' | 'grape'

export interface StepSelectOption {
  value: string
  label: string
  icon?: ComponentType<{ size?: number }>
  tone?: StepTone
}

export interface StepSelectProps {
  value: string
  options: StepSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  'aria-label'?: string
}

export function StepSelect({ value, options, onChange, disabled, 'aria-label': ariaLabel }: StepSelectProps) {
  const current = options.findIndex((o) => o.value === value)
  return (
    <div className="aoo-steps" role="radiogroup" aria-label={ariaLabel}>
      {options.map(({ value: v, label, icon: Icon, tone = 'accent' }, i) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={i === current}
          className="aoo-steps__step"
          data-state={i < current ? 'passed' : i === current ? 'current' : 'next'}
          data-tone={tone}
          disabled={disabled}
          onClick={() => onChange(v)}
        >
          {Icon && <Icon size={16} />}
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
