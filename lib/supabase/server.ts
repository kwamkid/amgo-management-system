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
 * ใครล็อกอินอยู่ — ตรวจลายเซ็น JWT จริงด้วย getClaims() (30 ก.ย. 69)
 *
 * ห้ามใช้ getSession() — อ่าน cookie ดิบ ๆ ซึ่งปลอมได้ · เดิมใช้ getUser() ซึ่ง
 * ปลอดภัยแต่ต้องวิ่งไปถาม Auth server ทุกครั้ง: middleware + ทุก API + รูปโปรไฟล์
 * ทีละรูป สะสมเป็น ~188,000 ครั้ง (pg_stat_statements) · โปรเจกต์นี้เซ็น JWT
 * ด้วยกุญแจ ES256 (asymmetric) getClaims จึงตรวจลายเซ็นในเครื่องด้วย JWKS
 * ที่แคชไว้ ความปลอดภัยเท่าเดิม ไม่เสียรอบเน็ต
 */
export async function verifiedUser(
  sb: Awaited<ReturnType<typeof createServerSupabase>>
): Promise<{ id: string; role: string | null } | null> {
  const { data, error } = await sb.auth.getClaims()
  const sub = data?.claims?.sub
  if (error || !sub) return null
  // role เดียวกับที่ RLS ใช้ (auth_role() อ่าน app_metadata.role จาก JWT)
  const meta = data.claims.app_metadata as { role?: string } | undefined
  return { id: sub, role: meta?.role ?? null }
}

/**
 * ดึงผู้ใช้ที่ล็อกอินอยู่พร้อมข้อมูลในตาราง users
 * คืน null ถ้ายังไม่ได้ล็อกอิน หรือถูกปิดการใช้งาน
 */
export async function getCurrentUser() {
  const sb = await createServerSupabase()

  const user = await verifiedUser(sb)
  if (!user) return null

  const { data: profile } = await sb
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.is_active || profile.deleted_at) return null

  return { authUser: user, profile }
}
