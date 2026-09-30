'use client'

// ใบสลับวันหยุด — พนักงานยื่นเอง
//
// "วันหยุดวันนี้ขอมาทำงาน แล้วไปหยุดวันอื่นแทน" เกิดเดือนละ ~15 ครั้ง
// ทั้ง PC หน้าร้านและพนักงานทั่วไป — ของเดิมไม่มีใบ รายงานหักลบให้เงียบ ๆ
//
// ยื่นย้อนหลังได้ (ทำงานวันหยุดไปแล้วค่อยมายื่น) แต่ต้องรู้ทั้งสองวันตอนยื่น
// และทั้งคู่ต้องอยู่งวดจ่ายเดียวกัน — กติกาเจ้าของ 16 ส.ค. 69

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarSync } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, DatePicker, Modal, Input, EmptyState, Field } from '@/components/aoo'
import { PageHeader, SectionCard, Skeleton, StatusBadge, ListRow, ListRows } from '@/components/shared'
import {
  createSwap,
  cancelSwap,
  listMySwaps,
  type ScheduleSwap,
} from '@/lib/services/scheduleSwapService'

const thaiDate = (iso: string) =>
  format(new Date(`${iso}T00:00:00`), 'EEEE d MMM yyyy', { locale: th })

// สถานะใช้คำแปลกลางของ StatusBadge (pending/approved/rejected/cancelled มีอยู่แล้ว)

export default function SchedulSwapPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [rows, setRows] = useState<ScheduleSwap[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [workedDate, setWorkedDate] = useState('')
  const [offDate, setOffDate] = useState('')
  const [reason, setReason] = useState('')

  const reload = useCallback(async () => {
    if (!userData?.id) return
    try {
      setLoading(true)
      setRows(await listMySwaps(userData.id))
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id])

  useEffect(() => {
    reload()
  }, [reload])

  const submit = async () => {
    if (!workedDate || !offDate) {
      showToast('เลือกทั้งวันที่มาทำงานและวันที่ไปหยุดแทน', 'error')
      return
    }
    try {
      setSaving(true)
      await createSwap({
        userId: userData!.id!,
        userName: userData!.displayName || userData!.fullName || '',
        workedDate: new Date(`${workedDate}T00:00:00`),
        offDate: new Date(`${offDate}T00:00:00`),
        reason,
      })
      showToast('ยื่นใบสลับวันหยุดแล้ว รอ HR อนุมัติ', 'success')
      setOpen(false)
      setWorkedDate('')
      setOffDate('')
      setReason('')
      reload()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await cancelSwap(id)
      showToast('ยกเลิกใบแล้ว', 'success')
      reload()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="สลับวันหยุด"
        description="วันหยุดของคุณขอมาทำงาน แล้วไปหยุดวันอื่นแทน"
        icon={CalendarSync}
        actions={
          <Button size="sm" icon="Plus" onClick={() => setOpen(true)}>
            ยื่นใบสลับวันหยุด
          </Button>
        }
      />

      <SectionCard title="ใบของคุณ">
        {loading ? (
          <Skeleton rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CalendarSync size={28} />}
            title="ยังไม่มีใบสลับวันหยุด"
            body="ถ้ามาทำงานในวันหยุดของตัวเอง ยื่นใบไว้เพื่อไปหยุดวันอื่นแทน — ยื่นย้อนหลังได้"
          />
        ) : (
          <ListRows variant="divided">
            {rows.map((s) => (
              <ListRow
                key={s.id}
                title={
                  <span className="whitespace-normal text-sm font-normal">
                    <span className="text-gray-500">มาทำงาน</span>{' '}
                    <span className="font-medium">{thaiDate(s.workedDate)}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="text-gray-500">ไปหยุด</span>{' '}
                    <span className="font-medium">{thaiDate(s.offDate)}</span>
                  </span>
                }
                meta={
                  (s.reason || s.rejectedReason) && (
                    <>
                      {s.reason && <p className="text-xs">{s.reason}</p>}
                      {s.rejectedReason && (
                        <p className="text-xs text-red-600">เหตุผล: {s.rejectedReason}</p>
                      )}
                    </>
                  )
                }
                trailing={
                  <>
                    <StatusBadge status={s.status} />
                    {(s.status === 'pending' || s.status === 'approved') && (
                      <Button variant="ghost" size="sm" icon="X" onClick={() => cancel(s.id)}>
                        ยกเลิก
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </ListRows>
        )}
      </SectionCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ยื่นใบสลับวันหยุด"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={submit} loading={saving}>
              {saving ? 'กำลังยื่น...' : 'ยื่นใบ'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="วันหยุดที่มาทำงาน" help="ต้องเป็นวันหยุดประจำของคุณ · ทำงานไปแล้วค่อยมายื่นก็ได้" asDiv>
            <DatePicker value={workedDate} onChange={setWorkedDate} />
          </Field>
          <Field label="วันที่ขอไปหยุดแทน" help="ต้องเป็นวันทำงานปกติ และอยู่ในงวดจ่ายเงินเดือนเดียวกันกับวันบน" asDiv>
            <DatePicker value={offDate} onChange={setOffDate} />
          </Field>
          <Field label="เหตุผล">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ไปออกบูธงาน รพ."
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
