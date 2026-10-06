'use client'

// SEO / AEO — ตั้งค่าเว็บที่ติดตาม
//
// เพิ่ม/แก้เว็บ + เช็คว่า service account เข้า Search Console ของเว็บนั้นได้ไหม
// เว็บใหม่ต้องไปเพิ่มอีเมล service account ใน GSC เองทุกครั้ง — หน้านี้โชว์อีเมล
// ให้ก๊อป และโชว์ว่าตอนนี้มันเห็น property ไหนบ้าง

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Pencil, Plus, ShieldCheck, Trash2, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Alert, Button, Field, IconButton, Input, Modal, Pill, Select, Toggle, useConfirm } from '@/components/aoo'
import { DataTable, PageHeader, SectionCard, SiteFavicon, TechLoader, type Column } from '@/components/shared'
import {
  deleteSeoSite,
  fmtGscDate,
  getMonthApiSpend,
  getSeoSettings,
  getSeoSites,
  saveSeoSettings,
  saveSeoSite,
  type SeoSettings,
  type SeoSite,
} from '@/lib/services/seo/seoService'

type Access = { email: string | null; properties: { siteUrl: string; permissionLevel: string }[]; error?: string }

const EMPTY = { domain: '', displayName: '', gscProperty: '', isActive: true, note: '' }

