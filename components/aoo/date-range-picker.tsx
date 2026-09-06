'use client'

/**
 * `<DateRangePicker>` — ตัวเลือกช่วงวันที่ตัวเดียวของทั้งระบบ (พอร์ตจาก aoocommerce 7 ก.ย. 69)
 *
 * เดิม amgo มี 2 ตัวชนกัน (ของ aoo แบบ portal ไม่มีทางลัด · ของ shadcn ใช้ 4 หน้ารายงาน)
 * และหน้ารายงานรูปใช้ DatePicker 2 ช่องต่อกันจนล้นกรอบบนมือถือ — เจ้าของสั่งให้เหลือตัวเดียว
 *
 * · ค่า: `{ since, until }` ISO 'yyyy-MM-dd' หรือ `null` (ยังไม่เลือก/ล้าง) — ส่งออกเฉพาะเมื่อครบช่วง
 * · ทางลัด: วันนี้ · เมื่อวาน · 7 วัน · 30 วัน · เดือนนี้ · เดือนที่แล้ว
 * · เดสก์ท็อป: ปฏิทิน 2 เดือนคู่ + ทางลัดคอลัมน์ซ้าย · มือถือ: ปฏิทินเดียว ทางลัดเป็นชิปแถวบน
 *   popup ตรึงกับจอ (fixed) ไม่ล้นขอบ
 * · ปุ่มสูง 40 เท่าคอนโทรล aoo อื่น · ป้ายแบบสั้น "25 ส.ค. 69 → 7 ก.ย. 69" พอดีมือถือ
 * · กดชื่อเดือน/ปี = เลือกเดือน/ปีแบบตาราง (ปี พ.ศ.)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { addMonths, endOfMonth, format, isValid, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'

export type DateRangeValue = { since: string; until: string } | null

export interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  placeholder?: string
  /** ปุ่ม × ล้างค่า — หน้าที่ต้องมีช่วงเสมอ (รายงาน) ปิดไว้ */
  clearable?: boolean
  showShortcuts?: boolean
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  /** วันในสัปดาห์ที่เลือกไม่ได้ (0=อาทิตย์ … 6=เสาร์) */
  disabledDaysOfWeek?: number[]
  popupAlign?: 'left' | 'right'
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

/* ── helpers ─────────────────────────────────────────────────────────── */

const TH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const TH_WEEKDAY = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function parseIso(s: string | null | undefined): Date | undefined {
  if (!s) return undefined
  const d = new Date(`${s.slice(0, 10)}T00:00:00`)
  return isValid(d) ? d : undefined
}
const iso = (d: Date) => format(d, 'yyyy-MM-dd')
/** '25 ส.ค. 69' */
export function formatDayShort(d: Date): string {
  return `${d.getDate()} ${TH_SHORT[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`
}

interface Shortcut {
  label: string
  range: () => { from: Date; to: Date }
}
const today = () => startOfDay(new Date())
const SHORTCUTS: Shortcut[] = [
  { label: 'วันนี้', range: () => ({ from: today(), to: today() }) },
  { label: 'เมื่อวาน', range: () => ({ from: subDays(today(), 1), to: subDays(today(), 1) }) },
  { label: '7 วัน', range: () => ({ from: subDays(today(), 6), to: today() }) },
  { label: '30 วัน', range: () => ({ from: subDays(today(), 29), to: today() }) },
  { label: 'เดือนนี้', range: () => ({ from: startOfMonth(today()), to: endOfMonth(today()) }) },
  { label: 'เดือนที่แล้ว', range: () => { const m = subMonths(today(), 1); return { from: startOfMonth(m), to: endOfMonth(m) } } },
]

