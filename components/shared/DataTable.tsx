'use client'

import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * ตารางข้อมูล — รวมเรื่องที่ทุกหน้าต้องทำเหมือนกัน:
 * หัวตารางตรึง · แถวสลับสี · สถานะกำลังโหลด · สถานะไม่มีข้อมูล · เลื่อนแนวนอน
 *
 * ของเดิมแต่ละหน้าเขียนเอง ทำให้ "ไม่มีข้อมูล" หน้าตาต่างกัน 29 แบบ
 *
 * <DataTable
 *   columns={[
 *     { key: 'name', header: 'ชื่อ', cell: (r) => r.full_name },
 *     { key: 'hours', header: 'ชั่วโมง', align: 'right', cell: (r) => r.total_hours },
 *   ]}
 *   rows={records}
 *   rowKey={(r) => r.id}
 * />
 */

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** ความกว้างขั้นต่ำ (px) */
  width?: number
  /** ซ่อนบนจอแคบ — ใช้กับคอลัมน์รอง */
  hideOnMobile?: boolean
  /** ตรึงคอลัมน์ไว้ตอนเลื่อนแนวนอน (ใช้กับคอลัมน์ชื่อ) */
  sticky?: boolean
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = 'ยังไม่มีข้อมูล',
  emptyBody,
  emptyAction,
  onRowClick,
  rowClassName,
  footer,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  loading?: boolean
  emptyTitle?: ReactNode
  emptyBody?: ReactNode
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  footer?: ReactNode
}) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-gray-100 p-4 last:border-0">
            {columns.slice(0, 4).map((c) => (
              <div key={c.key} className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Inbox size={22} className="text-gray-400" strokeWidth={1.75} />
        </div>
        <p className="font-medium text-gray-900">{emptyTitle}</p>
        {emptyBody && <p className="mt-1 text-sm text-gray-500">{emptyBody}</p>}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    )
  }

  const alignOf = (c: Column<T>) =>
    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { minWidth: c.width } : undefined}
                className={`border-b border-gray-200 px-4 py-2.5 font-medium text-gray-600 ${alignOf(c)} ${
                  c.hideOnMobile ? 'hidden md:table-cell' : ''
                } ${c.sticky ? 'sticky left-0 z-10 bg-gray-50' : ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-gray-100 last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
              } ${rowClassName?.(row) ?? ''}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-2.5 text-gray-800 ${alignOf(c)} ${
                    c.hideOnMobile ? 'hidden md:table-cell' : ''
                  } ${c.sticky ? 'sticky left-0 z-10 bg-inherit' : ''}`}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="bg-gray-50 font-medium">{footer}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
