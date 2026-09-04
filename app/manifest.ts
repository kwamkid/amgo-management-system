// app/manifest.ts
//
// PWA manifest — ทำให้เว็บติดตั้งเป็นแอปบนมือถือได้ (Add to Home Screen)
// Next เสิร์ฟให้ที่ /manifest.webmanifest และใส่ <link rel="manifest"> ให้เอง
//
// ⚠️ scope ต้องเป็น '/' — ถ้าจำกัดแคบกว่านั้น พอ session หมดอายุแล้วโดนพาไป /login
// ซึ่งอยู่นอก scope iOS จะเตะออกไปเปิดใน Safari แล้วล็อกอินคนละถังคุกกี้กับแอป
// (aoocommerce เจอมาแล้ว 4 ก.ย. 69) · ล็อกอินต้องเกิด**ในแอปเดียวกัน**
//
// ไอคอนสร้างจาก scripts/generate-pwa-icons.mjs — โลโก้เปลี่ยนเมื่อไหร่รันใหม่แล้ว commit
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'AMGO Management System',
    short_name: 'AMGO',
    description: 'ระบบบริหารจัดการพนักงาน AMGO',
    lang: 'th',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // shell ของแอปพื้นขาว — แถบสถานะขาวจะกลืนกับหัวหน้าจอ
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
