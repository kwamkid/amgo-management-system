'use client'

// เลือกหมวดในช่องเดียว (เจ้าของ 27 พ.ย. 69: การ์ด 2 แถวไม่เท่ากัน รก — ทำเป็นไอคอน + dropdown เลือกทีเดียวจบ)
// แต่ละตัวเลือก = หมวดย่อย 1 ตัว ใต้หมวดบัญชีของมัน: "เดินทาง › Taxi" · หมวดที่มีหมวดย่อยเดียวโชว์ชื่อหมวดบัญชีเลย
// ได้ทั้งหมวดบัญชี (รหัสผังบัญชี — บัญชีรวมยอด) และหมวดย่อย (ไว้ดูสถิติ) จากการเลือกครั้งเดียว · พิมพ์ค้นหาได้
// พนักงานไม่รู้หมวดก็ได้: หน้าที่ใช้เดาให้จากรายละเอียด (suggestSection) แล้วส่ง hint มาโชว์

import { Field, IconChip, SelectMenu } from '@/components/aoo'
import {
  ACCOUNT_GROUPS,
  SECTION_SHORT,
  groupOfSection,
  type AccountGroupKey,
  type FormSection,
} from '@/lib/services/expenseRules'
import { SECTION_VISUAL } from './expenseVisuals'

const OPTIONS = ACCOUNT_GROUPS.flatMap((g) =>
  g.subs.map((sub) => ({
    value: sub,
    label: g.subs.length > 1 ? `${g.short} › ${SECTION_SHORT[sub]}` : g.label,
    hint: g.code ?? 'บัญชีเลือกรหัส',
    icon: <IconChip icon={SECTION_VISUAL[sub].icon} tone={SECTION_VISUAL[sub].tone} size={24} />,
  }))
)

export default function ExpenseSectionField({
  value,
  onChange,
  hint,
}: {
  /** หมวดบัญชีที่เลือก — คงไว้ให้หน้าที่เรียกใช้ไม่ต้องแก้ (หาได้จากหมวดย่อยอยู่แล้ว) */
  group?: AccountGroupKey | null
  /** หมวดย่อยที่เลือก */
  value: FormSection | null
  onChange: (group: AccountGroupKey, sub: FormSection) => void
  /** ข้อความใต้ช่อง เช่น "ระบบเลือกให้จากรายการเก่า — เปลี่ยนได้" */
  hint?: string
}) {
  const g = value ? groupOfSection(value) : null
  const help = [
    g ? `ลงบัญชี ${g.code ? `${g.code} ` : ''}${g.label}` : null,
    hint ?? (g ? null : 'ไม่แน่ใจ? พิมพ์รายละเอียดก่อน ระบบจะเลือกให้ · หรือพิมพ์ค้นหาในช่องนี้'),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Field label="หมวดค่าใช้จ่าย" help={help} asDiv>
      <SelectMenu
        value={value}
        options={OPTIONS}
        placeholder="เลือกหมวด"
        onChange={(v) => {
          if (!v) return
          const sub = v as FormSection
          onChange(groupOfSection(sub).key, sub)
        }}
      />
    </Field>
  )
}
