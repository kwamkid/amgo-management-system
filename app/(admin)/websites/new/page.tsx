'use client'

// AOO Website — เพิ่มเว็บใหม่
// กรอกแค่พอให้มีแถว แล้วไปกรอกที่เหลือในหน้ารายละเอียด (วันหมดอายุ/SSH/บิล)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Field, Input, SelectMenu } from '@/components/aoo'
import { PageHeader, SectionCard, TechLoader } from '@/components/shared'
import { getCourses, saveSite, type WebCourse } from '@/lib/services/web/webService'

export default function NewWebsitePage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [courses, setCourses] = useState<WebCourse[]>([])
  const [siteName, setSiteName] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentContact, setStudentContact] = useState('')
  const [hostingProvider, setHostingProvider] = useState('')
  const [courseId, setCourseId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canSee = !!userData && !!userData.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  useEffect(() => {
    if (canSee) getCourses().then(setCourses).catch(() => {})
  }, [canSee])

  const submit = async () => {
    const domain = siteName.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!domain) return showToast('ยังไม่ได้ใส่โดเมน', 'error')
    setSaving(true)
    try {
      const id = await saveSite({
        siteName: domain,
        studentName,
        studentContact,
        hostingProvider,
        courseId,
        isActive: true,
      })
      showToast('เพิ่มเว็บแล้ว', 'success')
      router.push(`/websites/${id}`)
    } catch (e) {
      showToast((e as Error).message, 'error')
      setSaving(false)
    }
  }

  if (!canSee) return <TechLoader />

  return (
    <div>
      <PageHeader backHref="/websites" title="เพิ่มเว็บไซต์" icon={Globe} />
      <SectionCard className="max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="โดเมน">
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="example.com"
              autoFocus
            />
          </Field>
          <Field label="รุ่น/คอร์ส">
            <SelectMenu
              size="md"
              value={courseId}
              options={courses.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="ยังไม่ระบุ"
              clearable="ไม่อยู่รุ่นไหน"
              onChange={setCourseId}
            />
          </Field>
          <Field label="เจ้าของเว็บ">
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </Field>
          <Field label="ติดต่อ">
            <Input value={studentContact} onChange={(e) => setStudentContact(e.target.value)} />
          </Field>
          <Field label="โฮสต์">
            <Input
              value={hostingProvider}
              onChange={(e) => setHostingProvider(e.target.value)}
              placeholder="Hostinger / SiteGround"
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.push('/websites')}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={saving}>
            บันทึก
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
