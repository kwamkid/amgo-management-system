'use client'

// จัดการใบเบิกค่าใช้จ่าย — ผู้จัดการ/แอดมินอนุมัติขั้นแรก · บัญชี/HR ขั้นสอง + จ่าย
//
// ไม่มีความสัมพันธ์หัวหน้า-ลูกน้องในระบบ ผู้จัดการคนไหนก็อนุมัติขั้นแรกได้ (แบบใบลา)
// ลำดับขั้นและ "อนุมัติใบตัวเองไม่ได้" ตรวจซ้ำในฟังก์ชัน SQL — หน้านี้แค่ซ่อนปุ่ม
//
// 3 พ.ย. 69: แท็บรอโอนรวมใบจ่าย supplier · เลือกหลายใบ → ส่งออกไฟล์โอน SCB (ตีตราส่งออกแล้ว
// กันโอนซ้ำ) → บันทึกจ่ายทั้งชุดพร้อมสลิปใบเดียว · ปุ่มสรุปสิ้นเดือนตามฟอร์มบัญชี

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Receipt } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getBank } from '@/lib/constants/banks'
import { SCB_PRODUCT_LABEL, isScbAccount, type ScbProduct } from '@/lib/services/bankTransferFile'
import { createClient } from '@/lib/supabase/client'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  EmptyState,
  Field,
  FileDropzone,
  Input,
  Modal,
  Pill,
  RadioCardGroup,
  SelectMenu,
  TabBar,
  TabItem,
} from '@/components/aoo'
import { ListRow, ListRows, PageHeader, SectionCard, Skeleton } from '@/components/shared'
import ExpenseStatusPill from '@/components/expenses/ExpenseStatusPill'
import ReceiptThumbs from '@/components/expenses/ReceiptThumbs'
import ClaimEditModal from '@/components/expenses/ClaimEditModal'
import {
  SECTION_SHORT,
  formSectionOf,
  PAYOUT_LABEL,
  clearExported,
  financeDecide,
  listClaims,
  listClaimsForMonth,
  managerDecide,
  markExported,
  markTransferred,
  type ExpenseClaim,
  type ExpensePayout,
  type ExpenseStatus,
} from '@/lib/services/expenseService'

const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const thaiDate = (iso: string) => format(new Date(`${iso}T00:00:00`), 'd MMM yyyy', { locale: th })
const monthLabel = (iso: string) => format(new Date(`${iso}T00:00:00`), 'MMM yyyy', { locale: th })

/** 12 เดือนล่าสุด (เดือนนี้ก่อน) — ตัวเลือกสรุปสิ้นเดือน */
const recentMonths = () =>
  Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const value = format(d, 'yyyy-MM')
    return { value, label: format(d, 'MMMM yyyy', { locale: th }) }
  })

type Company = { id: string; code: string; name_th: string; name_en: string | null; scb_debit_account: string | null }

type Tab = 'manager' | 'finance' | 'transfer' | 'payroll' | 'done'

const TAB_STATUSES: Record<Tab, ExpenseStatus[]> = {
  manager: ['pending_manager'],
  finance: ['pending_finance'],
  transfer: ['approved'],
  payroll: ['approved'],
  done: ['paid', 'rejected'],
}

