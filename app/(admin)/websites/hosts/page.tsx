'use client'

// AOO Website — โฮสต์ (1 บัญชี Hostinger/SiteGround = 1 แถว)
//
// ใส่ข้อมูล SSH ครั้งเดียวต่อโฮสต์ แล้วกด "สแกนรายชื่อเว็บ" — ระบบจะ ls
// โฟลเดอร์ domains เอง แล้วผูกให้ว่าเว็บไหนอยู่โฮสต์ไหน + path จริง
// เว็บที่ยังไม่มีในระบบจะถูกสร้างให้ ไม่ต้องคีย์เอง

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardPaste, Copy, KeyRound, Plus, RadioTower, Search, Server, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Checkbox, Field, Input, Modal, SelectMenu, Textarea } from '@/components/aoo'
import { DataTable, PageHeader, SectionCard, TechLoader, type Column } from '@/components/shared'
import {
  clearHostSecret,
  createSshKey,
  deleteHost,
  deleteSshKey,
  getSshKeys,
  enqueueJobs,
  getHosts,
  runQueueNow,
  saveHost,
  setHostSecret,
  type SshKey,
  type WebHost,
} from '@/lib/services/web/webService'

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function WebHostsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [hosts, setHosts] = useState<WebHost[] | null>(null)
  const [draft, setDraft] = useState<Partial<WebHost> | null>(null)
  const [password, setPassword] = useState('')
  const [keys, setKeys] = useState<SshKey[]>([])
  const [keyDraft, setKeyDraft] = useState<{ name: string; provider: string; privateKey: string } | null>(null)
  const [pasteText, setPasteText] = useState<string | null>(null)
  const [pasteKeyId, setPasteKeyId] = useState<string | null>(null)
  const [busy, setBusy] = useState('')

  const canSee = !!userData && !!userData.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () => {
    getHosts()
      .then(setHosts)
      .catch((e) => showToast(e.message, 'error'))
    getSshKeys()
      .then(setKeys)
      .catch(() => {})
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  const submit = async () => {
    if (!draft?.name?.trim() || !draft.sshHost?.trim() || !draft.sshUser?.trim()) {
      return showToast('ต้องมีชื่อ, SSH host และผู้ใช้', 'error')
    }
    try {
      await saveHost(draft)
      // รหัสผ่านไปคนละทาง — ผ่าน API ที่เข้ารหัสก่อนเขียนลงตารางลับ
      if (password.trim() && draft.id) await setHostSecret(draft.id, { password: password.trim() })
      const pending = !!password.trim() && !draft.id
      setDraft(null)
      setPassword('')
      load()
      showToast(pending ? 'บันทึกโฮสต์แล้ว — เปิดแก้ไขอีกครั้งเพื่อใส่รหัสผ่าน' : 'บันทึกแล้ว', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  // สแกน = สร้าง job ระดับโฮสต์ แล้วเร่งคิวให้ทำเดี๋ยวนี้เลย (ไม่ต้องรอ cron)
  const discover = async (hostId?: string) => {
    setBusy(hostId ?? 'all')
    try {
      const { jobs } = await enqueueJobs({ type: 'discover', hostId })
      showToast(`เข้าคิวสำรวจ ${jobs} โฮสต์ กำลังเริ่ม...`, 'success')
      await runQueueNow()
      load()
      showToast('สำรวจเสร็จแล้ว — ดูผลที่หน้ารายการเว็บ', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  /**
   * อ่านข้อมูล SSH ที่ก๊อปมาจากแผงควบคุมโฮสต์ — รองรับ 2 รูปแบบที่เจอจริง
   *   SiteGround: Hostname: ssh.x.com / Username: u123-abc / Port: 18765
   *   Hostinger:  ssh -p 65002 u976928005@77.37.81.146
   * คั่นแต่ละโฮสต์ด้วยบรรทัดว่าง วางทีเดียวหลายอันได้
   */
  const parseHosts = (text: string) => {
    const out: Partial<WebHost>[] = []
    for (const block of text.split(/\n\s*\n/)) {
      const t = block.trim()
      if (!t) continue

      const cli = t.match(/ssh\s+-p\s*(\d+)\s+([^@\s]+)@([^\s]+)/i)
      if (cli) {
        out.push({
          name: cli[2],
          provider: 'Hostinger',
          sshHost: cli[3],
          sshPort: Number(cli[1]),
          sshUser: cli[2],
          domainsPath: 'domains',
        })
        continue
      }

      const host = t.match(/Hostname:\s*(\S+)/i)?.[1]
      const user = t.match(/Username:\s*(\S+)/i)?.[1]
      const port = Number(t.match(/Port:\s*(\d+)/i)?.[1] ?? 22)
      if (host && user) {
        const siteGround = port === 18765 || host.startsWith('ssh.')
        out.push({
          name: host.replace(/^ssh\./, ''),
          provider: siteGround ? 'SiteGround' : '',
          sshHost: host,
          sshPort: port,
          sshUser: user,
          // SiteGround วางเว็บไว้ใต้ ~/www · Hostinger ใต้ ~/domains
          domainsPath: siteGround ? 'www' : 'domains',
        })
      }
    }
    return out
  }

  const submitPaste = async () => {
    const list = parseHosts(pasteText ?? '')
    if (!list.length) return showToast('อ่านข้อมูลไม่ออก — วางทั้งบล็อก Hostname/Username/Port มาเลย', 'error')
    try {
      for (const h of list) await saveHost({ ...h, keyId: pasteKeyId, backupKeep: 3, isActive: true })
      setPasteText(null)
      load()
      showToast(`เพิ่ม ${list.length} โฮสต์แล้ว — กดสแกนรายชื่อเว็บต่อได้เลย`, 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const columns: Column<WebHost>[] = [
    {
      key: 'name',
      header: 'โฮสต์',
      mobilePrimary: true,
      cell: (h) => (
        <div>
          <p className="font-medium text-gray-900">{h.name}</p>
          <p className="text-xs text-gray-400">
            {h.provider} · {h.sshUser}@{h.sshHost}:{h.sshPort}
            <span
              className={`ml-1.5 rounded px-1.5 py-0.5 text-xs ${
                h.isOwnBusiness ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {h.isOwnBusiness ? 'ของเราเอง' : 'ของลูกค้า'}
            </span>
          </p>
          <p className="mt-0.5 text-xs">
            {h.keyId ? (
              <span className="text-green-600">🔐 กุญแจ: {h.keyName || 'ไม่ทราบชื่อ'}</span>
            ) : h.hasPassword ? (
              <span className="text-green-600">🔑 ใช้รหัสผ่านที่ตั้งไว้</span>
            ) : (
              <span className="text-gray-400">ใช้กุญแจกลาง (แปะ public key ที่โฮสต์)</span>
            )}
          </p>
        </div>
      ),
    },
    {
      key: 'sites',
      header: 'เว็บ',
      align: 'center',
      cell: (h) => <span className="font-medium text-gray-700">{h.siteCount ?? 0}</span>,
    },
    {
      key: 'path',
      header: 'โฟลเดอร์',
      hideOnMobile: true,
      cell: (h) => <span className="text-gray-600">~/{h.domainsPath}</span>,
    },
    {
      key: 'backup',
      header: 'เก็บ backup',
      align: 'center',
      hideOnMobile: true,
      cell: (h) => <span className="text-gray-600">{h.backupKeep} ไฟล์</span>,
    },
    {
      key: 'scan',
      header: 'สำรวจล่าสุด',
      hideOnMobile: true,
      cell: (h) => <span className="text-xs text-gray-500">{fmt(h.lastDiscoveredAt)}</span>,
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (h) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => discover(h.id)} disabled={busy === h.id}>
            <Search size={13} />
            {busy === h.id ? 'กำลังสำรวจ...' : 'สแกนรายชื่อเว็บ'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPassword('')
              setDraft(h)
            }}
          >
            แก้
          </Button>
          <button
            onClick={() => {
              if (confirm(`ลบโฮสต์ ${h.name}? (เว็บที่ผูกอยู่จะไม่ถูกลบ แค่หลุดการผูก)`))
                deleteHost(h.id).then(load)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
            aria-label="ลบโฮสต์"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  if (!canSee || !hosts) return <TechLoader />

  return (
    <div>
      <PageHeader
        backHref="/websites"
        title="โฮสต์"
        description="ใส่ SSH ครั้งเดียวต่อบัญชีโฮสต์ — เว็บทั้งหมดใต้บัญชีนั้นใช้ค่านี้ร่วมกัน"
        icon={Server}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPasteText('')}>
              <ClipboardPaste size={15} />
              วางข้อมูล SSH
            </Button>
            <Button variant="secondary" onClick={() => discover()} disabled={!!busy || !hosts.length}>
              <RadioTower size={15} />
              สำรวจทุกโฮสต์
            </Button>
            <Button onClick={() => {
                setPassword('')
                setDraft({ provider: 'Hostinger', sshPort: 65002, domainsPath: 'domains', backupKeep: 3, isActive: true })
              }}>
              <Plus size={15} />
              เพิ่มโฮสต์
            </Button>
          </div>
        }
      />

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>ระบบไม่ถามรหัสผ่านตอนทำงาน</strong> — งานพวกนี้รันเองบนเซิร์ฟเวอร์ (cron ตี 2 ก็ต้องทำได้)
        เลือกได้ 2 ทางต่อโฮสต์:
        <br />
        1) <strong>ตั้งรหัสผ่าน</strong>ในหน้าแก้ไขโฮสต์ (เก็บฝั่งเซิร์ฟเวอร์ เบราว์เซอร์อ่านกลับไม่ได้) — ง่ายสุด
        <br />
        2) <strong>ใช้กุญแจ</strong> เอา public key ไปแปะที่โฮสต์ แล้วตั้ง{' '}
        <code className="rounded bg-white px-1">WP_SSH_PRIVATE_KEY</code> ใน environment — ปลอดภัยกว่า
        เพราะเพิกถอนได้ทีละเครื่อง
      </div>

      <SectionCard
        className="mb-5"
        title={
          <div className="flex items-center justify-between">
            <span>กุญแจ SSH (1 ดอกต่อผู้ให้บริการ)</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setKeyDraft({ name: '', provider: '', privateKey: '' })}
            >
              <Plus size={14} />
              สร้าง/นำเข้ากุญแจ
            </Button>
          </div>
        }
        description="สร้างที่นี่ แล้วก๊อป public key ไปแปะที่แผงควบคุมของโฮสต์ — ดอกเดียวใช้ได้หลายโฮสต์"
      >
        {keys.length === 0 ? (
          <p className="py-3 text-center text-sm text-gray-400">ยังไม่มีกุญแจ</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">
                    <KeyRound size={13} className="mr-1 inline text-gray-400" />
                    {k.name}
                    {k.provider && <span className="ml-1 text-xs text-gray-400">· {k.provider}</span>}
                    <span className="ml-2 text-xs text-gray-400">ใช้อยู่ {k.hostCount} โฮสต์</span>
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(k.publicKey)
                        showToast('คัดลอก public key แล้ว', 'success')
                      }}
                    >
                      <Copy size={13} />
                      ก๊อป public key
                    </Button>
                    <button
                      onClick={() => {
                        if (confirm(`ลบกุญแจ ${k.name}? โฮสต์ที่ใช้อยู่จะต่อไม่ได้จนกว่าจะเลือกใหม่`))
                          deleteSshKey(k.id).then(load)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="ลบกุญแจ"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <code className="block overflow-x-auto whitespace-nowrap rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                  {k.publicKey || '(นำเข้ามาโดยไม่มี public key)'}
                </code>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <DataTable columns={columns} rows={hosts} rowKey={(h) => h.id} emptyTitle="ยังไม่มีโฮสต์" />

      {pasteText !== null && (
        <Modal open onClose={() => setPasteText(null)} title="วางข้อมูล SSH จากแผงควบคุมโฮสต์">
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              ก๊อปบล็อก SSH Credentials จากโฮสต์มาวางได้เลย · หลายโฮสต์ก็ได้ คั่นด้วยบรรทัดว่าง ·
              ระบบเดาผู้ให้บริการ/โฟลเดอร์ให้เอง (SiteGround = ~/www · Hostinger = ~/domains)
            </p>
            <Textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Hostname: ssh.example.com\nUsername: u2327-xxxx\nPort: 18765\n\nssh -p 65002 u976928005@77.37.81.146'}
              autoFocus
            />
            <Field label="ใช้กุญแจดอกไหน">
              <SelectMenu
                size="md"
                value={pasteKeyId}
                options={keys.map((k) => ({
                  value: k.id,
                  label: `${k.name}${k.provider ? ` (${k.provider})` : ''}`,
                }))}
                placeholder="เลือกกุญแจ"
                clearable="ไม่ใช้กุญแจ"
                onChange={setPasteKeyId}
              />
            </Field>
            {pasteText.trim() && (
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                อ่านได้ {parseHosts(pasteText).length} โฮสต์:{' '}
                {parseHosts(pasteText)
                  .map((h) => `${h.name} (${h.provider || '?'})`)
                  .join(' · ')}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setPasteText(null)}>
                ยกเลิก
              </Button>
              <Button onClick={submitPaste}>เพิ่มโฮสต์</Button>
            </div>
          </div>
        </Modal>
      )}

      {keyDraft && (
        <Modal open onClose={() => setKeyDraft(null)} title="สร้าง / นำเข้ากุญแจ SSH">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ชื่อกุญแจ">
                <Input
                  value={keyDraft.name}
                  onChange={(e) => setKeyDraft({ ...keyDraft, name: e.target.value })}
                  placeholder="aoo-hostinger"
                  autoFocus
                />
              </Field>
              <Field label="ผู้ให้บริการ">
                <Input
                  value={keyDraft.provider}
                  onChange={(e) => setKeyDraft({ ...keyDraft, provider: e.target.value })}
                  placeholder="Hostinger / SiteGround"
                />
              </Field>
            </div>
            <Field label="private key ที่มีอยู่แล้ว (เว้นว่าง = ให้ระบบสร้างคู่ใหม่ให้)">
              <Textarea
                rows={3}
                value={keyDraft.privateKey}
                onChange={(e) => setKeyDraft({ ...keyDraft, privateKey: e.target.value })}
                placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----'}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setKeyDraft(null)}>
                ยกเลิก
              </Button>
              <Button
                onClick={async () => {
                  if (!keyDraft.name.trim()) return showToast('ต้องตั้งชื่อกุญแจ', 'error')
                  try {
                    const k = await createSshKey({
                      name: keyDraft.name,
                      provider: keyDraft.provider,
                      privateKey: keyDraft.privateKey.trim() || undefined,
                    })
                    setKeyDraft(null)
                    load()
                    showToast(
                      k.publicKey ? 'สร้างแล้ว — ก๊อป public key ไปแปะที่โฮสต์ได้เลย' : 'นำเข้ากุญแจแล้ว',
                      'success'
                    )
                  } catch (e) {
                    showToast((e as Error).message, 'error')
                  }
                }}
              >
                บันทึก
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {draft && (
        <Modal open onClose={() => setDraft(null)} title={draft.id ? 'แก้ไขโฮสต์' : 'เพิ่มโฮสต์'}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ชื่อบัญชี">
                <Input
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="u276288362"
                />
              </Field>
              <Field label="ผู้ให้บริการ">
                <Input
                  value={draft.provider ?? ''}
                  onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
                  placeholder="Hostinger"
                />
              </Field>
              <Field label="SSH host">
                <Input
                  value={draft.sshHost ?? ''}
                  onChange={(e) => setDraft({ ...draft, sshHost: e.target.value })}
                  placeholder="145.79.26.55"
                />
              </Field>
              <Field label="พอร์ต">
                <Input
                  value={String(draft.sshPort ?? 22)}
                  onChange={(e) => setDraft({ ...draft, sshPort: Number(e.target.value) || 22 })}
                />
              </Field>
              <Field label="ผู้ใช้ SSH">
                <Input
                  value={draft.sshUser ?? ''}
                  onChange={(e) => setDraft({ ...draft, sshUser: e.target.value })}
                  placeholder="u276288362"
                />
              </Field>
              <Field label="โฟลเดอร์เว็บ (จาก home)">
                <Input
                  value={draft.domainsPath ?? ''}
                  onChange={(e) => setDraft({ ...draft, domainsPath: e.target.value })}
                  placeholder="domains"
                />
              </Field>
              <Field label="เก็บ backup กี่ไฟล์">
                <Input
                  value={String(draft.backupKeep ?? 3)}
                  onChange={(e) => setDraft({ ...draft, backupKeep: Number(e.target.value) || 3 })}
                />
              </Field>
            </div>
            <Field label="กุญแจที่ใช้">
              <SelectMenu
                size="md"
                value={draft.keyId ?? null}
                options={keys.map((k) => ({
                  value: k.id,
                  label: `${k.name}${k.provider ? ` (${k.provider})` : ''}`,
                }))}
                placeholder="ยังไม่เลือกกุญแจ"
                clearable="ไม่ใช้กุญแจ (ใช้รหัสผ่าน)"
                onChange={(v) => setDraft({ ...draft, keyId: v })}
              />
            </Field>
            <Field
              label={
                draft.hasPassword ? 'รหัสผ่าน SSH (ตั้งไว้แล้ว — กรอกใหม่เพื่อเปลี่ยน)' : 'รหัสผ่าน SSH'
              }
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={draft.id ? 'เว้นว่าง = ไม่เปลี่ยน' : 'บันทึกโฮสต์ก่อน แล้วค่อยตั้งรหัส'}
                autoComplete="new-password"
                disabled={!draft.id}
              />
            </Field>
            <p className="-mt-1 text-xs text-gray-400">
              ลำดับที่ระบบใช้: กุญแจที่เลือก → รหัสผ่านของโฮสต์นี้ → กุญแจกลางใน environment ·
              ทุกค่าเข้ารหัส AES-256 ก่อนเก็บ (กุญแจถอดอยู่ใน env ไม่ได้อยู่ใน DB) อ่านกลับจากหน้าเว็บไม่ได้
              {draft.hasPassword && (
                <>
                  {' · '}
                  <button
                    onClick={async () => {
                      await clearHostSecret(draft.id!, 'password')
                      setDraft({ ...draft, hasPassword: false })
                      load()
                      showToast('ลบรหัสผ่านแล้ว', 'success')
                    }}
                    className="text-red-500 underline"
                  >
                    ลบรหัสผ่านของโฮสต์นี้
                  </button>
                </>
              )}
            </p>

            <div className="flex gap-5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={draft.hardened ?? false}
                  onChange={(v) => setDraft({ ...draft, hardened: v })}
                />
                ทำ hardening แล้ว
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={draft.isOwnBusiness ?? false}
                  onChange={(v) => setDraft({ ...draft, isOwnBusiness: v })}
                />
                เว็บธุรกิจของเราเอง (ไม่ใช่ของลูกค้า — ไม่ต้องออกบิล)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={draft.isActive ?? true}
                  onChange={(v) => setDraft({ ...draft, isActive: v })}
                />
                ใช้งานอยู่
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(null)
                  setPassword('')
                }}
              >
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
