'use client'

// components/users/WorkScheduleCard.tsx
//
// ตารางวันทำงานรายคน — วันหยุดประจำ + สลับวันหยุดรายวัน (HR เท่านั้น RLS คุมอีกชั้น)
// จำนวนวัน/วันหยุดประจำ แก้ค้างไว้ก่อน แล้วต้องกด "บันทึก" ถึงจะเขียนจริง (เจ้าของสั่ง
// ห้าม auto save) — ส่วนสลับวันหยุดเป็นรายการเพิ่ม/ลบ มีปุ่ม "เพิ่ม" ของมันเองอยู่แล้ว
//
// ลำดับที่ระบบใช้ตัดสินว่าวันไหนต้องมาทำงาน (expected_work_mode):
//   สลับรายวัน (schedule_exceptions) > วันหยุดประจำรายคน (user_work_schedules)
//   > ตารางของตำแหน่ง > จ–ศ
// ถ้ามาเช็คอินตรงวันหยุดประจำ รายงานถือว่า "เลื่อนไปหยุดวันอื่น" — ไม่นับขาดเพิ่ม

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'

const DAYS = [
  { dow: 0, label: 'อา.' },
  { dow: 1, label: 'จ.' },
  { dow: 2, label: 'อ.' },
  { dow: 3, label: 'พ.' },
  { dow: 4, label: 'พฤ.' },
  { dow: 5, label: 'ศ.' },
  { dow: 6, label: 'ส.' },
]

interface ExceptionRow {
  id: string
  exception_date: string
  work_mode: string
  note: string | null
}

