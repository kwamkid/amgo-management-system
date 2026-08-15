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

/** อ่านแค่หัวหน้าเว็บพอให้เห็นอาการ — ไม่ดูดทั้งหน้า 50 เว็บทุกชั่วโมงให้เปลือง bandwidth */
const HEAD_BYTES = 64 * 1024

type Site = {
  id: string
  site_name: string
  down_since: string | null
  page_issue: string | null
}

/**
 * WordPress พังแบบ "เว็บไม่ล่ม" — ยังตอบ 200 แต่คนเข้าไปเจอจอขาว/ข้อความ error
 * ดูจาก status อย่างเดียวไม่มีทางเห็น ต้องอ่านเนื้อหาหน้าจริง
 *
 * แยกเป็น 2 ระดับ: hard = ใช้งานไม่ได้จริง นับเป็นล่ม · soft = ผิดปกติแต่ยังไม่ฟันธง
 * (โหมดปรับปรุงเป็น soft เพราะตอนเราสั่งอัปเดตปลั๊กอินเองก็ขึ้นแบบนี้ชั่วคราว)
 */
const CRASH_SIGNS: { re: RegExp; issue: string; hard: boolean }[] = [
  { re: /There has been a critical error on this website/i, issue: 'critical_error', hard: true },
  { re: /Error establishing a database connection/i, issue: 'db_error', hard: true },
  { re: /^\s*(Fatal error|Parse error)\s*:/im, issue: 'php_error', hard: true },
  { re: /Briefly unavailable for scheduled maintenance/i, issue: 'maintenance', hard: false },
]

/** อ่านต้นหน้าแล้วตัดสาย — ไม่รอจนโหลดครบ */
async function readHead(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let n = 0
  try {
    while (n < HEAD_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      n += value.length
    }
  } catch {
    /* สายหลุดกลางทาง — ใช้เท่าที่ได้มา */
  }
  reader.cancel().catch(() => {})
  return Buffer.concat(chunks).toString('utf8')
}

/** ยิงจริง 1 เว็บ — ขึ้นเมื่อตอบต่ำกว่า 400 **และ** หน้าไม่ได้พัง */
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
    const ms = Date.now() - started
    if (res.status >= 400) {
      res.body?.cancel().catch(() => {})
      return { status: res.status, ms, up: false, issue: null as string | null }
    }

    const body = await readHead(res)
    const sign = CRASH_SIGNS.find((c) => c.re.test(body))
    // หน้าว่างจริง ๆ (ไม่ถึง 200 ตัวอักษร) = จอขาว — เว็บปกติต่อให้เป็น SPA
    // ก็ยังส่ง shell มามากกว่านี้ ตั้งเกณฑ์ต่ำไว้กัน false positive
    const issue = sign?.issue ?? (body.trim().length < 200 ? 'blank_page' : null)

    return { status: res.status, ms, up: !sign?.hard, issue }
  } catch {
    return { status: 0, ms: Date.now() - started, up: false, issue: null as string | null }
  } finally {
    clearTimeout(timer)
  }
}

const ISSUE_TEXT: Record<string, string> = {
  critical_error: 'WordPress ขึ้น critical error',
  db_error: 'ต่อฐานข้อมูลไม่ได้',
  php_error: 'PHP fatal/parse error',
  maintenance: 'ค้างโหมดปรับปรุง',
  blank_page: 'หน้าว่างเปล่า (จอขาว)',
}

async function run(onlySiteId?: string) {
  const sb = createAdminClient()
  let q = sb
    .from('web_sites')
    .select('id, site_name, down_since, page_issue')
    .eq('is_active', true)
  if (onlySiteId) q = q.eq('id', onlySiteId)
  const { data, error } = await q
  if (error) throw error

  const sites = (data ?? []) as Site[]
  const now = new Date().toISOString()
  let down = 0
  let broken = 0

  for (let i = 0; i < sites.length; i += BATCH) {
    const chunk = sites.slice(i, i + BATCH)
    await Promise.all(
      chunk.map(async (site) => {
        const r = await probe(site.site_name)
        if (!r.up) down++
        if (r.issue) broken++

        await sb
          .from('web_sites')
          .update({
            http_status: r.status,
            response_ms: r.ms,
            last_checked_at: now,
            page_issue: r.issue,
            ...(r.up ? { last_up_at: now, down_since: null } : {}),
            ...(!r.up && !site.down_since ? { down_since: now } : {}),
          })
          .eq('id', site.id)

        // อาการหน้าเว็บผิดปกติที่ยังไม่ถึงขั้นล่ม (จอขาว / ค้างโหมดปรับปรุง)
        // แจ้งตอนเพิ่งเป็นเท่านั้น เหมือนกติกาเดียวกับเว็บล่ม
        if (r.up && r.issue && r.issue !== site.page_issue) {
          const what = ISSUE_TEXT[r.issue] ?? r.issue
          await sb.from('web_site_logs').insert({
            site_id: site.id,
            kind: 'downtime',
            message: `หน้าเว็บผิดปกติ — ${what}`,
          })
          await sendWebAlert({
            title: `🟠 หน้าเว็บผิดปกติ — ${site.site_name}`,
            description: `${what} (ตอบกลับ ${r.status} ปกติ แต่เนื้อหาหน้าไม่ใช่เว็บที่ควรเห็น)`,
            color: 'amber',
          })
        }

        // เปลี่ยนสถานะเท่านั้นถึงแจ้ง — ล่มค้างไม่ต้องเตือนซ้ำทุกชั่วโมง
        if (!r.up && !site.down_since) {
          const why = r.issue
            ? (ISSUE_TEXT[r.issue] ?? r.issue)
            : `ตอบกลับ ${r.status || 'ต่อไม่ติด/หมดเวลา'}`
          await sb.from('web_site_logs').insert({
            site_id: site.id,
            kind: 'downtime',
            message: `เว็บล่ม — ${why}`,
          })
          await sendWebAlert({
            title: `🔴 เว็บล่ม — ${site.site_name}`,
            description: why,
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

  return { checked: sites.length, down, broken }
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
