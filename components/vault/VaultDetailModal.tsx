'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Eye, EyeOff, History, KeyRound, ShieldCheck, Trash2, X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Button, Checkbox, EmptyState, IconButton, Modal, Select, useConfirm } from '@/components/aoo'
import { ListRow, ListRows, PersonChip, Segmented } from '@/components/shared'
import {
  deleteVault,
  revealVault,
  saveVault,
  saveVaultAccess,
  vaultLogs,
  vaultPeople,
  type VaultForm,
} from '@/lib/services/vaultService'
import { normalizeGrant, type VaultGrant, type VaultItem, type VaultLogRow, type VaultPerson, type VaultSecret } from '@/lib/vault/types'
import VaultFormModal from './VaultFormModal'
import { ACTION_LABEL, FIELD_LABEL } from './vaultLabels'

/** รหัสที่เปิดแล้วหายเองจากหน้าจอ ลืมเปิดค้างไว้ก็ไม่โชว์ต่อ */
const HIDE_AFTER_MS = 60_000

function SecretRow({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  const { showToast } = useToast()
  const [show, setShow] = useState(false)
  if (!value) return null

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    showToast(`คัดลอก${label}แล้ว`)
  }

  return (
    <ListRow
      title={<span className="font-mono break-all whitespace-pre-wrap">{masked && !show ? '••••••••••' : value}</span>}
      meta={label}
      trailing={
        <>
          {masked && <IconButton icon={show ? EyeOff : Eye} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShow(!show)} />}
          <IconButton icon={Copy} aria-label={`คัดลอก${label}`} onClick={copy} />
        </>
      }
    />
  )
}

function SecretTab({ secret, loading, onReveal }: { secret: VaultSecret | null; loading: boolean; onReveal: () => void }) {
  if (!secret) {
    return (
      <EmptyState
        icon={<KeyRound />}
        title="รหัสถูกล็อกอยู่"
        body="ระบบจะบันทึกทุกครั้งที่เปิดดู และซ่อนเองใน 1 นาที"
        action={<Button icon={Eye} loading={loading} onClick={onReveal}>เปิดดูรหัส</Button>}
      />
    )
  }
  return (
    <ListRows>
      <SecretRow label="User" value={secret.username} />
      <SecretRow label="รหัสผ่าน" value={secret.password} masked />
      <SecretRow label="เบอร์รับ OTP" value={secret.otpPhone} />
      <SecretRow label="โน้ต" value={secret.note} />
    </ListRows>
  )
}

