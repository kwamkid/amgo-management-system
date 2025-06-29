// components/checkin/ShiftSelector.tsx

'use client'

import { useState } from 'react'
import { Shift } from '@/types/location'
import { Clock, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ShiftSelectorProps {
  shifts: Shift[]
  onSelect: (shift: Shift) => void
  onCancel: () => void
  currentTime: Date
}

export default function ShiftSelector({
  shifts,
  onSelect,
  onCancel,
  currentTime
}: ShiftSelectorProps) {
  const [selectedShiftIndex, setSelectedShiftIndex] = useState<number | null>(null)

  const calculateShiftStatus = (shift: Shift) => {
    const now = currentTime
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    const [startHour, startMin] = shift.startTime.split(':').map(Number)
    const [endHour, endMin] = shift.endTime.split(':').map(Number)
    
    let shiftStartMinutes = startHour * 60 + startMin
    let shiftEndMinutes = endHour * 60 + endMin
    
    // Handle overnight shift
    if (shiftEndMinutes < shiftStartMinutes) {
      shiftEndMinutes += 24 * 60
      if (currentMinutes < shiftStartMinutes) {
        const adjustedCurrentMinutes = currentMinutes + 24 * 60
        return {
          isLate: adjustedCurrentMinutes > (shiftStartMinutes + shift.graceMinutes),
          lateMinutes: Math.max(0, adjustedCurrentMinutes - shiftStartMinutes - shift.graceMinutes),
        }
      }
    }
    
    // Calculate if late
    const isLate = currentMinutes > (shiftStartMinutes + shift.graceMinutes)
    const lateMinutes = isLate ? currentMinutes - shiftStartMinutes - shift.graceMinutes : 0
    
    return {
      isLate,
      lateMinutes: Math.round(lateMinutes),
    }
  }

  const handleSelect = (index: number) => {
    setSelectedShiftIndex(index)
  }

  const handleConfirm = () => {
    if (selectedShiftIndex !== null) {
      onSelect(shifts[selectedShiftIndex])
    }
  }

  const formatTime = (time: string) => {
    const [hour, min] = time.split(':')
    return `${hour}:${min}`
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onCancel}
      />
      
      {/* Popover */}
      <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:inset-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-sm sm:w-full">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-center">
              เลือกกะการทำงาน
            </h3>
            
            <div className="space-y-2">
              {shifts.map((shift, index) => {
                const status = calculateShiftStatus(shift)
                const isSelected = selectedShiftIndex === index
                
                return (
                  <button
                    key={`shift-${index}`}
                    onClick={() => handleSelect(index)}
                    className={`w-full p-3 rounded-lg border-2 transition-all flex items-center justify-between ${
                      isSelected 
                        ? 'border-red-500 bg-red-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">
                          {shift.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {status.isLate && (
                        <Badge variant="warning" className="text-xs">
                          สาย {status.lateMinutes} นาที
                        </Badge>
                      )}
                      {isSelected && (
                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                onClick={onCancel}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedShiftIndex === null}
                size="sm"
                className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
              >
                ยืนยัน
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}