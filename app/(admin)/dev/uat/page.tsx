'use client'

// Dev Management › UAT — รายการโปรเจกต์ที่ฉันอยู่ (แอดมินเห็นทุกโปรเจกต์ · สร้างโปรเจกต์ · จัดสมาชิกและสิทธิ์)
// เจ้าของ 3 พ.ย. 69: 1 แอป = 1 โปรเจกต์ (aoocommerce ก่อน) · คนเทส = พนักงาน amgo · คนนอกโปรเจกต์มองไม่เห็น

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FlaskConical, Plus, Settings2, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Card, EmptyState, Field, Input, Modal, Pill, SelectMenu, Toggle } from '@/components/aoo'
import { PageHeader, PersonChip, TechLoader, UserAvatar } from '@/components/shared'
import { ROLE_LABELS, type DevProject, type DevRole } from '@/lib/dev/uat'
import { createDevProject, getDevPeople, getDevProjects, removeDevMember, setDevMember, updateDevProject } from '@/lib/services/devService'

export default function DevUatProjectsPage() {
  const { userData, loading } = useAuth()
  const { showToast } = useToast()
  const me = userData?.id
  const isAdmin = userData?.role === 'admin'
  const [projects, setProjects] = useState<DevProject[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<DevProject | null>(null)

  const load = useCallback(async () => {
    if (!me) return
    try {
      setProjects(await getDevProjects(me, !!isAdmin))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }, [me, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  if (loading || !userData) return <TechLoader />
  if (!isAdmin && !userData.hasDevAccess)
    return <EmptyState icon={<FlaskConical />} title="ยังไม่ได้อยู่ในโปรเจกต์ไหน" body="ให้ผู้จัดการโปรเจกต์เพิ่มคุณเข้าไปก่อน" />

  return (
    <div className="space-y-4">
      <PageHeader
        title="UAT"
        description="เคสทดสอบของแต่ละแอป ลากการ์ดบันทึกผลได้จากมือถือ"
        icon={FlaskConical}
        actions={isAdmin ? <Button icon={Plus} onClick={() => setCreating(true)}>สร้างโปรเจกต์</Button> : undefined}
      />

      {projects === null ? (
        <TechLoader />
      ) : projects.length === 0 ? (
        <EmptyState icon={<FlaskConical />} title="ยังไม่มีโปรเจกต์" body={isAdmin ? 'สร้างโปรเจกต์แรก เช่น aoocommerce' : 'ยังไม่มีโปรเจกต์ที่คุณอยู่'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {projects.map((p) => (
            <Card key={p.id} padding={16}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Link href={`/dev/uat/${p.slug}`} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-h4)', fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--fg-3)' }}>{p.slug}{!p.isActive && ' · ปิดแล้ว'}</div>
                </Link>
                {p.myRole === 'manager' && (
                  <Button variant="ghost" size="sm" icon={Settings2} aria-label="ตั้งค่าโปรเจกต์" onClick={() => setEditing(p)} />
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                <Pill tone={p.openCases > 0 ? 'sky' : 'neutral'}>เปิดอยู่ {p.openCases} เคส</Pill>
                <Pill>{ROLE_LABELS[p.myRole]}</Pill>
              </div>
              {p.members.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                  {p.members.map((m) => (
                    <PersonChip key={m.userId} userId={m.userId} name={m.name} />
                  ))}
                </div>
              )}
              <Link href={`/dev/uat/${p.slug}`} style={{ display: 'block', marginTop: 12 }}>
                <Button variant="secondary" style={{ width: '100%' }}>เปิดบอร์ด</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <ProjectModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            load()
          }}
        />
      )}
      {editing && (
        <ProjectModal
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

/** สร้าง/แก้โปรเจกต์ + สมาชิก (ผู้จัดการ/แอดมิน) */
function ProjectModal({ project, onClose, onSaved }: { project?: DevProject; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const [slug, setSlug] = useState(project?.slug ?? '')
  const [name, setName] = useState(project?.name ?? '')
  const [productionUrl, setProductionUrl] = useState(project?.productionUrl ?? '')
  const [stagingUrl, setStagingUrl] = useState(project?.stagingUrl ?? '')
  const [isActive, setIsActive] = useState(project?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState(project?.members ?? [])
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [pick, setPick] = useState('')
  const [pickRole, setPickRole] = useState<DevRole>('tester')

  useEffect(() => {
    if (project) getDevPeople().then(setPeople).catch(() => {})
  }, [project])

  const save = async () => {
    setSaving(true)
    try {
      if (project) await updateDevProject(project.id, { name, productionUrl, stagingUrl, isActive })
      else await createDevProject({ slug, name, productionUrl, stagingUrl })
      showToast(project ? 'บันทึกแล้ว' : 'สร้างโปรเจกต์แล้ว — เปิดตั้งค่าเพื่อเพิ่มคนเทส')
      onSaved()
    } catch (e) {
      showToast((e as Error).message, 'error')
      setSaving(false)
    }
  }

  const addMember = async () => {
    if (!project || !pick) return
    try {
      await setDevMember(project.id, pick, pickRole)
      const person = people.find((p) => p.id === pick)
      setMembers((prev) => [...prev.filter((m) => m.userId !== pick), { userId: pick, name: person?.name ?? '?', avatarUrl: null, role: pickRole }])
      setPick('')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }
  const changeRole = async (userId: string, role: DevRole) => {
    if (!project) return
    try {
      await setDevMember(project.id, userId, role)
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }
  const remove = async (userId: string) => {
    if (!project) return
    try {
      await removeDevMember(project.id, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const candidates = people.filter((p) => !members.some((m) => m.userId === p.id))

  return (
    <Modal
      open
      onClose={onClose}
      title={project ? `ตั้งค่า ${project.name}` : 'สร้างโปรเจกต์'}
      maxWidth={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>ปิด</Button>
          <Button onClick={save} loading={saving} disabled={!name.trim() || (!project && !/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug))}>
            {project ? 'บันทึก' : 'สร้าง'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="slug (ชื่อโฟลเดอร์ repo — Claude ใช้ส่งเคสเข้ามา)" required help={project ? 'เปลี่ยนไม่ได้' : 'ตัวพิมพ์เล็ก ตัวเลข ขีด เช่น aoocommerce'}>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={!!project} placeholder="aoocommerce" />
        </Field>
        <Field label="ชื่อที่แสดง" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="AooCommerce" />
        </Field>
        <Field label="URL ระบบจริง" help="ใช้ต่อหน้า /path ของเคสให้เป็นลิงก์">
          <Input value={productionUrl} onChange={(e) => setProductionUrl(e.target.value)} placeholder="https://app.aoocommerce.com" inputMode="url" />
        </Field>
        <Field label="URL ระบบทดสอบ (staging)">
          <Input value={stagingUrl} onChange={(e) => setStagingUrl(e.target.value)} placeholder="https://staging.aoocommerce.com" inputMode="url" />
        </Field>
        {project && (
          <>
            <Field label="สถานะ" asDiv>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Toggle checked={isActive} onChange={setIsActive} /><span>{isActive ? 'ใช้งานอยู่' : 'ปิดโปรเจกต์'}</span></div>
            </Field>
            <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 12 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 'var(--fs-caption)', fontWeight: 700 }}>สมาชิก</h4>
              <div style={{ display: 'grid', gap: 6 }}>
                {members.map((m) => (
                  <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0 }}><PersonChip userId={m.userId} name={m.name} /></span>
                    <span className="w-[130px] shrink-0">
                      <SelectMenu size="sm" value={m.role} options={(Object.keys(ROLE_LABELS) as DevRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} onChange={(v) => v && changeRole(m.userId, v as DevRole)} />
                    </span>
                    <Button variant="ghost" size="sm" icon={X} aria-label="เอาออก" onClick={() => remove(m.userId)} />
                  </div>
                ))}
                {members.length === 0 && <p style={{ margin: 0, color: 'var(--fg-3)', fontSize: 'var(--fs-caption)' }}>ยังไม่มีสมาชิก</p>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
                <span className="min-w-0 flex-1">
                  <SelectMenu
                    size="sm"
                    value={pick || null}
                    placeholder="เลือกพนักงาน…"
                    options={candidates.map((p) => ({ value: p.id, label: p.name, icon: <UserAvatar userId={p.id} name={p.name} size="xs" /> }))}
                    onChange={(v) => setPick(v ?? '')}
                  />
                </span>
                <span className="w-[130px] shrink-0">
                  <SelectMenu size="sm" value={pickRole} options={(Object.keys(ROLE_LABELS) as DevRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} onChange={(v) => v && setPickRole(v as DevRole)} />
                </span>
                <Button variant="secondary" size="sm" icon={UserPlus} onClick={addMember} disabled={!pick}>เพิ่ม</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
