// components/layout/Navbar.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, User, Menu } from 'lucide-react'

interface NavbarProps {
  onMenuClick: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
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

  const handleSignOut = () => {
    // TODO: Add Firebase signout logic later
    router.push('/login')
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
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-gray-600" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium">User</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">User Name</p>
                <p className="text-xs text-gray-500">admin@amgo.com</p>
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