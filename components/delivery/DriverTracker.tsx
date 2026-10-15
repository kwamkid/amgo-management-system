'use client'

// เริ่ม/หยุดส่งตำแหน่งตามคนที่ล็อกอิน — ทำงานเฉพาะในแอป Android ประจำรถ (lib/native/driverTracker.ts)
// คนขับ = ส่งตลอดตั้งแต่เปิดแอปจนออกจากระบบ · แอดมินส่งได้ด้วย (ไว้ทดสอบเครื่อง) · ในเบราว์เซอร์ไม่ทำอะไร

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { isDriverApp, startDriverTracking, stopDriverTracking } from '@/lib/native/driverTracker'

const TRACKED_ROLES = ['driver', 'admin']

export default function DriverTracker() {
  const { realRole } = useAuth()
  const { showToast } = useToast()
  const on = isDriverApp() && !!realRole && TRACKED_ROLES.includes(realRole)

  useEffect(() => {
    if (!on) return
    startDriverTracking().then((err) => err && showToast(`เริ่มส่งตำแหน่งไม่ได้: ${err}`, 'error'))
    return () => void stopDriverTracking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on])

  return null
}
