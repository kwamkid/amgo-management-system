'use client'

// การ์ด "พื้นที่เก็บรูป" บนหน้ารายงานรูปสต็อก — ใช้ไปเท่าไหร่ของโควตา ใกล้เต็มยัง
// และบอกกติกาไว้ตรง ๆ ว่าเต็มแล้วระบบทำอะไร (ลบเก่าสุดก่อน เหมือนกล้องวงจรปิด)
// เจ้าของขอ 7 ก.ย. 69
import { useEffect, useState } from 'react'
import { HardDrive } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Button, CardTitle, Input, Progress, useConfirm } from '@/components/aoo'
import SectionCard from '@/components/shared/SectionCard'
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
  const { confirm, dialog } = useConfirm()
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
    // เก็บค่าที่พิมพ์ไว้ในตัวแปร — ไม่อ่านจาก ref เพราะช่องถูกถอดออกทันทีที่ปิดกล่อง
    let v = String(u.quotaMb)
    const ok = await confirm({
      title: 'แก้โควตา storage',
      description: 'โควตา storage ของแพลน (MB) — Free = 1024, Pro = 102400',
      children: (
        <Input type="number" defaultValue={v} autoFocus onChange={(e) => { v = e.target.value }} />
      ),
      confirmLabel: 'บันทึก',
      tone: 'primary',
    })
    if (!ok || !v) return
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
  const tone = u.pct > HIGH_WATER ? 'danger' : u.pct > LOW_WATER ? 'warning' : 'success'
  const footage = u.buckets.filter((b) => ['checkin-photos', 'delivery-photos', 'stock-photos'].includes(b.bucket))
  const otherBytes = u.totalBytes - u.footageBytes

  return (
    <SectionCard>
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle icon={HardDrive} tone="sky">พื้นที่เก็บรูป</CardTitle>
        <p className="text-sm text-gray-700">
          <span className="font-semibold tabular-nums text-gray-900">{formatMb(u.totalBytes)}</span>
          {' / '}
          {formatMb(u.quotaMb * 1048576)} · ใช้ไป {pct}%
          {canEditQuota && (
            <Button variant="link" size="sm" icon="Pencil" onClick={editQuota} className="ml-2" title="แก้โควตา (เมื่ออัปเกรดแพลน)">
              โควตา
            </Button>
          )}
        </p>
      </div>

      <div className="relative mt-3">
        <Progress value={Math.min(100, pct)} tone={tone} aria-label="พื้นที่ที่ใช้ไป" />
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
          <span className="font-medium text-[var(--ruby-700)]">ใกล้เต็ม — คืนนี้ระบบจะลบรูปเก่าสุดจนเหลือ {Math.round(LOW_WATER * 100)}%</span>
        ) : (
          <>เก็บรูป 60 วัน · ถ้าใช้เกิน {Math.round(HIGH_WATER * 100)}% ระบบลบรูปเก่าสุดก่อนจนเหลือ {Math.round(LOW_WATER * 100)}% (เหมือนกล้องวงจรปิด)</>
        )}
        {u.oldestFootage && <> · รูปเก่าสุดตอนนี้ {new Date(u.oldestFootage).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</>}
      </p>
    </SectionCard>
  )
}
