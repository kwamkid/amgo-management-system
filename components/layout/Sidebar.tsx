// components/layout/Sidebar.tsx

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  UserPlus,
  ChevronDown,
  ChevronRight,
  Shield,
  Bell,
  MessageSquare,
  TrendingUp,
  Baby,
  Trash2,
  Truck,
  Camera,
  Map,
  Home
} from 'lucide-react'
import { UserData } from '@/hooks/useAuth'

interface NavItem {
  label: string
  href?: string // Make href optional for parent items
  icon: React.ReactNode
  roles?: string[]
  subItems?: NavItem[]
}

interface SidebarProps {
  userData?: UserData | null
  onNavigate?: () => void // Add callback for navigation
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />
  },
  {
    label: 'เช็คอิน/เอาท์',
    icon: <Clock className="w-5 h-5" />,
    subItems: [
      {
        label: 'เช็คอิน/เอาท์',
        href: '/checkin',
        icon: <CheckSquare className="w-4 h-4" />
      },
      {
        label: 'ประวัติการเช็คอิน',
        href: '/checkin/history',
        icon: <Calendar className="w-4 h-4" />
      },
      {
        label: 'รอดำเนินการ',
        href: '/checkin/pending',
        icon: <Clock className="w-4 h-4" />,
        roles: ['hr', 'admin']
      }
    ]
  },
  {
    label: 'พนักงาน',
    icon: <Users className="w-5 h-5" />,
    roles: ['hr', 'admin', 'manager'],
    subItems: [
      {
        label: 'รายการพนักงาน',
        href: '/employees',
        icon: <Users className="w-4 h-4" />
      },
      {
        label: 'เชิญพนักงานใหม่',
        href: '/employees/invite-links',
        icon: <UserPlus className="w-4 h-4" />
      },
      {
        label: 'รออนุมัติ',
        href: '/employees/pending',
        icon: <Clock className="w-4 h-4" />
      }
    ]
  },
  {
    label: 'การลา',
    icon: <Calendar className="w-5 h-5" />,
    subItems: [
      {
        label: 'ข้อมูลการลา',
        href: '/leaves',
        icon: <Calendar className="w-4 h-4" />
      },
      {
        label: 'ขอลา',
        href: '/leaves/request',
        icon: <UserPlus className="w-4 h-4" />
      },
      {
        label: 'ประวัติการลา',
        href: '/leaves/history',
        icon: <Clock className="w-4 h-4" />
      },
      {
        label: 'จัดการคำขอลา',
        href: '/leaves/management',
        icon: <UserCog className="w-4 h-4" />,
        roles: ['hr', 'admin', 'manager']
      },
      {
        label: 'จัดการโควต้า',
        href: '/leaves/quota',
        icon: <Settings className="w-4 h-4" />,
        roles: ['hr', 'admin']
      }
    ]
  },
  {
    label: 'Influ Marketing',
    href: '#',
    icon: <TrendingUp className="w-5 h-5" />,
    roles: ['hr', 'admin', 'manager', 'marketing'],
    subItems: [
      {
        label: 'ข้อมูล Influencers',
        href: '/influencers',
        icon: <Baby className="w-4 h-4" />
      },
      {
        label: 'Campaigns',
        href: '/campaigns',
        icon: <TrendingUp className="w-4 h-4" />
      }
    ]
  },
  {
    label: 'Delivery Tracking',
    icon: <Truck className="w-5 h-5" />, // No href for parent
    roles: ['driver', 'admin', 'hr'],
    subItems: [
      {
        label: 'สรุปประจำวัน',
        href: '/delivery',
        icon: <Home className="w-4 h-4" />
      },
      {
        label: 'เช็คอินจุดส่ง',
        href: '/delivery/checkin',
        icon: <Camera className="w-4 h-4" />
      },
      {
        label: 'แผนที่การส่ง',
        href: '/delivery/map',
        icon: <Map className="w-4 h-4" />
      }
    ]
  },
  {
    label: 'รายงาน',
    href: '/reports',
    icon: <FileText className="w-5 h-5" />,
    roles: ['hr', 'admin', 'manager']
  },
  {
    label: 'ตั้งค่า',
    icon: <Settings className="w-5 h-5" />,
    roles: ['hr', 'admin'],
    subItems: [
      {
        label: 'สถานที่ทำงาน',
        href: '/settings/locations',
        icon: <MapPin className="w-4 h-4" />
      },
      {
        label: 'Discord',
        href: '/settings/discord',
        icon: <MessageSquare className="w-4 h-4" />
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
      },
      {
        label: 'ลบข้อมูลทั้งหมด',
        icon: <Trash2 className="w-4 h-4" />,
        href: '/settings/delete-data',
        roles: ['admin']
      }
    ]
  }
]

export default function Sidebar({ userData, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  
  const userRole = userData?.role || 'employee'
  
  // Auto-expand parent menu when a submenu is active
  useEffect(() => {
    const expanded: string[] = []
    
    navItems.forEach(item => {
      if (item.subItems) {
        // Check if current pathname exactly matches any subitem
        const hasActiveSubItem = item.subItems.some(
          subItem => pathname === subItem.href
        )
        if (hasActiveSubItem) {
          expanded.push(item.label)
        }
      }
    })
    
    setExpandedItems(expanded)
  }, [pathname])
  
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

  const handleNavigation = (href: string) => {
    router.push(href)
    // Call onNavigate to close mobile sidebar
    if (onNavigate) {
      onNavigate()
    }
  }

  const renderNavItem = (item: NavItem, isSubItem = false) => {
    const hasSubItems = item.subItems && item.subItems.length > 0
    const isExpanded = expandedItems.includes(item.label)
    
    // Check if this exact item is active
    const isActive = item.href && pathname === item.href
    
    // Check if any subitem is active (for parent styling)
    const hasActiveSubItem = item.subItems?.some(subItem => 
      pathname === subItem.href
    ) || false
    
    // Filter subitems based on role
    const filteredSubItems = item.subItems?.filter(subItem => {
      if (!subItem.roles) return true
      return subItem.roles.includes(userRole)
    })

    return (
      <div key={item.href || item.label}>
        {hasSubItems ? (
          <>
            <button
              onClick={() => {
                // If has href and subitems, navigate on first click then expand
                if (item.href && !isExpanded) {
                  handleNavigation(item.href)
                }
                toggleExpanded(item.label)
              }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors ${
                hasActiveSubItem
                  ? 'text-red-600 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
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
                {filteredSubItems.map(subItem => {
                  // Only exact match for subitems
                  const isSubItemActive = pathname === subItem.href
                  
                  return (
                    <button
                      key={subItem.href}
                      onClick={() => handleNavigation(subItem.href!)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        isSubItemActive
                          ? 'bg-red-50 text-red-600 font-medium'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {subItem.icon}
                      <span className="text-sm">{subItem.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => handleNavigation(item.href!)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
              isActive
                ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 text-red-600 font-medium'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            {item.icon}
            <span className="text-base">{item.label}</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <button 
          onClick={() => handleNavigation('/dashboard')}
          className="hover:opacity-80 transition-opacity"
        >
          <img 
            src="/logo.svg" 
            alt="AMGO Logo" 
            className="h-10 w-auto"
          />
        </button>
      </div>

      <nav className="p-4 space-y-1">
        {filteredNavItems.map(item => renderNavItem(item))}
      </nav>
    </aside>
  )
}