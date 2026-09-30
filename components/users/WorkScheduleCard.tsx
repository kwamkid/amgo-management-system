'use client'

// components/users/WorkScheduleCard.tsx
//
// ตารางวันทำงานรายคน — วันหยุดประจำ + สลับวันหยุดรายวัน (HR เท่านั้น RLS คุมอีกชั้น)
// จำนวนวัน/วันหยุดประจำ แก้ค้างไว้ก่อน แล้วต้องกด "บันทึก" ถึงจะเขียนจริง (เจ้าของสั่ง
// ห้าม auto save) — ส่วนสลับวันหยุดเป็นรายการเพิ่ม/ลบ มีปุ่ม "เพิ่ม" ของมันเองอยู่แล้ว
//
// ลำดับที่ระบบใช้ตัดสินว่าวันไหนต้องมาทำงาน (expected_work_mode):
//   สลับรายวัน (schedule_exceptions) > ตารางรายคน (user_work_schedules)
//   > ตารางของตำแหน่ง > จ–ศ
// ถ้ามาเช็คอินตรงวันหยุดประจำ รายงานถือว่า "เลื่อนไปหยุดวันอื่น" — ไม่นับขาดเพิ่ม
//
// ── บันทึกครบ 7 วัน (30 ก.ย. 69) ─────────────────────────────────────
// เดิมเก็บแถวเฉพาะวันที่ติ๊กหยุด วันที่เหลือไหลไปใช้ตารางของตำแหน่ง — ขวัญ
// ติ๊กหยุดเสาร์ แต่ตำแหน่ง Call Center หยุดอาทิตย์ ระบบเลยให้หยุด 2 วันซ้อน
// ยื่นใบสลับไม่ผ่าน · ตอนนี้ตำแหน่งแบบวันตายตัวบันทึกครบทุกวัน ตารางรายคน
// ทับตำแหน่งทั้งสัปดาห์ · ตำแหน่งกะหมุนเวียน (PC) ยังเก็บเฉพาะวันหยุด เพราะวันที่
// เหลือต้องเป็น 'rotating' ให้รายงานคิดขาดตามจำนวนวัน/สัปดาห์
//
// วัน "ไม่บังคับ" (optional) = มาก็นับมา ไม่มาก็ไม่ขาด ไม่เด้งถามสลับวันหยุด
// (กิ่งไผ่ เสาร์ — เจ้าของสั่ง 30 ก.ย. 69)

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { Input, Card, CardContent, CardHeader, CardTitle, Button } from '@/components/aoo'
const DAYS = [
  { dow: 0, label: 'อา.' },
  { dow: 1, label: 'จ.' },
  { dow: 2, label: 'อ.' },
  { dow: 3, label: 'พ.' },
  { dow: 4, label: 'พฤ.' },
  { dow: 5, label: 'ศ.' },
  { dow: 6, label: 'ส.' },
]

type DayMode = 'work' | 'off' | 'optional'

const NEXT: Record<DayMode, DayMode> = { work: 'off', off: 'optional', optional: 'work' }

const MODE_STYLE: Record<DayMode, string> = {
  work: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
  off: 'border-red-200 bg-red-50 text-red-700',
  optional: 'border-amber-200 bg-amber-50 text-amber-700',
}

const MODE_LABEL: Record<DayMode, string> = {
  work: 'ทำงาน',
  off: 'หยุด',
  optional: 'ไม่บังคับ',
}

