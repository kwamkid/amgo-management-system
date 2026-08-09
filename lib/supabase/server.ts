import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Supabase client ฝั่ง server ที่ผูกกับ session ของผู้ใช้ผ่าน cookie
 *
 * ต่างจาก createAdminClient() ตรงที่ตัวนี้ "เป็นผู้ใช้คนนั้นจริง ๆ" —
 * RLS ทำงานเต็มที่ ใช้ได้ใน Server Component / Route Handler / Server Action
 *
 * ใช้ตัวนี้เป็นค่าเริ่มต้นเสมอ ส่วน createAdminClient() (ข้าม RLS)
 * เก็บไว้ใช้เฉพาะงานที่ต้องข้ามสิทธิ์จริง ๆ เช่น สร้างผู้ใช้ตอน login
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // เรียกจาก Server Component จะเซ็ต cookie ไม่ได้ — ไม่เป็นไร
            // middleware รีเฟรช session ให้อยู่แล้ว
          }
        },
      },
    }
  )
}

/**
 * ดึงผู้ใช้ที่ล็อกอินอยู่พร้อมข้อมูลในตาราง users
 * คืน null ถ้ายังไม่ได้ล็อกอิน หรือถูกปิดการใช้งาน
 */
export async function getCurrentUser() {
  const sb = await createServerSupabase()

  // ต้องใช้ getUser() ไม่ใช่ getSession() — getUser คุยกับ Supabase เพื่อ
  // ตรวจลายเซ็น JWT จริง ส่วน getSession อ่านจาก cookie ดิบ ๆ ซึ่งปลอมได้
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const { data: profile } = await sb
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.is_active || profile.deleted_at) return null

  return { authUser: user, profile }
}
