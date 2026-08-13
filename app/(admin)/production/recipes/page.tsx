'use client'

// สูตรน้ำ — แอดมินตั้งสูตร (ต่อน้ำ 1 ลิตร) + จัดการขนาดขวด
// ฝ่ายผลิตเปิดดูได้อย่างเดียว (RLS กันเขียนไว้อีกชั้นที่ DB)
//
// "คิด yield" = วัตถุดิบหลัก เช่น ส้ม — ตอนบันทึกผลิตระบบเอา กก. ที่ใช้จริง
// ของตัวที่ติ๊กนี้ไปหาร ลิตรที่ได้ ออกมาเป็น yield %

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Modal, SelectMenu, Textarea, Toggle } from '@/components/aoo'
import { PageHeader, SectionCard, Segmented, TechLoader } from '@/components/shared'
import {
  getBottleSizes,
  getRecipes,
  saveBottleSize,
  saveRecipe,
  setBottleSizeActive,
  setRecipeActive,
  stepLines,
  UNIT_TH,
  type BottleSize,
  type Recipe,
  type RecipeItem,
  type RecipeType,
  type RecipeUnit,
} from '@/lib/services/productionService'

const UNIT_OPTIONS = (Object.keys(UNIT_TH) as RecipeUnit[]).map((u) => ({
  value: u,
  label: UNIT_TH[u],
}))

const EMPTY_ITEM: RecipeItem = { name: '', qtyPerLiter: 0, unit: 'g', isYieldBase: false }

interface Draft {
  id?: string
  name: string
  note: string
  recipeType: RecipeType
  targetBrix: string
  syrupBrix: string
  steps: string
  items: RecipeItem[]
}

const draftFrom = (r: Recipe): Draft => ({
  id: r.id,
  name: r.name,
  note: r.note,
  recipeType: r.recipeType,
  targetBrix: r.targetBrix === null ? '' : String(r.targetBrix),
  syrupBrix: String(r.syrupBrix),
  steps: r.steps,
  items: r.items.map((i) => ({ ...i })),
})

const NEW_DRAFT: Draft = {
  name: '',
  note: '',
  recipeType: 'brix',
  targetBrix: '',
  syrupBrix: '65',
  steps: '',
  items: [{ ...EMPTY_ITEM }],
}

