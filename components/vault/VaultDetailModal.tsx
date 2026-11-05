'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Eye, EyeOff, History, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Button, EmptyState, IconButton, Modal, useConfirm } from '@/components/aoo'
import { ListRow, ListRows, Segmented } from '@/components/shared'
import {
  deleteVault,
  revealVault,
  saveVault,
  saveVaultAccess,
  vaultLogs,
  type VaultForm,
} from '@/lib/services/vaultService'
import type { VaultGrant, VaultItem, VaultLogRow, VaultSecret } from '@/lib/vault/types'
import GrantEditor from './GrantEditor'
import VaultFormModal from './VaultFormModal'
import { ACTION_LABEL, FIELD_LABEL } from './vaultLabels'

/** รหัสที่เปิดแล้วหายเองจากหน้าจอ ลืมเปิดค้างไว้ก็ไม่โชว์ต่อ */
const HIDE_AFTER_MS = 60_000

/** แถวเดียว: ชื่อช่อง · ค่า · ปุ่มคัดลอก · ไม่มีค่า = ขีด จะได้เห็นว่าบัญชีนี้ไม่ได้กรอกช่องนั้น */
function SecretRow({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  const { showToast } = useToast()
  const [show, setShow] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    showToast(`คัดลอก${label}แล้ว`)
  }

  return (
    <div className="grid min-h-9 grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2 border-b border-gray-100 py-1 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="break-all font-mono text-sm whitespace-pre-wrap">
        {!value ? '—' : masked && !show ? '••••••••••' : value}
      </span>
      {value ? (
        <span className="flex items-center">
          {masked && <IconButton icon={show ? EyeOff : Eye} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShow(!show)} />}
          <IconButton icon={Copy} aria-label={`คัดลอก${label}`} onClick={copy} />
        </span>
      ) : (
        <span />
      )}
    </div>
  )
}

function SecretTab({ secret, loading, onReveal }: { secret: VaultSecret | null; loading: boolean; onReveal: () => void }) {
  if (!secret) {
    if (loading) return <EmptyState size="sm" icon={<KeyRound />} title="กำลังเปิดข้อมูล" />
    return (
      <EmptyState
        icon={<KeyRound />}
        title="ซ่อนข้อมูลแล้ว"
        body="ระบบซ่อนเองหลังเปิดไว้ 1 นาที"
        action={<Button icon={Eye} onClick={onReveal}>เปิดอีกครั้ง</Button>}
      />
    )
  }
  return (
    <div>
      <SecretRow label="User" value={secret.username} />
      <SecretRow label="รหัสผ่าน" value={secret.password} masked />
      <SecretRow label="เบอร์ OTP" value={secret.otpPhone} />
      <SecretRow label="โน้ต" value={secret.note} />
    </div>
  )
}

function AccessTab({ item, onSaved }: { item: VaultItem; onSaved: () => Promise<void> }) {
  const { showToast } = useToast()
  const [grants, setGrants] = useState<VaultGrant[]>(item.access ?? [])
  const [saving, setSaving] = useState(false)

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
      <GrantEditor
        grants={grants}
        onChange={setGrants}
        empty={<EmptyState size="sm" icon={<ShieldCheck />} title="เฉพาะแอดมินที่เข้าถึงได้" />}
      />
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

  // กดแถวแล้วเห็นข้อมูลเลย (เจ้าของ 5 พ.ย. 69) · ทุกครั้งที่เปิดมีบันทึกในประวัติ
  // ref กันเปิดซ้ำตอน StrictMode รัน effect สองรอบ ไม่งั้นประวัติขึ้นซ้ำ
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    reveal()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
