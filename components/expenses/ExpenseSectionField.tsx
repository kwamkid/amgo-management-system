'use client'

// เลือกหมวดค่าใช้จ่ายตามฟอร์มบัญชี (EXPENSES REIMBURSEMENT) — ใช้ทั้งตอนพนักงานยื่นและตอนบัญชีแก้
// การ์ดไอคอน 7 หมวด · พนักงานไม่รู้หมวดก็ได้: หน้าที่ใช้เดาให้จากรายละเอียด (suggestSection) แล้วส่ง hint มาโชว์

import { ChoiceTiles, Field } from '@/components/aoo'
import { SECTION_BY_POPULARITY, SECTION_LABEL, SECTION_SHORT, type FormSection } from '@/lib/services/expenseRules'
import { SECTION_VISUAL } from './expenseVisuals'

// ฮิตสุดอยู่หน้าสุด · แถวเดียวเลื่อนซ้าย-ขวาได้ (เจ้าของ 3 พ.ย. 69: บีบ 7 ช่องแล้วกดยาก)
const OPTIONS = SECTION_BY_POPULARITY.map((key) => ({
  value: key,
  label: SECTION_SHORT[key],
  icon: SECTION_VISUAL[key].icon,
  tone: SECTION_VISUAL[key].tone,
}))

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
  const help = [value ? SECTION_LABEL[value] : null, hint ?? (value ? null : 'ไม่แน่ใจ? พิมพ์รายละเอียดก่อน ระบบจะเลือกให้')]
    .filter(Boolean)
    .join(' · ')
  return (
    <Field label="หมวดค่าใช้จ่าย (ตามฟอร์มบัญชี)" help={help} asDiv>
      <ChoiceTiles
        options={OPTIONS}
        value={value}
        onChange={(v) => onChange(v as FormSection)}
        stacked
        scroll
        ariaLabel="หมวดค่าใช้จ่าย"
      />
    </Field>
  )
}
