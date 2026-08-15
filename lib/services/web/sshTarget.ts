// lib/services/web/sshTarget.ts
//
// ประกอบข้อมูลต่อ SSH ของโฮสต์ (ฝั่งเซิร์ฟเวอร์เท่านั้น)
//
// ลำดับที่ใช้: กุญแจจากคลัง (ตามที่โฮสต์เลือก) → รหัสผ่านของโฮสต์นั้น →
// กุญแจกลางใน env — กุญแจมาก่อนเพราะเพิกถอนทีละผู้ให้บริการได้
// ค่าที่เก็บใน DB เข้ารหัสไว้ ต้องถอดตรงนี้ก่อนใช้ ไม่เคยส่งออกไปหาเบราว์เซอร์

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SshTarget } from './wpCli'
import { decryptSecret } from './secretBox'

type HostRow = {
  id: string
  ssh_host: string
  ssh_port: number
  ssh_user: string
  key_id?: string | null
  has_password?: boolean
}

export async function targetForHost(
  admin: SupabaseClient<Database>,
  host: HostRow
): Promise<SshTarget> {
  const target: SshTarget = { host: host.ssh_host, port: host.ssh_port, user: host.ssh_user }

  // 1. กุญแจจากคลัง (ดอกเดียวใช้ได้หลายโฮสต์ เช่น SiteGround ที่แยกรายเว็บ)
  if (host.key_id) {
    const { data: key } = await admin
      .from('web_ssh_keys')
      .select('private_key, passphrase')
      .eq('id', host.key_id)
      .maybeSingle()
    if (key?.private_key) {
      return {
        ...target,
        privateKey: decryptSecret(key.private_key),
        passphrase: key.passphrase ? decryptSecret(key.passphrase) : undefined,
      }
    }
  }

  // 2. รหัสผ่านเฉพาะโฮสต์
  if (host.has_password) {
    const { data } = await admin
      .from('web_host_secrets')
      .select('ssh_password')
      .eq('host_id', host.id)
      .maybeSingle()
    if (data?.ssh_password) return { ...target, password: decryptSecret(data.ssh_password) }
  }

  // 3. ไม่ได้ตั้งอะไรเลย → ตกไปใช้กุญแจกลางใน env (จัดการที่ wpCli)
  return target
}
