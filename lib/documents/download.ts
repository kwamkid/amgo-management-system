// สั่งดาวน์โหลดไฟล์โดยไม่พาหน้าเว็บย้ายไปไหน
//
// ── ทำไมต้องมีไฟล์นี้ ───────────────────────────────────────────────
// ของเดิมใช้ `window.location.href = url` ซึ่งนับเป็นการ "ออกจากหน้า"
// เบราว์เซอร์จึงเด้ง "Leave site? Changes you made may not be saved."
// ทั้งที่แค่จะโหลดไฟล์ (หน้าแก้เอกสารมีตัวเตือนก่อนปิดแท็บติดอยู่)
//
// สร้าง <a download> แล้วกดแทน — เบราว์เซอร์เห็นเป็นการดาวน์โหลด ไม่ใช่
// การเปลี่ยนหน้า จึงไม่ถามอะไรและหน้าเดิมยังอยู่ครบ
export function downloadFile(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  // ชื่อไฟล์จริงมาจาก Content-Disposition ฝั่งเซิร์ฟเวอร์ ตรงนี้แค่บอกว่า
  // "นี่คือการดาวน์โหลด" ไม่ได้ใช้เป็นชื่อไฟล์
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** ลิงก์แชร์เอกสาร — พก token มาด้วย เพราะ policy ไม่ได้เปิดให้พนักงาน
 *  อ่าน documents ทุกใบ (ดู migration documents_share_link) */
export const shareUrl = (id: string, token: string) =>
  `${window.location.origin}/documents/${id}/view?t=${token}`

/** คัดลอกลิงก์ลงคลิปบอร์ด — คืน true เมื่อสำเร็จ
 *
 *  navigator.clipboard ใช้ได้เฉพาะ https หรือ localhost · ที่อื่นจะ throw
 *  จึงมีทางสำรองเป็น textarea + execCommand ไว้ ไม่งั้นปุ่มจะกดแล้วเงียบ
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
