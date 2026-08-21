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
