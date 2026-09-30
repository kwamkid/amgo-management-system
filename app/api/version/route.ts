// app/api/version/route.ts
//
// เวอร์ชันที่ server กำลังรันอยู่ — UpdateWatcher ในเบราว์เซอร์เทียบกับเวอร์ชันที่ตัวเอง
// ถูก build มา ถ้าไม่ตรง = มี deploy ใหม่ ให้โหลดหน้าใหม่ (30 ก.ย. 69)
//
// ทำไมต้องมี: แอปที่เปิดค้าง (โดยเฉพาะแอปที่ติดตั้งบนมือถือ) รันโค้ดชุดเก่าไปเรื่อย ๆ
// จนกว่าจะปิดแล้วเปิดใหม่ · เจ้าของ: "การบอกให้ทำอะไรค่อนข้างยาก ให้ขึ้นให้พนักงานเลย"
//
// ไม่ต้องล็อกอิน — ข้อมูลเดียวที่ส่งคือรหัส commit ซึ่งไม่ใช่ความลับ

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { build: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
