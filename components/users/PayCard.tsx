'use client'

// กล่องค่าตอบแทนของพนักงาน 1 คน — เงินเดือนพื้นฐาน + รายได้พิเศษ
//
// ── ใช้ 2 ที่ ─────────────────────────────────────────────────────────
// · หน้าแก้ไขพนักงาน (HR/admin) → แก้เงินเดือนและรายได้พิเศษได้
// · หน้าโปรไฟล์ตัวเอง            → อ่านอย่างเดียว
//
// ── กรอกได้ 2 ทาง ─────────────────────────────────────────────────────
// เงินเดือนพื้นฐาน  หน้า "แก้หลายคนพร้อมกัน" (เร็วเวลาไล่กรอกทั้งบริษัท)
//                   หรือที่นี่ทีละคน (เวลาขึ้นเงินเดือนคนเดียว)
// รายได้พิเศษ       ที่นี่อย่างเดียว — ไม่เหมือนกันสักคน กรอกรวมไม่ได้
//
// ── ใครเห็นอะไร ───────────────────────────────────────────────────────
// RLS ที่ฐานข้อมูลกรองให้แล้ว (เจ้าตัว + HR) — ถ้าไม่มีสิทธิ์จะได้ 0 แถว
// ไม่ใช่ error หน้าจอจึงขึ้นว่า "ยังไม่มีข้อมูล" ซึ่งถูกต้องแล้ว

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/aoo'

type PayItem = {
  id: string
  kind: string
  label: string
  amount: number
  frequency: string
  effective_from: string
  effective_to: string | null
}

const KINDS = [
  { value: 'commission', label: 'ค่าคอมมิชชั่น' },
  { value: 'position', label: 'ค่าตำแหน่ง' },
  { value: 'travel', label: 'ค่าเดินทาง' },
  { value: 'diligence', label: 'เบี้ยขยัน' },
  { value: 'phone', label: 'ค่าโทรศัพท์' },
  { value: 'housing', label: 'ค่าที่พัก' },
  { value: 'other', label: 'อื่น ๆ' },
]

const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

/** ยังจ่ายอยู่ไหม ณ วันนี้ */
const isCurrent = (i: PayItem) => !i.effective_to || i.effective_to >= today()

