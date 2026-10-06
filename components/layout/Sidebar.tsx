// components/layout/Sidebar.tsx
//
// เมนูข้าง — ปรับใหม่ 6 ต.ค. 69 ตามที่เจ้าของขอ: minimal · ไม่มีเงา · สีสดต่อเรื่อง
//   · กว้าง 232px ตรึงซ้าย · จอแคบกว่า 1024px กลายเป็นลิ้นชักเลื่อนออกมา
//   · แต่ละเมนูมีสีของเรื่องตัวเอง (tone): แดง=accent/danger (สีนำ) เหลือง=warning เขียว=success ม่วง=grape/plum น้ำตาล=sky — หน้าที่เปิดอยู่เป็นพื้นสีเต็ม · สไตล์อยู่ที่ .aoo-nav-* ใน globals.css
//   · เมนูย่อยไม่มีไอคอน (ไอคอนซ้ำ ๆ ทำให้รก)
//
// โครงกลุ่ม:
//   ของฉัน    — สิ่งที่พนักงานทุกคนทำกับตัวเอง (เช็คอิน · ลา · เบิก)
//   รออนุมัติ — งานอนุมัติทั้งหมดรวมที่เดียว (เดิมซ่อนอยู่ท้ายเมนูย่อยของแต่ละเรื่อง
//               หัวหน้าต้องกางทีละกลุ่มเพื่อหา) · พนักงานทั่วไปไม่เห็นกลุ่มนี้เลย
//   งาน       — ตามฝ่าย (ส่งของ · ผลิต · SRP · เว็บไซต์)
//   จัดการ    — HR/แอดมิน (พนักงาน · รายงาน · เงินเดือน · เอกสาร · ตั้งค่า)

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarSync,
  FileSignature,
  FileText,
  Settings,
  Clock,
  UserPlus,
  ChevronDown,
  Truck,
  Wallet,
  FlaskConical,
  Calculator,
  Globe,
  Receipt,
  ReceiptText,
  MapPinCheck,
} from 'lucide-react'
import { UserData } from '@/hooks/useAuth'
import type { StatTone } from '@/components/shared'

