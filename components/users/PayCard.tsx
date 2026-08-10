'use client'

// กล่องค่าตอบแทนของพนักงาน 1 คน — เงินเดือนพื้นฐาน + รายได้พิเศษ
//
// ── ใช้ 2 ที่ ─────────────────────────────────────────────────────────
// · หน้าแก้ไขพนักงาน แท็บเงินเดือน (HR/admin) → แก้ได้
// · หน้าโปรไฟล์ตัวเอง                          → อ่านอย่างเดียว
//
// ── เงินเดือนพื้นฐาน กับ รายได้พิเศษ ต่างกันตรงไหน ────────────────────
// เงินเดือนพื้นฐาน  เก็บเป็นประวัติ — "ขึ้นเงินเดือน" คือเพิ่มแถวใหม่ตามวันที่
//                   มีผล ของเก่าต้องอยู่ครบเพราะ hourly_rate ใช้คิดค่าล่วงเวลา
//                   ย้อนหลัง  ส่วน "แก้ตัวเลข" คือกรอกผิดแล้วแก้ ทับแถวเดิม
//                   ไม่งั้นประวัติจะมีขั้นปลอมที่ไม่เคยเกิดขึ้นจริง
// รายได้พิเศษ       แก้แล้วมีผลทันที ไม่ต้องมีปุ่มขึ้น
//
// ทั้งสองตารางมี trigger เขียน audit_log ไว้ว่าใครแก้อะไรเมื่อไหร่
//
// ── ใครเห็นอะไร ───────────────────────────────────────────────────────
// RLS ที่ฐานข้อมูลกรองให้แล้ว (เจ้าตัว + HR) — คนอื่นได้ 0 แถว ไม่ใช่ error
// หน้าจอจึงขึ้นว่า "ยังไม่มีข้อมูล" ซึ่งถูกต้องแล้ว

import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Check, History, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/aoo'

type Tier = { upTo: number | null; percent: number }

type PayItem = {
  id: string
  kind: string
  label: string
  amount: number
  /** fixed = ยอดคงที่ · tiered_percent = ค่าคอมขั้นบันได · per_piece = บาทต่อชิ้น */
  calc: string
  config: { tiers?: Tier[] } | null
}

type Salary = { id: string; base_salary: number; effective_from: string; note: string | null }

const KINDS = [
  { value: 'commission', label: 'ค่าคอมมิชชั่น' },
  { value: 'piece', label: 'ค่าชิ้นงาน' },
  { value: 'position', label: 'ค่าตำแหน่ง' },
  { value: 'travel', label: 'ค่าเดินทาง' },
  { value: 'diligence', label: 'เบี้ยขยัน' },
  { value: 'phone', label: 'ค่าโทรศัพท์' },
  { value: 'housing', label: 'ค่าที่พัก' },
  { value: 'other', label: 'อื่น ๆ' },
]

const baht = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)
const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

// ⚠️ ไม่ใส่ความกว้างใน FIELD — เคยใส่ w-full แล้วไปชนกับ w-36/w-28 ของ
//    แต่ละช่อง (Tailwind ตัดสินจากลำดับใน stylesheet ไม่ใช่ลำดับ class)
//    ช่องชื่อรายการเลยถูกบีบจนเหลือแต่กรอบ ส่วนช่องตัวเลขบานเต็มแถว
const FIELD =
  'h-9 rounded-lg border border-gray-200 px-2 text-sm outline-none focus:border-red-400'

