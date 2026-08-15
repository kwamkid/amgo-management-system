// app/api/web/keys/route.ts
//
// คลังกุญแจ SSH — 1 ดอกต่อผู้ให้บริการ (Hostinger / SiteGround / ...)
//
//   GET                                   → รายการกุญแจ + public key (ไม่มี private)
//   POST { name, provider, privateKey?, passphrase?, publicKey? }
//        · ส่ง privateKey มา = นำเข้ากุญแจที่มีอยู่
//        · ไม่ส่ง = สร้างคู่ใหม่ให้ (ed25519) แล้วคืน public key ไปแปะที่โฮสต์
//   DELETE ?id=...                        → ลบกุญแจ (โฮสต์ที่ชี้อยู่จะหลุดเป็น null)
//
// private key เข้ารหัสก่อนเก็บเสมอ และไม่มีทางอ่านกลับผ่าน API นี้

import { NextRequest, NextResponse } from 'next/server'
import { generateKeyPairSync, createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { encryptSecret } from '@/lib/services/web/secretBox'

async function requireOwner() {
  const sb = await createServerSupabase()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('web_owners').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? user : null
}

/** สร้างคู่กุญแจ ed25519 แล้วแปลง public key เป็นรูปแบบ OpenSSH (บรรทัดเดียว) */
function generateEd25519(comment: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  // ตัด 12 ไบต์หัวของ DER ทิ้ง เหลือ raw 32 ไบต์ตามสเปก ed25519
  const raw = publicKey.subarray(publicKey.length - 32)
  const type = Buffer.from('ssh-ed25519')
  const len = (b: Buffer) => {
    const l = Buffer.alloc(4)
    l.writeUInt32BE(b.length)
    return Buffer.concat([l, b])
  }
  const blob = Buffer.concat([len(type), len(raw)])
  return {
    publicKey: `ssh-ed25519 ${blob.toString('base64')} ${comment}`,
    privateKey: privateKey.toString(),
  }
}

export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('web_ssh_keys')
    .select('id, name, provider, public_key, created_at, web_hosts(count)')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    keys: (data ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      provider: k.provider,
      publicKey: k.public_key,
      createdAt: k.created_at,
      hostCount: (k.web_hosts as unknown as { count?: number }[])?.[0]?.count ?? 0,
      fingerprint: k.public_key
        ? createHash('sha256').update(Buffer.from(k.public_key.split(' ')[1] ?? '', 'base64')).digest('base64')
        : '',
    })),
  })
}

export async function POST(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: string; provider?: string; privateKey?: string; passphrase?: string; publicKey?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (!body.name?.trim()) return NextResponse.json({ error: 'ต้องตั้งชื่อกุญแจ' }, { status: 400 })

  let priv = body.privateKey?.trim()
  let pub = body.publicKey?.trim() ?? ''

  if (priv) {
    if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(priv)) {
      return NextResponse.json(
        { error: 'นี่ไม่ใช่ private key — ต้องขึ้นต้นด้วย -----BEGIN ... PRIVATE KEY-----' },
        { status: 400 }
      )
    }
  } else {
    const pair = generateEd25519(body.name.trim().replace(/\s+/g, '-'))
    priv = pair.privateKey
    pub = pair.publicKey
  }

  const admin = createAdminClient()
  try {
    const { data, error } = await admin
      .from('web_ssh_keys')
      .insert({
        name: body.name.trim(),
        provider: body.provider ?? '',
        public_key: pub,
        private_key: encryptSecret(priv.endsWith('\n') ? priv : priv + '\n'),
        passphrase: body.passphrase ? encryptSecret(body.passphrase) : null,
      })
      .select('id, name, provider, public_key')
      .single()
    if (error) throw error

    return NextResponse.json({
      success: true,
      key: { id: data.id, name: data.name, provider: data.provider, publicKey: data.public_key },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ไม่ได้ระบุกุญแจ' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('web_ssh_keys').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
