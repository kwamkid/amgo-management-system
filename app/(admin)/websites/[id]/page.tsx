'use client'

// AOO Website — รายละเอียดเว็บ 1 ตัว
//
// รวมทุกอย่างที่ต้องใช้ตอนดูแลไว้หน้าเดียว: ข้อมูล/วันหมดอายุ · บิลรายปี +
// สลิปที่เจ้าของเว็บอัพมา · ปลั๊กอินที่ค้างอัปเดต (ผ่าน SSH) · บันทึกงานที่ทำ

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Save,
  Terminal,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  Button,
  Checkbox,
  DatePicker,
  Field,
  Input,
  Modal,
  SelectMenu,
  Textarea,
} from '@/components/aoo'
import { DataTable, PageHeader, SectionCard, TechLoader, type Column } from '@/components/shared'
import {
  addLog,
  daysLeft,
  getHosts,
  deleteBill,
  getBills,
  getCourses,
  getLogs,
  getPlugins,
  getSite,
  getSlipsBySite,
  reviewSlip,
  saveBill,
  saveSite,
  slipUrl,
  type WebBill,
  type WebCourse,
  type WebHost,
  type WebLog,
  type WebPlugin,
  type WebSite,
  type WebSlip,
} from '@/lib/services/web/webService'

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const money = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 })

const BILL_STATUS: Record<WebBill['status'], { label: string; cls: string }> = {
  unpaid: { label: 'ยังไม่จ่าย', cls: 'bg-gray-100 text-gray-600' },
  pending_review: { label: 'รอตรวจสลิป', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'จ่ายแล้ว', cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'ปฏิเสธสลิป', cls: 'bg-red-50 text-red-600' },
}

const LOG_KIND: Record<WebLog['kind'], string> = {
  note: '📝 บันทึก',
  plugin_update: '🔌 อัปเดตปลั๊กอิน',
  core_update: '⬆️ อัปเดต WordPress',
  backup: '💾 สำรองข้อมูล',
  downtime: '🔴 เว็บล่ม',
  renewal: '🔄 ต่ออายุ',
}