// classNames ของ react-day-picker v9 — ซ่อน caption/nav ของมัน ใช้หัวปฏิทินของเราแทน
// สีใช้ red-* ซึ่งใน theme นี้คือ coral สีแบรนด์ (ดู @theme ใน globals.css)
const RANGE_CLASSES = {
  months: '',
  month: '',
  month_caption: 'hidden',
  nav: 'hidden',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday: 'pb-1 w-10 text-center text-xs font-semibold text-gray-400',
  week: '',
  day: 'p-0 text-center',
  day_button: 'h-10 w-10 rounded-full text-sm text-gray-700 transition-colors hover:bg-red-100 focus:outline-none',
  // วงแหวน "วันนี้" อยู่ที่ปุ่มด้านใน · ห้ามตั้งสีตัวอักษรตรงนี้ (selected ตั้ง !text-white ที่ <td>)
  today: 'font-bold [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-red-500',
  selected: '!bg-red-400 !text-white',
  range_start: '!bg-red-500 !text-white !rounded-l-full',
  range_end: '!bg-red-500 !text-white !rounded-r-full',
  range_middle: '!bg-red-300 !rounded-none !text-white',
  outside: 'text-gray-300',
  disabled: 'cursor-not-allowed text-gray-300',
}
const RANGE_MODIFIERS = { hidden: '[&]:!bg-transparent [&]:!text-transparent' }

function CalendarHeader({
  month, onPrev, onNext, onMonthClick, onYearClick, showPrev = true, showNext = true,
}: {
  month: Date
  onPrev?: () => void
  onNext?: () => void
  onMonthClick: () => void
  onYearClick: () => void
  showPrev?: boolean
  showNext?: boolean
}) {
  return (
    <div className="mb-1 flex items-center justify-between">
      {showPrev ? (
        <button type="button" onClick={onPrev} className="rounded-lg p-1 hover:bg-gray-100" aria-label="เดือนก่อน">
          <ChevronLeft size={18} className="text-gray-500" />
        </button>
      ) : <div className="w-7" />}
      <div className="flex items-center gap-1">
        <button type="button" onClick={onMonthClick} className="rounded-lg px-2 py-1 text-base font-bold text-gray-900 hover:bg-gray-100">
          {TH_FULL[month.getMonth()]}
        </button>
        <button type="button" onClick={onYearClick} className="rounded-lg px-2 py-1 text-base font-bold text-gray-900 hover:bg-gray-100">
          {month.getFullYear() + 543}
        </button>
      </div>
      {showNext ? (
        <button type="button" onClick={onNext} className="rounded-lg p-1 hover:bg-gray-100" aria-label="เดือนถัดไป">
          <ChevronRight size={18} className="text-gray-500" />
        </button>
      ) : <div className="w-7" />}
    </div>
  )
}

/* ── component ───────────────────────────────────────────────────────── */

