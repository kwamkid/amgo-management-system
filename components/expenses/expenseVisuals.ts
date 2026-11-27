// ไอคอน + สีของหมวด/แบบใบ/วิธีรับเงิน — ใช้ร่วมกันทุกหน้าใบเบิก (เจ้าของ 3 พ.ย. 69: ใช้ไอคอนช่วย กราฟิกเยอะ ๆ)
// สีตามระบบ (ส้ม เขียว แดง ม่วง น้ำตาล) — ไม่ใช้สีฟ้า

import {
  ArrowRightLeft,
  Banknote,
  Car,
  Fuel,
  Gift,
  Megaphone,
  Package,
  PackageOpen,
  PenLine,
  ShoppingBasket,
  Smartphone,
  SquareParking,
  Store,
  Tag,
  Truck,
  UtensilsCrossed,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { PillTone } from '@/components/aoo'
import type { AccountGroupKey, ExpenseKind, ExpensePayout, FormSection } from '@/lib/services/expenseRules'

/** ไอคอน + สีของหมวดย่อย */
export const SECTION_VISUAL: Record<FormSection, { icon: LucideIcon; tone: PillTone }> = {
  taxi: { icon: Car, tone: 'accent' },
  toll: { icon: SquareParking, tone: 'warning' },
  gas: { icon: Fuel, tone: 'danger' },
  entertain: { icon: UtensilsCrossed, tone: 'success' },
  shipping: { icon: Truck, tone: 'warning' },
  promo: { icon: Tag, tone: 'plum' },
  ads: { icon: Megaphone, tone: 'danger' },
  packaging: { icon: PackageOpen, tone: 'warning' },
  stationery: { icon: PenLine, tone: 'grape' },
  supplies: { icon: ShoppingBasket, tone: 'success' },
  repair: { icon: Wrench, tone: 'neutral' },
  phone: { icon: Smartphone, tone: 'grape' },
  welfare: { icon: Gift, tone: 'plum' },
  other: { icon: Package, tone: 'neutral' },
}

/** ไอคอน + สีของหมวดบัญชี — หมวดเดียวหมวดย่อยเดียวใช้ของหมวดย่อย · เดินทาง = รถ */
export const GROUP_VISUAL: Record<AccountGroupKey, { icon: LucideIcon; tone: PillTone }> = {
  travel: SECTION_VISUAL.taxi,
  entertain: SECTION_VISUAL.entertain,
  shipping: SECTION_VISUAL.shipping,
  promo: SECTION_VISUAL.promo,
  ads: SECTION_VISUAL.ads,
  packaging: SECTION_VISUAL.packaging,
  stationery: SECTION_VISUAL.stationery,
  supplies: SECTION_VISUAL.supplies,
  repair: SECTION_VISUAL.repair,
  phone: SECTION_VISUAL.phone,
  welfare: SECTION_VISUAL.welfare,
  other: SECTION_VISUAL.other,
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
