// การ์ด "ตัวกรองข้อมูล" — มาตรฐานกลางของหน้ารายงานทุกหน้า
//
// กติกา: หน้ารายงานใช้การ์ดนี้เสมอ (หัวข้อ + ช่องกรองมี label + ปุ่ม/สรุปด้านขวา)
// จะมีช่องอะไรบ้างแล้วแต่หน้า — ประกอบเอาจาก <FilterField> เปิด/ปิดตามต้องการ
// ส่วนหน้า "รายการ" (ตารางค้นหา) ใช้ FilterBar แถบบางเหมือนเดิม — คนละงานกัน
//
// <FilterCard actions={<Button>ดูข้อมูล</Button>}>
//   <FilterField label="ช่วงเวลา"><DateRangePicker ... /></FilterField>
//   <FilterField label="พนักงาน"><SelectMenu ... /></FilterField>
// </FilterCard>

import type { ReactNode } from 'react'

export default function FilterCard({
  title = 'ตัวกรองข้อมูล',
  children,
  actions,
  className = '',
}: {
  title?: string
  /** ช่องกรอง — ประกอบจาก <FilterField> */
  children: ReactNode
  /** ปุ่ม/ข้อความสรุปด้านขวาของแถวช่องกรอง */
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      <p className="mb-3 text-base font-semibold text-gray-900">{title}</p>
      <div className="flex flex-wrap items-end gap-3">
        {children}
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}

/** หนึ่งช่องกรอง — ป้ายกำกับอยู่เหนือตัวควบคุม ขนาดเท่ากันทุกหน้า */
export function FilterField({
  label,
  children,
  width,
}: {
  label: string
  children: ReactNode
  /** ความกว้าง (px) — ไม่ใส่ = กว้างตามเนื้อหา */
  width?: number
}) {
  return (
    // maxWidth กันช่องกว้างคงที่ทะลุการ์ดตอนจอแคบ
    <div style={width ? { width, maxWidth: '100%' } : undefined}>
      <p className="mb-1 text-sm text-gray-500">{label}</p>
      {children}
    </div>
  )
}
