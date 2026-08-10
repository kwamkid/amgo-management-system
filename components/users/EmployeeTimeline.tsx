'use client'

// ไทม์ไลน์การทำงานของพนักงาน 1 คน — แท็บหนึ่งในหน้าแก้ไขพนักงาน
//
// เรื่องราวของพนักงานกระจายอยู่หลายตาราง (เริ่มงาน · โปร · ปรับเงินเดือน ·
// รายได้พิเศษ · ลาออก) ตรงนี้รวมเล่าเรียงตามเวลา — ไม่ต้องกรอกอะไรเพิ่ม
// ประกอบจากข้อมูลที่ระบบเก็บอยู่แล้วทั้งหมด และเป็นจุดเกาะของระบบ KPI
//
// RLS กรองให้เอง: HR/admin เห็นทุกคน · เจ้าตัวเห็นเงินเดือนตัวเอง
// คนอื่นเปิดมาเห็นแค่เหตุการณ์ที่ไม่ใช่เรื่องเงิน

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Ev = {
  date: string
  title: string
  detail?: string
  /** up = ได้เพิ่ม · down = โดนลด · end = จบ · future = ยังไม่ถึงวัน */
  tone: 'start' | 'up' | 'down' | 'info' | 'end' | 'future'
}

const DOT: Record<Ev['tone'], string> = {
  start: 'bg-blue-500',
  up: 'bg-green-500',
  down: 'bg-red-500',
  info: 'bg-gray-400',
  end: 'bg-gray-700',
  future: 'border-2 border-dashed border-amber-400 bg-white',
}

const baht = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const today = () => new Date().toISOString().slice(0, 10)

export default function EmployeeTimeline({ userId }: { userId: string }) {
  const [events, setEvents] = useState<Ev[] | null>(null)

  useEffect(() => {
    let alive = true
    const sb = createClient()

    Promise.all([
      sb
        .from('users')
        .select(
          'start_date, start_date_verified, probation_end_date, end_date, end_reason, employment_status'
        )
        .eq('id', userId)
        .maybeSingle(),
      sb
        .from('user_compensation')
        .select('base_salary, effective_from, note')
        .eq('user_id', userId)
        .order('effective_from'),
      sb
        .from('user_pay_items')
        .select('label, amount, calc, effective_from, effective_to')
        .eq('user_id', userId)
        .order('effective_from'),
    ]).then(([{ data: person }, { data: comp }, { data: pay }]) => {
      if (!alive || !person) return

      const out: Ev[] = []
      const salary = (comp ?? []).map((c) => ({ ...c, base_salary: Number(c.base_salary) }))

      if (person.start_date) {
        out.push({
          date: person.start_date,
          title: person.probation_end_date ? 'เริ่มงาน (ทดลองงาน)' : 'เริ่มงาน',
          detail: person.start_date_verified ? undefined : 'วันเริ่มงานยังไม่ยืนยัน',
          tone: 'start',
        })
      }

      salary.forEach((c, i) => {
        const prev = salary[i - 1]
        const diff = prev ? c.base_salary - prev.base_salary : 0
        out.push({
          date: c.effective_from,
          title:
            i === 0
              ? `เงินเดือนเริ่มต้น ${baht.format(c.base_salary)} บาท`
              : diff > 0
                ? `ปรับเงินเดือนขึ้นเป็น ${baht.format(c.base_salary)} บาท (+${baht.format(diff)})`
                : diff < 0
                  ? `ลดเงินเดือนเหลือ ${baht.format(c.base_salary)} บาท (−${baht.format(-diff)})`
                  : `ปรับปรุงตัวเลขเงินเดือน ${baht.format(c.base_salary)} บาท`,
          detail: c.note ?? undefined,
          tone: c.effective_from > today() ? 'future' : i === 0 ? 'info' : diff < 0 ? 'down' : 'up',
        })
      })

      if (person.probation_end_date) {
        const passed = person.probation_end_date <= today()
        out.push({
          date: person.probation_end_date,
          title: passed ? 'พ้นทดลองงาน' : 'กำหนดพ้นทดลองงาน',
          tone: passed ? 'up' : 'future',
        })
      }

      for (const item of pay ?? []) {
        const amountText =
          item.calc === 'tiered_percent'
            ? 'ตามยอดขาย'
            : item.calc === 'per_piece'
              ? `${baht.format(Number(item.amount))} บาท/ชิ้น`
              : `${baht.format(Number(item.amount))} บาท/เดือน`
        out.push({ date: item.effective_from, title: `เพิ่ม${item.label} : ${amountText}`, tone: 'up' })
        if (item.effective_to) {
          out.push({ date: item.effective_to, title: `หยุดจ่าย${item.label}`, tone: 'down' })
        }
      }

      if (person.end_date) {
        out.push({
          date: person.end_date,
          title: 'สิ้นสุดการเป็นพนักงาน',
          detail: person.end_reason ?? undefined,
          tone: person.end_date > today() ? 'future' : 'end',
        })
      }

      out.sort((a, b) => a.date.localeCompare(b.date))
      setEvents(out)
    })

    return () => {
      alive = false
    }
  }, [userId])

  if (events === null) return null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-gray-900">ไทม์ไลน์</h2>

        {events.length === 0 ? (
          <p className="text-sm text-gray-400">
            ยังไม่มีเหตุการณ์ — เริ่มจากใส่วันเริ่มงาน (แท็บข้อมูล) และเงินเดือน (แท็บเงินเดือน)
          </p>
        ) : (
          <ol className="relative ml-2 space-y-4 border-l border-gray-200 pl-5">
            {events.map((ev, i) => (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ${DOT[ev.tone]}`}
                />
                <p className="text-xs text-gray-400">
                  {thaiDate(ev.date)}
                  {ev.tone === 'future' && ' · กำหนดการ'}
                </p>
                <p
                  className={`text-sm ${
                    ev.tone === 'down'
                      ? 'text-red-700'
                      : ev.tone === 'end'
                        ? 'font-medium text-gray-900'
                        : 'text-gray-800'
                  }`}
                >
                  {ev.title}
                </p>
                {ev.detail && <p className="text-xs text-gray-500">{ev.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── ที่เกาะของระบบ KPI ─────────────────────────────── */}
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-400">
        KPI — เตรียมพื้นที่ไว้ ผลประเมินจะขึ้นต่อท้ายไทม์ไลน์ของคนนี้
      </div>
    </div>
  )
}
