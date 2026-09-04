// components/layout/Sidebar.tsx
//
// เมนูข้าง — ดีไซน์ตามระบบ aoosocial
//   · กว้าง 232px ตรึงซ้าย · จอแคบกว่า 1024px กลายเป็นลิ้นชักเลื่อนออกมา
//   · เมนูที่กำลังอยู่ = พื้น coral-50 ตัวอักษร coral-700 ไอคอน coral-500
//   · จัดกลุ่มด้วยหัวข้อตัวเล็กแทนที่จะไล่เรียงยาวเป็นพืด

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  Calendar,
  FileSignature,
  FileText,
  Settings,
  Clock,
  UserCog,
  CheckSquare,
  UserPlus,
  ChevronDown,
  Shield,
  MessageSquare,
  Truck,
  Gauge,
  Camera,
  Map,
  Home,
  Wallet,
  TrendingUp,
  FlaskConical,
  CupSoda,
  BookOpen,
  History,
  Calculator,
  Globe,
  Receipt,
  Layers,
  ListChecks,
  Server, CalendarSync} from 'lucide-react'
import { UserData } from '@/hooks/useAuth'

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  roles?: string[]
  subItems?: NavItem[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

interface SidebarProps {
  userData?: UserData | null
  onNavigate?: () => void
}

const icon = (I: typeof Clock) => <I size={18} strokeWidth={1.75} />
const subIcon = (I: typeof Clock) => <I size={16} strokeWidth={1.75} />

const navSections: NavSection[] = [
  {
    items: [{ label: 'Dashboard', href: '/dashboard', icon: icon(LayoutDashboard) }],
  },
  {
    title: 'งานประจำวัน',
    items: [
      {
        label: 'เช็คอิน/เอาท์',
        icon: icon(Clock),
        subItems: [
          { label: 'เช็คอิน/เอาท์', href: '/checkin', icon: subIcon(CheckSquare) },
          { label: 'ประวัติการเช็คอิน', href: '/checkin/history', icon: subIcon(Calendar) },
          { label: 'แผนที่เช็คอิน', href: '/checkin/map', icon: subIcon(Map), roles: ['admin'] },
          { label: 'รอดำเนินการ', href: '/checkin/pending', icon: subIcon(Clock), roles: ['hr', 'admin'] },
        ],
      },
      {
        label: 'การลา',
        icon: icon(Calendar),
        subItems: [
          { label: 'ข้อมูลการลา', href: '/leaves', icon: subIcon(Calendar) },
          { label: 'ขอลา', href: '/leaves/request', icon: subIcon(UserPlus) },
          { label: 'ประวัติการลา', href: '/leaves/history', icon: subIcon(Clock) },
          { label: 'สลับวันหยุด', href: '/leaves/swap', icon: subIcon(CalendarSync) },
          { label: 'จัดการคำขอลา', href: '/leaves/management', icon: subIcon(UserCog), roles: ['hr', 'admin', 'manager'] },
          { label: 'จัดการใบสลับวันหยุด', href: '/leaves/swap/management', icon: subIcon(CalendarSync), roles: ['hr', 'admin', 'manager'] },
        ],
      },
      {
        label: 'Delivery Tracking',
        icon: icon(Truck),
        // 'delivery' = ตำแหน่งที่ติดธง sees_delivery (Call Center) — ดู roleKeys ใน component
        roles: ['driver', 'admin', 'hr', 'delivery'],
        subItems: [
          { label: 'สรุปประจำวัน', href: '/delivery', icon: subIcon(Home) },
          { label: 'เช็คอินจุดส่ง', href: '/delivery/checkin', icon: subIcon(Camera) },
          { label: 'แผนที่การส่งของ', href: '/delivery/map', icon: subIcon(Map) },
        ],
      },
      {
        label: 'SRP Calculator',
        icon: icon(Calculator),
        // 'srp' = ได้รับสิทธิ์อย่างน้อย 1 แบรนด์ (แอดมินเห็นเสมอ) — สิทธิ์รายคนรายแบรนด์
        roles: ['admin', 'srp'],
        href: '/srp',
      },
      {
        label: 'การผลิต',
        icon: icon(FlaskConical),
        // 'production' = ตำแหน่งพนักงานฝ่ายผลิต (ADAY FRESH) — เจ้าของสั่งให้ HR ไม่เห็น
        roles: ['admin', 'production'],
        subItems: [
          { label: 'ผสมวันนี้', href: '/production', icon: subIcon(CupSoda) },
          { label: 'สูตรน้ำ', href: '/production/recipes', icon: subIcon(BookOpen) },
          { label: 'ประวัติการผลิต', href: '/production/history', icon: subIcon(History) },
        ],
      },
      {
        label: 'AOO Website',
        icon: icon(Globe),
        // งานส่วนตัวของเจ้าของ — ไม่มี 'admin' ในลิสต์โดยตั้งใจ ต้องมีชื่อใน web_owners เท่านั้น
        roles: ['website'],
        subItems: [
          { label: 'รายการเว็บ', href: '/websites', icon: subIcon(Globe) },
          { label: 'สั่งงานทั้งฟลีต', href: '/websites/jobs', icon: subIcon(ListChecks) },
          { label: 'โฮสต์', href: '/websites/hosts', icon: subIcon(Server) },
          { label: 'สลิปรอตรวจ', href: '/websites/slips', icon: subIcon(Receipt) },
          { label: 'รุ่น/คอร์ส', href: '/websites/courses', icon: subIcon(Layers) },
        ],
      },
    ],
  },
  {
    title: 'จัดการ',
    items: [
      {
        label: 'พนักงาน',
        icon: icon(Users),
        roles: ['hr', 'admin', 'manager'],
        subItems: [
          // แก้ไขหลายคนพร้อมกัน ไม่มีเมนูแล้ว — เข้าจากปุ่มบนหน้ารายการพนักงานทางเดียว
          { label: 'รายการพนักงาน', href: '/employees', icon: subIcon(Users) },
          // ย้ายมาจากกลุ่มการลา — HR หาไม่เจอเพราะเป็นงานจัดการคน ไม่ใช่งานยื่นลา
          { label: 'จัดการโควต้าวันลา', href: '/leaves/quota', icon: subIcon(Settings), roles: ['hr', 'admin'] },
          { label: 'เชิญพนักงานใหม่', href: '/employees/invite-links', icon: subIcon(UserPlus) },
          { label: 'รออนุมัติ', href: '/employees/pending', icon: subIcon(Clock) },
        ],
      },
      {
        label: 'รายงาน',
        icon: icon(FileText),
        // กลุ่มเปิดกว้างถึงสายส่ง (driver/delivery) — สิทธิ์จริงกรองรายเมนูข้างใน
        roles: ['hr', 'admin', 'manager', 'driver', 'delivery'],
        subItems: [
          // ⚠️ ใส่เฉพาะรายงานที่มีหน้าจริง — สร้างรายงานใหม่เมื่อไหร่ค่อยเพิ่มแถวที่นี่
          //    (หน้าศูนย์รวม /reports เอาออกจากเมนูแล้ว — เจ้าของบอกไม่จำเป็น)
          { label: 'รายงานการเข้างาน', href: '/reports/checkin', icon: subIcon(Clock), roles: ['hr', 'admin', 'manager'] },
          { label: 'Performance การมาทำงาน', href: '/reports/performance', icon: subIcon(TrendingUp), roles: ['hr', 'admin', 'manager'] },
          { label: 'รายงานการส่งของ', href: '/delivery/report', icon: subIcon(Truck), roles: ['hr', 'admin', 'manager', 'driver', 'delivery'] },
          { label: 'Performance การส่งของ', href: '/reports/delivery-performance', icon: subIcon(Gauge), roles: ['hr', 'admin', 'manager'] },
          { label: 'รูปสต็อก/หน้าร้าน', href: '/reports/stock-photos', icon: subIcon(Camera), roles: ['hr', 'admin', 'manager'] },
        ],
      },
      { label: 'สรุปเงินเดือน', href: '/payroll', icon: icon(Wallet), roles: ['hr', 'admin'] },
      // จดหมาย/ประกาศจากแม่แบบกลาง — หน้าเดียวใช้ได้ทั้ง 3 บริษัท (สลับแค่โลโก้+ข้อมูล)
      { label: 'เอกสารบริษัท', href: '/documents', icon: icon(FileSignature), roles: ['hr', 'admin', 'manager'] },
    ],
  },
  {
    title: 'ตั้งค่า',
    items: [
      {
        label: 'ตั้งค่าระบบ',
        icon: icon(Settings),
        roles: ['hr', 'admin'],
        subItems: [
          // ⚠️ ทุกลิงก์ต้องมีหน้าอยู่จริงใน app/(admin)/settings/
          //    Next.js prefetch ลิงก์ในเมนูอัตโนมัติ ลิงก์ตายจึงยิง 404
          //    รัวใน console ตั้งแต่เปิดหน้า โดยยังไม่มีใครกดด้วยซ้ำ
          { label: 'สถานที่ทำงาน', href: '/settings/locations', icon: subIcon(MapPin) },
          { label: 'บริษัท', href: '/settings/companies', icon: subIcon(Building2) },
          { label: 'Discord', href: '/settings/discord', icon: subIcon(MessageSquare) },
          { label: 'วันหยุด', href: '/settings/holidays', icon: subIcon(Calendar) },
          { label: 'ผู้ใช้ระบบ', href: '/settings/users', icon: subIcon(Users), roles: ['admin'] },
        ],
      },
      // เอาออกจากเมนูแล้ว 3 อัน — เป็นเครื่องมือช่วงย้ายระบบ ไม่ใช่ของที่ใช้งานจริง
      //   /settings/delete-data  ปิดการทำงานไปแล้ว (ลบได้แค่ข้อมูลสำรองบน Firebase)
      //   /migration             หน้าตรวจสถานะย้ายข้อมูล ถูกล็อกด้วย env flag อยู่แล้ว
      //   /design                หน้าโชว์คอมโพเนนต์ ไว้ดูตอนพัฒนา
      // หน้ายังอยู่ในโค้ด เข้าได้ด้วยการพิมพ์ URL ตรง ๆ ถ้าต้องใช้
    ],
  },
]

export default function Sidebar({ userData, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState<string[]>([])

  const userRole = userData?.role || 'employee'
  // นอกจาก role แล้ว บางตำแหน่งได้สิทธิ์พิเศษ — แทนเป็น key เสมือนในลิสต์เดียวกัน
  // (delivery = ตำแหน่งติดธง sees_delivery เช่น Call Center · production = ฝ่ายผลิต ADF
  //  · srp = ได้รับสิทธิ์ SRP Calculator อย่างน้อย 1 แบรนด์)
  const roleKeys = [
    userRole,
    ...(userData?.seesDelivery ? ['delivery'] : []),
    ...(userData?.jobFunctionCode === 'production' ? ['production'] : []),
    ...(userData?.hasSrpAccess ? ['srp'] : []),
    ...(userData?.hasWebAccess ? ['website'] : []),
  ]
  const allowed = (roles?: string[]) => !roles || roles.some((r) => roleKeys.includes(r))

  // กางเมนูแม่ให้เองเมื่อเข้าหน้าลูก — ไม่งั้นผู้ใช้ไม่รู้ว่าตัวเองอยู่ตรงไหน
  useEffect(() => {
    const open = navSections
      .flatMap((s) => s.items)
      .filter((item) => item.subItems?.some((sub) => pathname === sub.href))
      .map((item) => item.label)
    setExpanded((prev) => Array.from(new Set([...prev, ...open])))
  }, [pathname])

  const go = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  const toggle = (label: string) =>
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )

  const renderItem = (item: NavItem) => {
    const subs = item.subItems?.filter((s) => allowed(s.roles))
    const hasSubs = !!subs?.length
    const isOpen = expanded.includes(item.label)
    const isActive = item.href === pathname
    const childActive = subs?.some((s) => s.href === pathname) ?? false

    if (!hasSubs) {
      return (
        <Link
          key={item.href}
          href={item.href!}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
            onNavigate?.()
          }}
          data-button-fx="ghost"
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm no-underline ${
            isActive
              ? 'bg-red-50 font-semibold text-red-700'
              : 'font-medium text-gray-700'
          }`}
        >
          <span className={isActive ? 'text-red-500' : 'text-gray-400'}>{item.icon}</span>
          <span className="flex-1">{item.label}</span>
        </Link>
      )
    }

    return (
      <div key={item.label}>
        <button
          onClick={() => toggle(item.label)}
          data-button-fx="ghost"
          aria-expanded={isOpen}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
            childActive ? 'font-semibold text-red-700' : 'font-medium text-gray-700'
          }`}
        >
          <span className={childActive ? 'text-red-500' : 'text-gray-400'}>{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            size={15}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {isOpen && (
          <div className="mt-0.5 ml-4 space-y-0.5 border-l border-gray-200 pl-3">
            {subs!.map((sub) => {
              const active = pathname === sub.href
              return (
                <Link
                  key={sub.href}
                  href={sub.href!}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                    onNavigate?.()
                  }}
                  data-button-fx="ghost"
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm no-underline ${
                    active ? 'bg-red-50 font-semibold text-red-700' : 'text-gray-600'
                  }`}
                >
                  <span className={active ? 'text-red-500' : 'text-gray-400'}>{sub.icon}</span>
                  <span className="flex-1">{sub.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <button
        onClick={() => go('/dashboard')}
        className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-4"
      >
        <img src="/amgo-logo.svg" alt="AMGO" className="h-7 w-auto" />
        <span className="text-sm font-bold tracking-[0.12em] text-gray-700">AMGO HR</span>
      </button>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {navSections.map((section, i) => {
          const items = section.items.filter((it) => allowed(it.roles))
          if (!items.length) return null
          return (
            <div key={section.title ?? i} className="space-y-0.5">
              {section.title && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  {section.title}
                </p>
              )}
              {items.map(renderItem)}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
