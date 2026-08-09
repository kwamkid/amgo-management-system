'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Supabase client ฝั่งเบราว์เซอร์
 *
 * ใช้ publishable key + RLS เท่านั้น — เห็นเฉพาะข้อมูลที่ policy อนุญาต
 * session เก็บใน cookie (ไม่ใช่ localStorage) เพื่อให้ฝั่ง server อ่านได้ด้วย
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
  return browserClient
}
