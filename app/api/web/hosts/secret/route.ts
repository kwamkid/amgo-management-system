// app/api/web/hosts/secret/route.ts
//
// ตั้ง/ลบความลับ SSH ของโฮสต์ — รหัสผ่าน หรือ กุญแจส่วนตัว (เลือกอย่างใดอย่างหนึ่ง)
//
//   POST   { hostId, password }                    → ตั้งรหัสผ่าน
//   POST   { hostId, privateKey, passphrase? }     → ตั้งกุญแจส่วนตัวของโฮสต์นี้
//   DELETE ?hostId=...&what=password|key|all       → ลบทิ้ง
//
// ทุกค่าเข้ารหัสก่อนลง DB (AES-256-GCM, กุญแจอยู่ใน env) และตารางปลายทาง
// ไม่มี RLS policy เลย = เบราว์เซอร์อ่านกลับไม่ได้ ต่อให้เป็นเจ้าของเมนูเอง

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/services/web/secretBox'
import type { Database } from '@/types/database'

async function requireOwner() {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? user : null
}

export async function POST(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { hostId?: string; password?: string; privateKey?: string; passphrase?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (!body.hostId || (!body.password && !body.privateKey)) {
    return NextResponse.json({ error: 'ต้องส่งรหัสผ่านหรือกุญแจอย่างน้อยหนึ่งอย่าง' }, { status: 400 })
  }

  // กุญแจที่วางมาต้องเป็นไฟล์ private key จริง ๆ ไม่ใช่ public key ที่วางผิดช่อง
  if (body.privateKey && !/BEGIN [A-Z ]*PRIVATE KEY/.test(body.privateKey)) {
    return NextResponse.json(
      { error: 'นี่ไม่ใช่ private key — ต้องขึ้นต้นด้วย -----BEGIN ... PRIVATE KEY-----' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const patch: Database['public']['Tables']['web_host_secrets']['Insert'] = {
    host_id: body.hostId,
    updated_at: new Date().toISOString(),
  }

  try {
    if (body.password) patch.ssh_password = encryptSecret(body.password)
    if (body.privateKey) patch.ssh_private_key = encryptSecret(body.privateKey.trim() + '\n')
    if (body.passphrase) patch.ssh_passphrase = encryptSecret(body.passphrase)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { error } = await admin.from('web_host_secrets').upsert(patch, { onConflict: 'host_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin
    .from('web_hosts')
    .update(
      body.privateKey && body.password
        ? { has_password: true, has_key: true }
        : body.privateKey
          ? { has_key: true }
          : { has_password: true }
    )
    .eq('id', body.hostId)

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const hostId = url.searchParams.get('hostId')
  const what = url.searchParams.get('what') ?? 'all'
  if (!hostId) return NextResponse.json({ error: 'ไม่ได้ระบุโฮสต์' }, { status: 400 })

  const admin = createAdminClient()
  if (what === 'all') {
    await admin.from('web_host_secrets').delete().eq('host_id', hostId)
    await admin.from('web_hosts').update({ has_password: false, has_key: false }).eq('id', hostId)
  } else if (what === 'password') {
    await admin.from('web_host_secrets').update({ ssh_password: null }).eq('host_id', hostId)
    await admin.from('web_hosts').update({ has_password: false }).eq('id', hostId)
  } else {
    await admin
      .from('web_host_secrets')
      .update({ ssh_private_key: null, ssh_passphrase: null })
      .eq('host_id', hostId)
    await admin.from('web_hosts').update({ has_key: false }).eq('id', hostId)
  }

  return NextResponse.json({ success: true })
}
