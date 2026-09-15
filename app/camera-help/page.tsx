import { chromeCheckinIntent } from '@/lib/camera/recovery'

export default function CameraHelpPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">ช่วยเปิดกล้องเช็คอิน</h1>
        <p>สำหรับ Android: เปิดหน้าเช็คอินใน Chrome แล้วอนุญาตให้ใช้กล้อง</p>
        <a
          href={chromeCheckinIntent('https://app.amgovenger.com')}
          className="flex min-h-12 items-center justify-center rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white"
        >
          เปิดหน้าเช็คอินใน Chrome (Android)
        </a>
        <p className="text-sm text-gray-600">หากปุ่มไม่เปิด Chrome ให้เปิดแอป Chrome เอง แล้วพิมพ์ <span className="select-all break-all">app.amgovenger.com/checkin</span></p>
        <section className="space-y-3 border-t pt-4">
          <h2 className="text-lg font-semibold">1. อนุญาตกล้องให้ Chrome</h2>
          <p>การตั้งค่ามือถือ → แอป → Chrome → สิทธิ์ → กล้อง → อนุญาตขณะใช้แอป</p>
          <p className="text-sm text-gray-600">ถ้าเครื่องมีสวิตช์ “การเข้าถึงกล้อง” ให้เปิดด้วย หากใช้เบราว์เซอร์อื่น ให้ตรวจสิทธิ์ของแอปนั้นแทน</p>
        </section>
        <section className="space-y-3 border-t pt-4">
          <h2 className="text-lg font-semibold">2. อนุญาตกล้องให้เว็บไซต์</h2>
          <p>ใน Chrome → ⋮ → การตั้งค่า → การตั้งค่าเว็บไซต์ → กล้อง</p>
          <p>เปิดให้เว็บไซต์ขอใช้กล้องได้ หากพบ app.amgovenger.com ในรายการที่บล็อก ให้เลือกแล้วกดอนุญาต</p>
        </section>
        <section className="space-y-3 border-t pt-4">
          <h2 className="text-lg font-semibold">3. กลับมาถ่ายรูป</h2>
          <p>เปิดหน้าเช็คอิน แล้วกดถ่ายรูปอีกครั้ง หากมีคำขอใช้กล้อง ให้กดอนุญาต</p>
          <p className="text-sm text-gray-600">หากยังไม่ได้ ให้ปิดแอปอื่นที่ใช้กล้องก่อน แล้วลองใหม่ ชื่อเมนูอาจต่างกันตามเครื่อง</p>
        </section>
        <a className="block py-2 font-semibold text-teal-800 underline" href="/checkin">กลับหน้าเช็คอิน</a>
        <a className="block text-sm text-gray-600 underline" href="https://support.google.com/chrome/answer/2693767?co=GENIE.Platform%3DAndroid&hl=th" target="_blank" rel="noopener noreferrer">วิธีตั้งค่ากล้องจาก Google</a>
      </div>
    </main>
  )
}
