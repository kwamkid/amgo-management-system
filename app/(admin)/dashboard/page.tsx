// app/(admin)/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Users, Clock, Calendar, FileText, TrendingUp, AlertCircle } from 'lucide-react'

interface DashboardStats {
  totalEmployees: number
  checkedInToday: number
  onLeaveToday: number
  pendingRequests: number
}

export default function DashboardPage() {
  const { userData } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    checkedInToday: 0,
    onLeaveToday: 0,
    pendingRequests: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Get total employees
      const usersQuery = query(collection(db, 'users'), where('isActive', '==', true))
      const usersSnapshot = await getDocs(usersQuery)
      
      // Get today's date range
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // For now, set mock data (will implement real queries later)
      setStats({
        totalEmployees: usersSnapshot.size,
        checkedInToday: 0,
        onLeaveToday: 0,
        pendingRequests: 0
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'พนักงานทั้งหมด',
      value: stats.totalEmployees,
      subtitle: 'Active users',
      icon: Users,
      bgGradient: 'from-blue-400 to-cyan-400',
      iconBg: 'bg-blue-500/20',
      textColor: 'text-blue-700'
    },
    {
      title: 'เช็คอินวันนี้',
      value: stats.checkedInToday,
      subtitle: `${stats.totalEmployees > 0 ? Math.round((stats.checkedInToday / stats.totalEmployees) * 100) : 0}% ของพนักงาน`,
      icon: Clock,
      bgGradient: 'from-emerald-400 to-green-400',
      iconBg: 'bg-emerald-500/20',
      textColor: 'text-emerald-700'
    },
    {
      title: 'ลาวันนี้',
      value: stats.onLeaveToday,
      subtitle: stats.onLeaveToday === 0 ? 'ไม่มีการลา' : `${stats.onLeaveToday} คน`,
      icon: Calendar,
      bgGradient: 'from-amber-400 to-orange-400',
      iconBg: 'bg-amber-500/20',
      textColor: 'text-amber-700'
    },
    {
      title: 'รอการอนุมัติ',
      value: stats.pendingRequests,
      subtitle: 'Pending requests',
      icon: FileText,
      bgGradient: 'from-purple-400 to-pink-400',
      iconBg: 'bg-purple-500/20',
      textColor: 'text-purple-700'
    }
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ด</h1>
        <p className="text-gray-600 mt-1">
          สวัสดี, {userData?.lineDisplayName}! 👋
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <div key={index} className="relative overflow-hidden bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
              
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${card.iconBg}`}>
                    <Icon className={`w-6 h-6 ${card.textColor}`} />
                  </div>
                  {index === 0 && (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  )}
                </div>
                
                <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
                <p className={`text-3xl font-bold mt-2 bg-gradient-to-r ${card.bgGradient} bg-clip-text text-transparent`}>
                  {loading ? '-' : card.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Check-ins */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">การเช็คอินล่าสุด</h2>
            <span className="text-xs text-gray-500">วันนี้</span>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : stats.checkedInToday === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-10 h-10 text-blue-500" />
              </div>
              <p className="text-gray-500">ยังไม่มีข้อมูลการเช็คอิน</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Check-in list will go here */}
            </div>
          )}
        </div>

        {/* Leave Requests */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">คำขอลาล่าสุด</h2>
            <span className="text-xs text-gray-500">รอดำเนินการ</span>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : stats.pendingRequests === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-purple-500" />
              </div>
              <p className="text-gray-500">ไม่มีคำขอลา</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Leave request list will go here */}
            </div>
          )}
        </div>
      </div>

      {/* Admin Quick Actions */}
      {userData?.role === 'admin' && (
        <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
          <div className="flex items-start">
            <div className="p-3 bg-white rounded-xl shadow-sm mr-4">
              <AlertCircle className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-800">คุณคือ Super Admin</h3>
              <p className="text-purple-700 mt-1 text-sm">
                คุณมีสิทธิ์เข้าถึงทุกฟังก์ชันของระบบ สามารถจัดการพนักงาน, ตั้งค่าระบบ, และดูรายงานทั้งหมดได้
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">
                  เริ่มสร้าง Invite Link
                </button>
                <button className="px-4 py-2 bg-white text-purple-600 border border-purple-300 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors">
                  ตั้งค่าสถานที่ทำงาน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}