const toDayMode = (m: string | null | undefined): DayMode =>
  m === 'off' ? 'off' : m === 'optional' ? 'optional' : 'work'

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

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
  const [modes, setModes] = useState<Record<number, DayMode>>({})
  const [origModes, setOrigModes] = useState<Record<number, DayMode>>({})
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)
  const [origDaysPerWeek, setOrigDaysPerWeek] = useState<number | null>(null)
  // ตารางรายคนมีอยู่แล้วไหม · ตำแหน่งเป็นกะหมุนเวียนไหม · โหมดทำงานของตำแหน่งรายวัน
  const [hasPersonal, setHasPersonal] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [workModeOf, setWorkModeOf] = useState<Record<number, 'onsite' | 'wfh'>>({})
  const [jfModes, setJfModes] = useState<Record<number, DayMode>>({})
  const [saving, setSaving] = useState(false)
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [loading, setLoading] = useState(true)

  const dirty =
    daysPerWeek !== origDaysPerWeek || ALL_DAYS.some((d) => modes[d] !== origModes[d])

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
      sb
        .from('users')
        .select('days_per_week, job_functions(schedule_type, job_function_work_days(day_of_week, work_mode))')
        .eq('id', userId)
        .single(),
    ])

    const jfRaw = usr.data?.job_functions
    const jf = (Array.isArray(jfRaw) ? jfRaw[0] : jfRaw) as {
      schedule_type: string | null
      job_function_work_days: { day_of_week: number; work_mode: string }[] | null
    } | null
    const jfDays = new Map((jf?.job_function_work_days ?? []).map((r) => [r.day_of_week, r.work_mode]))
    const mine = new Map((sched.data ?? []).map((r) => [r.day_of_week, r.work_mode]))

    // วันทำงานเขียนเป็น onsite/wfh ตามที่มีอยู่ (รายคนก่อน แล้วตำแหน่ง) — ไม่มีก็ onsite
    const wm: Record<number, 'onsite' | 'wfh'> = {}
    const jfm: Record<number, DayMode> = {}
    const current: Record<number, DayMode> = {}
    for (const d of ALL_DAYS) {
      const own = mine.get(d)
      // ตำแหน่งไม่มีตารางเลย → expected_work_mode ถอยไป จ–ศ (ส–อา หยุด) ให้โชว์ตรงกัน
      const fromJf =
        jfDays.get(d) ??
        (jfDays.size === 0 && jf?.schedule_type !== 'rotating'
          ? d === 0 || d === 6 ? 'off' : 'onsite'
          : undefined)
      wm[d] = own === 'wfh' || (own !== 'onsite' && fromJf === 'wfh') ? 'wfh' : 'onsite'
      jfm[d] = toDayMode(fromJf)
      current[d] = toDayMode(own ?? fromJf)
    }
    setWorkModeOf(wm)
    setJfModes(jfm)
    setModes(current)
    setOrigModes(current)
    setHasPersonal(mine.size > 0)
    setRotating(jf?.schedule_type === 'rotating')
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
    setModes((prev) => ({ ...prev, [dow]: NEXT[prev[dow] ?? 'work'] }))
  }

  /** กลับไปใช้ตารางของตำแหน่ง (ลบตารางรายคนทิ้งตอนกดบันทึก) */
  const resetToJobFunction = () => setModes({ ...jfModes })

  /** จำนวนวัน/สัปดาห์ + ตารางรายคน (ตำแหน่งวันตายตัว = ครบ 7 วัน · กะหมุนเวียน = เฉพาะวันหยุด/ไม่บังคับ) */
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
      const scheduleChanged = ALL_DAYS.some((d) => modes[d] !== origModes[d])
      const sameAsJob = ALL_DAYS.every((d) => modes[d] === jfModes[d])

      if (scheduleChanged) {
        // ตรงกับตำแหน่งทุกวัน = ไม่ต้องมีตารางรายคน · กะหมุนเวียน = เก็บแค่วันที่ไม่ใช่วันทำงาน
        const rows = sameAsJob
          ? []
          : ALL_DAYS.filter((d) => !rotating || modes[d] !== 'work').map((d) => ({
              user_id: userId,
              day_of_week: d,
              work_mode: modes[d] === 'work' ? workModeOf[d] : modes[d],
              note:
                modes[d] === 'off' ? 'วันหยุดประจำ' : modes[d] === 'optional' ? 'เข้าได้ ไม่บังคับ' : 'วันทำงาน',
            }))

        // เขียนของใหม่ก่อนแล้วค่อยลบส่วนเกิน — ลบก่อนแล้วเขียนพัง ตารางจะหายทั้งสัปดาห์
        if (rows.length) {
          const { error } = await sb
            .from('user_work_schedules')
            .upsert(rows, { onConflict: 'user_id,day_of_week' })
          if (error) throw error
        }
        const keep = rows.map((r) => r.day_of_week)
        const drop = ALL_DAYS.filter((d) => !keep.includes(d))
        if (drop.length) {
          const { error } = await sb
            .from('user_work_schedules')
            .delete()
            .eq('user_id', userId)
            .in('day_of_week', drop)
          if (error) throw error
        }
        setHasPersonal(rows.length > 0)
      }
      setOrigModes({ ...modes })
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
    <Card padding={0}>
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-gray-700">ตารางประจำสัปดาห์ (คลิกวันเพื่อเปลี่ยน)</p>
            <span className="text-xs text-gray-500">
              {hasPersonal ? 'ตั้งรายคนไว้' : 'ตามตำแหน่ง'}
            </span>
            {ALL_DAYS.some((d) => modes[d] !== jfModes[d]) && (
              <button
                type="button"
                onClick={resetToJobFunction}
                className="ml-auto text-xs text-blue-700 hover:underline"
              >
                ใช้ตารางตามตำแหน่ง
              </button>
            )}
          </div>
          <p className="mb-2 text-xs text-gray-500">
            คลิกวนได้ 3 แบบ: ทำงาน → <span className="text-red-700">หยุด</span> →{' '}
            <span className="text-amber-700">ไม่บังคับ</span> (มาก็นับมา ไม่มาไม่นับขาด) · มาเช็คอินตรงวันหยุด
            ระบบจะถามวันหยุดชดเชย
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const m = modes[d.dow] ?? 'work'
              return (
                <button
                  key={d.dow}
                  type="button"
                  onClick={() => toggleDay(d.dow)}
                  className={`flex h-12 w-14 flex-col items-center justify-center rounded-lg border text-sm font-medium transition-colors ${MODE_STYLE[m]}`}
                  title={`วัน${d.label} — ${MODE_LABEL[m]} · คลิกเพื่อเปลี่ยน`}
                >
                  {d.label}
                  <span className="text-xs font-normal">{MODE_LABEL[m]}</span>
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
                        : e.work_mode === 'optional'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {e.work_mode === 'off' ? 'หยุด' : e.work_mode === 'optional' ? 'ไม่บังคับ' : 'มาทำงาน'}
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
            <Button type="button" variant="soft" size="sm" onClick={onCancel} disabled={saving}>
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