export default function SeoSettingsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()
  const { confirm, dialog } = useConfirm()

  const [sites, setSites] = useState<SeoSite[] | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [checking, setChecking] = useState(false)
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null)
  const [saving, setSaving] = useState(false)
  const [budget, setBudget] = useState<SeoSettings | null>(null)
  const [spend, setSpend] = useState(0)
  const [savingBudget, setSavingBudget] = useState(false)

  const canSee = !!userData?.hasWebAccess

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () =>
    getSeoSites()
      .then(setSites)
      .catch((e) => {
        showToast(e.message, 'error')
        setSites([])
      })

  // เช็คสิทธิ์ทุกครั้งที่เปิดหน้า — ผลอัปเดต gsc_access ของทุกเว็บด้วย
  const checkAccess = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/seo/gsc-access')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'เช็คไม่สำเร็จ')
      setAccess(json)
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (!canSee) return
    getSeoSettings().then(setBudget).catch(() => {})
    getMonthApiSpend().then(setSpend).catch(() => {})
  }, [canSee])

  const saveBudget = async () => {
    if (!budget) return
    setSavingBudget(true)
    try {
      await saveSeoSettings(budget)
      showToast('บันทึกแล้ว')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSavingBudget(false)
    }
  }

  useEffect(() => {
    if (canSee) checkAccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  const save = async () => {
    if (!editing) return
    if (!editing.domain.trim() || !editing.displayName.trim()) {
      showToast('ใส่ชื่อและโดเมนก่อน', 'error')
      return
    }
    setSaving(true)
    try {
      await saveSeoSite(editing)
      showToast('บันทึกแล้ว')
      setEditing(null)
      await checkAccess()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (s: SeoSite) => {
    const ok = await confirm({
      title: `ลบ ${s.displayName}?`,
      description: 'ข้อมูล Search Console ที่ดึงมาของเว็บนี้จะหายทั้งหมด (ดึงใหม่ได้ย้อนหลัง 16 เดือน)',
      confirmLabel: 'ลบ',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteSeoSite(s.id)
      await load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  if (!canSee || sites === null) return <TechLoader />

  const registered = new Set(sites.map((s) => s.gscProperty))
  const unregistered = (access?.properties ?? []).filter((p) => !registered.has(p.siteUrl))

  const columns: Column<SeoSite>[] = [
    {
      key: 'name',
      header: 'เว็บ',
      mobilePrimary: true,
      cell: (s) => (
        <div className="flex items-center gap-2">
          <SiteFavicon domain={s.domain} />
          <div>
            <div className="font-medium text-gray-900">{s.displayName}</div>
            <div className="text-xs text-gray-400">{s.domain}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'property',
      header: 'GSC property',
      cell: (s) => s.gscProperty || <span className="text-gray-400">ยังไม่ได้ใส่</span>,
    },
    {
      key: 'access',
      header: 'สิทธิ์',
      cell: (s) =>
        !s.gscProperty ? (
          <Pill tone="neutral">—</Pill>
        ) : s.gscAccess === 'ok' ? (
          <Pill tone="success">เข้าได้</Pill>
        ) : s.gscAccess === 'denied' ? (
          <Pill tone="danger">ไม่มีสิทธิ์</Pill>
        ) : (
          <Pill tone="warning">ยังไม่เช็ค</Pill>
        ),
    },
    {
      key: 'data',
      header: 'ข้อมูล',
      cell: (s) => (
        <div className="text-sm">
          <div>{s.syncedThrough ? `ถึง ${fmtGscDate(s.syncedThrough)}` : 'ยังไม่มี'}</div>
          <div className="text-xs text-gray-400">
            {s.backfillDone ? 'ย้อนหลังครบ 16 เดือน' : s.backfillFrom ? `ย้อนถึง ${fmtGscDate(s.backfillFrom)}` : ''}
            {!s.isActive && ' · ปิดอยู่'}
          </div>
          {s.lastError && <div className="aoo-delta" data-tone="danger">{s.lastError}</div>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      mobileFooterAction: true,
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <IconButton
            icon={Pencil}
            aria-label="แก้ไข"
            onClick={() =>
              setEditing({
                id: s.id,
                domain: s.domain,
                displayName: s.displayName,
                gscProperty: s.gscProperty ?? '',
                isActive: s.isActive,
                note: s.note,
              })
            }
          />
          <IconButton icon={Trash2} tone="danger" aria-label="ลบ" onClick={() => remove(s)} />
        </div>
      ),
    },
  ]

  return (
    <div>
      {dialog}
      <PageHeader
        title="ตั้งค่าเว็บ SEO"
        description="เว็บที่ติดตามผลบน Google Search"
        icon={TrendingUp}
        backHref="/seo"
        actions={
          <Button icon={Plus} onClick={() => setEditing({ ...EMPTY })}>
            เพิ่มเว็บ
          </Button>
        }
      />

      <SectionCard
        className="mb-6"
        title={
          <div className="flex items-center justify-between gap-2">
            <span>การเข้าถึง Search Console</span>
            <Button size="sm" variant="secondary" icon={ShieldCheck} loading={checking} onClick={checkAccess}>
              เช็คอีกครั้ง
            </Button>
          </div>
        }
      >
        {access?.error && (
          <Alert tone="error" compact className="mb-3">
            {access.error}
          </Alert>
        )}
        {access?.email && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">
                เพิ่มอีเมลนี้ใน GSC ของแต่ละเว็บ → Settings → Users and permissions → Add user → สิทธิ์ Restricted
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="break-all rounded bg-gray-50 px-2 py-1 text-gray-800">{access.email}</code>
                <IconButton
                  icon={Copy}
                  aria-label="ก๊อปอีเมล"
                  onClick={() => {
                    navigator.clipboard.writeText(access.email!)
                    showToast('ก๊อปแล้ว')
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-gray-500">property ที่ service account เห็นตอนนี้ ({access.properties.length})</p>
              {access.properties.length ? (
                <ul className="mt-1 space-y-1">
                  {access.properties.map((p) => (
                    <li key={p.siteUrl} className="flex flex-wrap items-center gap-2">
                      <code>{p.siteUrl}</code>
                      {registered.has(p.siteUrl) ? (
                        <Pill tone="success">ติดตามอยู่</Pill>
                      ) : (
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => {
                            const domain = p.siteUrl
                              .replace(/^sc-domain:/, '')
                              .replace(/^https?:\/\//, '')
                              .replace(/^www\./, '')
                              .replace(/\/.*$/, '')
                            setEditing({ ...EMPTY, domain, displayName: domain, gscProperty: p.siteUrl })
                          }}
                        >
                          เพิ่มเป็นเว็บที่ติดตาม
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-gray-400">ยังไม่เห็นสักเว็บ — เพิ่มอีเมลด้านบนใน GSC ก่อน</p>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        className="mb-6"
        title="งบค่าเช็คอันดับ (DataForSEO)"
        description="ทุกครั้งที่เช็คอันดับเสียเงิน · ถึงเพดานแล้วระบบหยุดเช็คจนถึงต้นเดือนหน้า และแจ้ง Discord"
      >
        {budget && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="sm:w-48">
              <Field label="เพดานต่อเดือน (USD)">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={budget.monthlyBudgetUsd}
                  onChange={(e) => setBudget({ ...budget, monthlyBudgetUsd: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="sm:w-48">
              <Field label="เช็คอันดับแบบ">
                <Select
                  value={budget.rankDevice}
                  onChange={(e) => setBudget({ ...budget, rankDevice: e.target.value as SeoSettings['rankDevice'] })}
                >
                  <option value="mobile">มือถือ (คนไทยค้นจากมือถือเป็นหลัก)</option>
                  <option value="desktop">คอมพิวเตอร์</option>
                </Select>
              </Field>
            </div>
            <Button loading={savingBudget} onClick={saveBudget}>
              บันทึก
            </Button>
            <p className="text-sm text-gray-500 sm:ml-auto">
              เดือนนี้ใช้ไป <b>${spend.toFixed(3)}</b> จาก ${budget.monthlyBudgetUsd.toFixed(2)}
            </p>
          </div>
        )}
      </SectionCard>

      <DataTable
        columns={columns}
        rows={sites}
        rowKey={(s) => s.id}
        emptyTitle="ยังไม่มีเว็บที่ติดตาม"
        emptyBody={unregistered.length ? 'กด "เพิ่มเป็นเว็บที่ติดตาม" ที่ property ด้านบนได้เลย' : undefined}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'แก้ไขเว็บ' : 'เพิ่มเว็บ'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button loading={saving} onClick={save}>
              บันทึก
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="ชื่อที่แสดง" required>
              <Input
                value={editing.displayName}
                onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                placeholder="AooCommerce"
              />
            </Field>
            <Field label="โดเมน" required help="ไม่ต้องใส่ https:// หรือ www">
              <Input
                value={editing.domain}
                onChange={(e) => setEditing({ ...editing, domain: e.target.value })}
                placeholder="aoocommerce.com"
              />
            </Field>
            <Field
              label="GSC property"
              help="แบบ Domain = sc-domain:example.com · แบบ URL-prefix = https://www.example.com/"
            >
              {access?.properties.length ? (
                <Select
                  value={editing.gscProperty}
                  onChange={(e) => setEditing({ ...editing, gscProperty: e.target.value })}
                >
                  <option value="">— ยังไม่เลือก —</option>
                  {/* property ที่พิมพ์ไว้เองแต่ service account ยังไม่เห็น ก็ต้องเลือกค้างไว้ได้ */}
                  {editing.gscProperty && !access.properties.some((p) => p.siteUrl === editing.gscProperty) && (
                    <option value={editing.gscProperty}>{editing.gscProperty} (ยังไม่มีสิทธิ์)</option>
                  )}
                  {access.properties.map((p) => (
                    <option key={p.siteUrl} value={p.siteUrl}>
                      {p.siteUrl}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={editing.gscProperty}
                  onChange={(e) => setEditing({ ...editing, gscProperty: e.target.value })}
                  placeholder="sc-domain:aoocommerce.com"
                />
              )}
            </Field>
            <Field label="โน้ต">
              <Input value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </Field>
            <div className="flex items-center gap-3">
              <Toggle checked={editing.isActive} onChange={(v) => setEditing({ ...editing, isActive: v })} />
              <span className="text-sm text-gray-700">ติดตามเว็บนี้ (ปิด = หยุดดึงข้อมูล แต่เก็บของเดิมไว้)</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
