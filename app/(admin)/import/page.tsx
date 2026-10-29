'use client'

// สั่งของนำเข้า — รายการรอบสั่ง จัดกลุ่มตามตู้ (29 ต.ค. 69)
// เห็นเฉพาะคนใน import_access (ตอนนี้เจ้าของคนเดียว) · รอบมาจาก sync ของ builder ฝั่ง AGD

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Ship } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { EmptyState } from '@/components/aoo'
import { ListRow, ListRows, PageHeader, SectionCard, StatusBadge, TechLoader } from '@/components/shared'
import { getRounds, groupByContainer, type ImportRound } from '@/lib/services/import/importService'

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : null

export default function ImportRoundsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [rounds, setRounds] = useState<ImportRound[] | null>(null)

  const canSee = !!userData?.importAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  useEffect(() => {
    if (!canSee) return
    getRounds()
      .then(setRounds)
      .catch((e: Error) => showToast(e.message, 'error'))
  }, [canSee, showToast])

  const groups = useMemo(() => groupByContainer(rounds ?? []), [rounds])

  if (!canSee || !rounds) return <TechLoader />

  return (
    <div>
      <PageHeader title="นำเข้า" description="แผนสั่งของรายตู้ — เลือกรอบเพื่อวางจำนวนสั่ง" icon={Ship} />

      {groups.length === 0 ? (
        <EmptyState
          icon={<Ship size={28} />}
          title="ยังไม่มีรอบสั่ง"
          body="รอบสั่งจะขึ้นที่นี่หลัง sync แผนจากเครื่องมือ order-plan"
          size="lg"
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const cbm = Object.entries(g.rounds[0]?.containers ?? {})
              .map(([name, v]) => `${name} ${v} CBM`)
              .join(' · ')
            const arrive = fmtDate(g.rounds.find((r) => r.arrive)?.arrive ?? null)
            return (
              <SectionCard
                key={g.container ?? 'none'}
                title={
                  <span className="flex items-center gap-2">
                    <Container size={16} /> {g.container ?? 'ยังไม่ระบุตู้'}
                  </span>
                }
                description={[cbm, arrive && `ถึง ${arrive}`].filter(Boolean).join(' · ') || undefined}
              >
                <ListRows>
                  {g.rounds.map((r) => (
                    <ListRow
                      key={r.id}
                      href={`/import/${r.slug}`}
                      title={r.sub || r.brand}
                      meta={`${r.title} · ${r.itemCount.toLocaleString()} รายการ`}
                      trailing={<StatusBadge status={r.status} kind="importRound" />}
                    />
                  ))}
                </ListRows>
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
