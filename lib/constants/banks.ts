// รายชื่อธนาคารไทยสำหรับบัญชีรับเงินเดือน — โลโก้อยู่ที่ public/bank_logo (ยกมาจาก aoocommerce)
// รหัส (code) คือค่าที่เก็บใน users.bank_name — ข้อมูลเดิมใช้ 'SCB'/'KBANK' อยู่แล้ว จึงคงรูปแบบนี้
export interface ThaiBank {
  code: string
  /** รหัสธนาคาร 3 หลักของ ธปท. — ไฟล์โอนหลายรายการ (SCB) ใช้ระบุธนาคารปลายทาง */
  clearing: string
  nameTh: string
  color: string
  logo: string
}

export const THAI_BANKS: ThaiBank[] = [
  { code: 'SCB', clearing: '014', nameTh: 'ไทยพาณิชย์', color: '#4e2a82', logo: '/bank_logo/scb.svg' },
  { code: 'KBANK', clearing: '004', nameTh: 'กสิกรไทย', color: '#138f2d', logo: '/bank_logo/kbank.svg' },
  { code: 'BBL', clearing: '002', nameTh: 'กรุงเทพ', color: '#1e22aa', logo: '/bank_logo/bbl.svg' },
  { code: 'KTB', clearing: '006', nameTh: 'กรุงไทย', color: '#1ba5e1', logo: '/bank_logo/ktb.svg' },
  { code: 'TTB', clearing: '011', nameTh: 'ทหารไทยธนชาต', color: '#0f59a0', logo: '/bank_logo/tmb.svg' },
  { code: 'BAY', clearing: '025', nameTh: 'กรุงศรีอยุธยา', color: '#fec43b', logo: '/bank_logo/bay.svg' },
  { code: 'GSB', clearing: '030', nameTh: 'ออมสิน', color: '#eb198d', logo: '/bank_logo/gsb.svg' },
  { code: 'BAAC', clearing: '034', nameTh: 'ธ.ก.ส.', color: '#4b9b1d', logo: '/bank_logo/baac.svg' },
  { code: 'CIMB', clearing: '022', nameTh: 'ซีไอเอ็มบี', color: '#7b0000', logo: '/bank_logo/cimb.svg' },
  { code: 'UOB', clearing: '024', nameTh: 'ยูโอบี', color: '#0b3979', logo: '/bank_logo/uob.svg' },
  { code: 'LHBANK', clearing: '073', nameTh: 'แลนด์ แอนด์ เฮ้าส์', color: '#6d6e71', logo: '/bank_logo/lhb.svg' },
  { code: 'TISCO', clearing: '067', nameTh: 'ทิสโก้', color: '#12549f', logo: '/bank_logo/tisco.svg' },
  { code: 'KKP', clearing: '069', nameTh: 'เกียรตินาคินภัทร', color: '#199078', logo: '/bank_logo/kk.svg' },
  { code: 'ICBC', clearing: '070', nameTh: 'ไอซีบีซี', color: '#c50f1c', logo: '/bank_logo/icbc.svg' },
  { code: 'GHB', clearing: '033', nameTh: 'ธอส.', color: '#f57e20', logo: '/bank_logo/ghb.svg' },
]

export function getBank(code: string | null | undefined): ThaiBank | undefined {
  if (!code) return undefined
  const c = code.trim().toUpperCase()
  return THAI_BANKS.find((b) => b.code === c)
}
