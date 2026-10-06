// lib/services/seo/owner.ts
//
// เมนู SEO / AEO เป็นงานส่วนตัวของเจ้าของ ใช้รายชื่อเดียวกับ AOO Website (web_owners)

import { createServerSupabase, verifiedUser } from '@/lib/supabase/server'

export async function requireWebOwner() {
  const sb = await createServerSupabase()
  const user = await verifiedUser(sb)
  if (!user) return null
  const { data } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? user : null
}
