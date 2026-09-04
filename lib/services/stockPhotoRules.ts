// lib/services/stockPhotoRules.ts
//
// กติกา "วันนี้ถ่ายครบหรือยัง" — แยกจาก service เพราะไม่แตะฐานข้อมูล
// เทสต์ (scripts/test-stock-photos.mjs) ยิงเข้าฟังก์ชันนี้ตรง ๆ ได้โดยไม่ต้องมี env
//
// ครบ = มี "หน้าร้าน" อย่างน้อย 1 รูป และ "สต็อก" อย่างน้อย 1 รูป (เจ้าของสั่ง 4 ก.ย. 69)
// กี่รูปก็ได้ต่ออย่าง เพราะพื้นที่ใหญ่ หลายจุด · ไม่ครบ = เช็คเอาท์ไม่ได้

export type StockPhotoKind = 'storefront' | 'stock'

export const KIND_LABEL: Record<StockPhotoKind, string> = {
  storefront: 'หน้าร้าน',
  stock: 'สต็อก',
}

export interface StockPhotoStatus {
  storefront: number
  stock: number
  /** มีอย่างละอย่างน้อย 1 รูป */
  complete: boolean
  /** ที่ยังขาด — เอาไปบอกผู้ใช้ตรง ๆ */
  missing: StockPhotoKind[]
}

export function stockPhotoStatus(photos: { kind: string }[]): StockPhotoStatus {
  const storefront = photos.filter((p) => p.kind === 'storefront').length
  const stock = photos.filter((p) => p.kind === 'stock').length
  const missing: StockPhotoKind[] = []
  if (!storefront) missing.push('storefront')
  if (!stock) missing.push('stock')
  return { storefront, stock, complete: missing.length === 0, missing }
}

/** ข้อความบอกว่ายังขาดอะไร — ใช้ทั้ง toast ตอนเช็คเอาท์และป้ายบนการ์ด */
export function missingLabel(status: StockPhotoStatus): string {
  return status.missing.map((k) => KIND_LABEL[k]).join(' และ ')
}
