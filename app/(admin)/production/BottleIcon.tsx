// รูปขวดวาดตามขนาดจริง — ขวดใหญ่สูงกว่าขวดเล็ก ให้ฝ่ายผลิต (อ่านไทยไม่ออก)
// มองแวบเดียวรู้ว่ากำลังกรอกขวดไหน ตัวเลข ml ตัวใหญ่อยู่บนตัวขวด

export default function BottleIcon({ ml }: { ml: number }) {
  // สูงตามปริมาณ: 250ml ≈ 44px · 1000ml ≈ 68px (clamp กันขวดจิ๋ว/ยักษ์เกิน)
  const h = Math.max(40, Math.min(76, 36 + (ml / 1000) * 32))
  const label = ml >= 1000 ? `${ml / 1000}L` : `${ml}`
  return (
    <svg width={Math.round(h * 0.45)} height={h} viewBox="0 0 45 100" aria-hidden>
      {/* ฝา */}
      <rect x="16" y="2" width="13" height="8" rx="2" fill="#9ca3af" />
      {/* คอขวด */}
      <path d="M18 10 h9 v8 c5 4 9 8 9 15 v56 a9 9 0 0 1 -9 9 h-9 a9 9 0 0 1 -9 -9 v-56 c0 -7 4 -11 9 -15 z"
        fill="#fff7ed" stroke="#d1d5db" strokeWidth="2" />
      {/* น้ำส้มในขวด */}
      <path d="M11 40 h23 v49 a7 7 0 0 1 -7 7 h-9 a7 7 0 0 1 -7 -7 z" fill="#fdba74" />
      <text x="22.5" y="72" textAnchor="middle" fontSize="15" fontWeight="700" fill="#7c2d12">
        {label}
      </text>
    </svg>
  )
}
