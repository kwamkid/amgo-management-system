// "หน้าจอจำลอง" สำหรับหน้าวิธีติดตั้งแอป — วาดด้วย CSS ให้เหมือนสิ่งที่พนักงานจะเห็นบน
// เครื่องจริง แล้ววงส้มตรงที่ต้องกด · ไม่ใช่ภาพหน้าจอจริง (เปลี่ยนภาษา/รุ่นก็ยังใกล้เคียง)
import Image from 'next/image'
import { ShareIosIcon, AddToHomeIcon, KebabIcon } from './GuideIcons'

/** วงส้มรอบสิ่งที่ต้องกด */
function Tap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center rounded-lg ring-[3px] ring-orange-500 ring-offset-2 ring-offset-white ${className}`}>
      {children}
    </span>
  )
}

/** แถบล่างของ Safari — ปุ่มแชร์ตรงกลาง */
export function SafariBottomBarMock() {
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="mx-3 mt-2 flex h-9 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-600">
        app.amgovenger.com
      </div>
      <div className="flex items-center justify-around px-2 py-3 text-gray-400">
        <span className="text-2xl leading-none">‹</span>
        <span className="text-2xl leading-none">›</span>
        <Tap className="p-1">
          <ShareIosIcon size={26} />
        </Tap>
        <span className="text-xl leading-none">▢</span>
        <span className="text-xl leading-none">⧉</span>
      </div>
    </div>
  )
}

/** เมนูแชร์ของ iOS — เลื่อนลงจะเจอ "เพิ่มไปยังหน้าจอโฮม" */
export function IosShareSheetMock() {
  const rows: [string, React.ReactNode, boolean][] = [
    ['คัดลอก', <span key="c" className="text-gray-400">⧉</span>, false],
    ['เพิ่มในรายการอ่าน', <span key="r" className="text-gray-400">👓</span>, false],
    ['เพิ่มไปยังหน้าจอโฮม', <AddToHomeIcon key="h" size={22} />, true],
    ['ค้นหาในหน้า', <span key="f" className="text-gray-400">🔍</span>, false],
  ]
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <Image src="/icons/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">AMGO Management System</p>
          <p className="truncate text-xs text-gray-500">app.amgovenger.com</p>
        </div>
      </div>
      <div className="mx-2 mb-2 overflow-hidden rounded-lg bg-white">
        {rows.map(([label, icon, hot]) => (
          <div
            key={label}
            className={`flex items-center justify-between px-3 py-2.5 text-base ${hot ? 'bg-orange-50 font-semibold text-gray-900' : 'text-gray-700'} border-b border-gray-100 last:border-b-0`}
          >
            <span>{label}</span>
            {hot ? <Tap className="p-0.5">{icon}</Tap> : icon}
          </div>
        ))}
      </div>
      <p className="pb-2 text-center text-xs text-gray-500">↓ เลื่อนลงมาจนเจอ</p>
    </div>
  )
}

/** หัวหน้าต่าง "หน้าจอโฮม" ของ iOS — ปุ่ม "เพิ่ม" มุมขวาบน */
export function IosAddBarMock() {
  return (
    <div className="mx-auto flex w-full max-w-xs items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <span className="text-base text-[#007aff]">ยกเลิก</span>
      <span className="text-base font-semibold text-gray-900">หน้าจอโฮม</span>
      <Tap className="px-1.5">
        <span className="text-base font-semibold text-[#007aff]">เพิ่ม</span>
      </Tap>
    </div>
  )
}

/** หน้าจอโฮมที่มีไอคอน AMGO */
export function HomeScreenMock() {
  const dummy = ['bg-gray-300', 'bg-gray-300', 'bg-gray-300']
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-gray-200 bg-gradient-to-b from-sky-100 to-indigo-100 px-4 py-3 shadow-sm">
      <div className="grid grid-cols-4 gap-3">
        {dummy.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`h-12 w-12 rounded-[22%] ${c}`} />
            <div className="h-2 w-8 rounded bg-gray-300/70" />
          </div>
        ))}
        <div className="flex flex-col items-center gap-1">
          <Tap className="rounded-[22%]">
            <Image src="/icons/icon-192.png" alt="ไอคอน AMGO" width={48} height={48} className="h-12 w-12 rounded-[22%]" />
          </Tap>
          <span className="text-xs font-medium text-gray-800">AMGO</span>
        </div>
      </div>
    </div>
  )
}

/** แถบบนของ Chrome (Android) — ปุ่ม ⋮ มุมขวา */
export function ChromeTopBarMock() {
  return (
    <div className="mx-auto flex w-full max-w-xs items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex h-9 flex-1 items-center rounded-full bg-gray-100 px-3 text-sm text-gray-600">
        🔒 app.amgovenger.com
      </div>
      <Tap className="p-0.5">
        <KebabIcon size={24} />
      </Tap>
    </div>
  )
}

/** เมนู ⋮ ของ Chrome — "ติดตั้งแอป" / "เพิ่มไปยังหน้าจอหลัก" */
export function ChromeMenuMock() {
  const rows: [string, boolean][] = [
    ['แท็บใหม่', false],
    ['บุ๊กมาร์ก', false],
    ['ติดตั้งแอป', true],
    ['เพิ่มไปยังหน้าจอหลัก', true],
    ['การตั้งค่า', false],
  ]
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {rows.map(([label, hot]) => (
        <div
          key={label}
          className={`border-b border-gray-100 px-4 py-2.5 text-base last:border-b-0 ${hot ? 'bg-orange-50 font-semibold text-gray-900' : 'text-gray-700'}`}
        >
          {hot ? <Tap className="px-1.5">{label}</Tap> : label}
        </div>
      ))}
      <p className="py-1.5 text-center text-xs text-gray-500">เจออันไหนก็กดอันนั้น (แล้วแต่รุ่น Chrome)</p>
    </div>
  )
}

/** กล่องยืนยันติดตั้งของ Android */
export function AndroidInstallDialogMock() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
        <div>
          <p className="text-base font-semibold text-gray-900">ติดตั้งแอป</p>
          <p className="text-xs text-gray-500">AMGO · app.amgovenger.com</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-4 text-base">
        <span className="text-gray-500">ยกเลิก</span>
        <Tap className="px-2">
          <span className="font-semibold text-[#1a73e8]">ติดตั้ง</span>
        </Tap>
      </div>
    </div>
  )
}
