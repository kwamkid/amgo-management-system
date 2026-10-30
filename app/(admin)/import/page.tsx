'use client'

// สั่งของนำเข้า — หน้าแผนสั่งของ ยกมาจากหน้า order-plan ในเครื่องเจ้าของทั้งหน้า (29 ต.ค. 69)
// เจ้าของ: "copy หน้าตามาเลย เอาเหมือนที่ทำอยู่เป๊ะๆ" → ไม่ทำใหม่เป็น React แต่ฝังไฟล์เดิม
// (public/order-plan/index.html) ไว้ในกรอบเต็มพื้นที่ใต้แถบบน · ข้อมูลผ่าน /api/import/* (เช็คสิทธิ์ทุกครั้ง)
// รอบที่เปิดอยู่เก็บใน hash ของหน้านี้ (/import#p=C1-hape) — refresh / ส่งลิงก์แล้วเปิดรอบเดิม
//
// หัวหน้า (30 ต.ค. 69 เจ้าของ: "ตัวเล็กมองไม่เห็น ใช้ class กลาง") — สถานะ · อัตรา · เฉพาะที่สั่ง · ลิงก์ SRP · พิมพ์
// วาดที่นี่ด้วยคอมโพเนนต์กลาง กรอบซ่อนหัวของตัวเอง แล้วคุยกันด้วย postMessage:
//   กรอบ → หน้านี้  {src:'order-plan', type:'header', round, title, logos, status, fx, currency, onlyOrdered,
//                    canEdit, seeCost, srpLink, srpError, save, saveError, legend[{label,color}]}
//   หน้านี้ → กรอบ  {src:'amgo-import', cmd:'setStatus'|'setFx'|'setOnly'|'print'|'hello', value?}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, FilePen, Printer, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { FilterBar, PageHeader, TechLoader } from '@/components/shared'
import { Button, Checkbox, Input, StepSelect, type StepSelectOption } from '@/components/aoo'

type Header = {
  round: boolean
  title?: string
  logos?: string[]
  status?: string
  fx?: number
  currency?: string
  onlyOrdered?: boolean
  canEdit?: boolean
  seeCost?: boolean
  srpLink?: string
  srpError?: string
  save?: string
  saveError?: boolean
  legend?: { label: string; color: string }[]
}

// ตรงกับ STATUS ในกรอบ — ร่าง → อนุมัติ → ส่งแล้ว เดินไปข้างหน้า
const STATUS_STEPS: StepSelectOption[] = [
  { value: 'draft', label: 'ร่าง', icon: FilePen, tone: 'warning' },
  { value: 'approved', label: 'อนุมัติแล้ว', icon: CheckCircle2, tone: 'sky' },
  { value: 'sent', label: 'ส่งแล้ว', icon: Send, tone: 'success' },
]
const SYM: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', RMB: '¥', CNY: '¥' }

