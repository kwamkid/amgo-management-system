'use client'

// เลือกหมวด 2 ชั้น (เจ้าของ 27 พ.ย. 69) — ใช้ทั้งตอนพนักงานยื่นและตอนบัญชีแก้
// การ์ดเป็นตาราง ไม่เลื่อนข้าง (เจ้าของ 27 พ.ย.: เมาส์ Windows เลื่อนข้างไม่ได้ · การ์ดต้องเท่ากัน) — คอม 6 · มือถือ 4 ต่อแถว ทั้ง 2 ชั้น
// ชั้น 1 หมวดบัญชี (รหัสผังบัญชีที่บัญชีรวมยอด) · ชั้น 2 หมวดย่อยไว้ดูสถิติ — โชว์เฉพาะหมวดที่มีหมวดย่อยมากกว่า 1
// เลือกแล้วขึ้นกล่องอธิบายเด่น ๆ ว่าหมวดนี้คือค่าอะไร (เจ้าของ 27 พ.ย.: ไอคอนคำน้อย อาจเข้าใจผิด)
// พนักงานไม่รู้หมวดก็ได้: หน้าที่ใช้เดาให้จากรายละเอียด (suggestSection) แล้วส่ง hint มาโชว์

import { ChoiceTiles, Field, IconChip } from '@/components/aoo'
import {
  ACCOUNT_GROUPS,
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

/** หมวดนี้ใช้กับค่าอะไร — ตัวอย่างที่พนักงานเจอจริง */
const GROUP_EXAMPLES: Record<AccountGroupKey, string> = {
  travel: 'ค่ารถไปทำงานนอกออฟฟิศ: Taxi · Grab · BTS/MRT · วิน · ทางด่วน · ที่จอดรถ · น้ำมัน/ชาร์จรถ',
  entertain: 'เลี้ยงลูกค้า · ข้าว/น้ำทีมงานออกบูธ · กาแฟคุยงานกับลูกค้า',
  shipping: 'ส่งของให้ลูกค้าหรือสาขา: Lalamove · ไปรษณีย์ · Kerry · Flash · ขนย้ายสินค้า',
  promo: 'ของที่ใช้ช่วยขาย: ป้าย · สติ๊กเกอร์ · ไวนิล · ของแจก/ของรางวัล · ตกแต่งบูธ',
  ads: 'ค่าโฆษณา: ยิงแอด Facebook/TikTok · ลงสื่อ · จ้างรีวิว',
  packaging: 'ของแพ็คสินค้า: ถุง · กล่อง · บับเบิล · เทปกาว',
  stationery: 'ปากกา · กระดาษ · แฟ้ม · หมึก · ปริ้น/ถ่ายเอกสาร',
  supplies: 'ของใช้หมดไป: ทิชชู่ · น้ำยาทำความสะอาด · ถ่าน · อุปกรณ์ชิ้นเล็ก',
  repair: 'ซ่อมรถ · ซ่อมเครื่องใช้/อุปกรณ์ · ซ่อมแซมร้านหรือออฟฟิศ',
  phone: 'ค่าโทรศัพท์ · เติมเงินมือถือ · อินเทอร์เน็ต/ไวไฟ',
  welfare: 'ของให้พนักงาน: ขนม/ของกิน · ของขวัญวันเกิด · กิจกรรมพนักงาน',
  other: 'ไม่เข้าหมวดไหน — เขียนรายละเอียดให้ชัด บัญชีจะเลือกรหัสบัญชีให้',
}

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
  return (
    <>
      <Field label="หมวดบัญชี" help={g ? undefined : (hint ?? 'ไม่แน่ใจ? พิมพ์รายละเอียดก่อน ระบบจะเลือกให้')} asDiv>
        <ChoiceTiles
          options={GROUP_OPTIONS}
          value={group}
          onChange={(v) => {
            if (v === group) return
            const next = groupByKey(v as AccountGroupKey)
            onChange(next.key, next.subs[0])
          }}
          stacked
          columns={6}
          mobileColumns={4}
          bare
          ariaLabel="หมวดบัญชี"
        />
      </Field>
      {/* คำอธิบายหมวดที่เลือก — อยู่ใต้การ์ดทันที กล่องพื้นอ่อนมุมมนรอบด้าน (เจ้าของไม่ชอบแถบสีด้านเดียว) */}
      {g && (
        <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
          <IconChip icon={GROUP_VISUAL[g.key].icon} tone={GROUP_VISUAL[g.key].tone} size={36} />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900">{g.label}</p>
            <p className="text-sm text-gray-700">{GROUP_EXAMPLES[g.key]}</p>
            <p className="mt-1 text-xs text-gray-500">
              {g.code ? `ลงบัญชีรหัส ${g.code}` : 'บัญชีเลือกรหัสบัญชีให้ตอนตรวจ'}
              {hint ? ` · ${hint}` : ''}
            </p>
          </div>
        </div>
      )}
      {/* หมวดย่อย = ชิปแยกทีละปุ่ม (.aoo-chip) — เจ้าของ 27 พ.ย.: การ์ดใหญ่เกิน · Segmented แถบเดียวดูไม่ออก */}
      {showSubs && g && (
        <Field label="หมวดย่อย (ไว้ดูสถิติ)" asDiv>
          <div className="aoo-chips" role="group" aria-label="หมวดย่อย">
            {g.subs.map((k) => {
              const Icon = SECTION_VISUAL[k].icon
              const on = (value ?? g.subs[0]) === k
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  className="aoo-chip"
                  onClick={() => onChange(g.key, k)}
                >
                  <Icon size={15} />
                  {SECTION_SHORT[k]}
                </button>
              )
            })}
          </div>
        </Field>
      )}
    </>
  )
}