export default function WebsiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [site, setSite] = useState<WebSite | null>(null)
  const [form, setForm] = useState<WebSite | null>(null)
  const [courses, setCourses] = useState<WebCourse[]>([])
  const [hosts, setHosts] = useState<WebHost[]>([])
  const [bills, setBills] = useState<WebBill[]>([])
  const [slips, setSlips] = useState<WebSlip[]>([])
  const [logs, setLogs] = useState<WebLog[]>([])
  const [plugins, setPlugins] = useState<WebPlugin[]>([])
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState('')
  const [billDraft, setBillDraft] = useState<Partial<WebBill> | null>(null)
  const [note, setNote] = useState('')
  const [viewSlip, setViewSlip] = useState<string | null>(null)

  const canSee = !!userData && !!userData.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = useCallback(() => {
    getSite(id)
      .then((s) => {
        setSite(s)
        setForm(s)
      })
      .catch((e) => showToast(e.message, 'error'))
    getBills(id).then(setBills).catch(() => {})
    getSlipsBySite(id).then(setSlips).catch(() => {})
    getLogs(id).then(setLogs).catch(() => {})
    getPlugins(id).then(setPlugins).catch(() => {})
    getCourses().then(setCourses).catch(() => {})
    getHosts().then(setHosts).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (canSee) load()
  }, [canSee, load])

  const set = <K extends keyof WebSite>(key: K, value: WebSite[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const submit = async () => {
    if (!form) return
    if (!form.siteName.trim()) return showToast('ยังไม่ได้ใส่ชื่อโดเมน', 'error')
    setSaving(true)
    try {
      await saveSite(form)
      showToast('บันทึกแล้ว', 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const checkNow = async () => {
    setBusy('uptime')
    try {
      const res = await fetch('/api/web/uptime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      showToast(json.down ? 'เว็บล่มอยู่' : 'เว็บปกติ', json.down ? 'error' : 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const scanPlugins = async (update?: string) => {
    setBusy(update ? `update:${update}` : 'plugins')
    try {
      const res = await fetch('/api/web/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: id, update }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ต่อ SSH ไม่สำเร็จ')
      showToast(update ? `อัปเดต ${update} แล้ว` : `พบปลั๊กอิน ${json.count} ตัว`, 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy('')
    }
  }

  const addNote = async () => {
    if (!note.trim()) return
    try {
      await addLog(id, note.trim(), 'note', userData?.id)
      setNote('')
      getLogs(id).then(setLogs)
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const openSlip = async (path: string) => {
    try {
      setViewSlip(await slipUrl(path))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const submitBill = async () => {
    if (!billDraft) return
    try {
      await saveBill({ ...billDraft, siteId: id })
      setBillDraft(null)
      getBills(id).then(setBills)
      showToast('บันทึกบิลแล้ว', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  if (!canSee || !site || !form) return <TechLoader />

  const billColumns: Column<WebBill>[] = [
    { key: 'year', header: 'ปี', cell: (b) => <span className="font-medium">{b.year}</span> },
    {
      key: 'period',
      header: 'รอบ',
      cell: (b) => (
        <span className="text-gray-600">
          {fmtDate(b.periodStart)} – {fmtDate(b.periodEnd)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'ยอด',
      align: 'right',
      cell: (b) => (
        <span>
          {money(b.hostingAmount + (b.billDomain ? b.domainAmount : 0))}
          <span className="ml-1 text-xs text-gray-400">
            (โฮสต์ {money(b.hostingAmount)}
            {b.billDomain ? ` + โดเมน ${money(b.domainAmount)}` : ''})
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'สถานะ',
      align: 'center',
      cell: (b) => (
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${BILL_STATUS[b.status].cls}`}>
          {BILL_STATUS[b.status].label}
        </span>
      ),
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (b) => (
        <div className="flex justify-end gap-1">
          {b.status !== 'paid' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                reviewSlip(b.id, true).then(() => getBills(id).then(setBills))
              }}
            >
              จ่ายแล้ว
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setBillDraft(b) }}>
            แก้
          </Button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`ลบบิลปี ${b.year}?`)) deleteBill(b.id).then(() => getBills(id).then(setBills))
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
            aria-label="ลบบิล"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  const expiryRow = (label: string, date: string | null) => {
    const d = daysLeft(date)
    return (
      <div className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <span
          className={`text-sm ${
            d === null ? 'text-gray-400' : d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-gray-700'
          }`}
        >
          {fmtDate(date)}
          {d !== null && (
            <span className="ml-1 text-xs opacity-80">({d < 0 ? `เลย ${-d} วัน` : `อีก ${d} วัน`})</span>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/websites"
        title={site.siteName}
        description={site.studentName || 'ยังไม่ได้ระบุเจ้าของเว็บ'}
        icon={Globe}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={checkNow} disabled={busy === 'uptime'}>
              <RefreshCw size={15} className={busy === 'uptime' ? 'animate-spin' : ''} />
              เช็คเว็บ
            </Button>
            <a href={`https://${site.siteName}`} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink size={15} />
                เปิดเว็บ
              </Button>
            </a>
            {site.wpAdminUrl && (
              <a href={site.wpAdminUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary">wp-admin</Button>
              </a>
            )}
            <Button onClick={submit} disabled={saving}>
              <Save size={15} />
              บันทึก
            </Button>
          </div>
        }
      />

      {site.downSince && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} />
          เว็บล่มตั้งแต่ {fmtDateTime(site.downSince)} — ตอบกลับล่าสุด {site.httpStatus || 'ต่อไม่ติด'}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── ข้อมูลเว็บ ── */}
        <SectionCard title="ข้อมูลเว็บ" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="โดเมน">
              <Input value={form.siteName} onChange={(e) => set('siteName', e.target.value)} />
            </Field>
            <Field label="รุ่น/คอร์ส">
              <SelectMenu
                size="md"
                value={form.courseId}
                options={courses.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="ยังไม่ระบุ"
                clearable="ไม่อยู่รุ่นไหน"
                onChange={(v) => set('courseId', v)}
              />
            </Field>
            <Field label="เจ้าของเว็บ">
              <Input value={form.studentName} onChange={(e) => set('studentName', e.target.value)} />
            </Field>
            <Field label="ติดต่อ (LINE / เบอร์ / อีเมล)">
              <Input value={form.studentContact} onChange={(e) => set('studentContact', e.target.value)} />
            </Field>
            <Field label="โฮสต์">
              <Input
                value={form.hostingProvider}
                onChange={(e) => set('hostingProvider', e.target.value)}
                placeholder="Hostinger / SiteGround"
              />
            </Field>
            <Field label="บัญชี/แพ็กเกจโฮสต์">
              <Input value={form.hostingAccount} onChange={(e) => set('hostingAccount', e.target.value)} />
            </Field>
            <Field label="ผู้รับจดโดเมน">
              <Input value={form.domainRegistrar} onChange={(e) => set('domainRegistrar', e.target.value)} />
            </Field>
            <Field label="หน้า wp-admin">
              <Input
                value={form.wpAdminUrl}
                onChange={(e) => set('wpAdminUrl', e.target.value)}
                placeholder={`https://${form.siteName}/wp-admin`}
              />
            </Field>
            <Field label="โดเมนหมดอายุ">
              <DatePicker value={form.domainExpiresAt ?? ''} onChange={(v) => set('domainExpiresAt', v)} />
            </Field>
            <Field label="โฮสต์หมดอายุ">
              <DatePicker value={form.hostingExpiresAt ?? ''} onChange={(v) => set('hostingExpiresAt', v)} />
            </Field>
            <Field label="SSL หมดอายุ">
              <DatePicker value={form.sslExpiresAt ?? ''} onChange={(v) => set('sslExpiresAt', v)} />
            </Field>
            <Field label="วันที่จดโดเมน">
              <DatePicker value={form.domainRegisteredAt ?? ''} onChange={(v) => set('domainRegisteredAt', v)} />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <Checkbox
                checked={form.domainSelfRegistered}
                onChange={(v) => set('domainSelfRegistered', v)}
              />
              เจ้าของเว็บจดโดเมนเอง (ไม่เก็บค่าโดเมน)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <Checkbox checked={form.isActive} onChange={(v) => set('isActive', v)} />
              ยังดูแลอยู่
            </label>
          </div>

          <Field label="โน้ต" className="mt-3">
            <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </SectionCard>

        {/* ── วันหมดอายุ + SSH ── */}
        <div className="space-y-5">
          <SectionCard title="วันหมดอายุ">
            {expiryRow('โดเมน', form.domainExpiresAt)}
            {expiryRow('โฮสต์', form.hostingExpiresAt)}
            {expiryRow('SSL', form.sslExpiresAt)}
            <p className="mt-2 text-xs text-gray-400">
              เตือนเข้า Discord อัตโนมัติเมื่อเหลือไม่ถึง 30 วัน
            </p>
          </SectionCard>

          <SectionCard title="สถานะเว็บ">
            <div className="flex items-center justify-between border-b border-gray-100 py-1.5">
              <span className="text-sm text-gray-500">ตอบกลับล่าสุด</span>
              <span className="text-sm text-gray-700">
                {site.httpStatus ?? '—'} · {site.responseMs ?? '—'} ms
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-500">เช็คเมื่อ</span>
              <span className="text-sm text-gray-700">{fmtDateTime(site.lastCheckedAt)}</span>
            </div>
          </SectionCard>

          <SectionCard
            title="โฮสต์"
            description="SSH เก็บที่โฮสต์ ไม่ใช่รายเว็บ — ผูกอัตโนมัติตอนกดสำรวจรายชื่อเว็บ"
          >
            <div className="space-y-3">
              <Field label="บัญชีโฮสต์">
                <SelectMenu
                  size="md"
                  value={form.hostId}
                  options={hosts.map((h) => ({
                    value: h.id,
                    label: `${h.name} (${h.provider})`,
                  }))}
                  placeholder="ยังไม่ผูกโฮสต์"
                  clearable="ไม่ผูกโฮสต์"
                  onChange={(v) => {
                    set('hostId', v)
                    // เดา path ให้ตามรูปแบบมาตรฐานของโฮสต์ ถ้ายังไม่เคยกรอก
                    const h = hosts.find((x) => x.id === v)
                    if (v && h && !form.publicHtmlPath)
                      set('publicHtmlPath', `${h.domainsPath}/${form.siteName}/public_html`)
                  }}
                />
              </Field>
              <Field label="โฟลเดอร์ WordPress (จาก home)">
                <Input
                  value={form.publicHtmlPath}
                  onChange={(e) => set('publicHtmlPath', e.target.value)}
                  placeholder="domains/example.com/public_html"
                />
              </Field>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-500">สแกนมัลแวร์ล่าสุด</span>
              <span
                className={`text-sm ${
                  site.lastScanStatus === 'suspect'
                    ? 'text-red-600'
                    : site.lastScanStatus === 'ok'
                      ? 'text-green-600'
                      : 'text-gray-400'
                }`}
              >
                {site.lastScanStatus === 'suspect'
                  ? 'พบไฟล์ต้องสงสัย'
                  : site.lastScanStatus === 'ok'
                    ? 'สะอาด'
                    : 'ยังไม่เคยสแกน'}
                {site.lastScanAt && <span className="ml-1 text-xs text-gray-400">{fmtDateTime(site.lastScanAt)}</span>}
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              ปกติกด &quot;สแกนรายชื่อเว็บ&quot; ที่หน้าโฮสต์แล้วระบบผูกให้เอง — ตรงนี้ไว้แก้มือเวลาจัดกลุ่มใหม่
              {!hosts.length && ' · ยังไม่มีโฮสต์ในระบบ ไปเพิ่มที่เมนูโฮสต์ก่อน'}
            </p>
          </SectionCard>
        </div>
      </div>

      {/* ── บิลรายปี ── */}
      <SectionCard
        title={
          <div className="flex items-center justify-between">
            <span>บิลค่าโฮสต์ + โดเมน</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setBillDraft({
                  year: new Date().getFullYear(),
                  hostingAmount: courses.find((c) => c.id === form.courseId)?.hostingAmount ?? 2000,
                  domainAmount: courses.find((c) => c.id === form.courseId)?.domainAmount ?? 600,
                  billDomain: !form.domainSelfRegistered,
                  status: 'unpaid',
                })
              }
            >
              <Plus size={14} />
              เพิ่มรอบ
            </Button>
          </div>
        }
      >
        <DataTable columns={billColumns} rows={bills} rowKey={(b) => b.id} emptyTitle="ยังไม่มีบิล" />

        {slips.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">สลิปที่อัพเข้ามา ({slips.length})</p>
            <div className="flex flex-wrap gap-2">
              {slips.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSlip(s.slipImageUrl)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  {fmtDateTime(s.uploadedAt)}
                  {s.verifyResult === 'duplicate' && <span className="ml-1 text-red-500">· สลิปซ้ำ</span>}
                  {s.verifyResult === 'unreadable' && <span className="ml-1 text-amber-600">· อ่าน QR ไม่ออก</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── ปลั๊กอิน ── */}
      <SectionCard
        title={
          <div className="flex items-center justify-between">
            <span>ปลั๊กอิน WordPress</span>
            <Button size="sm" variant="secondary" onClick={() => scanPlugins()} disabled={!site.hostId || busy === 'plugins'}>
              <Terminal size={14} />
              {busy === 'plugins' ? 'กำลังอ่าน...' : 'อ่านรายการผ่าน SSH'}
            </Button>
          </div>
        }
        description={
          site.hostId
            ? `อ่านล่าสุด ${fmtDateTime(site.pluginsCheckedAt)}${site.wpVersion ? ` · WordPress ${site.wpVersion}` : ''}`
            : 'ยังไม่ผูกโฮสต์ — เพิ่มโฮสต์แล้วกด "สแกนรายชื่อเว็บ" ระบบจะผูกให้เอง'
        }
      >
        {plugins.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">ยังไม่มีข้อมูลปลั๊กอิน</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {plugins.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-800">{p.name || p.slug}</p>
                  <p className="text-xs text-gray-400">
                    {p.version}
                    {p.newVersion ? ` → ${p.newVersion}` : ''} · {p.status === 'active' ? 'เปิดใช้' : 'ปิดอยู่'}
                  </p>
                </div>
                {p.newVersion && (
                  <Button
                    size="sm"
                    onClick={() => scanPlugins(p.slug)}
                    disabled={busy === `update:${p.slug}`}
                  >
                    {busy === `update:${p.slug}` ? 'กำลังอัปเดต...' : 'อัปเดต'}
                  </Button>
                )}
              </div>
            ))}
            {plugins.some((p) => p.newVersion) && (
              <div className="pt-3">
                <Button variant="secondary" onClick={() => scanPlugins('all')} disabled={busy === 'update:all'}>
                  อัปเดตทั้งหมด ({plugins.filter((p) => p.newVersion).length} ตัว)
                </Button>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── บันทึกงาน ── */}
      <SectionCard title="บันทึกงานที่ทำ">
        <div className="mb-4 flex gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
            placeholder="เช่น อัปเดตปลั๊กอิน Elementor, แก้หน้าติดต่อ"
          />
          <Button onClick={addNote} disabled={!note.trim()}>
            เพิ่ม
          </Button>
        </div>
        {logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">ยังไม่มีบันทึก</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex gap-3 border-b border-gray-100 pb-2 last:border-0">
                <span className="w-32 shrink-0 text-xs text-gray-400">{fmtDateTime(l.createdAt)}</span>
                <span className="text-sm text-gray-700">
                  <span className="mr-1 text-xs text-gray-400">{LOG_KIND[l.kind]}</span>
                  {l.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── แก้ไข/เพิ่มบิล ── */}
      {billDraft && (
        <Modal open onClose={() => setBillDraft(null)} title={billDraft.id ? 'แก้ไขบิล' : 'เพิ่มรอบบิล'}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ปี">
                <Input
                  value={String(billDraft.year ?? '')}
                  onChange={(e) => setBillDraft({ ...billDraft, year: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="สถานะ">
                <SelectMenu
                  size="md"
                  value={billDraft.status ?? 'unpaid'}
                  options={(Object.keys(BILL_STATUS) as WebBill['status'][]).map((s) => ({
                    value: s,
                    label: BILL_STATUS[s].label,
                  }))}
                  onChange={(v) => setBillDraft({ ...billDraft, status: (v as WebBill['status']) ?? 'unpaid' })}
                />
              </Field>
              <Field label="เริ่มรอบ">
                <DatePicker
                  value={billDraft.periodStart ?? ''}
                  onChange={(v) => setBillDraft({ ...billDraft, periodStart: v })}
                />
              </Field>
              <Field label="สิ้นสุดรอบ">
                <DatePicker
                  value={billDraft.periodEnd ?? ''}
                  onChange={(v) => setBillDraft({ ...billDraft, periodEnd: v })}
                />
              </Field>
              <Field label="ค่าโฮสต์">
                <Input
                  value={String(billDraft.hostingAmount ?? 0)}
                  onChange={(e) => setBillDraft({ ...billDraft, hostingAmount: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="ค่าโดเมน">
                <Input
                  value={String(billDraft.domainAmount ?? 0)}
                  onChange={(e) => setBillDraft({ ...billDraft, domainAmount: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <Checkbox
                checked={billDraft.billDomain ?? true}
                onChange={(v) => setBillDraft({ ...billDraft, billDomain: v })}
              />
              รอบนี้เก็บค่าโดเมนด้วย
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setBillDraft(null)}>
                ยกเลิก
              </Button>
              <Button onClick={submitBill}>บันทึก</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── ดูสลิป ── */}
      {viewSlip && (
        <Modal open onClose={() => setViewSlip(null)} title="สลิปโอนเงิน">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewSlip} alt="สลิป" className="mx-auto max-h-[70vh] rounded-lg" />
        </Modal>
      )}
    </div>
  )
}
