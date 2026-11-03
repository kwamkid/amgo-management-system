'use client'

// ใบเบิกค่าใช้จ่ายของฉัน — จ่ายไปก่อนแล้วเบิกคืน (30 ก.ย. 69)
// + ให้บริษัทโอนจ่าย supplier ตรง แนบใบวางบิล/ใบแจ้งหนี้ (3 พ.ย. 69)
//
// กติกาเจ้าของ: ต้องแนบรูปใบเสร็จทุกใบ ไม่มีวงเงิน (ไม่มีใบเสร็จ เช่น ค่าวิน =
// เขียนเหตุผลแทน) · เลือกได้ทีละใบว่าจะรับคืนกับเงินเดือนหรือให้โอนแยก
// ขั้นอนุมัติ: ผู้จัดการ → บัญชี/HR · รูปใบเสร็จเลือกจากคลังได้ (ถ่ายเก็บไว้ก่อนได้)
// ฟอร์ม (เจ้าของ 3 พ.ย. 69): เลือกบริษัทก่อน (รู้ว่าเบิกจากบัญชีไหน) · การ์ดไอคอนแทน dropdown · กระชับ

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CheckCircle2, ClipboardCheck, Clock, Receipt, Store, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { createClient } from '@/lib/supabase/client'
import { THAI_BANKS, getBank } from '@/lib/constants/banks'
import {
  Button,
  ChoiceTiles,
  DatePicker,
  EmptyState,
  Field,
  FileDropzone,
  IconChip,
  Input,
  Modal,
  MoneyInput,
  SelectMenu,
} from '@/components/aoo'
import { ListRow, ListRows, PageHeader, SectionCard, Skeleton, StatCard, StatGrid } from '@/components/shared'
import ExpenseStatusPill from '@/components/expenses/ExpenseStatusPill'
import ReceiptThumbs from '@/components/expenses/ReceiptThumbs'
import ExpenseSectionField from '@/components/expenses/ExpenseSectionField'
import { KIND_VISUAL, SECTION_VISUAL, thb } from '@/components/expenses/expenseVisuals'
import {
  PAYOUT_LABEL,
  SECTION_CATEGORY,
  SECTION_SHORT,
  cancelClaim,
  createClaim,
  formSectionOf,
  listMyClaims,
  suggestSection,
  vatIncluded,
  type ExpenseClaim,
  type ExpenseKind,
  type FormSection,
} from '@/lib/services/expenseService'

const thaiDate = (iso: string) => format(new Date(`${iso}T00:00:00`), 'd MMM yy', { locale: th })
const todayIso = () => format(new Date(), 'yyyy-MM-dd')
const BANK_OPTIONS = THAI_BANKS.map((b) => ({ value: b.code, label: b.nameTh, hint: b.code }))
/** 038-4-69974-1 → •••9741 (บอกว่าตัดจากบัญชีไหน โดยไม่โชว์เลขเต็ม) */
const maskAcc = (acc: string) => `•••${acc.slice(-4)}`

