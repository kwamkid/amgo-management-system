// components/layout/Sidebar.tsx
//
// เมนูข้าง — ปรับใหม่ 30 ต.ค. 69 ตามที่เจ้าของขอ: ยุบเมนูให้น้อยลง + ย่อเป็นแถบไอคอนได้แบบ AOO
//   · กว้าง 232px · ย่อเหลือ 68px (เฉพาะจอ ≥ 1024px) ปุ่ม PanelLeft มุมบนขวา · จำค่าใน localStorage
//     (lib/use-sidebar-collapsed.ts) — ย่อแล้วเนื้อหา (เช่น /import) กว้างขึ้นเอง เพราะ <main> เป็น flex-1
//   · โหมดย่อ: ซ่อนชื่อ/หัวกลุ่ม/เมนูย่อย · ชี้ไอคอนแล้วชื่อลอยออกมาด้านขวา (.aoo-nav-tip)
//     · กดเมนูที่มีเมนูย่อย = ขยายแผงกลับแล้วกางกลุ่มนั้นให้
//   · มือถือเป็นลิ้นชักเต็มความกว้างเสมอ (ไม่มีโหมดย่อ)
//   · แต่ละเมนูมีสีของเรื่องตัวเอง (tone) — หน้าที่เปิดอยู่เป็นพื้นสีเต็ม · สไตล์อยู่ที่ .aoo-nav-* ใน globals.css
//   · เมนูย่อยไม่มีไอคอน (ไอคอนซ้ำ ๆ ทำให้รก) · ไม่มีเงา
//
// โครงกลุ่ม (เดิม 21 แถวบนสุดสำหรับแอดมิน → เหลือ 15):
//   (บนสุด)  — Dashboard · งานของทีม · รออนุมัติ (ใบอนุมัติทุกชนิดรวมเป็นกลุ่มเดียว)
//   ของฉัน   — เช็คอิน/เอาท์ · การลา · เบิกค่าใช้จ่าย
//   งาน      — ส่งของ · การผลิต · SRP · นำเข้า · เว็บไซต์ · SEO / AEO
//   จัดการ   — พนักงาน (+ เงินเดือน + เอกสารบริษัท) · รายงาน · ตั้งค่าระบบ
//
// ⚠️ สิทธิ์ (roles) ของทุกเมนูคงเดิมทุกตัว — ย้ายแค่ที่อยู่ · เมนูแม่ที่รวมลูกหลายสิทธิ์ใช้ roles = ยูเนียนของลูก
//    และลูกแต่ละตัวยังกรองด้วย roles ของตัวเอง

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Settings,
  Clock,
  ChevronDown,
  Truck,
  Calculator,
  Globe,
  TrendingUp,
  ListChecks,
  Ship,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { UserData } from '@/hooks/useAuth'
import type { StatTone } from '@/components/shared'
import { useSidebarCollapsed } from '@/lib/use-sidebar-collapsed'

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
  /** ย่อเป็นแถบไอคอนได้ — ตัวบนเดสก์ท็อปเท่านั้น (ลิ้นชักมือถือเต็มความกว้างเสมอ) */
  collapsible?: boolean
}

const icon = (I: typeof Clock) => <I size={17} strokeWidth={2} />