export default function ProductionRecipesPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [bottles, setBottles] = useState<BottleSize[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [bottleDraft, setBottleDraft] = useState<{ id?: string; label: string; ml: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const isAdmin = userData?.role === 'admin'
  const canSee = !!userData && (isAdmin || userData.jobFunctionCode === 'production')

  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const load = () => {
    Promise.all([getRecipes(true), getBottleSizes(true)])
      .then(([r, b]) => {
        setRecipes(r)
        setBottles(b)
      })
      .catch((e) => showToast(e.message, 'error'))
  }

  useEffect(() => {
    if (canSee) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  const submitRecipe = async () => {
    if (!draft || !userData?.id) return
    const items = draft.items.filter((i) => i.name.trim() && i.qtyPerLiter > 0)
    const targetBrix = parseFloat(draft.targetBrix) || 0
    if (!draft.name.trim()) return showToast('ใส่ชื่อสูตรก่อน', 'error')
    if (draft.recipeType === 'fixed' && items.length === 0)
      return showToast('ใส่ส่วนผสมอย่างน้อย 1 ตัว', 'error')
    if (draft.recipeType === 'brix' && targetBrix <= 0)
      return showToast('ใส่เป้า Brix ของน้ำขายก่อน', 'error')
    setSaving(true)
    try {
      await saveRecipe({
        id: draft.id,
        name: draft.name.trim(),
        note: draft.note.trim(),
        recipeType: draft.recipeType,
        targetBrix: targetBrix > 0 ? targetBrix : null,
        syrupBrix: parseFloat(draft.syrupBrix) || 65,
        steps: stepLines(draft.steps).join('\n'),
        items,
        updatedBy: userData.id!,
      })
      showToast('บันทึกสูตรแล้ว', 'success')
      setDraft(null)
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  const submitBottle = async () => {
    if (!bottleDraft) return
    const ml = parseInt(bottleDraft.ml)
    if (!bottleDraft.label.trim() || !ml || ml <= 0) return showToast('ใส่ชื่อกับปริมาณ (มล.) ให้ครบ', 'error')
    setSaving(true)
    try {
      await saveBottleSize({ id: bottleDraft.id, label: bottleDraft.label.trim(), ml })
      setBottleDraft(null)
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!userData || recipes === null) return <TechLoader />
  if (!canSee) return null

  const visibleRecipes = isAdmin ? recipes : recipes.filter((r) => r.isActive)

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        icon={BookOpen}
        title="สูตรน้ำ"
        description="ส่วนผสมต่อน้ำ 1 ลิตร — หน้าผสมจะคูณขยายตามจำนวนลิตรให้เอง"
        actions={
          isAdmin ? (
            <Button type="button" onClick={() => setDraft({ ...NEW_DRAFT, items: [{ ...EMPTY_ITEM }] })}>
              <Plus size={16} className="mr-1" /> เพิ่มสูตร
            </Button>
          ) : undefined
        }
      />

      {visibleRecipes.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          ยังไม่มีสูตร{isAdmin ? ' — กด "เพิ่มสูตร" เพื่อเริ่ม' : ''}
        </div>
      )}

      <div className="space-y-3">
        {visibleRecipes.map((r) => (
          <SectionCard key={r.id} className={r.isActive ? '' : 'opacity-60'}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-gray-900">
                  {r.name}
                  <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                    {r.recipeType === 'brix' ? `วัด Brix · เป้า ${r.targetBrix ?? '?'}` : 'สูตรคงที่ /ลิตร'}
                  </span>
                  {!r.isActive && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">ปิดใช้</span>
                  )}
                </div>
                {r.note && <p className="mt-0.5 text-sm text-gray-500">{r.note}</p>}
                {r.steps && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">
                    วิธีทำ {stepLines(r.steps).length} ขั้น: 1. {stepLines(r.steps)[0]}…
                  </p>
                )}
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft(draftFrom(r))}
                  >
                    <Pencil size={14} className="mr-1" /> แก้ไข
                  </Button>
                  <Toggle
                    checked={r.isActive}
                    onChange={(v) =>
                      setRecipeActive(r.id, v)
                        .then(load)
                        .catch((e) => showToast(e.message, 'error'))
                    }
                  />
                </div>
              )}
            </div>
            <div className="mt-3 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
              {r.items.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-gray-400">·</span>
                  <span className="font-medium">{i.name}</span>
                  <span className="tabular-nums text-gray-500">
                    {i.qtyPerLiter.toLocaleString()} {UNIT_TH[i.unit]}/ลิตร
                  </span>
                  {i.isYieldBase && (
                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700">
                      คิด yield
                    </span>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      {/* ขนาดขวด — ใช้ในหน้าผสมตอนกรอกจำนวนขวดที่ได้ */}
      {isAdmin && (
        <SectionCard>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">ขนาดขวด</div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setBottleDraft({ label: '', ml: '' })}>
              <Plus size={14} className="mr-1" /> เพิ่มขนาด
            </Button>
          </div>
          <div className="divide-y divide-gray-100">
            {bottles.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 text-sm">
                <button
                  type="button"
                  className="text-left font-medium text-gray-800 hover:text-red-600"
                  onClick={() => setBottleDraft({ id: b.id, label: b.label, ml: String(b.ml) })}
                >
                  {b.label} <span className="ml-1 tabular-nums text-gray-400">({b.ml.toLocaleString()} มล.)</span>
                </button>
                <Toggle
                  checked={b.isActive}
                  onChange={(v) =>
                    setBottleSizeActive(b.id, v)
                      .then(load)
                      .catch((e) => showToast(e.message, 'error'))
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Modal แก้สูตร */}
      {draft && (
        <Modal
          open
          onClose={() => setDraft(null)}
          title={draft.id ? 'แก้ไขสูตร' : 'เพิ่มสูตร'}
          maxWidth={560}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={submitRecipe} disabled={saving}>
                {saving ? 'กำลังบันทึก…' : 'บันทึกสูตร'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="ชื่อสูตร เช่น น้ำส้มคั้น 100%"
            />

            <div>
              <div className="mb-1 text-xs font-semibold text-gray-500">ประเภทสูตร</div>
              <Segmented
                value={draft.recipeType}
                onChange={(v) => setDraft({ ...draft, recipeType: v as RecipeType })}
                options={[
                  { value: 'brix', label: 'วัด Brix ก่อนผสม' },
                  { value: 'fixed', label: 'สูตรคงที่ ต่อ 1 ลิตร' },
                ]}
              />
              <p className="mt-1 text-xs text-gray-400">
                {draft.recipeType === 'brix'
                  ? 'เช่น น้ำส้ม — วัด Brix น้ำคั้นก่อน ระบบคำนวณน้ำเปล่า/น้ำเชื่อมให้ถึงเป้า'
                  : 'เช่น น้ำเก๊กฮวย — ส่วนผสมตายตัวต่อน้ำ 1 ลิตร ระบบคูณขยายตามที่ผสม'}
              </p>
            </div>

            {draft.recipeType === 'brix' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="mb-1 text-xs font-semibold text-gray-500">เป้า Brix น้ำขาย *</div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={draft.targetBrix}
                    onChange={(e) => setDraft({ ...draft, targetBrix: e.target.value })}
                    placeholder="เช่น 12"
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-xs font-semibold text-gray-500">Brix น้ำเชื่อมที่ใช้เติม</div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={draft.syrupBrix}
                    onChange={(e) => setDraft({ ...draft, syrupBrix: e.target.value })}
                    placeholder="65"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 text-xs font-semibold text-gray-500">ขั้นตอนการทำ</div>
              <Textarea
                value={draft.steps}
                onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
                placeholder={
                  draft.recipeType === 'brix'
                    ? 'คั้นส้ม กรองกาก\nวัด Brix แล้วกรอกในหน้าผสม\nเติมน้ำ/น้ำเชื่อม/เกลือตามที่ระบบคำนวณ คนให้เข้ากัน\nเทใส่ขวด ปิดฝา แช่เย็นทันที'
                    : 'ต้มน้ำให้เดือด ใส่ดอกเก๊กฮวย ต้ม 15 นาที\nกรองดอกทิ้ง เติมน้ำตาลตามสูตร คนให้ละลาย\nพักให้เย็น เทใส่ขวด'
                }
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-400">
                พิมพ์บรรทัดละ 1 ขั้น — ระบบใส่หมายเลข 1 2 3 ให้เองตอนแสดง (ไม่ต้องพิมพ์เลข)
              </p>
            </div>

            <Textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="หมายเหตุ (ถ้ามี)"
              rows={2}
            />

            <div className="text-xs font-semibold text-gray-500">
              {draft.recipeType === 'brix'
                ? 'ของที่เติมเพิ่มต่อน้ำ 1 ลิตรสุดท้าย (เช่น เกลือ) — ไม่มีก็เว้นว่างได้'
                : 'ส่วนผสมต่อน้ำ 1 ลิตร'}
            </div>
            <div className="space-y-2">
              {draft.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => {
                      const items = [...draft.items]
                      items[idx] = { ...item, name: e.target.value }
                      setDraft({ ...draft, items })
                    }}
                    placeholder={draft.recipeType === 'brix' ? 'เช่น เกลือ' : 'เช่น ดอกเก๊กฮวย'}
                    className="min-w-0 flex-1"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={item.qtyPerLiter || ''}
                    onChange={(e) => {
                      const items = [...draft.items]
                      items[idx] = { ...item, qtyPerLiter: parseFloat(e.target.value) || 0 }
                      setDraft({ ...draft, items })
                    }}
                    placeholder="ปริมาณ"
                    className="w-20 shrink-0 text-right"
                  />
                  {/* ปุ่ม SelectMenu ตั้ง width:100% inline — ต้องครอบกล่องกว้างคงที่ไว้คุมแทน */}
                  <div className="w-20 shrink-0">
                    <SelectMenu
                      value={item.unit}
                      options={UNIT_OPTIONS}
                      onChange={(v) => {
                        const items = [...draft.items]
                        items[idx] = { ...item, unit: (v as RecipeUnit) ?? 'g' }
                        setDraft({ ...draft, items })
                      }}
                      size="md"
                    />
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-gray-300 hover:text-red-500"
                    onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}
                    aria-label="ลบส่วนผสม"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft({ ...draft, items: [...draft.items, { ...EMPTY_ITEM }] })}
            >
              <Plus size={14} className="mr-1" /> เพิ่มส่วนผสม
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal ขนาดขวด */}
      {bottleDraft && (
        <Modal
          open
          onClose={() => setBottleDraft(null)}
          title={bottleDraft.id ? 'แก้ไขขนาดขวด' : 'เพิ่มขนาดขวด'}
          maxWidth={380}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setBottleDraft(null)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="button" onClick={submitBottle} disabled={saving}>
                บันทึก
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Input
              value={bottleDraft.label}
              onChange={(e) => setBottleDraft({ ...bottleDraft, label: e.target.value })}
              placeholder="ชื่อ เช่น 250 มล."
            />
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={bottleDraft.ml}
              onChange={(e) => setBottleDraft({ ...bottleDraft, ml: e.target.value })}
              placeholder="ปริมาณ (มล.)"
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
