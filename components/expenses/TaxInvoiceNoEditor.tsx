'use client'

// เลขที่ใบกำกับภาษี — เจ้าของใบหรือบัญชีใส่/แก้ได้ทุกขั้น แม้อนุมัติหรือโอนแล้ว (เจ้าของ 27 พ.ย. 69)
// ใช้ทั้งรายการ "ใบเบิกของฉัน" และ ClaimDetailModal · บันทึกผ่าน RPC set_expense_tax_invoice_no

import { useState } from 'react'
import { Button, Input } from '@/components/aoo'
import { useToast } from '@/hooks/useToast'
import { setTaxInvoiceNo } from '@/lib/services/expenseService'

export default function TaxInvoiceNoEditor({
  claimId,
  value,
  onSaved,
  compact = false,
}: {
  claimId: string
  value: string | null
  onSaved: (no: string | null) => void
  /** แถวรายการ: ตัวหนังสือเล็ก ปุ่มเล็ก */
  compact?: boolean
}) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    try {
      setSaving(true)
      await setTaxInvoiceNo(claimId, text)
      const no = text.trim() || null
      onSaved(no)
      setEditing(false)
      showToast(no ? 'บันทึกเลขที่ใบกำกับภาษีแล้ว' : 'ลบเลขที่ใบกำกับภาษีแล้ว', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="เช่น IV6911-00123"
          className="w-48 min-w-0"
        />
        <Button variant="primary" size={compact ? 'sm' : undefined} loading={saving} onClick={save}>
          บันทึก
        </Button>
        <Button variant="ghost" size={compact ? 'sm' : undefined} onClick={() => setEditing(false)}>
          ยกเลิก
        </Button>
      </div>
    )
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {value ? (
        <span className="text-gray-700">
          {compact && 'ใบกำกับภาษี '}
          <span className="font-mono">{value}</span>
        </span>
      ) : (
        <span className="text-amber-700">ยังไม่ได้ใส่เลขที่ใบกำกับภาษี</span>
      )}
      <button
        type="button"
        className="font-medium text-red-600 hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          setText(value ?? '')
          setEditing(true)
        }}
      >
        {value ? 'แก้' : 'ใส่เลข'}
      </button>
    </span>
  )
}
