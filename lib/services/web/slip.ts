// lib/services/web/slip.ts
//
// อ่าน QR จากรูปสลิปโอนเงิน — ยกมาจากระบบเดิม aoo-student-website
//
// ใช้แค่ดึง "เลขอ้างอิงธุรกรรม" มากันสลิปซ้ำ ไม่ได้ตัดสินยอด/ผู้รับ
// (เจ้าของกดอนุมัติเองอยู่แล้ว — ไม่ต้องเสียค่า API ตรวจสลิป)
// แยกเป็นฟังก์ชันเดียวเผื่ออนาคตจะต่อ EasySlip/SlipOK ให้ตรวจยอดอัตโนมัติ

import sharp from 'sharp'
import jsQR from 'jsqr'

export interface SlipReadResult {
  qrRaw: string | null
  transRef: string | null
  readable: boolean
}

export async function readSlip(imageBuffer: Buffer): Promise<SlipReadResult> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const code = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
      info.width,
      info.height
    )
    if (!code?.data) return { qrRaw: null, transRef: null, readable: false }

    return { qrRaw: code.data, transRef: extractTransRef(code.data), readable: true }
  } catch {
    return { qrRaw: null, transRef: null, readable: false }
  }
}

/**
 * ดึงเลขอ้างอิงจาก payload QR (EMVCo TLV: id 2 หลัก + ความยาว 2 หลัก + ค่า)
 * parse ไม่ได้ก็ใช้ payload ทั้งก้อนเป็นกุญแจกันซ้ำ — ยังกันอัพรูปเดิมซ้ำได้อยู่
 */
export function extractTransRef(qrRaw: string): string | null {
  if (!qrRaw) return null

  const fields = parseEmvco(qrRaw)
  if (fields.length) {
    const candidate = fields
      .map((f) => f.value)
      .filter((v) => /^[A-Za-z0-9]{8,}$/.test(v))
      .sort((a, b) => b.length - a.length)[0]
    if (candidate) return candidate
  }
  return qrRaw.trim()
}

function parseEmvco(payload: string): { id: string; value: string }[] {
  const fields: { id: string; value: string }[] = []
  let i = 0
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2)
    const len = parseInt(payload.slice(i + 2, i + 4), 10)
    if (Number.isNaN(len)) break
    const value = payload.slice(i + 4, i + 4 + len)
    if (value.length < len) break
    fields.push({ id, value })
    i += 4 + len
  }
  return fields
}
