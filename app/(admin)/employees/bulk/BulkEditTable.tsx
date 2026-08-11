'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { Check, ClipboardPaste, Search, Undo2 } from 'lucide-react'
import { Button, Pill, EmptyState, useToast, SelectMenu, MoneyInput } from '@/components/aoo'
import { saveBulk } from './actions'
import { isEnded, type BulkRow, type EmploymentStatus } from './types'
import { PageHeader } from '@/components/shared'
import { Table2 } from 'lucide-react'

export type Company = {
  id: string
  code: string
  name: string
}

/** หน้าที่ — เป็นตัวกำหนดตารางเวรกับรอบจ่ายเงิน (แทนหน่วยงานรายสาขาแบบเดิม) */
export type JobFunction = {
  id: string
  name: string
  payroll_cycle: string | null
  default_days_per_week: number | null
}

export type Person = BulkRow & {
  /** ชื่อที่ LINE ส่งมา — ใช้เป็นหลักยึดว่ากำลังกรอกให้ใคร แก้ไม่ได้ */
  line_display_name: string
  role: string
}

type Props = { people: Person[]; companies: Company[]; functions: JobFunction[] }

const CYCLES = [
  { value: 'c28', label: 'วันที่ 28' },
  { value: 'c30', label: 'วันที่ 30' },
  { value: 'c4', label: 'วันที่ 4' },
]

const TYPES = [
  { value: 'monthly', label: 'รายเดือน' },
  { value: 'daily', label: 'รายวัน' },
]

const STATUSES: { value: EmploymentStatus; label: string; dot: string }[] = [
  { value: 'active', label: 'ทำงานอยู่', dot: 'var(--leaf-500)' },
  { value: 'probation', label: 'ทดลองงาน', dot: 'var(--sun-500)' },
  { value: 'resigned', label: 'ลาออก', dot: 'var(--warm-400)' },
  { value: 'terminated', label: 'เลิกจ้าง', dot: 'var(--ruby-500)' },
  { value: 'retired', label: 'เกษียณ', dot: 'var(--grape-500)' },
]

