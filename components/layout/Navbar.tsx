// components/layout/Navbar.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { ChevronDown, LogOut, User, Menu } from 'lucide-react'
import type { UserData } from '@/hooks/useAuth'

interface NavbarProps {
  onMenuClick: () => void
  userData?: UserData | null
}

export default function Navbar({ onMenuClick, userData }: NavbarProps) {
  const router = useRouter()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Role display in Thai
  const getRoleDisplay = (role?: string) => {
    switch (role) {
      case 'admin': return 'ผู้ดูแลระบบ'
      case 'hr': return 'ฝ่ายบุคคล'
      case 'manager': return 'ผู้จัดการ'
      case 'employee': return 'พนักงาน'
      default: return 'พนักงาน'
    }
  }

  return (
    <div className="h-16 bg-white shadow-sm border-b border-gray-100">
      <div className="h-full px-4 lg:px-8 flex items-center justify-between">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden lg:block"></div>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            {/* Profile Picture */}
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {userData?.linePictureUrl ? (
                <img 
                  src={userData.linePictureUrl} 
                  alt={userData.lineDisplayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-gray-600" />
              )}
            </div>
            
            {/* User Info */}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium">{userData?.lineDisplayName || 'Loading...'}</p>
              <p className="text-xs text-gray-500">{getRoleDisplay(userData?.role)}</p>
            </div>
            
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{userData?.fullName}</p>
                <p className="text-xs text-gray-500">{userData?.phone}</p>
              </div>
              
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}