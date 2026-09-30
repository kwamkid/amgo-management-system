'use client'

// ใบเบิกค่าใช้จ่ายของฉัน — จ่ายไปก่อนแล้วเบิกคืน (30 ก.ย. 69)
//
// กติกาเจ้าของ: ต้องแนบรูปใบเสร็จทุกใบ ไม่มีวงเงิน (ไม่มีใบเสร็จ เช่น ค่าวิน =
// เขียนเหตุผลแทน) · เลือกได้ทีละใบว่าจะรับคืนกับเงินเดือนหรือให้โอนแยก
// ขั้นอนุมัติ: ผู้จัดการ → บัญชี/HR · รูปใบเสร็จเลือกจากคลังได้ (ถ่ายเก็บไว้ก่อนได้)

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { ImagePlus, Receipt, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import {
  Button,
  DatePicker,
  EmptyState,
  Field,
  Input,
  Modal,
  MoneyInput,
  Pill,
  RadioCardGroup,
  SelectMenu,
} from '@/components/aoo'
import { ListRow, ListRows, PageHeader, SectionCard, Skeleton } from '@/components/shared'
import ExpenseStatusPill from '@/components/expenses/ExpenseStatusPill'
import ReceiptThumbs from '@/components/expenses/ReceiptThumbs'
import {
  CATEGORY_LABEL,
  PAYOUT_LABEL,
  cancelClaim,
  createClaim,
  listMyClaims,
  type ExpenseCategory,
  type ExpenseClaim,
  type ExpensePayout,
} from '@/lib/services/expenseService'

const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const thaiDate = (iso: string) => format(new Date(`${iso}T00:00:00`), 'd MMM yyyy', { locale: th })
const todayIso = () => format(new Date(), 'yyyy-MM-dd')

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((k) => ({
  value: k,
  label: CATEGORY_LABEL[k],
}))

export default function MyExpensesPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [rows, setRows] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])

  // ฟอร์ม
  const [expenseDate, setExpenseDate] = useState(todayIso())
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [payout, setPayout] = useState<ExpensePayout>('payroll')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [noReceipt, setNoReceipt] = useState(false)
  const [noReceiptReason, setNoReceiptReason] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    if (!userData?.id) return
    try {
      setRows(await listMyClaims(userData.id))
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id])

  useEffect(() => {
    reload()
    createClient()
      .from('companies')
      .select('id, code')
      .order('code')
      .then(({ data }) => setCompanies((data ?? []).map((c) => ({ value: c.id, label: c.code }))))
  }, [reload])

  const openForm = () => {
    setExpenseDate(todayIso())
    setCategory(null)
    setDescription('')
    setAmount(0)
    setPayout('payroll')
    setCompanyId(userData?.companyId ?? null)
    setFiles([])
    setNoReceipt(false)
    setNoReceiptReason('')
    setOpen(true)
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 6))
    if (fileInput.current) fileInput.current.value = ''
  }

  const submit = async () => {
    if (!userData?.id) return
    if (!category) {
      showToast('เลือกประเภทค่าใช้จ่าย', 'error')
      return
    }
    try {
      setSaving(true)
      await createClaim({
        userId: userData.id,
        userName: userData.displayName || userData.fullName || '',
        companyId,
        expenseDate,
        category,
        description,
        amount,
        payout,
        receipts: noReceipt ? [] : files,
        noReceiptReason: noReceipt ? noReceiptReason : '',
        today: todayIso(),
      })
      showToast('ยื่นใบเบิกแล้ว รอผู้จัดการอนุมัติ', 'success')
      setOpen(false)
      reload()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await cancelClaim(id)
      showToast('ยกเลิกใบเบิกแล้ว', 'success')
      reload()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const waiting = rows
    .filter((r) => ['pending_manager', 'pending_finance', 'approved'].includes(r.status))
    .reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="เบิกค่าใช้จ่าย"
        description="จ่ายค่าใช้จ่ายของงานไปก่อน แล้วถ่ายรูปใบเสร็จมาเบิกคืน"
        icon={Receipt}
        actions={
          <Button size="sm" icon="Plus" onClick={openForm}>
            ยื่นใบเบิก
          </Button>
        }
      />

      <SectionCard
        title={waiting > 0 ? `ใบของคุณ · รอรับคืน ${baht.format(waiting)} บาท` : 'ใบของคุณ'}
      >
        {loading ? (
          <Skeleton rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title="ยังไม่มีใบเบิก"
            body="จ่ายค่าเดินทาง ค่าน้ำมัน ซื้อของให้งานไปก่อน? กด 'ยื่นใบเบิก' แล้วแนบรูปใบเสร็จ"
          />
        ) : (
          <ListRows variant="divided">
            {rows.map((c) => (
              <ListRow
                key={c.id}
                title={
                  <span className="whitespace-normal text-sm">
                    <span className="font-semibold">{baht.format(c.amount)} บาท</span>
                    <span className="text-gray-500"> · {c.description}</span>
                  </span>
                }
                meta={
                  <>
                    <p className="text-xs">
                      {thaiDate(c.expenseDate)} · {CATEGORY_LABEL[c.category]} · {PAYOUT_LABEL[c.payout]}
                      {c.payout === 'payroll' && c.payrollMonth && (
                        <> งวด {format(new Date(`${c.payrollMonth}T00:00:00`), 'MMM yyyy', { locale: th })}</>
                      )}
                    </p>
                    {c.noReceiptReason && (
                      <p className="text-xs text-gray-500">ไม่มีใบเสร็จ: {c.noReceiptReason}</p>
                    )}
                    {c.rejectedReason && (
                      <p className="text-xs text-red-600">ไม่อนุมัติ: {c.rejectedReason}</p>
                    )}
                    <ReceiptThumbs paths={c.receiptPaths} />
                  </>
                }
                trailing={
                  <>
                    <ExpenseStatusPill status={c.status} />
                    {c.status === 'pending_manager' && (
                      <Button variant="ghost" size="sm" icon="X" onClick={() => cancel(c.id)}>
                        ยกเลิก
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </ListRows>
        )}
      </SectionCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="ยื่นใบเบิกค่าใช้จ่าย"
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={submit} loading={saving}>
              {saving ? 'กำลังยื่น...' : 'ยื่นใบเบิก'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="จ่ายเงินวันที่" asDiv>
              <DatePicker value={expenseDate} onChange={setExpenseDate} />
            </Field>
            <Field label="ยอดเงิน (บาท)">
              <MoneyInput value={amount || ''} onValueChange={(n) => setAmount(n)} placeholder="0.00" />
            </Field>
          </div>

          <Field label="ประเภท" asDiv>
            <SelectMenu
              value={category}
              options={CATEGORY_OPTIONS}
              onChange={(v) => setCategory(v as ExpenseCategory | null)}
              placeholder="เลือกประเภทค่าใช้จ่าย"
            />
          </Field>

          <Field label="จ่ายค่าอะไร">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="เช่น แท็กซี่ไปออกบูธ รพ.วิมุต"
            />
          </Field>

          <Field
            label="รูปใบเสร็จ"
            help={noReceipt ? undefined : 'ถ่ายหรือเลือกจากคลังได้ สูงสุด 6 รูป'}
            asDiv
            labelExtra={
              <button
                type="button"
                onClick={() => setNoReceipt((v) => !v)}
                className="text-xs text-blue-700 hover:underline"
              >
                {noReceipt ? 'มีใบเสร็จ' : 'ไม่มีใบเสร็จ?'}
              </button>
            }
          >
            {noReceipt ? (
              <Input
                value={noReceiptReason}
                onChange={(e) => setNoReceiptReason(e.target.value)}
                placeholder="เหตุผลที่ไม่มีใบเสร็จ เช่น ค่าวินมอเตอร์ไซค์"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200"
                  >
                    {f.name.length > 18 ? `${f.name.slice(0, 15)}…` : f.name}
                    <button
                      type="button"
                      aria-label="เอารูปนี้ออก"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {files.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <ImagePlus size={16} /> เพิ่มรูปใบเสร็จ
                  </button>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>
            )}
          </Field>

          <Field label="รับเงินคืนแบบไหน" asDiv>
            <RadioCardGroup
              name="payout"
              value={payout}
              onChange={(v) => setPayout(v as ExpensePayout)}
              options={[
                { value: 'payroll', label: 'รวมกับเงินเดือน', description: 'ได้พร้อมเงินเดือนงวดถัดไป' },
                { value: 'transfer', label: 'โอนแยก', description: 'บัญชีโอนให้หลังอนุมัติ' },
              ]}
            />
          </Field>

          {companies.length > 1 && (
            <Field label="บริษัทที่จ่ายคืน" help="ค่าใช้จ่ายของงานบริษัทไหน" asDiv>
              <SelectMenu value={companyId} options={companies} onChange={setCompanyId} />
            </Field>
          )}

          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Pill tone="neutral">ขั้นตอน</Pill> ผู้จัดการอนุมัติ → บัญชีตรวจใบเสร็จ → จ่ายคืน
          </p>
        </div>
      </Modal>
    </div>
  )
}
