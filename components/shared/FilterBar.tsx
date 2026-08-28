'use client'

import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { SelectMenu, type SelectOption } from '@/components/aoo'

/**
 * แถบค้นหา/กรอง — ของเดิมทุกหน้าเขียน input ค้นหาเองด้วยสไตล์ต่างกัน
 *
 * <FilterBar search={q} onSearch={setQ} placeholder="ค้นหาชื่อ">
 *   <FilterSelect label="สถานะ" value={status} options={...} onChange={setStatus} />
 * </FilterBar>
 */
export default function FilterBar({
  search,
  onSearch,
  placeholder = 'ค้นหา',
  children,
  actions,
  sticky = true,
}: {
  search?: string
  onSearch?: (v: string) => void
  placeholder?: string
  /** ตัวกรองเพิ่มเติม วางต่อจากช่องค้นหา */
  children?: ReactNode
  /** ปุ่มด้านขวาสุด */
  actions?: ReactNode
  sticky?: boolean
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 ${
        sticky ? 'sticky top-14 z-20' : ''
      }`}
    >
      {onSearch && (
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            // พื้นขาวตั้งแต่แรก — พื้นเทาอ่านเป็นช่องปิดใช้งานทั้งที่พิมพ์ได้
            // (เจ้าของทัก 29 ส.ค. 69) กรอบเข้มขึ้นหน่อยเพื่อให้ยังเห็นขอบช่อง
            // บนการ์ดพื้นขาว แล้วเน้นด้วยวงแหวนตอนโฟกัส
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-8 text-sm outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              aria-label="ล้างคำค้นหา"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {children}

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** ตัวกรองแบบเลือก — ใช้ dropdown ตัวเดียวกับที่อื่นทั้งระบบ */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  width = 160,
}: {
  label: string
  value: string | null
  options: SelectOption[]
  onChange: (v: string | null) => void
  width?: number
}) {
  return (
    <div style={{ width }}>
      <SelectMenu
        size="md"
        value={value}
        options={options}
        placeholder={label}
        clearable={`${label} — ทั้งหมด`}
        onChange={onChange}
      />
    </div>
  )
}
