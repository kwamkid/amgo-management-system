'use client'

// บอร์ด UAT ของโปรเจกต์หนึ่ง — ลากการ์ดบันทึกผล · ค้นหาเลข/ชื่อ · ผู้จัดการเพิ่มเคสจากหน้าเว็บได้ (Claude เพิ่มผ่าน bot API)
// ลิงก์จากแจ้งเตือน /dev/uat/<slug>?case=<id> → เปิดเคสนั้นเลย

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, Input, Modal } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import UatBoard, { type UatDrop } from '@/components/dev/UatBoard'
import UatCaseModal, { CaseForm } from '@/components/dev/UatCaseModal'
import { uatCode, type DevProject, type UatCase, type UatResultValue } from '@/lib/dev/uat'
import { createUatCase, getDevProject, getUatCases, moveUatCase } from '@/lib/services/devService'

export default function DevUatBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const me = userData?.id
  const isAdmin = userData?.role === 'admin'

  const [project, setProject] = useState<DevProject | null | undefined>(undefined)
  const [cases, setCases] = useState<UatCase[] | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<{ c: UatCase; result?: UatResultValue; retest?: boolean; sortOrder?: number } | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    if (!me) return
    try {
      const p = await getDevProject(slug, me, !!isAdmin)
      setProject(p)
      if (p) setCases(await getUatCases(p.id))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, [me, isAdmin, slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  // ลิงก์จากแจ้งเตือน → เปิดเคส (ครั้งเดียว)
  const [deepLinked, setDeepLinked] = useState(false)
  useEffect(() => {
    if (!cases || deepLinked) return
    setDeepLinked(true)
    const id = new URLSearchParams(window.location.search).get('case')
    const hit = id && cases.find((c) => c.id === id)
    if (hit) setOpen({ c: hit })
  }, [cases, deepLinked])

  const canManage = project?.myRole === 'manager'
  const canTest = project?.myRole === 'manager' || project?.myRole === 'tester'

  const shown = useMemo(() => {
    if (!cases) return []
    const s = q.trim().toLowerCase()
    if (!s) return cases
    const no = Number(s.replace(/^uat-?/i, ''))
    return cases.filter((c) => (Number.isInteger(no) && c.no === no) || c.title.toLowerCase().includes(s) || c.module?.toLowerCase().includes(s))
  }, [cases, q])

  const onReorder = async (id: string, sortOrder: number) => {
    setCases((prev) => prev?.map((c) => (c.id === id ? { ...c, sortOrder } : c)) ?? prev)
    try {
      await moveUatCase(id, sortOrder)
    } catch (e) {
      showToast((e as Error).message, 'error')
      load()
    }
  }

  // วางข้ามคอลัมน์: เปิด modal ให้บันทึกผล / ส่งกลับ / ปิด — การ์ดอยู่ที่เดิมจนกว่าจะบันทึก (modal ปิดโดยไม่บันทึก = บอร์ดรีเซ็ตเอง)
  const onDrop = (d: UatDrop) => {
    const c = cases?.find((x) => x.id === d.caseId)
    if (!c) return
    if (d.result) {
      if (!canTest) return showToast('คุณดูได้อย่างเดียวในโปรเจกต์นี้', 'error')
      setOpen({ c, result: d.result, sortOrder: d.sortOrder })
    } else if (d.column === 'todo') setOpen({ c, retest: true, sortOrder: d.sortOrder })
    else if (d.column === 'closed') setOpen({ c, retest: false, sortOrder: d.sortOrder })
  }

  const search = (width: number | string) => (
    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลข / ชื่อเคส" prefix={<Search size={16} />} style={{ width }} />
  )

  if (loading || !userData || project === undefined) return <TechLoader />
  if (!project) return <EmptyState icon={<FlaskConical />} title="ไม่พบโปรเจกต์" body="หรือคุณยังไม่ได้อยู่ในโปรเจกต์นี้" />

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        title={project.name}
        description={`UAT · ${cases?.filter((c) => c.status !== 'closed').length ?? 0} เคสเปิดอยู่`}
        icon={FlaskConical}
        backHref="/dev/uat"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="hidden sm:block">{search(200)}</div>
            {canManage && <Button icon={Plus} onClick={() => setAdding(true)}>เพิ่มเคส</Button>}
          </div>
        }
      />
      {/* mobile: search gets its own row so the project name isn't squeezed to "A…" */}
      <div className="-mt-2 sm:hidden">{search('100%')}</div>

      {cases === null ? (
        <TechLoader />
      ) : cases.length === 0 ? (
        <EmptyState icon={<FlaskConical />} title="ยังไม่มีเคส" body="Claude ส่งเคสเข้ามาด้วย /memo ของโปรเจกต์นั้น หรือผู้จัดการกด เพิ่มเคส" />
      ) : (
        <div className="min-h-0 flex-1">
          <UatBoard cases={shown} canManage={!!canManage} onReorder={onReorder} onDrop={onDrop} onOpen={(c) => setOpen({ c })} />
        </div>
      )}

      {open && me && (
        <UatCaseModal
          key={open.c.id}
          c={open.c}
          project={project}
          canManage={!!canManage}
          userId={me}
          presetResult={open.result}
          presetRetest={open.retest}
          sortOrder={open.sortOrder}
          onChanged={load}
          onClose={(saved) => {
            setOpen(null)
            if (!saved && open.sortOrder !== undefined) setCases((prev) => (prev ? [...prev] : prev)) // บอร์ดรีเซ็ตจาก props
          }}
        />
      )}

      {adding && (
        <Modal open onClose={() => setAdding(false)} title="เพิ่มเคส" maxWidth={640}>
          <CaseForm
            onCancel={() => setAdding(false)}
            onSave={async (input) => {
              const no = await createUatCase(project.id, input)
              showToast(`เพิ่ม ${uatCode(no)} แล้ว`)
              setAdding(false)
              load()
            }}
          />
        </Modal>
      )}
    </div>
  )
}
