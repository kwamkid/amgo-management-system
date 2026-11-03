'use client'

// เลือกหมวดค่าใช้จ่ายตามฟอร์มบัญชี (EXPENSES REIMBURSEMENT) — ใช้ทั้งตอนพนักงานยื่นและตอนบัญชีแก้
// พนักงานไม่รู้หมวดก็ได้: หน้าที่ใช้คอมโพเนนต์นี้เดาให้จากรายละเอียด (suggestSection) แล้วส่ง hint มาโชว์

import { Field, SelectMenu } from '@/components/aoo'
import { FORM_SECTIONS, SECTION_LABEL, type FormSection } from '@/lib/services/expenseRules'

const OPTIONS = FORM_SECTIONS.map((s) => ({ value: s.key, label: SECTION_LABEL[s.key] }))

export default function ExpenseSectionField({
  value,
  onChange,
  hint,
}: {
  value: FormSection | null
  onChange: (v: FormSection) => void
  /** ข้อความใต้ช่อง เช่น "ระบบเลือกให้จากรายการเก่า — เปลี่ยนได้" */
  hint?: string
}) {
  return (
    <Field label="หมวดค่าใช้จ่าย (ตามฟอร์มบัญชี)" help={hint ?? 'ไม่แน่ใจ? พิมพ์รายละเอียดก่อน ระบบจะเลือกให้'} asDiv>
      <SelectMenu
        value={value}
        options={OPTIONS}
        onChange={(v) => v && onChange(v as FormSection)}
        placeholder="เลือกหมวด"
      />
    </Field>
  )
}