interface NavItem {
  label: string
  href?: string
  icon?: React.ReactNode
  /** สีของเรื่องนี้ — เมนูย่อยใช้สีเดียวกับแม่ */
  tone?: StatTone
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

const icon = (I: typeof Clock) => <I size={17} strokeWidth={2} />

const navSections: NavSection[] = [
  {
    items: [{ label: 'Dashboard', href: '/dashboard', icon: icon(LayoutDashboard), tone: 'accent' }],
  },
  {
    title: 'ของฉัน',
    items: [
      {
        label: 'เช็คอิน/เอาท์',
        icon: icon(Clock),
        tone: 'warning',
        subItems: [
          { label: 'เช็คอิน/เอาท์', href: '/checkin' },
          { label: 'ประวัติการเช็คอิน', href: '/checkin/history' },
          { label: 'แผนที่เช็คอิน', href: '/checkin/map', roles: ['admin'] },
        ],
      },
      {
        label: 'การลา',
        icon: icon(Calendar),
        tone: 'grape',
        subItems: [
          { label: 'ข้อมูลการลา', href: '/leaves' },
          { label: 'ขอลา', href: '/leaves/request' },
          { label: 'ประวัติการลา', href: '/leaves/history' },
          { label: 'สลับวันหยุด', href: '/leaves/swap' },
        ],
      },
      // ใบเบิกค่าใช้จ่าย (30 ก.ย. 69) — ฝั่งจัดการย้ายไปกลุ่มรออนุมัติ
      { label: 'เบิกค่าใช้จ่าย', href: '/expenses', icon: icon(Receipt), tone: 'success' },
    ],
  },
  {
    title: 'รออนุมัติ',
    items: [
      { label: 'เช็คอินรอตรวจ', href: '/checkin/pending', icon: icon(MapPinCheck), tone: 'warning', roles: ['hr', 'admin'] },
      { label: 'คำขอลา', href: '/leaves/management', icon: icon(Calendar), tone: 'grape', roles: ['hr', 'admin', 'manager'] },
      { label: 'ใบสลับวันหยุด', href: '/leaves/swap/management', icon: icon(CalendarSync), tone: 'grape', roles: ['hr', 'admin', 'manager'] },
      // 'finance' = ตำแหน่งบัญชี (role employee) ดู roleKeys
      { label: 'ใบเบิก', href: '/expenses/manage', icon: icon(ReceiptText), tone: 'success', roles: ['hr', 'admin', 'manager', 'finance'] },
      { label: 'พนักงานใหม่', href: '/employees/pending', icon: icon(UserPlus), tone: 'danger', roles: ['hr', 'admin', 'manager'] },
    ],
  },
  {
    title: 'งาน',
    items: [
      {
        label: 'ส่งของ',
        icon: icon(Truck),
        tone: 'sky',
        // 'delivery' = ตำแหน่งที่ติดธง sees_delivery (Call Center) — ดู roleKeys ใน component
        roles: ['driver', 'admin', 'hr', 'delivery'],
        subItems: [
          { label: 'สรุปประจำวัน', href: '/delivery' },
          { label: 'เช็คอินจุดส่ง', href: '/delivery/checkin' },
          { label: 'แผนที่การส่งของ', href: '/delivery/map' },
        ],
      },
      {
        label: 'การผลิต',
        icon: icon(FlaskConical),
        tone: 'danger',
        // 'production' = ตำแหน่งพนักงานฝ่ายผลิต (ADAY FRESH) — เจ้าของสั่งให้ HR ไม่เห็น
        roles: ['admin', 'production'],
        subItems: [
          { label: 'ผสมวันนี้', href: '/production' },
          { label: 'สูตรน้ำ', href: '/production/recipes' },
          { label: 'ประวัติการผลิต', href: '/production/history' },
        ],
      },
      {
        label: 'SRP Calculator',
        icon: icon(Calculator),
        tone: 'plum',
        // 'srp' = ได้รับสิทธิ์อย่างน้อย 1 แบรนด์ (แอดมินเห็นเสมอ) — สิทธิ์รายคนรายแบรนด์
        roles: ['admin', 'srp'],
        href: '/srp',
      },
      {
        // AOO Website + SEO / AEO รวมเป็นเมนูเดียว (6 ต.ค. 69) — ตั้งค่าเว็บ SEO เข้าจากปุ่มบนหน้า /seo
        label: 'เว็บไซต์',
        icon: icon(Globe),
        tone: 'sky',
        // งานส่วนตัวของเจ้าของ — ไม่มี 'admin' ในลิสต์โดยตั้งใจ ต้องมีชื่อใน web_owners เท่านั้น
        roles: ['website'],
        subItems: [
          { label: 'รายการเว็บ', href: '/websites' },
          { label: 'SEO / AEO', href: '/seo' },
          { label: 'สั่งงานทั้งฟลีต', href: '/websites/jobs' },
          { label: 'โฮสต์', href: '/websites/hosts' },
          { label: 'สลิปรอตรวจ', href: '/websites/slips' },
          { label: 'รุ่น/คอร์ส', href: '/websites/courses' },
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
        tone: 'accent',
        roles: ['hr', 'admin', 'manager'],
        subItems: [
          // แก้ไขหลายคนพร้อมกัน ไม่มีเมนูแล้ว — เข้าจากปุ่มบนหน้ารายการพนักงานทางเดียว
          { label: 'รายการพนักงาน', href: '/employees' },
          // ย้ายมาจากกลุ่มการลา — HR หาไม่เจอเพราะเป็นงานจัดการคน ไม่ใช่งานยื่นลา
          { label: 'โควต้าวันลา', href: '/leaves/quota', roles: ['hr', 'admin'] },
          { label: 'เชิญพนักงานใหม่', href: '/employees/invite-links' },
        ],
      },
      {
        label: 'รายงาน',
        icon: icon(FileText),
        tone: 'sky',
        // กลุ่มเปิดกว้างถึงสายส่ง (driver/delivery) — สิทธิ์จริงกรองรายเมนูข้างใน
        roles: ['hr', 'admin', 'manager', 'driver', 'delivery'],
        subItems: [
          // ⚠️ ใส่เฉพาะรายงานที่มีหน้าจริง — สร้างรายงานใหม่เมื่อไหร่ค่อยเพิ่มแถวที่นี่
          //    (หน้าศูนย์รวม /reports เอาออกจากเมนูแล้ว — เจ้าของบอกไม่จำเป็น)
          { label: 'การเข้างาน', href: '/reports/checkin', roles: ['hr', 'admin', 'manager'] },
          { label: 'Performance การมาทำงาน', href: '/reports/performance', roles: ['hr', 'admin', 'manager'] },
          { label: 'การส่งของ', href: '/delivery/report', roles: ['hr', 'admin', 'manager', 'driver', 'delivery'] },
          { label: 'Performance การส่งของ', href: '/reports/delivery-performance', roles: ['hr', 'admin', 'manager'] },
          { label: 'รูปสต็อก/หน้าร้าน', href: '/reports/stock-photos', roles: ['hr', 'admin', 'manager'] },
        ],
      },
      { label: 'สรุปเงินเดือน', href: '/payroll', icon: icon(Wallet), tone: 'success', roles: ['hr', 'admin'] },
      // จดหมาย/ประกาศจากแม่แบบกลาง — หน้าเดียวใช้ได้ทั้ง 3 บริษัท (สลับแค่โลโก้+ข้อมูล)
      { label: 'เอกสารบริษัท', href: '/documents', icon: icon(FileSignature), tone: 'grape', roles: ['hr', 'admin', 'manager'] },
      {
        label: 'ตั้งค่าระบบ',
        icon: icon(Settings),
        tone: 'neutral',
        roles: ['hr', 'admin'],
        subItems: [
          // ⚠️ ทุกลิงก์ต้องมีหน้าอยู่จริงใน app/(admin)/settings/
          //    Next.js prefetch ลิงก์ในเมนูอัตโนมัติ ลิงก์ตายจึงยิง 404
          //    รัวใน console ตั้งแต่เปิดหน้า โดยยังไม่มีใครกดด้วยซ้ำ
          { label: 'สถานที่ทำงาน', href: '/settings/locations' },
          { label: 'บริษัท', href: '/settings/companies' },
          { label: 'Discord', href: '/settings/discord' },
          { label: 'วันหยุด', href: '/settings/holidays' },
          { label: 'ผู้ใช้ระบบ', href: '/settings/users', roles: ['admin'] },
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

/** ลิงก์ทุกตัวในเมนู (แบนราบ) — ใช้หาว่าหน้าไหนกำลังเปิดอยู่ */
const allHrefs = navSections
  .flatMap((s) => s.items)
  .flatMap((it) => [it.href, ...(it.subItems ?? []).map((s) => s.href)])
  .filter((h): h is string => !!h)

/**
 * ลิงก์ที่ตรงกับหน้าปัจจุบัน — เอาตัวที่ยาวที่สุดที่ pathname ขึ้นต้นด้วย
 * หน้าลูกที่ไม่มีในเมนู (/seo/settings, /employees/123) จึงยังไฮไลต์เมนูแม่ได้
 * และ /websites ไม่ไปติดไฮไลต์ตอนอยู่ /websites/jobs
 */
function matchHref(pathname: string) {
  return (
    allHrefs
      .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null
  )
}

export default function Sidebar({ userData, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState<string[]>([])
  const current = useMemo(() => matchHref(pathname), [pathname])

  const userRole = userData?.role || 'employee'
  // นอกจาก role แล้ว บางตำแหน่งได้สิทธิ์พิเศษ — แทนเป็น key เสมือนในลิสต์เดียวกัน
  // (delivery = ตำแหน่งติดธง sees_delivery เช่น Call Center · production = ฝ่ายผลิต ADF
  //  · srp = ได้รับสิทธิ์ SRP Calculator อย่างน้อย 1 แบรนด์)
  const roleKeys = [
    userRole,
    ...(userData?.seesDelivery ? ['delivery'] : []),
    ...(userData?.jobFunctionCode === 'production' ? ['production'] : []),
    ...(userData?.jobFunctionCode === 'accountant' ? ['finance'] : []),
    ...(userData?.hasSrpAccess ? ['srp'] : []),
    ...(userData?.hasWebAccess ? ['website'] : []),
  ]
  const allowed = (roles?: string[]) => !roles || roles.some((r) => roleKeys.includes(r))

  // กางเมนูแม่ให้เองเมื่อเข้าหน้าลูก — ไม่งั้นผู้ใช้ไม่รู้ว่าตัวเองอยู่ตรงไหน
  useEffect(() => {
    const open = navSections
      .flatMap((s) => s.items)
      .filter((item) => item.subItems?.some((sub) => sub.href === current))
      .map((item) => item.label)
    setExpanded((prev) => Array.from(new Set([...prev, ...open])))
  }, [current])

  const go = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  const toggle = (label: string) =>
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )

  // คลิกปกติ = ปิดลิ้นชักบนมือถือ · คลิกพร้อมปุ่ม (เปิดแท็บใหม่) ไม่ต้องปิด
  const onLinkClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    onNavigate?.()
  }

  const renderItem = (item: NavItem) => {
    const subs = item.subItems?.filter((s) => allowed(s.roles))
    const hasSubs = !!subs?.length
    const isOpen = expanded.includes(item.label)
    const childActive = subs?.some((s) => s.href === current) ?? false

    if (!hasSubs) {
      return (
        <Link
          key={item.href}
          href={item.href!}
          onClick={onLinkClick}
          aria-current={item.href === current ? 'page' : undefined}
          className="aoo-nav-item"
          data-tone={item.tone}
        >
          <span className="aoo-nav-item__icon">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
        </Link>
      )
    }

    return (
      <div key={item.label} data-tone={item.tone}>
        <button
          onClick={() => toggle(item.label)}
          aria-expanded={isOpen}
          data-child-active={childActive || undefined}
          className="aoo-nav-item"
        >
          <span className="aoo-nav-item__icon">{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown size={15} className="aoo-nav-item__chevron" />
        </button>

        {isOpen && (
          <div className="aoo-nav-sub">
            {subs!.map((sub) => (
              <Link
                key={sub.href}
                href={sub.href!}
                onClick={onLinkClick}
                aria-current={sub.href === current ? 'page' : undefined}
                className="aoo-nav-sub__item"
              >
                {sub.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-gray-100 bg-white">
      <button onClick={() => go('/dashboard')} className="flex h-14 shrink-0 items-center gap-2 px-4">
        <img src="/amgo-logo.svg" alt="AMGO" className="h-7 w-auto" />
        <span className="text-sm font-bold tracking-[0.12em] text-gray-700">AMGO HR</span>
      </button>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1">
        {navSections.map((section, i) => {
          const items = section.items.filter((it) => allowed(it.roles))
          if (!items.length) return null
          return (
            <div key={section.title ?? i} className="space-y-0.5">
              {section.title && <p className="aoo-nav-section">{section.title}</p>}
              {items.map(renderItem)}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
