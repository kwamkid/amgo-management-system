// app/api/web/jobs/enqueue/route.ts
//
// สั่งงานทั้งฟลีต — สร้าง batch 1 อัน + job ทีละเว็บ (ไม่ยิงเข้าโฮสต์ตรงนี้)
//
//   POST { type: 'plugin_update' | 'plugin_check' | 'scan' | 'backup' | 'backup_check' | 'discover', siteIds?, hostId? }
//
// ไม่ระบุ siteIds = ทำทุกเว็บที่ยังดูแลอยู่และผูกโฮสต์ไว้แล้ว
// type 'discover' เป็นงานระดับโฮสต์ (1 job ต่อ 1 โฮสต์) ไม่ใช่ต่อเว็บ
//
// คิวถูกกินโดย /api/web/jobs/next ที่ cron เรียกทุก 1–2 นาที — ทำทีละเว็บ
// ต่อโฮสต์เสมอ เพราะยิงพร้อมกันทั้งโฮสต์เคยทำ load พุ่งจนเว็บลูกค้าช้า

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

type JobType = 'scan' | 'plugin_update' | 'plugin_check' | 'backup' | 'backup_check' | 'discover'

/**
 * เพิ่งทำเสร็จไปไม่ถึงเท่านี้ = ไม่ต้องทำซ้ำ
 *
 * งานพวกนี้ต้อง SSH เข้าเครื่องจริงทุกครั้ง กดรัว ๆ แล้วทำซ้ำคือเปลืองเปล่า
 * และทำให้คิวยาวจนงานของเว็บอื่นรอนาน · 10 นาทีสั้นพอที่ถ้าตั้งใจสั่งใหม่จริง
 * ก็ไม่ต้องรอนาน แต่ยาวพอกันการกดพลาดซ้ำ ๆ
 */
const COOLDOWN_MINUTES = 10

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
  if (!type || !['scan', 'plugin_update', 'plugin_check', 'backup', 'backup_check', 'discover'].includes(type)) {
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
    .select('id, host_id, public_html_path, pending_plugin_count, plugins_checked_at')
    .eq('is_active', true)
    .not('host_id', 'is', null)
  if (body.siteIds?.length) sq = sq.in('id', body.siteIds)
  if (body.hostId) sq = sq.eq('host_id', body.hostId)

  const { data: sites, error } = await sq
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let usable = (sites ?? []).filter((s) => s.public_html_path)
  if (!usable.length) {
    return NextResponse.json(
      { error: 'ยังไม่มีเว็บที่ผูกโฮสต์ + รู้ path — กด "สแกนรายชื่อเว็บ" ที่หน้าโฮสต์ก่อน' },
      { status: 400 }
    )
  }

  // กดสั่งเว็บเดียว = เจตนาชัดว่า "เอาเว็บนี้แหละ" ให้ลองใหม่หมดแม้เคยยอมแพ้ไปแล้ว
  // (ใช้เป็นทางกลับเข้าระบบหลังต่ออายุ license ปลั๊กอิน pro)
  const force = body.siteIds?.length === 1

  // สั่งอัปเดตทั้งกลุ่ม = ทำเฉพาะเว็บที่ยังค้างจริง ๆ
  // เว็บที่ตรวจแล้วปลั๊กอินครบ ไม่ต้องเสีย SSH ไปเปิดดูซ้ำ
  // (เว็บที่ยังไม่เคยตรวจปล่อยผ่าน — ไม่รู้ว่าค้างหรือไม่ ต้องเข้าไปดูก่อน)
  const skippedUpToDate =
    type === 'plugin_update' && !body.siteIds?.length
      ? (() => {
          const before = usable.length
          usable = usable.filter((s) => !s.plugins_checked_at || (s.pending_plugin_count ?? 0) > 0)
          return before - usable.length
        })()
      : 0

  // กันสั่งซ้ำ — เว็บที่มีงานชนิดเดียวกันค้างอยู่แล้วไม่ต้องต่อคิวอีกใบ
  const { data: pending } = await admin
    .from('web_jobs')
    .select('site_id')
    .eq('type', type)
    .in('status', ['queued', 'running'])
    .not('site_id', 'is', null)
  const already = new Set((pending ?? []).map((j) => j.site_id))
  const before = usable.length
  usable = usable.filter((s) => !already.has(s.id))
  const skippedQueued = before - usable.length

  // ช่วงพักหลังเพิ่งทำเสร็จ — กันกดรัว ๆ ซ้ำงานที่เพิ่งทำไปเมื่อกี้
  // ของเดิมกันได้แค่ "ระหว่างยังไม่เสร็จ" พองานจบปุ๊บก็กดซ้ำได้ทันที
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString()
  const { data: recent } = await admin
    .from('web_jobs')
    .select('site_id')
    .eq('type', type)
    .eq('status', 'done')
    .gte('finished_at', since)
    .not('site_id', 'is', null)
  const justDone = new Set((recent ?? []).map((j) => j.site_id))
  const beforeCooldown = usable.length
  usable = usable.filter((s) => !justDone.has(s.id))
  const skippedRecent = beforeCooldown - usable.length

  if (!usable.length) {
    // บอกให้ครบทุกเหตุ ไม่ใช่เลือกมาบรรทัดเดียว — กดปุ่มรวมแล้วไม่มีอะไรเกิดขึ้น
    // ต้องรู้ว่าเพราะเว็บอยู่ในคิวอยู่แล้วกี่ตัว เพิ่งทำไปกี่ตัว ครบอยู่แล้วกี่ตัว
    const reasons = [
      skippedQueued ? `${skippedQueued} เว็บมีงานนี้ค้างคิวอยู่แล้ว` : '',
      skippedRecent ? `${skippedRecent} เว็บเพิ่งทำไปไม่ถึง ${COOLDOWN_MINUTES} นาที` : '',
      skippedUpToDate ? `${skippedUpToDate} เว็บปลั๊กอินครบแล้ว` : '',
    ].filter(Boolean)
    const why = reasons.length
      ? `ไม่มีเว็บที่ต้องทำเพิ่ม — ${reasons.join(' · ')}`
      : 'ไม่มีเว็บที่ต้องทำ'
    return NextResponse.json({
      success: true,
      jobs: 0,
      skippedUpToDate,
      skippedQueued,
      skippedRecent,
      message: why,
    })
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
      force,
    }))
  )
  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    batchId: batch.id,
    jobs: usable.length,
    skippedUpToDate,
    skippedQueued,
    skippedRecent,
  })
}
