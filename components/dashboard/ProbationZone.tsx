'use client'

// กล่อง "ใครยังทดลองงานอยู่" บนหน้าแรก — เห็นเฉพาะแอดมิน (ผู้ใช้ระบุเอง)
//
// เรียงตามวันพ้นโปรที่ใกล้ถึงก่อน — เกินกำหนดแล้วขึ้นแดง เพราะแปลว่า
// ยังไม่มีใครตัดสินใจ (ผ่าน → เปลี่ยนสถานะ + ตั้งเงินเดือนใหม่ · ไม่ผ่าน → จบสัญญา)
// ปล่อยไว้เฉย ๆ เงินเดือนหลังโปรที่ลงล่วงหน้าจะเริ่มจ่ายเองตามวันที่

import { useEffect, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { ListRow, ListRows } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, Pill } from '@/components/aoo'

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
    <Card padding={0} className="mb-5 overflow-hidden">
      <CardHeader>
        <CardTitle icon={Hourglass} tone="warning">ทดลองงานอยู่ {rows.length} คน</CardTitle>
      </CardHeader>

      <CardContent className="pt-2">
        <ListRows>
          {rows.map((r) => {
            const overdue = !!r.probation_end_date && r.probation_end_date < today
            const daysLeft = r.probation_end_date
              ? Math.ceil(
                  (new Date(r.probation_end_date).getTime() - new Date(today).getTime()) / 86400_000
                )
              : null

            return (
              <ListRow
                key={r.id}
                href={`/employees/${r.id}/edit?tab=timeline`}
                title={r.display_name}
                meta={r.job_functions?.name_th ?? 'ยังไม่ระบุตำแหน่ง'}
                trailing={
                  r.probation_end_date ? (
                    overdue ? (
                      <Pill tone="danger">
                        เกินกำหนดพ้นโปร {thaiDate(r.probation_end_date)} — รอตัดสิน
                      </Pill>
                    ) : (
                      <span className="text-xs text-gray-500">
                        พ้นโปร {thaiDate(r.probation_end_date)} (อีก {daysLeft} วัน)
                      </span>
                    )
                  ) : (
                    <Pill tone="warning">ยังไม่ตั้งวันพ้นโปร</Pill>
                  )
                }
              />
            )
          })}
        </ListRows>
      </CardContent>
    </Card>
  )
}
