// lib/services/srp/calculator.ts
//
// เครื่องคิดราคาขายปลีก (SRP) สินค้านำเข้า — port ตรงจาก srp-calculator เดิม
// (src/lib/calculator.ts) สูตรห้ามเพี้ยน: ราคาที่ทีมขายใช้เสนอห้างอยู่ทุกวัน
//
// เส้นทางเลข: FOB (USD/EUR → บาท) + ค่าเรือ/D.O. → ×(1+ภาษีนำเข้า) + ค่าส่งใน
// ประเทศ = ต้นทุนรวม → ×ตัวคูณ → ปัดเป็น "เลขสวย" (X9 / X49-X99 / X90 / X,900)
// = ราคาแนะนำ → margin เทียบราคาขายจริง → กำไรสุทธิรายช่องทางขาย

export interface SrpBrand {
  id: string
  name: string
  logoUrl: string | null
  usdToThb: number
  eurToThb: number
  sgdToThb: number
  vat: number
  defaultMultiplier: number
  platformMarkupPct: number
  isActive: boolean
}

export interface SrpProduct {
  id: string
  brandId: string
  name: string
  category: string
  sku: string
  imageUrl: string
  fobUsd: number
  fobEur: number
  freightDo: number
  importTaxPct: number
  shippingCost: number
  srpUsd: number
  srpEur: number
  srpSgd: number
  multiplier: number
  ourPriceThb: number
  platformPriceThb: number
  /** % บวกจากราคาขายจริง → ราคาแนะนำบน marketplace · 0 = ใช้ของแบรนด์ */
  platformMarkupPct: number
  notes: string
  sortOrder: number
  isActive: boolean
  lastEditedBy: string
  lastEditedAt: string | null
}

export interface CalculatedProduct extends SrpProduct {
  fobThb: number
  totalImportCost: number
  srpThb: number
  rawPrice: number
  suggestedPrice: number
  /** ราคาแนะนำบน marketplace = ราคาขายจริง × (1 + %บวก) ปัดเลขสวย */
  platformSuggested: number
  /** ราคาที่ marketplace ใช้จริง = platform_price ถ้ากรอก ไม่งั้นราคาแนะนำ platform */
  platformEffective: number
  /** ราคาขายที่ใช้จริง = our_price ถ้ากรอก ไม่งั้นราคาแนะนำ */
  effectivePrice: number
  marginPct: number
  marginThb: number
}

/**
 * ประเภทช่องทางขาย (เจ้าของแยกเป็น 3 เมื่อ 28 ส.ค. 69)
 *   retail       ร้านเรา/ดรอปชิป — หัก GP อย่างเดียว · ใช้ราคาขายจริง
 *   department   ห้าง — หัก GP+PC+DC · ใช้ราคาขายจริง
 *   marketplace  แพลตฟอร์ม — หัก commission/ค่าธรรมเนียม/ค่าส่ง · ใช้ราคา platform
 */
export type ChannelType = 'retail' | 'department' | 'marketplace'

export interface SrpChannel {
  id: string
  brandId: string
  type: ChannelType
  name: string
  sortOrder: number
  gpPct: number
  pcPct: number
  dcPct: number
  commissionPct: number
  transactionFeePct: number
  serviceFeePct: number
  shippingThb: number
  promoPct: number
}

export interface ChannelProfit {
  channelName: string
  channelType: ChannelType
  sellingPrice: number
  totalFeesPct: number
  feesThb: number
  ourProfitThb: number
  ourProfitPct: number
}

export function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0
  return Math.round(((price - cost) / price) * 10000) / 100
}

/** ปัดราคาเป็นเลขสวยตามช่วง: 79→79 · 312→349 · 1,540→1,590 · 12,300→12,900 */
export function roundToNicePrice(raw: number): number {
  if (raw <= 0) return 0
  if (raw >= 10000) return Math.round((raw - 900) / 1000) * 1000 + 900
  if (raw >= 1000) return Math.round((raw - 90) / 100) * 100 + 90
  if (raw >= 100) return Math.ceil((raw - 19) / 50) * 50 - 1
  if (raw >= 10) return Math.round((raw - 9) / 10) * 10 + 9
  return Math.round(raw)
}

