// กติกาสิทธิ์เข้าเมนู/หน้าที่ไม่ได้ผูกกับ role ตรง ๆ อย่างเดียว

/**
 * เมนูงานส่งของ (Delivery Tracking) — role สายส่ง/แอดมิน/HR เห็นอยู่แล้ว
 * บวกตำแหน่งที่ติดธง sees_delivery (เช่น Call Center ที่ role เป็น employee)
 * ใช้ที่ Sidebar และ guard ของทั้ง 3 หน้า ให้เมนูกับหน้าเปิดตรงกันเสมอ
 */
export const canSeeDelivery = (
  u: { role?: string; seesDelivery?: boolean } | null | undefined
): boolean => !!u && (['driver', 'admin', 'hr'].includes(u.role ?? '') || !!u.seesDelivery)
