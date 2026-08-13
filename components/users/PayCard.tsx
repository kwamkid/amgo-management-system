'use client'

import { Skeleton } from '@/components/shared'

// กล่องค่าตอบแทนของพนักงาน 1 คน — เงินเดือนพื้นฐาน + รายได้พิเศษ
//
// ── ใช้ 2 ที่ ─────────────────────────────────────────────────────────
// · หน้าแก้ไขพนักงาน แท็บเงินเดือน (HR/admin) → แก้ได้ แบบ "จัดฉาก"
//   ทุกการแก้ค้างไว้ในหน้า แล้วเขียนจริงตอนกดปุ่ม บันทึก ท้ายฟอร์มทีเดียว
//   (ผู้ใช้ขอ — ปุ่มเดียวจบทั้งหน้า ไม่มีของบางส่วนบันทึกไปก่อน)
// · หน้าโปรไฟล์ตัวเอง / หน้าสรุป → อ่านอย่างเดียว
//
// ── เงินเดือนพื้นฐาน กับ รายได้พิเศษ ต่างกันตรงไหน ────────────────────
// เงินเดือนพื้นฐาน  เก็บเป็นประวัติตามวันที่มีผล — hourly_rate ใช้คิด
//                   ค่าล่วงเวลาย้อนหลัง ของเก่าต้องอยู่ครบ
//   แก้ตัวเลข       กรอกผิดแล้วแก้ → ทับแถวเดิม ไม่สร้างขั้นปลอม
//   ปรับเงินเดือน   ขึ้นหรือลดก็ได้ → แถวใหม่ตามวันที่มีผล
//                   (ลดต้องใส่เหตุผล — ไทม์ไลน์จะได้บอกได้ว่าเพราะอะไร)
//   หลังพ้นโปร      แถวใหม่ลงวันพ้นโปรล่วงหน้า ถึงวันแล้วสลับเอง
// รายได้พิเศษ       ไม่เก็บเป็นช่วงเวลา — ค่าคงที่/ค่าคอมขั้นบันได/ค่าชิ้นงาน
//
// ทั้งสองตารางมี trigger เขียน audit_log ว่าใครแก้อะไรเมื่อไหร่
// RLS: เจ้าตัว + HR เท่านั้นที่อ่านได้ — คนอื่นได้ 0 แถว ไม่ใช่ error

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Copy, History, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Modal, MoneyInput, SelectMenu } from '@/components/aoo'

type Tier = { upTo: number | null; percent: number }

type PayItem = {
  id: string
  kind: string
  label: string
  amount: number
  /** fixed = ยอดคงที่ · tiered_percent = ค่าคอมขั้นบันได · per_piece = บาทต่อชิ้น */
  calc: string
  config: { tiers?: Tier[] } | null
  /** บริษัทผู้จ่าย — null = บริษัทต้นสังกัดของพนักงาน (เช่น อยู่ AGD แต่ได้ค่าคอมจาก ADF) */
  companyId: string | null
}

type CompanyOpt = { id: string; code: string; name_th: string }

type Salary = { id: string; base_salary: number; effective_from: string; note: string | null }

type SalaryPayload = {
  effective_from: string
  base_salary: number
  note: string
}

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

// ⚠️ ไม่ใส่ความกว้างใน FIELD — เคยใส่ w-full แล้วชนกับ w-36/w-28 รายช่อง
const FIELD =
  'h-9 rounded-lg border border-gray-200 px-2 text-sm outline-none focus:border-red-400'

const calcOf = (kind: string) =>
  kind === 'commission' ? 'tiered_percent' : kind === 'piece' ? 'per_piece' : 'fixed'

/** เทียบกติกาโดยไม่สน key order — jsonb เรียง key ใหม่ตอนเก็บ */
const tiersKey = (tiers: Tier[] | null | undefined) =>
  tiers ? tiers.map((t) => `${t.upTo ?? 'over'}:${t.percent}`).join('|') : ''

const tierText = (tiers: Tier[]) =>
  tiers
    .map((t) =>
      t.upTo === null ? `เกินจากนั้น ${t.percent}%` : `ไม่เกิน ${baht.format(t.upTo)} ได้ ${t.percent}%`
    )
    .join(' · ')

