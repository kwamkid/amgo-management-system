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
import { Modal, Button, SelectMenu, DatePicker, toIso, Field, Input } from '@/components/aoo'
import { InfoPanel } from '@/components/shared'
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
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="เหตุผล" help={selected?.hint} asDiv>
          <SelectMenu
            size="md"
            value={status}
            options={REASONS.map((r) => ({ value: r.value, label: r.label }))}
            onChange={setStatus}
          />
        </Field>

        <Field
          label="วันสุดท้ายที่ทำงาน"
          help="รายงานจะนับถึงวันนี้เท่านั้น หลังจากนั้นไม่ถือว่าขาดงาน"
          asDiv
        >
          <DatePicker value={endDate} onChange={setEndDate} />
        </Field>

        <Field label="หมายเหตุ (ไม่บังคับ)">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ย้ายไปทำงานที่อื่น"
          />
        </Field>

        <InfoPanel className="text-xs leading-relaxed text-gray-600">
          พนักงานจะเข้าระบบไม่ได้ตั้งแต่บันทึก แต่ประวัติเช็คอินและใบลาทั้งหมดยังอยู่ครบ
          และยังขึ้นในรายงานย้อนหลังตามปกติ
        </InfoPanel>
      </div>
    </Modal>
  )
}
