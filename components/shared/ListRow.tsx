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
  aside,
}: {
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  href?: string
  /** ปุ่ม/ช่องติ๊กท้ายแถวที่กดแยกจากตัวแถว — อยู่นอก <button> เพราะ HTML ห้ามซ้อน control ในปุ่ม */
  aside?: ReactNode
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
  if (onClick && aside) {
    return (
      <div className="aoo-row !py-0">
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 text-left">
          {inner}
        </button>
        {aside}
      </div>
    )
  }
  if (href) return <Link href={href} className="aoo-row">{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className="aoo-row">{inner}</button>
  return <div className="aoo-row">{inner}</div>
}
