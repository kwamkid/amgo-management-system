// lib/push/send.ts
//
// ยิง Web Push (server เท่านั้น — ห้าม import ฝั่งเบราว์เซอร์)
//
// ไม่ throw เด็ดขาด: แจ้งเตือนพลาดต้องไม่ทำให้งานหลัก (บันทึกใบลา ฯลฯ) ล้มตาม
// endpoint ที่ตายแล้ว (404/410 = ผู้ใช้ปิดแจ้งเตือน/ลบแอป) ถูกลบทิ้งอัตโนมัติ
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export interface PushPayload {
  title: string
  body: string
  /** หน้าที่เปิดเมื่อกดแจ้งเตือน (path ภายใน) */
  url?: string
  /** tag เดียวกันแทนที่กัน — กันเรื่องเดียวกันซ้อนหลายใบ */
  tag?: string
}

let vapidConfigured = false
function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:amgovenger@gmail.com', publicKey, privateKey)
  vapidConfigured = true
  return true
}

/** ผู้ใช้ที่ยังทำงานอยู่ในตำแหน่งเหล่านี้ */
export async function userIdsByRole(roles: readonly string[]): Promise<string[]> {
  const { data } = await createAdminClient()
    .from('users')
    .select('id')
    .in('role', [...roles])
    .eq('is_active', true)
    .is('deleted_at', null)
  return (data ?? []).map((r) => r.id)
}

/** ส่งไปทุกอุปกรณ์ของผู้ใช้ที่ระบุ — คืนจำนวนที่ส่งสำเร็จ */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  try {
    if (!ensureVapid()) return 0 // ยังไม่ตั้ง VAPID → เงียบ ๆ ข้าม
    const ids = [...new Set(userIds)].filter(Boolean)
    if (ids.length === 0) return 0

    const sb = createAdminClient()
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', ids)
    if (error || !subs?.length) return 0

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/dashboard',
      tag: payload.tag,
    })

    const stale: string[] = []
    let sent = 0
    // ทีละ 8 พอ — ผู้ใช้ทั้งระบบไม่ถึงร้อยเครื่อง
    for (let i = 0; i < subs.length; i += 8) {
      await Promise.all(
        subs.slice(i, i + 8).map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              body,
              { TTL: 300, urgency: 'high' }
            )
            sent++
          } catch (err) {
            const status = (err as { statusCode?: number })?.statusCode
            if (status === 404 || status === 410) stale.push(sub.id)
            else console.error(`[Push] ส่งไม่สำเร็จ (${status ?? 'network'}):`, (err as Error)?.message)
          }
        })
      )
    }
    if (stale.length) await sb.from('push_subscriptions').delete().in('id', stale)
    return sent
  } catch (err) {
    console.error('[Push] sendPushToUsers:', err)
    return 0
  }
}
