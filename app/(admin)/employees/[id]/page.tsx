// หน้าสรุปพนักงานรายคน — ตัวตน · ค่าตอบแทน · ไทม์ไลน์การทำงาน
//
// ── ทำไมต้องมี ────────────────────────────────────────────────────────
// เรื่องราวของพนักงานหนึ่งคนกระจายอยู่หลายตาราง (เริ่มงาน · โปร · ปรับเงินเดือน
// · รายได้พิเศษ · ลาออก) ไม่มีที่ไหนเล่าเรียงตามเวลา — หน้านี้รวมเป็น
// ไทม์ไลน์เดียว และจะเป็นจุดเกาะของระบบ KPI ที่จะตามมา
//
// ── ใครเห็น ───────────────────────────────────────────────────────────
// HR/admin เห็นทุกคน · เจ้าตัวเห็นของตัวเอง — ใช้ session ของคนเปิด
// RLS จึงกรองเงินเดือนให้เองอีกชั้น ต่อให้หลุดเข้ามาก็ไม่เห็นตัวเลขคนอื่น

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabase, getCurrentUser } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/shared'
import UserAvatar from '@/components/shared/UserAvatar'
import PayCard from '@/components/users/PayCard'

export const dynamic = 'force-dynamic'

const baht = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const today = () => new Date().toISOString().slice(0, 10)

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

export default async function EmployeeSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  const canViewAll = ['hr', 'admin'].includes(me.profile.role)
  if (!canViewAll && me.profile.id !== id) redirect('/dashboard')

  const sb = await createServerSupabase()
  const [{ data: person }, { data: comp }, { data: pay }] = await Promise.all([
    sb
      .from('users')
      .select(
        'id, full_name, nickname, display_name, line_display_name, phone, role, employment_status, employment_type, start_date, start_date_verified, probation_end_date, end_date, end_reason, job_functions(name_th), companies(code, name_th)'
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    sb
      .from('user_compensation')
      .select('base_salary, effective_from, note')
      .eq('user_id', id)
      .order('effective_from'),
    sb
      .from('user_pay_items')
      .select('label, amount, calc, effective_from, effective_to')
      .eq('user_id', id)
      .order('effective_from'),
  ])

  if (!person) notFound()

  const fn = (person.job_functions as { name_th: string } | null)?.name_th
  const co = person.companies as { code: string; name_th: string } | null

  /* ── ประกอบไทม์ไลน์ ─────────────────────────────────────────── */
  const events: Ev[] = []
  const salary = (comp ?? []).map((c) => ({ ...c, base_salary: Number(c.base_salary) }))

  if (person.start_date) {
    events.push({
      date: person.start_date,
      title: person.probation_end_date ? 'เริ่มงาน (ทดลองงาน)' : 'เริ่มงาน',
      detail: person.start_date_verified ? undefined : 'วันเริ่มงานยังไม่ยืนยัน',
      tone: 'start',
    })
  }

  salary.forEach((c, i) => {
    const prev = salary[i - 1]
    const diff = prev ? c.base_salary - prev.base_salary : 0
    const future = c.effective_from > today()
    events.push({
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
      tone: future ? 'future' : i === 0 ? 'info' : diff < 0 ? 'down' : 'up',
    })
  })

  if (person.probation_end_date) {
    const passed = person.probation_end_date <= today()
    events.push({
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
    events.push({
      date: item.effective_from,
      title: `เพิ่ม${item.label} : ${amountText}`,
      tone: 'up',
    })
    if (item.effective_to) {
      events.push({ date: item.effective_to, title: `หยุดจ่าย${item.label}`, tone: 'down' })
    }
  }

  if (person.end_date) {
    events.push({
      date: person.end_date,
      title: 'สิ้นสุดการเป็นพนักงาน',
      detail: person.end_reason ?? undefined,
      tone: person.end_date > today() ? 'future' : 'end',
    })
  }

  events.sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="max-w-3xl space-y-4">
      {/* ── หัว: ตัวตน ─────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          <UserAvatar name={person.full_name} userId={person.id} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">
                {person.display_name || person.full_name}
              </h1>
              <StatusBadge status={person.employment_status} />
              {person.employment_status !== 'probation' && person.probation_end_date && (
                <span className="text-xs text-gray-400">
                  พ้นโปร {thaiDate(person.probation_end_date)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {[fn, co && `${co.code} · ${co.name_th}`].filter(Boolean).join(' — ') ||
                'ยังไม่ได้ระบุตำแหน่ง'}
              {person.employment_type &&
                ` · ${person.employment_type === 'daily' ? 'รายวัน' : 'รายเดือน'}`}
            </p>
            <p className="text-xs text-gray-400">
              LINE · {person.line_display_name}
              {person.phone && ` · ${person.phone}`}
            </p>
          </div>

          {canViewAll && (
            <Link
              href={`/employees/${person.id}/edit`}
              className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              แก้ไขข้อมูล
            </Link>
          )}
        </div>
      </div>

      {/* ── ค่าตอบแทนปัจจุบัน (อ่านอย่างเดียว — แก้ที่หน้าแก้ไข) ── */}
      <PayCard userId={person.id} />

      {/* ── ไทม์ไลน์ ───────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-gray-900">ไทม์ไลน์</h2>

        {events.length === 0 ? (
          <p className="text-sm text-gray-400">
            ยังไม่มีเหตุการณ์ — เริ่มจากใส่วันเริ่มงานและเงินเดือนที่หน้าแก้ไข
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
