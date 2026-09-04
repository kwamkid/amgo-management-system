// ไอคอน "ของจริง" สำหรับหน้าวิธีติดตั้งแอป — วาดเองด้วย SVG ให้ใกล้ของจริงพอที่พนักงาน
// จะมองแล้วรู้ว่าต้องกดอะไร (เจ้าของขอ 5 ก.ย. 69: "ควรมี icon ตัวอย่าง เช่น icon Safari")
// ไม่ใช้ไฟล์โลโก้ทางการ — วาดให้ "จำได้" ไม่ใช่ลอกแบบ
import { LineIcon } from '@/components/icons/LineIcon'

type P = { size?: number; className?: string }

/** Safari — วงกลมฟ้า เข็มทิศแดง-ขาว */
export function SafariIcon({ size = 40, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="sf-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3ea8ff" />
          <stop offset="1" stopColor="#0a6cf0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="10" fill="#fff" />
      <circle cx="24" cy="24" r="19" fill="url(#sf-bg)" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1" strokeDasharray="1 3.2" />
      <g transform="rotate(45 24 24)">
        <path d="M24 9 L27.5 24 L20.5 24 Z" fill="#ff3b30" />
        <path d="M24 39 L20.5 24 L27.5 24 Z" fill="#fff" />
      </g>
    </svg>
  )
}

/** Chrome — วงแหวนแดง/เหลือง/เขียว แกนฟ้า */
export function ChromeIcon({ size = 40, className }: P) {
  const sector = 'M24 24 L24 3 A21 21 0 0 1 42.19 34.5 Z'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="10" fill="#fff" />
      <path d={sector} fill="#ea4335" />
      <path d={sector} fill="#34a853" transform="rotate(120 24 24)" />
      <path d={sector} fill="#fbbc05" transform="rotate(240 24 24)" />
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <circle cx="24" cy="24" r="7.5" fill="#4285f4" />
    </svg>
  )
}

/** แอป LINE — สี่เหลี่ยมมนเขียว บับเบิลขาว */
export function LineAppIcon({ size = 40, className }: P) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[22%] bg-[#06C755] ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <LineIcon size={Math.round(size * 0.78)} />
    </span>
  )
}

/** ปุ่มแชร์ของ iOS — กล่องมีลูกศรชี้ขึ้น สีฟ้าระบบ */
export function ShareIosIcon({ size = 28, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11H7.5A1.5 1.5 0 0 0 6 12.5v10A1.5 1.5 0 0 0 7.5 24h13a1.5 1.5 0 0 0 1.5-1.5v-10a1.5 1.5 0 0 0-1.5-1.5H19" />
      <path d="M14 17V3" />
      <path d="M9.5 7.5 14 3l4.5 4.5" />
    </svg>
  )
}

/** "เพิ่มไปยังหน้าจอโฮม" ของ iOS — สี่เหลี่ยมมนมีบวก */
export function AddToHomeIcon({ size = 28, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden fill="none" stroke="#1c1c1e" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="4" width="20" height="20" rx="5" />
      <path d="M14 9v10M9 14h10" />
    </svg>
  )
}

/** เมนู ⋮ ของ Chrome */
export function KebabIcon({ size = 28, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden fill="#1c1c1e">
      <circle cx="14" cy="6" r="2.4" />
      <circle cx="14" cy="14" r="2.4" />
      <circle cx="14" cy="22" r="2.4" />
    </svg>
  )
}

/** เมนู ⋯ ของ LINE (มุมขวาล่างบน iPhone) */
export function EllipsisIcon({ size = 28, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden fill="#1c1c1e">
      <circle cx="6" cy="14" r="2.4" />
      <circle cx="14" cy="14" r="2.4" />
      <circle cx="22" cy="14" r="2.4" />
    </svg>
  )
}

/** ลูกศร "แล้วไป" ระหว่างไอคอน */
export function ThenArrow({ className }: { className?: string }) {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" className={className} aria-hidden fill="none" stroke="#9c9082" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h20M17 4l6 6-6 6" />
    </svg>
  )
}
