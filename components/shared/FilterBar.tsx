'use client'

import { useState, type ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button, Input, Modal, SelectMenu, type SelectOption } from '@/components/aoo'

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
  lead,
  sticky = true,
  activeCount = 0,
}: {
  search?: string
  onSearch?: (v: string) => void
  placeholder?: string
  /** ตัวกรองเพิ่มเติม วางต่อจากช่องค้นหา */
  children?: ReactNode
  /** ปุ่มด้านขวาสุด */
  actions?: ReactNode
  /** วางหน้าสุดแทนช่องค้นหา (เช่น แถบเลือกคน) — มือถืออยู่แถวเดียวกับปุ่ม "กรอง" · จอใหญ่เต็มแถว */
  lead?: ReactNode
  sticky?: boolean
  /** จำนวนตัวกรองที่ตั้งอยู่ — โชว์บนปุ่ม "กรอง" ของมือถือ */
  activeCount?: number
}) {
  // มือถือ: ตัวกรองอยู่ในหน้าต่างที่เปิดจากปุ่ม "กรอง" — กางในหน้าแล้วดันบอร์ดลงไปทั้งจอ (เจ้าของทัก 28 ต.ค. 69)
  const [open, setOpen] = useState(false)

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 ${
        sticky ? 'sticky top-14 z-20' : ''
      }`}
    >
      {lead && <div className="min-w-0 flex-1 sm:basis-full">{lead}</div>}

      {onSearch && (
        // ใช้ Input ตัวกลาง — เดิมเขียน input เองสูง 36px ไม่เท่าช่องอื่นในแถว (เจ้าของทัก 28 ต.ค. 69)
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            prefix={<Search size={15} className="text-gray-400" />}
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              aria-label="ล้างคำค้นหา"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {children && (
        // ห่ออีกชั้น — .aoo-btn ไม่อยู่ใน @layer เลยชนะ class `hidden` ของ Tailwind
        <div className="sm:hidden">
          <Button
            variant={activeCount > 0 ? 'soft' : 'secondary'}
            icon={SlidersHorizontal}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            {activeCount > 0 ? `กรอง (${activeCount})` : 'กรอง'}
          </Button>
        </div>
      )}

      {children && <div className="hidden sm:contents">{children}</div>}

      {children && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="กรอง"
          footer={
            <Button className="w-full" onClick={() => setOpen(false)}>
              ดูผล
            </Button>
          }
        >
          <div className="aoo-filter-sheet">{children}</div>
        </Modal>
      )}

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