export function calculateProduct(product: SrpProduct, brand: SrpBrand): CalculatedProduct {
  const usdToThb = brand.usdToThb || 37
  const eurToThb = brand.eurToThb || 39
  const sgdToThb = brand.sgdToThb || 27

  // FOB เป็นบาท — ใช้สกุลที่กรอกมา (USD มาก่อน)
  const fobFromUsd = (product.fobUsd || 0) * usdToThb
  const fobFromEur = (product.fobEur || 0) * eurToThb
  const fobThb = fobFromUsd || fobFromEur

  // ต้นทุนนำเข้ารวม = (FOB + ค่าเรือ/D.O.) × (1 + ภาษีนำเข้า%) + ค่าส่งในประเทศ
  const totalImportCost =
    (fobThb + (product.freightDo || 0)) * (1 + (product.importTaxPct || 0) / 100) +
    (product.shippingCost || 0)

  // ราคาแนะนำจากแบรนด์ แปลงเป็นบาท (อ้างอิงเฉย ๆ ไม่เข้าสูตรต้นทุน)
  // แบรนด์ให้มาสกุลเดียว แล้วแต่ใคร — บางเจ้าไม่ให้เลย · USD > EUR > SGD
  const srpFromUsd = (product.srpUsd || 0) * usdToThb
  const srpFromEur = (product.srpEur || 0) * eurToThb
  const srpFromSgd = (product.srpSgd || 0) * sgdToThb
  const srpThb = srpFromUsd || srpFromEur || srpFromSgd

  const multiplier = product.multiplier || brand.defaultMultiplier || 3
  const rawPrice = totalImportCost * multiplier
  const suggestedPrice = roundToNicePrice(rawPrice)

  const effectivePrice = product.ourPriceThb || suggestedPrice
  const marginThb = effectivePrice - totalImportCost

  // ราคาบน marketplace — บวก % จากราคาขายจริง (รายสินค้าชนะค่าของแบรนด์)
  const markup = product.platformMarkupPct || brand.platformMarkupPct || 0
  const platformSuggested = markup > 0 ? roundToNicePrice(effectivePrice * (1 + markup / 100)) : 0
  const platformEffective = product.platformPriceThb || platformSuggested

  return {
    ...product,
    fobThb: Math.round(fobThb * 100) / 100,
    totalImportCost: Math.round(totalImportCost * 100) / 100,
    srpThb: Math.round(srpThb * 100) / 100,
    rawPrice: Math.round(rawPrice),
    suggestedPrice,
    platformSuggested,
    platformEffective,
    effectivePrice,
    marginPct: marginPct(effectivePrice, totalImportCost),
    marginThb: Math.round(marginThb * 100) / 100,
  }
}

/** กำไรสุทธิต่อช่องทาง — ห้างหัก GP/PC/DC · ออนไลน์หัก commission/ค่าธรรมเนียม/ค่าส่ง */
export function calculateChannelProfit(
  price: number,
  totalImportCost: number,
  channel: SrpChannel
): ChannelProfit {
  const sellingPrice = price * (1 - (channel.promoPct || 0) / 100)

  // retail หัก GP อย่างเดียว (เจ้าของยืนยัน 28 ส.ค. 69 ว่าไม่มี PC/DC)
  const totalFeesPct =
    channel.type === 'marketplace'
      ? (channel.commissionPct || 0) + (channel.transactionFeePct || 0) + (channel.serviceFeePct || 0)
      : channel.type === 'retail'
        ? channel.gpPct || 0
        : (channel.gpPct || 0) + (channel.pcPct || 0) + (channel.dcPct || 0)

  const feesThb = (sellingPrice * totalFeesPct) / 100
  const shipping = channel.type === 'marketplace' ? channel.shippingThb || 0 : 0
  const ourProfitThb = sellingPrice - feesThb - shipping - totalImportCost
  const ourProfitPct = sellingPrice > 0 ? (ourProfitThb / sellingPrice) * 100 : 0

  return {
    channelName: channel.name,
    channelType: channel.type,
    sellingPrice: Math.round(sellingPrice),
    totalFeesPct: Math.round(totalFeesPct * 100) / 100,
    feesThb: Math.round(feesThb),
    ourProfitThb: Math.round(ourProfitThb),
    ourProfitPct: Math.round(ourProfitPct * 100) / 100,
  }
}
