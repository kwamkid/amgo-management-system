'use client'

// ถามวันหยุดชดเชยทันทีหลังเช็คอินตรงวันหยุดของตัวเอง
//
// ── ทำไมต้องถามตรงนี้ (เจ้าของทัก 16 ส.ค. 69) ──────────────────────
// ของจริงคือ "เค้าไปทำงานก่อน แล้วกดเช็คอิน แล้วมันค่อยขึ้นว่าวันหยุดเค้า"
// จังหวะที่เพิ่งกดเช็คอินเสร็จคือจังหวะเดียวที่เขาคิดเรื่องนี้อยู่ — พ้นไปแล้ว
// ไม่มีใครเดินไปเปิดเมนูกรอกใบเอง (schedule_exceptions มี UI ให้กรอกมาตลอด
// แต่มี 0 แถวมาทั้งปี)
//
// **ข้ามไม่ได้** (เจ้าของสั่ง 16 ส.ค. 69): "ถ้าทำแทนแล้ว แปลว่าเค้าต้องมีแพลนแล้ว
// ว่าเค้าจะแทนวันไหน ให้เค้าเลือกเลย" — ปิดพื้นหลัง/Esc/ปุ่ม × ไม่ได้ทั้งหมด
// และถ้า refresh หนี useCheckIn จะตรวจเจอแล้วเด้งซ้ำ (ดู fetchCurrentStatus)

import { useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarSync } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, DatePicker, Input, Modal } from '@/components/aoo'
import { createSwap } from '@/lib/services/scheduleSwapService'

export default function SwapDayPrompt({
  workedDate,
  onDone,
}: {
  workedDate: Date
  /** ยื่นสำเร็จแล้วเท่านั้น — ไม่มีทางออกทางอื่น */
  onDone: () => void
}) {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [offDate, setOffDate] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!offDate) {
      showToast('เลือกวันที่จะไปหยุดแทน', 'error')
      return
    }
    try {
      setSaving(true)
      await createSwap({
        userId: userData!.id!,
        userName: userData!.displayName || userData!.fullName || '',
        workedDate,
        offDate: new Date(`${offDate}T00:00:00`),
        reason,
      })
      showToast('ยื่นใบสลับวันหยุดแล้ว รอ HR อนุมัติ', 'success')
      onDone()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      // ตอบเท่านั้นถึงจะปิด — ปิดทางหนีทุกทาง
      onClose={() => {}}
      hideCloseButton
      dismissOnBackdrop={false}
      title="วันนี้เป็นวันหยุดของคุณ"
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg bg-amber-50 p-3">
          <CalendarSync size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            {format(workedDate, 'EEEEที่ d MMMM', { locale: th })} เป็นวันหยุดประจำของคุณ
            แต่คุณมาทำงาน — เลือกวันที่จะไปหยุดแทนได้เลย
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            จะไปหยุดวันไหนแทน
          </label>
          <DatePicker value={offDate} onChange={setOffDate} />
          <p className="mt-1 text-xs text-gray-500">
            ต้องเป็นวันทำงานปกติ และอยู่ในงวดจ่ายเงินเดือนเดียวกันกับวันนี้
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            เหตุผล <span className="font-normal text-gray-400">(ไม่บังคับ)</span>
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น ไปออกบูธงาน รพ."
          />
        </div>

        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? 'กำลังยื่น...' : 'ยื่นใบสลับวันหยุด'}
        </Button>
      </div>
    </Modal>
  )
}
