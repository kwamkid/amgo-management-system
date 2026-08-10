'use client'

// จบการเป็นพนักงาน
//
// ── ทำไมไม่ใช้คำว่า "ระงับการใช้งาน" ──────────────────────────────────
// คำนั้นมาจากตอนที่ระบบมีแค่ธง is_active ตัวเดียว บอกได้แค่ "ล็อกอินไม่ได้"
// แต่ไม่บอกว่าเกิดอะไรขึ้น — ลาออกเอง ให้ออก หรือเกษียณ ก็หน้าตาเหมือนกันหมด
//
// ตอนนี้ employment_status เก็บเหตุผลจริง และ end_date สำคัญมากเพราะ
// attendance_summary ใช้ตัดช่วงเวลาที่ยังเป็นพนักงาน ถ้าไม่ใส่วันสุดท้าย
// คนที่ออกไปแล้วจะถูกนับว่า "ขาดงาน" ทุกวันตลอดไปในรายงาน
// (ฐานข้อมูลบังคับไว้ด้วย constraint ended_needs_end_date)

import { useState } from 'react'
import { Modal, Button, SelectMenu, DatePicker, toIso } from '@/components/aoo'
import { updateUser } from '@/lib/services/userService'
import { useToast } from '@/hooks/useToast'
import type { User } from '@/types/user'

const REASONS = [
  { value: 'resigned', label: 'ลาออก', hint: 'พนักงานยื่นลาออกเอง' },
  { value: 'terminated', label: 'ให้ออก', hint: 'บริษัทเลิกจ้าง' },
  { value: 'retired', label: 'เกษียณ', hint: 'ครบกำหนดเกษียณอายุ' },
]

export default function EndEmploymentDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<string | null>('resigned')
  const [endDate, setEndDate] = useState(toIso(new Date()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const handleSave = async () => {
    if (!status || !endDate) {
      showToast('เลือกเหตุผลและวันสุดท้ายที่ทำงานก่อน', 'error')
      return
    }

    setSaving(true)
    try {
      // is_active ปิดให้เองโดย trigger trg_sync_is_active ไม่ต้องส่งมา
      await updateUser(user.id!, {
        employmentStatus: status,
        endDate,
        endReason: note.trim() || REASONS.find((r) => r.value === status)?.label,
      } as never)

      showToast(`บันทึกแล้ว — ${user.fullName} สิ้นสุดการเป็นพนักงาน`, 'success')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  const selected = REASONS.find((r) => r.value === status)

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="สิ้นสุดการเป็นพนักงาน"
      description={user.fullName}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            ยกเลิก
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">เหตุผล</label>
          <SelectMenu
            size="md"
            value={status}
            options={REASONS.map((r) => ({ value: r.value, label: r.label }))}
            onChange={setStatus}
          />
          {selected && <p className="mt-1.5 text-xs text-gray-500">{selected.hint}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            วันสุดท้ายที่ทำงาน
          </label>
          <DatePicker value={endDate} onChange={setEndDate} />
          <p className="mt-1.5 text-xs text-gray-500">
            รายงานจะนับถึงวันนี้เท่านั้น หลังจากนั้นไม่ถือว่าขาดงาน
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            หมายเหตุ <span className="font-normal text-gray-400">(ไม่บังคับ)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ย้ายไปทำงานที่อื่น"
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-red-400"
          />
        </div>

        <p className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
          พนักงานจะเข้าระบบไม่ได้ตั้งแต่บันทึก แต่ประวัติเช็คอินและใบลาทั้งหมดยังอยู่ครบ
          และยังขึ้นในรายงานย้อนหลังตามปกติ
        </p>
      </div>
    </Modal>
  )
}