type ViewMode = 'calendar' | 'months' | 'years'

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'เลือกช่วงวันที่',
  clearable = true,
  showShortcuts = true,
  disabled = false,
  minDate,
  maxDate,
  disabledDaysOfWeek,
  popupAlign = 'left',
  className,
  style,
  ...aria
}: DateRangePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [pickerSide, setPickerSide] = useState<'left' | 'right'>('left')
  const [displayMonth, setDisplayMonth] = useState<Date>(() => parseIso(value?.since) ?? new Date())
  const [yearPageStart, setYearPageStart] = useState(() => Math.floor(new Date().getFullYear() / 12) * 12)
  const [isNarrow, setIsNarrow] = useState(false)
  const [fixedTop, setFixedTop] = useState(0)

  // ค่าที่กำลังเลือก (คลิกแรก = เริ่ม, คลิกสอง = จบ) — ส่งออกให้ parent เฉพาะเมื่อครบช่วง
  const committedFrom = useMemo(() => parseIso(value?.since), [value?.since])
  const committedTo = useMemo(() => parseIso(value?.until), [value?.until])
  const [draft, setDraft] = useState<{ from: Date; to?: Date } | null>(null)
  const from = draft?.from ?? committedFrom
  const to = draft ? draft.to : committedTo
  const rightMonth = useMemo(() => addMonths(displayMonth, 1), [displayMonth])

  const disabledDays = useMemo(() => {
    const rules: Array<{ before: Date } | { after: Date } | { dayOfWeek: number[] }> = []
    if (minDate) rules.push({ before: minDate })
    if (maxDate) rules.push({ after: maxDate })
    if (disabledDaysOfWeek?.length) rules.push({ dayOfWeek: disabledDaysOfWeek })
    return rules.length ? rules : undefined
  }, [minDate, maxDate, disabledDaysOfWeek])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setViewMode('calendar')
    setDraft(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  useEffect(() => {
    if (committedFrom) setDisplayMonth(committedFrom)
  }, [committedFrom])

  const toggle = () => {
    if (disabled) return
    if (open) { close(); return }
    // มือถือ: popup ตรึงกับจอใต้ปุ่ม ไม่ให้ล้นขอบ · ถ้าใกล้ล่างจอ เลื่อนขึ้นให้พอ
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setFixedTop(Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 470)))
    setDraft(null)
    setOpen(true)
  }

  const commit = useCallback((a: Date, b: Date) => {
    const [s, e] = a <= b ? [a, b] : [b, a]
    onChange({ since: iso(s), until: iso(e) })
    setDraft(null)
    close()
  }, [onChange, close])

  const handleDayClick = useCallback((day: Date) => {
    if (!draft) setDraft({ from: day })          // คลิกแรก
    else commit(draft.from, day)                  // คลิกสอง — สลับให้เองถ้ากดย้อน
  }, [draft, commit])

  const handleShortcut = (s: Shortcut) => { const r = s.range(); commit(r.from, r.to) }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setDraft(null)
  }

  const selected = useMemo<DateRange | undefined>(() => (from ? { from, to } : undefined), [from, to])

  const label = committedFrom
    ? committedTo && committedTo.getTime() !== committedFrom.getTime()
      ? `${formatDayShort(committedFrom)} → ${formatDayShort(committedTo)}`
      : formatDayShort(committedFrom)
    : ''
  const hint = draft && !draft.to ? `${formatDayShort(draft.from)} → เลือกวันสิ้นสุด` : null

  const monthYear = () => {
    const target = pickerSide === 'right' ? rightMonth : displayMonth
    return viewMode === 'months' ? (
      <div className="grid grid-cols-3 gap-2 py-2" style={{ width: 280 }}>
        {TH_SHORT.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => { setDisplayMonth(new Date(displayMonth.getFullYear(), pickerSide === 'right' ? i - 1 : i, 1)); setViewMode('calendar') }}
            className={`rounded-lg py-3 text-base font-bold ${target.getMonth() === i ? 'bg-red-500 text-white' : 'text-gray-700 hover:bg-red-50'}`}
          >
            {name}
          </button>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-3 gap-2 py-2" style={{ width: 280 }}>
        {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((year) => (
          <button
            key={year}
            type="button"
            onClick={() => { setDisplayMonth(new Date(year, displayMonth.getMonth(), 1)); setViewMode('months') }}
            className={`rounded-lg py-3 text-base font-bold ${target.getFullYear() === year ? 'bg-red-500 text-white' : 'text-gray-700 hover:bg-red-50'}`}
          >
            {year + 543}
          </button>
        ))}
      </div>
    )
  }

  const dayPicker = (month: Date, onMonthChange: (m: Date) => void) => (
    <DayPicker
      mode="range"
      selected={selected}
      onSelect={() => { /* คุมเองผ่าน onDayClick */ }}
      onDayClick={handleDayClick}
      month={month}
      onMonthChange={onMonthChange}
      formatters={{ formatWeekdayName: (d) => TH_WEEKDAY[d.getDay()] }}
      hideNavigation
      showOutsideDays={false}
      disabled={disabledDays}
      classNames={RANGE_CLASSES}
      modifiersClassNames={RANGE_MODIFIERS}
    />
  )

  const headerNav = {
    onPrev: () => { if (viewMode === 'calendar') setDisplayMonth(subMonths(displayMonth, 1)); else if (viewMode === 'years') setYearPageStart((p) => p - 12) },
    onNext: () => { if (viewMode === 'calendar') setDisplayMonth(addMonths(displayMonth, 1)); else if (viewMode === 'years') setYearPageStart((p) => p + 12) },
  }

  const shortcuts = showShortcuts && (
    <div className={isNarrow ? 'mb-2 flex flex-wrap gap-1.5' : 'flex w-32 flex-col border-r border-gray-100 py-2'}>
      {SHORTCUTS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => handleShortcut(s)}
          className={
            isNarrow
              ? 'rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-red-50'
              : 'px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-red-50 hover:text-red-700'
          }
        >
          {s.label}
        </button>
      ))}
    </div>
  )

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`} style={style}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={aria['aria-label'] ?? placeholder}
        aria-expanded={open}
        className={`flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm transition-colors ${
          open ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200 hover:border-gray-300'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <Calendar size={16} className="shrink-0 text-gray-400" />
        <span className={`flex-1 truncate tabular-nums ${label ? 'text-gray-900' : 'text-gray-400'}`}>{label || placeholder}</span>
        {clearable && label && !disabled ? (
          <span onClick={handleClear} className="shrink-0 rounded p-0.5 hover:bg-gray-100" aria-label="ล้างช่วงวันที่">
            <X size={14} className="text-gray-400" />
          </span>
        ) : (
          <ChevronDown size={15} className="shrink-0 text-gray-400" />
        )}
      </button>

      {open && (
        <div
          className={`z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ${
            isNarrow ? 'fixed inset-x-3' : `absolute mt-1 ${popupAlign === 'right' ? 'right-0' : 'left-0'}`
          }`}
          style={isNarrow ? { top: fixedTop } : undefined}
        >
          <div className={isNarrow ? 'p-3' : 'flex'}>
            {!isNarrow && shortcuts}
            <div className={isNarrow ? '' : 'p-3'}>
              {isNarrow && shortcuts}
              {hint && <p className="mb-1 text-xs text-red-600">{hint}</p>}

              {isNarrow ? (
                <>
                  <CalendarHeader
                    month={displayMonth}
                    {...headerNav}
                    onMonthClick={() => { setPickerSide('left'); setViewMode(viewMode === 'months' ? 'calendar' : 'months') }}
                    onYearClick={() => { setPickerSide('left'); setViewMode(viewMode === 'years' ? 'calendar' : 'years'); setYearPageStart(Math.floor(displayMonth.getFullYear() / 12) * 12) }}
                  />
                  {viewMode === 'calendar' ? dayPicker(displayMonth, setDisplayMonth) : monthYear()}
                </>
              ) : viewMode === 'calendar' ? (
                <div className="flex gap-4">
                  <div>
                    <CalendarHeader
                      month={displayMonth}
                      onPrev={() => setDisplayMonth(subMonths(displayMonth, 1))}
                      showNext={false}
                      onMonthClick={() => { setPickerSide('left'); setViewMode('months') }}
                      onYearClick={() => { setPickerSide('left'); setViewMode('years'); setYearPageStart(Math.floor(displayMonth.getFullYear() / 12) * 12) }}
                    />
                    {dayPicker(displayMonth, setDisplayMonth)}
                  </div>
                  <div className="w-px bg-gray-100" />
                  <div>
                    <CalendarHeader
                      month={rightMonth}
                      onNext={() => setDisplayMonth(addMonths(displayMonth, 1))}
                      showPrev={false}
                      onMonthClick={() => { setPickerSide('right'); setViewMode('months') }}
                      onYearClick={() => { setPickerSide('right'); setViewMode('years'); setYearPageStart(Math.floor(rightMonth.getFullYear() / 12) * 12) }}
                    />
                    {dayPicker(rightMonth, (m) => setDisplayMonth(subMonths(m, 1)))}
                  </div>
                </div>
              ) : (
                monthYear()
              )}

              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-xs text-gray-500">{draft ? 'กดวันสิ้นสุด' : 'กดวันเริ่ม แล้วกดวันสิ้นสุด'}</span>
                <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** ชื่อเดิมของปุ่มเปิดตัวเลือกช่วง — ตอนนี้คือตัวเดียวกัน คงไว้ให้โค้ดเก่าไม่พัง */
export const DateRangeButton = DateRangePicker