export default function ExpenseManagePage() {
  const { userData } = useAuth()
  const { showToast } = useToast()

  const role = userData?.role ?? ''
  const isManagerStep = role === 'manager' || role === 'admin'
  const isFinance = role === 'hr' || role === 'admin' || userData?.jobFunctionCode === 'accountant'
  const canView = isManagerStep || isFinance

  const [tab, setTab] = useState<Tab>(isFinance && !isManagerStep ? 'finance' : 'manager')
  const [rows, setRows] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // ไม่อนุมัติ / โอนแล้ว ต้องกรอกเพิ่ม — ใช้ modal เดียวสลับโหมด · โอนแล้วรับได้หลายใบ (ทั้งชุดไฟล์ SCB)
  const [dialog, setDialog] = useState<{ mode: 'reject' | 'paid'; claims: ExpenseClaim[] } | null>(null)
  // แท็บรอโอน: ใบที่ติ๊กเลือก
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // สรุปสิ้นเดือน
  const [companies, setCompanies] = useState<Company[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [reportMonth, setReportMonth] = useState<string | null>(null)
  const [reportCompany, setReportCompany] = useState<string | null>(null)
  // ส่งออกไฟล์ SCB: 1 ไฟล์ = 1 บริษัท (บัญชีตัดเงินของบริษัทนั้น)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportCompany, setExportCompany] = useState<string | null>(null)
  const [debitAccount, setDebitAccount] = useState('')
  const [valueDate, setValueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [product, setProduct] = useState<ScbProduct>('OAT')
  const [text, setText] = useState('')
  const [slip, setSlip] = useState<File | null>(null)
  // บัญชีเลือกวิธีจ่ายใหม่ได้ตอนอนุมัติ
  const [payoutOf, setPayoutOf] = useState<Record<string, ExpensePayout>>({})
  // บัญชีแก้หมวด/รายละเอียดก่อนอนุมัติ/ก่อนโอน
  const [editing, setEditing] = useState<ExpenseClaim | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      let list = await listClaims(TAB_STATUSES[tab], tab === 'done' ? 100 : 300)
      if (tab === 'transfer') list = list.filter((c) => c.payout === 'transfer')
      if (tab === 'payroll') list = list.filter((c) => c.payout === 'payroll')
      setRows(list)
      setPicked(new Set())
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (canView) load()
  }, [canView, load])

  useEffect(() => {
    if (!isFinance) return
    createClient()
      .from('companies')
      .select('id, code, name_th, name_en, scb_debit_account')
      .order('code')
      .then(({ data }) => setCompanies((data ?? []) as Company[]))
  }, [isFinance])

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows])

  const run = async (id: string, fn: () => Promise<void>, done: string) => {
    try {
      setBusy(id)
      await fn()
      showToast(done, 'success')
      setDialog(null)
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const confirmDialog = () => {
    if (!dialog) return
    const c = dialog.claims[0]
    if (dialog.mode === 'reject') {
      if (!text.trim()) {
        showToast('ใส่เหตุผลที่ไม่อนุมัติ', 'error')
        return
      }
      run(
        c.id,
        () => (c.status === 'pending_manager' ? managerDecide(c.id, false, text) : financeDecide(c, false, { reason: text })),
        'ไม่อนุมัติใบเบิกแล้ว'
      )
    } else {
      run(
        c.id,
        () => markTransferred(dialog.claims, userData!.id!, text, slip),
        `บันทึกว่าโอนแล้ว ${dialog.claims.length} ใบ`
      )
    }
  }

  // ── แท็บรอโอน: ส่งออกไฟล์ SCB / บันทึกจ่ายทั้งชุด ──
  const pickedRows = rows.filter((r) => picked.has(r.id))
  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // ไม่ได้เลือก = ทุกใบที่ยังไม่เคยส่งออก
  const exportPool = pickedRows.length ? pickedRows : rows.filter((r) => !r.exportedAt)
  const poolOf = (companyId: string | null) => exportPool.filter((c) => c.companyId === companyId)

  const pickCompany = (id: string | null) => {
    setExportCompany(id)
    setDebitAccount(companies.find((c) => c.id === id)?.scb_debit_account ?? '')
  }

  const openExport = () => {
    if (!exportPool.length) {
      showToast('ไม่มีใบที่ยังไม่ส่งออก — ติ๊กเลือกใบที่จะส่งออกซ้ำ', 'error')
      return
    }
    // เริ่มที่บริษัทที่มีใบมากสุด
    const counts = new Map<string | null, number>()
    for (const c of exportPool) counts.set(c.companyId, (counts.get(c.companyId) ?? 0) + 1)
    pickCompany([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0])
    setValueDate(format(new Date(), 'yyyy-MM-dd'))
    setExportOpen(true)
  }

  const exportTransfer = async () => {
    const target = poolOf(exportCompany)
    const account = debitAccount.replace(/\D/g, '')
    if (!target.length) {
      showToast('บริษัทนี้ไม่มีใบรอโอน', 'error')
      return
    }
    if (!isScbAccount(account)) {
      showToast('บัญชีตัดเงินต้องเป็นเลขบัญชี SCB 10 หลักที่ถูกต้อง', 'error')
      return
    }
    try {
      setBusy('export')
      // จำบัญชีตัดเงินไว้กับบริษัท — ครั้งหน้าไม่ต้องกรอก
      const company = companies.find((c) => c.id === exportCompany)
      if (company && company.scb_debit_account !== account) {
        const { error } = await createClient().rpc('set_company_scb_debit_account', {
          p_company_id: company.id,
          p_account: account,
        })
        if (error) throw new Error(`บันทึกบัญชีตัดเงินไม่สำเร็จ: ${error.message}`)
        setCompanies((list) => list.map((c) => (c.id === company.id ? { ...c, scb_debit_account: account } : c)))
      }
      const { downloadTransferFile } = await import('@/lib/services/expenseExport')
      const res = await downloadTransferFile(target, { product, debitAccount: account, valueDate })
      if (res.includedIds.length) await markExported(res.includedIds, userData!.id!)
      if (res.problems.length) {
        const name = (id: string) => {
          const c = rows.find((r) => r.id === id)
          return c?.kind === 'supplier' ? c.payeeName : c?.userName
        }
        showToast(
          `ไม่ได้ใส่ไฟล์ ${res.problems.length} ใบ: ${res.problems.map((p) => `${name(p.claimId)} (${p.reason})`).join(', ')}`,
          'error'
        )
      }
      setExportOpen(false)
      if (res.includedIds.length) {
        showToast(`ส่งออก ${res.includedIds.length} ใบ รวม ${baht.format(res.total)} บาท — อัปโหลดเข้า SCB ได้เลย`, 'success')
        // ไม่ต้องรอสิ้นเดือน: อัปโหลดเข้าธนาคารเสร็จ กดบันทึกจ่ายชุดนี้ได้ทันที (ปิดไว้ก่อนแล้วค่อยมาติ๊กบันทึกทีหลังก็ได้)
        const included = new Set(res.includedIds)
        setText('')
        setSlip(null)
        setDialog({ mode: 'paid', claims: target.filter((c) => included.has(c.id)) })
      }
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const resetExported = () =>
    run('export', () => clearExported(pickedRows.map((r) => r.id)), 'ล้างตราส่งออกแล้ว ส่งออกใหม่ได้')

  const downloadReport = async () => {
    if (!reportMonth) {
      showToast('เลือกเดือน', 'error')
      return
    }
    const company = companies.find((c) => c.id === reportCompany)
    try {
      setBusy('report')
      const claims = await listClaimsForMonth(reportMonth, reportCompany)
      if (!claims.length) {
        showToast('เดือนนี้ไม่มีใบที่อนุมัติแล้ว', 'error')
        return
      }
      const { downloadMonthlyReport } = await import('@/lib/services/expenseExport')
      await downloadMonthlyReport({
        month: reportMonth,
        companyName: company ? company.name_en || company.name_th : 'ทุกบริษัท',
        companyCode: company?.code ?? 'ALL',
        claims,
      })
      setReportOpen(false)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!canView) {
    return (
      <Alert tone="error">
        <p className="font-semibold">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <div>เฉพาะผู้จัดการ ฝ่ายบัญชี HR และผู้ดูแลระบบ</div>
      </Alert>
    )
  }

  const mine = (c: ExpenseClaim) => c.userId === userData?.id

  return (
    <div className="space-y-4">
      <PageHeader
        title="จัดการใบเบิก"
        description="ผู้จัดการอนุมัติ → บัญชีตรวจเอกสารและเลือกวิธีจ่าย → โอน (ไฟล์ SCB) / รวมเงินเดือน"
        icon={Receipt}
        actions={
          isFinance ? (
            <Button
              size="sm"
              variant="secondary"
              icon="FileSpreadsheet"
              onClick={() => {
                setReportMonth(recentMonths()[1].value)
                setReportCompany(null)
                setReportOpen(true)
              }}
            >
              สรุปสิ้นเดือน
            </Button>
          ) : undefined
        }
      />

      <TabBar ariaLabel="สถานะใบเบิก" className="flex-wrap">
        <TabItem active={tab === 'manager'} onClick={() => setTab('manager')} label="รอผู้จัดการ" />
        <TabItem active={tab === 'finance'} onClick={() => setTab('finance')} label="รอบัญชี" />
        <TabItem active={tab === 'transfer'} onClick={() => setTab('transfer')} label="รอโอน" />
        <TabItem active={tab === 'payroll'} onClick={() => setTab('payroll')} label="รวมเงินเดือน" />
        <TabItem active={tab === 'done'} onClick={() => setTab('done')} label="เสร็จแล้ว" />
      </TabBar>

      <SectionCard
        title={rows.length ? `${rows.length} ใบ · รวม ${baht.format(total)} บาท` : undefined}
      >
        {tab === 'transfer' && isFinance && rows.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5">
              {pickedRows.some((r) => r.exportedAt) && (
                <Button size="sm" variant="ghost" onClick={resetExported} disabled={!!busy}>
                  ล้างตราส่งออก
                </Button>
              )}
              <Button size="sm" variant="secondary" icon="Download" loading={busy === 'export'} onClick={openExport}>
                {pickedRows.length ? `ส่งออกไฟล์ SCB (${pickedRows.length})` : 'ส่งออกไฟล์ SCB (ที่ยังไม่ส่งออก)'}
              </Button>
              <Button
                size="sm"
                disabled={!pickedRows.length}
                onClick={() => {
                  setText('')
                  setSlip(null)
                  setDialog({ mode: 'paid', claims: pickedRows })
                }}
              >
                บันทึกจ่ายแล้ว{pickedRows.length ? ` (${pickedRows.length})` : ''}
              </Button>
            </div>
          ) : null}
        {loading ? (
          <Skeleton rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Receipt size={28} />} title="ไม่มีใบในช่องนี้" />
        ) : (
          <ListRows variant="divided">
            {rows.map((c) => {
              const payout = payoutOf[c.id] ?? c.payout
              return (
                <ListRow
                  key={c.id}
                  leading={
                    tab === 'transfer' && isFinance ? (
                      <Checkbox checked={picked.has(c.id)} onChange={() => togglePick(c.id)} aria-label="เลือกใบนี้" />
                    ) : undefined
                  }
                  title={
                    <span className="whitespace-normal text-sm">
                      <span className="font-semibold">
                        {c.kind === 'supplier' ? `จ่าย ${c.payeeName}` : c.userName}
                      </span>
                      <span className="text-gray-500"> · {baht.format(c.amount)} บาท</span>
                      {c.kind === 'supplier' && <span className="text-gray-500"> · ขอโดย {c.userName}</span>}
                    </span>
                  }
                  meta={
                    <>
                      <p className="text-xs">
                        {thaiDate(c.expenseDate)} ·{' '}
                        <span className="font-medium text-gray-700">{SECTION_SHORT[formSectionOf(c.category, c.vatAmount)]}</span> ·{' '}
                        {c.description}
                        {c.routeFrom || c.routeTo ? ` (${c.routeFrom ?? ''} → ${c.routeTo ?? ''}${c.distanceKm != null ? ` ${c.distanceKm} กม.` : ''})` : ''}
                        {c.purpose || c.attendees ? ` · ${[c.purpose, c.attendees].filter(Boolean).join(' · ')}` : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.kind === 'supplier' ? 'โอนให้ supplier' : PAYOUT_LABEL[c.payout]}
                        {c.vatAmount > 0 && ` · VAT ${baht.format(c.vatAmount)}`}
                        {c.payout === 'payroll' && c.payrollMonth && ` งวด ${monthLabel(c.payrollMonth)}`}
                        {c.paidNote && ` · ${c.paidNote}`}
                      </p>
                      {c.noReceiptReason && (
                        <p className="text-xs text-amber-700">ไม่มีใบเสร็จ: {c.noReceiptReason}</p>
                      )}
                      {c.rejectedReason && <p className="text-xs text-red-600">ไม่อนุมัติ: {c.rejectedReason}</p>}
                      {(tab === 'transfer' || c.kind === 'supplier') && (
                        <p className="text-xs font-medium text-gray-700">
                          โอนเข้า:{' '}
                          {c.kind === 'supplier'
                            ? `${getBank(c.payeeBank)?.nameTh ?? c.payeeBank ?? ''} ${c.payeeAccountNo ?? ''} (${c.payeeName})`
                            : `${getBank(c.bankName)?.nameTh ?? c.bankName ?? 'ยังไม่มีข้อมูลธนาคาร'} ${c.bankAccountNo ?? ''}`}
                        </p>
                      )}
                      <ReceiptThumbs paths={c.slipPath ? [...c.receiptPaths, c.slipPath] : c.receiptPaths} />
                      {tab === 'finance' && isFinance && !mine(c) && c.kind !== 'supplier' && (
                        <div className="mt-2 max-w-md">
                          <RadioCardGroup
                            name={`payout-${c.id}`}
                            value={payout}
                            onChange={(v) => setPayoutOf((p) => ({ ...p, [c.id]: v as ExpensePayout }))}
                            options={[
                              { value: 'payroll', label: 'รวมกับเงินเดือน' },
                              { value: 'transfer', label: 'โอนแยก' },
                            ]}
                          />
                        </div>
                      )}
                    </>
                  }
                  trailing={
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <ExpenseStatusPill status={c.status} />
                      {c.status === 'approved' && c.exportedAt && (
                        <Pill tone="neutral">ส่งออกไฟล์แล้ว {format(new Date(c.exportedAt), 'd MMM HH:mm', { locale: th })}</Pill>
                      )}
                      {isFinance && (c.status === 'pending_finance' || c.status === 'approved') && (
                        <Button size="sm" variant="ghost" icon="Pencil" onClick={() => setEditing(c)}>
                          แก้ไข
                        </Button>
                      )}
                      {mine(c) && (tab === 'manager' || tab === 'finance') ? (
                        <span className="text-xs text-gray-400">ใบของคุณ — ให้คนอื่นอนุมัติ</span>
                      ) : tab === 'manager' && isManagerStep ? (
                        <>
                          <Button
                            size="sm"
                            loading={busy === c.id}
                            onClick={() => run(c.id, () => managerDecide(c.id, true), 'อนุมัติแล้ว ส่งต่อบัญชี')}
                          >
                            อนุมัติ
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setText(''); setDialog({ mode: 'reject', claims: [c] }) }}>
                            ไม่อนุมัติ
                          </Button>
                        </>
                      ) : tab === 'finance' && isFinance ? (
                        <>
                          <Button
                            size="sm"
                            loading={busy === c.id}
                            onClick={() =>
                              run(
                                c.id,
                                () => financeDecide(c, true, { payout: c.kind === 'supplier' ? 'transfer' : payout }),
                                c.kind !== 'supplier' && payout === 'payroll' ? 'อนุมัติแล้ว จะรวมจ่ายกับเงินเดือน' : 'อนุมัติแล้ว รอโอน'
                              )
                            }
                          >
                            อนุมัติ
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setText(''); setDialog({ mode: 'reject', claims: [c] }) }}>
                            ไม่อนุมัติ
                          </Button>
                        </>
                      ) : tab === 'transfer' && isFinance ? (
                        <Button size="sm" variant="secondary" onClick={() => { setText(''); setSlip(null); setDialog({ mode: 'paid', claims: [c] }) }}>
                          โอนแล้ว
                        </Button>
                      ) : null}
                    </div>
                  }
                />
              )
            })}
          </ListRows>
        )}
        {tab === 'payroll' && rows.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            ใบเหล่านี้ขึ้นช่อง &quot;เบิกคืน&quot; ในหน้าสรุปเงินเดือนของงวดนั้นเอง — บันทึกงวดแล้วจะเปลี่ยนเป็นจ่ายแล้วให้อัตโนมัติ
          </p>
        )}
      </SectionCard>

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={
          dialog?.mode === 'reject'
            ? 'ไม่อนุมัติใบเบิก'
            : `บันทึกว่าโอนแล้ว${dialog && dialog.claims.length > 1 ? ` ${dialog.claims.length} ใบ` : ''}`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              ยกเลิก
            </Button>
            <Button onClick={confirmDialog} loading={!!busy} variant={dialog?.mode === 'reject' ? 'danger' : 'primary'}>
              {dialog?.mode === 'reject' ? 'ไม่อนุมัติ' : 'บันทึก'}
            </Button>
          </>
        }
      >
        {dialog && (
          <div className="space-y-3">
            {dialog.mode === 'paid' && (
              <p className="text-xs text-gray-500">อัปโหลดไฟล์เข้า SCB แล้วยืนยันรายการเรียบร้อย ค่อยกดบันทึก — ยังไม่โอนก็ปิดหน้าต่างนี้ไว้ก่อนได้</p>
            )}
            {dialog.claims.length === 1 ? (
              <p className="text-sm text-gray-700">
                {dialog.claims[0].kind === 'supplier' ? dialog.claims[0].payeeName : dialog.claims[0].userName} ·{' '}
                {baht.format(dialog.claims[0].amount)} บาท · {dialog.claims[0].description}
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                {dialog.claims.length} ใบ · รวม {baht.format(dialog.claims.reduce((s, c) => s + c.amount, 0))} บาท —
                สลิป/รายงานโอนใบเดียวใช้กับทุกใบ
              </p>
            )}
            <Field label={dialog.mode === 'reject' ? 'เหตุผล (พนักงานจะเห็น)' : 'หมายเหตุ (ไม่บังคับ)'}>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={dialog.mode === 'reject' ? 'เช่น ไม่ใช่ค่าใช้จ่ายของงาน' : 'เช่น โอนผ่านไฟล์ SCB 3 พ.ย.'}
              />
            </Field>
            {dialog.mode === 'paid' && (
              <Field label="สลิปโอน (ไม่บังคับ)">
                <FileDropzone
                  files={slip ? [slip] : []}
                  onChange={(f) => setSlip(f[0] ?? null)}
                  allowPdf
                  size="sm"
                  label="ลากสลิป/รายงานโอนจาก SCB มาวาง หรือกดเพื่อเลือก"
                />
              </Field>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="สรุปค่าใช้จ่ายสิ้นเดือน"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              ยกเลิก
            </Button>
            <Button icon="Download" onClick={downloadReport} loading={busy === 'report'}>
              ดาวน์โหลด Excel
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="เดือน" help="ตามวันที่จ่ายเงิน / วันที่ใบแจ้งหนี้ · เฉพาะใบที่บัญชีอนุมัติแล้ว" asDiv>
            <SelectMenu value={reportMonth} options={recentMonths()} onChange={setReportMonth} />
          </Field>
          <Field label="บริษัท" asDiv>
            <SelectMenu
              value={reportCompany}
              options={companies.map((c) => ({ value: c.id, label: c.code, hint: c.name_th }))}
              onChange={setReportCompany}
              clearable="ทุกบริษัท"
              placeholder="ทุกบริษัท"
            />
          </Field>
          <p className="text-xs text-gray-500">
            ได้ชีตสรุป + ชีตละคนตามฟอร์ม EXPENSES REIMBURSEMENT (ค่าเดินทาง · รับรอง · โทรศัพท์ · อื่น ๆ · อื่น ๆ VAT 7%) +
            ชีตจ่าย supplier
          </p>
        </div>
      </Modal>

      <ClaimEditModal
        claim={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          showToast('บันทึกการแก้ไขแล้ว', 'success')
          load()
        }}
      />

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="ส่งออกไฟล์โอน SCB"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExportOpen(false)}>
              ยกเลิก
            </Button>
            <Button icon="Download" onClick={exportTransfer} loading={busy === 'export'}>
              ดาวน์โหลดไฟล์ (.txt)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="บริษัทที่จ่าย" help="1 ไฟล์ต่อ 1 บริษัท — ตัดเงินจากบัญชีของบริษัทนั้น" asDiv>
            <SelectMenu
              value={exportCompany}
              options={[...new Set(exportPool.map((c) => c.companyId))].map((id) => {
                const co = companies.find((c) => c.id === id)
                const list = poolOf(id)
                return {
                  value: id ?? '',
                  label: co?.code ?? 'ไม่ระบุบริษัท',
                  hint: `${list.length} ใบ · ${baht.format(list.reduce((s, c) => s + c.amount, 0))} บาท`,
                }
              })}
              onChange={(v) => pickCompany(v || null)}
            />
          </Field>
          <Field label="บัญชีตัดเงิน (SCB ของบริษัท)" help="ใช้หักค่าธรรมเนียมด้วย · กรอกครั้งเดียว ระบบจำไว้กับบริษัท">
            <Input
              value={debitAccount}
              onChange={(e) => setDebitAccount(e.target.value)}
              inputMode="numeric"
              placeholder="xxx-x-xxxxx-x"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="วันที่รายการมีผล" asDiv>
              <DatePicker value={valueDate} onChange={setValueDate} />
            </Field>
            <Field label="บริการโอน" asDiv>
              <SelectMenu
                value={product}
                options={(Object.keys(SCB_PRODUCT_LABEL) as ScbProduct[]).map((k) => ({ value: k, label: SCB_PRODUCT_LABEL[k], hint: k }))}
                onChange={(v) => v && setProduct(v as ScbProduct)}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-500">
            ได้ไฟล์ SCB_file_reference_….txt แบบเดียวกับปุ่ม Export ของ CPX Toolkit — อัปโหลดเข้า SCB Business Anywhere ได้เลย ·
            ไฟล์นี้โอนได้เฉพาะบัญชี SCB (บัญชีธนาคารอื่นจะแจ้งว่าข้ามไป)
          </p>
        </div>
      </Modal>
    </div>
  )
}
