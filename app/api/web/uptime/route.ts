// app/api/web/uptime/route.ts
//
// เช็คว่าเว็บที่ดูแลอยู่ยังขึ้นอยู่ไหม
//
//   GET  — cron (ทุกชั่วโมง) ส่ง Authorization: Bearer <CRON_SECRET>
//   POST — เจ้าของเมนูกดเช็คเองจากหน้ารายการ (ต้องอยู่ใน web_owners)
//
// แจ้ง Discord เฉพาะ "ตอนเปลี่ยนสถานะ" — ล่มใหม่ กับ กลับมาแล้ว
// ไม่งั้นเว็บที่ล่มยาวจะสแปมทุกชั่วโมง

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { sendWebAlert } from '@/lib/services/web/webAlerts'

export const maxDuration = 60

const TIMEOUT_MS = 12_000
const BATCH = 8

type Site = {
  id: string
  site_name: string
  down_since: string | null
}

/** ยิงจริง 1 เว็บ — ถือว่าขึ้นเมื่อตอบกลับมาต่ำกว่า 400 */
async function probe(domain: string) {
  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`https://${domain}`, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      // ต้องเป็น UA เบราว์เซอร์จริง — SiteGround ตอบ 403 ให้ UA แปลกหน้าทุกตัว
      // (15 ส.ค. 69 เจอ 8 เว็บของเราขึ้น "ล่ม" ทั้งที่เปิดได้ปกติ) และ WordPress
      // หลายเจ้าก็บล็อก HEAD ด้วย เลยใช้ GET
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
    })
    return { status: res.status, ms: Date.now() - started, up: res.status < 400 }
  } catch {
    return { status: 0, ms: Date.now() - started, up: false }
  } finally {
    clearTimeout(timer)
  }
}

async function run(onlySiteId?: string) {
  const sb = createAdminClient()
  let q = sb.from('web_sites').select('id, site_name, down_since').eq('is_active', true)
  if (onlySiteId) q = q.eq('id', onlySiteId)
  const { data, error } = await q
  if (error) throw error

  const sites = (data ?? []) as Site[]
  const now = new Date().toISOString()
  let down = 0

  for (let i = 0; i < sites.length; i += BATCH) {
    const chunk = sites.slice(i, i + BATCH)
    await Promise.all(
      chunk.map(async (site) => {
        const r = await probe(site.site_name)
        if (!r.up) down++

        await sb
          .from('web_sites')
          .update({
            http_status: r.status,
            response_ms: r.ms,
            last_checked_at: now,
            ...(r.up ? { last_up_at: now, down_since: null } : {}),
            ...(!r.up && !site.down_since ? { down_since: now } : {}),
          })
          .eq('id', site.id)

        // เปลี่ยนสถานะเท่านั้นถึงแจ้ง — ล่มค้างไม่ต้องเตือนซ้ำทุกชั่วโมง
        if (!r.up && !site.down_since) {
          await sb.from('web_site_logs').insert({
            site_id: site.id,
            kind: 'downtime',
            message: `เว็บล่ม — ตอบกลับ ${r.status || 'ต่อไม่ติด'}`,
          })
          await sendWebAlert({
            title: `🔴 เว็บล่ม — ${site.site_name}`,
            description: `ตอบกลับ: ${r.status || 'ต่อไม่ติด/หมดเวลา'}`,
            color: 'red',
          })
        } else if (r.up && site.down_since) {
          const mins = Math.round((Date.now() - new Date(site.down_since).getTime()) / 60000)
          await sb.from('web_site_logs').insert({
            site_id: site.id,
            kind: 'downtime',
            message: `เว็บกลับมาแล้ว (ล่มไป ~${mins} นาที)`,
          })
          await sendWebAlert({
            title: `🟢 เว็บกลับมาแล้ว — ${site.site_name}`,
            description: `ล่มไปประมาณ ${mins} นาที`,
            color: 'green',
          })
        }
      })
    )
  }

  return { checked: sites.length, down }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json({ success: true, ...(await run()) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // cron ที่ตั้งเป็น POST ก็ให้ผ่าน (เช็คทุกเว็บเหมือน GET)
  if (isAuthorizedCron(request)) return GET(request)

  // กดจากหน้าเว็บ — ต้องล็อกอินและอยู่ใน web_owners
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: owner } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let siteId: string | undefined
  try {
    const body = await request.json()
    siteId = body?.siteId
  } catch {
    /* ไม่ส่ง body = เช็คทุกเว็บ */
  }

  try {
    return NextResponse.json({ success: true, ...(await run(siteId)) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
