// lib/services/storageUsageService.ts
//
// พื้นที่ storage ใช้ไปเท่าไหร่ (server เท่านั้น — ฟังก์ชัน storage_usage ให้สิทธิ์แค่ service_role)
// ใช้สองที่: การ์ดสถานะบนหน้ารายงานรูป และ cron ลบรูปเก่าสุดเมื่อใกล้เต็ม
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_QUOTA_MB, FOOTAGE_BUCKETS, capPlan } from './storageCapRules'

export type AdminDb = ReturnType<typeof createAdminClient>

export interface BucketUsage {
  bucket: string
  files: number
  bytes: number
  oldest: string | null
}

export interface StorageUsage {
  buckets: BucketUsage[]
  totalBytes: number
  /** เฉพาะ bucket ที่นับเป็นฟุตเทจ (ลบเก่าสุดได้) */
  footageBytes: number
  quotaMb: number
  /** สัดส่วนที่ใช้ไป 0–1 (เทียบทั้งโปรเจกต์กับโควตา) */
  pct: number
  /** เกินเส้น 85% แล้ว — cron จะเริ่มลบรูปเก่าสุด */
  over: boolean
  oldestFootage: string | null
}

const QUOTA_KEY = 'storage_quota_mb'

export async function readQuotaMb(sb: AdminDb): Promise<number> {
  const { data } = await sb.from('app_config').select('value').eq('key', QUOTA_KEY).maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_QUOTA_MB
}

export async function setQuotaMb(sb: AdminDb, mb: number): Promise<void> {
  const { error } = await sb.from('app_config').upsert(
    { key: QUOTA_KEY, value: String(Math.round(mb)), note: 'โควตา storage ของแพลน (Free = 1024 MB) — cron ลบรูปเก่าสุดเมื่อใช้เกิน 85%' },
    { onConflict: 'key' }
  )
  if (error) throw new Error(`บันทึกโควตาไม่สำเร็จ: ${error.message}`)
}

export async function readStorageUsage(sb: AdminDb): Promise<StorageUsage> {
  const [{ data, error }, quotaMb] = await Promise.all([sb.rpc('storage_usage'), readQuotaMb(sb)])
  if (error) throw new Error(`วัดพื้นที่ไม่สำเร็จ: ${error.message}`)

  const buckets: BucketUsage[] = (data ?? []).map((r) => ({
    bucket: r.bucket,
    files: Number(r.files),
    bytes: Number(r.bytes),
    oldest: r.oldest,
  }))
  const totalBytes = buckets.reduce((n, b) => n + b.bytes, 0)
  const footage = buckets.filter((b) => (FOOTAGE_BUCKETS as readonly string[]).includes(b.bucket))
  const footageBytes = footage.reduce((n, b) => n + b.bytes, 0)
  const oldestFootage = footage.map((b) => b.oldest).filter((d): d is string => !!d).sort()[0] ?? null
  const plan = capPlan(totalBytes, quotaMb)

  return { buckets, totalBytes, footageBytes, quotaMb, pct: plan.pct, over: plan.over, oldestFootage }
}