export default function PayCard({
  userId,
  editable = false,
}: {
  userId: string
  /** true = HR เปิดดูของคนอื่น เพิ่ม/หยุดรายการได้ */
  editable?: boolean
}) {
  const [salary, setSalary] = useState<{ base_salary: number; effective_from: string } | null>(null)
  const [items, setItems] = useState<PayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingSalary, setEditingSalary] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const [{ data: comp }, { data: pay }] = await Promise.all([
      sb
        .from('user_compensation')
        .select('base_salary, effective_from')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('user_pay_items')
        .select('id, kind, label, amount, frequency, effective_from, effective_to')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false }),
    ])

    setSalary(comp ? { base_salary: Number(comp.base_salary), effective_from: comp.effective_from } : null)
    setItems((pay ?? []).map((i) => ({ ...i, amount: Number(i.amount) })))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return null

  const current = items.filter(isCurrent)
  const monthly = current.filter((i) => i.frequency === 'monthly')
  const extraTotal = monthly.reduce((s, i) => s + i.amount, 0)
  const ended = items.filter((i) => !isCurrent(i))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Wallet size={16} className="text-gray-400" /> ค่าตอบแทน
        </h3>
        {editable && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> เพิ่มรายได้พิเศษ
          </Button>
        )}
      </div>

      {/* ── เงินเดือนพื้นฐาน ─────────────────────────────── */}
      {editingSalary ? (
        <SalaryForm
          userId={userId}
          current={salary?.base_salary ?? null}
          onDone={() => {
            setEditingSalary(false)
            load()
          }}
        />
      ) : (
        <Row
          label={
            <>
              เงินเดือนพื้นฐาน
              {salary && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ตั้งแต่ {salary.effective_from}
                </span>
              )}
            </>
          }
        >
          {salary ? (
            <>
              <span className="font-mono tabular-nums">{baht.format(salary.base_salary)}</span>
              <span className="ml-1 text-xs font-normal text-gray-400">บาท</span>
            </>
          ) : (
            <span className="text-orange-600">ยังไม่ได้กรอก</span>
          )}
          {editable && (
            <button
              title="แก้เงินเดือน"
              onClick={() => setEditingSalary(true)}
              className="ml-2 align-middle text-gray-300 hover:text-gray-700"
            >
              <Pencil size={13} />
            </button>
          )}
        </Row>
      )}

      {/* ── รายได้พิเศษ ───────────────────────────────────── */}
      {current.length === 0 && !adding ? (
        <p className="py-2.5 text-sm text-gray-400">ยังไม่มีรายได้พิเศษ</p>
      ) : (
        current.map((i) => (
          <Row
            key={i.id}
            label={
              <>
                {i.label}
                <span className="ml-1.5 text-xs text-gray-400">
                  {KINDS.find((k) => k.value === i.kind)?.label}
                  {i.frequency === 'once' && ' · ครั้งเดียว'}
                </span>
              </>
            }
          >
            <span className="font-mono tabular-nums">{baht.format(i.amount)}</span>
            {editable && (
              <button
                title="หยุดจ่ายรายการนี้ตั้งแต่วันนี้ (ประวัติยังอยู่)"
                onClick={async () => {
                  await createClient()
                    .from('user_pay_items')
                    .update({ effective_to: today() })
                    .eq('id', i.id)
                  load()
                }}
                className="ml-2 align-middle text-gray-300 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            )}
          </Row>
        ))
      )}

      {adding && <AddForm userId={userId} onDone={() => { setAdding(false); load() }} />}

      {/* ── รวม ───────────────────────────────────────────── */}
      {(salary || extraTotal > 0) && (
        <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2.5">
          <span className="text-sm font-medium text-gray-700">รวมต่อเดือน</span>
          <span className="font-mono font-semibold tabular-nums text-gray-900">
            {baht.format((salary?.base_salary ?? 0) + extraTotal)}
            <span className="ml-1 text-xs font-normal text-gray-400">บาท</span>
          </span>
        </div>
      )}

      {ended.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
            รายการที่หยุดจ่ายแล้ว {ended.length} รายการ
          </summary>
          <div className="mt-1">
            {ended.map((i) => (
              <div key={i.id} className="flex justify-between py-1 text-xs text-gray-400">
                <span>
                  {i.label} · ถึง {i.effective_to}
                </span>
                <span className="font-mono tabular-nums">{baht.format(i.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  เงินเดือนพื้นฐาน
 *
 *  เก็บเป็นประวัติตามวันที่มีผล — ขึ้นเงินเดือนแล้วยังย้อนดูได้ว่าเดือนนั้น
 *  ได้เท่าไหร่ (hourly_rate ใช้คิดค่าล่วงเวลาย้อนหลังด้วย)
 *
 *  ใช้ upsert เพราะถ้าแก้ซ้ำในวันเดียวกัน จะได้ทับแถวเดิมแทนที่จะชน
 *  unique(user_id, effective_from) แล้วบันทึกไม่ผ่านเฉย ๆ
 * ------------------------------------------------------------------ */

function SalaryForm({
  userId,
  current,
  onDone,
}: {
  userId: string
  current: number | null
  onDone: () => void
}) {
  const [amount, setAmount] = useState(current !== null ? String(current) : '')
  const [from, setFrom] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 0) return setError('กรอกจำนวนเงินให้ถูกต้อง')

    setSaving(true)
    setError('')
    const { error: dbErr } = await createClient()
      .from('user_compensation')
      .upsert(
        { user_id: userId, effective_from: from, base_salary: value, pay_type: 'monthly' },
        { onConflict: 'user_id,effective_from' }
      )

    if (dbErr) {
      setError(`บันทึกไม่สำเร็จ: ${dbErr.message}`)
      setSaving(false)
      return
    }
    onDone()
  }

  const field = 'h-9 rounded-lg border border-gray-200 px-2 text-sm outline-none focus:border-red-400'

  return (
    <div className="my-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-gray-500">เงินเดือนพื้นฐาน (บาท)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${field} mt-0.5 w-full text-right font-mono tabular-nums`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">มีผลตั้งแต่</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`${field} mt-0.5 w-full`}
          />
        </label>
      </div>

      <p className="text-xs text-gray-500">
        ของเดิมไม่หาย — เก็บเป็นประวัติตามวันที่มีผล ย้อนดูได้ว่าเดือนก่อนได้เท่าไหร่
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={saving}>
          ยกเลิก
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function AddForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [kind, setKind] = useState('commission')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [from, setFrom] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const value = Number(amount)
    // ชื่อว่างได้ — ใช้ชื่อประเภทแทน จะได้ไม่ต้องพิมพ์ซ้ำคำเดิม
    const name = label.trim() || KINDS.find((k) => k.value === kind)!.label
    if (!Number.isFinite(value) || value <= 0) return setError('กรอกจำนวนเงินให้ถูกต้อง')

    setSaving(true)
    setError('')
    const { error: dbErr } = await createClient().from('user_pay_items').insert({
      user_id: userId,
      kind,
      label: name,
      amount: value,
      frequency,
      effective_from: from,
    })

    if (dbErr) {
      setError(`บันทึกไม่สำเร็จ: ${dbErr.message}`)
      setSaving(false)
      return
    }
    onDone()
  }

  const field = 'h-9 rounded-lg border border-gray-200 px-2 text-sm outline-none focus:border-red-400'

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ชื่อรายการ (ไม่ใส่ก็ได้)"
          className={field}
        />
        <input
          type="number"
          min={0}
          step={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="จำนวนเงิน"
          className={`${field} text-right font-mono tabular-nums`}
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className={field}
        >
          <option value="monthly">ได้ทุกเดือน</option>
          <option value="once">ครั้งเดียว</option>
        </select>
        <label className="sm:col-span-2">
          <span className="text-xs text-gray-500">เริ่มมีผล</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`${field} mt-0.5 w-full`}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={saving}>
          ยกเลิก
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'เพิ่ม'}
        </Button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{children}</span>
    </div>
  )
}