export default function PayCard({
  userId,
  editable = false,
}: {
  userId: string
  /** true = HR/admin เปิดดูของคนอื่น แก้ได้ */
  editable?: boolean
}) {
  const [history, setHistory] = useState<Salary[]>([])
  const [items, setItems] = useState<PayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'view' | 'fix' | 'raise'>('view')
  const [adding, setAdding] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const [{ data: comp }, { data: pay }] = await Promise.all([
      sb
        .from('user_compensation')
        .select('id, base_salary, effective_from, note')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false }),
      sb
        .from('user_pay_items')
        .select('id, kind, label, amount, calc, config')
        .eq('user_id', userId)
        .order('created_at'),
    ])

    setHistory((comp ?? []).map((c) => ({ ...c, base_salary: Number(c.base_salary) })))
    setItems(
      (pay ?? []).map((i) => ({
        ...i,
        amount: Number(i.amount),
        // config เป็น jsonb ไร้รูปแบบจากมุมของ TypeScript — ระบุเองว่าคือกติกาขั้นบันได
        config: i.config as PayItem['config'],
      }))
    )
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return null

  const current = history[0] ?? null
  // รวมได้เฉพาะยอดคงที่ — ค่าคอม/ค่าชิ้นงานต้องรอยอดขายจริงของแต่ละเดือน
  const extraTotal = items.filter((i) => i.calc === 'fixed').reduce((s, i) => s + i.amount, 0)
  const hasVariable = items.some((i) => i.calc !== 'fixed')

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
        <Wallet size={16} className="text-gray-400" /> ค่าตอบแทน
      </h3>

      {/* ── เงินเดือนพื้นฐาน ─────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-gray-500">เงินเดือนพื้นฐาน</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-gray-900">
            {current ? baht.format(current.base_salary) : '—'}
          </span>
          <span className="text-xs text-gray-400">
            {current ? `บาท · ตั้งแต่ ${thaiDate(current.effective_from)}` : 'ยังไม่ได้กรอก'}
          </span>

          {editable && mode === 'view' && (
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setMode('fix')}>
                <Pencil size={13} /> แก้ตัวเลข
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setMode('raise')}>
                <ArrowUpRight size={14} /> ขึ้นเงินเดือน
              </Button>
            </div>
          )}
        </div>

        {mode !== 'view' && (
          <SalaryForm
            userId={userId}
            mode={mode}
            current={current}
            onDone={() => {
              setMode('view')
              load()
            }}
            onCancel={() => setMode('view')}
          />
        )}

        {history.length > 1 && (
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
          >
            <History size={12} /> ประวัติเงินเดือน {history.length} ครั้ง
          </button>
        )}

        {showLog && (
          <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
            {history.map((h, i) => {
              // เทียบกับแถวถัดไป (เก่ากว่า) เพื่อบอกว่าขึ้นมาเท่าไหร่
              const prev = history[i + 1]
              const diff = prev ? h.base_salary - prev.base_salary : 0
              return (
                <div key={h.id} className="flex items-baseline gap-2 text-xs">
                  <span className="w-20 shrink-0 text-gray-400">{thaiDate(h.effective_from)}</span>
                  <span className="font-mono tabular-nums text-gray-700">
                    {baht.format(h.base_salary)}
                  </span>
                  {diff > 0 && (
                    <span className="font-mono tabular-nums text-green-600">
                      +{baht.format(diff)}
                    </span>
                  )}
                  {h.note && <span className="truncate text-gray-400">{h.note}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── รายได้พิเศษ ───────────────────────────────────── */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            รายได้พิเศษ{editable && ' — แก้แล้วมีผลทันที'}
          </span>
          {editable && !adding && (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus size={14} /> เพิ่ม
            </Button>
          )}
        </div>

        {items.length === 0 && !adding ? (
          <p className="py-1 text-sm text-gray-400">ยังไม่มีรายได้พิเศษ</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} editable={editable} onChanged={load} />
            ))}
          </div>
        )}

        {adding && (
          <div className="mt-1.5">
            <ItemRow
              userId={userId}
              editable
              onChanged={() => {
                setAdding(false)
                load()
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
      </div>

      {/* ── รวม ───────────────────────────────────────────── */}
      {(current || items.length > 0) && (
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-2.5">
          <span className="text-sm font-medium text-gray-700">รวมต่อเดือน</span>
          <span className="text-right">
            <span className="font-mono font-semibold tabular-nums text-gray-900">
              {baht.format((current?.base_salary ?? 0) + extraTotal)}
              <span className="ml-1 text-xs font-normal text-gray-400">บาท</span>
            </span>
            {hasVariable && (
              <span className="block text-xs text-gray-400">
                + ค่าคอม/ค่าชิ้นงานตามยอดจริงของแต่ละเดือน
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  เงินเดือนพื้นฐาน
 *
 *  fix   = กรอกผิดแล้วแก้ → ทับแถวเดิม ไม่สร้างขั้นปลอมในประวัติ
 *  raise = ขึ้นเงินเดือน   → แถวใหม่ตามวันที่มีผล ของเก่าอยู่ครบ
 * ------------------------------------------------------------------ */

function SalaryForm({
  userId,
  mode,
  current,
  onDone,
  onCancel,
}: {
  userId: string
  mode: 'fix' | 'raise'
  current: Salary | null
  onDone: () => void
  onCancel: () => void
}) {
  const isRaise = mode === 'raise'
  const [amount, setAmount] = useState(current && !isRaise ? String(current.base_salary) : '')
  const [from, setFrom] = useState(isRaise ? today() : (current?.effective_from ?? today()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('กรอกจำนวนเงินให้ถูกต้อง')

    // กันเผลอใช้ปุ่มขึ้นเงินเดือนแก้เลขที่กรอกผิด — จะได้ประวัติที่อ่านแล้ว
    // เหมือนบริษัทลดเงินเดือนพนักงาน ทั้งที่แค่พิมพ์ผิด
    if (isRaise && current && value <= current.base_salary) {
      return setError(
        `ขึ้นเงินเดือนต้องมากกว่า ${baht.format(current.base_salary)} — ถ้าจะแก้เลขที่กรอกผิด ใช้ปุ่ม "แก้ตัวเลข"`
      )
    }

    setSaving(true)
    setError('')

    // upsert ทั้งสองแบบ — ตารางมี unique(user_id, effective_from)
    // แก้ซ้ำในวันเดิมจะทับแถวเดิม ไม่ชนจนบันทึกไม่ผ่าน
    const { error: dbErr } = await createClient().from('user_compensation').upsert(
      {
        user_id: userId,
        effective_from: from,
        base_salary: value,
        pay_type: 'monthly',
        note: note.trim() || (isRaise ? 'ขึ้นเงินเดือน' : 'แก้ตัวเลข'),
      },
      { onConflict: 'user_id,effective_from' }
    )

    if (dbErr) {
      setError(`บันทึกไม่สำเร็จ: ${dbErr.message}`)
      setSaving(false)
      return
    }
    onDone()
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-gray-500">
            {isRaise ? 'เงินเดือนใหม่ (บาท)' : 'เงินเดือน (บาท)'}
          </span>
          <input
            type="number"
            min={0}
            step={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className={`${FIELD} mt-0.5 w-full text-right font-mono tabular-nums`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">มีผลตั้งแต่</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={!isRaise}
            title={
              isRaise ? undefined : 'แก้ตัวเลขจะทับของวันเดิม — จะเปลี่ยนวันให้ใช้ปุ่มขึ้นเงินเดือน'
            }
            className={`${FIELD} mt-0.5 w-full disabled:bg-gray-100 disabled:text-gray-400`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">หมายเหตุ</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isRaise ? 'เช่น ปรับประจำปี' : 'เช่น กรอกผิด'}
            className={`${FIELD} mt-0.5 w-full`}
          />
        </label>
      </div>

      <p className="text-xs text-gray-500">
        {isRaise
          ? 'เพิ่มเป็นประวัติใหม่ — ของเดิมยังอยู่ ย้อนดูได้ว่าเดือนก่อนได้เท่าไหร่'
          : 'ทับตัวเลขของวันที่มีผลเดิม ใช้ตอนกรอกผิด ไม่ใช่ตอนขึ้นเงินเดือน'}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          ยกเลิก
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : isRaise ? 'บันทึกการขึ้นเงินเดือน' : 'บันทึก'}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  รายได้พิเศษ 1 บรรทัด — หน้าตาเปลี่ยนตามประเภท
 *
 *    ค่าคอมมิชชั่น  ขั้นบันได "ไม่เกิน X ได้ a% · เกินจากนั้น b%"
 *                   เก็บเป็นกติกา — ยอดจ่ายจริงขึ้นกับยอดขายของเดือนนั้น
 *                   ไม่ใส่ขั้นเลยก็ได้ = คอมเปอร์เซ็นต์เดียวทั้งยอด
 *    ค่าชิ้นงาน     เรตบาทต่อชิ้น — ยอดจ่ายจริงขึ้นกับจำนวนชิ้น
 *    ที่เหลือ       ยอดคงที่ต่อเดือน แก้แล้วมีผลทันที
 * ------------------------------------------------------------------ */

type TierDraft = { upTo: string; percent: string }

const calcOf = (kind: string) =>
  kind === 'commission' ? 'tiered_percent' : kind === 'piece' ? 'per_piece' : 'fixed'

/** เทียบกติกาโดยไม่สน key order — jsonb เรียง key ใหม่ตอนเก็บ ใช้ JSON.stringify เทียบตรง ๆ ไม่ได้ */
const tiersKey = (tiers: Tier[] | null) =>
  tiers ? tiers.map((t) => `${t.upTo ?? 'over'}:${t.percent}`).join('|') : ''

const tierText = (tiers: Tier[]) =>
  tiers
    .map((t) =>
      t.upTo === null ? `เกินจากนั้น ${t.percent}%` : `ไม่เกิน ${baht.format(t.upTo)} ได้ ${t.percent}%`
    )
    .join(' · ')

function ItemRow({
  item,
  userId,
  editable,
  onChanged,
  onCancel,
}: {
  item?: PayItem
  userId?: string
  editable: boolean
  onChanged: () => void
  onCancel?: () => void
}) {
  const [kind, setKind] = useState(item?.kind ?? 'commission')
  const [label, setLabel] = useState(item?.label ?? '')
  const [amount, setAmount] = useState(
    item && item.calc !== 'tiered_percent' && item.amount ? String(item.amount) : ''
  )

  // ขั้นบันได: แถวที่มีเพดาน + เปอร์เซ็นต์ของ "เกินจากนั้น" (ขั้นสุดท้ายเสมอ)
  const stored = (item?.config?.tiers ?? []) as Tier[]
  const [steps, setSteps] = useState<TierDraft[]>(
    stored
      .filter((t) => t.upTo !== null)
      .map((t) => ({ upTo: String(t.upTo), percent: String(t.percent) }))
  )
  const [overPercent, setOverPercent] = useState(
    String(stored.find((t) => t.upTo === null)?.percent ?? '')
  )
  const [saving, setSaving] = useState(false)

  const calc = calcOf(kind)

  /** ร่างที่กรอก → กติกาจริง — คืน null ถ้ายังกรอกไม่ครบหรือเพดานไม่ไล่จากน้อยไปมาก */
  const buildTiers = (): Tier[] | null => {
    const out: Tier[] = []
    let last = 0
    for (const step of steps) {
      const upTo = Number(step.upTo)
      const percent = Number(step.percent)
      if (!step.upTo.trim() || !Number.isFinite(upTo) || upTo <= last) return null
      if (!step.percent.trim() || !Number.isFinite(percent) || percent < 0) return null
      out.push({ upTo, percent })
      last = upTo
    }
    const over = Number(overPercent)
    if (!overPercent.trim() || !Number.isFinite(over) || over < 0) return null
    out.push({ upTo: null, percent: over })
    return out
  }

  const name = label.trim() || KINDS.find((k) => k.value === kind)!.label
  const draftTiers = calc === 'tiered_percent' ? buildTiers() : null
  const draftAmount = calc === 'tiered_percent' ? 0 : Number(amount) || 0

  const valid = calc === 'tiered_percent' ? draftTiers !== null : draftAmount > 0
  const dirty =
    !item ||
    kind !== item.kind ||
    name !== item.label ||
    draftAmount !== item.amount ||
    tiersKey(draftTiers) !== tiersKey(item.config?.tiers ?? null)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const sb = createClient()
    const payload = {
      kind,
      label: name,
      amount: draftAmount,
      calc,
      config: draftTiers ? { tiers: draftTiers } : null,
    }
    const { error } = item
      ? await sb.from('user_pay_items').update(payload).eq('id', item.id)
      : await sb.from('user_pay_items').insert({
          ...payload,
          user_id: userId!,
          effective_from: today(),
        })

    setSaving(false)
    if (!error) onChanged()
  }

  /* ── อ่านอย่างเดียว (หน้าโปรไฟล์ตัวเอง) ─────────────────── */
  if (!editable) {
    const i = item!
    return (
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0">
        <span className="min-w-0 text-sm text-gray-600">
          {i.label}
          <span className="ml-1.5 text-xs text-gray-400">
            {KINDS.find((k) => k.value === i.kind)?.label}
          </span>
          {i.calc === 'tiered_percent' && (
            <span className="block text-xs text-gray-400">{tierText(i.config?.tiers ?? [])}</span>
          )}
        </span>
        <span className="shrink-0 font-mono text-sm tabular-nums text-gray-900">
          {i.calc === 'tiered_percent'
            ? 'ตามยอด'
            : i.calc === 'per_piece'
              ? `${baht.format(i.amount)}/ชิ้น`
              : baht.format(i.amount)}
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-100 p-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={`${FIELD} w-36 shrink-0`}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={KINDS.find((k) => k.value === kind)?.label}
          className={`${FIELD} min-w-0 flex-1`}
        />
        {calc !== 'tiered_percent' && (
          <input
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={calc === 'per_piece' ? 'บาท/ชิ้น' : '0'}
            className={`${FIELD} w-28 shrink-0 text-right font-mono tabular-nums`}
          />
        )}

        {/* ปุ่มบันทึกโผล่เฉพาะตอนมีอะไรเปลี่ยน — จะได้รู้ว่ายังไม่ได้กด */}
        {dirty ? (
          <button
            type="button"
            title={valid ? 'บันทึก' : 'กรอกให้ครบก่อน'}
            disabled={saving || !valid}
            onClick={save}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
          >
            <Check size={15} />
          </button>
        ) : (
          <span className="h-9 w-9 shrink-0" />
        )}

        <button
          type="button"
          title={item ? 'ลบรายการนี้' : 'ยกเลิก'}
          onClick={async () => {
            if (item) {
              await createClient().from('user_pay_items').delete().eq('id', item.id)
              onChanged()
            } else {
              onCancel?.()
            }
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:text-red-600"
        >
          {item ? <Trash2 size={15} /> : <X size={15} />}
        </button>
      </div>

      {calc === 'per_piece' && (
        <p className="mt-1 pl-1 text-xs text-gray-400">
          จ่ายจริง = เรตนี้ × จำนวนชิ้นของเดือนนั้น
        </p>
      )}

      {calc === 'tiered_percent' && (
        <div className="mt-1.5 space-y-1.5 pl-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="shrink-0">ยอดไม่เกิน</span>
              <input
                type="number"
                min={0}
                step="any"
                value={step.upTo}
                onChange={(e) =>
                  setSteps(steps.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)))
                }
                placeholder="100000"
                className={`${FIELD} w-32 text-right font-mono tabular-nums`}
              />
              <span className="shrink-0">บาท ได้</span>
              <input
                type="number"
                min={0}
                step="any"
                value={step.percent}
                onChange={(e) =>
                  setSteps(steps.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))
                }
                className={`${FIELD} w-16 text-right font-mono tabular-nums`}
              />
              <span className="shrink-0">%</span>
              <button
                type="button"
                title="ลบขั้นนี้"
                onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                className="text-gray-300 hover:text-red-600"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="shrink-0">{steps.length ? 'เกินจากนั้น ได้' : 'ได้'}</span>
            <input
              type="number"
              min={0}
              step="any"
              value={overPercent}
              onChange={(e) => setOverPercent(e.target.value)}
              className={`${FIELD} w-16 text-right font-mono tabular-nums`}
            />
            <span className="shrink-0">% ของยอดขาย</span>
            <button
              type="button"
              onClick={() => setSteps([...steps, { upTo: '', percent: '' }])}
              className="ml-2 flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-700"
            >
              <Plus size={12} /> เพิ่มขั้น
            </button>
          </div>

          <p className="text-xs text-gray-400">
            เก็บแค่กติกา — ยอดจ่ายจริงคำนวณจากยอดขายของแต่ละเดือน
          </p>
        </div>
      )}
    </div>
  )
}
