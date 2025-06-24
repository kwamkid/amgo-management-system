'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'

interface UserData {
  fullName: string
  role: string
  lineDisplayName: string
  linePictureUrl: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<UserData | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get user data from Firestore
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
        // No user logged in
        router.push('/login')
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-red-500 border-r-transparent mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">AMGO Dashboard</h1>
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
                  <p className="text-gray-500">{userData?.role}</p>
                </div>
              </div>
              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-500"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                ยินดีต้อนรับ, {userData?.lineDisplayName}! 🎉
              </h2>
              
              {userData?.role === 'admin' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-800 font-medium">คุณคือ Super Admin</p>
                  <p className="text-sm text-red-600 mt-1">
                    คุณมีสิทธิ์เข้าถึงทุกส่วนของระบบ
                  </p>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900">พนักงานทั้งหมด</h3>
                  <p className="text-3xl font-bold text-red-600 mt-2">1</p>
                  <p className="text-sm text-gray-500 mt-1">คุณคือคนแรก!</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900">เช็คอินวันนี้</h3>
                  <p className="text-3xl font-bold text-green-600 mt-2">0</p>
                  <p className="text-sm text-gray-500 mt-1">ยังไม่มีการเช็คอิน</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900">คำขอลา</h3>
                  <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
                  <p className="text-sm text-gray-500 mt-1">ไม่มีคำขอค้างอยู่</p>
                </div>
              </div>

              {/* Coming Soon Features */}
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Features ที่กำลังพัฒนา</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">⏳</span>
                    <span className="text-gray-600">ระบบเช็คอิน/เช็คเอาท์</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">⏳</span>
                    <span className="text-gray-600">ระบบลา</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">⏳</span>
                    <span className="text-gray-600">ระบบ Invite พนักงาน</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">⏳</span>
                    <span className="text-gray-600">Discord Integration</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}