const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: icon(LayoutDashboard), tone: 'accent' },
      // บอร์ดงาน (27 ต.ค. 69) — ทุกคนเห็นงานของทุกคน กรองตามคน/แบรนด์ได้ในหน้า
      { label: 'งานของทีม', href: '/tasks', icon: icon(ListChecks), tone: 'accent' },
      {
        // งานอนุมัติทั้งหมดรวมเป็นกลุ่มเดียว (เดิมเป็นหัวข้อแยก 5 แถว) · พนักงานทั่วไปไม่เห็นเลย
        // roles = ยูเนียนของลูก · ลูกแต่ละตัวกรองสิทธิ์เองเหมือนเดิม
        label: 'รออนุมัติ',
        icon: icon(ClipboardCheck),
        tone: 'danger',
        roles: ['hr', 'admin', 'manager', 'finance'],
        subItems: [
          { label: 'เช็คอินรอตรวจ', href: '/checkin/pending', roles: ['hr', 'admin'] },
          { label: 'คำขอลา', href: '/leaves/management', roles: ['hr', 'admin', 'manager'] },
          { label: 'ใบสลับวันหยุด', href: '/leaves/swap/management', roles: ['hr', 'admin', 'manager'] },
          // 'finance' = ตำแหน่งบัญชี (role employee) ดู roleKeys
          { label: 'พนักงานใหม่', href: '/employees/pending', roles: ['hr', 'admin', 'manager'] },
        ],
      },
    ],
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
      // เบิกค่าใช้จ่าย /expenses + ใบเบิกในรออนุมัติ และการผลิต /production — ซ่อนจากเมนู (เจ้าของ 30 ต.ค. 69: ยังไม่ได้ใช้จริง,
      // expense_claims / production_batches = 0 แถว) หน้ายังอยู่ เปิดเมนูคืนเมื่อเริ่มใช้
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
          // ตำแหน่งสดจากเครื่องประจำรถ — HR/แอดมินเท่านั้น (ข้อมูลส่วนตัว)
          { label: 'คนขับตอนนี้ (สด)', href: '/delivery/live', roles: ['admin', 'hr'] },
        ],
      },
    ],
  },
  {
    // งานแบรนด์ — ของเจ้าของ + brand manager เท่านั้น (เจ้าของ 30 ต.ค. 69: แยกออกจากงานพนักงานจะได้ไม่งง)
    // สิทธิ์ยังเป็นรายเมนูเหมือนเดิม (srp / import / website) — คนที่ไม่มีสักตัวจะไม่เห็นหัวข้อนี้
    title: 'แบรนด์',
    items: [
      {
        label: 'SRP Calculator',
        icon: icon(Calculator),
        tone: 'plum',
        // 'srp' = ได้รับสิทธิ์อย่างน้อย 1 แบรนด์ (แอดมินเห็นเสมอ) — สิทธิ์รายคนรายแบรนด์
        roles: ['admin', 'srp'],
        href: '/srp',
      },
      {
        // แผนสั่งของนำเข้าตามตู้ — ต้องมีชื่อใน import_access (เจ้าของคนเดียวก่อน · 29 ต.ค. 69)
        label: 'แพลนสั่งของ',
        icon: icon(Ship),
        tone: 'warning',
        roles: ['import'],
        href: '/import',
      },
      {
        label: 'เว็บไซต์',
        icon: icon(Globe),
        tone: 'sky',
        // งานส่วนตัวของเจ้าของ — ไม่มี 'admin' ในลิสต์โดยตั้งใจ ต้องมีชื่อใน web_owners เท่านั้น
        roles: ['website'],
        subItems: [
          { label: 'รายการเว็บ', href: '/websites' },
          { label: 'สั่งงานทั้งฟลีต', href: '/websites/jobs' },
          { label: 'โฮสต์', href: '/websites/hosts' },
          { label: 'สลิปรอตรวจ', href: '/websites/slips' },
          { label: 'รุ่น/คอร์ส', href: '/websites/courses' },
        ],
      },
      {
        // แยกจากเว็บไซต์ (เจ้าของสั่ง 6 ต.ค. 69 — คนละงาน: บริการดูแล SEO/AEO เป็นอีกโปรเจกต์)
        // ตั้งค่าเว็บ SEO เข้าจากปุ่มบนหน้า /seo
        label: 'SEO / AEO',
        icon: icon(TrendingUp),
        tone: 'success',
        roles: ['website'],
        href: '/seo',
      },
    ],
  },
  {
    title: 'จัดการ',
    items: [
      {
        // รวมงาน HR ที่เกี่ยวกับคน (เดิม พนักงาน · สรุปเงินเดือน · เอกสารบริษัท แยกกัน 3 แถว)
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
          { label: 'สรุปเงินเดือน', href: '/payroll', roles: ['hr', 'admin'] },
          // จดหมาย/ประกาศจากแม่แบบกลาง — หน้าเดียวใช้ได้ทั้ง 3 บริษัท (สลับแค่โลโก้+ข้อมูล)
          { label: 'เอกสารบริษัท', href: '/documents', roles: ['hr', 'admin', 'manager'] },
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

export default function Sidebar({ userData, onNavigate, collapsible = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expanded, setExpanded] = useState<string[]>([])
  const current = useMemo(() => matchHref(pathname), [pathname])
  const { collapsed, setCollapsed, toggleCollapsed } = useSidebarCollapsed()
  const rail = collapsible && collapsed
  // ชื่อเมนูที่ลอยออกมาตอนชี้ไอคอนในโหมดย่อ — position: fixed จึงไม่โดน overflow ของ <nav> ตัด
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null)

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
    ...(userData?.importAccess ? ['import'] : []),
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

  // เปลี่ยนหน้า/สลับโหมดแล้วเก็บป้ายชื่อที่ลอยอยู่
  useEffect(() => setTip(null), [pathname, rail])

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

  // โหมดย่อ: ชี้/โฟกัสไอคอน → โชว์ชื่อด้านขวา
  const tipProps = (label: string) =>
    rail
      ? {
          'aria-label': label,
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect()
            setTip({ label, top: r.top + r.height / 2, left: r.right + 10 })
          },
          onFocus: (e: React.FocusEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect()
            setTip({ label, top: r.top + r.height / 2, left: r.right + 10 })
          },
          onMouseLeave: () => setTip(null),
          onBlur: () => setTip(null),
        }
      : {}

  const renderItem = (item: NavItem) => {
    const subs = item.subItems?.filter((s) => allowed(s.roles))
    // เมนูแม่ที่ลูกโดนกรองสิทธิ์ออกหมด — ไม่ต้องโชว์แม่เปล่า ๆ
    if (item.subItems && !subs?.length) return null
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
          {...tipProps(item.label)}
        >
          <span className="aoo-nav-item__icon">{item.icon}</span>
          <span className="aoo-nav-item__label">{item.label}</span>
        </Link>
      )
    }

    return (
      <div key={item.label} data-tone={item.tone}>
        <button
          onClick={() => {
            // โหมดย่อซ่อนเมนูย่อย — กดแล้วขยายแผงกลับและกางกลุ่มนี้ให้ (แบบ AOO)
            if (rail) {
              setCollapsed(false)
              setExpanded((prev) => (prev.includes(item.label) ? prev : [...prev, item.label]))
              return
            }
            toggle(item.label)
          }}
          aria-expanded={rail ? false : isOpen}
          data-child-active={childActive || undefined}
          className="aoo-nav-item"
          {...tipProps(item.label)}
        >
          <span className="aoo-nav-item__icon">{item.icon}</span>
          <span className="aoo-nav-item__label text-left">{item.label}</span>
          <ChevronDown size={15} className="aoo-nav-item__chevron" />
        </button>

        {isOpen && !rail && (
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
    <aside className="aoo-sidebar" data-collapsed={rail || undefined}>
      <div className="aoo-sidebar__head">
        {!rail && (
          <button onClick={() => go('/dashboard')} className="flex min-w-0 flex-1 items-center gap-2">
            <img src="/amgo-logo.svg" alt="AMGO" className="h-7 w-auto" />
            <span className="truncate text-sm font-bold tracking-[0.12em] text-gray-700">AMGO HR</span>
          </button>
        )}
        {/* ย่อ/ขยายเมนู — เฉพาะตัวบนเดสก์ท็อป */}
        {collapsible && (
          <button
            onClick={toggleCollapsed}
            className="aoo-sidebar__toggle"
            aria-label={rail ? 'ขยายเมนู' : 'ย่อเมนู'}
            title={rail ? 'ขยายเมนู' : 'ย่อเมนู'}
          >
            {rail ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
      </div>

      <nav
        className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1"
        onScroll={() => tip && setTip(null)}
      >
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

      {tip && (
        // ตำแหน่งคำนวณจากไอคอนที่ชี้อยู่ (ค่าไดนามิกจริง จึงต้องเป็น inline style)
        <div className="aoo-nav-tip" role="tooltip" style={{ top: tip.top, left: tip.left }}>
          {tip.label}
        </div>
      )}
    </aside>
  )
}
