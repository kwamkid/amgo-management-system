// app/api/web/jobs/enqueue/route.ts
//
// สั่งงานทั้งฟลีต — สร้าง batch 1 อัน + job ทีละเว็บ (ไม่ยิงเข้าโฮสต์ตรงนี้)
//
//   POST { type: 'plugin_update' | 'plugin_check' | 'scan' | 'backup' | 'discover', siteIds?, hostId? }
//
// ไม่ระบุ siteIds = ทำทุกเว็บที่ยังดูแลอยู่และผูกโฮสต์ไว้แล้ว
// type 'discover' เป็นงานระดับโฮสต์ (1 job ต่อ 1 โฮสต์) ไม่ใช่ต่อเว็บ
//
// คิวถูกกินโดย /api/web/jobs/next ที่ cron เรียกทุก 1–2 นาที — ทำทีละเว็บ
// ต่อโฮสต์เสมอ เพราะยิงพร้อมกันทั้งโฮสต์เคยทำ load พุ่งจนเว็บลูกค้าช้า

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

type JobType = 'scan' | 'plugin_update' | 'plugin_check' | 'backup' | 'discover'

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: owner } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { type?: JobType; siteIds?: string[]; hostId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const type = body.type
  if (!type || !['scan', 'plugin_update', 'plugin_check', 'backup', 'discover'].includes(type)) {
    return NextResponse.json({ error: 'ไม่รู้จักงานประเภทนี้' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── งานระดับโฮสต์: สำรวจว่าโฮสต์นี้มีเว็บอะไรบ้าง ──
  if (type === 'discover') {
    let hq = admin.from('web_hosts').select('id').eq('is_active', true)
    if (body.hostId) hq = hq.eq('id', body.hostId)
    const { data: hosts, error } = await hq
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!hosts?.length) return NextResponse.json({ error: 'ยังไม่มีโฮสต์ในระบบ' }, { status: 400 })

    const { data: batch } = await admin
      .from('web_run_batches')
      .insert({ type, total_jobs: hosts.length, created_by: user.id })
      .select('id')
      .single()

    await admin.from('web_jobs').insert(
      hosts.map((h) => ({ batch_id: batch!.id, type, host_id: h.id, triggered_by: 'user' }))
    )
    return NextResponse.json({ success: true, batchId: batch!.id, jobs: hosts.length })
  }

  // ── งานระดับเว็บ ──
  let sq = admin
    .from('web_sites')
    .select('id, host_id, public_html_path')
    .eq('is_active', true)
    .not('host_id', 'is', null)
  if (body.siteIds?.length) sq = sq.in('id', body.siteIds)
  if (body.hostId) sq = sq.eq('host_id', body.hostId)

  const { data: sites, error } = await sq
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const usable = (sites ?? []).filter((s) => s.public_html_path)
  if (!usable.length) {
    return NextResponse.json(
      { error: 'ยังไม่มีเว็บที่ผูกโฮสต์ + รู้ path — กด "สแกนรายชื่อเว็บ" ที่หน้าโฮสต์ก่อน' },
      { status: 400 }
    )
  }

  const { data: batch, error: bErr } = await admin
    .from('web_run_batches')
    .insert({ type, total_jobs: usable.length, created_by: user.id })
    .select('id')
    .single()
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  const { error: jErr } = await admin.from('web_jobs').insert(
    usable.map((s) => ({
      batch_id: batch.id,
      type,
      host_id: s.host_id,
      site_id: s.id,
      triggered_by: 'user',
    }))
  )
  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })

  return NextResponse.json({ success: true, batchId: batch.id, jobs: usable.length })
}
