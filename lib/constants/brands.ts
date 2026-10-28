// แบรนด์ของบริษัท — slug ตรงกับชื่อโฟลเดอร์ใน AGD (02-hape → hape) ใช้เป็นค่าใน tasks.brand
// โลโก้อยู่ที่ public/brands/<slug>.webp (64px · ย่อจาก AGD/10-abcthebaby/04-Brand-Logo)
// แบรนด์ที่พิมพ์เพิ่มเองในหน้างาน ไม่มีในนี้ = โชว์ชื่ออย่างเดียว ไม่มีโลโก้

export interface Brand {
  slug: string
  label: string
}

export const BRANDS: Brand[] = [
  { slug: 'abcthebaby', label: 'ABC the Baby' },
  { slug: 'gb', label: 'GB' },
  { slug: 'hape', label: 'Hape' },
  { slug: 'stokke', label: 'Stokke' },
  { slug: 'taftoys', label: 'Taf Toys' },
  { slug: 'tommeetippee', label: 'Tommee Tippee' },
]

const BY_SLUG = new Map(BRANDS.map((b) => [b.slug, b]))

export const brandLabel = (slug: string) => BY_SLUG.get(slug)?.label ?? slug
export const brandLogo = (slug: string) => (BY_SLUG.has(slug) ? `/brands/${slug}.webp` : null)
