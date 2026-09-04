// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import PwaRegister from '@/components/push/PwaRegister'
import { LoadingProvider } from '@/lib/contexts/LoadingContext'
import './globals.css'

// ฟอนต์โหลดจาก /public/fonts เอง (ดูที่ globals.css) ไม่ผ่าน Google Fonts แล้ว
// ได้ครบกว่าเดิม: มีน้ำหนัก Light 300 และ IBM Plex Mono สำหรับตัวเลขในตาราง

export const metadata: Metadata = {
  title: {
    default: 'AMGO Management System',
    template: '%s | AMGO'
  },
  description: 'ระบบบริหารจัดการพนักงาน AMGO',
  icons: {
    icon: '/amgo-logo.svg',
    shortcut: '/amgo-logo.svg',
    // iOS ไม่รับ SVG เป็นไอคอนหน้าจอโฮม — ต้อง PNG (สร้างจาก scripts/generate-pwa-icons.mjs)
    apple: '/icons/apple-touch-icon.png',
  },
  // ติดตั้งเป็นแอปได้ (PWA) — manifest อยู่ที่ app/manifest.ts
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AMGO',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  // กินพื้นที่ถึงขอบจอบนเครื่องมีรอยบาก เมื่อเปิดเป็นแอป
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // โทเคนรองรับโหมดมืดครบแล้ว แต่ยังล็อกสว่างไว้ก่อน
    // เพราะหน้าเก่ายังใช้ bg-white / text-gray-900 ตรง ๆ อยู่หลายจุด
    <html lang="th" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegister />
        <LoadingProvider>
          {children}
        </LoadingProvider>
      </body>
    </html>
  )
}