type Company = { id: string; code: string; name_th: string; logo_url: string | null; scb_debit_account: string | null }

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
  // อนุมัติ/โอนจ่าย = ฝ่ายบัญชี (HR · แอดมิน · ตำแหน่งบัญชี) — ผู้จัดการไม่อนุมัติแล้ว
  const canManage = ['admin', 'hr'].includes(userData?.role ?? '') || userData?.jobFunctionCode === 'accountant'

  const [rows, setRows] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])

  // ฟอร์ม
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [kind, setKind] = useState<ExpenseKind>('reimburse')
  const [expenseDate, setExpenseDate] = useState(todayIso())
  // หมวดตามฟอร์มบัญชี · auto = ระบบเดาให้จากรายละเอียด (พนักงานยังไม่ได้เลือกเอง)
  const [section, setSection] = useState<FormSection | null>(null)
  const [sectionAuto, setSectionAuto] = useState<'history' | 'words' | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
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
      .select('id, code, name_th, logo_url, scb_debit_account')
      .eq('is_active', true)
      .order('code')
      .then(({ data }) => setCompanies((data ?? []) as Company[]))
  }, [reload])

  const openForm = (k: ExpenseKind) => {
    setKind(k)
    setCompanyId(userData?.companyId ?? (companies.length === 1 ? companies[0].id : null))
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
    if (!companyId) {
      showToast('เลือกบริษัทที่จะเบิก', 'error')
      return
    }
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
        // เลิกรวมกับเงินเดือน (เจ้าของ 3 พ.ย. 69) — โอนคืนอย่างเดียว
        payout: 'transfer',
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
      showToast(supplier ? 'ส่งขอจ่าย supplier แล้ว รอบัญชีอนุมัติ' : 'ยื่นใบเบิกแล้ว รอบัญชีอนุมัติ', 'success')
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
  const mine = rows.filter((r) => r.kind !== 'supplier')
  const sum = (list: ExpenseClaim[]) => list.reduce((s, r) => s + r.amount, 0)
  const waiting = sum(mine.filter((r) => ['pending_manager', 'pending_finance', 'approved'].includes(r.status)))
  const pendingCount = rows.filter((r) => r.status === 'pending_manager' || r.status === 'pending_finance').length
  const monthKey = format(new Date(), 'yyyy-MM')
  const paidThisMonth = sum(mine.filter((r) => r.status === 'paid' && (r.paidAt ?? '').startsWith(monthKey)))
  const payees = recentPayees(rows)
  const supplier = kind === 'supplier'
  const company = companies.find((c) => c.id === companyId)

  return (
    <div className="space-y-4">
      <PageHeader
        title="เบิกค่าใช้จ่าย"
        description="ออกเงินไปก่อนแล้วเบิกคืน หรือขอให้บริษัทโอนจ่าย supplier"
        icon={Receipt}
        actions={
          <>
            {canManage && (
              <Link href="/expenses/manage">
                <Button size="sm" variant="ghost" icon={ClipboardCheck}>
                  อนุมัติ / โอนจ่าย
                </Button>
              </Link>
            )}
            <Button size="sm" variant="secondary" icon={Store} onClick={() => openForm('supplier')}>
              ขอจ่าย supplier
            </Button>
            <Button size="sm" icon="Plus" onClick={() => openForm('reimburse')}>
              ยื่นใบเบิก
            </Button>
          </>
        }
      />

      <StatGrid cols={3} compact>
        <StatCard label="รอรับเงินคืน" value={thb(waiting)} icon={Wallet} tone="accent" />
        <StatCard label="รออนุมัติ" value={pendingCount} unit="ใบ" icon={Clock} tone="warning" />
        <StatCard label="ได้คืนเดือนนี้" value={thb(paidThisMonth)} icon={CheckCircle2} tone="success" />
      </StatGrid>

      <SectionCard title="ใบของคุณ">
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
            {rows.map((c) => {
              const sec = formSectionOf(c.category, c.vatAmount)
              return (
                <ListRow
                  key={c.id}
                  leading={<IconChip icon={SECTION_VISUAL[sec].icon} tone={SECTION_VISUAL[sec].tone} size={36} />}
                  title={
                    <span className="whitespace-normal text-base">
                      <span className="font-semibold">{thb(c.amount)}</span>
                      <span className="text-gray-500">
                        {' '}· {c.kind === 'supplier' ? `จ่าย ${c.payeeName} · ` : ''}
                        {c.description}
                      </span>
                    </span>
                  }
                  meta={
                    <>
                      <p className="text-sm">
                        {thaiDate(c.expenseDate)} · {SECTION_SHORT[sec]} ·{' '}
                        {c.kind === 'supplier' ? 'บริษัทโอนให้ร้าน' : c.payout === 'payroll' ? PAYOUT_LABEL.payroll : 'โอนคืนเข้าบัญชีคุณ'}
                                                {c.payout === 'payroll' && c.payrollMonth && (
                          <> งวด {format(new Date(`${c.payrollMonth}T00:00:00`), 'MMM yyyy', { locale: th })}</>
                        )}
                      </p>
                      {c.noReceiptReason && <p className="text-xs text-gray-500">ไม่มีใบเสร็จ: {c.noReceiptReason}</p>}
                      {c.rejectedReason && <p className="text-xs text-red-600">ไม่อนุมัติ: {c.rejectedReason}</p>}
                      <ReceiptThumbs paths={c.receiptPaths} slipPath={c.slipPath} size={40} />
                    </>
                  }
                  trailing={
                    <>
                      <ExpenseStatusPill status={c.status} payout={c.payout} exportedAt={c.exportedAt} />
                      {c.status === 'pending_finance' && (
                        <Button variant="ghost" size="sm" icon="X" onClick={() => cancel(c.id)}>
                          ยกเลิก
                        </Button>
                      )}
                    </>
                  }
                />
              )
            })}
          </ListRows>
        )}
      </SectionCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={supplier ? 'ขอให้บริษัทโอนจ่าย supplier' : 'ยื่นใบเบิกค่าใช้จ่าย'}
        maxWidth={640}
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
          {/* 1. บริษัท — เลือกก่อน จะได้รู้ว่าเบิกออกจากบัญชีไหน */}
          <Field
            label="เบิกจากบริษัท"
            help={company?.scb_debit_account ? `ตัดจากบัญชี SCB ${maskAcc(company.scb_debit_account)} ของ ${company.name_th}` : undefined}
            asDiv
          >
            <ChoiceTiles
              options={companies.map((c) => ({
                value: c.id,
                label: c.code,
                hint: c.name_th,
                image: c.logo_url,
                icon: c.logo_url ? undefined : KIND_VISUAL.supplier.icon,
                tone: 'neutral',
              }))}
              value={companyId}
              onChange={setCompanyId}
              columns={Math.min(Math.max(companies.length, 1), 3)}
              mobileColumns={companies.length > 2 ? 3 : 2}
              stacked={companies.length > 2}
              ariaLabel="บริษัท"
            />
          </Field>

          {/* 2. ใครจ่าย */}
          <ChoiceTiles
            options={[
              { value: 'reimburse', label: 'ฉันออกเงินไปก่อน', hint: 'แนบใบเสร็จ แล้วรับเงินคืน', ...KIND_VISUAL.reimburse },
              { value: 'supplier', label: 'ให้บริษัทจ่าย supplier', hint: 'แนบใบแจ้งหนี้ บัญชีโอนให้ร้าน', ...KIND_VISUAL.supplier },
            ]}
            value={kind}
            onChange={(v) => setKind(v as ExpenseKind)}
            columns={2}
            mobileColumns={2}
            ariaLabel="แบบใบเบิก"
          />

          {supplier && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              {payees.length > 0 && (
                <SelectMenu
                  value={null}
                  placeholder="เลือก supplier ที่เคยจ่าย (กรอกบัญชีให้เอง)"
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
              )}
              <Field label="ชื่อบัญชีผู้รับเงิน">
                <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="ตามชื่อบัญชีธนาคาร เช่น บจก. ปริ้นท์ดี" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ธนาคาร" asDiv>
                  <SelectMenu value={payeeBank} options={BANK_OPTIONS} onChange={setPayeeBank} placeholder="เลือก" />
                </Field>
                <Field label="เลขบัญชี">
                  <Input value={payeeAccountNo} onChange={(e) => setPayeeAccountNo(e.target.value)} inputMode="numeric" placeholder="xxx-x-xxxxx-x" />
                </Field>
              </div>
            </div>
          )}

          {/* 3. รายละเอียด */}
          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
            <Field label={supplier ? 'วันที่ใบแจ้งหนี้' : 'จ่ายเงินวันที่'} asDiv>
              <DatePicker value={expenseDate} onChange={setExpenseDate} />
            </Field>
            <Field label={supplier ? 'ยอดที่ต้องโอน' : 'ยอดเงิน'}>
              <MoneyInput value={amount || ''} onValueChange={(n) => setAmount(n)} placeholder="0.00" suffix="฿" />
            </Field>
          </div>

          <Field label={section === 'entertain' && !supplier ? 'ร้าน/สถานที่' : 'จ่ายค่าอะไร'}>
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
                  ? 'ระบบเดาให้ — ไม่ตรงก็เปลี่ยนได้ บัญชีตรวจอีกรอบ'
                  : undefined
            }
          />
          {section === 'other_vat' && amount > 0 && (
            <p className="-mt-2 text-xs text-gray-500">VAT 7% ในยอดนี้ {thb(vatIncluded(amount))} — แนบใบกำกับภาษีด้วย</p>
          )}

          {!supplier && (section === 'taxi' || section === 'gas') && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="จาก">
                <Input value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)} placeholder="ออฟฟิศ" />
              </Field>
              <Field label="ถึง">
                <Input value={routeTo} onChange={(e) => setRouteTo(e.target.value)} placeholder="ไบเทค" />
              </Field>
              <Field label="กม.">
                <Input value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} inputMode="decimal" placeholder="-" />
              </Field>
            </div>
          )}

          {!supplier && section === 'entertain' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="วัตถุประสงค์">
                <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="ประชุมลูกค้า" />
              </Field>
              <Field label="รับรองใคร / กี่คน">
                <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="ทีมบูธ 10 คน" />
              </Field>
            </div>
          )}

          {/* 4. หลักฐาน */}
          <Field
            label={supplier ? 'ใบวางบิล / ใบแจ้งหนี้' : 'ใบเสร็จ / สลิปที่โอนไปก่อน'}
            help={supplier ? 'ต้องแนบ · เลือกได้หลายไฟล์ (รูปหรือ PDF สูงสุด 10)' : noReceipt ? undefined : 'เลือกได้หลายไฟล์ (รูปหรือ PDF สูงสุด 10)'}
            asDiv
            labelExtra={
              supplier ? undefined : (
                <button type="button" onClick={() => setNoReceipt((v) => !v)} className="text-xs text-red-600 hover:underline">
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
                maxItems={10}
                allowPdf
                size="sm"
                label={supplier ? 'ลากใบแจ้งหนี้มาวาง หรือกดเพื่อเลือก' : 'ลากรูปใบเสร็จ/PDF มาวาง หรือกดเพื่อเลือก'}
              />
            )}
          </Field>

          <p className="text-xs text-gray-500">
            ขั้นตอน: บัญชีตรวจเอกสารและอนุมัติ → {supplier ? 'โอนให้ร้าน' : 'โอนคืนเข้าบัญชีของคุณ'}
          </p>
        </div>
      </Modal>
    </div>
  )
}
