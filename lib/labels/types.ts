// ฉลาก สคบ. — ชนิดข้อมูลที่ใช้ร่วมกันระหว่างหน้าเว็บ · API · ตัววาด PDF

/** one printed sticker — every field already resolved (brand → group → product cascade done) */
export interface LabelData {
  code: string
  header: string
  /** ชื่อ/ประเภทสินค้าภาษาไทย (optional — สคบ. asks for the product kind) */
  typeTh: string
  warning: string
  age: string
  usage: string
  manufacturer: string
  country: string
  /** "10/2026" */
  importMonth: string
  importer: string
  address: string
  contact: string
  price: number | null
  tisText: string
  tisLicense: string
  showLicense: boolean
  /** red 'not for 0-3 years' pictogram (owner's sample 760020) */
  icon03: boolean
  qrUrl: string
  /** mm */
  w: number
  h: number
}

/** sizes offered in the UI; anything "WxH" in mm is accepted */
export const LABEL_SIZES = ['50x50', '40x40', '50x30'] as const

export const parseSize = (s: string | null | undefined): { w: number; h: number } => {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec((s ?? '').trim())
  const w = m ? +m[1] : 50
  const h = m ? +m[2] : 50
  return { w: Math.min(Math.max(w, 20), 150), h: Math.min(Math.max(h, 20), 150) }
}

export const sizeKey = (w: number, h: number) => `${w}x${h}`

/** layout result — what the review page warns about */
export interface LabelFit {
  /** body text size actually used, pt */
  bodyPt: number
  /** text did not fit even at the smallest size */
  overflow: boolean
  /** QR module size, mm (< 0.25 mm scans badly) */
  qrModule: number
}

/** body text below this is hard to read → warn on the review page */
export const MIN_READABLE_PT = 4.5
export const MIN_QR_MODULE_MM = 0.25

/** product types on AGD's TIS licence น34375-5969/685 (appdb.tisi.go.th, read 30 Oct 2026) */
export const TIS_TYPES: Record<number, string> = {
  1: 'ไม้ และ สิ่งทอ — ของเล่นยัดไส้ / ของเล่นขี่และของเล่นอยู่กับที่ที่มีที่นั่ง',
  2: 'พลาสติก — ทั่วไป',
  3: 'ไม้ และ พลาสติก — ของเล่นที่ใช้ปากเป่า / ของเล่นที่มีเสียง หรือใช้ใกล้หู',
  4: 'ไม้ พลาสติก และ สิ่งทอ — ของเล่นยัดไส้',
  5: 'ไม้ พลาสติก สิ่งทอ และ แก้ว — ลูกหิน',
  6: 'ไม้ พลาสติก และ กระดาษ — ของเล่นที่มีแม่เหล็กเป็นส่วนประกอบ',
}
