// lib/auth/liff.ts
//
// LIFF app ใน LINE Login channel ตัวเดียวกับปุ่ม LINE (2007335783) — ต้องเป็น channel
// เดียวกันเท่านั้น ไม่งั้น LINE ส่ง userId คนละค่า ระบบจะมองว่าเป็นคนใหม่ทั้งบริษัท
// Endpoint URL ใน LINE Developers ต้องเป็น <APP_URL>/liff · ไม่ใช่ความลับ
export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '2007335783-bi68fIED'

/** เปิดหน้า /liff ในแอป LINE พร้อม nonce ให้ส่ง session กลับมาที่หน้าที่กด */
export function liffLoginUrl(nonce: string) {
  return `https://liff.line.me/${LIFF_ID}?nonce=${nonce}`
}
