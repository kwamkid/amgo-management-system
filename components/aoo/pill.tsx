import type { CSSProperties, ReactNode } from 'react'

/**
 * ป้ายกลม ๆ ใช้ทั่วไป
 *
 * ตัว Badge ที่พอร์ตมาจาก aoosocial ผูกกับสถานะโพสต์ (draft/scheduled/published)
 * ซึ่งใช้กับงาน HR ไม่ได้ — อันนี้เลยเป็นตัวกลางที่รับ tone ตรง ๆ
 * สีทั้งหมดอ้างโทเคนเดียวกัน จึงยังอยู่ในระบบเดิม
 */
export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--warm-150)', fg: 'var(--warm-700)' },
  accent: { bg: 'var(--brand-coral-50)', fg: 'var(--brand-coral-700)' },
  success: { bg: 'var(--leaf-50)', fg: 'var(--leaf-700)' },
  warning: { bg: 'var(--sun-50)', fg: 'var(--sun-700)' },
  danger: { bg: 'var(--ruby-50)', fg: 'var(--ruby-700)' },
  info: { bg: 'var(--grape-50)', fg: 'var(--grape-700)' },
}

export interface PillProps {
  children: ReactNode
  tone?: PillTone
  className?: string
  style?: CSSProperties
}

export function Pill({ children, tone = 'neutral', className, style }: PillProps) {
  const t = TONES[tone]
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 'var(--r-pill)',
        background: t.bg,
        color: t.fg,
        fontSize: 'var(--fs-meta)',
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
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
