import type { CSSProperties, ReactNode } from 'react'

/**
 * ป้ายกลม ๆ ใช้ทั่วไป
 *
 * ตัว Badge ที่พอร์ตมาจาก aoosocial ผูกกับสถานะโพสต์ (draft/scheduled/published)
 * ซึ่งใช้กับงาน HR ไม่ได้ — อันนี้เลยเป็นตัวกลางที่รับ tone ตรง ๆ
 * สีทั้งหมดอ้างโทเคนเดียวกัน จึงยังอยู่ในระบบเดิม
 */
export type PillTone =
  | 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
  | 'sky' | 'pink' | 'grape' | 'plum'

export interface PillProps {
  children: ReactNode
  tone?: PillTone
  className?: string
  style?: CSSProperties
}

/** สีอยู่ที่ .aoo-pill + [data-tone] ใน globals.css */
export function Pill({ children, tone = 'neutral', className, style }: PillProps) {
  return (
    <span className={className ? `aoo-pill ${className}` : 'aoo-pill'} data-tone={tone} style={style}>
      {children}
    </span>
  )
}

/** แปลง variant ของ Badge ชุดเก่า (shadcn) → tone ของ Pill — ใช้ตอนย้ายหน้าเก่า 7 ก.ย. 69 */
export function badgeTone(variant?: string | null): PillTone {
  switch (variant) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'error': case 'destructive': return 'danger'
    case 'info': return 'info'
    case 'secondary': case 'outline': return 'neutral'
    default: return 'accent'
  }
}
