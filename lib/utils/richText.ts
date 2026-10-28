// lib/utils/richText.ts
//
// ข้อความแบบมีรูปแบบนิดหน่อย (ตัวหนา · ขีดเส้นใต้ · ตัวเอียง · bullet · ลำดับเลข) — เก็บเป็น HTML
// ใช้กับ <RichTextEditor> / <RichText> (components/aoo) · ไม่มี dependency (ทดสอบด้วย node ได้)
//
// ปลอดภัยไว้ก่อน: ทุกครั้งที่บันทึกและที่แสดงผลผ่าน sanitizeRichText — เหลือแค่แท็กในรายการ
// และตัด attribute ทิ้งหมด (กัน onclick= / style= / javascript: ที่แปะมาจากเว็บอื่น)
// ข้อความเก่าที่เป็นตัวหนังสือล้วน (ก่อนมีตัวแก้ไข หรือบอทเขียนมา) แสดงได้เลย — ขึ้นบรรทัดตาม \n

const ALLOWED = new Set(['b', 'strong', 'u', 'i', 'em', 'ul', 'ol', 'li', 'br', 'p', 'div'])

const looksLikeHtml = (s: string) => /<\/?(b|strong|u|i|em|ul|ol|li|br|p|div)\b[^>]*>/i.test(s)

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * ตัดทุกอย่างที่ไม่อยู่ในรายการ — ใช้ regex (ไม่ใช่ DOMParser) เพื่อให้รันได้ทั้ง server/เบราว์เซอร์/node
 * แท็กที่ไม่อนุญาตถูกถอดออกแต่เก็บตัวหนังสือข้างในไว้ · script/style ทิ้งทั้งก้อน
 */
export function sanitizeRichText(input: string | null | undefined): string {
  const s = (input ?? '').trim()
  if (!s) return ''
  if (!looksLikeHtml(s)) return escapeHtml(s).replace(/\r?\n/g, '<br>')
  return s
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name: string) => {
      const n = name.toLowerCase()
      if (!ALLOWED.has(n)) return ''
      if (n === 'br') return '<br>'
      return tag.startsWith('</') ? `</${n}>` : `<${n}>`
    })
}

/** HTML → ตัวหนังสือล้วน (บอท · แจ้งเตือน · ค้นหา) — bullet กลายเป็น "• " */
export function richTextToPlain(input: string | null | undefined): string {
  const s = input ?? ''
  if (!looksLikeHtml(s)) return s.trim()
  return s
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** ว่างจริงไหม (ตัวแก้ไขชอบทิ้ง <br> / <div></div> ไว้ตอนลบหมด) */
export const isRichTextEmpty = (input: string | null | undefined) => !richTextToPlain(input).trim()
