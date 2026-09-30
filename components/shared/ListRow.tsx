import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * แถวรายการ: [รูป/ไอคอน] ชื่อ + รายละเอียด ... [ป้าย/ปุ่ม]
 * ใช้ใน <ListRows> — แทนลิสต์ divide-y / แถวพื้นเทาที่เขียนเองกว่า 20 แบบ
 * สไตล์อยู่ที่ .aoo-list / .aoo-row ใน globals.css
 */
export function ListRows({
  children,
  variant = 'divided',
  className,
}: {
  children: ReactNode
  /** divided = มีเส้นคั่น · boxed = แถวละกล่องพื้นเทา */
  variant?: 'divided' | 'boxed'
  className?: string
}) {
  const cls = `aoo-list aoo-list--${variant}${className ? ` ${className}` : ''}`
  return <div className={cls}>{children}</div>
}

export default function ListRow({
  leading,
  title,
  meta,
  trailing,
  onClick,
  href,
}: {
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  href?: string
}) {
  const inner = (
    <>
      {leading}
      <div className="aoo-row__body">
        <div className="aoo-row__title">{title}</div>
        {meta && <div className="aoo-row__meta">{meta}</div>}
      </div>
      {trailing && <div className="aoo-row__trail">{trailing}</div>}
    </>
  )
  if (href) return <Link href={href} className="aoo-row">{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className="aoo-row">{inner}</button>
  return <div className="aoo-row">{inner}</div>
}
