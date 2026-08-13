// การ์ดเนื้อหามาตรฐาน — กรอบเดียวกับ FilterCard (border-gray-100 + shadow-sm + p-5)
//
// กติกา: หน้าไหนต้องการกล่องหุ้มเนื้อหา ใช้ตัวนี้เสมอ ห้ามเขียน div rounded-xl
// มือเปล่า — เจ้าของทัก 13 ส.ค. 69 ว่า container แต่ละหน้าไม่เหมือนกัน

import type { ReactNode } from 'react'

export default function SectionCard({
  title,
  description,
  children,
  className = '',
}: {
  /** หัวข้อของกล่อง (ไม่ใส่ = ไม่มีแถวหัว) */
  title?: ReactNode
  /** คำอธิบายบรรทัดเล็กใต้หัวข้อ */
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      {title && <p className={`text-sm font-semibold text-gray-700 ${description ? 'mb-1' : 'mb-3'}`}>{title}</p>}
      {description && <p className="mb-3 text-xs text-gray-400">{description}</p>}
      {children}
    </section>
  )
}
