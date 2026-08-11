// อ่านจำนวนเงินเป็นคำไทย — ใช้ในเอกสารทางการ (สัญญาจ้าง/ใบรับรองเงินเดือน)
// 45000 → "สี่หมื่นห้าพันบาทถ้วน"

const DIGIT = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const PLACE = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

/** อ่านก้อนต่ำกว่าล้าน (1–999,999) ตามหลักอ่านเลขไทย: สิบ/ยี่สิบ/เอ็ด */
function readBelowMillion(n: number): string {
  const s = String(n)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i])
    const place = s.length - i - 1
    if (!d) continue
    if (place === 1 && d === 1) out += 'สิบ'
    else if (place === 1 && d === 2) out += 'ยี่สิบ'
    else if (place === 0 && d === 1 && s.length > 1) out += 'เอ็ด'
    else out += DIGIT[d] + PLACE[place]
  }
  return out
}

/** จำนวนเต็มบาท → คำอ่าน — เศษสตางค์ปัดทิ้ง (เอกสารเงินเดือนใช้จำนวนเต็ม) */
export function thaiBahtText(amount: number): string {
  const n = Math.round(Math.abs(amount))
  if (!n) return 'ศูนย์บาทถ้วน'

  const groups: number[] = [] // แบ่งทีละล้าน — "ล้านล้าน" ก็อ่านถูก
  let rest = n
  while (rest > 0) {
    groups.unshift(rest % 1_000_000)
    rest = Math.floor(rest / 1_000_000)
  }

  let out = ''
  groups.forEach((g, i) => {
    if (g) out += readBelowMillion(g)
    if (i < groups.length - 1) out += 'ล้าน'
  })
  return out + 'บาทถ้วน'
}
