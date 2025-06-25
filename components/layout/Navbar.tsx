
// components/layout/Navbar.tsx

'use client'

import { useState } from 'react'
import { UserData } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import MobileMenuButton from './MobileMenuButton'

interface NavbarProps {
  userData?: UserData | null
  onMenuClick?: () => void
  sidebarOpen?: boolean
}

export default function Navbar({ userData, onMenuClick, sidebarOpen = false }: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const getRoleDisplay = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'ผู้ดูแลระบบ'
      case 'hr':
        return 'ฝ่ายบุคคล'
      case 'manager':
        return 'ผู้จัดการ'
      default:
        return 'พนักงาน'
    }
  }

  return (
    <nav className="h-16 bg-white border-b border-gray-200 px-4 lg:px-8">
      <div className="h-full flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          {onMenuClick && (
            <MobileMenuButton 
              isOpen={sidebarOpen} 
              onClick={onMenuClick} 
            />
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {userData?.linePictureUrl ? (
              <img
                src={userData.linePictureUrl}
                alt={userData.lineDisplayName || userData.fullName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-gray-600" />
              </div>
            )}
            <div className="text-right">
              <span className="text-sm font-medium text-gray-700">
                {userData?.lineDisplayName || userData?.fullName || 'User'}
              </span>
              <p className="text-xs text-gray-500">{getRoleDisplay(userData?.role)}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  ออกจากระบบ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}