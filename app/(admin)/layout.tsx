'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useLoading } from '@/lib/contexts/LoadingContext'
import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { showLoading, hideLoading } = useLoading()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    showLoading()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true)
        hideLoading()
      } else {
        router.push('/login')
      }
    })

    return () => unsubscribe()
  }, [router, showLoading, hideLoading])

  if (!isAuthenticated) {
    return null
  }

  const menuItems = [
    { href: '/dashboard', label: 'แดชบอร์ด', icon: '📊' },
    { href: '/checkin', label: 'เช็คอิน/เอาท์', icon: '✅' },
    { href: '/leave', label: 'ระบบลา', icon: '📅' },
    { href: '/reports', label: 'รายงาน', icon: '📈' },
    { href: '/settings/users', label: 'ตั้งค่า', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
        <div className="flex items-center justify-center h-16 bg-gradient-to-r from-red-500 to-red-600">
          <span className="text-2xl font-bold text-white">AMGO</span>
        </div>
        
        <nav className="mt-8">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-6 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors ${
                pathname === item.href ? 'bg-red-50 text-red-600 border-r-4 border-red-600' : ''
              }`}
            >
              <span className="mr-3 text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="ml-64">
        {children}
      </main>
    </div>
  )
}