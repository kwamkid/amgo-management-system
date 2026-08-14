// รหัสประจำเครื่อง — สุ่มครั้งแรกแล้วเก็บใน localStorage ของเบราว์เซอร์นั้น
//
// ใช้จับ "เอามือถือเครื่องเดียวกดเช็คอินให้หลายคน" (เจ้าของสั่ง 14 ส.ค. 69)
// ไม่ใช่ fingerprint จริงจัง — ล้าง localStorage ก็หลุด แต่พอจับพฤติกรรมซ้ำ ๆ ได้
// และคนทั่วไปไม่รู้ว่ามีตัวนี้อยู่

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = localStorage.getItem('amgo_device_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('amgo_device_id', id)
    }
    return id
  } catch {
    return null // โหมด private/บล็อก storage — ยอมไม่มี id ดีกว่าเช็คอินไม่ได้
  }
}
