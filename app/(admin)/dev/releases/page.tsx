'use client'

// Dev Management › Releases — เลือกโปรเจกต์ (รอบงาน: ลากเคส UAT + บั๊กเข้ารอบ แล้วดูความคืบหน้า · เจ้าของ 23 พ.ย. 69)

import { useCallback, useEffect, useState } from 'react'
import { Rocket } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { EmptyState } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import DevProjectGrid from '@/components/dev/DevProjectGrid'
import type { DevProject } from '@/lib/dev/uat'
import { getDevProjects } from '@/lib/services/devService'

export default function DevReleaseProjectsPage() {
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const me = userData?.id
  const isAdmin = userData?.role === 'admin'
  const [projects, setProjects] = useState<DevProject[] | null>(null)

  const load = useCallback(async () => {
    if (!me) return
    try {
      setProjects((await getDevProjects(me, !!isAdmin)).filter((p) => p.isActive))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, [me, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  if (loading || !userData) return <TechLoader />
  if (!isAdmin && !userData.hasDevAccess)
    return <EmptyState icon={<Rocket />} title="ยังไม่ได้อยู่ในโปรเจกต์ไหน" body="ให้ผู้จัดการโปรเจกต์เพิ่มคุณเข้าไปก่อน" />

  return (
    <div className="space-y-4">
      <PageHeader title="Releases" description="รอบงานของแต่ละแอป — เคสและบั๊กที่ต้องจบในรอบ พร้อมความคืบหน้า" icon={Rocket} />
      {projects === null ? (
        <TechLoader />
      ) : projects.length === 0 ? (
        <EmptyState icon={<Rocket />} title="ยังไม่มีโปรเจกต์" body="แอดมินสร้างโปรเจกต์ได้ที่หน้า UAT" />
      ) : (
        <DevProjectGrid projects={projects} href={(p) => `/dev/releases/${p.slug}`} />
      )}
    </div>
  )
}
