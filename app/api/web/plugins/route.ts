// app/api/web/plugins/route.ts
//
// อ่าน/อัปเดตปลั๊กอินของ "เว็บเดียว" แบบทันที (กดจากหน้ารายละเอียด)
//
//   POST { siteId }              → อ่านรายการปลั๊กอิน + เวอร์ชัน WordPress
//   POST { siteId, update }      → อัปเดต 1 ตัว (slug) หรือทั้งเว็บ ('all')
//
// งานทั้งฟลีตให้ใช้คิวแทน (/api/web/jobs/enqueue) — ตัวนี้ไว้ดูผลทันทีทีละเว็บ
// SSH เป็นของโฮสต์ ไม่ใช่ของเว็บ — เว็บบอกแค่ path ใต้ ~/domains

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { coreVersion, listPlugins, updatePlugins } from '@/lib/services/web/wpCli'
import { targetForHost } from '@/lib/services/web/sshTarget'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: owner } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { siteId?: string; update?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (!body.siteId) return NextResponse.json({ error: 'ไม่ได้ระบุเว็บ' }, { status: 400 })

  const admin = createAdminClient()
  const { data: site, error } = await admin
    .from('web_sites')
    .select('id, site_name, host_id, public_html_path')
    .eq('id', body.siteId)
    .maybeSingle()
  if (error || !site) return NextResponse.json({ error: 'ไม่พบเว็บนี้' }, { status: 404 })
  if (!site.host_id || !site.public_html_path) {
    return NextResponse.json(
      { error: 'เว็บนี้ยังไม่ผูกโฮสต์ — กด "สแกนรายชื่อเว็บ" ที่หน้าโฮสต์ก่อน' },
      { status: 400 }
    )
  }

  const { data: host } = await admin.from('web_hosts').select('*').eq('id', site.host_id).maybeSingle()
  if (!host) return NextResponse.json({ error: 'ไม่พบโฮสต์ของเว็บนี้' }, { status: 400 })

  const target = await targetForHost(admin, host)
  const path = site.public_html_path

  try {
    if (body.update) {
      const res = await updatePlugins(target, path, body.update)
      await admin.from('web_site_logs').insert({
        site_id: site.id,
        kind: 'plugin_update',
        message:
          body.update === 'all'
            ? 'อัปเดตปลั๊กอินทั้งหมดผ่าน WP-CLI'
            : `อัปเดตปลั๊กอิน ${body.update} ผ่าน WP-CLI`,
        created_by: user.id,
      })
      console.log(`[web] ${site.site_name} update ${body.update}:`, (res.out + res.err).slice(0, 500))
    }

    // อ่านสถานะใหม่เสมอ — ทั้งกรณีสแกนเฉย ๆ และหลังอัปเดต
    const plugins = await listPlugins(target, path)
    const version = await coreVersion(target, path).catch(() => '')
    const now = new Date().toISOString()
    const pending = plugins.filter((p) => p.update === 'available')

    await admin.from('web_plugins').delete().eq('site_id', site.id)
    if (plugins.length) {
      await admin.from('web_plugins').insert(
        plugins.map((p) => ({
          site_id: site.id,
          slug: p.name,
          name: p.name,
          version: p.version ?? '',
          new_version: p.update === 'available' ? (p.update_version ?? 'มีอัปเดต') : null,
          status: p.status ?? 'active',
          checked_at: now,
        }))
      )
    }
    await admin
      .from('web_sites')
      .update({ plugins_checked_at: now, wp_version: version, pending_plugin_count: pending.length })
      .eq('id', site.id)

    return NextResponse.json({
      success: true,
      count: plugins.length,
      updatable: pending.length,
      wpVersion: version,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
