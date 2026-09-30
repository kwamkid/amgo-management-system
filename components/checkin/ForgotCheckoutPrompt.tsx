'use client'

// ถามเวลาเลิกงานจริงของใบที่ลืมเช็คเอาท์ — เด้งตอนเปิดแอปครั้งถัดไป
//
// ── ทำไมต้องถามตรงนี้ (เจ้าของสั่ง 30 ก.ย. 69) ──────────────────────
// cron 00:05 ปิดกะให้ที่เวลาเลิกงานปกติ ไม่มี OT — "เราจับได้แค่นี้"
// คนที่อยู่ทำงานเลยเวลาจริงจะเสียชั่วโมงไป · จังหวะที่แน่นอนที่สุดคือตอนเขา
// เปิดแอปมาเช็คอินวันถัดไป (บทเรียนใบสลับวันหยุด: รอให้นึกได้เองแล้วเปิดเมนู
// = ไม่มีใครทำ) จึงถามทันทีและต้องตอบก่อน — กดเดียวจบถ้าเลิกตามเวลาปกติ
//
// เวลาที่แจ้งยังไม่แตะชั่วโมง เก็บไว้ให้ HR อนุมัติในหน้าแรกก่อน (ชั่วโมงคือเงิน)

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Clock3 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Modal, TimePicker } from '@/components/aoo'
import {
  claimCheckoutTime,
  getUnansweredForgot,
  type UnansweredForgot,
} from '@/lib/services/checkinService'

const hm = (d: Date) => format(d, 'HH:mm')

export default function ForgotCheckoutPrompt() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [item, setItem] = useState<UnansweredForgot | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!userData?.id) return
    const next = await getUnansweredForgot(userData.id).catch(() => null)
    setItem(next)
    setTime(null)
    setNote('')
  }, [userData?.id])

  useEffect(() => {
    load()
  }, [load])

  if (!item) return null

  /** เวลาที่เลือกเป็นของวันที่เข้างาน — เลือกเวลาก่อนเข้างาน = หลังเที่ยงคืน (กะข้ามคืน) */
  const toDate = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(item.checkinTime)
    d.setHours(h, m, 0, 0)
    if (d <= item.checkinTime) d.setDate(d.getDate() + 1)
    return d
  }

  const submit = async (at: Date) => {
    try {
      setSaving(true)
      await claimCheckoutTime(item.id, at, note)
      showToast('แจ้งเวลาเลิกงานแล้ว รอ HR ตรวจ', 'success')
      await load() // ลืมหลายวัน → ถามใบถัดไปต่อเลย
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const day = format(item.checkinTime, 'EEEEที่ d MMM', { locale: th })

  return (
    <Modal
      open
      // ตอบเท่านั้นถึงจะปิด — แบบเดียวกับ SwapDayPrompt
      onClose={() => {}}
      hideCloseButton
      dismissOnBackdrop={false}
      title={`ลืมเช็คเอาท์ ${day}`}
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg bg-amber-50 p-3">
          <Clock3 size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            เข้างาน {hm(item.checkinTime)} · ระบบปิดกะให้ที่{' '}
            <b>{hm(item.checkoutTime)}</b> (เวลาเลิกงานปกติ ไม่มี OT)
          </p>
        </div>

        <Button
          className="w-full"
          disabled={saving}
          onClick={() => submit(item.checkoutTime)}
        >
          เลิกงาน {hm(item.checkoutTime)} ตามนี้
        </Button>

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">ถ้าเลิกงานเวลาอื่น</p>
          <div className="flex flex-wrap items-center gap-2">
            <TimePicker value={time} onChange={setTime} step={15} placeholder="เลิกงานกี่โมง" />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ทำอะไรเลยเวลา (ไม่บังคับ)"
              className="min-w-0 flex-1"
            />
          </div>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            disabled={saving || !time}
            onClick={() => time && submit(toDate(time))}
          >
            {saving ? 'กำลังส่ง...' : time ? `แจ้งว่าเลิก ${time}` : 'เลือกเวลาก่อน'}
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            HR จะตรวจก่อนแก้ชั่วโมงให้ · ครั้งหน้าอย่าลืมกดเช็คเอาท์ก่อนกลับ
          </p>
        </div>
      </div>
    </Modal>
  )
}
