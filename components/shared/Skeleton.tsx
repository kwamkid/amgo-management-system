// โหลด "เฉพาะส่วน" — มาตรฐานกลางตัวเดียวทั้งระบบ (คู่กับ TechLoader ที่เป็นแบบเต็มหน้า)
//
// กติกาที่ตกลงกับเจ้าของ (13 ส.ค. 69): ตัวโหลดมีแค่ 2 แบบ
//   เต็มหน้า   = TechLoader — เปิดหน้าครั้งแรกเท่านั้น
//   เฉพาะส่วน = Skeleton ตัวนี้ — ทั้งโหลดครั้งแรกของส่วน และโหลดซ้ำ
//               ตอนเปลี่ยนตัวกรอง/เดือน (ห้ามเขียน "กำลังโหลด..." สด ๆ อีก)

export default function Skeleton({
  rows = 5,
  /** true = แถบล้วน ไม่มีการ์ดหุ้ม — ใช้ในพื้นที่ที่มีกรอบของตัวเองอยู่แล้ว (modal/การ์ด) */
  bare = false,
  className = '',
}: {
  rows?: number
  bare?: boolean
  className?: string
}) {
  const lines = (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex gap-4 ${bare ? 'py-2' : 'border-b border-gray-100 p-4 last:border-0'}`}
        >
          <div className="h-4 w-1/4 animate-pulse rounded bg-gray-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </>
  )

  if (bare) return <div className={className}>{lines}</div>
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${className}`}>
      {lines}
    </div>
  )
}