const itemChanged = (a: PayItem, b: PayItem) =>
  a.kind !== b.kind ||
  a.label !== b.label ||
  a.amount !== b.amount ||
  a.companyId !== b.companyId ||
  tiersKey(a.config?.tiers) !== tiersKey(b.config?.tiers)

let tmpSeq = 0

export default function PayCard({
  userId,
  editable = false,
  registerFlush,
}: {
  userId: string
  /** true = HR/admin เปิดดูของคนอื่น แก้ได้ */
  editable?: boolean
  /**
   * โหมดจัดฉาก — ส่งมาแล้วการแก้ทั้งหมดจะ "ค้างไว้ในหน้า" ไม่เขียนฐานข้อมูล
   * จนกว่าฟอร์มแม่จะเรียกฟังก์ชันที่ลงทะเบียนไว้ (ตอนกดปุ่มบันทึกท้ายฟอร์ม)
   * คืนรายการ error — ว่าง = สำเร็จหมด
   */
  registerFlush?: (flush: () => Promise<string[]>) => void
}) {
  const staged = !!registerFlush

  const [history, setHistory] = useState<Salary[]>([])
  const [items, setItems] = useState<PayItem[]>([])
  const [probation, setProbation] = useState<{ onProbation: boolean; endDate: string | null }>({
    onProbation: false,
    endDate: null,
  })
  // บริษัททั้งหมด + ต้นสังกัดของคนนี้ — รายได้พิเศษระบุบริษัทผู้จ่ายได้
  const [companies, setCompanies] = useState<CompanyOpt[]>([])
  const [ownCompanyId, setOwnCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'view' | 'fix' | 'raise' | 'post'>('view')

  // กดปรับเงินเดือนเมื่อไหร่ กางประวัติให้เลย — จะได้เห็นว่าที่ผ่านมาขึ้นยังไง
  useEffect(() => {
    if (mode !== 'view') setShowLog(true)
  }, [mode])
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [stagedCount, setStagedCount] = useState(0)

  // ค่าที่ flush ต้องใช้ — เก็บใน ref เพื่อให้ฟังก์ชันที่ลงทะเบียนครั้งเดียว
  // เห็นค่าล่าสุดเสมอ ไม่ติดอยู่กับ closure เก่า
  const itemsRef = useRef<PayItem[]>([])
  itemsRef.current = items
  const originalsRef = useRef<PayItem[]>([])
  const pendingSalaryRef = useRef<SalaryPayload[]>([])

  const load = useCallback(async () => {
    const sb = createClient()
    const [{ data: comp }, { data: pay }, { data: person }, { data: cos }] = await Promise.all([
      sb
        .from('user_compensation')
        .select('id, base_salary, effective_from, note')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false }),
      sb
        .from('user_pay_items')
        .select('id, kind, label, amount, calc, config, company_id')
        .eq('user_id', userId)
        .order('created_at'),
      sb
        .from('users')
        .select('employment_status, probation_end_date, company_id')
        .eq('id', userId)
        .maybeSingle(),
      sb.from('companies').select('id, code, name_th').eq('is_active', true).order('code'),
    ])

    setHistory((comp ?? []).map((c) => ({ ...c, base_salary: Number(c.base_salary) })))
    const loaded = (pay ?? []).map((i) => ({
      ...i,
      amount: Number(i.amount),
      config: i.config as PayItem['config'],
      companyId: i.company_id,
    }))
    setItems(loaded)
    originalsRef.current = loaded
    pendingSalaryRef.current = []
    setStagedCount(0)
    setProbation({
      onProbation: person?.employment_status === 'probation',
      endDate: person?.probation_end_date ?? null,
    })
    setOwnCompanyId(person?.company_id ?? null)
    setCompanies(cos ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  /* ── เขียนจริงทั้งชุด — ฟอร์มแม่เรียกตอนกดบันทึก ─────────── */
  const flush = useCallback(async (): Promise<string[]> => {
    const sb = createClient()
    const errors: string[] = []

    for (const payload of pendingSalaryRef.current) {
      const { error } = await sb.from('user_compensation').upsert(
        { user_id: userId, pay_type: 'monthly', ...payload },
        { onConflict: 'user_id,effective_from' }
      )
      if (error) errors.push(`เงินเดือน: ${error.message}`)
    }

    const original = originalsRef.current
    const current = itemsRef.current
    const currentIds = new Set(current.map((i) => i.id))

    for (const o of original) {
      if (!currentIds.has(o.id)) {
        const { error } = await sb.from('user_pay_items').delete().eq('id', o.id)
        if (error) errors.push(`ลบ ${o.label}: ${error.message}`)
      }
    }

    for (const item of current) {
      const payload = {
        kind: item.kind,
        label: item.label,
        amount: item.amount,
        calc: item.calc,
        config: item.config,
        company_id: item.companyId,
      }
      if (item.id.startsWith('tmp-')) {
        const { error } = await sb.from('user_pay_items').insert({
          ...payload,
          user_id: userId,
          effective_from: today(),
        })
        if (error) errors.push(`${item.label}: ${error.message}`)
      } else {
        const before = original.find((o) => o.id === item.id)
        if (before && itemChanged(before, item)) {
          const { error } = await sb.from('user_pay_items').update(payload).eq('id', item.id)
          if (error) errors.push(`${item.label}: ${error.message}`)
        }
      }
    }

    if (!errors.length) await load()
    return errors
  }, [userId, load])

  useEffect(() => {
    registerFlush?.(flush)
  }, [registerFlush, flush])

  if (loading) return null

  /* ── มุมมอง ────────────────────────────────────────────────── */

  // แถวลงวันที่ล่วงหน้า (เงินเดือนหลังพ้นโปร) ยังไม่ใช่ "ปัจจุบัน"
  const upcoming = history.filter((h) => h.effective_from > today())
  const effective = history.filter((h) => h.effective_from <= today())
  const current = effective[0] ?? null
  const postProbationSet =
    !!probation.endDate && history.some((h) => h.effective_from >= probation.endDate!)

  // รวมได้เฉพาะยอดคงที่ — ค่าคอม/ค่าชิ้นงานต้องรอยอดขายจริงของแต่ละเดือน
  const extraTotal = items.filter((i) => i.calc === 'fixed').reduce((s, i) => s + i.amount, 0)
  const hasVariable = items.some((i) => i.calc !== 'fixed')

  /* ── ตัวรับจากฟอร์มย่อย — จัดฉากหรือเขียนเลยตามโหมด ─────────── */

  const saveSalary = async (payload: SalaryPayload): Promise<string | null> => {
    if (staged) {
      pendingSalaryRef.current.push(payload)
      // อัปเดตหน้าให้เห็นทันที — แถวเดียวกัน (วันที่เดียวกัน) ทับของเดิม
      setHistory((prev) => {
        const rest = prev.filter((h) => h.effective_from !== payload.effective_from)
        return [{ id: `tmp-s${++tmpSeq}`, ...payload }, ...rest].sort((a, b) =>
          b.effective_from.localeCompare(a.effective_from)
        )
      })
      setStagedCount((n) => n + 1)
      return null
    }

    const { error } = await createClient().from('user_compensation').upsert(
      { user_id: userId, pay_type: 'monthly', ...payload },
      { onConflict: 'user_id,effective_from' }
    )
    if (error) return error.message
    await load()
    return null
  }

  const saveItem = async (item: PayItem): Promise<string | null> => {
    if (staged) {
      setItems((prev) => {
        const exists = prev.some((i) => i.id === item.id)
        return exists ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]
      })
      setStagedCount((n) => n + 1)
      return null
    }

    const sb = createClient()
    const payload = {
      kind: item.kind,
      label: item.label,
      amount: item.amount,
      calc: item.calc,
      config: item.config,
      company_id: item.companyId,
    }
    const { error } = item.id.startsWith('tmp-')
      ? await sb
          .from('user_pay_items')
          .insert({ ...payload, user_id: userId, effective_from: today() })
      : await sb.from('user_pay_items').update(payload).eq('id', item.id)
    if (error) return error.message
    await load()
    return null
  }

  const removeItem = async (id: string) => {
    if (staged) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      setStagedCount((n) => n + 1)
      return
    }
    await createClient().from('user_pay_items').delete().eq('id', id)
    await load()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Wallet size={16} className="text-gray-400" /> ค่าตอบแทน
        </h3>
        {staged && stagedCount > 0 && (
          <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-700">
            แก้แล้ว ยังไม่บันทึก — กดปุ่มบันทึกท้ายฟอร์ม
          </span>
        )}
      </div>

      {/* ── เงินเดือนพื้นฐาน ─────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-gray-500">
            {probation.onProbation ? 'เงินเดือนช่วงทดลองงาน' : 'เงินเดือนพื้นฐาน'}
          </span>
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
                <ArrowUpRight size={14} /> ปรับเงินเดือน
              </Button>
            </div>
          )}
        </div>

        {/* แถวที่ลงวันที่ล่วงหน้า — เช่น เงินเดือนหลังพ้นโปร */}
        {upcoming.map((h) => {
          const lower = current ? h.base_salary < current.base_salary : false
          return (
            <p key={h.id} className={`mt-1 text-sm ${lower ? 'text-red-700' : 'text-green-700'}`}>
              {lower ? '↘ ลดเหลือ' : '↗ ปรับเป็น'}{' '}
              <span className="font-mono tabular-nums">{baht.format(h.base_salary)}</span> ตั้งแต่{' '}
              {thaiDate(h.effective_from)}
              {h.note && <span className="text-gray-400"> · {h.note}</span>}
            </p>
          )
        })}

        {/* ช่วงโปรแต่ยังไม่ได้ตั้งเงินเดือนหลังพ้นโปร */}
        {editable && probation.onProbation && probation.endDate && !postProbationSet && mode === 'view' && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
            <span>ยังไม่ได้ตั้งเงินเดือนหลังพ้นโปร ({thaiDate(probation.endDate)})</span>
            <Button variant="secondary" size="sm" onClick={() => setMode('post')}>
              ตั้งเลย
            </Button>
          </div>
        )}

        {mode !== 'view' && (
          <SalaryForm
            mode={mode}
            current={current}
            probationEndDate={probation.endDate}
            onSave={saveSalary}
            onClose={() => setMode('view')}
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
              const prev = history[i + 1]
              const diff = prev ? h.base_salary - prev.base_salary : 0
              return (
                <div key={h.id} className="flex items-baseline gap-2 text-xs">
                  <span className="w-20 shrink-0 text-gray-400">{thaiDate(h.effective_from)}</span>
                  <span className="font-mono tabular-nums text-gray-700">
                    {baht.format(h.base_salary)}
                  </span>
                  {diff !== 0 && prev && (
                    <span
                      className={`font-mono tabular-nums ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {diff > 0 ? '+' : ''}
                      {baht.format(diff)} ({diff > 0 ? '+' : ''}
                      {Math.round((diff / prev.base_salary) * 100)}%)
                    </span>
                  )}
                  {!prev && <span className="text-gray-400">เริ่มต้น</span>}
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
          <span className="text-sm text-gray-500">รายได้พิเศษ</span>
          {editable && !adding && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setImporting(true)}>
                <Copy size={13} /> คัดลอกจากคนอื่น
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <Plus size={14} /> เพิ่ม
              </Button>
            </div>
          )}
        </div>

        {items.length === 0 && !adding ? (
          <p className="py-1 text-sm text-gray-400">ยังไม่มีรายได้พิเศษ</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                editable={editable}
                companies={companies}
                ownCompanyId={ownCompanyId}
                onSave={saveItem}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}

        {importing && (
          <ImportItemsModal
            currentUserId={userId}
            companies={companies}
            ownCompanyId={ownCompanyId}
            onClose={() => setImporting(false)}
            onCopy={async (list) => {
              const errs: string[] = []
              for (const it of list) {
                const err = await saveItem(it)
                if (err) errs.push(`${it.label}: ${err}`)
              }
              if (errs.length) alert(`คัดลอกไม่สำเร็จบางรายการ:\n${errs.join('\n')}`)
              setImporting(false)
            }}
          />
        )}

        {adding && (
          <Modal
            open
            onClose={() => setAdding(false)}
            title="เพิ่มรายได้พิเศษ"
            description="เลือกบริษัทผู้จ่ายได้ — พนักงานอาจได้ค่าคอม/เงินพิเศษจากอีกบริษัท"
            maxWidth={620}
          >
            <ItemRow
              editable
              companies={companies}
              ownCompanyId={ownCompanyId}
              onSave={async (item) => {
                const err = await saveItem(item)
                if (!err) setAdding(false)
                return err
              }}
              onRemove={async () => setAdding(false)}
            />
          </Modal>
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
 *  fix   = กรอกผิดแล้วแก้        → ทับแถวเดิม ไม่สร้างขั้นปลอมในประวัติ
 *  raise = ปรับเงินเดือน          → แถวใหม่ ขึ้นหรือลดก็ได้ (ลดต้องใส่เหตุผล)
 *  post  = เงินเดือนหลังพ้นโปร   → แถวใหม่ลงวันพ้นโปรล่วงหน้า สลับเองเมื่อถึงวัน
 * ------------------------------------------------------------------ */

function SalaryForm({
  mode,
  current,
  probationEndDate,
  onSave,
  onClose,
}: {
  mode: 'fix' | 'raise' | 'post'
  current: Salary | null
  probationEndDate?: string | null
  onSave: (payload: SalaryPayload) => Promise<string | null>
  onClose: () => void
}) {
  const isRaise = mode === 'raise'
  const isPost = mode === 'post'
  const [amount, setAmount] = useState(current && mode === 'fix' ? String(current.base_salary) : '')
  const [from, setFrom] = useState(
    isPost ? (probationEndDate ?? today()) : isRaise ? today() : (current?.effective_from ?? today())
  )
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('กรอกจำนวนเงินให้ถูกต้อง')

    // ปรับลดทำได้ แต่ต้องบอกเหตุผล — ไทม์ไลน์ของคนนี้จะได้อ่านรู้เรื่อง
    // ว่าลดเพราะอะไร ไม่ใช่ตัวเลขหล่นเฉย ๆ
    const isCut = isRaise && current && value < current.base_salary
    if (isCut && !note.trim()) {
      return setError('ปรับลดเงินเดือนต้องใส่เหตุผล (เช่น ผลงานไม่ผ่านเกณฑ์)')
    }

    setSaving(true)
    setError('')
    const err = await onSave({
      effective_from: from,
      base_salary: value,
      note:
        note.trim() ||
        (isPost ? 'พ้นทดลองงาน' : isCut ? 'ปรับลดเงินเดือน' : isRaise ? 'ขึ้นเงินเดือน' : 'แก้ตัวเลข'),
    })

    if (err) {
      setError(`บันทึกไม่สำเร็จ: ${err}`)
      setSaving(false)
      return
    }
    onClose()
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-gray-500">
            {isPost ? 'เงินเดือนหลังพ้นโปร (บาท)' : isRaise ? 'เงินเดือนใหม่ (บาท)' : 'เงินเดือน (บาท)'}
          </span>
          <MoneyInput
            value={amount}
            onValueChange={(_, text) => setAmount(text)}
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
            disabled={mode === 'fix'}
            title={
              mode === 'fix'
                ? 'แก้ตัวเลขจะทับของวันเดิม — จะเปลี่ยนวันให้ใช้ปุ่มปรับเงินเดือน'
                : undefined
            }
            className={`${FIELD} mt-0.5 w-full disabled:bg-gray-100 disabled:text-gray-400`}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">หมายเหตุ / เหตุผล</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isRaise ? 'เช่น ปรับประจำปี · ผลงานไม่ผ่านเกณฑ์' : 'เช่น กรอกผิด'}
            className={`${FIELD} mt-0.5 w-full`}
          />
        </label>
      </div>

      <p className="text-xs text-gray-500">
        {isPost
          ? 'ลงวันที่ล่วงหน้า — พอถึงวันพ้นโปร ระบบใช้ตัวเลขนี้เอง ไม่ต้องกลับมาแก้'
          : isRaise
            ? 'เพิ่มเป็นประวัติใหม่ ขึ้นหรือลดก็ได้ — ของเดิมยังอยู่ ย้อนดูได้ในไทม์ไลน์'
            : 'ทับตัวเลขของวันที่มีผลเดิม ใช้ตอนกรอกผิด ไม่ใช่ตอนปรับเงินเดือน'}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          ยกเลิก
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving
            ? 'กำลังบันทึก...'
            : isPost
              ? 'ตั้งเงินเดือนหลังพ้นโปร'
              : isRaise
                ? 'ปรับเงินเดือน'
                : 'ตกลง'}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  รายได้พิเศษ 1 บรรทัด — หน้าตาเปลี่ยนตามประเภท
 *
 *    ค่าคอมมิชชั่น  เปอร์เซ็นต์อยู่แถวเดียวกับประเภท/ชื่อ
 *                   กด "เพิ่มขั้น" ค่อยกางขั้นบันไดลงมาข้างล่าง
 *    ค่าชิ้นงาน     เรตบาทต่อชิ้น
 *    ที่เหลือ       ยอดคงที่ต่อเดือน
 * ------------------------------------------------------------------ */

type TierDraft = { upTo: string; percent: string }

function ItemRow({
  item,
  editable,
  companies,
  ownCompanyId,
  onSave,
  onRemove,
}: {
  item?: PayItem
  editable: boolean
  companies: CompanyOpt[]
  ownCompanyId: string | null
  onSave: (item: PayItem) => Promise<string | null>
  onRemove: (id: string) => Promise<void> | void
}) {
  const [kind, setKind] = useState(item?.kind ?? 'commission')
  const [label, setLabel] = useState(item?.label ?? '')
  // '' = ตามบริษัทต้นสังกัด (เก็บ null) — ย้ายบริษัทแล้วรายการตามไปเอง
  const [companyId, setCompanyId] = useState(item?.companyId ?? '')
  const [amount, setAmount] = useState(
    item && item.calc !== 'tiered_percent' && item.amount ? String(item.amount) : ''
  )

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
    (companyId || null) !== item.companyId ||
    tiersKey(draftTiers) !== tiersKey(item.config?.tiers ?? null)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    await onSave({
      id: item?.id ?? `tmp-${++tmpSeq}`,
      kind,
      label: name,
      amount: draftAmount,
      calc,
      config: draftTiers ? { tiers: draftTiers } : null,
      companyId: companyId || null,
    })
    setSaving(false)
  }

  const ownCode = companies.find((c) => c.id === ownCompanyId)?.code
  /** ป้ายบริษัทผู้จ่าย — โชว์เมื่อจ่ายโดยบริษัทอื่นที่ไม่ใช่ต้นสังกัด */
  const paidByOther =
    item?.companyId && item.companyId !== ownCompanyId
      ? companies.find((c) => c.id === item.companyId)?.code
      : null

  /* ── อ่านอย่างเดียว ─────────────────────────────────────────── */
  if (!editable) {
    const i = item!
    return (
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0">
        <span className="min-w-0 text-sm text-gray-600">
          {i.label}
          <span className="ml-1.5 text-xs text-gray-400">
            {KINDS.find((k) => k.value === i.kind)?.label}
          </span>
          {paidByOther && (
            <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[11px] font-medium text-amber-700">
              จ่ายโดย {paidByOther}
            </span>
          )}
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
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="w-36 shrink-0">
          <SelectMenu
            value={kind}
            options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
            onChange={(v) => setKind(v ?? 'commission')}
            size="md"
          />
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            kind === 'commission'
              ? 'ค่าคอมของแบรนด์อะไร — เช่น ค่าคอมแบรนด์ AooCare'
              : KINDS.find((k) => k.value === kind)?.label
          }
          className={`${FIELD} w-32 min-w-0 flex-1`}
        />

        {/* บริษัทผู้จ่าย — ค่าเริ่มต้นตามต้นสังกัด เปลี่ยนได้เมื่ออีกบริษัทเป็นคนจ่าย */}
        <div className="w-44 shrink-0">
          <SelectMenu
            value={companyId || null}
            options={companies.map((c) => ({ value: c.id, label: `จ่ายโดย ${c.code} · ${c.name_th}` }))}
            onChange={(v) => setCompanyId(v ?? '')}
            clearable={`จ่ายโดยต้นสังกัด${ownCode ? ` (${ownCode})` : ''}`}
            placeholder={`จ่ายโดยต้นสังกัด${ownCode ? ` (${ownCode})` : ''}`}
            size="md"
          />
        </div>

        {/* คอมแบบไม่มีขั้น = เปอร์เซ็นต์เดียว อยู่แถวเดียวกันจบ
            กดเพิ่มขั้นเมื่อไหร่ค่อยกางลงข้างล่าง */}
        {calc === 'tiered_percent' && steps.length === 0 && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-gray-600">
            ได้
            <input
              type="number"
              min={0}
              step="any"
              value={overPercent}
              onChange={(e) => setOverPercent(e.target.value)}
              className={`${FIELD} w-16 text-right font-mono tabular-nums`}
            />
            % ของยอด
            <button
              type="button"
              onClick={() => setSteps([{ upTo: '', percent: '' }])}
              className="ml-1 flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-700"
            >
              <Plus size={12} /> ขั้นบันได
            </button>
          </span>
        )}

        {calc !== 'tiered_percent' && (
          <MoneyInput
            value={amount}
            onValueChange={(_, text) => setAmount(text)}
            placeholder={calc === 'per_piece' ? 'บาท/ชิ้น' : '0'}
            className={`${FIELD} w-28 shrink-0 text-right font-mono tabular-nums`}
          />
        )}

      </div>

      {calc === 'per_piece' && (
        <p className="mt-1 pl-1 text-xs text-gray-400">จ่ายจริง = เรตนี้ × จำนวนชิ้นของเดือนนั้น</p>
      )}

      {/* ขั้นบันได — โผล่เฉพาะตอนมีขั้น */}
      {calc === 'tiered_percent' && steps.length > 0 && (
        <div className="mt-1.5 space-y-1.5 pl-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="shrink-0">ยอดไม่เกิน</span>
              <MoneyInput
                value={step.upTo}
                onValueChange={(_, text) =>
                  setSteps(steps.map((x, j) => (j === i ? { ...x, upTo: text } : x)))
                }
                placeholder="100,000"
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
            <span className="shrink-0">เกินจากนั้น ได้</span>
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

      {/* ปุ่มยืนยัน — ข้อความชัดเจนแทนไอคอน ✓/✕ เดิม */}
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item?.id ?? '')}
          disabled={saving}
        >
          {item ? (
            <>
              <Trash2 size={14} /> ลบรายการ
            </>
          ) : (
            <>
              <X size={14} /> ยกเลิก
            </>
          )}
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !valid || !dirty}
          title={valid ? undefined : 'กรอกให้ครบก่อน'}
        >
          <Check size={14} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  คัดลอกรายได้พิเศษจากคนอื่น — คนตำแหน่งเดียวกันมักได้กติกาชุดเดียวกัน
 *  (PC ได้ค่าคอมเรตเดียวกันทั้งทีม) ตั้งที่คนแรกคนเดียวแล้วคัดลอกให้ที่เหลือ
 *
 *  ลิสต์เฉพาะคนที่มีรายได้พิเศษให้เลือกเป็นต้นแบบ → ติ๊กรายการที่จะเอา →
 *  ได้มาเป็นรายการใหม่ของคนนี้ (แก้ต่อได้อิสระ ไม่ผูกกับต้นแบบ)
 * ------------------------------------------------------------------ */

function ImportItemsModal({
  currentUserId,
  companies,
  ownCompanyId,
  onCopy,
  onClose,
}: {
  currentUserId: string
  companies: CompanyOpt[]
  ownCompanyId: string | null
  onCopy: (items: PayItem[]) => Promise<void>
  onClose: () => void
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([])
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [sourceItems, setSourceItems] = useState<PayItem[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState(false)

  // คนที่มีรายได้พิเศษเท่านั้นที่เป็นต้นแบบได้ — โชว์จำนวนรายการท้ายชื่อ
  useEffect(() => {
    ;(async () => {
      const sb = createClient()
      const [{ data: pays }, { data: users }] = await Promise.all([
        sb.from('user_pay_items').select('user_id'),
        sb
          .from('users')
          .select('id, display_name, full_name')
          .eq('is_active', true)
          .eq('is_system', false)
          .is('deleted_at', null)
          .order('employee_code', { ascending: true, nullsFirst: false }),
      ])
      const counts = new Map<string, number>()
      for (const r of pays ?? []) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1)
      setOptions(
        (users ?? [])
          .filter((u) => u.id !== currentUserId && counts.has(u.id))
          .map((u) => ({
            value: u.id,
            label: `${u.display_name || u.full_name} (${counts.get(u.id)} รายการ)`,
          }))
      )
    })()
  }, [currentUserId])

  const pickSource = async (id: string | null) => {
    setSourceId(id)
    setSourceItems(null)
    if (!id) return
    const { data } = await createClient()
      .from('user_pay_items')
      .select('id, kind, label, amount, calc, config, company_id')
      .eq('user_id', id)
      .order('created_at')
    const loaded = (data ?? []).map((i) => ({
      ...i,
      amount: Number(i.amount),
      config: i.config as PayItem['config'],
      companyId: i.company_id,
    }))
    setSourceItems(loaded)
    setPicked(new Set(loaded.map((i) => i.id))) // ติ๊กครบไว้ก่อน — ส่วนใหญ่เอาทั้งชุด
  }

  const summaryOf = (i: PayItem) => {
    if (i.calc === 'tiered_percent') return tierText(i.config?.tiers ?? [])
    if (i.calc === 'per_piece') return `${baht.format(i.amount)} บาท/ชิ้น`
    return `${baht.format(i.amount)} บาท/เดือน`
  }

  const copy = async () => {
    if (!sourceItems) return
    setCopying(true)
    await onCopy(
      sourceItems
        .filter((i) => picked.has(i.id))
        .map((i) => ({ ...i, id: `tmp-${++tmpSeq}` })) // ได้สำเนาใหม่ ไม่ผูกกับของต้นแบบ
    )
    setCopying(false)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="คัดลอกรายได้พิเศษจากคนอื่น"
      description="เลือกพนักงานต้นแบบ แล้วติ๊กรายการที่จะคัดลอกมาให้คนนี้ — คัดลอกแล้วแก้แยกกันได้อิสระ"
      maxWidth={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={copying}>
            ยกเลิก
          </Button>
          <Button onClick={copy} disabled={copying || !sourceItems || picked.size === 0}>
            {copying ? 'กำลังคัดลอก...' : `คัดลอก ${picked.size} รายการ`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <SelectMenu
          value={sourceId}
          options={options}
          onChange={pickSource}
          placeholder={options.length ? 'เลือกพนักงานต้นแบบ' : 'ยังไม่มีใครตั้งรายได้พิเศษไว้เลย'}
          size="md"
        />

        {sourceId && sourceItems === null && <Skeleton bare rows={2} />}

        {sourceItems?.length === 0 && (
          <p className="py-2 text-sm text-gray-400">คนนี้ไม่มีรายได้พิเศษ</p>
        )}

        {!!sourceItems?.length && (
          <div className="space-y-1">
            {sourceItems.map((i) => {
              const paidBy =
                i.companyId && i.companyId !== ownCompanyId
                  ? companies.find((c) => c.id === i.companyId)?.code
                  : null
              return (
                <label
                  key={i.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={picked.has(i.id)}
                    onChange={(e) =>
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(i.id)
                        else next.delete(i.id)
                        return next
                      })
                    }
                    className="mt-0.5 h-4 w-4 accent-red-600"
                  />
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-gray-900">{i.label}</span>
                    <span className="ml-1.5 text-xs text-gray-400">
                      {KINDS.find((k) => k.value === i.kind)?.label}
                    </span>
                    {paidBy && (
                      <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[11px] font-medium text-amber-700">
                        จ่ายโดย {paidBy}
                      </span>
                    )}
                    <span className="block text-xs text-gray-500">{summaryOf(i)}</span>
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
