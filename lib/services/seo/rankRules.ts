// lib/services/seo/rankRules.ts
//
// กติกาอันดับที่ทั้งหน้าเว็บ (seoService) และงานเบื้องหลัง (rankSync) ใช้ร่วมกัน

/**
 * ร่วงหนักจนน่าสงสัย = เคยติด 30 อันดับแรก แล้วรอบนี้หลุด 100 หรือร่วง 20 อันดับขึ้นไป
 * ผล SERP จากเครื่องกลางแกว่งได้ (เคสจริง "กระเช้าผลไม้" 6 ต.ค. 69: GSC อันดับ 3–5 แต่ DataForSEO ไม่เจอ)
 * จึงยังไม่ฟันธงว่าหลุด จนกว่าจะเช็คซ้ำอีกรอบ — หน้าเว็บโชว์ "รอเช็คซ้ำ" · rankSync ส่งเช็คซ้ำวันถัดไป
 */
export function isSuspiciousDrop(cur: number | null, prev: number | null) {
  if (prev == null || prev > 30) return false
  return cur == null || cur - prev >= 20
}
