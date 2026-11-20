'use client'

// คิวตรวจใบลืมเช็คเอาท์ของ HR — ใช้ทั้งหน้าแรก (HrInbox) และหน้า /checkin/pending
//
// ใบที่พนักงานแจ้งเวลามาแล้วขึ้นก่อน (RPC hr_inbox เรียงให้) — กดอนุมัติทีเดียวจบ
// ใบที่ยังไม่แจ้ง: ยืนยันตามเวลาที่ระบบปิดให้ หรือ HR ใส่เวลาเอง

import { useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, TimePicker } from '@/components/aoo'
import {
  confirmSystemCheckout,
  setCheckoutTime,
  type ForgotItem,
} from '@/lib/services/hrInboxService'

const hm = (iso: string | null) => (iso ? format(new Date(iso), 'HH:mm') : '-')
const day = (iso: string) => format(new Date(`${iso}T00:00:00`), 'EEE d MMM', { locale: th })

export default function ForgotReviewList({
  items,
  onChanged,
}: {
  items: ForgotItem[]
  onChanged: () => void
}) {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)

  const by = { id: userData?.id ?? '', name: userData?.displayName || userData?.fullName || 'HR' }

  const run = async (id: string, fn: () => Promise<void>, done: string) => {
    try {
      setBusy(id)
      await fn()
      showToast(done, 'success')
      setEditing(null)
      setTime(null)
      onChanged()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  /** เวลาบนวันที่เข้างาน — เลือกเวลาก่อนเข้างาน = หลังเที่ยงคืน */
  const onDay = (item: ForgotItem, hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const cin = new Date(item.checkin_time)
    const d = new Date(cin)
    d.setHours(h, m, 0, 0)
    if (d <= cin) d.setDate(d.getDate() + 1)
    return d
  }

  return (
    // @container: in a narrow card (dashboard half column, phone) the buttons sit on their own
    // line under the name; on a wide page they move to the right. The old single flex-wrap row
    // pushed name/date onto 3–4 lines (owner, 20 Nov 2026).
    <div className="@container divide-y divide-gray-100">
      {items.map((it) => {
        const claimed = !!it.claimed_checkout_time
        return (
          <div key={it.id} className="flex flex-col gap-2 py-3 @xl:flex-row @xl:items-center @xl:gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {it.name} <span className="font-normal text-gray-500">· {day(it.work_date)}</span>
              </p>
              <p className="text-xs text-gray-500">
                เข้า {hm(it.checkin_time)} · ระบบปิดให้ {hm(it.checkout_time)} ·{' '}
                {claimed ? (
                  <>
                    <span className="font-semibold text-[var(--grape-700)]">
                      แจ้งว่าเลิก {hm(it.claimed_checkout_time)}
                    </span>
                    {it.claim_note && <span className="text-gray-600"> — {it.claim_note}</span>}
                  </>
                ) : (
                  'ยังไม่แจ้งเวลา'
                )}
              </p>
            </div>

            {editing === it.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <TimePicker value={time} onChange={setTime} step={15} size="sm" placeholder="เวลาเลิก" />
                <Button
                  size="sm"
                  disabled={!time || busy === it.id}
                  onClick={() =>
                    time &&
                    run(
                      it.id,
                      () => setCheckoutTime(it, onDay(it, time), by, `HR แก้เวลาเลิกงานเป็น ${time}`),
                      'แก้เวลาเลิกงานแล้ว'
                    )
                  }
                >
                  บันทึก
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  ยกเลิก
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {claimed && (
                  <Button
                    size="sm"
                    disabled={busy === it.id}
                    onClick={() =>
                      run(
                        it.id,
                        () =>
                          setCheckoutTime(
                            it,
                            new Date(it.claimed_checkout_time!),
                            by,
                            `อนุมัติเวลาที่พนักงานแจ้ง ${hm(it.claimed_checkout_time)}${it.claim_note ? ` — ${it.claim_note}` : ''}`
                          ),
                        'อนุมัติแล้ว คิดชั่วโมงใหม่ให้แล้ว'
                      )
                    }
                  >
                    อนุมัติ {hm(it.claimed_checkout_time)}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={claimed ? 'ghost' : 'secondary'}
                  disabled={busy === it.id}
                  onClick={() =>
                    run(it.id, () => confirmSystemCheckout(it, by), 'ยืนยันตามเวลาที่ระบบปิดให้แล้ว')
                  }
                >
                  ใช้ {hm(it.checkout_time)}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(it.id)}>
                  แก้เวลา
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
