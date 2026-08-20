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
import { targetForHost } from '@/lib/services/web/sshTarget'
import { sshRun } from '@/lib/services/web/wpCli'

export const maxDuration = 60

const TIMEOUT_MS = 15_000

/**
 * ยิงซ้ำก่อนฟันธงว่าล่ม — ของเดิมพลาดครั้งเดียวก็แจ้งเตือนทันที
 *
 * ผลคือ 125 การแจ้งเตือนใน 7 วัน โดย**ไม่มีเว็บไหนล่มจริงสักตัว** (ตรวจ 20 ส.ค. 69
 * ทุกเว็บที่เตือนบ่อยสุดตอบ 200 ใน 0.7–2 วิ เนื้อหาครบ 66 KB–670 KB) · อาการเด่นคือ
 * ล่มตอน :00 แล้วกลับมาตอน :00 ของชั่วโมงถัดไปสลับกันไปมา ซึ่งไม่ใช่หน้าตาของ
 * เว็บที่ล่มจริง แต่เป็นหน้าตาของตัวเช็คที่ยิงพลาดเป็นครั้งคราว
 */
const ATTEMPTS = 3
const RETRY_WAIT_MS = [0, 2_000, 5_000]

/**
 * ยิงพร้อมกันได้กี่เว็บต่อโฮสต์
 *
 * ของเดิมยิงทีละ 8 เว็บโดยไม่สนว่าอยู่โฮสต์ไหน — โฮสต์เดียวมี 24 เว็บ จึงโดน
 * 8 request พร้อมกันจาก IP เดียว ซึ่งหน้าตาเหมือนการยิงถล่ม โฮสต์เลยตอบ 403
 * หรือตัดสายทิ้ง · หลักฐาน: 4 เว็บบนโฮสต์เดียวกัน "ล่ม" พร้อมกันเป๊ะตอนตี 3
 * แล้ว "กลับมา" พร้อมกันเป๊ะตอนตี 4
 */
const PER_HOST = 2

/** ทั้งรอบต้องจบก่อน Vercel ตัดที่ 60 วิ — เว็บที่ยิงไม่ทันปล่อยไว้เฉย ๆ ดีกว่าเดา */
const RUN_BUDGET_MS = 45_000

/** ยืนยันผ่าน SSH ใช้เวลาได้ถึงเท่านี้ */
const HOST_CONFIRM_MS = 25_000

/**
 * หลังจากนี้ไม่ต้องเริ่มยืนยันผ่าน SSH แล้ว — เริ่มตอนวินาทีที่ 30 แล้วใช้อีก 25
 * = 55 วิ ยังห่างเพดาน 60 อยู่นิดเดียว เกินกว่านี้เสี่ยงโดนตัดกลางคัน
 */
const CONFIRM_UNTIL_MS = 30_000

/** อ่านแค่หัวหน้าเว็บพอให้เห็นอาการ — ไม่ดูดทั้งหน้า 50 เว็บทุกชั่วโมงให้เปลือง bandwidth */
const HEAD_BYTES = 64 * 1024

