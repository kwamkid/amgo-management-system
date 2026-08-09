import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Supabase client ฝั่ง server ที่ข้าม RLS ได้
 *
 * ⚠️ ใช้ได้เฉพาะใน Server Component / Route Handler / script เท่านั้น
 *    ห้าม import เข้าไฟล์ที่มี 'use client' เด็ดขาด — secret key จะหลุดไปหน้าเว็บ
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error(
      'ยังไม่ได้ตั้ง NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SECRET_KEY ใน .env.local'
    )
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
