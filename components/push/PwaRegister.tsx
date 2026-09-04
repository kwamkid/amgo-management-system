'use client'

// ลงทะเบียน service worker ตอนเปิดแอป (แค่ register — ยังไม่ขอสิทธิ์แจ้งเตือน
// สิทธิ์ขอตอนผู้ใช้กดเปิดเองในหน้าโปรไฟล์) + ล้างเลขบนไอคอนทุกครั้งที่กลับมาเห็นหน้าจอ
import { useEffect } from 'react'
import { registerServiceWorker, clearAppBadge } from '@/lib/push/client'
import { captureInstallPrompt } from '@/lib/push/installPrompt'

export default function PwaRegister() {
  useEffect(() => {
    captureInstallPrompt() // ต้องจับก่อน component อื่น mount — event ยิงครั้งเดียว
    registerServiceWorker()

    // เลขบนไอคอนหมายถึง "มีเรื่องที่ยังไม่ได้ดู" — พอเปิดแอปมาเห็นแล้วต้องหายทันที
    // ไม่งั้นเลขค้างจนคนเลิกเชื่อ แล้ววันที่มีเรื่องจริงก็จะโดนมองข้าม
    const clear = () => {
      if (document.visibilityState === 'visible') clearAppBadge()
    }
    clear()
    document.addEventListener('visibilitychange', clear)
    return () => document.removeEventListener('visibilitychange', clear)
  }, [])
  return null
}