type Site = {
  id: string
  site_name: string
  down_since: string | null
  page_issue: string | null
  host_id: string | null
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

/**
 * อ่านต้นหน้าแล้วตัดสาย — พร้อมบอกว่า "อ่านได้ครบพอจะตัดสินไหม"
 *
 * ต้องรู้ให้ได้ เพราะการสรุปว่า "หน้าว่าง = จอขาว" จากข้อมูลที่อ่านค้างกลางทาง
 * คือการเดา · ของจริง 20 ส.ค. 69 มี 4 เว็บขึ้น "จอขาว" ตอนตี 1–2 ทั้งที่หน้าจริง
 * หนัก 135–670 KB — ตรงกับช่วงที่งานสแกน/สำรองกำลังรีดโฮสต์อยู่พอดี
 */
async function readHead(res: Response): Promise<{ text: string; complete: boolean }> {
  if (!res.body) return { text: '', complete: false }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let n = 0
  let complete = false
  try {
    while (n < HEAD_BYTES) {
      const { done, value } = await reader.read()
      if (done) {
        complete = true
        break
      }
      chunks.push(value)
      n += value.length
    }
    // อ่านครบโควตาที่ตั้งใจไว้ก็ถือว่าพอตัดสินได้ ไม่ต้องรอจนจบหน้า
    if (n >= HEAD_BYTES) complete = true
  } catch {
    /* สายหลุดกลางทาง — ข้อมูลไม่ครบ ห้ามเอาไปสรุปว่าหน้าว่าง */
  }
  reader.cancel().catch(() => {})
  return { text: Buffer.concat(chunks).toString('utf8'), complete }
}

/** ยิงจริง 1 ครั้ง — ขึ้นเมื่อตอบต่ำกว่า 400 **และ** หน้าไม่ได้พัง */
async function probeOnce(domain: string) {
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

    const { text, complete } = await readHead(res)
    const sign = CRASH_SIGNS.find((c) => c.re.test(text))

    /**
     * ตัดสินเนื้อหาหน้าได้เฉพาะตอนตอบ 200 เท่านั้น
     *
     * SiteGround ตอบ **202** พร้อมตัวเปล่าให้ IP ของศูนย์ข้อมูล (หน้ากันบอท) —
     * เว็บไม่ได้เป็นอะไรเลย ยิงจากเครื่องคนได้ 200 พร้อมเนื้อหาครบ 66–670 KB
     * แต่ 202 < 400 จึงผ่านด่านแรกมาแล้วไปโดนตัดสินว่า "จอขาว" (7 เว็บบน
     * SiteGround โดนแบบนี้ทุกชั่วโมง · ตรวจเจอ 20 ส.ค. 69)
     *
     * เว็บยังนับว่าขึ้นตามปกติ — แค่เราไม่ได้เห็นหน้าจริง จึงไม่มีสิทธิ์ตัดสินมัน
     */
    const judgeable = res.status === 200
    const issue =
      sign?.issue ?? (judgeable && complete && text.trim().length < 200 ? 'blank_page' : null)

    return { status: res.status, ms, up: !sign?.hard, issue }
  } catch {
    return { status: 0, ms: Date.now() - started, up: false, issue: null as string | null }
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * ยิงจนกว่าจะได้ผลที่ดี หรือหมดโควตา — ผลที่ "ไม่ดี" ต้องยืนยันซ้ำก่อนเสมอ
 *
 * เว็บล่มจริงจะล่มทุกครั้งที่ยิง · เว็บที่แค่โฮสต์สะดุดตอนนั้นจะกลับมาในรอบสอง
 * ความต่างนี้แหละที่แยก "แจ้งเตือนที่ควรรีบดู" ออกจาก "เสียงรบกวนรายชั่วโมง"
 */
async function probe(domain: string, deadline: number) {
  let last = await probeOnce(domain)
  let attempts = 1
  while (attempts < ATTEMPTS && (!last.up || last.issue)) {
    const wait = RETRY_WAIT_MS[attempts]
    if (Date.now() + wait + TIMEOUT_MS > deadline) break
    await sleep(wait)
    last = await probeOnce(domain)
    attempts++
  }
  return { ...last, attempts }
}

/** โดเมนที่ยอมให้ยัดลงคำสั่ง shell ได้ — ค่ามาจาก DB ไม่ควรเชื่อ 100% */
const SAFE_DOMAIN = /^[a-z0-9.-]+$/i

/**
 * ยิงจากตัวโฮสต์เองผ่าน SSH — ใช้ตอนยิงจากข้างนอกไม่ผ่าน
 *
 * SiteGround กันบอทตาม IP ของศูนย์ข้อมูล เว็บบนนั้นจึงตอบ Vercel เป็น 202
 * ตัวเปล่าบ้าง ตัดสายเงียบ ๆ บ้าง ทั้งที่เว็บปกติดี — ของจริง 20 ส.ค. 69
 * joolzjuice.com ตอบ 200 พร้อม 583 KB ทั้ง 8 ครั้งจากเครื่องคนและจากตัวโฮสต์เอง
 * ขณะที่ Vercel หมดเวลา 3 ครั้งรวด · ปัญหาอยู่ที่จุดยืนที่เรามอง ไม่ใช่ที่เว็บ
 *
 * ⚠️ ยืนยันจากโฮสต์ไม่ใช่การเช็คจากภายนอกจริง — จับกรณี DNS เพี้ยนหรือไฟร์วอลล์
 * ปิดโลกไม่ได้ · แต่ใช้เป็น "ตัวตัดสินเมื่อเราถูกบล็อก" ดีกว่าประกาศว่าล่มทั้งที่ไม่ล่ม
 */
async function upFromHost(sb: ReturnType<typeof createAdminClient>, site: Site) {
  if (!site.host_id || !SAFE_DOMAIN.test(site.site_name)) return null
  try {
    const { data: host } = await sb.from('web_hosts').select('*').eq('id', site.host_id).single()
    if (!host) return null
    const target = await targetForHost(sb, host)
    const { out } = await sshRun(
      target,
      `curl -sL -o /dev/null --max-time 15 -w '%{http_code}' https://${site.site_name}`,
      HOST_CONFIRM_MS
    )
    const code = Number(out.trim().slice(-3))
    return Number.isFinite(code) && code >= 200 && code < 400 ? code : null
  } catch {
    return null
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
    .select('id, site_name, down_since, page_issue, host_id')
    .eq('is_active', true)
  if (onlySiteId) q = q.eq('id', onlySiteId)
  const { data, error } = await q
  if (error) throw error

  const sites = (data ?? []) as Site[]
  const now = new Date().toISOString()
  let down = 0
  let broken = 0
  /** ยิงจากข้างนอกไม่ผ่านแต่ตัวโฮสต์ยืนยันว่าขึ้น = เราถูกบล็อก ไม่ใช่เว็บล่ม */
  let blocked = 0

  const runStart = Date.now()
  const deadline = runStart + RUN_BUDGET_MS
  let skipped = 0

  // แบ่งตามโฮสต์ แล้วเดินทีละโฮสต์ขนานกัน — โฮสต์หนึ่งโดนพร้อมกันไม่เกิน PER_HOST
  const byHost = new Map<string, Site[]>()
  for (const s of sites) {
    const k = s.host_id ?? '—'
    const l = byHost.get(k)
    if (l) l.push(s)
    else byHost.set(k, [s])
  }

  await Promise.all(
    [...byHost.values()].map(async (list) => {
      let next = 0
      const worker = async () => {
        while (next < list.length) {
          const site = list[next++]
          // ต้องเหลือเวลาพอให้ยิงจบ 1 ครั้งเต็ม ๆ ไม่ใช่แค่ "ยังไม่ถึง deadline"
          // เริ่มตอนเหลือ 1 วิ แล้วปล่อยให้รันต่ออีก 15 = ทะลุเพดาน Vercel พอดี
          // (บั๊กแบบเดียวกับงบเวลาของ plugin_update เมื่อ 16 ส.ค.)
          if (Date.now() + TIMEOUT_MS > deadline) {
            skipped++
            continue
          }
          await one(site)
        }
      }
      await Promise.all(Array.from({ length: PER_HOST }, worker))
    })
  )

  return { checked: sites.length - skipped, skipped, down, broken, blocked }

  async function one(site: Site) {
    let r = await probe(site.site_name, deadline)

    // ยิงจากข้างนอกไม่ผ่าน — ถามตัวโฮสต์ก่อนว่าเว็บขึ้นไหม ก่อนจะประกาศว่าล่ม
    if (!r.up && Date.now() - runStart < CONFIRM_UNTIL_MS) {
      const code = await upFromHost(sb, site)
      if (code) {
        r = { ...r, up: true, status: code, issue: null }
        blocked++
      }
    }

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
  }
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
