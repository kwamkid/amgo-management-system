'use client'

// บอร์ดบั๊กของโปรเจกต์หนึ่ง — แจ้งบั๊ก (ผู้เทส/ผู้จัดการ) · ลากย้ายสถานะ · ค้นหาเลข/ชื่อ
// ลิงก์จากแจ้งเตือน /dev/bugs/<slug>?bug=<id> → เปิดบั๊กนั้นเลย

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, Input, Modal } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import BugBoard from '@/components/dev/BugBoard'
import BugModal, { BugForm } from '@/components/dev/BugModal'
import type { KanbanDrop } from '@/components/dev/DevKanban'
import { bugCode, isOpenBug, type BugColumnKey, type BugStatus, type DevBug } from '@/lib/dev/bugs'
import type { DevProject } from '@/lib/dev/uat'
import { getDevProject } from '@/lib/services/devService'
import { createBug, getBugs, moveBug, setBugStatus } from '@/lib/services/devBugService'
import { notifyBug } from '@/lib/dev/notify'

/** ลากมาช่องไหน = สถานะอะไร (ปิดแล้ว = ปิด · ผู้จัดการเลือก "ไม่แก้" ได้ในหน้าต่าง) */
const COLUMN_STATUS: Record<BugColumnKey, BugStatus> = { new: 'new', accepted: 'accepted', fixing: 'fixing', testing: 'testing', closed: 'closed' }

export default function DevBugBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const me = userData?.id
  const isAdmin = userData?.role === 'admin'

  const [project, setProject] = useState<DevProject | null | undefined>(undefined)
  const [bugs, setBugs] = useState<DevBug[] | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<{ b: DevBug; status?: BugStatus; sortOrder?: number } | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    if (!me) return
    try {
      const p = await getDevProject(slug, me, !!isAdmin)
      setProject(p)
      if (p) setBugs(await getBugs(p.id))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, [me, isAdmin, slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  // ลิงก์จากแจ้งเตือน → เปิดบั๊ก (ครั้งเดียว) · เปิดหน้าต่างค้างอยู่ → ใช้ข้อมูลใหม่หลังโหลด
  const [deepLinked, setDeepLinked] = useState(false)
  useEffect(() => {
    if (!bugs) return
    if (!deepLinked) {
      setDeepLinked(true)
      const id = new URLSearchParams(window.location.search).get('bug')
      const hit = id && bugs.find((b) => b.id === id)
      if (hit) setOpen({ b: hit })
      return
    }
    setOpen((o) => (o ? { ...o, b: bugs.find((b) => b.id === o.b.id) ?? o.b } : o))
  }, [bugs]) // eslint-disable-line react-hooks/exhaustive-deps

  const canManage = project?.myRole === 'manager'
  const canTest = canManage || project?.myRole === 'tester'

  const shown = useMemo(() => {
    if (!bugs) return []
    const s = q.trim().toLowerCase()
    if (!s) return bugs
    const no = Number(s.replace(/^bug-?/i, ''))
    return bugs.filter((b) => (Number.isInteger(no) && b.no === no) || b.title.toLowerCase().includes(s))
  }, [bugs, q])

  const onReorder = async (id: string, sortOrder: number) => {
    setBugs((prev) => prev?.map((b) => (b.id === id ? { ...b, sortOrder } : b)) ?? prev)
    try {
      await moveBug(id, sortOrder)
    } catch (e) {
      showToast((e as Error).message, 'error')
      load()
    }
  }

  // ย้ายที่ต้องมีข้อความ (→ รอเทส: แก้อะไร · รอเทส → กำลังแก้: เจออะไร · → ปิดแล้ว) เปิดหน้าต่าง · ที่เหลือย้ายเลย
  const onDrop = async (d: KanbanDrop<BugColumnKey>) => {
    const b = bugs?.find((x) => x.id === d.id)
    if (!b) return
    const to = COLUMN_STATUS[d.column]
    if (!canManage || to === 'testing' || to === 'closed' || (to === 'fixing' && b.status === 'testing')) {
      setOpen({ b, status: to, sortOrder: d.sortOrder })
      return
    }
    setBugs((prev) => prev?.map((x) => (x.id === b.id ? { ...x, status: to, sortOrder: d.sortOrder } : x)) ?? prev)
    try {
      await setBugStatus(b.id, to, null, d.sortOrder)
      notifyBug(b.id)
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
    load()
  }

  const search = (width: number | string) => (
    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลข / ชื่อบั๊ก" prefix={<Search size={16} />} style={{ width }} />
  )

  if (loading || !userData || project === undefined) return <TechLoader />
  if (!project) return <EmptyState icon={<Bug />} title="ไม่พบโปรเจกต์" body="หรือคุณยังไม่ได้อยู่ในโปรเจกต์นี้" />

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        title={project.name}
        description={`Bug report · ${bugs?.filter((b) => isOpenBug(b.status)).length ?? 0} บั๊กเปิดอยู่`}
        icon={Bug}
        backHref="/dev/bugs"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="hidden sm:block">{search(200)}</div>
            {canTest && <Button icon={Plus} onClick={() => setAdding(true)}>แจ้งบั๊ก</Button>}
          </div>
        }
      />
      <div className="-mt-2 sm:hidden">{search('100%')}</div>

      {bugs === null ? (
        <TechLoader />
      ) : bugs.length === 0 ? (
        <EmptyState icon={<Bug />} title="ยังไม่มีบั๊ก" body={canTest ? 'เจออะไรผิด กด แจ้งบั๊ก พร้อมรูป' : 'ยังไม่มีใครแจ้งบั๊กในโปรเจกต์นี้'} />
      ) : (
        <div className="min-h-0 flex-1">
          <BugBoard bugs={shown} canManage={!!canManage} canTest={!!canTest} onReorder={onReorder} onDrop={onDrop} onOpen={(b) => setOpen({ b })} />
        </div>
      )}

      {open && me && (
        <BugModal
          key={`${open.b.id}-${open.status ?? ''}`}
          bug={open.b}
          project={project}
          userId={me}
          presetStatus={open.status}
          sortOrder={open.sortOrder}
          onOpenCase={(caseId) => router.push(`/dev/uat/${project.slug}?case=${caseId}`)}
          onChanged={() => {
            notifyBug(open.b.id)
            load()
          }}
          onClose={(saved) => {
            setOpen(null)
            if (!saved && open.sortOrder !== undefined) setBugs((prev) => (prev ? [...prev] : prev)) // card snaps back
          }}
        />
      )}

      {adding && me && (
        <Modal open onClose={() => setAdding(false)} title="แจ้งบั๊ก" maxWidth={640}>
          <BugForm
            onCancel={() => setAdding(false)}
            onSave={async (input, files, keep) => {
              const { id, no } = await createBug(project.id, input, files, me, keep)
              notifyBug(id)
              showToast(`แจ้ง ${bugCode(no)} แล้ว`)
              setAdding(false)
              load()
            }}
          />
        </Modal>
      )}
    </div>
  )
}
