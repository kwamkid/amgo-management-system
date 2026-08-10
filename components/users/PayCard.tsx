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

type PayItem = {
  id: string
  kind: string
  label: string
  amount: number
}

type Salary = { id: string; base_salary: number; effective_from: string; note: string | null }

const KINDS = [
  { value: 'commission', label: 'ค่าคอมมิชชั่น' },
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

const FIELD =
  'h-9 w-full rounded-lg border border-gray-200 px-2 text-sm outline-none focus:border-red-400'

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
        .select('id, kind, label, amount')
        .eq('user_id', userId)
        .order('created_at'),
    ])

    setHistory((comp ?? []).map((c) => ({ ...c, base_salary: Number(c.base_salary) })))
    setItems((pay ?? []).map((i) => ({ ...i, amount: Number(i.amount) })))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return null

  const current = history[0] ?? null
  const extraTotal = items.reduce((s, i) => s + i.amount, 0)

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
      {(current || extraTotal > 0) && (
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-2.5">
          <span className="text-sm font-medium text-gray-700">รวมต่อเดือน</span>
          <span className="font-mono font-semibold tabular-nums text-gray-900">
            {baht.format((current?.base_salary ?? 0) + extraTotal)}
            <span className="ml-1 text-xs font-normal text-gray-400">บาท</span>
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
            className={`${FIELD} mt-0.5 text-right font-mono tabular-nums`}
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
            className={`${FIELD} mt-0.5 disabled:bg-gray-100 disabled:text-gray-400`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">หมายเหตุ</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isRaise ? 'เช่น ปรับประจำปี' : 'เช่น กรอกผิด'}
            className={`${FIELD} mt-0.5`}
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
 *  รายได้พิเศษ 1 บรรทัด
 *
 *  เป็นช่องกรอกตลอด แก้แล้วปุ่มติ๊กถูกจะโผล่ กดแล้วมีผลทันที
 *  ไม่มีปุ่ม "ขึ้น" เพราะไม่ได้เก็บเป็นช่วงเวลาเหมือนเงินเดือน
 * ------------------------------------------------------------------ */

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
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [saving, setSaving] = useState(false)

  const dirty = !item || kind !== item.kind || label !== item.label || Number(amount) !== item.amount

  const save = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    // ไม่ตั้งชื่อก็ได้ — ใช้ชื่อประเภทแทน จะได้ไม่ต้องพิมพ์คำเดิมซ้ำ
    const name = label.trim() || KINDS.find((k) => k.value === kind)!.label

    setSaving(true)
    const sb = createClient()
    const { error } = item
      ? await sb
          .from('user_pay_items')
          .update({ kind, label: name, amount: value })
          .eq('id', item.id)
      : await sb.from('user_pay_items').insert({
          user_id: userId!,
          kind,
          label: name,
          amount: value,
          effective_from: today(),
        })

    setSaving(false)
    if (!error) onChanged()
  }

  if (!editable) {
    return (
      <div className="flex items-baseline justify-between border-b border-gray-100 py-1.5 last:border-0">
        <span className="text-sm text-gray-600">
          {item!.label}
          <span className="ml-1.5 text-xs text-gray-400">
            {KINDS.find((k) => k.value === item!.kind)?.label}
          </span>
        </span>
        <span className="font-mono text-sm tabular-nums text-gray-900">
          {baht.format(item!.amount)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${FIELD} w-36`}>
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
        className={`${FIELD} flex-1`}
      />
      <input
        type="number"
        min={0}
        step={100}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        className={`${FIELD} w-28 text-right font-mono tabular-nums`}
      />

      {/* ปุ่มบันทึกโผล่เฉพาะตอนมีอะไรเปลี่ยน — จะได้รู้ว่ายังไม่ได้กด */}
      {dirty ? (
        <button
          type="button"
          title="บันทึก"
          disabled={saving}
          onClick={save}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
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
  )
}
