'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Input, Modal, SelectMenu, Textarea } from '@/components/aoo'
import { EMPTY_SECRET, type VaultSecret } from '@/lib/vault/types'
import type { VaultForm } from '@/lib/services/vaultService'

/** เพิ่ม/แก้บัญชี · ปิด autofill ไม่ให้เบราว์เซอร์จำรหัสร้านลงเครื่องพนักงาน */
export default function VaultFormModal({
  open,
  title,
  initial,
  platforms,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  initial?: VaultForm
  platforms: string[]
  onClose: () => void
  onSubmit: (form: VaultForm) => Promise<void>
}) {
  const [platform, setPlatform] = useState('')
  const [name, setName] = useState('')
  const [secret, setSecret] = useState<VaultSecret>(EMPTY_SECRET)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPlatform(initial?.platform ?? '')
    setName(initial?.name ?? '')
    setSecret(initial?.secret ?? EMPTY_SECRET)
    setShowPassword(false)
    setError('')
  }, [open, initial])

  const options = useMemo(
    () => [...new Set([...platforms, platform].filter(Boolean))].map((p) => ({ value: p, label: p })),
    [platforms, platform]
  )

  const set = (key: keyof VaultSecret) => (e: { target: { value: string } }) =>
    setSecret((s) => ({ ...s, [key]: e.target.value }))

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      await onSubmit({ platform, name, secret })
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
      title={title}
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} loading={saving} disabled={!platform || (!name.trim() && !secret.username.trim())}>บันทึก</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="แพลตฟอร์ม" asDiv>
            <SelectMenu
              value={platform || null}
              options={options}
              onChange={(v) => setPlatform(v ?? '')}
              onCreate={setPlatform}
              placeholder="เลือกหรือพิมพ์เพิ่ม"
            />
          </Field>
          <Field label="ชื่อร้าน / แบรนด์">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ABC" autoComplete="off" />
          </Field>
        </div>
        <Field label="User">
          <Input value={secret.username} onChange={set('username')} autoComplete="off" name="vault-user" data-1p-ignore data-lpignore="true" />
        </Field>
        <Field
          label="รหัสผ่าน"
          asDiv
          labelExtra={
            <Button variant="link" size="sm" type="button" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'ซ่อน' : 'แสดง'}
            </Button>
          }
        >
          <Input
            type={showPassword ? 'text' : 'password'}
            value={secret.password}
            onChange={set('password')}
            autoComplete="new-password"
            name="vault-pass"
            data-1p-ignore
            data-lpignore="true"
          />
        </Field>
        <Field label="เบอร์รับ OTP">
          <Input value={secret.otpPhone} onChange={set('otpPhone')} autoComplete="off" inputMode="tel" />
        </Field>
        <Field label="โน้ต" error={error || undefined}>
          <Textarea value={secret.note} onChange={set('note')} rows={3} />
        </Field>
      </div>
    </Modal>
  )
}
