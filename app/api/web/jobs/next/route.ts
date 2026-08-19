// app/api/web/jobs/next/route.ts
//
// ตัวกินคิว — cron เรียกทุก 1–2 นาที (Authorization: Bearer <CRON_SECRET>)
// หรือกดจากหน้าเว็บเพื่อเร่งคิวเองก็ได้ (POST, ต้องเป็นเจ้าของเมนู)
//
// กติกาที่ห้ามพัง: **โฮสต์เดียวกันรันได้ทีละงานเดียว** — ของจริงเคยยิงพร้อมกัน
// ทั้งโฮสต์แล้ว load พุ่ง 12+ จนเว็บลูกค้าช้า · ตัวหยิบงาน (web_claim_jobs)
// บังคับข้อนี้ที่ระดับ SQL แล้ว ตรงนี้แค่รันงานที่หยิบมาได้แบบขนานข้ามโฮสต์

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { sendWebAlert } from '@/lib/services/web/webAlerts'
import { targetForHost } from '@/lib/services/web/sshTarget'
import {
  canStartPlugin,
  CORE_VERSION_MS,
  FIRST_LIST_MS,
  LOOP_DEADLINE_MS,
  PLUGIN_MAX_MS,
  pluginTimeoutMs,
  tailTimeoutMs,
} from '@/lib/services/web/jobBudget'
import {
  backupSite,
  coreVersion,
  discoverSites,
  listPlugins,
  scanSite,
  SSH_TIMEOUT_PREFIX,
  updatePlugins,
  type SshTarget,
  type WpPlugin,
} from '@/lib/services/web/wpCli'

export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

type Job = {
  id: string
  batch_id: string | null
  type: 'scan' | 'plugin_update' | 'plugin_check' | 'backup' | 'discover'
  host_id: string | null
  site_id: string | null
  /** ผู้ใช้กดสั่งเว็บนี้เอง = ขอลองอัปเดตใหม่ทุกตัว ไม่สนประวัติที่เคยยอมแพ้ */
  force: boolean
}

/* ── งานแต่ละชนิด ───────────────────────────────────────────────────── */

/** สำรวจโฮสต์: มีเว็บอะไรบ้าง อยู่ path ไหน — จับคู่กับแถวเดิมด้วยชื่อโดเมน */
async function runDiscover(sb: Admin, job: Job) {
  const { data: host } = await sb.from('web_hosts').select('*').eq('id', job.host_id!).single()
  const found = await discoverSites(await targetForHost(sb, host!), host!.domains_path)

  const { data: existing } = await sb.from('web_sites').select('id, site_name')
  const byName = new Map((existing ?? []).map((s) => [s.site_name.toLowerCase(), s.id]))

  let linked = 0
  let created = 0
  for (const f of found) {
    const domain = f.domain.toLowerCase()
    const id = byName.get(domain)
    if (id) {
      await sb
        .from('web_sites')
        .update({ host_id: host!.id, public_html_path: f.path, wp_version: f.wpVersion })
        .eq('id', id)
      linked++
    } else {
      await sb.from('web_sites').insert({
        site_name: domain,
        host_id: host!.id,
        public_html_path: f.path,
        wp_version: f.wpVersion,
        hosting_provider: host!.provider,
        // เว็บสืบทอด "ของเราเอง/ของลูกค้า" จากโฮสต์ที่มันอยู่
        is_own_business: host!.is_own_business,
      })
      created++
    }
  }

  await sb.from('web_hosts').update({ last_discovered_at: new Date().toISOString() }).eq('id', host!.id)
  return {
    log: found.map((f) => `${f.domain} → ${f.path} (WP ${f.wpVersion || '?'})`).join('\n'),
    summary: { found: found.length, linked, created },
  }
}

/** ปลั๊กอินที่พลาดครบ 2 ครั้งแล้ว = เลิกพยายาม ต้องให้คนไปทำเอง */
const GIVE_UP_AFTER = 2

type Block = { slug: string; fails: number }

async function blocksFor(sb: Admin, siteId: string): Promise<Block[]> {
  const { data } = await sb.from('web_plugin_blocks').select('slug, fails').eq('site_id', siteId)
  return (data ?? []) as Block[]
}

