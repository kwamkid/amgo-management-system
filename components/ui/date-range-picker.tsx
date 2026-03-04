'use client'

import { useState } from 'react'
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays,
  isSameMonth, isSameDay, isToday,
  isWithinInterval, isBefore,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface DateRange {
  from?: Date
  to?: Date
}

interface DateRangePickerProps {
  startDate: string // 'yyyy-MM-dd'
  endDate: string   // 'yyyy-MM-dd'
  onChange: (startDate: string, endDate: string) => void
  className?: string
}

export const DATE_RANGE_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: 'yesterday', label: 'เมื่อวาน' },
  { key: 'thisWeek', label: 'สัปดาห์นี้' },
  { key: 'lastWeek', label: 'สัปดาห์ที่แล้ว' },
  { key: 'thisMonth', label: 'เดือนนี้' },
  { key: 'lastMonth', label: 'เดือนที่แล้ว' },
]

export function getPresetDates(key: string): { start: Date; end: Date } {
  const now = new Date()
  switch (key) {
    case 'today': return { start: now, end: now }
    case 'yesterday': {
      const d = new Date(now); d.setDate(now.getDate() - 1)
      return { start: d, end: d }
    }
    case 'thisWeek': {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay())
      const e = new Date(now); e.setDate(now.getDate() + (6 - now.getDay()))
      return { start: s, end: e }
    }
    case 'lastWeek': {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay() - 7)
      const e = new Date(now); e.setDate(now.getDate() - now.getDay() - 1)
      return { start: s, end: e }
    }
    case 'thisMonth': return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'lastMonth': {
      const lm = subMonths(now, 1)
      return { start: startOfMonth(lm), end: endOfMonth(lm) }
    }
    default: return { start: now, end: now }
  }
}

// Single month range calendar
function RangeMonthCalendar({
  month,
  range,
  hoverDate,
  onDayClick,
  onDayHover,
}: {
  month: Date
  range: DateRange
  hoverDate: Date | null
  onDayClick: (date: Date) => void
  onDayHover: (date: Date | null) => void
}) {
  const days = (() => {
    const start = startOfWeek(startOfMonth(month))
    const end = endOfWeek(endOfMonth(month))
    const ds: Date[] = []
    let d = start
    while (d <= end) { ds.push(d); d = addDays(d, 1) }
    return ds
  })()

  const weekDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

  // When hovering mid-selection, show a preview range
  const effectiveFrom = (() => {
    if (range.from && !range.to && hoverDate && isBefore(hoverDate, range.from)) return hoverDate
    return range.from
  })()
  const effectiveTo = (() => {
    if (range.from && !range.to && hoverDate) {
      return isBefore(hoverDate, range.from) ? range.from : hoverDate
    }
    return range.to
  })()

  const inRange = (date: Date) => {
    if (!effectiveFrom || !effectiveTo) return false
    return isWithinInterval(date, { start: effectiveFrom, end: effectiveTo })
  }
  const isStart = (date: Date) => !!(effectiveFrom && isSameDay(date, effectiveFrom))
  const isEnd = (date: Date) => !!(effectiveTo && isSameDay(date, effectiveTo))
  const isSingleDay = !!(effectiveFrom && effectiveTo && isSameDay(effectiveFrom, effectiveTo))

  return (
    <div className="p-3 select-none">
      <div className="text-sm font-medium text-center mb-3 text-gray-700">
        {format(month, 'MMMM yyyy', { locale: th })}
      </div>
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map(w => (
          <div key={w} className="text-center text-[11px] text-gray-400 py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inCurrentMonth = isSameMonth(day, month)
          const dayIsStart = isStart(day)
          const dayIsEnd = isEnd(day)
          const dayInRange = inRange(day)
          const isTodayDay = isToday(day)

          return (
            <div
              key={i}
              className={cn(
                'h-9 flex items-center justify-center',
                // range highlight strip (not on endpoints)
                dayInRange && !dayIsStart && !dayIsEnd && 'bg-red-50',
                // left half fill on end
                dayIsEnd && !isSingleDay && 'bg-gradient-to-r from-red-50 to-transparent',
                // right half fill on start
                dayIsStart && !isSingleDay && 'bg-gradient-to-l from-red-50 to-transparent',
              )}
            >
              <button
                type="button"
                onClick={() => inCurrentMonth && onDayClick(day)}
                onMouseEnter={() => onDayHover(day)}
                onMouseLeave={() => onDayHover(null)}
                className={cn(
                  'h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors',
                  !inCurrentMonth && 'text-gray-300 pointer-events-none',
                  inCurrentMonth && !dayIsStart && !dayIsEnd && 'hover:bg-red-100 cursor-pointer',
                  isTodayDay && !dayIsStart && !dayIsEnd && 'font-semibold text-red-500',
                  (dayIsStart || dayIsEnd) && 'bg-red-600 text-white hover:bg-red-700 font-semibold cursor-pointer',
                )}
              >
                {format(day, 'd')}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [activePreset, setActivePreset] = useState<string>('thisMonth')
  const [leftMonth, setLeftMonth] = useState(() =>
    startDate ? startOfMonth(new Date(startDate)) : startOfMonth(new Date())
  )
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [selecting, setSelecting] = useState<DateRange>({
    from: startDate ? new Date(startDate) : undefined,
    to: endDate ? new Date(endDate) : undefined,
  })

  const rightMonth = addMonths(leftMonth, 1)

  const handleDayClick = (date: Date) => {
    if (!selecting.from || (selecting.from && selecting.to)) {
      // Start new selection
      setSelecting({ from: date, to: undefined })
      setActivePreset('')
    } else {
      // Complete selection
      const from = isBefore(date, selecting.from) ? date : selecting.from
      const to = isBefore(date, selecting.from) ? selecting.from : date
      const newRange = { from, to }
      setSelecting(newRange)
      setActivePreset('')
      onChange(format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'))
      setTimeout(() => setOpen(false), 80)
    }
  }

  const handlePreset = (key: string) => {
    const { start, end } = getPresetDates(key)
    setSelecting({ from: start, to: end })
    setActivePreset(key)
    setLeftMonth(startOfMonth(start))
    onChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'))
    setOpen(false)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Sync internal state when opening
      setSelecting({
        from: startDate ? new Date(startDate) : undefined,
        to: endDate ? new Date(endDate) : undefined,
      })
    }
    setOpen(isOpen)
  }

  const displayText =
    startDate && endDate
      ? `${format(new Date(startDate), 'd MMM yyyy', { locale: th })} – ${format(new Date(endDate), 'd MMM yyyy', { locale: th })}`
      : 'เลือกช่วงเวลา'

  // Show selection in progress hint
  const isSelectingSecond = !!(selecting.from && !selecting.to)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('justify-start font-normal h-[42px]', className)}>
          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span>{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="flex">
          {/* Presets sidebar */}
          <div className="flex flex-col p-3 border-r min-w-[130px] shrink-0">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2 px-1">ช่วงเวลา</p>
            {DATE_RANGE_PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p.key)}
                className={cn(
                  'text-left text-sm px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors w-full',
                  activePreset === p.key ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendars */}
          <div>
            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 pt-3 pb-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setLeftMonth(subMonths(leftMonth, 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {isSelectingSecond && (
                <span className="text-xs text-gray-400">เลือกวันสิ้นสุด</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Two months side by side */}
            <div className="flex divide-x">
              <RangeMonthCalendar
                month={leftMonth}
                range={selecting}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
              <RangeMonthCalendar
                month={rightMonth}
                range={selecting}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
