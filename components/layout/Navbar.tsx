// components/layout/Navbar.tsx
//
// แถบบน 56px ตรึงไว้ — ดีไซน์ตามระบบ aoosocial
// เมนูผู้ใช้ใช้ ActionMenu ตัวกลาง (portal ออกนอก overflow ได้ ปิดด้วย Esc)

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, ChevronDown, Eye } from 'lucide-react'
import { signOutBoth } from '@/lib/auth/dual-session'
import { UserData } from '@/hooks/useAuth'
import UserAvatar from '@/components/shared/UserAvatar'
import { ActionMenu } from '@/components/aoo'
import { getViewAs, setViewAs, VIEW_AS_PRESETS } from '@/lib/utils/viewAs'

interface NavbarProps {
  userData?: UserData | null
  /** สิทธิ์จริงของคนล็อกอิน — แอดมินเท่านั้นที่เห็นปุ่มสลับมุมมอง */
  realRole?: string | null
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

export default function Navbar({ userData, realRole, onMenuClick }: NavbarProps) {
  const router = useRouter()

  // ── แอดมิน: ดูระบบในมุมมองสิทธิ์อื่น (เครื่องมือทดสอบ) ──────────────
  // useAuth เป็น hook แยกต่อ component ไม่มี context กลาง — สลับแล้วโหลดหน้าใหม่
  // ทุกจุดจะได้ค่าตรงกัน · จำลองแค่หน้าจอ ข้อมูลจริงยังคุมด้วย RLS ตามสิทธิ์จริง
  const [viewAs, setView] = useState('off')
  useEffect(() => setView(getViewAs()), [])
  const preset = VIEW_AS_PRESETS.find((p) => p.value === viewAs) ?? VIEW_AS_PRESETS[0]
  const previewing = viewAs !== 'off'
  // สลับเป็นมุมมองอื่นแล้วพากลับหน้าหลักเสมอ — ถ้าอยู่หน้าที่สิทธิ์นั้นเข้าไม่ได้
  // (เช่นแอดมินยืนอยู่หน้า SRP แล้วสลับเป็นฝ่ายบุคคล) จะโดนเด้งไปหน้า
  // "ไม่มีสิทธิ์เข้าถึง" ซึ่งอยู่นอกเลย์เอาต์ = ไม่มีเมนูให้เดินต่อ
  const pickView = (v: string) => {
    setViewAs(v)
    if (v === 'off') window.location.reload()
    else window.location.href = '/dashboard'
  }

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

      <div className="ml-auto flex items-center gap-1.5">
        {realRole === 'admin' && (
          <ActionMenu
            minWidth={280}
            items={VIEW_AS_PRESETS.map((p) => ({
              label: p.value === viewAs ? `✓ ${p.label}` : p.label,
              onSelect: () => pickView(p.value),
            }))}
            trigger={({ onClick, open }) => (
              <button
                onClick={onClick}
                aria-expanded={open}
                title="ดูระบบในมุมมองของสิทธิ์อื่น (จำลองหน้าจอเท่านั้น)"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  previewing
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Eye size={14} />
                <span className="hidden sm:block">
                  {previewing ? `กำลังดูแบบ: ${preset.label}` : 'ดูมุมมองสิทธิ์'}
                </span>
                <ChevronDown size={13} className="opacity-60" />
              </button>
            )}
          />
        )}
        <ActionMenu
          minWidth={200}
          items={[
            {
              label: 'โปรไฟล์ของฉัน',
              icon: 'User',
              onSelect: () => router.push('/profile'),
            },
            { kind: 'divider' },
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
                userId={userData?.id}
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
