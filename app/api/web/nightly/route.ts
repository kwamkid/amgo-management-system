// app/api/web/nightly/route.ts
//
// งานประจำคืน — สั่งตรวจปลั๊กอินทั้งฟลีตเข้าคิว (cron วันละครั้ง ตอนดึก)
//   ส่ง Authorization: Bearer <CRON_SECRET>
//
// ทำไมต้องอัตโนมัติ: ถ้ารอให้คนกด "ตรวจทุกเว็บ" เอง ตัวเลขในตารางจะเก่าเสมอ
// จนกว่าจะมีคนนึกได้ แล้วหน้าจอที่ข้อมูลเก่าคือหน้าจอที่เชื่อไม่ได้
//
// ปลอดภัยพอจะรันทุกคืน: plugin_check อ่านอย่างเดียว (`wp plugin list`)
// ไม่แตะไฟล์ ไม่แตะฐานข้อมูลของเว็บ ใช้เวลาเว็บละ ~3 วินาที
// และคิวยังบังคับทีละงานต่อโฮสต์อยู่ดี โหลดจึงไม่พุ่ง
//
// ตั้งตอนดึกเพราะเป็นช่วงที่เว็บลูกค้าคนน้อยที่สุด — ต่อให้ช้าไปบ้างก็ไม่มีใครเจอ

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCron } from '@/lib/cron-auth'

export const maxDuration = 30

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
  if (!usable.length) return NextResponse.json({ success: true, jobs: 0 })

  // คิวเมื่อคืนอาจยังไม่หมด (โฮสต์ที่มีเว็บเยอะใช้เวลาหลายชั่วโมง)
  // ต่อคิวซ้ำจะยิ่งพอกจนวนไม่จบ — ข้ามเว็บที่มีงานชนิดนี้ค้างอยู่แล้ว
  const { data: pending } = await sb
    .from('web_jobs')
    .select('site_id')
    .eq('type', 'plugin_check')
    .in('status', ['queued', 'running'])
    .not('site_id', 'is', null)
  const already = new Set((pending ?? []).map((j) => j.site_id))
  const todo = usable.filter((s) => !already.has(s.id))
  if (!todo.length) return NextResponse.json({ success: true, jobs: 0, skipped: usable.length })

  const { data: batch, error: bErr } = await sb
    .from('web_run_batches')
    .insert({ type: 'plugin_check', total_jobs: todo.length })
    .select('id')
    .single()
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  const { error: jErr } = await sb.from('web_jobs').insert(
    todo.map((s) => ({
      batch_id: batch.id,
      type: 'plugin_check',
      host_id: s.host_id,
      site_id: s.id,
      triggered_by: 'cron',
    }))
  )
  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    batchId: batch.id,
    jobs: todo.length,
    skipped: usable.length - todo.length,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
