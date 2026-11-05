// โลโก้แพลตฟอร์มของหน้า /vault — ไฟล์อยู่ public/platforms/ ใช้ร่วมกับแท็บกรอง
// Shopee · Lazada · TikTok · TikTok Shop จาก aoocommerce · ที่เหลือจาก simple-icons (CC0)
// แพลตฟอร์มที่เพิ่มเองไม่มีไฟล์ จึงเป็นตัวย่อบนพื้นเทา

import type { VaultPlatform } from '@/lib/vault/platforms'

export default function PlatformLogo({ platform, size = 32 }: { platform: VaultPlatform; size?: number }) {
  if (platform.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- SVG เล็กใน public
    return <img src={platform.logo} alt={platform.label} width={size} height={size} className="shrink-0 rounded-lg object-contain" />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={platform.label} className="shrink-0">
      <rect width="32" height="32" rx="8" fill={platform.color} />
      <text x="16" y="21" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
        {platform.short}
      </text>
    </svg>
  )
}
