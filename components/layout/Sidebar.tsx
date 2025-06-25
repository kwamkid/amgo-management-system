// components/layout/Sidebar.tsx

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Calendar, 
  FileText, 
  Settings,
  Clock,
  Building,
  UserCog,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Shield,
  Bell
} from 'lucide-react'
import { User } from '@/types/user'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[]
  subItems?: NavItem[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />
  },
  {
    label: 'เช็คอิน/เอาท์',
    href: '/checkin',
    icon: <Clock className="w-5 h-5" />
  },
  {
    label: 'พนักงาน',
    href: '/employees',
    icon: <Users className="w-5 h-5" />,
    roles: ['hr', 'admin', 'manager']
  },
  {
    label: 'การลา',
    href: '/leaves',
    icon: <Calendar className="w-5 h-5" />
  },
  {
    label: 'รายงาน',
    href: '/reports',
    icon: <FileText className="w-5 h-5" />,
    roles: ['hr', 'admin', 'manager']
  },
  {
    label: 'ตั้งค่า',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
    roles: ['hr', 'admin'],
    subItems: [
      {
        label: 'สถานที่ทำงาน',
        href: '/settings/locations',
        icon: <MapPin className="w-4 h-4" />
      },
      {
        label: 'วันหยุด',
        href: '/settings/holidays',
        icon: <Calendar className="w-4 h-4" />
      },
      {
        label: 'ประเภทการลา',
        href: '/settings/leave-types',
        icon: <FileText className="w-4 h-4" />
      },
      {
        label: 'การแจ้งเตือน',
        href: '/settings/notifications',
        icon: <Bell className="w-4 h-4" />
      },
      {
        label: 'ความปลอดภัย',
        href: '/settings/security',
        icon: <Shield className="w-4 h-4" />,
        roles: ['admin']
      }
    ]
  }
]

interface SidebarProps {
  userData?: User | null
}

export default function Sidebar({ userData }: SidebarProps) {
  const pathname = usePathname()
  
  // เปิด submenu เฉพาะเมื่อมี active item
  const getInitialExpanded = () => {
    if (pathname.startsWith('/settings/')) {
      return ['ตั้งค่า']
    }
    return []
  }
  
  const [expandedItems, setExpandedItems] = useState<string[]>(getInitialExpanded())
  
  const userRole = userData?.role || 'employee'
  
  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(userRole)
  })

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    )
  }

  const renderNavItem = (item: NavItem, isSubItem = false) => {
    const hasSubItems = item.subItems && item.subItems.length > 0
    const isExpanded = expandedItems.includes(item.label)
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    
    // Filter subitems based on role
    const filteredSubItems = item.subItems?.filter(subItem => {
      if (!subItem.roles) return true
      return subItem.roles.includes(userRole)
    })

    return (
      <div key={item.href}>
        {hasSubItems ? (
          <>
            <button
              onClick={() => toggleExpanded(item.label)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive || pathname.startsWith('/settings/')
                  ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 text-red-600 dark:text-red-400 font-medium'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </div>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {isExpanded && filteredSubItems && (
              <div className="mt-1 ml-4 space-y-1">
                {filteredSubItems.map(subItem => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      pathname === subItem.href || pathname.startsWith(`${subItem.href}/`)
                        ? 'bg-red-50 text-red-600 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {subItem.icon}
                    <span className="text-base">{subItem.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <Link
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive
                ? isSubItem
                  ? 'bg-red-50 text-red-600 font-medium'
                  : 'bg-gradient-to-r from-red-500/10 to-orange-500/10 text-red-600 dark:text-red-400 font-medium'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {item.icon}
            <span className="text-base">{item.label}</span>
          </Link>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
        <Link href="/dashboard">
          <img 
            src="/logo.svg" 
            alt="AMGO Logo" 
            className="h-10 w-auto"
          />
        </Link>
      </div>

      <nav className="p-4 space-y-1">
        {filteredNavItems.map(item => renderNavItem(item))}
      </nav>
    </aside>
  )
}