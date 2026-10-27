// lib/auth/lineSignIn.ts
//
// ขั้นตอนกลางหลังรู้แล้วว่า LINE userId คือใคร — ใช้ทั้ง LINE Login callback
// (app/api/auth/line/callback) และ LIFF (app/api/auth/liff) ให้กติกาเดียวกัน:
// เช็คสถานะบัญชี → อัปเดตชื่อ/รูป → ออก token_hash → บอกว่าต้องไป /setup ไหม
import { createAdminClient } from '@/lib/supabase/admin'
import { createSessionToken, emailForLine, ensureAuthUser, type LineProfile } from '@/lib/supabase/line-auth'

export type LineSignInResult =
  /** ยังไม่มีในระบบ — ผู้เรียกตัดสินใจเอง (ไปสมัคร / คนแรกเป็น admin) */
  | { kind: 'not_found' }
  /** เข้าไม่ได้ — ค่าเป็น error code ของหน้า /login */
  | { kind: 'blocked'; error: 'account_deleted' | 'account_ended' | 'account_inactive' }
  /** next = '/setup' เมื่อยังทำสิ่งที่ต้องทำก่อนใช้งานไม่ครบ */
  | { kind: 'ok'; tokenHash: string; next: string | null }

export async function signInLineUser(profile: LineProfile): Promise<LineSignInResult> {
  const sb = createAdminClient()

  const { data: user } = await sb
    .from('users')
    .select(
      'id, role, is_active, employment_status, deleted_at, full_name, nickname, name_verified, discord_user_id, is_system'
    )
    .eq('line_user_id', profile.userId)
    .maybeSingle()

  if (!user) return { kind: 'not_found' }

  if (user.deleted_at) return { kind: 'blocked', error: 'account_deleted' }
  if (!user.is_active) {
    // แยกข้อความ "ลาออกแล้ว" กับ "รออนุมัติ" ให้ผู้ใช้รู้ว่าต้องทำอะไรต่อ
    const ended = ['resigned', 'terminated', 'retired'].includes(user.employment_status)
    return { kind: 'blocked', error: ended ? 'account_ended' : 'account_inactive' }
  }

  // อัปเดตรูป/ชื่อจาก LINE ทุกครั้งที่ล็อกอิน
  await sb
    .from('users')
    .update({
      line_display_name: profile.displayName,
      line_picture_url: profile.pictureUrl,
      last_login_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  await ensureAuthUser(profile, user.role)
  const tokenHash = await createSessionToken(user.id, emailForLine(profile.userId))

  // ยังทำสิ่งที่ต้องทำก่อนใช้งานไม่ครบ ก็พาไปหน้ารายการก่อน
  // (ชื่อจริง+ชื่อเล่น · Discord — ดู lib/todo/tasks.ts)
  //
  // เรื่อง Discord บังคับได้ต่อเมื่อตั้ง DISCORD_CLIENT_ID ไว้แล้วเท่านั้น
  // ไม่งั้นจะพาคนไปหน้าที่กดเชื่อมต่อไม่ได้ = ล็อกทุกคนออกจากระบบ
  const discordReady = !!process.env.DISCORD_CLIENT_ID
  const nameDone = user.name_verified && !!user.nickname?.trim()
  const discordDone = !!user.discord_user_id || !discordReady
  // บัญชีระบบไม่ใช่คน ไม่มีชื่อเล่นและไม่มี Discord ให้ผูก
  const next = user.is_system || (nameDone && discordDone) ? null : '/setup'

  return { kind: 'ok', tokenHash, next }
}
