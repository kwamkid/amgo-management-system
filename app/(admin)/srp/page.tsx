'use client'

// SRP Calculator — รายชื่อแบรนด์ (ย้ายจากระบบเดี่ยว srp-calculator, UI สไตล์ amgo)
//
// สิทธิ์รายคน-รายแบรนด์: RLS กรองแถวให้เอง — แต่ละคนเห็นเฉพาะแบรนด์ที่ได้รับสิทธิ์
// แอดมินเห็นหมด + เพิ่ม/แก้แบรนด์ + แจกสิทธิ์ (viewer ดู · editor แก้) ที่หน้านี้

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Pencil, Plus, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Modal, SelectMenu } from '@/components/aoo'
import { PageHeader, SectionCard, Segmented, TechLoader, UserAvatar } from '@/components/shared'
import {
  getSrpBrands,
  getSrpBrandAccess,
  grantSrpAccess,
  revokeSrpAccess,
  saveSrpBrand,
  uploadSrpImage,
  type SrpBrandAccess,
} from '@/lib/services/srp/srpService'
import type { SrpBrand } from '@/lib/services/srp/calculator'
import { createClient } from '@/lib/supabase/client'

type BrandWithCount = SrpBrand & { productCount: number }

interface BrandDraft {
  id?: string
  name: string
  logoUrl: string | null
  usdToThb: string
  eurToThb: string
  sgdToThb: string
  vat: string
  defaultMultiplier: string
  platformMarkupPct: string
}

const draftFrom = (b?: SrpBrand): BrandDraft => ({
  id: b?.id,
  name: b?.name ?? '',
  logoUrl: b?.logoUrl ?? null,
  usdToThb: String(b?.usdToThb ?? 37),
  eurToThb: String(b?.eurToThb ?? 39),
  sgdToThb: String(b?.sgdToThb ?? 27),
  vat: String(b?.vat ?? 7),
  defaultMultiplier: String(b?.defaultMultiplier ?? 3),
  platformMarkupPct: String(b?.platformMarkupPct ?? 0),
})

