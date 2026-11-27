'use client'

// บัญชีตัดเงินของบริษัท — dropdown จากตาราง company_bank_accounts + เพิ่มบัญชีได้ในที่ (27 พ.ย. 69)
// ไฟล์โอนตอนนี้เป็นของ SCB → เลือกได้เฉพาะบัญชี SCB · บัญชีธนาคารอื่นแสดงไว้แต่เลือกไม่ได้
// ยังไม่ได้รัน migration (ไม่มีตาราง) → ถอยไปช่องพิมพ์เลขบัญชีแบบเดิม ใช้งานต่อได้

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Field, Input, SelectMenu } from '@/components/aoo'
import { THAI_BANKS, getBank } from '@/lib/constants/banks'
import { createClient } from '@/lib/supabase/client'

export interface CompanyBankAccount {
  id: string
  bank: string
  account_no: string
  label: string | null
}

const BANK_OPTIONS = THAI_BANKS.map((b) => ({ value: b.code, label: b.nameTh, hint: b.code }))
const fmtAcc = (a: string) => (a.length === 10 ? `${a.slice(0, 3)}-${a.slice(3, 4)}-${a.slice(4, 9)}-${a.slice(9)}` : a)

export default function DebitAccountPicker({
  companyId,
  preferred,
  value,
  onChange,
}: {
  companyId: string | null
  /** บัญชีที่ใช้ล่าสุดของบริษัท (companies.scb_debit_account) — เลือกให้ก่อน */
  preferred: string | null
  value: string
  onChange: (account: string) => void
}) {
  const [accounts, setAccounts] = useState<CompanyBankAccount[] | null>(null)
  const [fallback, setFallback] = useState(false)
  const [adding, setAdding] = useState(false)
  const [bank, setBank] = useState('SCB')
  const [accNo, setAccNo] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!companyId) {
      setAccounts([])
      return
    }
    const { data, error } = await createClient()
      .from('company_bank_accounts' as never)
      .select('id, bank, account_no, label')
      .eq('company_id', companyId)
      .order('created_at')
    if (error) {
      setFallback(true)
      return
    }
    const list = (data ?? []) as unknown as CompanyBankAccount[]
    setAccounts(list)
    return list
  }, [companyId])

  useEffect(() => {
    load().then((list) => {
      if (!list) return
      const scb = list.filter((a) => a.bank === 'SCB')
      if (!scb.some((a) => a.account_no === value)) {
        onChange(scb.find((a) => a.account_no === preferred)?.account_no ?? scb[0]?.account_no ?? '')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const options = useMemo(
    () =>
      (accounts ?? []).map((a) => {
        const b = getBank(a.bank)
        return {
          value: a.account_no,
          label: `${b?.nameTh ?? a.bank} ${fmtAcc(a.account_no)}${a.label ? ` · ${a.label}` : ''}`,
          hint: a.bank === 'SCB' ? undefined : 'ยังส่งไฟล์จากธนาคารนี้ไม่ได้',
          disabled: a.bank !== 'SCB',
        }
      }),
    [accounts]
  )

  const save = async () => {
    setError('')
    setSaving(true)
    const { error } = await createClient().rpc('add_company_bank_account' as never, {
      p_company_id: companyId,
      p_bank: bank,
      p_account: accNo,
      p_label: label,
    } as never)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    const digits = accNo.replace(/\D/g, '')
    await load()
    if (bank === 'SCB') onChange(digits)
    setAdding(false)
    setAccNo('')
    setLabel('')
  }

  if (fallback) {
    return (
      <Field label="บัญชีตัดเงิน (SCB ของบริษัท)" help="ใช้หักค่าธรรมเนียมด้วย · กรอกครั้งเดียว ระบบจำไว้กับบริษัท">
        <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="numeric" placeholder="xxx-x-xxxxx-x" />
      </Field>
    )
  }

  return (
    <div className="space-y-3">
      <Field label="บัญชีตัดเงินของบริษัท" help="ใช้หักค่าธรรมเนียมด้วย · ไฟล์นี้ตัดเงินได้เฉพาะบัญชี SCB" asDiv>
        <SelectMenu
          value={value || null}
          options={options}
          placeholder={accounts && !accounts.length ? 'ยังไม่มีบัญชี — กด เพิ่มบัญชี' : 'เลือกบัญชี'}
          onChange={(v) => v && onChange(v)}
        />
      </Field>
      {!adding ? (
        <Button size="sm" variant="ghost" icon="Plus" onClick={() => setAdding(true)} disabled={!companyId}>
          เพิ่มบัญชี
        </Button>
      ) : (
        <div className="space-y-3 border-t border-gray-200 pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ธนาคาร" asDiv>
              <SelectMenu value={bank} options={BANK_OPTIONS} onChange={(v) => v && setBank(v)} />
            </Field>
            <Field label="เลขบัญชี">
              <Input value={accNo} onChange={(e) => setAccNo(e.target.value)} inputMode="numeric" placeholder="xxx-x-xxxxx-x" />
            </Field>
          </div>
          <Field label="ชื่อเรียก (ไม่บังคับ)">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น บัญชีหลัก" />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              ยกเลิก
            </Button>
            <Button size="sm" variant="secondary" icon="Check" loading={saving} disabled={!accNo.trim()} onClick={save}>
              บันทึกบัญชี
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
