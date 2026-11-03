'use client'

// ใบเบิกค่าใช้จ่ายของฉัน — จ่ายไปก่อนแล้วเบิกคืน (30 ก.ย. 69)
// + ให้บริษัทโอนจ่าย supplier ตรง แนบใบวางบิล/ใบแจ้งหนี้ (3 พ.ย. 69)
//
// กติกาเจ้าของ: ต้องแนบรูปใบเสร็จทุกใบ ไม่มีวงเงิน (ไม่มีใบเสร็จ เช่น ค่าวิน =
// เขียนเหตุผลแทน) · เลือกได้ทีละใบว่าจะรับคืนกับเงินเดือนหรือให้โอนแยก
// ขั้นอนุมัติ: ผู้จัดการ → บัญชี/HR · รูปใบเสร็จเลือกจากคลังได้ (ถ่ายเก็บไว้ก่อนได้)

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Receipt } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import { THAI_BANKS, getBank } from '@/lib/constants/banks'
import {
  Button,
  DatePicker,
  EmptyState,
  Field,
  FileDropzone,
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
import ExpenseSectionField from '@/components/expenses/ExpenseSectionField'
import {
  PAYOUT_LABEL,
  SECTION_CATEGORY,
  SECTION_SHORT,
  cancelClaim,
  createClaim,
  listMyClaims,
  formSectionOf,
  suggestSection,
  vatIncluded,
  type ExpenseClaim,
  type FormSection,
  type ExpenseKind,
  type ExpensePayout,
} from '@/lib/services/expenseService'

const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const thaiDate = (iso: string) => format(new Date(`${iso}T00:00:00`), 'd MMM yyyy', { locale: th })
const todayIso = () => format(new Date(), 'yyyy-MM-dd')

const BANK_OPTIONS = THAI_BANKS.map((b) => ({ value: b.code, label: b.nameTh, hint: b.code }))

/** supplier ที่เคยขอจ่าย — เลือกซ้ำได้ไม่ต้องพิมพ์เลขบัญชีใหม่ */
function recentPayees(rows: ExpenseClaim[]) {
  const seen = new Map<string, { name: string; bank: string; account: string }>()
  for (const r of rows) {
    if (r.kind !== 'supplier' || !r.payeeName || !r.payeeBank || !r.payeeAccountNo) continue
    const key = `${r.payeeBank}|${r.payeeAccountNo}`
    if (!seen.has(key)) seen.set(key, { name: r.payeeName, bank: r.payeeBank, account: r.payeeAccountNo })
  }
  return [...seen.entries()].map(([key, p]) => ({ key, ...p }))
}

export default function MyExpensesPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [rows, setRows] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])

  // ฟอร์ม
  const [kind, setKind] = useState<ExpenseKind>('reimburse')
  const [expenseDate, setExpenseDate] = useState(todayIso())
  // หมวดตามฟอร์มบัญชี · auto = ระบบเดาให้จากรายละเอียด (พนักงานยังไม่ได้เลือกเอง)
  const [section, setSection] = useState<FormSection | null>(null)
  const [sectionAuto, setSectionAuto] = useState<'history' | 'words' | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [payout, setPayout] = useState<ExpensePayout>('payroll')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [noReceipt, setNoReceipt] = useState(false)
  const [noReceiptReason, setNoReceiptReason] = useState('')
  const [routeFrom, setRouteFrom] = useState('')
  const [routeTo, setRouteTo] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [purpose, setPurpose] = useState('')
  const [attendees, setAttendees] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [payeeBank, setPayeeBank] = useState<string | null>(null)
  const [payeeAccountNo, setPayeeAccountNo] = useState('')

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

  const openForm = (k: ExpenseKind) => {
    setKind(k)
    setRouteFrom('')
    setRouteTo('')
    setDistanceKm('')
    setPurpose('')
    setAttendees('')
    setPayeeName('')
    setPayeeBank(null)
    setPayeeAccountNo('')
    setExpenseDate(todayIso())
    setSection(null)
    setSectionAuto(null)
    setDescription('')
    setAmount(0)
    setPayout('payroll')
    setCompanyId(userData?.companyId ?? null)
    setFiles([])
    setNoReceipt(false)
    setNoReceiptReason('')
    setOpen(true)
  }


  // พิมพ์รายละเอียด → ระบบเดาหมวดให้ จนกว่าพนักงานจะเลือกเอง (ใบเก่าของตัวเองที่บัญชีตรวจแล้วชนะกติกาคำ)
  const onDescription = (text: string) => {
    setDescription(text)
    if (section && !sectionAuto) return
    const history = rows
      .filter((r) => r.status === 'approved' || r.status === 'paid')
      .map((r) => ({ description: r.description, section: formSectionOf(r.category, r.vatAmount) }))
    const s = suggestSection(text, history)
    setSection(s?.section ?? null)
    setSectionAuto(s?.from ?? null)
  }

  const submit = async () => {
    if (!userData?.id) return
    if (!section) {
      showToast('เลือกหมวดค่าใช้จ่าย', 'error')
      return
    }
    const supplier = kind === 'supplier'
    const km = distanceKm.trim() ? Number(distanceKm) : null
    try {
      setSaving(true)
      await createClaim({
        userId: userData.id,
        userName: userData.displayName || userData.fullName || '',
        companyId,
        expenseDate,
        category: SECTION_CATEGORY[section],
        description,
        amount,
        payout,
        receipts: noReceipt && !supplier ? [] : files,
        noReceiptReason: noReceipt && !supplier ? noReceiptReason : '',
        today: todayIso(),
        kind,
        vatAmount: section === 'other_vat' ? vatIncluded(amount) : 0,
        payeeName,
        payeeBank: payeeBank ?? '',
        payeeAccountNo,
        routeFrom,
        routeTo,
        distanceKm: km != null && Number.isFinite(km) ? km : null,
        purpose,
        attendees,
      })
      showToast(supplier ? 'ส่งขอจ่าย supplier แล้ว รอผู้จัดการอนุมัติ' : 'ยื่นใบเบิกแล้ว รอผู้จัดการอนุมัติ', 'success')
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

  // supplier ไม่ใช่เงินที่พนักงานรอรับคืน
  const waiting = rows
    .filter((r) => r.kind !== 'supplier' && ['pending_manager', 'pending_finance', 'approved'].includes(r.status))
    .reduce((s, r) => s + r.amount, 0)
  const payees = recentPayees(rows)
  const supplier = kind === 'supplier'

  return (
    <div className="space-y-4">
      <PageHeader
        title="เบิกค่าใช้จ่าย"
        description="ออกเงินไปก่อนแล้วเบิกคืน หรือขอให้บริษัทโอนจ่าย supplier"
        icon={Receipt}
        actions={
          <>
            <Button size="sm" variant="secondary" icon="Building2" onClick={() => openForm('supplier')}>
              ขอจ่าย supplier
            </Button>
            <Button size="sm" icon="Plus" onClick={() => openForm('reimburse')}>
              ยื่นใบเบิก
            </Button>
          </>
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
                    <span className="text-gray-500">
                      {' '}· {c.kind === 'supplier' ? `จ่าย ${c.payeeName} · ` : ''}
                      {c.description}
                    </span>
                  </span>
                }
                meta={
                  <>
                    <p className="text-xs">
                      {thaiDate(c.expenseDate)} · {SECTION_SHORT[formSectionOf(c.category, c.vatAmount)]} ·{' '}
                      {c.kind === 'supplier' ? 'บริษัทโอนให้ supplier' : PAYOUT_LABEL[c.payout]}
                      {c.vatAmount > 0 && ` · VAT ${baht.format(c.vatAmount)}`}
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
                    <ReceiptThumbs paths={c.slipPath ? [...c.receiptPaths, c.slipPath] : c.receiptPaths} />
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
        title={supplier ? 'ขอให้บริษัทโอนจ่าย supplier' : 'ยื่นใบเบิกค่าใช้จ่าย'}
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={submit} loading={saving}>
              {saving ? 'กำลังส่ง...' : supplier ? 'ส่งขอจ่าย' : 'ยื่นใบเบิก'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <RadioCardGroup
            name="kind"
            value={kind}
            onChange={(v) => setKind(v as ExpenseKind)}
            options={[
              { value: 'reimburse', label: 'ฉันออกเงินไปก่อน', description: 'แนบใบเสร็จ/สลิปที่ฉันโอน แล้วรับเงินคืน' },
              { value: 'supplier', label: 'ให้บริษัทจ่าย supplier', description: 'แนบใบวางบิล/ใบแจ้งหนี้ บัญชีโอนให้ร้าน' },
            ]}
          />

          {supplier && (
            <>
              {payees.length > 0 && (
                <Field label="เคยจ่ายร้านนี้แล้ว?" help="เลือกแล้วกรอกบัญชีให้เอง" asDiv>
                  <SelectMenu
                    value={null}
                    placeholder="เลือก supplier ที่เคยจ่าย"
                    options={payees.map((p) => ({
                      value: p.key,
                      label: p.name,
                      hint: `${getBank(p.bank)?.code ?? p.bank} ${p.account}`,
                    }))}
                    onChange={(v) => {
                      const p = payees.find((x) => x.key === v)
                      if (!p) return
                      setPayeeName(p.name)
                      setPayeeBank(p.bank)
                      setPayeeAccountNo(p.account)
                    }}
                  />
                </Field>
              )}
              <Field label="ชื่อบัญชีผู้รับเงิน" help="ตามชื่อบัญชีธนาคารของ supplier">
                <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="เช่น บจก. ปริ้นท์ดี" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="ธนาคาร" asDiv>
                  <SelectMenu value={payeeBank} options={BANK_OPTIONS} onChange={setPayeeBank} placeholder="เลือกธนาคาร" />
                </Field>
                <Field label="เลขบัญชี">
                  <Input
                    value={payeeAccountNo}
                    onChange={(e) => setPayeeAccountNo(e.target.value)}
                    inputMode="numeric"
                    placeholder="xxx-x-xxxxx-x"
                  />
                </Field>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={supplier ? 'วันที่ใบแจ้งหนี้' : 'จ่ายเงินวันที่'} asDiv>
              <DatePicker value={expenseDate} onChange={setExpenseDate} />
            </Field>
            <Field label={supplier ? 'ยอดที่ต้องโอน (บาท)' : 'ยอดเงิน (บาท)'}>
              <MoneyInput value={amount || ''} onValueChange={(n) => setAmount(n)} placeholder="0.00" />
            </Field>
          </div>

          <Field label={supplier ? 'จ่ายค่าอะไร' : section === 'entertain' ? 'ร้าน/สถานที่' : 'จ่ายค่าอะไร'}>
            <Input
              value={description}
              onChange={(e) => onDescription(e.target.value)}
              placeholder={supplier ? 'เช่น ค่าผลิตโปสเตอร์งานแฟร์ BBB' : 'เช่น แท็กซี่ไปออกบูธ รพ.วิมุต'}
            />
          </Field>

          <ExpenseSectionField
            value={section}
            onChange={(v) => {
              setSection(v)
              setSectionAuto(null)
            }}
            hint={
              sectionAuto === 'history'
                ? 'ระบบเลือกให้ตามใบเก่าที่คล้ายกัน — เปลี่ยนได้'
                : sectionAuto === 'words'
                  ? 'ระบบเดาให้จากรายละเอียด — ไม่ตรงก็เปลี่ยนได้ บัญชีตรวจอีกรอบ'
                  : undefined
            }
          />
          {section === 'other_vat' && amount > 0 && (
            <p className="-mt-2 text-xs text-gray-500">VAT 7% ในยอดนี้ {baht.format(vatIncluded(amount))} บาท — แนบใบกำกับภาษีด้วย</p>
          )}

          {!supplier && (section === 'taxi' || section === 'gas') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="จาก">
                <Input value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)} placeholder="เช่น ออฟฟิศ" />
              </Field>
              <Field label="ถึง">
                <Input value={routeTo} onChange={(e) => setRouteTo(e.target.value)} placeholder="เช่น ไบเทค บางนา" />
              </Field>
              <Field label="ระยะทาง (กม.)">
                <Input value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} inputMode="decimal" placeholder="ไม่บังคับ" />
              </Field>
            </div>
          )}

          {!supplier && section === 'entertain' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="วัตถุประสงค์">
                <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="เช่น ประชุมลูกค้า แฟร์ Amarin" />
              </Field>
              <Field label="รับรองใคร / กี่คน">
                <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="เช่น ทีมบูธ 10 คน" />
              </Field>
            </div>
          )}

          <Field
            label={supplier ? 'ใบวางบิล / ใบแจ้งหนี้' : 'ใบเสร็จ / สลิปที่โอนไปก่อน'}
            help={supplier ? 'ต้องแนบ · รูปหรือ PDF สูงสุด 6 ไฟล์' : noReceipt ? undefined : 'ถ่ายหรือเลือกจากคลังได้ สูงสุด 6 ไฟล์'}
            asDiv
            labelExtra={
              supplier ? undefined : (
                <button
                  type="button"
                  onClick={() => setNoReceipt((v) => !v)}
                  className="text-xs text-blue-700 hover:underline"
                >
                  {noReceipt ? 'มีใบเสร็จ' : 'ไม่มีใบเสร็จ?'}
                </button>
              )
            }
          >
            {noReceipt && !supplier ? (
              <Input
                value={noReceiptReason}
                onChange={(e) => setNoReceiptReason(e.target.value)}
                placeholder="เหตุผลที่ไม่มีใบเสร็จ เช่น ค่าวินมอเตอร์ไซค์"
              />
            ) : (
              <FileDropzone
                files={files}
                onChange={setFiles}
                maxItems={6}
                allowPdf
                size="sm"
                label={supplier ? 'ลากใบวางบิล/ใบแจ้งหนี้มาวาง หรือกดเพื่อเลือก' : 'ลากรูปใบเสร็จ/PDF มาวาง หรือกดเพื่อเลือก'}
              />
            )}
          </Field>

          {!supplier && (
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
          )}

          {companies.length > 1 && (
            <Field label={supplier ? 'บริษัทที่จ่าย' : 'บริษัทที่จ่ายคืน'} help="ค่าใช้จ่ายของงานบริษัทไหน" asDiv>
              <SelectMenu value={companyId} options={companies} onChange={setCompanyId} />
            </Field>
          )}

          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Pill tone="neutral">ขั้นตอน</Pill> ผู้จัดการอนุมัติ → บัญชีตรวจเอกสาร →{' '}
            {supplier ? 'บัญชีโอนให้ supplier' : 'จ่ายคืน'}
          </p>
        </div>
      </Modal>
    </div>
  )
}
