'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">เกิดข้อผิดพลาด</h2>
        <p className="text-gray-600 mb-4">ขออภัย เกิดข้อผิดพลาดในระบบ</p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          ลองใหม่
        </button>
      </div>
    </div>
  )
}