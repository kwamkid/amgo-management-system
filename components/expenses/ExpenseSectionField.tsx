'use client'

// เลือกหมวด 2 ชั้น (เจ้าของ 27 พ.ย. 69) — ใช้ทั้งตอนพนักงานยื่นและตอนบัญชีแก้
// ชั้น 1 หมวดบัญชี (รหัสผังบัญชีที่บัญชีรวมยอด) · ชั้น 2 หมวดย่อยไว้ดูสถิติ — โชว์เฉพาะหมวดที่มีหมวดย่อยมากกว่า 1
// พนักงานไม่รู้หมวดก็ได้: หน้าที่ใช้เดาให้จากรายละเอียด (suggestSection) แล้วส่ง hint มาโชว์

import { ChoiceTiles, Field } from '@/components/aoo'
import {
  ACCOUNT_GROUPS,
  SECTION_LABEL,
  SECTION_SHORT,
  groupByKey,
  type AccountGroupKey,
  type FormSection,
} from '@/lib/services/expenseRules'
import { GROUP_VISUAL, SECTION_VISUAL } from './expenseVisuals'

const GROUP_OPTIONS = ACCOUNT_GROUPS.map((g) => ({
  value: g.key,
  label: g.short,
  icon: GROUP_VISUAL[g.key].icon,
  tone: GROUP_VISUAL[g.key].tone,
}))

export default function ExpenseSectionField({
  group,
  value,
  onChange,
  hint,
}: {
  /** หมวดบัญชีที่เลือก */
  group: AccountGroupKey | null
  /** หมวดย่อยที่เลือก */
  value: FormSection | null
  onChange: (group: AccountGroupKey, sub: FormSection) => void
  /** ข้อความใต้ช่อง เช่น "ระบบเลือกให้จากรายการเก่า — เปลี่ยนได้" */
  hint?: string
}) {
  const g = group ? groupByKey(group) : null
  const showSubs = !!g && g.subs.length > 1
  const help = [
    g ? `${g.code ? `${g.code} ` : ''}${g.label}` : null,
    !showSubs && value && g && value !== 'other' ? SECTION_LABEL[value] : null,
    hint ?? (g ? null : 'ไม่แน่ใจ? พิมพ์รายละเอียดก่อน ระบบจะเลือกให้'),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <Field label="หมวดบัญชี" help={help} asDiv>
        <ChoiceTiles
          options={GROUP_OPTIONS}
          value={group}
          onChange={(v) => {
            if (v === group) return
            const next = groupByKey(v as AccountGroupKey)
            onChange(next.key, next.subs[0])
          }}
          stacked
          scroll
          ariaLabel="หมวดบัญชี"
        />
      </Field>
      {showSubs && g && (
        <Field label="หมวดย่อย (ไว้ดูสถิติ)" help={value ? SECTION_LABEL[value] : undefined} asDiv>
          <ChoiceTiles
            options={g.subs.map((k) => ({
              value: k,
              label: SECTION_SHORT[k],
              icon: SECTION_VISUAL[k].icon,
              tone: SECTION_VISUAL[k].tone,
            }))}
            value={value}
            onChange={(v) => onChange(g.key, v as FormSection)}
            stacked
            scroll
            ariaLabel="หมวดย่อย"
          />
        </Field>
      )}
    </>
  )
}