export default function SrpBrandsPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [brands, setBrands] = useState<BrandWithCount[] | null>(null)
  const [draft, setDraft] = useState<BrandDraft | null>(null)
  const [accessBrand, setAccessBrand] = useState<SrpBrand | null>(null)
  const [accessList, setAccessList] = useState<SrpBrandAccess[]>([])
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [newUserId, setNewUserId] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<'viewer' | 'editor'>('viewer')
  const [saving, setSaving] = useState(false)

  const isAdmin = userData?.role === 'admin'
  const canSee = !!userData && (isAdmin || userData.hasSrpAccess)

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () => {
    getSrpBrands()
      .then(setBrands)
      .catch((e) => showToast(e.message, 'error'))
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  // โหลดแยกกัน — ฝั่งไหนพังอีกฝั่งต้องยังใช้ได้ (เคยพังพร้อมกันจนเลือกคนไม่ได้)
  const openAccess = async (brand: SrpBrand) => {
    setAccessBrand(brand)
    setNewUserId(null)
    setAccessList([])

    getSrpBrandAccess(brand.id)
      .then(setAccessList)
      .catch((e) => showToast(`โหลดรายชื่อผู้มีสิทธิ์ไม่สำเร็จ: ${e.message}`, 'error'))

    const { data, error } = await createClient()
      .from('users')
      .select('id, display_name, is_system')
      .eq('is_active', true)
      .order('display_name')
    if (error) {
      showToast(`โหลดรายชื่อพนักงานไม่สำเร็จ: ${error.message}`, 'error')
      return
    }
    setPeople(
      (data ?? [])
        .filter((u) => !u.is_system) // บัญชีระบบ (Dev/Super Admin) ไม่ต้องแจกสิทธิ์
        .map((u) => ({ id: u.id, name: u.display_name ?? '' }))
    )
  }

  const submitBrand = async () => {
    if (!draft) return
    if (!draft.name.trim()) return showToast('ใส่ชื่อแบรนด์ก่อน', 'error')
    setSaving(true)
    try {
      await saveSrpBrand({
        id: draft.id,
        name: draft.name.trim(),
        logoUrl: draft.logoUrl,
        usdToThb: parseFloat(draft.usdToThb) || 37,
        eurToThb: parseFloat(draft.eurToThb) || 39,
        sgdToThb: parseFloat(draft.sgdToThb) || 27,
        vat: parseFloat(draft.vat) || 0,
        defaultMultiplier: parseFloat(draft.defaultMultiplier) || 3,
        platformMarkupPct: parseFloat(draft.platformMarkupPct) || 0,
      })
      showToast('บันทึกแบรนด์แล้ว', 'success')
      setDraft(null)
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  const grant = async () => {
    if (!accessBrand || !newUserId || !userData?.id) return
    setSaving(true)
    try {
      await grantSrpAccess(accessBrand.id, newUserId, newRole, userData.id!)
      setAccessList(await getSrpBrandAccess(accessBrand.id))
      setNewUserId(null)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ให้สิทธิ์ไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!userData || brands === null) return <TechLoader />
  if (!canSee) return null

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        icon={Calculator}
        title="SRP Calculator"
        description="เครื่องคิดราคาขายปลีกสินค้านำเข้า — เลือกแบรนด์เพื่อดูสินค้าและราคา"
        actions={
          isAdmin ? (
            <Button type="button" onClick={() => setDraft(draftFrom())}>
              <Plus size={16} className="mr-1" /> เพิ่มแบรนด์
            </Button>
          ) : undefined
        }
      />

      {brands.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          ยังไม่มีแบรนด์ที่คุณมีสิทธิ์เข้าถึง — ติดต่อผู้ดูแลระบบ
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {brands.map((b) => (
          <SectionCard key={b.id} className="!p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/srp/${b.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-400">
                    {b.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-gray-900 hover:text-red-600">
                    {b.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {b.productCount.toLocaleString()} สินค้า · USD {b.usdToThb} · EUR {b.eurToThb} · ×{b.defaultMultiplier}
                  </div>
                </div>
              </button>
              {isAdmin && (
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openAccess(b)} title="สิทธิ์การเข้าถึง">
                    <Users size={15} />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(draftFrom(b))} title="แก้ไขแบรนด์">
                    <Pencil size={15} />
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>
        ))}
      </div>

      {/* Modal เพิ่ม/แก้แบรนด์ */}
      {draft && (
        <Modal
          open
          onClose={() => setDraft(null)}
          title={draft.id ? 'แก้ไขแบรนด์' : 'เพิ่มแบรนด์'}
          maxWidth={460}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={submitBrand} disabled={saving}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {draft.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                  โลโก้
                </div>
              )}
              <label className="cursor-pointer text-sm text-red-600 hover:underline">
                เปลี่ยนโลโก้
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      const url = await uploadSrpImage(f, 'logos')
                      setDraft((d) => (d ? { ...d, logoUrl: url } : d))
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'อัพโหลดไม่สำเร็จ', 'error')
                    }
                  }}
                />
              </label>
            </div>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="ชื่อแบรนด์"
            />
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['usdToThb', 'USD → บาท'],
                  ['eurToThb', 'EUR → บาท'],
                  // บางแบรนด์ให้ราคาแนะนำมาเป็น SGD (เจ้าของแจ้ง 28 ส.ค. 69)
                  ['sgdToThb', 'SGD → บาท'],
                  ['vat', 'VAT %'],
                  ['defaultMultiplier', 'ตัวคูณราคา (default)'],
                  ['platformMarkupPct', 'Markup ราคา platform %'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-500">{label}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal สิทธิ์การเข้าถึงรายแบรนด์ */}
      {accessBrand && (
        <Modal
          open
          onClose={() => setAccessBrand(null)}
          title={`สิทธิ์ · ${accessBrand.name}`}
          description="viewer = ดูอย่างเดียว · editor = แก้สินค้า/ช่องทางได้ (แอดมินเห็นทุกแบรนด์อยู่แล้ว)"
          maxWidth={460}
        >
          <div className="space-y-3">
            <div className="divide-y divide-gray-100">
              {accessList.length === 0 && (
                <p className="py-2 text-sm text-gray-400">ยังไม่มีใครได้รับสิทธิ์แบรนด์นี้</p>
              )}
              {accessList.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-2 text-sm">
                  <UserAvatar name={a.userName || '?'} userId={a.userId} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-gray-800">{a.userName}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      a.role === 'editor' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {a.role === 'editor' ? 'แก้ได้' : 'ดูอย่างเดียว'}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-red-600"
                    onClick={async () => {
                      await revokeSrpAccess(a.id)
                      setAccessList(await getSrpBrandAccess(accessBrand.id))
                    }}
                  >
                    ถอน
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-2 border-t border-gray-100 pt-3">
              <div className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-gray-500">เพิ่มคน</span>
                <SelectMenu
                  value={newUserId}
                  options={people
                    .filter((p) => !accessList.some((a) => a.userId === p.id))
                    .map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(v) => setNewUserId(v)}
                  placeholder="เลือกพนักงาน"
                  size="md"
                />
              </div>
              <Segmented
                value={newRole}
                onChange={(v) => setNewRole(v as 'viewer' | 'editor')}
                options={[
                  { value: 'viewer', label: 'ดู' },
                  { value: 'editor', label: 'แก้ได้' },
                ]}
              />
              <Button type="button" onClick={grant} disabled={saving || !newUserId}>
                ให้สิทธิ์
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
