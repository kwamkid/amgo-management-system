'use client'

// กล่อง "ใครยังทดลองงานอยู่" บนหน้าแรก — เห็นเฉพาะแอดมิน (ผู้ใช้ระบุเอง)
//
// เรียงตามวันพ้นโปรที่ใกล้ถึงก่อน — เกินกำหนดแล้วขึ้นแดง เพราะแปลว่า
// ยังไม่มีใครตัดสินใจ (ผ่าน → เปลี่ยนสถานะ + ตั้งเงินเดือนใหม่ · ไม่ผ่าน → จบสัญญา)
// ปล่อยไว้เฉย ๆ เงินเดือนหลังโปรที่ลงล่วงหน้าจะเริ่มจ่ายเองตามวันที่

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Hourglass } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

type Row = {
  id: string
  display_name: string
  probation_end_date: string | null
  job_functions: { name_th: string } | null
}

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

export default function ProbationZone() {
  const { userData, loading } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)

  const isAdmin = userData?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) return
    let alive = true

    createClient()
      .from('users')
      .select('id, display_name, probation_end_date, job_functions(name_th)')
      .eq('employment_status', 'probation')
      .eq('is_active', true)
      .eq('is_system', false)
      .is('deleted_at', null)
      .order('probation_end_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (alive) setRows((data ?? []) as unknown as Row[])
      })

    return () => {
      alive = false
    }
  }, [isAdmin])

  if (loading || !isAdmin || !rows?.length) return null

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <Hourglass size={15} className="shrink-0 text-amber-600" />
        <h2 className="text-sm font-semibold text-gray-900">ทดลองงานอยู่ {rows.length} คน</h2>
      </header>

      <ul className="divide-y divide-gray-100">
        {rows.map((r) => {
          const overdue = !!r.probation_end_date && r.probation_end_date < today
          const daysLeft = r.probation_end_date
            ? Math.ceil(
                (new Date(r.probation_end_date).getTime() - new Date(today).getTime()) / 86400_000
              )
            : null

          return (
            <li key={r.id}>
              <Link
                href={`/employees/${r.id}/edit?tab=timeline`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {r.display_name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {r.job_functions?.name_th ?? 'ยังไม่ระบุตำแหน่ง'}
                  </span>
                </span>

                {r.probation_end_date ? (
                  <span
                    className={`shrink-0 text-xs ${
                      overdue ? 'font-medium text-red-700' : 'text-gray-500'
                    }`}
                  >
                    {overdue
                      ? `เกินกำหนดพ้นโปร ${thaiDate(r.probation_end_date)} — รอตัดสิน`
                      : `พ้นโปร ${thaiDate(r.probation_end_date)} (อีก ${daysLeft} วัน)`}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-orange-700">
                    ยังไม่ตั้งวันพ้นโปร
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
