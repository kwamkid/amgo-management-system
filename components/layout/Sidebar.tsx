// components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Clock, 
  Calendar, 
  FileText, 
  Settings,
  X
} from 'lucide-react'

interface MenuItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const menuItems: MenuItem[] = [
  { 
    href: '/dashboard', 
    label: 'แดชบอร์ด', 
    icon: <LayoutDashboard className="w-5 h-5" />
  },
  { 
    href: '/checkin', 
    label: 'เช็คอิน/เอาท์', 
    icon: <Clock className="w-5 h-5" />
  },
  { 
    href: '/leave', 
    label: 'ระบบลา', 
    icon: <Calendar className="w-5 h-5" />
  },
  { 
    href: '/reports', 
    label: 'รายงาน', 
    icon: <FileText className="w-5 h-5" />
  },
  { 
    href: '/settings/users', 
    label: 'ตั้งค่า', 
    icon: <Settings className="w-5 h-5" />
  },
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Logo Section */}
        <div className="flex items-center justify-between h-16 bg-white px-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center">
            <Image 
              src="/logo.svg" 
              alt="AMGO Logo" 
              width={120} 
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-8">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    onClose()
                  }
                }}
                className={`flex items-center px-6 py-3 transition-colors ${
                  isActive 
                    ? 'bg-red-50 text-red-600 border-r-4 border-red-600' 
                    : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}