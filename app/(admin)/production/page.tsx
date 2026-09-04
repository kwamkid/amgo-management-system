'use client'

// ผสมวันนี้ — หน้าหลักฝ่ายผลิต ADAY FRESH (Min/แตน ใช้บนมือถือ)
//
// สูตร 2 แบบ (ตาม workflow จริงของโรงงาน):
// - brix  (น้ำส้ม — สูตรจากเว็บเก่า cal.joolzjuice.com): กรอกว่าจะทำขวดไหน
//   กี่ขวด + Brix น้ำคั้นที่วัดได้ → ระบบบอกต้องใช้น้ำคั้น/น้ำตาล(หรือน้ำเชื่อม)/
//   น้ำ/ของเติม เท่าไหร่ → ผสม → กรอกขวดที่ได้จริง
// - fixed (น้ำเก๊กฮวย): ส่วนผสมตายตัวต่อ 1 ลิตร ระบบคูณขยายตามที่จะผสม
// ทั้งคู่มี "วิธีทำ" ข้อความ fix จากหน้าสูตร โชว์เป็นข้อหมายเลขตอนผสมทุกครั้ง
//
// ออกแบบให้ง่ายที่สุด: ตัวเลขใหญ่ ภาษาน้อย ปุ่มโต — ผู้ใช้หลักเป็นคนพม่า

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CupSoda, ListChecks, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Textarea } from '@/components/aoo'
import { PageHeader, SectionCard, Segmented, TechLoader } from '@/components/shared'
import BottleIcon from './BottleIcon'
import {
  createBatch,
  getBatches,
  getBottleSizes,
  getRecipes,
  juiceMix,
  smartQty,
  stepLines,
  toKg,
  UNIT_TH,
  type BottleSize,
  type ProductionBatch,
  type Recipe,
  type RecipeUnit,
} from '@/lib/services/productionService'

const LITER_CHIPS = [10, 20, 30, 50, 100]

interface MixRow {
  name: string
  planned: number
  unit: RecipeUnit
  isYieldBase: boolean
}

