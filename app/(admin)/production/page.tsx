'use client'

// ผสมวันนี้ — หน้าหลักฝ่ายผลิต ADAY FRESH (Min/แตน ใช้บนมือถือ)
//
// เลือกสูตร → ใส่จำนวนลิตร → ระบบกางปริมาณส่วนผสมทันที (เครื่องคิดสูตร)
// ผสมเสร็จกรอก "ใช้จริง" + จำนวนขวดที่ได้ → บันทึก = ได้ yield % อัตโนมัติ
//
// ออกแบบให้ง่ายที่สุด: ตัวเลขใหญ่ ภาษาน้อย ปุ่มโต — ผู้ใช้หลักเป็นคนพม่า

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CupSoda, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Textarea } from '@/components/aoo'
import { PageHeader, TechLoader } from '@/components/shared'
import {
  createBatch,
  getBatches,
  getBottleSizes,
  getRecipes,
  smartQty,
  toKg,
  UNIT_TH,
  type BottleSize,
  type ProductionBatch,
  type Recipe,
} from '@/lib/services/productionService'

const LITER_CHIPS = [10, 20, 30, 50, 100]

export default function ProductionMixPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [bottleSizes, setBottleSizes] = useState<BottleSize[]>([])
  const [todayBatches, setTodayBatches] = useState<ProductionBatch[]>([])

  const [recipeId, setRecipeId] = useState<string | null>(null)
  const [liters, setLiters] = useState('')
  const [actuals, setActuals] = useState<Record<number, string>>({})
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  const canSee = !!userData && (userData.role === 'admin' || userData.jobFunctionCode === 'production')
  useEffect(() => {
    if (userData && !canSee) router.push('/unauthorized')
  }, [userData, canSee, router])

  const loadToday = useCallback(() => {
    getBatches(today, today).then(setTodayBatches).catch(() => {})
  }, [today])

  useEffect(() => {
    if (!canSee) return
    Promise.all([getRecipes(), getBottleSizes()])
      .then(([r, b]) => {
        setRecipes(r)
        setBottleSizes(b)
      })
      .catch((e) => showToast(e.message, 'error'))
    loadToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  const recipe = recipes?.find((r) => r.id === recipeId) ?? null
  const litersNum = parseFloat(liters) || 0

  // ปริมาณตามสูตร × ลิตรที่จะผสม — แปลงหน่วยให้อ่านง่าย (30000 g → 30 กก.)
  const rows = useMemo(() => {
    if (!recipe || litersNum <= 0) return []
    return recipe.items.map((item) => {
      const s = smartQty(item.qtyPerLiter * litersNum, item.unit)
      return { name: item.name, planned: s.qty, unit: s.unit, isYieldBase: item.isYieldBase }
    })
  }, [recipe, litersNum])

  // เปลี่ยนสูตร/จำนวนลิตร = ค่าใช้จริงกลับไปตามสูตร
  useEffect(() => {
    setActuals({})
  }, [recipeId, liters])

  const actualOf = (idx: number) => {
    const v = actuals[idx]
    if (v !== undefined && v !== '') return parseFloat(v) || 0
    return rows[idx]?.planned ?? 0
  }

  const outputMl = bottleSizes.reduce((s, b) => s + b.ml * (parseInt(counts[b.id] || '0') || 0), 0)
  const yieldBaseKg = rows.reduce((s, r, i) => s + (r.isYieldBase ? toKg(actualOf(i), r.unit) : 0), 0)
  const yieldPercent = yieldBaseKg > 0 && outputMl > 0 ? Math.round((outputMl / 1000 / yieldBaseKg) * 1000) / 10 : null

  const reset = () => {
    setRecipeId(null)
    setLiters('')
    setActuals({})
    setCounts({})
    setNote('')
  }

  const save = async () => {
    if (!recipe || litersNum <= 0 || !userData?.id) return
    setSaving(true)
    try {
      await createBatch({
        batchDate: today,
        recipeId: recipe.id,
        recipeName: recipe.name,
        litersPlanned: litersNum,
        note: note.trim(),
        madeBy: userData.id!,
        items: rows.map((r, i) => ({
          name: r.name,
          unit: r.unit,
          plannedQty: r.planned,
          actualQty: actualOf(i),
          isYieldBase: r.isYieldBase,
        })),
        bottles: bottleSizes.map((b) => ({
          label: b.label,
          ml: b.ml,
          count: parseInt(counts[b.id] || '0') || 0,
        })),
      })
      showToast('บันทึกการผสมแล้ว', 'success')
      reset()
      loadToday()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!userData || recipes === null) return <TechLoader />
  if (!canSee) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        icon={CupSoda}
        title="ผสมวันนี้"
        description={format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}
      />

      {/* 1) เลือกสูตร — ปุ่มโตกดง่ายบนมือถือ */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-gray-700">1 · เลือกสูตร</div>
        {recipes.length === 0 ? (
          <p className="text-sm text-gray-500">
            ยังไม่มีสูตร — ให้แอดมินเพิ่มที่หน้า &ldquo;สูตรน้ำ&rdquo; ก่อน
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {recipes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecipeId(r.id)}
                className={`rounded-xl border-2 px-3 py-4 text-center text-base font-semibold transition-colors ${
                  recipeId === r.id
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2) จำนวนลิตร */}
      {recipe && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-gray-700">2 · ผสมกี่ลิตร</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              placeholder="0"
              className="w-28 text-center text-xl font-bold"
            />
            <span className="text-base text-gray-500">ลิตร</span>
            {LITER_CHIPS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLiters(String(n))}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  litersNum === n
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3) ตารางส่วนผสม — ตามสูตรตัวใหญ่ + ช่องใช้จริง */}
      {recipe && litersNum > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 text-sm font-semibold text-gray-700">
            3 · ส่วนผสมสำหรับ {litersNum} ลิตร
          </div>
          <p className="mb-3 text-xs text-gray-400">
            ถ้าใช้ของจริงไม่เท่าสูตร (เช่น ชั่งส้มได้ไม่พอดี) แก้ตัวเลขในช่อง &ldquo;ใช้จริง&rdquo;
          </p>
          <div className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium text-gray-800">
                    {r.name}
                    {r.isYieldBase && (
                      <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700">
                        คิด yield
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-gray-900">
                    {r.planned.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-gray-500">{UNIT_TH[r.unit]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={actuals[i] ?? ''}
                    onChange={(e) => setActuals((p) => ({ ...p, [i]: e.target.value }))}
                    placeholder={String(r.planned)}
                    aria-label={`${r.name} ใช้จริง`}
                    className="w-24 text-center text-lg font-semibold"
                  />
                  <span className="w-10 text-xs text-gray-500">{UNIT_TH[r.unit]}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4) ขวดที่ได้ */}
      {recipe && litersNum > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-gray-700">4 · กรอกได้กี่ขวด</div>
          <div className="space-y-2">
            {bottleSizes.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="flex-1 text-base font-medium text-gray-800">{b.label}</div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={counts[b.id] ?? ''}
                  onChange={(e) => setCounts((p) => ({ ...p, [b.id]: e.target.value }))}
                  placeholder="0"
                  aria-label={`จำนวนขวด ${b.label}`}
                  className="w-24 text-center text-lg font-semibold"
                />
                <span className="w-10 text-xs text-gray-500">ขวด</span>
              </div>
            ))}
          </div>

          {/* สรุป + yield สด ๆ ก่อนบันทึก */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <div>
              ได้น้ำรวม{' '}
              <strong className="tabular-nums">{(outputMl / 1000).toLocaleString()} ลิตร</strong>
              {' '}(แผน {litersNum} ลิตร)
            </div>
            {yieldPercent !== null && (
              <div className="mt-1">
                วัตถุดิบหลัก <strong className="tabular-nums">{yieldBaseKg.toLocaleString()} กก.</strong>
                {' '}→ yield{' '}
                <strong className="tabular-nums text-red-600">{yieldPercent}%</strong>
              </div>
            )}
          </div>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ (ถ้ามี)"
            rows={2}
            className="mt-3"
          />

          <div className="mt-4 flex gap-2">
            <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
              <RotateCcw size={16} className="mr-1" /> เริ่มใหม่
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 text-base"
              onClick={save}
              disabled={saving || litersNum <= 0}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกการผสม'}
            </Button>
          </div>
        </section>
      )}

      {/* ที่บันทึกไปแล้ววันนี้ — ให้เห็นว่าลงระบบจริง */}
      {todayBatches.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-gray-700">บันทึกแล้ววันนี้</div>
          <div className="divide-y divide-gray-100">
            {todayBatches.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{b.recipeName}</span>
                  <span className="ml-2 text-gray-500">
                    {(b.outputMl / 1000).toLocaleString()} ลิตร · {b.madeByName}
                  </span>
                </div>
                {b.yieldPercent !== null && (
                  <span className="tabular-nums font-semibold text-gray-700">{b.yieldPercent}%</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
