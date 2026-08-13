'use client'

// ปุ่มเลือกแบบกดสลับ (segmented) — ใช้แทน dropdown เมื่อตัวเลือกน้อย (2-3 ตัว)
// เห็นทุกตัวเลือกพร้อมกัน กดทีเดียวจบ ไม่ต้องกางเมนู
//
// <Segmented value={type} onChange={setType}
//   options={[{ value: 'monthly', label: 'รายเดือน' }, { value: 'daily', label: 'รายวัน' }]} />

export default function Segmented({
  value,
  options,
  onChange,
  disabled,
  className = '',
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button" // อยู่ในฟอร์ม — กันเผลอ submit
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors disabled:opacity-50 ${
            value === o.value
              ? 'bg-white font-medium text-gray-900 shadow-sm ring-1 ring-gray-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
