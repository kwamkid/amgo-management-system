'use client'

// วันที่เลือกเป็นวันหยุดชดเชยได้ ของวันที่มาทำงานวันหนึ่ง — ใช้ทั้งหน้าต่างตอนเช็คอินและหน้ายื่นใบ
// คืน props พร้อมใส่ DatePicker (min/max/isDisabled) + ข้อความเตือนเมื่อเลือกไม่ได้ทั้งงวด

import { useEffect, useState } from 'react'
import { getOffDayOptions, type OffDayOptions } from '@/lib/services/scheduleSwapService'

export function useSwapOffDays(userId: string | undefined, workedDate: Date | null) {
  const [opts, setOpts] = useState<OffDayOptions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = workedDate ? workedDate.toDateString() : ''

  useEffect(() => {
    setOpts(null)
    setError(null)
    if (!userId || !workedDate) return
    let alive = true
    getOffDayOptions(userId, workedDate)
      .then((o) => alive && setOpts(o))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [userId, key]) // eslint-disable-line react-hooks/exhaustive-deps

  // ไม่มีวันไหนเลือกได้เลยในงวด (มาทุกวันแล้ว / ที่เหลือเป็นวันหยุดหมด)
  let free = 0
  if (opts) {
    for (let d = new Date(`${opts.from}T00:00:00`); d <= new Date(`${opts.to}T00:00:00`); d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!opts.blocked.has(iso)) free++
    }
  }

  return {
    loading: !!workedDate && !opts && !error,
    error,
    cutoffPassed: opts?.cutoffPassed ?? false,
    noFreeDay: !!opts && !opts.cutoffPassed && free === 0,
    pickerProps: opts
      ? { min: opts.from, max: opts.to, isDisabled: (iso: string) => opts.blocked.get(iso) }
      : {},
  }
}