export default function ImportPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const [src, setSrc] = useState<string | null>(null)
  const [hdr, setHdr] = useState<Header | null>(null)
  const [fxText, setFxText] = useState('')
  const frameRef = useRef<HTMLIFrameElement>(null)
  const fxRef = useRef<HTMLInputElement>(null)

  const canSee = !!userData?.importAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  // อ่าน hash ครั้งเดียวตอนเปิด — หลังจากนั้นกรอบเป็นคนเปลี่ยนเอง
  useEffect(() => {
    setSrc(`/order-plan/index.html${window.location.hash}`)
  }, [])

  const send = useCallback((cmd: string, value?: unknown) => {
    frameRef.current?.contentWindow?.postMessage({ src: 'amgo-import', cmd, value }, window.location.origin)
  }, [])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const d = e.data as ({ orderPlanHash?: string; title?: string } & Partial<Header> & { src?: string; type?: string }) | null
      if (!d) return
      if (d.src === 'order-plan' && d.type === 'header') {
        setHdr(d as Header)
        // ไม่ทับตอนกำลังพิมพ์อัตราอยู่
        if (typeof d.fx === 'number' && document.activeElement !== fxRef.current) setFxText(String(d.fx))
        return
      }
      if (typeof d.orderPlanHash !== 'string') return
      window.history.replaceState(null, '', `/import${d.orderPlanHash}`)
      if (d.title) document.title = d.title
    }
    // เปลี่ยน hash จากแถบที่อยู่ / ปุ่มย้อนกลับ → ส่งต่อเข้ากรอบ
    const onHash = () => {
      const w = frameRef.current?.contentWindow
      if (w && w.location.hash !== window.location.hash) w.location.hash = window.location.hash
    }
    window.addEventListener('message', onMsg)
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('message', onMsg)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  if (!canSee || !src) return <TechLoader />

  const round = !!hdr?.round
  const canEdit = hdr?.canEdit !== false
  const seeCost = hdr?.seeCost !== false
  const cur = hdr?.currency ?? 'USD'

  const title = round ? (
    <>
      {hdr?.logos?.map((u) => (
        // eslint-disable-next-line @next/next/no-img-element -- โลโก้จาก SRP Calculator (URL ภายนอก)
        <img key={u} src={u} alt="" className="mr-2 inline-block h-8 w-auto align-middle" />
      ))}
      <span className="align-middle">{hdr?.title}</span>
    </>
  ) : hdr ? (
    'แผนสั่งของ — ทุกแบรนด์'
  ) : (
    'แผนสั่งของ'
  )

  // ลบ padding ของ <main> ให้กรอบชิดขอบ · สูงเต็มจอลบแถบบน (h-14) · หัวอยู่บน กรอบกินที่เหลือ
  return (
    <div className="-mx-4 -mb-10 -mt-5 flex h-[calc(100dvh-3.5rem)] flex-col lg:-mx-7">
      <div className="shrink-0 px-4 pt-5 lg:px-7">
        <PageHeader
          title={title}
          description={round && hdr?.save ? hdr.save : undefined}
          onBack={round ? () => { window.location.hash = '' } : undefined}
          actions={
            round ? (
              <Button variant="secondary" icon={Printer} onClick={() => send('print')} title="รายการที่สั่ง · A4 · บันทึกเป็น PDF ได้จากหน้าพิมพ์">
                พิมพ์ / PDF
              </Button>
            ) : undefined
          }
        />

        {round && (
          <FilterBar
            sticky={false}
            lead={
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="w-full sm:w-[380px]">
                    <StepSelect
                      aria-label="สถานะ"
                      value={hdr?.status ?? 'draft'}
                      options={STATUS_STEPS}
                      disabled={!canEdit}
                      onChange={(v) => send('setStatus', v)}
                    />
                  </div>

                  {seeCost && (
                    <div className="w-[190px]">
                      <Input
                        ref={fxRef}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`อัตรา ฿/${cur}`}
                        prefix={<span className="whitespace-nowrap text-sm">อัตรา ฿/{SYM[cur] ?? cur}</span>}
                        value={fxText}
                        disabled={!canEdit}
                        onChange={(e) => {
                          setFxText(e.target.value)
                          send('setFx', e.target.value)
                        }}
                      />
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center gap-2 text-base">
                    <Checkbox checked={!!hdr?.onlyOrdered} size={18} onChange={(v) => send('setOnly', v)} />
                    เฉพาะที่สั่ง
                  </label>

                  <Button
                    variant={hdr?.srpError ? 'danger' : 'ghost'}
                    iconRight={ExternalLink}
                    onClick={() => window.open(hdr?.srpLink || '/srp', '_blank', 'noopener')}
                  >
                    {hdr?.srpError || 'แก้ราคาขาย (SRP Calculator)'}
                  </Button>
                </div>

                {!!hdr?.legend?.length && (
                  // มือถือซ่อน — หัวคอลัมน์ในตารางบอกอยู่แล้ว
                  <div className="hidden md:block">
                    <div className="aoo-legend aoo-legend--md">
                      {hdr.legend.map((l) => (
                        <span key={l.label} className="aoo-legend__item">
                          {/* สีมาจากตัวแปรสีคอลัมน์ในกรอบ — ค่าเปลี่ยนตามกรอบ จึงส่งเป็นตัวแปร */}
                          <i className="aoo-legend__swatch" style={{ ['--swatch' as string]: l.color }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
          />
        )}
      </div>

      <iframe
        ref={frameRef}
        data-order-plan
        src={src}
        title="แผนสั่งของ"
        className="block min-h-0 w-full flex-1 border-0"
        onLoad={() => send('hello')}
      />
    </div>
  )
}