/** อ่านวันที่จากข้อความ — รับ ISO · d/m/Y · ปี พ.ศ. */
function parseDate(raw: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined
  let y: number, m: number, d: number
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (iso) [, y, m, d] = iso.map(Number) as [number, number, number, number]
  else if (slash) [, d, m, y] = slash.map(Number) as [number, number, number, number]
  else return undefined
  if (y > 2400) y -= 543
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const baht = new Intl.NumberFormat('th-TH')

/* ------------------------------------------------------------------ *
 *  นิยามคอลัมน์
 *
 *  แต่ละคอลัมน์บอกวิธี "อ่านค่าจากข้อความ" ไว้ด้วย เพื่อให้วางจาก Excel
 *  ลงมาทั้งคอลัมน์ได้ — เป็นวิธีที่เร็วที่สุดเวลากรอกทีละ 58 คน
 * ------------------------------------------------------------------ */

type ColKey = keyof Pick<
  Person,
  | 'full_name'
  | 'nickname'
  | 'employment_status'
  | 'company_id'
  | 'job_function_id'
  | 'employment_type'
  | 'start_date'
  | 'days_per_week'
  | 'base_salary'
  | 'payroll_cycle'
>

type Column = {
  key: ColKey
  header: string
  width: number
  align?: 'right' | 'center'
  /** แปลงข้อความที่วางมาเป็นค่าจริง — คืน undefined ถ้าอ่านไม่ออก (ข้ามช่องนั้น) */
  parse: (
    raw: string,
    ctx: { companies: Company[]; functions: JobFunction[] }
  ) => Partial<Person> | undefined
}

const COLUMNS: Column[] = [
  {
    key: 'full_name',
    header: 'ชื่อ-นามสกุลจริง',
    width: 230,
    // กรอกชื่อ = ยืนยันไปในตัว ไม่ต้องมีปุ่มแยก
    parse: (raw) => {
      const v = raw.trim().replace(/\s+/g, ' ')
      return v ? { full_name: v, name_verified: true } : undefined
    },
  },
  {
    key: 'nickname',
    header: 'ชื่อเล่น',
    width: 130,
    parse: (raw) => ({ nickname: raw.trim().replace(/\s+/g, ' ') || null }),
  },
  {
    key: 'employment_status',
    header: 'สถานะ',
    width: 140,
    parse: (raw) => {
      const q = raw.trim().toLowerCase()
      const hit = STATUSES.find((s) => s.value === q || s.label === raw.trim())
      return hit ? { employment_status: hit.value } : undefined
    },
  },
  {
    key: 'company_id',
    header: 'บริษัท',
    width: 120,
    parse: (raw, { companies }) => {
      const q = raw.trim().toLowerCase()
      if (!q) return { company_id: null }
      const hit = companies.find(
        (c) => c.code.toLowerCase() === q || c.name.toLowerCase() === q
      )
      return hit ? { company_id: hit.id } : undefined
    },
  },
  {
    key: 'job_function_id',
    header: 'หน้าที่',
    width: 170,
    parse: (raw, { functions }) => {
      const q = raw.trim().toLowerCase()
      if (!q) return { job_function_id: null }
      const hit = functions.find((f) => f.name.toLowerCase() === q)
      return hit ? { job_function_id: hit.id } : undefined
    },
  },
  {
    key: 'employment_type',
    header: 'ประเภท',
    width: 110,
    parse: (raw) => {
      const q = raw.trim().toLowerCase()
      if (['daily', 'รายวัน'].includes(q)) return { employment_type: 'daily' }
      if (['monthly', 'รายเดือน'].includes(q)) return { employment_type: 'monthly' }
      return undefined
    },
  },
  {
    key: 'start_date',
    header: 'วันเริ่มงาน',
    width: 150,
    parse: (raw) => {
      const val = parseDate(raw)
      return val ? { start_date: val, start_date_verified: true } : undefined
    },
  },
  {
    key: 'days_per_week',
    header: 'วัน/สัปดาห์',
    width: 100,
    align: 'center',
    parse: (raw) => {
      const n = Number(raw.trim())
      if (!raw.trim()) return { days_per_week: null }
      return Number.isFinite(n) && n >= 1 && n <= 7 ? { days_per_week: n } : undefined
    },
  },
  {
    key: 'base_salary',
    header: 'เงินเดือน',
    width: 130,
    align: 'right',
    parse: (raw) => {
      const n = Number(raw.replace(/[,\s฿]/g, '').trim())
      if (!raw.trim()) return { base_salary: null }
      return Number.isFinite(n) && n >= 0 ? { base_salary: n } : undefined
    },
  },
  {
    key: 'payroll_cycle',
    header: 'รอบจ่าย',
    width: 130,
    parse: (raw) => {
      const q = raw.trim()
      if (!q) return { payroll_cycle: null }
      // เทียบ 28 กับ 30 ก่อน 4 — ไม่งั้น "วันที่ 4" ไปชนกับ "24" ที่ไม่มีจริง
      if (q.includes('28')) return { payroll_cycle: 'c28' }
      if (q.includes('30')) return { payroll_cycle: 'c30' }
      if (q === '4' || q.includes('ที่ 4')) return { payroll_cycle: 'c4' }
      return undefined
    },
  },
]

export default function BulkEditTable({ people, companies, functions }: Props) {
  const [rows, setRows] = useState<Person[]>(people)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<{ r: number; c: number } | null>(null)
  const [filter, setFilter] = useState('')
  const [showEnded, setShowEnded] = useState(false)
  const [pending, startTransition] = useTransition()
  const { pushToast } = useToast()

  const cellRefs = useRef(new Map<string, HTMLElement>())
  const setCellRef = (r: number, c: number) => (el: HTMLElement | null) => {
    const k = `${r}:${c}`
    if (el) cellRefs.current.set(k, el)
    else cellRefs.current.delete(k)
  }

  const original = useMemo(() => new Map(people.map((p) => [p.id, JSON.stringify(p)])), [people])
  const dirtyIds = useMemo(
    () => new Set(rows.filter((r) => original.get(r.id) !== JSON.stringify(r)).map((r) => r.id)),
    [rows, original]
  )

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return rows.filter((r) => {
      // คนที่ออกไปแล้วซ่อนไว้ก่อน — ไม่ใช่งานที่ต้องกรอกอีก แต่ยังเปิดดูได้
      if (!showEnded && isEnded(r.employment_status)) return false
      if (!q) return true
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.nickname ?? '').toLowerCase().includes(q) ||
        r.line_display_name.toLowerCase().includes(q) ||
        (companies.find((c) => c.id === r.company_id)?.code.toLowerCase().includes(q) ?? false) ||
        (functions.find((f) => f.id === r.job_function_id)?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [rows, filter, companies, functions, showEnded])

  const patch = useCallback((ids: Set<string> | string, changes: Partial<Person>) => {
    const idSet = typeof ids === 'string' ? new Set([ids]) : ids
    setRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, ...changes } : r)))
  }, [])

  /** เลือกหน้าที่แล้วเติมวัน/สัปดาห์ให้ตามค่าของหน้าที่ ไม่ต้องกรอกซ้ำ */
  const applyFunction = useCallback(
    (ids: Set<string> | string, functionId: string | null) => {
      const fn = functions.find((f) => f.id === functionId)
      patch(ids, {
        job_function_id: functionId,
        payroll_cycle: null, // ใช้ของหน้าที่ ถ้าคนนี้ไม่ได้ต่างจากเพื่อน
        days_per_week: fn?.default_days_per_week ?? null,
      })
    },
    [functions, patch]
  )

  /* ---- คีย์บอร์ด: เดินช่องเหมือน spreadsheet ---------------------- */
  const moveFocus = (r: number, c: number) => {
    const rr = Math.max(0, Math.min(visible.length - 1, r))
    const cc = Math.max(0, Math.min(COLUMNS.length - 1, c))
    setFocus({ r: rr, c: cc })
    const el = cellRefs.current.get(`${rr}:${cc}`)
    el?.focus()
    if (el instanceof HTMLInputElement) el.select()
  }

  const onCellKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      moveFocus(r + 1, c)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveFocus(r - 1, c)
    } else if (e.key === 'Escape') {
      ;(e.target as HTMLElement).blur()
    }
  }

  /* ---- วางจาก Excel ---------------------------------------------- *
   * คัดลอกคอลัมน์เงินเดือนจาก Excel มาวางที่ช่องแรก แล้วมันไหลลงทั้งคอลัมน์
   * รองรับหลายคอลัมน์พร้อมกันด้วย (คั่นด้วย tab)
   * ---------------------------------------------------------------- */
  const onPaste = (e: React.ClipboardEvent) => {
    if (!focus) return
    const text = e.clipboardData.getData('text/plain')
    if (!text || (!text.includes('\n') && !text.includes('\t'))) return // ค่าเดียว ปล่อยให้ input จัดการเอง

    e.preventDefault()
    const grid = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((line) => line.split('\t'))

    let applied = 0
    let skipped = 0
    setRows((prev) => {
      const next = [...prev]
      grid.forEach((line, dr) => {
        const target = visible[focus.r + dr]
        if (!target) return
        const idx = next.findIndex((x) => x.id === target.id)
        if (idx < 0) return
        line.forEach((raw, dc) => {
          const col = COLUMNS[focus.c + dc]
          if (!col) return
          const parsed = col.parse(raw, { companies, functions })
          if (parsed === undefined) {
            skipped++
            return
          }
          next[idx] = { ...next[idx], ...parsed }
          applied++
        })
      })
      return next
    })

    pushToast(
      skipped ? 'info' : 'ok',
      skipped
        ? `วางแล้ว ${applied} ช่อง · อ่านไม่ออก ${skipped} ช่อง`
        : `วางแล้ว ${applied} ช่อง`
    )
  }

  /* ---- บันทึก ----------------------------------------------------- */
  const save = () => {
    const dirty = rows.filter((r) => dirtyIds.has(r.id))
    startTransition(async () => {
      const res = await saveBulk(
        dirty.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          nickname: r.nickname,
          name_verified: r.name_verified,
          company_id: r.company_id,
          job_function_id: r.job_function_id,
          employment_type: r.employment_type,
          employment_status: r.employment_status,
          start_date: r.start_date,
          start_date_verified: r.start_date_verified,
          end_date: r.end_date,
          days_per_week: r.days_per_week,
          payroll_cycle: r.payroll_cycle,
          base_salary: r.base_salary,
        }))
      )
      if (res.ok) {
        pushToast(
          'ok',
          `บันทึก ${res.updated} คน${res.salaryRows ? ` · เพิ่มประวัติเงินเดือน ${res.salaryRows} รายการ` : ''}`
        )
      } else {
        pushToast('err', `บันทึก ${res.updated} คน · มีปัญหา ${res.errors.length} รายการ`)
        console.error(res.errors)
      }
    })
  }

  // นับเฉพาะคนที่ยังทำงานอยู่ — คนที่ออกไปแล้วไม่ต้องมีเงินเดือน/หน่วยงาน
  const current = rows.filter((r) => !isEnded(r.employment_status))
  const endedCount = rows.length - current.length
  const noRealName = current.filter((r) => !r.name_verified).length
  const noNickname = current.filter((r) => !r.nickname?.trim()).length
  const noCompany = current.filter((r) => !r.company_id).length
  const noFunction = current.filter((r) => !r.job_function_id).length
  const noSalary = current.filter((r) => r.base_salary === null).length
  const noStart = current.filter((r) => !r.start_date_verified).length
  // วันสุดท้ายไม่มีช่องให้กรอกในหน้านี้แล้ว — หน้านี้มีไว้กรอกคนที่ยังทำงานอยู่
  // ถ้ามีแถวไหนตกค้าง ให้ไปแก้ที่ปุ่ม "สิ้นสุดการเป็นพนักงาน" ในหน้ารายชื่อ
  const missingEndDate = rows.filter((r) => isEnded(r.employment_status) && !r.end_date).length
  const totalSalary = current.reduce((s, r) => s + (r.base_salary ?? 0), 0)

  return (
    <div className="space-y-4" onPaste={onPaste}>
      <PageHeader
        title="ใส่ข้อมูลพนักงานหลายคน"
        description="ติ๊กเลือกหลายคนแล้วตั้งค่าทีเดียว · แถวสีส้มคือที่แก้แล้วยังไม่บันทึก"
        icon={Table2}
        backHref="/employees"
      />

      {/* ── ยังขาดอะไร ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="neutral">ทำงานอยู่ {current.length} คน</Pill>
        {endedCount > 0 && (
          <button onClick={() => setShowEnded((v) => !v)} className="cursor-pointer">
            <Pill tone={showEnded ? 'accent' : 'neutral'}>
              ออกไปแล้ว {endedCount} คน · {showEnded ? 'ซ่อน' : 'แสดง'}
            </Pill>
          </button>
        )}
        <Chip label="ยังเป็นชื่อ LINE" n={noRealName} />
        <Chip label="ยังไม่มีชื่อเล่น" n={noNickname} />
        <Chip label="ยังไม่ได้ระบุบริษัท" n={noCompany} />
        <Chip label="ยังไม่ได้ระบุหน้าที่" n={noFunction} />
        <Chip label="ยังไม่มีเงินเดือน" n={noSalary} />
        <Chip label="วันเริ่มงานยังไม่ยืนยัน" n={noStart} />
        {missingEndDate > 0 && (
          <Chip label="ออกแล้วแต่ไม่มีวันสุดท้าย (แก้ที่หน้ารายชื่อ)" n={missingEndDate} />
        )}
        <span className="ml-auto text-sm text-gray-500">
          รวมเงินเดือนที่กรอกแล้ว{' '}
          <span className="font-mono font-semibold tabular-nums text-gray-800">
            {baht.format(totalSalary)}
          </span>{' '}
          บาท/เดือน
        </span>
      </div>

      {/* ── แถบเครื่องมือ ───────────────────────────────────── */}
      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="ค้นหาชื่อ / ชื่อเล่น / บริษัท / หน้าที่"
            className="h-8 w-52 rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-2 text-sm outline-none focus:border-red-400 focus:bg-white"
          />
        </div>

        <Pill tone={selected.size ? 'accent' : 'neutral'}>เลือกไว้ {selected.size} คน</Pill>

        <div className="w-36">
          <SelectMenu
            disabled={!selected.size}
            value={null}
            placeholder="→ ตั้งบริษัท"
            options={companies.map((c) => ({ value: c.id, label: c.code, hint: c.name }))}
            searchThreshold={99}
            onChange={(v) => v && patch(selected, { company_id: v })}
          />
        </div>
        <div className="w-40">
          <SelectMenu
            disabled={!selected.size}
            value={null}
            placeholder="→ ตั้งหน้าที่"
            options={functions.map((f) => ({ value: f.id, label: f.name }))}
            searchThreshold={99}
            onChange={(v) => v && applyFunction(selected, v)}
          />
        </div>
        <div className="w-36">
          <SelectMenu
            disabled={!selected.size}
            value={null}
            placeholder="→ ตั้งประเภท"
            options={TYPES}
            searchThreshold={99}
            onChange={(v) => v && patch(selected, { employment_type: v as 'monthly' | 'daily' })}
          />
        </div>
        <div className="w-36">
          <SelectMenu
            disabled={!selected.size}
            value={null}
            placeholder="→ ตั้งสถานะ"
            options={STATUSES}
            searchThreshold={99}
            onChange={(v) => {
              if (!v) return
              const next = v as EmploymentStatus
              patch(
                selected,
                isEnded(next)
                  ? { employment_status: next, end_date: today() }
                  : { employment_status: next, end_date: null }
              )
            }}
          />
        </div>
        <input
          type="date"
          disabled={!selected.size}
          onChange={(e) =>
            e.target.value && patch(selected, { start_date: e.target.value, start_date_verified: true })
          }
          title="ตั้งวันเริ่มงานให้ทุกคนที่เลือก"
          className="h-8 rounded-lg border border-gray-200 px-2 text-sm disabled:opacity-40"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={!selected.size}
          onClick={() => patch(selected, { start_date_verified: true })}
          title="ถ้าวันที่ที่ขึ้นอยู่ถูกอยู่แล้ว กดยืนยันได้เลย"
        >
          <Check size={14} /> ยืนยันวันที่เดิม
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {dirtyIds.size > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setRows(people)}>
                <Undo2 size={14} /> ย้อนกลับ
              </Button>
              <span className="text-sm text-orange-700">แก้ไว้ {dirtyIds.size} คน</span>
            </>
          )}
          <Button size="sm" onClick={save} disabled={!dirtyIds.size || pending}>
            {pending ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>

      {/* ── ตาราง ───────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Search size={24} className="text-gray-400" />}
          title="ไม่พบพนักงานที่ค้นหา"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 w-9 border-b border-gray-200 bg-gray-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(visible.map((r) => r.id)) : new Set())
                    }
                  />
                </th>
                <th className="sticky left-9 z-10 min-w-[170px] border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
                  ชื่อใน LINE
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{ minWidth: col.width }}
                    className={`border-b border-gray-200 px-3 py-2 font-medium text-gray-600 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, r) => {
                const fn = functions.find((f) => f.id === row.job_function_id)
                const isDirty = dirtyIds.has(row.id)
                const isSel = selected.has(row.id)
                const rowBg = isDirty ? 'bg-orange-50' : isSel ? 'bg-red-50/40' : 'bg-white'

                return (
                  <tr key={row.id} className={`${rowBg} border-b border-gray-100 last:border-0`}>
                    <td className={`sticky left-0 z-10 px-3 py-1 ${rowBg}`}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                            return next
                          })
                        }
                      />
                    </td>
                    {/* ชื่อ LINE เป็นหลักยึดว่ากำลังกรอกให้ใคร — ชื่อจริงอยู่ในช่องที่แก้ได้ */}
                    <td className={`sticky left-9 z-10 border-r border-gray-200 px-3 py-1 ${rowBg}`}>
                      <div className="truncate text-gray-700">{row.line_display_name}</div>
                      <div className="text-xs text-gray-400">{row.role}</div>
                    </td>

                    {COLUMNS.map((col, c) => (
                      <Cell
                        key={col.key}
                        col={col}
                        row={row}
                        fn={fn}
                        companies={companies}
                        functions={functions}
                        innerRef={setCellRef(r, c)}
                        onKeyDown={(e) => onCellKeyDown(e, r, c)}
                        onFocus={() => setFocus({ r, c })}
                        onChange={(changes) =>
                          // เลือกหน้าที่แล้วเติมวัน/สัปดาห์ให้ด้วย ไม่ต้องกรอกซ้ำ
                          col.key === 'job_function_id'
                            ? applyFunction(row.id, (changes.job_function_id as string | null) ?? null)
                            : patch(row.id, changes)
                        }
                      />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-gray-500">
        <ClipboardPaste size={14} className="mt-0.5 shrink-0 text-gray-400" />
        <span>
          <strong className="font-medium text-gray-700">วางจาก Excel ได้</strong> — คลิกช่องแรกที่จะวาง
          แล้วกด ⌘V ค่าจะไหลลงทั้งคอลัมน์ (คัดลอกหลายคอลัมน์พร้อมกันก็ได้) ·
          ลูกศรขึ้น-ลงกับ Enter เดินช่องได้เหมือน Excel ·
          เงินเดือนเก็บเป็นประวัติตามวันที่มีผล แก้ทีหลังของเก่าไม่หาย
        </span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Cell({
  col,
  row,
  fn,
  companies,
  functions,
  innerRef,
  onChange,
  onKeyDown,
  onFocus,
}: {
  col: Column
  row: Person
  /** หน้าที่ของแถวนี้ — ใช้โชว์ค่าปริยายในช่องที่ปล่อยว่างไว้ */
  fn?: JobFunction
  companies: Company[]
  functions: JobFunction[]
  innerRef: (el: HTMLElement | null) => void
  onChange: (changes: Partial<Person>) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onFocus: () => void
}) {
  const base =
    'h-8 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:border-red-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(239,74,34,0.15)]'
  const inputShared = { onKeyDown, onFocus, ref: innerRef as never }
  // ในตารางใช้ flat — ถ้าโชว์กรอบทุกช่อง 58 แถว × 4 คอลัมน์ จะลายตามาก
  const menuShared = {
    onKeyDown,
    onFocus,
    triggerRef: innerRef,
    size: 'sm' as const,
    variant: 'flat' as const,
  }

  switch (col.key) {
    // ชื่อจริงกับชื่อเล่นเป็นสองช่องที่ "ว่างแล้วต้องเห็นชัด" — ชื่อ LINE
    // อ่านแล้วไม่รู้ว่าใคร รายงานทั้งระบบเลยอ่านไม่ออกตามไปด้วย
    case 'full_name':
      return (
        <td className="px-2 py-1">
          <input
            {...inputShared}
            type="text"
            value={row.full_name}
            placeholder="ชื่อ นามสกุล"
            onChange={(e) => onChange({ full_name: e.target.value, name_verified: true })}
            title={row.name_verified ? undefined : 'ยังเป็นชื่อ LINE ไม่ใช่ชื่อจริง'}
            className={`${base} ${
              row.name_verified
                ? 'border-transparent'
                : 'border-orange-300 bg-orange-50 text-orange-800'
            }`}
          />
        </td>
      )

    case 'nickname':
      return (
        <td className="px-2 py-1">
          <input
            {...inputShared}
            type="text"
            value={row.nickname ?? ''}
            placeholder="เช่น แตน"
            onChange={(e) => onChange({ nickname: e.target.value || null })}
            className={`${base} ${
              row.nickname?.trim() ? 'border-transparent' : 'border-orange-300 bg-orange-50'
            }`}
          />
        </td>
      )

    case 'employment_status':
      return (
        <td className="px-2 py-1">
          <SelectMenu
            {...menuShared}
            value={row.employment_status}
            options={STATUSES}
            searchThreshold={99}
            onChange={(v) => {
              const next = (v ?? 'active') as EmploymentStatus
              onChange(
                isEnded(next)
                  ? // ออกแล้วต้องมีวันสุดท้าย — เดาให้เป็นวันนี้ไว้ก่อน แก้ได้ในช่องถัดไป
                    { employment_status: next, end_date: row.end_date ?? today() }
                  : { employment_status: next, end_date: null }
              )
            }}
          />
        </td>
      )

    case 'company_id':
      return (
        <td className="px-2 py-1">
          <SelectMenu
            {...menuShared}
            value={row.company_id}
            invalid={!row.company_id}
            placeholder="— ยังไม่ระบุ —"
            clearable="— ยังไม่ระบุ —"
            searchThreshold={99}
            options={companies.map((c) => ({ value: c.id, label: c.code, hint: c.name }))}
            onChange={(v) => onChange({ company_id: v })}
          />
        </td>
      )

    case 'job_function_id':
      return (
        <td className="px-2 py-1">
          <SelectMenu
            {...menuShared}
            value={row.job_function_id}
            invalid={!row.job_function_id}
            placeholder="— ยังไม่ระบุ —"
            clearable="— ยังไม่ระบุ —"
            searchThreshold={99}
            options={functions.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(v) => onChange({ job_function_id: v })}
          />
        </td>
      )

    case 'employment_type':
      return (
        <td className="px-2 py-1">
          <SelectMenu
            {...menuShared}
            value={row.employment_type}
            options={TYPES}
            searchThreshold={99}
            onChange={(v) => onChange({ employment_type: (v ?? 'monthly') as 'monthly' | 'daily' })}
          />
        </td>
      )

    case 'start_date':
      return (
        <td className="px-2 py-1">
          <input
            {...inputShared}
            type="date"
            value={row.start_date ?? ''}
            onChange={(e) =>
              onChange({ start_date: e.target.value || null, start_date_verified: !!e.target.value })
            }
            title={row.start_date_verified ? 'ยืนยันแล้ว' : 'ยังเป็นวันสมัคร ไม่ใช่วันเริ่มงานจริง'}
            className={`${base} ${
              row.start_date_verified
                ? 'border-transparent'
                : 'border-orange-300 bg-orange-50 text-orange-800'
            }`}
          />
        </td>
      )


    case 'days_per_week':
      return (
        <td className="px-2 py-1">
          <input
            {...inputShared}
            type="number"
            min={1}
            max={7}
            value={row.days_per_week ?? ''}
            placeholder={fn?.default_days_per_week ? String(fn.default_days_per_week) : ''}
            onChange={(e) =>
              onChange({ days_per_week: e.target.value ? Number(e.target.value) : null })
            }
            className={`${base} border-transparent text-center tabular-nums`}
          />
        </td>
      )

    case 'base_salary':
      return (
        <td className="px-2 py-1">
          <MoneyInput
            {...inputShared}
            value={row.base_salary ?? ''}
            onValueChange={(_, text) => onChange({ base_salary: text ? Number(text) : null })}
            className={`${base} text-right font-mono tabular-nums ${
              row.base_salary === null ? 'border-red-300 bg-red-50' : 'border-transparent'
            }`}
          />
        </td>
      )

    case 'payroll_cycle':
      return (
        <td className="px-2 py-1">
          <SelectMenu
            {...menuShared}
            value={row.payroll_cycle}
            options={CYCLES}
            searchThreshold={99}
            placeholder={
              fn?.payroll_cycle
                ? `ตามหน้าที่ (${CYCLES.find((c) => c.value === fn.payroll_cycle)?.label})`
                : 'ตามหน้าที่'
            }
            clearable="ตามหน้าที่"
            onChange={(v) => onChange({ payroll_cycle: v })}
          />
        </td>
      )
  }
}

const today = () => new Date().toISOString().slice(0, 10)

function Chip({ label, n }: { label: string; n: number }) {
  return (
    <Pill tone={n === 0 ? 'success' : 'danger'}>
      {label} {n}
    </Pill>
  )
}
