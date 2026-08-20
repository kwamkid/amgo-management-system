// app/api/callback/targets/route.ts
//
// รายชื่อปลายทางให้ iOS Shortcut เอาไปทำเมนู — สาขา + "ออนไลน์"
//
// ให้ Shortcut ดึงตอนกดทุกครั้ง ไม่ฝังรายชื่อไว้ในตัว Shortcut เอง
// เพิ่ม/ลดสาขา เปลี่ยนคนรับผิดชอบ แก้ที่ฐานข้อมูลแล้วมีผลทันที ไม่ต้องแก้มือถือ

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCallback } from '@/lib/callback-auth'
import { listTargets } from '@/lib/callback-targets'

export const maxDuration = 15

export async function GET(request: NextRequest) {
  if (!isAuthorizedCallback(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const targets = await listTargets(createAdminClient())
    // คืน labels แยกออกมาให้ด้วย — Shortcut เอาไปเข้า "Choose from List" ได้ตรง ๆ
    // โดยไม่ต้องเขียนสูตรแกะ array of objects บนมือถือ
    return NextResponse.json({ targets, labels: targets.map((t) => t.label) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
