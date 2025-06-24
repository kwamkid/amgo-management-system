'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useRouter } from 'next/navigation'

interface UserData {
  fullName: string
  role: string
  lineDisplayName: string
  linePictureUrl: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData)
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
        }
        setLoading(false)
      } else {
        router.push('/login')
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ด</h1>
          <p className="text-gray-600 mt-1">ยินดีต้อนรับกลับ, {userData?.lineDisplayName}!</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* User Info */}
          <div className="flex items-center space-x-3">
            {userData?.linePictureUrl && (
              <img
                src={userData.linePictureUrl}
                alt="Profile"
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="text-sm">
              <p className="font-medium text-gray-900">{userData?.lineDisplayName}</p>
              <p className="text-gray-500 capitalize">{userData?.role}</p>
            </div>
          </div>
          
          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            ออกจากระบบ
          </button>
        </div>
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

      {/* Admin Notice */}
      {userData?.role === 'admin' && (
        <div className="mt-8 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
          <div className="flex items-start">
            <span className="text-2xl mr-3">👑</span>
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">คุณคือ Super Admin</h3>
              <p className="text-red-700 mt-1">คุณมีสิทธิ์เข้าถึงทุกฟังก์ชันของระบบ สามารถจัดการพนักงาน, ตั้งค่าระบบ, และดูรายงานทั้งหมดได้</p>
              <div className="mt-3 flex space-x-3">
                <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                  → เริ่มสร้าง Invite Link
                </button>
                <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                  → ตั้งค่าสถานที่ทำงาน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}