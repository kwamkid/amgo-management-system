'use client'

// บัญชีแก้หมวด/รายละเอียดของใบก่อนอนุมัติหรือก่อนโอน (เจ้าของ 3 พ.ย. 69)
// พนักงานเลือกหมวดผิด/ระบบเดาผิด บัญชีแก้ตรงนี้ — ไม่ต้องไปกรอกใหม่ในไฟล์สรุปสิ้นเดือน
// ยอดเงินแก้ได้เฉพาะตอนรอบัญชี · ตรวจซ้ำใน updateClaimDetails

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button, DatePicker, Field, FileDropzone, Input, Modal, MoneyInput, SelectMenu, Toggle } from '@/components/aoo'
import { BankLogo } from '@/components/shared/BankBadge'
import { THAI_BANKS } from '@/lib/constants/banks'
import ExpenseSectionField from './ExpenseSectionField'
import {
  ACCOUNT_CODES,
  SECTION_CATEGORY,
  accountOf,
  formSectionOf,
  groupByKey,
  groupOfCode,
  receiptUrls,
  updateClaimDetails,
  vatIncluded,
  type AccountGroupKey,
  type ExpenseClaim,
  type FormSection,
} from '@/lib/services/expenseService'

// ผังบัญชีทั้งหมด — เกิน 7 ตัว SelectMenu มีช่องค้นหาให้เอง
const ACCOUNT_OPTIONS = ACCOUNT_CODES.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))
const BANK_OPTIONS = THAI_BANKS.map((b) => ({ value: b.code, label: b.code, hint: b.nameTh, icon: <BankLogo bank={b.code} /> }))

