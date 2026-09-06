'use client'

// การ์ด "พื้นที่เก็บรูป" บนหน้ารายงานรูปสต็อก — ใช้ไปเท่าไหร่ของโควตา ใกล้เต็มยัง
// และบอกกติกาไว้ตรง ๆ ว่าเต็มแล้วระบบทำอะไร (ลบเก่าสุดก่อน เหมือนกล้องวงจรปิด)
// เจ้าของขอ 7 ก.ย. 69
import { useEffect, useState } from 'react'
import { HardDrive, Pencil } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatMb, HIGH_WATER, LOW_WATER } from '@/lib/services/storageCapRules'
import type { StorageUsage } from '@/lib/services/storageUsageService'

const LABEL: Record<string, string> = {
  'checkin-photos': 'เซลฟี่เช็คอิน',
  'delivery-photos': 'ส่งของ',
  'stock-photos': 'สต็อก/หน้าร้าน',
  'srp-images': 'รูปสินค้า SRP',
  avatars: 'รูปโปรไฟล์',
  'web-slips': 'สลิป',
  'company-logos': 'โลโก้',
}

export default function StorageStatusCard({ canEditQuota = false }: { canEditQuota?: boolean }) {
  const { showToast } = useToast()
  const [u, setU] = useState<StorageUsage | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    fetch('/api/storage/usage')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setU)
      .catch(() => setHidden(true)) // ไม่มีสิทธิ์/พัง — ไม่ต้องโชว์อะไร
  }, [])

  const editQuota = async () => {
    if (!u) return
    const v = window.prompt('โควตา storage ของแพลน (MB) — Free = 1024, Pro = 102400', String(u.quotaMb))
    if (!v) return
    const res = await fetch('/api/storage/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quotaMb: Number(v) }),
    })
    if (!res.ok) {
      showToast((await res.json().catch(() => ({})))?.error ?? 'บันทึกไม่สำเร็จ', 'error')
      return
    }
    setU(await res.json())
    showToast('บันทึกโควตาแล้ว')
  }

  if (hidden || !u) return null

  const pct = Math.round(u.pct * 1000) / 10
  const tone = u.pct > HIGH_WATER ? 'bg-red-500' : u.pct > LOW_WATER ? 'bg-amber-500' : 'bg-teal-500'
  const footage = u.buckets.filter((b) => ['checkin-photos', 'delivery-photos', 'stock-photos'].includes(b.bucket))
  const otherBytes = u.totalBytes - u.footageBytes

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <HardDrive size={18} className="text-gray-400" /> พื้นที่เก็บรูป
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-semibold tabular-nums text-gray-900">{formatMb(u.totalBytes)}</span>
          {' / '}
          {formatMb(u.quotaMb * 1048576)} · ใช้ไป {pct}%
          {canEditQuota && (
            <button type="button" onClick={editQuota} className="ml-2 inline-flex items-center gap-1 text-gray-400 hover:text-gray-700" title="แก้โควตา (เมื่ออัปเกรดแพลน)">
              <Pencil size={13} /> โควตา
            </button>
          )}
        </p>
      </div>

      <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
        {/* เส้น 85% = จุดที่เริ่มลบรูปเก่าสุด */}
        <div className="absolute inset-y-0 w-px bg-gray-400" style={{ left: `${HIGH_WATER * 100}%` }} title="เกินเส้นนี้ ระบบเริ่มลบรูปเก่าสุด" />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        {footage.map((b) => (
          <span key={b.bucket}>
            {LABEL[b.bucket] ?? b.bucket} <span className="tabular-nums text-gray-900">{formatMb(b.bytes)}</span>
            <span className="text-gray-400"> · {b.files} ไฟล์</span>
          </span>
        ))}
        <span>
          อื่น ๆ (โลโก้ · โปรไฟล์ · SRP · สลิป) <span className="tabular-nums text-gray-900">{formatMb(otherBytes)}</span>
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-500">
        {u.over ? (
          <span className="font-medium text-red-600">ใกล้เต็ม — คืนนี้ระบบจะลบรูปเก่าสุดจนเหลือ {Math.round(LOW_WATER * 100)}%</span>
        ) : (
          <>เก็บรูป 60 วัน · ถ้าใช้เกิน {Math.round(HIGH_WATER * 100)}% ระบบลบรูปเก่าสุดก่อนจนเหลือ {Math.round(LOW_WATER * 100)}% (เหมือนกล้องวงจรปิด)</>
        )}
        {u.oldestFootage && <> · รูปเก่าสุดตอนนี้ {new Date(u.oldestFootage).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</>}
      </p>
    </div>
  )
}
