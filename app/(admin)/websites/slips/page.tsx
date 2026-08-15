'use client'

// AOO Website — สลิปที่เจ้าของเว็บอัพเข้ามา รอตรวจ
// อนุมัติ = บิลกลายเป็น "จ่ายแล้ว" · ปฏิเสธ = กลับไปให้เขาอัพใหม่

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Receipt, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Modal } from '@/components/aoo'
import { PageHeader, SectionCard, TechLoader } from '@/components/shared'
import { getSlips, reviewSlip, slipUrl, type WebSlip } from '@/lib/services/web/webService'

const fmt = (d: string) =>
  new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function WebSlipsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [slips, setSlips] = useState<WebSlip[] | null>(null)
  const [view, setViewImg] = useState<string | null>(null)

  const canSee = !!userData && !!userData.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () => {
    getSlips(true)
      .then(setSlips)
      .catch((e) => showToast(e.message, 'error'))
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  const review = async (billId: string, approve: boolean) => {
    try {
      await reviewSlip(billId, approve)
      showToast(approve ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว', 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const open = async (path: string) => {
    try {
      setViewImg(await slipUrl(path))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  if (!canSee || !slips) return <TechLoader />

  return (
    <div>
      <PageHeader
        backHref="/websites"
        title="สลิปรอตรวจ"
        description="สลิปที่เจ้าของเว็บอัพเข้ามา — อนุมัติแล้วบิลจะเป็นจ่ายแล้ว"
        icon={Receipt}
      />

      {slips.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-gray-400">ไม่มีสลิปรอตรวจ</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slips.map((s) => (
            <SectionCard key={s.id}>
              <button onClick={() => open(s.slipImageUrl)} className="mb-3 w-full text-left">
                <p className="font-medium text-gray-900">{s.siteName}</p>
                <p className="text-xs text-gray-400">
                  บิลปี {s.billYear} · อัพเมื่อ {fmt(s.uploadedAt)}
                </p>
              </button>

              {s.verifyResult === 'duplicate' && (
                <p className="mb-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
                  สลิปซ้ำ — เลขอ้างอิงนี้เคยใช้แล้ว
                </p>
              )}
              {s.verifyResult === 'unreadable' && (
                <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  อ่าน QR ไม่ออก — ต้องดูรูปเอง
                </p>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => open(s.slipImageUrl)}>
                  ดูสลิป
                </Button>
                <Button size="sm" onClick={() => review(s.billId, true)}>
                  <Check size={14} />
                  อนุมัติ
                </Button>
                <Button size="sm" variant="ghost" onClick={() => review(s.billId, false)}>
                  <X size={14} />
                  ปฏิเสธ
                </Button>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {view && (
        <Modal open onClose={() => setViewImg(null)} title="สลิปโอนเงิน">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view} alt="สลิป" className="mx-auto max-h-[70vh] rounded-lg" />
        </Modal>
      )}
    </div>
  )
}
