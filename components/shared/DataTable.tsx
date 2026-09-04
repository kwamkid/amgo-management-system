'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react'
import Skeleton from './Skeleton'
import { useMemo, useState } from 'react'
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
  /** ไม่แสดงบนจอแคบ (มุมมองการ์ด) — ใช้กับคอลัมน์รอง */
  hideOnMobile?: boolean
  /** ตรึงคอลัมน์ไว้ตอนเลื่อนแนวนอน (ใช้กับคอลัมน์ชื่อ) */
  sticky?: boolean
  /**
   * จอแคบตารางกลายเป็นการ์ด (แบบ aoosocial/aoocommerce) —
   * คอลัมน์นี้เป็น "หัวการ์ด" ตัวหนาบนสุด · ไม่ระบุ = ใช้คอลัมน์แรก
   */
  mobilePrimary?: boolean
  /** ป้ายกำกับในการ์ด — ไม่ใส่ใช้ header (เมื่อ header เป็นข้อความ) */
  mobileLabel?: string
  /** ดึงคอลัมน์นี้ไปลอยมุมขวาล่างของการ์ด ไม่มีป้าย — ใช้กับเมนู "..." ของแถว */
  mobileFooterAction?: boolean
  /**
   * ใส่แล้วคอลัมน์นี้คลิกหัวเพื่อเรียงได้ — คืนค่าที่ใช้เทียบ (ตัวเลข/ข้อความ)
   * คลิกวน: น้อย→มาก · มาก→น้อย · กลับลำดับเดิม · ค่า null ไปท้ายเสมอ
   */
  sortValue?: (row: T) => string | number | null | undefined
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null

/** เรียงแถวตาม sortValue ของคอลัมน์ — ใช้เองก็ได้เมื่อหน้าแบ่งหน้าเองแล้วต้องเรียงก่อนตัดหน้า */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState): T[] {
  if (!sort) return rows
  const col = columns.find((c) => c.key === sort.key)
  if (!col?.sortValue) return rows

  const dir = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = col.sortValue!(a)
    const vb = col.sortValue!(b)
    // ค่าว่างไปท้ายเสมอ ไม่ว่าจะเรียงทางไหน
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'th') * dir
  })
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
  sort: sortProp,
  onSortChange,
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
  /**
   * ส่ง sort + onSortChange มาคู่กัน = หน้าจัดการเรียงเอง (จำเป็นเมื่อหน้าแบ่งหน้าเอง
   * ไม่งั้นจะเรียงแค่ในหน้าที่เห็น) — ไม่ส่งมา ตารางเรียงให้เองทั้งก้อน
   */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
}) {
  // เรียงในตาราง — คงลำดับที่ผู้เรียกส่งมาไว้เป็นค่าเริ่มต้น
  const [internalSort, setInternalSort] = useState<SortState>(null)
  const controlled = onSortChange !== undefined
  const sort = controlled ? (sortProp ?? null) : internalSort

  const sortedRows = useMemo(
    () => (controlled ? rows : sortRows(rows, columns, sort)),
    [rows, columns, sort, controlled]
  )

  const toggleSort = (key: string) => {
    const next: SortState =
      sort?.key !== key
        ? { key, dir: 'asc' }
        : sort.dir === 'asc'
          ? { key, dir: 'desc' }
          : null // คลิกครั้งที่สาม — กลับลำดับเดิม
    if (controlled) onSortChange!(next)
    else setInternalSort(next)
  }

  if (loading) return <Skeleton />

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

  // มุมมองการ์ดบนจอแคบ — หัวการ์ด · ข้อมูลรอง grid 2 คอลัมน์ · action ลอยขวาล่าง
  const primaryCol = columns.find((c) => c.mobilePrimary) ?? columns[0]
  const footerActionCol = columns.find((c) => c.mobileFooterAction)
  const cardCols = columns.filter(
    (c) => c !== primaryCol && c !== footerActionCol && !c.hideOnMobile
  )

  return (
    <>
    {/* ── จอแคบ: การ์ด (แบบ aoosocial/aoocommerce) ─────────────── */}
    <div className="space-y-2.5 md:hidden">
      {sortedRows.map((row, i) => (
        <div
          key={rowKey(row, i)}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          className={`relative rounded-xl border border-gray-200 bg-white p-4 ${
            onRowClick ? 'cursor-pointer active:bg-gray-50' : ''
          } ${rowClassName?.(row) ?? ''}`}
        >
          <div className="pr-8 font-semibold text-gray-900">{primaryCol.cell(row, i)}</div>

          {cardCols.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {cardCols.map((c) => (
                <div key={c.key} className="min-w-0">
                  <p className="text-xs text-gray-400">
                    {c.mobileLabel ?? (typeof c.header === 'string' ? c.header : c.key)}
                  </p>
                  <div className="truncate text-sm text-gray-800">{c.cell(row, i)}</div>
                </div>
              ))}
            </div>
          )}

          {footerActionCol && (
            <div
              className="absolute bottom-3 right-3"
              onClick={(e) => e.stopPropagation()}
            >
              {footerActionCol.cell(row, i)}
            </div>
          )}
        </div>
      ))}
      {/* tfoot (แถวสรุป) เป็นโครงของตาราง — มุมมองการ์ดไม่แสดง */}
    </div>

    {/* ── จอกว้าง: ตารางเต็ม ───────────────────────────────────── */}
    <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { minWidth: c.width } : undefined}
                aria-sort={
                  sort?.key === c.key
                    ? sort.dir === 'asc' ? 'ascending' : 'descending'
                    : undefined
                }
                className={`border-b border-gray-200 px-4 py-2.5 font-medium text-gray-600 ${alignOf(c)} ${
                  c.hideOnMobile ? 'hidden md:table-cell' : ''
                } ${c.sticky ? 'sticky left-0 z-10 bg-gray-50' : ''}`}
              >
                {c.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    {c.header}
                    {sort?.key === c.key ? (
                      sort.dir === 'asc' ? (
                        <ArrowUp size={13} className="shrink-0" />
                      ) : (
                        <ArrowDown size={13} className="shrink-0" />
                      )
                    ) : (
                      <ChevronsUpDown size={13} className="shrink-0 text-gray-300" />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
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
    </>
  )
}
