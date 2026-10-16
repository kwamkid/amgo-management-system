'use client'

// กุญแจ API ให้เว็บ/ระบบอื่นดึงข้อมูล SEO / AEO ไปใช้ (เจ้าของขอ 17 ต.ค. 69)
// สร้าง → โชว์ตัวกุญแจครั้งเดียว (เก็บแค่ hash) · ผูกเว็บได้ (ไม่เลือก = ทุกเว็บ) · เพิกถอนแล้วใช้ไม่ได้ทันที
// endpoint + กติกาอยู่ที่ lib/services/seo/seoApi.ts และ app/api/seo/v1/

import { useEffect, useState } from 'react'
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Alert, Button, Checkbox, Field, IconButton, Input, Modal, Pill, useConfirm } from '@/components/aoo'
import { DataTable, SectionCard, type Column } from '@/components/shared'
import { fmtGscDate, type SeoSite } from '@/lib/services/seo/seoService'

type ApiKey = {
  id: string
  label: string
  key_prefix: string
  site_ids: string[] | null
  can_write: boolean
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

const BASE = 'https://app.amgovenger.com/api/seo/v1'

export default function ApiKeys({ sites }: { sites: SeoSite[] }) {
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [form, setForm] = useState<{ label: string; siteIds: string[]; canWrite: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  const load = () =>
    fetch('/api/seo/api-keys')
      .then((r) => r.json())
      .then((j) => (j.error ? Promise.reject(new Error(j.error)) : setKeys(j.keys)))
      .catch((e) => showToast((e as Error).message, 'error'))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async () => {
    if (!form?.label.trim()) return showToast('ตั้งชื่อกุญแจก่อน (ใช้ทำอะไร)', 'error')
    setSaving(true)
    try {
      const res = await fetch('/api/seo/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.label, siteIds: form.siteIds, canWrite: form.canWrite }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'สร้างไม่สำเร็จ')
      setForm(null)
      setCreated(j.key)
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const revoke = async (k: ApiKey) => {
    const ok = await confirm({
      title: `เพิกถอนกุญแจ "${k.label}"?`,
      description: 'เว็บที่ใช้กุญแจนี้จะดึงข้อมูลไม่ได้ทันที และย้อนกลับไม่ได้',
      confirmLabel: 'เพิกถอน',
      tone: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/seo/api-keys?id=${k.id}`, { method: 'DELETE' })
    if (!res.ok) return showToast('เพิกถอนไม่สำเร็จ', 'error')
    showToast('เพิกถอนแล้ว')
    load()
  }

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => showToast('คัดลอกแล้ว'))
  const siteName = (id: string) => sites.find((s) => s.id === id)?.displayName ?? 'เว็บที่ลบไปแล้ว'

  const columns: Column<ApiKey>[] = [
    {
      key: 'label',
      header: 'ชื่อ',
      mobilePrimary: true,
      cell: (k) => (
        <div>
          <div className="font-semibold text-gray-900">{k.label}</div>
          <div className="font-mono text-xs text-gray-400">{k.key_prefix}…</div>
        </div>
      ),
    },
    {
      key: 'sites',
      header: 'เว็บที่ดูได้',
      cell: (k) => (k.site_ids?.length ? k.site_ids.map(siteName).join(' · ') : 'ทุกเว็บ'),
    },
    {
      key: 'perm',
      header: 'สิทธิ์',
      cell: (k) => (k.can_write ? <Pill tone="warning">อ่าน + เพิ่มคำ</Pill> : <Pill tone="neutral">อ่านอย่างเดียว</Pill>),
    },
    {
      key: 'used',
      header: 'ใช้ล่าสุด',
      hideOnMobile: true,
      cell: (k) => <span className="text-sm text-gray-500">{k.last_used_at ? fmtGscDate(k.last_used_at.slice(0, 10)) : 'ยังไม่เคยใช้'}</span>,
    },
    {
      key: 'status',
      header: 'สถานะ',
      cell: (k) => (k.revoked_at ? <Pill tone="neutral">เพิกถอนแล้ว</Pill> : <Pill tone="success">ใช้งานได้</Pill>),
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (k) => (k.revoked_at ? null : <IconButton icon={Trash2} aria-label="เพิกถอน" onClick={() => revoke(k)} />),
    },
  ]

  return (
    <>
      {dialog}
      <SectionCard
        className="mt-6"
        title={
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <KeyRound size={18} /> API ให้เว็บอื่นดึงข้อมูล
            </span>
            <Button size="sm" icon={Plus} onClick={() => setForm({ label: '', siteIds: [], canWrite: false })}>
              สร้างกุญแจ
            </Button>
          </div>
        }
        description="ดึงข้อมูล SEO / AEO ชุดเดียวกับหน้านี้ไปแสดงที่อื่น เช่น dashboard ลูกค้า — เรียกจากฝั่ง server ของเว็บนั้น ห้ามใส่กุญแจในโค้ดหน้าเว็บ"
      >
        <DataTable columns={columns} rows={keys ?? []} rowKey={(k) => k.id} loading={!keys} emptyTitle="ยังไม่มีกุญแจ" />
        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <p className="mb-1 font-semibold text-gray-700">วิธีเรียก</p>
          <p className="font-mono text-xs">Authorization: Bearer &lt;กุญแจ&gt;</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-xs">
            <li>GET {BASE}/sites — เว็บที่กุญแจนี้ดูได้</li>
            <li>GET {BASE}/sites/&#123;id&#125;?days=28&amp;compare=prev|yoy — ภาพรวม (คลิก Google · อันดับ · AI)</li>
            <li>GET {BASE}/sites/&#123;id&#125;/keywords — อันดับรายคำ + เหตุผล</li>
            <li>GET {BASE}/sites/&#123;id&#125;/ai — AI แต่ละตัวอ้างเราข้อไหน + AI Overview เทียบคู่แข่ง</li>
            <li>POST {BASE}/sites/&#123;id&#125;/keywords — เพิ่มคำเป้าหมาย (กุญแจที่เปิดสิทธิ์) body: &#123; &quot;keywords&quot;: [&quot;คำ1&quot;, &quot;คำ2&quot;], &quot;targetPath&quot;: &quot;/หน้า/&quot; &#125;</li>
          </ul>
        </div>
      </SectionCard>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="สร้างกุญแจ API"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              ยกเลิก
            </Button>
            <Button loading={saving} onClick={create}>
              สร้าง
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <Field label="ชื่อ (ใช้ทำอะไร)" required>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="เช่น dashboard ลูกค้า aDay Fresh" />
            </Field>
            <Field label="เว็บที่ดูได้" help="ไม่เลือกเลย = ดูได้ทุกเว็บ" asDiv>
              <div className="space-y-2">
                {sites.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.siteIds.includes(s.id)}
                      onChange={(on) =>
                        setForm({ ...form, siteIds: on ? [...form.siteIds, s.id] : form.siteIds.filter((x) => x !== s.id) })
                      }
                    />
                    {s.displayName}
                  </label>
                ))}
              </div>
            </Field>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox checked={form.canWrite} onChange={(on) => setForm({ ...form, canWrite: on })} />
              <span>
                <span className="font-semibold text-gray-900">ให้เพิ่มคำเป้าหมายได้ด้วย</span>
                <span className="block text-gray-500">ทุกคำที่เพิ่มเสียเงินเช็คอันดับทุกสัปดาห์ (~$0.006/คำ/รอบ) · ครั้งละไม่เกิน 100 คำ</span>
              </span>
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="กุญแจใหม่"
        footer={<Button onClick={() => setCreated(null)}>เก็บแล้ว ปิดได้</Button>}
      >
        {created && (
          <div className="space-y-3">
            <Alert tone="warning">คัดลอกเก็บไว้ตอนนี้ — ระบบเก็บแค่รหัสย่อ ปิดหน้าต่างนี้แล้วจะดูกุญแจเต็มอีกไม่ได้</Alert>
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
              <code className="min-w-0 flex-1 break-all text-sm">{created}</code>
              <IconButton icon={Copy} aria-label="คัดลอก" onClick={() => copy(created)} />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