export default function WorkScheduleCard({
  userId,
  title = 'ตารางวันทำงาน',
  showExceptions = true,
  onCancel,
  onSaved,
}: {
  userId: string
  title?: string
  /** ซ่อนส่วนสลับวันหยุดรายวัน — ใน popup เอาไว้เฉพาะของที่แก้บ่อย */
  showExceptions?: boolean
  /** มีเมื่ออยู่ใน dialog — โชว์ปุ่มยกเลิกคู่กับปุ่มบันทึก */
  onCancel?: () => void
  /** เรียกหลังบันทึกสำเร็จ */
  onSaved?: () => void
}) {
  const { userData } = useAuth()
  const { showToast } = useToast()

  // ค่าที่กำลังแก้ (ยังไม่เขียนจริง) + ค่าเดิมจากฐานข้อมูลไว้เทียบว่าแก้อะไรไปบ้าง
  const [offDays, setOffDays] = useState<Set<number>>(new Set())
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)
  const [origOffDays, setOrigOffDays] = useState<Set<number>>(new Set())
  const [origDaysPerWeek, setOrigDaysPerWeek] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [loading, setLoading] = useState(true)

  const dirty =
    daysPerWeek !== origDaysPerWeek ||
    offDays.size !== origOffDays.size ||
    [...offDays].some((d) => !origOffDays.has(d))

  const [exDate, setExDate] = useState('')
  const [exMode, setExMode] = useState<'off' | 'onsite'>('off')
  const [exNote, setExNote] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const sb = createClient()
    const [sched, ex, usr] = await Promise.all([
      sb.from('user_work_schedules').select('day_of_week, work_mode').eq('user_id', userId),
      sb
        .from('schedule_exceptions')
        .select('id, exception_date, work_mode, note')
        .eq('user_id', userId)
        .order('exception_date', { ascending: false })
        .limit(20),
      sb.from('users').select('days_per_week').eq('id', userId).single(),
    ])
    const off = new Set<number>(
      (sched.data ?? []).filter((r) => r.work_mode === 'off').map((r) => r.day_of_week)
    )
    setOffDays(new Set(off))
    setOrigOffDays(off)
    setExceptions((ex.data as ExceptionRow[]) ?? [])
    setDaysPerWeek(usr.data?.days_per_week ?? null)
    setOrigDaysPerWeek(usr.data?.days_per_week ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // แก้ค้างไว้ในหน้าก่อน — ยังไม่เขียนจริงจนกว่าจะกดบันทึก
  const toggleDay = (dow: number) => {
    setOffDays((prev) => {
      const next = new Set(prev)
      if (next.has(dow)) next.delete(dow)
      else next.add(dow)
      return next
    })
  }

  /** เขียนเฉพาะส่วนที่แก้: จำนวนวัน/สัปดาห์ + วันหยุดประจำที่เพิ่ม/เอาออก */
  const save = async () => {
    const sb = createClient()
    setSaving(true)
    try {
      if (daysPerWeek !== origDaysPerWeek) {
        const { error } = await sb
          .from('users')
          .update({ days_per_week: daysPerWeek })
          .eq('id', userId)
        if (error) throw error
      }
      const removed = [...origOffDays].filter((d) => !offDays.has(d))
      const added = [...offDays].filter((d) => !origOffDays.has(d))
      if (removed.length) {
        const { error } = await sb
          .from('user_work_schedules')
          .delete()
          .eq('user_id', userId)
          .in('day_of_week', removed)
        if (error) throw error
      }
      if (added.length) {
        const { error } = await sb.from('user_work_schedules').upsert(
          added.map((d) => ({
            user_id: userId,
            day_of_week: d,
            work_mode: 'off',
            note: 'วันหยุดประจำ',
          })),
          { onConflict: 'user_id,day_of_week' }
        )
        if (error) throw error
      }
      setOrigOffDays(new Set(offDays))
      setOrigDaysPerWeek(daysPerWeek)
      showToast('บันทึกตารางวันทำงานแล้ว', 'success')
      onSaved?.()
    } catch (e) {
      showToast(`บันทึกไม่สำเร็จ: ${(e as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const addException = async () => {
    if (!exDate) return
    setAdding(true)
    const { error } = await createClient().from('schedule_exceptions').upsert(
      {
        user_id: userId,
        exception_date: exDate,
        work_mode: exMode,
        note: exNote.trim() || (exMode === 'off' ? 'สลับมาหยุดวันนี้' : 'สลับมาทำงานวันนี้'),
        created_by: userData?.id ?? null,
      },
      { onConflict: 'user_id,exception_date' }
    )
    setAdding(false)
    if (error) {
      showToast(`บันทึกไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    setExDate('')
    setExNote('')
    load()
  }

  const removeException = async (id: string) => {
    const { error } = await createClient().from('schedule_exceptions').delete().eq('id', id)
    if (error) {
      showToast(`ลบไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    load()
  }

  const thaiDate = (iso: string) =>
    new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) return null

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-indigo-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* จำนวนวันทำงาน/สัปดาห์ */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-700">ทำงานสัปดาห์ละ</p>
          <select
            value={daysPerWeek ?? ''}
            onChange={(e) => setDaysPerWeek(e.target.value === '' ? null : Number(e.target.value))}
            className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
          >
            <option value="">ตามตำแหน่ง</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} วัน
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            ใช้คิดวันขาดของคนที่วันหยุดไม่ตรงกันในแต่ละสัปดาห์
          </span>
        </div>

        {/* วันหยุดประจำ */}
        <div>
          <p className="text-sm font-medium text-gray-700">วันหยุดประจำ (คลิกวันที่หยุด)</p>
          <p className="mb-2 text-xs text-gray-500">
            ไม่เลือกเลย = ใช้ตารางของตำแหน่ง · มาเช็คอินตรงวันหยุดประจำ รายงานถือว่าเลื่อนไปหยุดวันอื่น
            ไม่นับขาดเพิ่ม
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const off = offDays.has(d.dow)
              return (
                <button
                  key={d.dow}
                  type="button"
                  onClick={() => toggleDay(d.dow)}
                  className={`h-9 w-11 rounded-lg border text-sm font-medium transition-colors ${
                    off
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title={off ? `หยุดประจำวัน${d.label}` : 'คลิกเพื่อตั้งเป็นวันหยุดประจำ'}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* สลับวันหยุดรายวัน — นาน ๆ ใช้ที เก็บไว้เฉพาะหน้าแก้ไขพนักงาน ไม่โชว์ใน popup */}
        {showExceptions && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700">สลับวันหยุด (เฉพาะวัน)</p>
          <p className="mb-2 text-xs text-gray-500">
            เช่น สัปดาห์นี้ขอย้ายวันหยุดจากอังคารไปพฤหัส — เพิ่ม 2 รายการ: อังคาร=มาทำงาน ·
            พฤหัส=หยุด
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={exDate}
              onChange={(e) => setExDate(e.target.value)}
              className="w-40"
            />
            <select
              value={exMode}
              onChange={(e) => setExMode(e.target.value as 'off' | 'onsite')}
              className="h-10 rounded-md border border-gray-200 bg-white px-2 text-sm"
            >
              <option value="off">หยุด</option>
              <option value="onsite">มาทำงาน</option>
            </select>
            <Input
              type="text"
              value={exNote}
              onChange={(e) => setExNote(e.target.value)}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              className="w-44"
            />
            <Button type="button" size="sm" onClick={addException} disabled={adding || !exDate}>
              <Plus className="w-4 h-4 mr-1" /> เพิ่ม
            </Button>
          </div>

          {exceptions.length > 0 && (
            <div className="mt-3 space-y-1">
              {exceptions.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 text-gray-600">{thaiDate(e.exception_date)}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      e.work_mode === 'off'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {e.work_mode === 'off' ? 'หยุด' : 'มาทำงาน'}
                  </span>
                  {e.note && <span className="truncate text-gray-400">{e.note}</span>}
                  <button
                    type="button"
                    onClick={() => removeException(e.id)}
                    className="ml-auto p-1 text-gray-300 hover:text-red-600"
                    title="ลบ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* ต้องกดบันทึกเท่านั้น — ไม่ auto save (ปุ่มอยู่ในกรอบการ์ด) */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          {dirty && <span className="mr-auto text-xs text-orange-600">แก้แล้ว ยังไม่บันทึก</span>}
          {onCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
              ยกเลิก
            </Button>
          )}
          <Button type="button" size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