export default function ProductionMixPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [bottleSizes, setBottleSizes] = useState<BottleSize[]>([])
  const [todayBatches, setTodayBatches] = useState<ProductionBatch[]>([])

  const [recipeId, setRecipeId] = useState<string | null>(null)
  const [liters, setLiters] = useState('')            // สูตร fixed: จะผสมกี่ลิตร
  const [planCounts, setPlanCounts] = useState<Record<string, string>>({}) // สูตร brix: จะทำขวดละกี่ใบ
  const [juiceBrix, setJuiceBrix] = useState('')      // สูตร brix: Brix น้ำคั้นที่วัดได้
  const [fruitKg, setFruitKg] = useState('')          // สูตร brix: ใช้ผลไม้ไปกี่ กก. (ไว้คิด % น้ำที่ได้)
  const [sweetMode, setSweetMode] = useState<'sugar' | 'syrup'>('sugar')
  const [actuals, setActuals] = useState<Record<number, string>>({})
  const [counts, setCounts] = useState<Record<string, string>>({}) // ขวดที่กรอกได้จริง (ว่าง = ตามแผน)
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
  const isBrix = recipe?.recipeType === 'brix'
  const litersNum = parseFloat(liters) || 0
  const juiceBNum = parseFloat(juiceBrix) || 0
  const fruitKgNum = parseFloat(fruitKg) || 0

  const planCountOf = (id: string) => parseInt(planCounts[id] || '0') || 0
  const planTotalMl = bottleSizes.reduce((s, b) => s + b.ml * planCountOf(b.id), 0)

  /** ลิตรน้ำที่กำลังทำ — brix รวมจากขวดที่วางแผน · fixed ตามที่กรอก */
  const effLiters = isBrix ? Math.round((planTotalMl / 1000) * 100) / 100 : litersNum

  // สูตร brix: กางส่วนผสมตามสูตร Joolz (น้ำตาล หรือ น้ำเชื่อม ตามปุ่มเลือก)
  const mix = useMemo(() => {
    if (!recipe || recipe.recipeType !== 'brix' || planTotalMl <= 0 || juiceBNum <= 0) return null
    return juiceMix(planTotalMl / 1000, juiceBNum, recipe.targetBrix ?? 12, recipe.juiceRatio)
  }, [recipe, planTotalMl, juiceBNum])

  const rows = useMemo<MixRow[]>(() => {
    if (!recipe) return []
    if (recipe.recipeType === 'brix') {
      if (!mix) return []
      const out: MixRow[] = [
        { name: 'น้ำส้มคั้นสด', planned: mix.juiceLiters, unit: 'l', isYieldBase: false },
      ]
      // ตัวเลขชุดเดียวกับชีทสูตรจริง: กรัม/มล. ทศนิยมเต็ม ไม่ปัดทิ้ง (เจ้าของขอ)
      if (sweetMode === 'sugar') {
        if (mix.sugarG > 0) out.push({ name: 'น้ำตาล', planned: mix.sugarG, unit: 'g', isYieldBase: false })
        out.push({ name: 'น้ำดื่มสะอาด', planned: mix.waterMl, unit: 'ml', isYieldBase: false })
      } else {
        if (mix.syrupG > 0) out.push({ name: 'น้ำเชื่อม', planned: mix.syrupG, unit: 'g', isYieldBase: false })
        out.push({ name: 'น้ำดื่มสะอาด', planned: mix.waterSyrupMl, unit: 'ml', isYieldBase: false })
      }
      for (const item of recipe.items) {
        const s = smartQty(item.qtyPerLiter * (planTotalMl / 1000), item.unit)
        out.push({ name: item.name, planned: s.qty, unit: s.unit, isYieldBase: false })
      }
      return out
    }
    if (litersNum <= 0) return []
    return recipe.items.map((item) => {
      const s = smartQty(item.qtyPerLiter * litersNum, item.unit)
      return { name: item.name, planned: s.qty, unit: s.unit, isYieldBase: item.isYieldBase }
    })
  }, [recipe, litersNum, mix, sweetMode, planTotalMl])

  // เปลี่ยนสูตร/ค่าที่กรอก = ค่าใช้จริงกลับไปตามคำนวณ
  useEffect(() => {
    setActuals({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, liters, juiceBrix, sweetMode, JSON.stringify(planCounts)])

  const actualOf = (idx: number) => {
    const v = actuals[idx]
    if (v !== undefined && v !== '') return parseFloat(v) || 0
    return rows[idx]?.planned ?? 0
  }

  // ขวดที่ได้จริง — ช่องว่างถือว่าตามแผน (สูตร brix) เพื่อไม่ต้องกรอกซ้ำ
  const actualCountOf = (id: string) => {
    const v = counts[id]
    if (v !== undefined && v !== '') return parseInt(v) || 0
    return isBrix ? planCountOf(id) : 0
  }
  const outputMl = bottleSizes.reduce((s, b) => s + b.ml * actualCountOf(b.id), 0)

  // % น้ำที่ได้ (yield): brix = เทียบ กก.ผลไม้ · fixed = จาก item ที่ติ๊กไว้ (สูตรเก่า)
  const yieldBaseKg = isBrix
    ? fruitKgNum
    : rows.reduce((s, r, i) => s + (r.isYieldBase ? toKg(actualOf(i), r.unit) : 0), 0)
  const yieldPercent =
    yieldBaseKg > 0 && outputMl > 0 ? Math.round((outputMl / 1000 / yieldBaseKg) * 1000) / 10 : null

  const readyToMix = isBrix ? mix !== null : litersNum > 0

  const reset = () => {
    setRecipeId(null)
    setLiters('')
    setPlanCounts({})
    setJuiceBrix('')
    setFruitKg('')
    setSweetMode('sugar')
    setActuals({})
    setCounts({})
    setNote('')
  }

  const save = async () => {
    if (!recipe || !readyToMix || !userData?.id) return
    setSaving(true)
    try {
      const items = rows.map((r, i) => ({
        name: r.name,
        unit: r.unit,
        plannedQty: r.planned,
        actualQty: actualOf(i),
        isYieldBase: r.isYieldBase,
      }))
      // น้ำคั้นที่ใช้จริง = แถวแรกของสูตร brix (แก้ได้หน้างาน)
      const juiceUsed = isBrix ? actualOf(0) : undefined
      await createBatch({
        batchDate: today,
        recipeId: recipe.id,
        recipeName: recipe.name,
        litersPlanned: effLiters,
        note: note.trim(),
        madeBy: userData.id!,
        items,
        bottles: bottleSizes.map((b) => ({
          label: b.label,
          ml: b.ml,
          count: actualCountOf(b.id),
        })),
        yieldBaseKg: isBrix && fruitKgNum > 0 ? fruitKgNum : undefined,
        juiceLiters: juiceUsed,
        juiceBrix: isBrix ? juiceBNum : undefined,
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

  const bigInput = 'w-24 text-center text-lg font-semibold'

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        icon={CupSoda}
        title="ผสมวันนี้"
        description={format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}
      />

      {/* 1) เลือกสูตร — ปุ่มโตกดง่ายบนมือถือ */}
      <SectionCard title="1 · เลือกสูตร">
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
                className={`rounded-xl border-2 px-3 py-3 text-center transition-colors ${
                  recipeId === r.id
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {/* รูปนำ ชื่อตาม — ฝ่ายผลิตจำจากรูป */}
                <span className="block text-4xl leading-none">{r.image || '🧃'}</span>
                <span className="mt-1.5 block text-base font-semibold">{r.name}</span>
                <span className="mt-0.5 block text-xs text-gray-400">
                  {r.recipeType === 'brix' ? `วัด Brix · เป้า ${r.targetBrix ?? '?'}` : 'สูตรคงที่'}
                </span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 2) fixed: ผสมกี่ลิตร */}
      {recipe && !isBrix && (
        <SectionCard title="2 · ผสมกี่ลิตร">
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
        </SectionCard>
      )}

      {/* 2) brix: จะทำกี่ขวด + Brix ที่วัดได้ */}
      {recipe && isBrix && (
        <SectionCard
          title="2 · จะทำกี่ขวด + ค่าที่วัดได้"
          description="ใส่จำนวนขวดที่จะทำ แล้ววัด Brix ของน้ำคั้น — ระบบคำนวณส่วนผสมให้"
        >
          <div className="space-y-2">
            {bottleSizes.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <BottleIcon ml={b.ml} />
                <div className="flex-1 text-base font-medium text-gray-800">{b.label}</div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={planCounts[b.id] ?? ''}
                  onChange={(e) => setPlanCounts((p) => ({ ...p, [b.id]: e.target.value }))}
                  placeholder="0"
                  aria-label={`จะทำ ${b.label} กี่ขวด`}
                  className={bigInput}
                />
                <span className="w-10 text-xs text-gray-500">ขวด</span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">
                Brix น้ำคั้นที่วัดได้ (เป้า {recipe.targetBrix ?? 12})
              </span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={juiceBrix}
                onChange={(e) => setJuiceBrix(e.target.value)}
                placeholder="0"
                className="text-center text-lg font-semibold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">ใช้ผลไม้ไป (กก.)</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={fruitKg}
                onChange={(e) => setFruitKg(e.target.value)}
                placeholder="0"
                className="text-center text-lg font-semibold"
              />
            </label>
          </div>

          {planTotalMl > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              รวมทั้งหมด{' '}
              <strong className="tabular-nums text-gray-800">
                {(planTotalMl / 1000).toLocaleString()} ลิตร
              </strong>
            </p>
          )}
        </SectionCard>
      )}

      {/* 3) ส่วนผสมที่ต้องใช้ — ตามคำนวณตัวใหญ่ + ช่องใช้จริง */}
      {recipe && readyToMix && (
        <SectionCard
          title={
            isBrix
              ? `3 · ส่วนผสมสำหรับ ${effLiters.toLocaleString()} ลิตร (Brix เป้า ${recipe.targetBrix ?? 12})`
              : `3 · ส่วนผสมสำหรับ ${effLiters.toLocaleString()} ลิตร`
          }
          description='ถ้าใช้ของจริงไม่เท่าที่คำนวณ แก้ตัวเลขในช่อง "ใช้จริง"'
        >
          {isBrix && (
            <Segmented
              value={sweetMode}
              onChange={(v) => setSweetMode(v as 'sugar' | 'syrup')}
              options={[
                { value: 'sugar', label: 'ใส่น้ำตาล' },
                { value: 'syrup', label: 'ใส่น้ำเชื่อม' },
              ]}
              className="mb-2"
            />
          )}
          <div className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <div key={`${sweetMode}-${i}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium text-gray-800">{r.name}</div>
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
                    className={bigInput}
                  />
                  <span className="w-10 text-xs text-gray-500">{UNIT_TH[r.unit]}</span>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="py-2 text-sm text-gray-400">สูตรนี้ไม่มีของต้องเติมเพิ่ม</p>
            )}
          </div>
        </SectionCard>
      )}

      {/* วิธีทำ — ข้อความ fix จากหน้าสูตร บังคับแสดงเป็นข้อมีหมายเลขเสมอ */}
      {recipe && readyToMix && recipe.steps && (
        <SectionCard title={<span className="flex items-center gap-1.5"><ListChecks size={16} /> วิธีทำ</span>}>
          <ol className="space-y-2.5">
            {stepLines(recipe.steps).map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-600">
                  {i + 1}
                </span>
                <span className="text-[15px] leading-6 text-gray-800">{step}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      {/* 4) ขวดที่ได้จริง */}
      {recipe && readyToMix && (
        <SectionCard
          title="4 · กรอกได้จริงกี่ขวด"
          description={isBrix ? 'เว้นว่าง = ได้ตามแผน · กรอกเฉพาะขวดที่ได้ไม่เท่าแผน' : undefined}
        >
          <div className="space-y-2">
            {bottleSizes.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <BottleIcon ml={b.ml} />
                <div className="flex-1 text-base font-medium text-gray-800">{b.label}</div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={counts[b.id] ?? ''}
                  onChange={(e) => setCounts((p) => ({ ...p, [b.id]: e.target.value }))}
                  placeholder={isBrix ? String(planCountOf(b.id)) : '0'}
                  aria-label={`จำนวนขวด ${b.label}`}
                  className={bigInput}
                />
                <span className="w-10 text-xs text-gray-500">ขวด</span>
              </div>
            ))}
          </div>

          {/* สรุป + % น้ำที่ได้ สด ๆ ก่อนบันทึก */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <div>
              ได้น้ำรวม{' '}
              <strong className="tabular-nums">{(outputMl / 1000).toLocaleString()} ลิตร</strong>
              {' '}(คำนวณไว้ {effLiters.toLocaleString()} ลิตร)
            </div>
            {yieldPercent !== null && (
              <div className="mt-1">
                ผลไม้ <strong className="tabular-nums">{yieldBaseKg.toLocaleString()} กก.</strong>
                {' '}→ ได้น้ำคิดเป็น{' '}
                <strong className="tabular-nums text-red-600">{yieldPercent}%</strong> (yield)
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
              disabled={saving || !readyToMix}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกการผสม'}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* ที่บันทึกไปแล้ววันนี้ — ให้เห็นว่าลงระบบจริง */}
      {todayBatches.length > 0 && (
        <SectionCard title="บันทึกแล้ววันนี้">
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
        </SectionCard>
      )}
    </div>
  )
}
