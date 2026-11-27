// โลโก้ธนาคาร + ตัวย่อ (SCB, KBANK …) — ใช้ทุกที่ที่โชว์ธนาคาร (เจ้าของ 27 พ.ย. 69: อยากเห็นโลโก้ ไม่ใช่ชื่อเต็ม)
// BankLogo = รูปอย่างเดียว (ใส่เป็น icon ของ SelectMenu) · BankBadge = รูป + ตัวย่อ

import { getBank } from '@/lib/constants/banks'

export function BankLogo({ bank, size = 20 }: { bank: string | null | undefined; size?: number }) {
  const b = getBank(bank)
  if (!b) return null
  // eslint-disable-next-line @next/next/no-img-element -- svg เล็ก ๆ ใน public ไม่ต้องผ่าน next/image
  return <img src={b.logo} alt={b.code} width={size} height={size} className="shrink-0 rounded" style={{ width: size, height: size }} />
}

export default function BankBadge({ bank, size = 18 }: { bank: string | null | undefined; size?: number }) {
  const b = getBank(bank)
  if (!b) return null
  return (
    <span className="inline-flex items-center gap-1 align-middle" title={b.nameTh}>
      <BankLogo bank={bank} size={size} />
      <span className="text-xs font-semibold text-gray-700">{b.code}</span>
    </span>
  )
}