/**
 * เก็บรายชื่อปลั๊กอินลงฐานข้อมูล + คืนจำนวนที่ค้างอัปเดต (ใช้ร่วมกันทั้งตรวจและอัปเดต)
 *
 * ตัวที่ยอมแพ้แล้วไม่นับเป็น "ค้าง" — ไม่งั้นเว็บนั้นจะเหลืองตลอดกาลทั้งที่
 * เจ้าของตั้งใจไม่ต่ออายุ license เอง แล้วสุดท้ายจะเลิกมองสีเหลืองไปเลย
 */
async function savePlugins(sb: Admin, siteId: string, list: WpPlugin[], version: string) {
  const now = new Date().toISOString()
  const blocks = await blocksFor(sb, siteId)
  const givenUp = new Set(blocks.filter((b) => b.fails >= GIVE_UP_AFTER).map((b) => b.slug))
  const pending = list.filter((p) => p.update === 'available' && !givenUp.has(p.name))
  const blockedNow = list.filter((p) => p.update === 'available' && givenUp.has(p.name))

  await sb.from('web_plugins').delete().eq('site_id', siteId)
  if (list.length) {
    await sb.from('web_plugins').insert(
      list.map((p) => ({
        site_id: siteId,
        slug: p.name,
        name: p.name,
        version: p.version ?? '',
        new_version: p.update === 'available' ? (p.update_version ?? 'มีอัปเดต') : null,
        status: p.status ?? 'active',
        checked_at: now,
      }))
    )
  }
  await sb
    .from('web_sites')
    .update({
      plugins_checked_at: now,
      wp_version: version,
      pending_plugin_count: pending.length,
      plugin_count: list.length,
      blocked_plugin_count: blockedNow.length,
    })
    .eq('id', siteId)

  return pending
}

/**
 * ตรวจอย่างเดียว ไม่แตะอะไรบนเว็บ — ปลอดภัยพอให้ cron รันทั้งฟลีตทุกคืน
 * ต่างจาก plugin_update ที่สั่ง `wp plugin update` ของจริง
 */
async function runPluginCheck(sb: Admin, job: Job, target: SshTarget, path: string) {
  const list = await listPlugins(target, path)
  const version = await coreVersion(target, path).catch(() => '')
  const pending = await savePlugins(sb, job.site_id!, list, version)

  return {
    log: pending.length
      ? pending.map((p) => `${p.name} ${p.version} → ${p.update_version ?? 'ใหม่กว่า'}`).join('\n')
      : 'ปลั๊กอินครบทุกตัว',
    summary: {
      total: list.length,
      pending: pending.length,
      pendingNames: pending.map((p) => p.name),
      wpVersion: version,
    },
  }
}

/**
 * อัปเดตทีละตัวจนกว่าจะหมดเวลา แล้วต่อคิวใบใหม่ให้ตัวที่เหลือ
 *
 * เดิมสั่ง `wp plugin update --all` รวดเดียว — เว็บที่ค้าง 11 ตัวใช้เวลาเกิน
 * timeout ของ SSH (45 วิ) เลยล้มทั้งใบและไม่ได้อัปเดตอะไรเลยสักตัว
 * ซึ่งดันเป็นเว็บที่ต้องการอัปเดตมากที่สุด (15 ส.ค. 69 aplussme.com)
 *
 * ทำทีละตัวแทน: ตัวไหนเสร็จก็เสร็จจริง ไม่ต้องเริ่มใหม่ทั้งชุด
 *
 * ── งบเวลา (แก้ 16 ส.ค. 69 หลังล้ม 40 ใบ สำเร็จ 36) ──────────────────
 * ของเดิมนับ 38 วิ *หลัง* listPlugins ใบแรก แล้วเช็คแค่ "ก่อนจะเริ่มตัวถัดไป"
 * ตัวที่เริ่มตอนวินาทีที่ 37 จึงมีสิทธิ์รันต่อได้อีก 45 วิ (timeout ของ SSH)
 * = 83 วิ ทั้งที่ Vercel ตัดฟังก์ชันที่ 60 · แถมไม่ได้กันเวลาไว้ให้ listPlugins
 * ใบสองกับ coreVersion ที่ต้องทำหลังลูปเลย · ใบที่ "สำเร็จ" ยังแตะ 59.6 วิ
 *
 * พอฟังก์ชันโดนตัด ใบงานค้างสถานะ running แล้วตัวกวาดงานผีปิดเป็น failed
 * อีก 5 นาทีถัดมา — ระหว่างนั้นคิวของโฮสต์นั้นถูกดองไปด้วย
 *
 * ตอนนี้: นับจากวินาทีแรกของงาน · กันเวลาท้ายไว้ให้ 2 คำสั่งปิดท้าย ·
 * และปลั๊กอินแต่ละตัวได้ timeout เท่ากับ "เวลาที่เหลือจริง" ไม่ใช่ 45 วิตายตัว
 */
