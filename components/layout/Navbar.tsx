// components/layout/Navbar.tsx
//
// แถบบน 56px ตรึงไว้ — ดีไซน์ตามระบบ aoosocial
// เมนูผู้ใช้ใช้ ActionMenu ตัวกลาง (portal ออกนอก overflow ได้ ปิดด้วย Esc)

'use client'

import { useRouter } from 'next/navigation'
import { Menu, ChevronDown } from 'lucide-react'
import { signOutBoth } from '@/lib/auth/dual-session'
import { UserData } from '@/hooks/useAuth'
import UserAvatar from '@/components/shared/UserAvatar'
import { ActionMenu } from '@/components/aoo'

interface NavbarProps {
  userData?: UserData | null
  onMenuClick?: () => void
  sidebarOpen?: boolean
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  hr: 'ฝ่ายบุคคล',
  manager: 'ผู้จัดการ',
  driver: 'พนักงานขับรถ',
  marketing: 'การตลาด',
  employee: 'พนักงาน',
}

export default function Navbar({ userData, onMenuClick }: NavbarProps) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOutBoth()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const name = userData?.lineDisplayName || userData?.fullName || 'ผู้ใช้'
  const role = ROLE_LABEL[userData?.role ?? 'employee'] ?? 'พนักงาน'

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 lg:px-6">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          aria-label="เปิดเมนู"
          data-button-fx="ghost"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 lg:hidden"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      )}

      {/* โลโก้กลางจอเฉพาะมือถือ — บนเดสก์ท็อปโลโก้อยู่หัวเมนูข้างแล้ว */}
      <img
        src="/amgo-logo.svg"
        alt="AMGO"
        className="h-8 w-auto lg:hidden"
      />

      <div className="ml-auto">
        <ActionMenu
          minWidth={200}
          items={[
            {
              label: 'ออกจากระบบ',
              icon: 'LogOut',
              tone: 'danger',
              onSelect: handleLogout,
            },
          ]}
          trigger={({ onClick, open }) => (
            <button
              onClick={onClick}
              data-button-fx="ghost"
              aria-expanded={open}
              className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2"
            >
              <UserAvatar
                name={userData?.fullName || userData?.lineDisplayName || '?'}
                imageUrl={userData?.linePictureUrl}
                size="sm"
              />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium text-gray-800">{name}</span>
                <span className="block text-xs text-gray-500">{role}</span>
              </span>
              <ChevronDown size={15} className="text-gray-400" />
            </button>
          )}
        />
      </div>
    </header>
  )
}
