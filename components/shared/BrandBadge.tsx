'use client'

import { Pill } from '@/components/aoo'
import { brandLabel, brandLogo } from '@/lib/constants/brands'

/** โลโก้แบรนด์ขนาดเล็ก — ใช้ในป้ายและเป็นไอคอนในช่องเลือก · ไม่มีโลโก้ = ไม่แสดงอะไร */
export function BrandLogo({ brand }: { brand: string }) {
  const src = brandLogo(brand)
  // eslint-disable-next-line @next/next/no-img-element -- ไฟล์ 64px ใน public อยู่แล้ว
  return src ? <img src={src} alt="" className="aoo-brand-logo" /> : null
}

/** ป้ายแบรนด์ = โลโก้ + ชื่อ · สีม่วงเดียวทั้งระบบ แยกจากป้ายสถานะ */
export default function BrandBadge({ brand }: { brand: string }) {
  return (
    <Pill tone="grape">
      <BrandLogo brand={brand} />
      {brandLabel(brand)}
    </Pill>
  )
}
