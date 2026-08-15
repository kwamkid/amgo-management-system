// app/api/web/nightly/route.ts
//
// งานประจำคืน — สั่งงานตรวจทั้งฟลีตเข้าคิว (cron วันละครั้ง ตอนดึก)
//   ส่ง Authorization: Bearer <CRON_SECRET>
//
// สั่ง 2 อย่าง เรียงตามลำดับที่อยากให้คิวเดิน:
//   1. scan         — ไล่หาไฟล์ที่เข้าข่ายมัลแวร์
//   2. plugin_check — นับปลั๊กอินที่ค้างอัปเดต
//
// ทำไมต้องอัตโนมัติ: ถ้ารอให้คนกดเอง ตัวเลขในตารางจะเก่าเสมอจนกว่าจะมีคนนึกได้
// แล้วหน้าจอที่ข้อมูลเก่าคือหน้าจอที่เชื่อไม่ได้
//
// ทำไม scan ต้องมาก่อน: คิวหยิบงานแบบ FIFO และโฮสต์หนึ่งทำได้ทีละงาน คืนไหน
// คิวเดินไม่จบ สิ่งที่ได้ทำไปแล้วควรเป็นเรื่องมัลแวร์ ไม่ใช่การนับเลขเวอร์ชัน
// ปลั๊กอิน · ของเดิมสั่งแต่ plugin_check ผลคือสถานะสแกนไม่มีวันอัปเดตเอง
// ต้องรอคนนึกได้แล้วกดปุ่ม (เจ้าของเจอเอง 16 ส.ค. 69 ตอนไล่ false positive
// ทีละเว็บ แล้วถามว่าจะให้กดเองทุกครั้งเลยเหรอ)
//
// ปลอดภัยพอจะรันทุกคืน: ทั้งสองงานอ่านอย่างเดียว ไม่แตะไฟล์ ไม่แตะฐานข้อมูลของเว็บ
//   plugin_check = `wp plugin list` (~3 วิ/เว็บ)
//   scan         = `grep -rn` ใต้ public_html (~10–30 วิ/เว็บ)
// และคิวยังบังคับทีละงานต่อโฮสต์อยู่ดี ต่อให้ฟลีตใหญ่ grep ก็เดินทีละเว็บต่อโฮสต์
//
// ตั้งตอนดึกเพราะเป็นช่วงที่เว็บลูกค้าคนน้อยที่สุด — ต่อให้ช้าไปบ้างก็ไม่มีใครเจอ

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'

export const maxDuration = 30

type Admin = ReturnType<typeof createAdminClient>
type Site = { id: string; host_id: string | null }

/** งานที่สั่งทุกคืน — ลำดับในนี้คือลำดับที่คิวจะเดิน (มาก่อน = ทำก่อน) */
const NIGHTLY_TYPES = ['scan', 'plugin_check'] as const
type NightlyType = (typeof NIGHTLY_TYPES)[number]

type Queued = {
  type: NightlyType
  batchId: string | null
  jobs: number
  skipped: number
  error?: string
}

/**
 * ต่อคิวงานชนิดหนึ่งให้ทั้งฟลีต
 *
 * คิวเมื่อคืนอาจยังไม่หมด (โฮสต์ที่มีเว็บเยอะใช้เวลาหลายชั่วโมง) ต่อคิวซ้ำจะยิ่ง
 * พอกจนวนไม่จบ — ข้ามเว็บที่มีงานชนิดนี้ค้างอยู่แล้ว
 */
async function queueType(sb: Admin, type: NightlyType, sites: Site[]): Promise<Queued> {
  const { data: pending } = await sb
    .from('web_jobs')
    .select('site_id')
    .eq('type', type)
    .in('status', ['queued', 'running'])
    .not('site_id', 'is', null)
  const already = new Set((pending ?? []).map((j) => j.site_id))
  const todo = sites.filter((s) => !already.has(s.id))
  if (!todo.length) return { type, batchId: null, jobs: 0, skipped: sites.length }

  const { data: batch, error: bErr } = await sb
    .from('web_run_batches')
    .insert({ type, total_jobs: todo.length })
    .select('id')
    .single()
  if (bErr) return { type, batchId: null, jobs: 0, skipped: sites.length, error: bErr.message }

  const { error: jErr } = await sb.from('web_jobs').insert(
    todo.map((s) => ({
      batch_id: batch.id,
      type,
      host_id: s.host_id,
      site_id: s.id,
      // ค่าที่ constraint ยอมรับมีแค่ 'user' กับ 'schedule' — ห้ามใส่ 'cron'
      triggered_by: 'schedule',
    }))
  )
  if (jErr) {
    // สร้าง batch ไปแล้วแต่ใส่งานไม่สำเร็จ = เหลือ batch เปล่าค้างในประวัติ
    // เก็บกวาดเองก่อนตอบ (เคยค้าง 2 ใบตอน triggered_by ผิดค่า)
    await sb.from('web_run_batches').delete().eq('id', batch.id)
    return { type, batchId: null, jobs: 0, skipped: sites.length, error: jErr.message }
  }

  return { type, batchId: batch.id, jobs: todo.length, skipped: sites.length - todo.length }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createAdminClient()

  const { data: sites, error } = await sb
    .from('web_sites')
    .select('id, host_id')
    .eq('is_active', true)
    .not('host_id', 'is', null)
    .not('public_html_path', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const usable = sites ?? []
  if (!usable.length) return NextResponse.json({ success: true, jobs: 0, batches: [] })

  // ทีละชนิดตามลำดับ ห้ามยิงพร้อมกัน — คิวเรียงด้วย queued_at ถ้าสองชนิดได้เวลา
  // ใกล้กันเกินไป ลำดับที่ตั้งใจไว้จะสลับกันเอง
  const batches: Queued[] = []
  for (const type of NIGHTLY_TYPES) {
    batches.push(await queueType(sb, type, usable))
  }

  const failed = batches.filter((b) => b.error)
  const jobs = batches.reduce((n, b) => n + b.jobs, 0)

  // ล้มแค่ชนิดเดียวก็ยังตอบ 500 — cron ต้องเตือน ไม่ใช่เงียบแล้วปล่อยให้
  // งานอีกชนิดหายไปทั้งคืนโดยไม่มีใครรู้ (อีกชนิดที่สำเร็จยังอยู่ในคิวตามปกติ)
  return NextResponse.json(
    {
      success: failed.length === 0,
      jobs,
      batches,
      ...(failed.length
        ? { error: failed.map((b) => `${b.type}: ${b.error}`).join(' · ') }
        : {}),
    },
    { status: failed.length ? 500 : 200 }
  )
}

export async function POST(request: NextRequest) {
  return GET(request)
}
