'use client'

// Dev Management › Bug report — โปรเจกต์ที่ฉันอยู่ + จำนวนบั๊กที่ยังเปิด (สร้างโปรเจกต์/จัดสมาชิกอยู่ที่หน้า UAT)
// เจ้าของ 23 พ.ย. 69: เลขบั๊กแยกต่อโปรเจกต์ BUG-0001 · ใช้สมาชิกและสิทธิ์ชุดเดียวกับ UAT

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bug } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Card, EmptyState, Pill } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import { ROLE_LABELS, type DevProject } from '@/lib/dev/uat'
import { getDevProjects } from '@/lib/services/devService'
import { getOpenBugCounts } from '@/lib/services/devBugService'

export default function DevBugProjectsPage() {
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const me = userData?.id
  const isAdmin = userData?.role === 'admin'
  const [projects, setProjects] = useState<DevProject[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    if (!me) return
    try {
      const [p, c] = await Promise.all([getDevProjects(me, !!isAdmin), getOpenBugCounts()])
      setProjects(p.filter((x) => x.isActive))
      setCounts(c)
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, [me, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  if (loading || !userData) return <TechLoader />
  if (!isAdmin && !userData.hasDevAccess)
    return <EmptyState icon={<Bug />} title="ยังไม่ได้อยู่ในโปรเจกต์ไหน" body="ให้ผู้จัดการโปรเจกต์เพิ่มคุณเข้าไปก่อน" />

  return (
    <div className="space-y-4">
      <PageHeader title="Bug report" description="แจ้งบั๊กของแต่ละแอป พร้อมรูป แล้วตามจนแก้เสร็จ" icon={Bug} />
      {projects === null ? (
        <TechLoader />
      ) : projects.length === 0 ? (
        <EmptyState icon={<Bug />} title="ยังไม่มีโปรเจกต์" body="แอดมินสร้างโปรเจกต์ได้ที่หน้า UAT" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {projects.map((p) => {
            const open = counts[p.id] ?? 0
            return (
              <Card key={p.id} padding={16}>
                <Link href={`/dev/bugs/${p.slug}`} style={{ display: 'block' }}>
                  <div style={{ fontSize: 'var(--fs-h4)', fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--fg-3)' }}>{p.slug}</div>
                </Link>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  <Pill tone={open > 0 ? 'danger' : 'neutral'}>เปิดอยู่ {open} บั๊ก</Pill>
                  <Pill>{ROLE_LABELS[p.myRole]}</Pill>
                </div>
                <Link href={`/dev/bugs/${p.slug}`} style={{ display: 'block', marginTop: 12 }}>
                  <Button variant="secondary" style={{ width: '100%' }}>เปิดบอร์ด</Button>
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