async function runPluginUpdate(sb: Admin, job: Job, target: SshTarget, path: string) {
  const startedAt = Date.now()
  const loopDeadline = startedAt + LOOP_DEADLINE_MS

  // ใบแรกก็ต้องคุม ไม่งั้นมันกิน timeout ปกติ 45 วิได้คนเดียวจนไม่เหลืออะไรเลย
  const before = await listPlugins(target, path, FIRST_LIST_MS)

  // เจ้าของกดสั่งเว็บนี้เอง = ขอลองใหม่ทุกตัว ล้างประวัติที่เคยยอมแพ้ทิ้ง
  // (เผื่อเพิ่งต่ออายุ license มา)
  if (job.force) await sb.from('web_plugin_blocks').delete().eq('site_id', job.site_id!)

  const blocks = await blocksFor(sb, job.site_id!)
  const failsOf = new Map(blocks.map((b) => [b.slug, b.fails]))
  const skipped = before.filter(
    (p) => p.update === 'available' && (failsOf.get(p.name) ?? 0) >= GIVE_UP_AFTER
  )
  const pending = before.filter(
    (p) => p.update === 'available' && (failsOf.get(p.name) ?? 0) < GIVE_UP_AFTER
  )

  let log = skipped.length
    ? `⏭️ ข้าม ${skipped.length} ตัวที่เคยอัปเดตไม่สำเร็จ ${GIVE_UP_AFTER} ครั้ง: ${skipped
        .map((p) => p.name)
        .join(', ')}\n`
    : ''
  let ranOut = false
  const tried: string[] = []
  /** ข้อความที่ WP-CLI ตอบกลับต่อปลั๊กอิน — เก็บไว้ให้คนอ่านว่าทำไมอัปเดตไม่ได้ */
  const errors = new Map<string, string>()
  for (const p of pending) {
    const left = loopDeadline - Date.now()
    if (!canStartPlugin(left)) {
      ranOut = true
      log += `\n⏳ หมดเวลารอบนี้ เหลืออีก ${pending.length - pending.indexOf(p)} ตัว — ต่อคิวให้แล้ว`
      break
    }
    // บอกความคืบหน้าก่อนลงมือ — หน้าเว็บอ่านค่านี้ตอน poll ทุก 5 วิ
    // เขียนเพิ่ม 1 ครั้งต่อปลั๊กอิน 1 ตัว เทียบกับการ SSH จริงแล้วถือว่าฟรี
    await sb
      .from('web_jobs')
      .update({
        progress_done: tried.length,
        progress_total: pending.length,
        progress_note: p.name,
      })
      .eq('id', job.id)

    // ให้เท่าที่เหลือจริง แต่ไม่เกินเพดานต่อตัว — cap จึงไม่มีทางพาเลย deadline
    const cap = pluginTimeoutMs(left)
    tried.push(p.name)
    try {
      const res = await updatePlugins(target, path, p.name, cap)
      log += (res.out + res.err).slice(-1500)
      errors.set(p.name, (res.err || res.out).trim().slice(-300))
    } catch (e) {
      const msg = (e as Error).message
      if (msg.startsWith(SSH_TIMEOUT_PREFIX) && cap < PLUGIN_MAX_MS) {
        // ให้เวลาไม่เต็มเพราะรอบนี้เหลือน้อย ไม่ใช่ความผิดปลั๊กอิน — ถอดออกจาก
        // รายการที่ลอง ไม่งั้นจะโดนนับ "พลาด" แล้วครบ 2 ครั้งเมื่อไหร่ระบบจะเลิก
        // ลองตัวนั้นถาวร ทั้งที่จริงแค่คิวมาถึงตอนเวลาเหลือน้อย
        tried.pop()
        ranOut = true
        log += `\n⏳ ${p.name} เวลารอบนี้ไม่พอ — ยกไปรอบหน้า (เหลืออีก ${
          pending.length - pending.indexOf(p)
        } ตัว)`
        break
      }
      // ได้เวลาเต็มเพดานแล้วยังไม่จบ = ตัวนี้ช้าเกินกว่าจะอัปเดตด้วยวิธีนี้ได้จริง
      // ต้องปล่อยให้นับพลาดตามปกติ ไม่งั้นมันจะถูกลองใหม่ทุกคืนไปตลอดกาล
      // โดยไม่มีใครรู้ (ครบ 2 ครั้งแล้วระบบจะข้ามและขึ้นให้คนเห็นว่าต้องไปดูเอง)
      log += `\n❌ ${p.name}: ${msg}`
      errors.set(p.name, msg.slice(-300))
    }
  }
  log = log.slice(-6000)

  // 2 คำสั่งปิดท้ายต้องอยู่ในเวลาที่กันไว้ ห้ามยืดตาม timeout ปกติ 45 วิ
  // ไม่งั้นงานที่ลูปจบตรงเวลาเป๊ะก็ยังไปตายตอนสรุปผลอยู่ดี
  const after = await listPlugins(target, path, tailTimeoutMs(Date.now() - startedAt))
  const version = await coreVersion(target, path, CORE_VERSION_MS).catch(() => '')

  // ตัวที่ลองแล้วยังค้างอยู่ = พลาด · ตัวที่หายไปจากรายการค้าง = สำเร็จ
  const stillAvailable = new Set(
    after.filter((p) => p.update === 'available').map((p) => p.name)
  )
  const updated = tried.filter((n) => !stillAvailable.has(n))
  const failedNames = tried.filter((n) => stillAvailable.has(n))

  // สำเร็จแล้วล้างประวัติทิ้ง — เผื่อครั้งหน้าจะได้เริ่มนับใหม่
  if (updated.length) {
    await sb.from('web_plugin_blocks').delete().eq('site_id', job.site_id!).in('slug', updated)
  }

  // พลาด = นับเพิ่ม ครบ 2 ครั้งเมื่อไหร่รอบหน้าจะข้ามเอง
  for (const n of failedNames) {
    const prev = failsOf.get(n) ?? 0
    await sb.from('web_plugin_blocks').upsert(
      {
        site_id: job.site_id!,
        slug: n,
        name: n,
        fails: prev + 1,
        last_error: errors.get(n) ?? null,
        last_tried_at: new Date().toISOString(),
      },
      { onConflict: 'site_id,slug' }
    )
  }

  const stillPending = await savePlugins(sb, job.site_id!, after, version)

  if (updated.length) {
    await sb.from('web_site_logs').insert({
      site_id: job.site_id!,
      kind: 'plugin_update',
      message: `อัปเดตปลั๊กอิน ${updated.length} ตัว: ${updated.join(', ')}`.slice(0, 500),
    })
  }

  // ยังเหลือของค้างเพราะหมดเวลา — ต่อคิวใบใหม่ให้ cron รอบหน้าทำต่อ
  // ไม่นับเป็นล้มเหลว เพราะรอบนี้ก็อัปเดตไปได้จริงหลายตัว
  if (ranOut && stillPending.length) {
    await sb.from('web_jobs').insert({
      batch_id: job.batch_id,
      type: 'plugin_update',
      host_id: job.host_id,
      site_id: job.site_id,
      triggered_by: 'user',
    })

    // ต้องบวกยอดรวมของ batch ด้วย ไม่งั้น done+failed จะไม่มีวันถึง total_jobs
    // แล้ว batch ค้างไม่ปิด สรุปเข้า Discord ไม่ออกสักที
    if (job.batch_id) {
      const { data: b } = await sb
        .from('web_run_batches')
        .select('total_jobs')
        .eq('id', job.batch_id)
        .single()
      if (b) {
        await sb
          .from('web_run_batches')
          .update({ total_jobs: b.total_jobs + 1 })
          .eq('id', job.batch_id)
      }
    }
  }

  return {
    log: log || 'ไม่มีปลั๊กอินค้างอัปเดต',
    summary: {
      pluginsUpdated: updated,
      stillPending: stillPending.map((p) => p.name),
      total: after.length,
      continued: ranOut && stillPending.length > 0,
      // ตัวที่พลาดครบโควตาแล้ว — รอบหน้าจะไม่ยุ่งอีก ต้องคนไปจัดการเอง
      gaveUp: failedNames.filter((n) => (failsOf.get(n) ?? 0) + 1 >= GIVE_UP_AFTER),
    },
    // ล้มเหลวจริง = สั่งไปแล้วไม่ขยับเลยสักตัว (ถ้าหมดเวลาแต่ทำได้บ้างไม่นับ)
    failed: pending.length > 0 && updated.length === 0 && !ranOut,
  }
}

