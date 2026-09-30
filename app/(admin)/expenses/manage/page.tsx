'use client'

// จัดการใบเบิกค่าใช้จ่าย — ผู้จัดการ/แอดมินอนุมัติขั้นแรก · บัญชี/HR ขั้นสอง + จ่าย
//
// ไม่มีความสัมพันธ์หัวหน้า-ลูกน้องในระบบ ผู้จัดการคนไหนก็อนุมัติขั้นแรกได้ (แบบใบลา)
// ลำดับขั้นและ "อนุมัติใบตัวเองไม่ได้" ตรวจซ้ำในฟังก์ชัน SQL — หน้านี้แค่ซ่อนปุ่ม

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Receipt } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getBank } from '@/lib/constants/banks'
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  RadioCardGroup,
  TabBar,
  TabItem,
} from '@/components/aoo'
import { ListRow, ListRows, PageHeader, SectionCard, Skeleton } from '@/components/shared'
import ExpenseStatusPill from '@/components/expenses/ExpenseStatusPill'
import ReceiptThumbs from '@/components/expenses/ReceiptThumbs'
import {
  CATEGORY_LABEL,
  PAYOUT_LABEL,
  financeDecide,
  listClaims,
  managerDecide,
  markTransferred,
  type ExpenseClaim,
  type ExpensePayout,
  type ExpenseStatus,
} from '@/lib/services/expenseService'

const baht = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const thaiDate = (iso: string) => format(new Date(`${iso}T00:00:00`), 'd MMM yyyy', { locale: th })
const monthLabel = (iso: string) => format(new Date(`${iso}T00:00:00`), 'MMM yyyy', { locale: th })

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

  // ไม่อนุมัติ / โอนแล้ว ต้องกรอกเพิ่ม — ใช้ modal เดียวสลับโหมด
  const [dialog, setDialog] = useState<{ mode: 'reject' | 'paid'; claim: ExpenseClaim } | null>(null)
  const [text, setText] = useState('')
  const [slip, setSlip] = useState<File | null>(null)
  // บัญชีเลือกวิธีจ่ายใหม่ได้ตอนอนุมัติ
  const [payoutOf, setPayoutOf] = useState<Record<string, ExpensePayout>>({})

  const load = useCallback(async () => {
    try {
      setLoading(true)
      let list = await listClaims(TAB_STATUSES[tab], tab === 'done' ? 100 : 300)
      if (tab === 'transfer') list = list.filter((c) => c.payout === 'transfer')
      if (tab === 'payroll') list = list.filter((c) => c.payout === 'payroll')
      setRows(list)
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
    const c = dialog.claim
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
      run(c.id, () => markTransferred(c, userData!.id!, text, slip), 'บันทึกว่าโอนแล้ว')
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
        description="ผู้จัดการอนุมัติ → บัญชีตรวจใบเสร็จและเลือกวิธีจ่าย → จ่ายคืน"
        icon={Receipt}
      />

      <TabBar ariaLabel="สถานะใบเบิก" className="flex-wrap">
        <TabItem active={tab === 'manager'} onClick={() => setTab('manager')} label="รอผู้จัดการ" />
        <TabItem active={tab === 'finance'} onClick={() => setTab('finance')} label="รอบัญชี" />
        <TabItem active={tab === 'transfer'} onClick={() => setTab('transfer')} label="รอโอน" />
        <TabItem active={tab === 'payroll'} onClick={() => setTab('payroll')} label="รวมเงินเดือน" />
        <TabItem active={tab === 'done'} onClick={() => setTab('done')} label="เสร็จแล้ว" />
      </TabBar>

      <SectionCard title={rows.length ? `${rows.length} ใบ · รวม ${baht.format(total)} บาท` : undefined}>
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
                  title={
                    <span className="whitespace-normal text-sm">
                      <span className="font-semibold">{c.userName}</span>
                      <span className="text-gray-500"> · {baht.format(c.amount)} บาท</span>
                    </span>
                  }
                  meta={
                    <>
                      <p className="text-xs">
                        {thaiDate(c.expenseDate)} · {CATEGORY_LABEL[c.category]} · {c.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {PAYOUT_LABEL[c.payout]}
                        {c.payout === 'payroll' && c.payrollMonth && ` งวด ${monthLabel(c.payrollMonth)}`}
                        {c.paidNote && ` · ${c.paidNote}`}
                      </p>
                      {c.noReceiptReason && (
                        <p className="text-xs text-amber-700">ไม่มีใบเสร็จ: {c.noReceiptReason}</p>
                      )}
                      {c.rejectedReason && <p className="text-xs text-red-600">ไม่อนุมัติ: {c.rejectedReason}</p>}
                      {tab === 'transfer' && (
                        <p className="text-xs font-medium text-gray-700">
                          โอนเข้า: {getBank(c.bankName)?.nameTh ?? c.bankName ?? 'ยังไม่มีข้อมูลธนาคาร'}{' '}
                          {c.bankAccountNo ?? ''}
                        </p>
                      )}
                      <ReceiptThumbs paths={c.slipPath ? [...c.receiptPaths, c.slipPath] : c.receiptPaths} />
                      {tab === 'finance' && isFinance && !mine(c) && (
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
                          <Button size="sm" variant="ghost" onClick={() => { setText(''); setDialog({ mode: 'reject', claim: c }) }}>
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
                                () => financeDecide(c, true, { payout }),
                                payout === 'payroll' ? 'อนุมัติแล้ว จะรวมจ่ายกับเงินเดือน' : 'อนุมัติแล้ว รอโอน'
                              )
                            }
                          >
                            อนุมัติ
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setText(''); setDialog({ mode: 'reject', claim: c }) }}>
                            ไม่อนุมัติ
                          </Button>
                        </>
                      ) : tab === 'transfer' && isFinance ? (
                        <Button size="sm" onClick={() => { setText(''); setSlip(null); setDialog({ mode: 'paid', claim: c }) }}>
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
        title={dialog?.mode === 'reject' ? 'ไม่อนุมัติใบเบิก' : 'บันทึกว่าโอนแล้ว'}
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
            <p className="text-sm text-gray-700">
              {dialog.claim.userName} · {baht.format(dialog.claim.amount)} บาท · {dialog.claim.description}
            </p>
            <Field label={dialog.mode === 'reject' ? 'เหตุผล (พนักงานจะเห็น)' : 'หมายเหตุ (ไม่บังคับ)'}>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={dialog.mode === 'reject' ? 'เช่น ไม่ใช่ค่าใช้จ่ายของงาน' : 'เช่น โอน KBANK 1 ต.ค.'}
              />
            </Field>
            {dialog.mode === 'paid' && (
              <Field label="สลิปโอน (ไม่บังคับ)">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
