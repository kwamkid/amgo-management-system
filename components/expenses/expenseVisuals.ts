// ไอคอน + สีของหมวด/แบบใบ/วิธีรับเงิน — ใช้ร่วมกันทุกหน้าใบเบิก (เจ้าของ 3 พ.ย. 69: ใช้ไอคอนช่วย กราฟิกเยอะ ๆ)
// สีตามระบบ (ส้ม เขียว แดง ม่วง น้ำตาล) — ไม่ใช้สีฟ้า

import {
  ArrowRightLeft,
  Banknote,
  Car,
  Fuel,
  Package,
  ReceiptText,
  Smartphone,
  SquareParking,
  Store,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { PillTone } from '@/components/aoo'
import type { ExpenseKind, ExpensePayout, FormSection } from '@/lib/services/expenseRules'

export const SECTION_VISUAL: Record<FormSection, { icon: LucideIcon; tone: PillTone }> = {
  taxi: { icon: Car, tone: 'accent' },
  toll: { icon: SquareParking, tone: 'warning' },
  gas: { icon: Fuel, tone: 'danger' },
  entertain: { icon: UtensilsCrossed, tone: 'success' },
  phone: { icon: Smartphone, tone: 'grape' },
  other: { icon: Package, tone: 'neutral' },
  other_vat: { icon: ReceiptText, tone: 'plum' },
}

export const KIND_VISUAL: Record<ExpenseKind, { icon: LucideIcon; tone: PillTone }> = {
  reimburse: { icon: Wallet, tone: 'accent' },
  supplier: { icon: Store, tone: 'grape' },
}

export const PAYOUT_VISUAL: Record<ExpensePayout, { icon: LucideIcon; tone: PillTone }> = {
  payroll: { icon: Banknote, tone: 'success' },
  transfer: { icon: ArrowRightLeft, tone: 'warning' },
}

const bahtFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** 1234.5 → "1,234.50 ฿" (เจ้าของ 3 พ.ย. 69: ตัวเงินใช้สัญลักษณ์ ฿) */
export const thb = (n: number) => `${bahtFmt.format(n)} ฿`