async function runScan(sb: Admin, job: Job, target: SshTarget, path: string, siteName: string) {
  const hits = await scanSite(target, path)

  const { data: fps } = await sb.from('web_false_positives').select('path_pattern, description')
  const isKnown = (file: string) =>
    (fps ?? []).some((f) => {
      const re = new RegExp(
        '^' + f.path_pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'
      )
      return re.test(file)
    })

  const suspects = hits.filter((h) => !isKnown(h.path))
  const status = suspects.length ? 'suspect' : 'ok'

  await sb
    .from('web_sites')
    .update({ last_scan_status: status, last_scan_at: new Date().toISOString() })
    .eq('id', job.site_id!)

  if (suspects.length) {
    await sendWebAlert({
      title: `🚨 พบไฟล์ต้องสงสัย — ${siteName}`,
      description: suspects
        .slice(0, 15)
        .map((s) => `• \`${s.path}\``)
        .join('\n')
        .slice(0, 3500),
      color: 'red',
      fields: [{ name: 'รวม', value: `${suspects.length} ไฟล์ (ตัดที่รู้ว่าไม่ใช่ออกแล้ว)` }],
    })
  }

  // log อ่านได้ด้วยตา — path + บรรทัดที่ตรง pattern + เวลาที่ไฟล์ถูกแก้ล่าสุด
  const log = suspects.length
    ? suspects
        .map((s) => {
          const when = s.modifiedAt
            ? new Date(s.modifiedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
            : 'ไม่ทราบ'
          const body = s.lines.map((l) => `    ${l.no}: ${l.text}`).join('\n')
          return `${s.path}\n  แก้ไขล่าสุด ${when} · ${s.bytes ?? '?'} bytes\n${body}`
        })
        .join('\n\n')
    : 'ไม่พบไฟล์ที่ตรง pattern'

  return {
    log,
    summary: {
      findings: suspects,
      knownIgnored: hits.length - suspects.length,
      status,
      // เก็บ path ล้วนไว้ด้วย เผื่อโค้ดเก่า/รายงานที่อ่านแบบเดิม
      paths: suspects.map((s) => s.path),
    },
  }
}

async function runBackup(sb: Admin, job: Job, target: SshTarget, path: string, keep: number) {
  const r = await backupSite(target, path, keep)

  // ⚠️ เขียน last_backup_at เฉพาะตอนมีไฟล์จริงเท่านั้น
  // ของเดิมเขียนทุกกรณีรวมถึงตอนยังทำไม่เสร็จ — หน้าเว็บจะขึ้นว่า "สำรองแล้ว
  // เมื่อสักครู่" ตั้งแต่วินาทีที่เพิ่งสั่ง ทั้งที่ยังไม่มีไฟล์สักไบต์ ซึ่งเป็น
  // คำโกหกที่อันตรายที่สุดในระบบสำรองข้อมูล (นึกว่ามีของ วันที่ต้องกู้จริงถึงรู้)
  if (r.file) {
    await sb
      .from('web_sites')
      .update({ last_backup_at: new Date().toISOString(), last_backup_file: r.file })
      .eq('id', job.site_id!)
  } else if (r.latest) {
    // ไฟล์ที่รอบก่อนทำเสร็จ "หลังจากเราเลิกรอ" — เก็บตกให้ตรงนี้
    // เว็บ 1–2 GB ใช้เวลาหลายนาที เกินหน้าต่างที่ฟังก์ชันรอไหว ถ้าไม่เก็บตก
    // ไฟล์ที่สำรองสำเร็จจริงจะไม่มีวันถูกบันทึก หน้าเว็บขึ้น "ไม่มีไฟล์สำรอง" ตลอดไป
    // ใช้ "เวลาแก้ไขไฟล์จริง" ไม่ใช่ now() — ไม่งั้นจะโม้ว่าเพิ่งสำรองเมื่อสักครู่
    const { data: cur } = await sb
      .from('web_sites')
      .select('last_backup_file')
      .eq('id', job.site_id!)
      .single()
    if (cur?.last_backup_file !== r.latest.file) {
      await sb
        .from('web_sites')
        .update({ last_backup_at: r.latest.at, last_backup_file: r.latest.file })
        .eq('id', job.site_id!)
    }
  }

  await sb.from('web_site_logs').insert({
    site_id: job.site_id!,
    kind: 'backup',
    message: r.file
      ? `backup เสร็จ: ${r.file} ${r.size}`
      : r.running
        ? 'ข้ามรอบนี้ — เว็บนี้มีงานสำรองทำค้างอยู่แล้วที่โฮสต์'
        : 'สั่ง backup แล้ว กำลังทำงานเบื้องหลังที่โฮสต์ (ยังไม่บันทึกว่าสำเร็จจนกว่าจะเห็นไฟล์)',
  })

  return {
    log: r.log,
    summary: { file: r.file, size: r.size, pending: r.pending, running: r.running, latest: r.latest },
  }
}

/* ── ตัวรัน 1 job ────────────────────────────────────────────────────── */

async function runJob(sb: Admin, job: Job) {
  if (job.type === 'discover') return runDiscover(sb, job)

  const { data: site } = await sb
    .from('web_sites')
    .select('id, site_name, public_html_path, host_id')
    .eq('id', job.site_id!)
    .single()
  if (!site?.public_html_path) throw new Error('เว็บนี้ยังไม่รู้ path บนโฮสต์')

  const { data: host } = await sb.from('web_hosts').select('*').eq('id', site.host_id!).single()
  if (!host) throw new Error('เว็บนี้ยังไม่ได้ผูกโฮสต์')

  const target = await targetForHost(sb, host)
  if (job.type === 'plugin_check') return runPluginCheck(sb, job, target, site.public_html_path)
  if (job.type === 'plugin_update') return runPluginUpdate(sb, job, target, site.public_html_path)
  if (job.type === 'scan') return runScan(sb, job, target, site.public_html_path, site.site_name)
  if (job.type === 'backup') return runBackup(sb, job, target, site.public_html_path, host.backup_keep)

  // ห้ามมี fallback เป็นงานใดงานหนึ่ง — ถ้าเพิ่มชนิดงานใหม่ในฐานข้อมูลก่อนโค้ดขึ้น
  // production เวอร์ชันเก่าจะหยิบไปทำเป็นงานนั้นแทน (เกือบเกิดจริงกับ plugin_check)
  throw new Error(`ยังไม่รองรับงานชนิด "${job.type}" — โค้ดฝั่งเซิร์ฟเวอร์อาจยังไม่ได้ deploy`)
}

/** ปิดงาน + เดินตัวนับของ batch (ครบแล้วปิด batch + สรุปเข้า Discord) */
async function finish(sb: Admin, job: Job, ok: boolean, log: string, summary: unknown) {
  await sb
    .from('web_jobs')
    .update({
      status: ok ? 'done' : 'failed',
      finished_at: new Date().toISOString(),
      raw_log: log.slice(0, 20000),
      summary: summary as never,
    })
    .eq('id', job.id)

  if (!job.batch_id) return

  const { data: batch } = await sb
    .from('web_run_batches')
    .select('id, type, total_jobs, done_jobs, failed_jobs')
    .eq('id', job.batch_id)
    .single()
  if (!batch) return

  const done = batch.done_jobs + (ok ? 1 : 0)
  const failed = batch.failed_jobs + (ok ? 0 : 1)
  const complete = done + failed >= batch.total_jobs

  await sb
    .from('web_run_batches')
    .update({
      done_jobs: done,
      failed_jobs: failed,
      ...(complete ? { finished_at: new Date().toISOString() } : {}),
    })
    .eq('id', batch.id)

  if (complete) {
    const label =
      ({
        plugin_update: 'อัปเดตปลั๊กอิน',
        plugin_check: 'ตรวจปลั๊กอิน',
        scan: 'สแกนมัลแวร์',
        backup: 'สำรองข้อมูล',
        discover: 'สำรวจรายชื่อเว็บ',
      })[batch.type as Job['type']] ?? batch.type
    // ต้องบอกว่า "ทำอะไรกับเว็บไหนบ้าง" — สรุปที่มีแต่ตัวเลขอ่านแล้วไม่รู้ว่า
    // ไปยุ่งกับเว็บของใคร และเว็บไหนพัง (เจ้าของทัก 15 ส.ค. 69 สองรอบ)
    const { data: rows } = await sb
      .from('web_jobs')
      .select('status, web_sites(site_name)')
      .eq('batch_id', batch.id)
    const nameOf = (r: { web_sites: { site_name?: string } | null }) =>
      r.web_sites?.site_name ?? '(ไม่ทราบชื่อ)'
    const okNames = (rows ?? []).filter((r) => r.status === 'done').map(nameOf).sort()
    const badNames = (rows ?? []).filter((r) => r.status === 'failed').map(nameOf).sort()

    /** ยาวเกินไป Discord ตัดทิ้ง — โชว์ 20 ชื่อแรกพอ ที่เหลือบอกจำนวน */
    const list = (names: string[]) =>
      names.length <= 20
        ? names.join(' · ')
        : `${names.slice(0, 20).join(' · ')} …และอีก ${names.length - 20} เว็บ`

    const single = batch.total_jobs === 1
    const scope = single ? `— ${okNames[0] ?? badNames[0] ?? ''}` : `ครบ ${batch.total_jobs} เว็บแล้ว`

    const fields = single
      ? []
      : [
          ...(okNames.length ? [{ name: `สำเร็จ ${okNames.length} เว็บ`, value: list(okNames).slice(0, 1000) }] : []),
          ...(badNames.length ? [{ name: `❌ ล้มเหลว ${badNames.length} เว็บ`, value: list(badNames).slice(0, 1000) }] : []),
        ]

    await sendWebAlert({
      title: `${failed ? '⚠️' : '✅'} ${label} ${scope}`,
      description: single
        ? ok
          ? 'เสร็จเรียบร้อย'
          : 'ทำไม่สำเร็จ — เปิดดูรายละเอียดงานในระบบ'
        : `สำเร็จ ${done} · ล้มเหลว ${failed} (ทั้งหมด ${batch.total_jobs})`,
      color: failed ? 'amber' : 'green',
      fields,
    })
  }
}

async function drain(limit: number) {
  const sb = createAdminClient()
  const { data: jobs, error } = await sb.rpc('web_claim_jobs', { p_limit: limit })
  if (error) throw error
  const claimed = (jobs ?? []) as Job[]
  if (!claimed.length) return { ran: 0 }

  await Promise.all(
    claimed.map(async (job) => {
      try {
        const r = await runJob(sb, job)
        const failed = 'failed' in r && r.failed
        await finish(sb, job, !failed, r.log ?? '', r.summary)
      } catch (e) {
        await finish(sb, job, false, (e as Error).message, { error: (e as Error).message })
        if (job.type === 'plugin_update' || job.type === 'scan') {
          await sendWebAlert({
            title: `⚠️ งาน ${job.type} ล้มเหลว`,
            description: (e as Error).message.slice(0, 500),
            color: 'amber',
          })
        }
      }
    })
  )

  return { ran: claimed.length }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json({ success: true, ...(await drain(2)) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // บริการตั้งเวลาบางเจ้าตั้งค่าเริ่มต้นเป็น POST — ถ้ามีรหัส cron มาก็ให้ผ่าน
  // เหมือน GET ไม่ต้องมี session (เคยตั้ง cron-job.org เป็น POST แล้วโดน 401)
  if (isAuthorizedCron(request)) return GET(request)

  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: owner } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    return NextResponse.json({ success: true, ...(await drain(2)) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
