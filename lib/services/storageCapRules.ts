// lib/services/storageCapRules.ts
//
// กติกา "พื้นที่เก็บรูปแบบกล้องวงจรปิด" — กติกาล้วน ไม่แตะฐานข้อมูล
// (เจ้าของขอ 7 ก.ย. 69: "ถ้าเต็มแล้วให้ทับรูปเก่าสุดไปเรื่อย ๆ")
//
// · เริ่มลบเมื่อใช้เกิน HIGH (85%) ของโควตา · ลบรูปเก่าสุดก่อนจนเหลือ ≤ LOW (75%)
//   เว้นช่วง 10% ไว้ ไม่งั้นทุกคืนจะลบทีละนิดแล้วเด้งกลับมาเกินใหม่
// · ลบเฉพาะรูปเช็คอิน/ส่งของ/สต็อก — โลโก้ · avatar · รูปสินค้า SRP · สลิป ไม่ใช่ "ฟุตเทจ" ไม่แตะ
// · กฎ 60 วันเดิมยังทำงานก่อนเสมอ — ตัวนี้เป็นตาข่ายสำรองตอนรูปโตเร็วกว่าที่คิด

export const HIGH_WATER = 0.85
export const LOW_WATER = 0.75
/** โควตาแพลน Free ของ Supabase = 1 GB — เปลี่ยนที่ app_config.storage_quota_mb เมื่ออัปเกรด */
export const DEFAULT_QUOTA_MB = 1024

/** bucket ที่นับเป็น "ฟุตเทจ" ลบเก่าสุดได้ */
export const FOOTAGE_BUCKETS = ['checkin-photos', 'delivery-photos', 'stock-photos'] as const

export interface CapPlan {
  /** ต้องลบไหม */
  over: boolean
  /** เป้าหมายที่ต้องลดให้ถึง (bytes) — มีเมื่อ over */
  targetBytes: number
  /** ต้องปล่อยพื้นที่อย่างน้อยเท่านี้ (bytes) */
  freeBytes: number
  pct: number
}

export function capPlan(usedBytes: number, quotaMb: number): CapPlan {
  const quota = Math.max(1, quotaMb) * 1024 * 1024
  const pct = usedBytes / quota
  const over = pct > HIGH_WATER
  const targetBytes = Math.floor(quota * LOW_WATER)
  return { over, targetBytes, freeBytes: over ? Math.max(0, usedBytes - targetBytes) : 0, pct }
}

/** MB สวย ๆ สำหรับหน้าจอ: 7.9 MB · 106 MB · 1.0 GB */
export function formatMb(bytes: number): string {
  const mb = bytes / 1048576
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`
  if (mb >= 100) return `${Math.round(mb)} MB`
  return `${mb.toFixed(1)} MB`
}

/** ประมาณว่าจะเต็ม (ถึง HIGH) ในอีกกี่วัน จากอัตราโตต่อวัน — null = ไม่โต */
export function daysUntilHigh(usedBytes: number, quotaMb: number, bytesPerDay: number): number | null {
  if (bytesPerDay <= 0) return null
  const high = quotaMb * 1024 * 1024 * HIGH_WATER
  if (usedBytes >= high) return 0
  return Math.floor((high - usedBytes) / bytesPerDay)
}