export default function ClaimEditModal({
  claim,
  onClose,
  onSaved,
}: {
  claim: ExpenseClaim | null
  onClose: () => void
  onSaved: () => void
}) {
  const [group, setGroup] = useState<AccountGroupKey | null>(null)
  const [section, setSection] = useState<FormSection | null>(null)
  // รหัสบัญชีจริงที่จะลง — ตามหมวดบัญชี หรือบัญชีเลือกทับจากผังทั้งหมด
  const [accountCode, setAccountCode] = useState<string | null>(null)
  const [hasVat, setHasVat] = useState(false)
  const [expenseDate, setExpenseDate] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [vat, setVat] = useState(0)
  const [routeFrom, setRouteFrom] = useState('')
  const [routeTo, setRouteTo] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [purpose, setPurpose] = useState('')
  const [attendees, setAttendees] = useState('')
  const [payeeName, setPayeeName] = useState('')
  const [payeeBank, setPayeeBank] = useState<string | null>(null)
  const [payeeAccountNo, setPayeeAccountNo] = useState('')
  // ไฟล์แนบ: เดิมที่เก็บไว้ + ที่เพิ่มใหม่
  const [keepPaths, setKeepPaths] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!claim) return
    const code = accountOf(claim)
    setSection(formSectionOf(claim.category))
    setAccountCode(code)
    setGroup(groupOfCode(code).key)
    setHasVat(claim.vatAmount > 0)
    setExpenseDate(claim.expenseDate)
    setDescription(claim.description)
    setAmount(claim.amount)
    setVat(claim.vatAmount)
    setRouteFrom(claim.routeFrom ?? '')
    setRouteTo(claim.routeTo ?? '')
    setDistanceKm(claim.distanceKm == null ? '' : String(claim.distanceKm))
    setPurpose(claim.purpose ?? '')
    setAttendees(claim.attendees ?? '')
    setPayeeName(claim.payeeName ?? '')
    setPayeeBank(claim.payeeBank)
    setPayeeAccountNo(claim.payeeAccountNo ?? '')
    setKeepPaths(claim.receiptPaths)
    setNewFiles([])
    if (claim.receiptPaths.length) receiptUrls(claim.receiptPaths).then(setThumbs)
    setError('')
  }, [claim])

  if (!claim) return null
  const amountEditable = claim.status === 'pending_finance'
  const supplier = claim.kind === 'supplier'

  // เลือกหมวดบัญชี → รหัสตามหมวด · "อื่น ๆ" คงรหัสที่บัญชีเลือกทับไว้ (ถ้าเป็นรหัสนอก 12 หมวด)
  const changeSection = (g: AccountGroupKey, s: FormSection) => {
    setGroup(g)
    setSection(s)
    const code = groupByKey(g).code
    if (code) setAccountCode(code)
    else if (groupOfCode(accountCode).key !== 'other') setAccountCode(null)
  }

  // เลือกรหัสจากผังทั้งหมด → ถ้าเป็นรหัสของ 12 หมวด ให้การ์ดหมวดบัญชีตาม · รหัสอื่น = การ์ด "อื่น ๆ" (หมวดย่อยคงเดิมไว้ดูสถิติ)
  const changeAccount = (code: string | null) => {
    setAccountCode(code)
    const g = groupOfCode(code)
    setGroup(g.key)
    if (g.key !== 'other' && section && !g.subs.includes(section)) setSection(g.subs[0])
  }

  const toggleVat = (on: boolean) => {
    setHasVat(on)
    setVat(on ? vat || vatIncluded(amount) : 0)
  }

  const save = async () => {
    if (!section) return
    const km = distanceKm.trim() ? Number(distanceKm) : null
    try {
      setSaving(true)
      setError('')
      await updateClaimDetails(claim, {
        expenseDate,
        category: SECTION_CATEGORY[section],
        accountCode,
        vatAmount: hasVat ? vat : 0,
        description,
        amount,
        routeFrom,
        routeTo,
        distanceKm: km != null && Number.isFinite(km) ? km : null,
        purpose,
        attendees,
        payeeName,
        payeeBank: payeeBank ?? '',
        payeeAccountNo,
        keepPaths,
        newFiles,
      })
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`แก้ไขใบของ ${claim.userName}`}
      maxWidth={640}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            ยกเลิก
          </Button>
          <Button onClick={save} loading={saving}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ExpenseSectionField group={group} value={section} onChange={changeSection} hint="ใช้รวมยอดตามรหัสบัญชีในสรุปสิ้นเดือน" />

        <Field
          label="รหัสบัญชี"
          help={accountCode ? undefined : 'ยังไม่ระบุรหัสบัญชี — เลือกจากผังบัญชี (อนุมัติได้แม้ยังไม่ระบุ)'}
          asDiv
        >
          <SelectMenu
            value={accountCode}
            options={ACCOUNT_OPTIONS}
            onChange={changeAccount}
            placeholder="เลือกรหัสบัญชี"
            ariaLabel="รหัสบัญชี"
          />
        </Field>

        <Field label="รายละเอียด">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-800">มีใบกำกับภาษี (VAT 7%)</p>
          <Toggle checked={hasVat} onChange={toggleVat} aria-label="มีใบกำกับภาษี (VAT 7%)" />
        </div>

        <div className={`grid grid-cols-2 gap-3 ${hasVat ? 'sm:grid-cols-3' : ''}`}>
          <Field label={supplier ? 'วันที่ใบแจ้งหนี้' : 'วันที่จ่ายเงิน'} asDiv>
            <DatePicker value={expenseDate} onChange={setExpenseDate} />
          </Field>
          <Field label="ยอดเงิน" help={amountEditable ? undefined : 'อนุมัติแล้ว แก้ยอดไม่ได้'}>
            <MoneyInput value={amount || ''} onValueChange={setAmount} disabled={!amountEditable} suffix="฿" />
          </Field>
          {hasVat && (
            <Field label="VAT 7% ในยอด" help={`คิดจากยอด ${vatIncluded(amount).toFixed(2)}`}>
              <MoneyInput value={vat || ''} onValueChange={setVat} suffix="฿" />
            </Field>
          )}
        </div>

        <Field label={supplier ? 'ใบวางบิล / ใบแจ้งหนี้' : 'ใบเสร็จ / สลิป'} help="ลบไฟล์ที่ไม่ใช่ หรือเพิ่มไฟล์ได้ · เลือกได้หลายไฟล์" asDiv>
          <div className="space-y-2">
            {keepPaths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keepPaths.map((p) => (
                  <div key={p} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200">
                    {thumbs.get(p) && !p.toLowerCase().endsWith('.pdf') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbs.get(p)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-gray-500">PDF</span>
                    )}
                    <button
                      type="button"
                      aria-label="เอาไฟล์นี้ออก"
                      onClick={() => setKeepPaths((list) => list.filter((x) => x !== p))}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FileDropzone
              files={newFiles}
              onChange={setNewFiles}
              maxItems={Math.max(1, 10 - keepPaths.length)}
              allowPdf
              size="sm"
              label="ลากไฟล์มาวางเพิ่ม หรือกดเพื่อเลือก"
            />
          </div>
        </Field>

        {(section === 'taxi' || section === 'gas') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="จาก">
              <Input value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)} />
            </Field>
            <Field label="ถึง">
              <Input value={routeTo} onChange={(e) => setRouteTo(e.target.value)} />
            </Field>
            <Field label="ระยะทาง (กม.)">
              <Input value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} inputMode="decimal" />
            </Field>
          </div>
        )}

        {section === 'entertain' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="วัตถุประสงค์">
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </Field>
            <Field label="รับรองใคร / กี่คน">
              <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} />
            </Field>
          </div>
        )}

        {supplier && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500">บัญชีที่จะโอนเข้า (ร้าน)</p>
            <Field label="ชื่อบัญชีผู้รับเงิน">
              <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="ธนาคาร" asDiv>
                <SelectMenu value={payeeBank} options={BANK_OPTIONS} onChange={setPayeeBank} />
              </Field>
              <Field label="เลขบัญชี">
                <Input value={payeeAccountNo} onChange={(e) => setPayeeAccountNo(e.target.value)} inputMode="numeric" mono />
              </Field>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
