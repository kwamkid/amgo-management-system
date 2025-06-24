// app/(admin)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ด</h1>
        <p className="text-gray-600 mt-1">ยินดีต้อนรับเข้าสู่ระบบ AMGO</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">พนักงานทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">1</p>
              <p className="text-xs text-gray-500 mt-1">Active users</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">เช็คอินวันนี้</p>
              <p className="text-2xl font-bold text-green-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">0% ของพนักงาน</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">ลาวันนี้</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">ไม่มีการลา</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">รอการอนุมัติ</p>
              <p className="text-2xl font-bold text-red-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">Pending requests</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">⏳</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Check-ins */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">การเช็คอินล่าสุด</h2>
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl">📊</span>
            <p className="mt-2">ยังไม่มีข้อมูลการเช็คอิน</p>
          </div>
        </div>

        {/* Leave Requests */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">คำขอลาล่าสุด</h2>
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl">📝</span>
            <p className="mt-2">ไม่มีคำขอลา</p>
          </div>
        </div>
      </div>
    </div>
  )
}