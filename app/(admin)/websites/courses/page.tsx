'use client'

// AOO Website — รุ่น/คอร์ส = กลุ่มเว็บที่ใช้รอบบิลและราคาเดียวกัน
// ตั้งราคาไว้ที่นี่ เวลาเพิ่มบิลในหน้าเว็บจะดึงมาเป็นค่าตั้งต้นให้

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, DatePicker, Field, Input, Modal } from '@/components/aoo'
import { DataTable, PageHeader, TechLoader, type Column } from '@/components/shared'
import { getCourses, saveCourse, type WebCourse } from '@/lib/services/web/webService'

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

export default function WebCoursesPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [courses, setCourses] = useState<WebCourse[] | null>(null)
  const [draft, setDraft] = useState<Partial<WebCourse> | null>(null)

  const canSee = !!userData && !!userData.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () => {
    getCourses()
      .then(setCourses)
      .catch((e) => showToast(e.message, 'error'))
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  const submit = async () => {
    if (!draft?.name?.trim()) return showToast('ยังไม่ได้ใส่ชื่อรุ่น', 'error')
    try {
      await saveCourse(draft)
      setDraft(null)
      load()
      showToast('บันทึกแล้ว', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const columns: Column<WebCourse>[] = [
    { key: 'name', header: 'รุ่น', mobilePrimary: true, cell: (c) => <span className="font-medium">{c.name}</span> },
    {
      key: 'period',
      header: 'รอบ',
      cell: (c) => (
        <span className="text-gray-600">
          {fmt(c.periodStart)} – {fmt(c.periodEnd)}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'ราคาตั้งต้น',
      align: 'right',
      cell: (c) => (
        <span className="text-gray-700">
          โฮสต์ {c.hostingAmount.toLocaleString('th-TH')} · โดเมน {c.domainAmount.toLocaleString('th-TH')}
        </span>
      ),
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (c) => (
        <Button size="sm" variant="ghost" onClick={() => setDraft(c)}>
          แก้
        </Button>
      ),
    },
  ]

  if (!canSee || !courses) return <TechLoader />

  return (
    <div>
      <PageHeader
        backHref="/websites"
        title="รุ่น / คอร์ส"
        description="กลุ่มเว็บที่ใช้รอบบิลและราคาเดียวกัน"
        icon={Layers}
        actions={
          <Button onClick={() => setDraft({ hostingAmount: 2000, domainAmount: 600 })}>
            <Plus size={15} />
            เพิ่มรุ่น
          </Button>
        }
      />

      <DataTable columns={columns} rows={courses} rowKey={(c) => c.id} emptyTitle="ยังไม่มีรุ่น" />

      {draft && (
        <Modal open onClose={() => setDraft(null)} title={draft.id ? 'แก้ไขรุ่น' : 'เพิ่มรุ่น'}>
          <div className="space-y-3">
            <Field label="ชื่อรุ่น">
              <Input
                value={draft.name ?? ''}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="รุ่นที่ 3 / 2026"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="เริ่มรอบ">
                <DatePicker
                  value={draft.periodStart ?? ''}
                  onChange={(v) => setDraft({ ...draft, periodStart: v })}
                />
              </Field>
              <Field label="สิ้นสุดรอบ">
                <DatePicker value={draft.periodEnd ?? ''} onChange={(v) => setDraft({ ...draft, periodEnd: v })} />
              </Field>
              <Field label="ค่าโฮสต์ตั้งต้น">
                <Input
                  value={String(draft.hostingAmount ?? 0)}
                  onChange={(e) => setDraft({ ...draft, hostingAmount: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="ค่าโดเมนตั้งต้น">
                <Input
                  value={String(draft.domainAmount ?? 0)}
                  onChange={(e) => setDraft({ ...draft, domainAmount: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                ยกเลิก
              </Button>
              <Button onClick={submit}>บันทึก</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
