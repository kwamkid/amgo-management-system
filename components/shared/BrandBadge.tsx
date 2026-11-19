'use client'

import { Pill, type SelectOption } from '@/components/aoo'
import { BRANDS, brandLabel, brandLogo } from '@/lib/constants/brands'

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

/**
 * Options for a brand SelectMenu — company brands first (with logo), then any typed-in brands
 * from `extra`, sorted. One list for every brand picker (tasks board, voice drafts, …).
 */
export function brandSelectOptions(extra: (string | null | undefined)[] = []): SelectOption[] {
  const more = [...new Set(extra.filter((b): b is string => !!b))].filter((b) => !BRANDS.some((x) => x.slug === b)).sort()
  return [...BRANDS.map((b) => b.slug), ...more].map((b) => ({ value: b, label: brandLabel(b), icon: <BrandLogo brand={b} /> }))
}
