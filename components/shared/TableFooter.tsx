'use client'

// แถวล่างของตาราง — จำนวนรายการชิดซ้าย · ปุ่มเปลี่ยนหน้าชิดขวา
//
// ทุกหน้าที่มีตารางต้องใช้ตัวนี้ จะได้วางเหมือนกันหมด
// ของเดิมแต่ละหน้าวาง <Pagination> เองแล้วจัดกึ่งกลางบ้าง ชิดขวาบ้าง
// และไม่มีหน้าไหนบอกเลยว่า "กำลังดูอยู่กี่รายการจากทั้งหมดเท่าไหร่"

import { Pagination } from '@/components/aoo'

export default function TableFooter({
  page,
  pageSize,
  total,
  onPageChange,
  /** คำเรียกสิ่งที่นับ เช่น คน · รายการ · ใบ */
  unit = 'รายการ',
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  unit?: string
}) {
  if (total === 0) return null

  const pageCount = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-500">
        {total <= pageSize ? (
          <>
            ทั้งหมด <span className="font-medium text-gray-900">{total}</span> {unit}
          </>
        ) : (
          <>
            แสดง{' '}
            <span className="font-medium text-gray-900">
              {from}–{to}
            </span>{' '}
            จาก <span className="font-medium text-gray-900">{total}</span> {unit}
          </>
        )}
      </p>

      {pageCount > 1 && (
        <Pagination currentPage={page} pageCount={pageCount} onPageChange={onPageChange} />
      )}
    </div>
  )
}
