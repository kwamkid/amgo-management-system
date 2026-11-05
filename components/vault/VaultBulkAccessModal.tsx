'use client'

import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button, EmptyState, Modal } from '@/components/aoo'
import { InfoPanel } from '@/components/shared'
import type { VaultGrant } from '@/lib/vault/types'
import GrantEditor from './GrantEditor'

/** ตั้งสิทธิ์ทีละหลายบัญชี · เปลี่ยนเฉพาะคนที่เลือกในหน้านี้ คนอื่นคงสิทธิ์เดิม */
export default function VaultBulkAccessModal({
  open,
  count,
  onClose,
  onSave,
}: {
  open: boolean
  count: number
  onClose: () => void
  onSave: (grants: VaultGrant[]) => Promise<void>
}) {
  const [grants, setGrants] = useState<VaultGrant[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setGrants([])
      setError('')
    }
  }, [open])

  const removing = grants.filter((g) => !g.canView).length

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(grants)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`ตั้งสิทธิ์ ${count} บัญชี`}
      description="เปลี่ยนเฉพาะคนที่เลือกในหน้านี้ คนอื่นคงสิทธิ์เดิม"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={save} loading={saving} disabled={!grants.length}>บันทึกสิทธิ์</Button>
        </>
      }
    >
      <div className="space-y-3">
        <GrantEditor
          grants={grants}
          onChange={setGrants}
          empty={<EmptyState size="sm" icon={<UserPlus />} title="เลือกคนที่จะให้สิทธิ์" body="ไม่ติ๊กอะไรเลย = เอาสิทธิ์คนนั้นออกจากบัญชีที่เลือก" />}
        />
        {removing > 0 && <InfoPanel tone="warning">{removing} คนจะถูกเอาสิทธิ์ออกจากบัญชีที่เลือก</InfoPanel>}
        {error && <InfoPanel tone="danger">{error}</InfoPanel>}
      </div>
    </Modal>
  )
}