function AccessTab({ item, onSaved }: { item: VaultItem; onSaved: () => Promise<void> }) {
  const { showToast } = useToast()
  const [people, setPeople] = useState<VaultPerson[]>([])
  const [grants, setGrants] = useState<VaultGrant[]>(item.access ?? [])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    vaultPeople().then(setPeople).catch((e) => showToast(e.message, 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rest = useMemo(() => people.filter((p) => !grants.some((g) => g.userId === p.id)), [people, grants])

  const add = (id: string) => {
    const person = people.find((p) => p.id === id)
    if (person) setGrants((g) => [...g, { userId: id, name: person.name, canView: true, canEdit: false, canDelete: false }])
  }

  const toggle = (id: string, key: 'canView' | 'canEdit' | 'canDelete', on: boolean) =>
    setGrants((list) =>
      list.map((g) => {
        if (g.userId !== id) return g
        // เอา "ดู" ออก = เอาทุกอย่างออก · ติ๊กแก้/ลบ = ต้องดูได้ด้วย
        if (key === 'canView' && !on) return { ...g, canView: false, canEdit: false, canDelete: false }
        return { ...g, ...normalizeGrant({ ...g, [key]: on }), name: g.name }
      })
    )

  const save = async () => {
    setSaving(true)
    try {
      await saveVaultAccess(item.id, grants)
      await onSaved()
      showToast('บันทึกสิทธิ์แล้ว')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Select value="" onChange={(e) => add(e.target.value)} aria-label="เพิ่มคน">
        <option value="">+ เพิ่มคนที่เข้าถึงบัญชีนี้</option>
        {rest.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>

      {grants.length === 0 ? (
        <EmptyState size="sm" icon={<ShieldCheck />} title="เฉพาะแอดมินที่เข้าถึงได้" />
      ) : (
        <ListRows>
          {grants.map((g) => (
            <ListRow
              key={g.userId}
              title={<PersonChip userId={g.userId} name={g.name ?? ''} />}
              meta={
                <span className="mt-1 flex gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-1.5"><Checkbox checked={g.canView} onChange={(on) => toggle(g.userId, 'canView', on)} /> ดู</label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5"><Checkbox checked={g.canEdit} onChange={(on) => toggle(g.userId, 'canEdit', on)} /> แก้</label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5"><Checkbox checked={g.canDelete} onChange={(on) => toggle(g.userId, 'canDelete', on)} /> ลบ</label>
                </span>
              }
              trailing={
                <IconButton
                  icon={X}
                  aria-label={`เอา ${g.name} ออก`}
                  onClick={() => setGrants((list) => list.filter((x) => x.userId !== g.userId))}
                />
              }
            />
          ))}
        </ListRows>
      )}

      <Button onClick={save} loading={saving} style={{ width: '100%' }}>บันทึกสิทธิ์</Button>
    </div>
  )
}

function LogTab({ accountId }: { accountId: string }) {
  const { showToast } = useToast()
  const [logs, setLogs] = useState<VaultLogRow[] | null>(null)

  useEffect(() => {
    vaultLogs(accountId).then(setLogs).catch((e) => showToast(e.message, 'error'))
  }, [accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!logs?.length) return <EmptyState size="sm" icon={<History />} title={logs ? 'ยังไม่มีประวัติ' : 'กำลังโหลด'} />

  return (
    <ListRows>
      {logs.map((l) => {
        const fields = l.detail?.fields?.map((f) => FIELD_LABEL[f] ?? f).join(', ')
        const when = new Date(l.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' })
        return (
          <ListRow
            key={l.id}
            title={`${l.who} · ${ACTION_LABEL[l.action]}${fields ? ` (${fields})` : ''}`}
            meta={[when, l.ip].filter(Boolean).join(' · ')}
          />
        )
      })}
    </ListRows>
  )
}

export default function VaultDetailModal({
  item,
  isAdmin,
  platforms,
  onClose,
  onChanged,
}: {
  item: VaultItem
  isAdmin: boolean
  platforms: string[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()
  const [tab, setTab] = useState('secret')
  const [secret, setSecret] = useState<VaultSecret | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [editing, setEditing] = useState<VaultForm | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const fetchSecret = useCallback(async () => {
    setRevealing(true)
    try {
      return await revealVault(item.id)
    } catch (e) {
      showToast((e as Error).message, 'error')
      return null
    } finally {
      setRevealing(false)
    }
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const reveal = async () => {
    const s = await fetchSecret()
    if (!s) return
    setSecret(s)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setSecret(null), HIDE_AFTER_MS)
  }

  const startEdit = async () => {
    const s = secret ?? (await fetchSecret())
    if (s) setEditing({ platform: item.platform, name: item.name, secret: s })
  }

  const saveEdit = async (form: VaultForm) => {
    await saveVault(item.id, form)
    setEditing(null)
    setSecret(null)
    await onChanged()
    showToast('บันทึกแล้ว')
  }

  const remove = async () => {
    const ok = await confirm({
      title: `ลบบัญชี ${item.platform} ${item.name}?`,
      description: 'รหัสที่เก็บไว้จะหายถาวร กู้คืนไม่ได้',
      confirmLabel: 'ลบบัญชี',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteVault(item.id)
      onClose()
      await onChanged()
      showToast('ลบแล้ว')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  return (
    <>
      <Modal
        open={!editing}
        onClose={onClose}
        title={`${item.platform} ${item.name}`}
        footer={
          item.perm.canEdit || item.perm.canDelete ? (
            <>
              {item.perm.canDelete && <Button variant="danger" icon={Trash2} onClick={remove}>ลบ</Button>}
              {item.perm.canEdit && <Button variant="secondary" loading={revealing} onClick={startEdit}>แก้ไข</Button>}
            </>
          ) : undefined
        }
      >
        {isAdmin && (
          <Segmented
            className="aoo-task-modal__tabs"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'secret', label: 'รหัส', icon: KeyRound },
              { value: 'access', label: 'สิทธิ์', icon: ShieldCheck },
              { value: 'log', label: 'ประวัติ', icon: History },
            ]}
          />
        )}
        {tab === 'secret' && <SecretTab secret={secret} loading={revealing} onReveal={reveal} />}
        {tab === 'access' && <AccessTab item={item} onSaved={onChanged} />}
        {tab === 'log' && <LogTab accountId={item.id} />}
      </Modal>

      <VaultFormModal
        open={!!editing}
        title={`แก้ไข ${item.platform} ${item.name}`}
        initial={editing ?? undefined}
        platforms={platforms}
        onClose={() => setEditing(null)}
        onSubmit={saveEdit}
      />
      {dialog}
    </>
  )
}
