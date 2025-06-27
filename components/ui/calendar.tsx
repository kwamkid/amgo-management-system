"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday
} from "date-fns"
import { th } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface CalendarProps {
  mode?: "single" | "multiple" | "range"
  selected?: Date | Date[] | { from?: Date; to?: Date } | undefined
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean | boolean
  className?: string
  classNames?: any
  showOutsideDays?: boolean
  initialFocus?: boolean
  [key: string]: any
}

/**
 * Calendar component with button grid UI
 * Suitable for use in Popover
 */
function Calendar({
  mode = "single",
  selected,
  onSelect,
  disabled,
  className,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    selected instanceof Date ? selected : new Date()
  )

  // Get the selected date for single mode
  const selectedDate = mode === "single" && selected instanceof Date ? selected : undefined

  // Navigate months
  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  // Generate calendar days
  const getDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth))
    const end = endOfWeek(endOfMonth(currentMonth))
    const days: Date[] = []
    let day = start

    while (day <= end) {
      days.push(day)
      day = addDays(day, 1)
    }

    return days
  }

  const handleDayClick = (date: Date) => {
    if (typeof disabled === "function" && disabled(date)) return
    if (typeof disabled === "boolean" && disabled) return
    
    if (onSelect) {
      if (mode === "single") {
        // Call onSelect
        onSelect(selectedDate && isSameDay(date, selectedDate) ? undefined : date)
        
        // Close popover using Escape key
        setTimeout(() => {
          const escapeEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            bubbles: true,
            cancelable: true
          })
          document.dispatchEvent(escapeEvent)
        }, 50)
      }
    }
  }

  const isDisabled = (date: Date) => {
    if (typeof disabled === "function") return disabled(date)
    if (typeof disabled === "boolean") return disabled
    return false
  }

  const days = getDays()
  const weekDays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]

  return (
    <div className={cn("p-3", className)}>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          onClick={previousMonth}
          variant="outline"
          size="icon"
          className="h-7 w-7"
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="font-medium">
          {format(currentMonth, "MMMM yyyy", { locale: th })}
        </div>
        
        <Button
          onClick={nextMonth}
          variant="outline"
          size="icon"
          className="h-7 w-7"
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isDisabledDay = isDisabled(day)
          const isTodayDate = isToday(day)

          if (!isCurrentMonth && !showOutsideDays) {
            return <div key={idx} />
          }

          return (
            <Button
              key={idx}
              onClick={() => handleDayClick(day)}
              variant="ghost"
              size="sm"
              type="button"
              disabled={isDisabledDay}
              className={cn(
                "h-9 w-9 p-0 font-normal",
                !isCurrentMonth && "text-gray-400",
                isDisabledDay && "text-gray-300 cursor-not-allowed",
                isSelected && "bg-red-600 text-white hover:bg-red-700",
                isTodayDate && !isSelected && "bg-gray-100 font-semibold",
                !isSelected && !isDisabledDay && "hover:bg-gray-100"
              )}
            >
              {format(day, "d")}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }