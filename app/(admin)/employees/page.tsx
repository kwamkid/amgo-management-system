'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUsers, useUserStatistics } from '@/hooks/useUsers'
import { User } from '@/types/user'
import EndEmploymentDialog from '@/components/users/EndEmploymentDialog'
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Table2,
  Settings2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sortRows, type SortState } from '@/components/shared/DataTable'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button, ActionMenu, useConfirm } from '@/components/aoo'
import { useToast } from '@/hooks/useToast'
import { reactivateUser } from '@/lib/services/userService'
import {
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  DataTable,
  UserCell,
  FilterBar,
  FilterSelect,
  TableFooter,
  TechLoader,
  type Column,
} from '@/components/shared'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'ผู้ดูแลระบบ' },
  { value: 'hr', label: 'ฝ่ายบุคคล' },
  { value: 'manager', label: 'ผู้จัดการ' },
  { value: 'employee', label: 'พนักงาน' },
  { value: 'driver', label: 'พนักงานขับรถ' },
  { value: 'marketing', label: 'การตลาด' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'ยังทำงานอยู่' },
  { value: 'inactive', label: 'สิ้นสุดแล้ว' },
]

const PER_PAGE = 25

/** คอลัมน์ที่ผู้ใช้เปิด/ปิดเองได้ — จำไว้ใน localStorage ต่อเครื่อง */
const TOGGLEABLE_COLUMNS: { key: string; label: string }[] = [
  { key: 'contact', label: 'ติดต่อ' },
  { key: 'role', label: 'สิทธิ์' },
  { key: 'status', label: 'สถานะ' },
  { key: 'start', label: 'เริ่มงาน / อายุงาน' },
  { key: 'company', label: 'บริษัท' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'birthday', label: 'วันเกิด' },
  { key: 'bank', label: 'บัญชีธนาคาร' },
]
const DEFAULT_VISIBLE = ['contact', 'role', 'status', 'start']
const COLUMNS_STORAGE_KEY = 'employees.columns.v1'

/** อายุงานอ่านง่าย ๆ — "2 ปี 3 เดือน" / น้อยกว่าปีก็ "8 เดือน" */
function tenureLabel(start: Date): string {
  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months--
  if (months < 1) return 'ไม่ถึงเดือน'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} เดือน`
  return m ? `${y} ปี ${m} เดือน` : `${y} ปี`
}

export default function EmployeesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>('active')
  // กดการ์ด "รออนุมัติ" — กรองเฉพาะคนที่ needs_approval (เป็นคนละแกนกับสถานะทำงาน)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [company, setCompany] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState>(null)

  // ตัวเลือกบริษัท/ตำแหน่ง — ไว้กรองและโชว์คอลัมน์เสริม
  const [companies, setCompanies] = useState<{ id: string; code: string; name_th: string }[]>([])
  const [positions, setPositions] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    const sb = createClient()
    sb.from('companies').select('id, code, name_th').order('code')
      .then(({ data }) => setCompanies(data ?? []))
    sb.from('job_functions').select('id, name_th')
      .then(({ data }) => setPositions(new Map((data ?? []).map((j) => [j.id, j.name_th]))))
  }, [])

  // คอลัมน์ที่เลือกไว้ — จำต่อเครื่องใน localStorage
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE
    try {
      const saved = JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? '')
      return Array.isArray(saved) ? saved : DEFAULT_VISIBLE
    } catch {
      return DEFAULT_VISIBLE
    }
  })
  const toggleColumn = (key: string) => {
    setVisibleCols((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }
  const [navigating, setNavigating] = useState(false)
  const { confirm, dialog } = useConfirm()
  const { showToast } = useToast()

  /** ออกไปแล้ว = ลาออก · เลิกจ้าง · เกษียณ */
  const isEnded = (u: User) =>
    ['resigned', 'terminated', 'retired'].includes(
      (u as { employmentStatus?: string }).employmentStatus ?? ''
    )


  const [endOpen, setEndOpen] = useState(false)
  const [toEnd, setToEnd] = useState<User | null>(null)

  const { users, loading, refetch, searchUsers } = useUsers({
    pageSize: 500,
    role: role || undefined,
    isActive: status === null ? undefined : status === 'active',
    searchTerm: search,
  })

  const { statistics } = useUserStatistics()

  // หน่วงการค้นหา ไม่ให้ยิงทุกตัวอักษร
  useEffect(() => {
    const timer = setTimeout(() => (search ? searchUsers(search) : refetch()), 500)
    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setPage(1), [search, role, status, company, sort, pendingOnly])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = users
    if (pendingOnly) list = list.filter((u) => u.needsApproval)
    if (company) list = list.filter((u) => u.companyId === company)
    if (!q) return list
    return list.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.nickname?.toLowerCase().includes(q) ||
        u.lineDisplayName?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.discordUsername?.toLowerCase().includes(q)
    )
  }, [users, search, company, pendingOnly])

  const handleEdit = (userId: string) => {
    setNavigating(true)
    router.push(`/employees/${userId}/edit`)
  }

  const handleEndEmployment = (user: User) => {
    setToEnd(user)
    setEndOpen(true)
  }

  const handleReactivate = async (user: User) => {
    const ok = await confirm({
      title: `ให้ ${user.displayName || user.fullName} กลับมาทำงาน?`,
      description:
        'สถานะจะกลับเป็น "ทำงานอยู่" · ล้างวันสุดท้ายที่ทำงานทิ้ง · เข้าใช้งานระบบได้ตามปกติ',
      confirmLabel: 'ให้กลับมาทำงาน',
      tone: 'primary',
    })
    if (!ok) return

    try {
      await reactivateUser(user.id!)
      showToast(`${user.displayName || user.fullName} กลับมาเป็นพนักงานแล้ว`, 'success')
      refetch()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const allColumns: Column<User>[] = [
    {
      key: 'code',
      header: 'รหัส',
      width: 56,
      sortValue: (u) => u.employeeCode ?? null,
      cell: (u) => (
        <span className="font-mono tabular-nums text-sm text-gray-600">
          {u.employeeCode != null ? String(u.employeeCode).padStart(3, '0') : '-'}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'พนักงาน',
      width: 260,
      sortValue: (u) => u.displayName || u.fullName,
      cell: (u) => (
        // กดที่ชื่อเข้าหน้าแก้ไขได้เลย — เร็วกว่าไปเปิดเมนู ⋯ ทุกครั้ง
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleEdit(u.id!)}
          onKeyDown={(e) => e.key === 'Enter' && handleEdit(u.id!)}
          className="flex min-w-0 cursor-pointer items-center gap-2 hover:opacity-80"
        >
          <UserCell
            // ชื่อจริง (ชื่อเล่น) — ชื่อ LINE ย้ายไปบรรทัดล่างเพราะดูไม่ออกว่าใคร
            name={u.displayName || u.fullName}
            userId={u.id}
            imageUrl={u.linePictureUrl}
            subtitle={u.lineDisplayName}
            size="md"
          />
          {u.nameVerified === false && (
            <span
              title="ชื่อนี้ยังเป็นชื่อจาก LINE ยังไม่มีใครกรอกชื่อจริง"
              className="shrink-0 rounded-md bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-orange-700"
            >
              ยังไม่มีชื่อจริง
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'ติดต่อ',
      cell: (u) => (
        <div className="space-y-0.5 text-sm text-gray-600">
          {u.phone && (
            <div className="flex items-center gap-1.5">
              <Phone size={13} className="text-gray-400" />
              <span className="font-mono tabular-nums">{u.phone}</span>
            </div>
          )}
          {!!u.allowedLocationIds?.length && (
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className="text-gray-400" />
              <span>{u.allowedLocationIds.length} สาขา</span>
            </div>
          )}
          {!u.phone && !u.allowedLocationIds?.length && <span className="text-gray-300">—</span>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'สิทธิ์',
      sortValue: (u) => u.role,
      cell: (u) => <StatusBadge status={u.role} />,
    },
    {
      key: 'status',
      header: 'สถานะ',
      sortValue: (u) =>
        u.needsApproval ? 'pending' : ((u as { employmentStatus?: string }).employmentStatus ?? ''),
      // แสดงสถานะจริง (ทดลองงาน/ลาออก/เลิกจ้าง/เกษียณ) ไม่ใช่แค่เปิด-ปิดการใช้งาน
      // คนที่ยังไม่ผ่านอนุมัติต้องขึ้น "รออนุมัติ" ก่อนเสมอ — ไม่งั้นขึ้นทำงานอยู่ทั้งที่ยังไม่รับเข้า
      cell: (u) => (
        <StatusBadge
          status={
            u.needsApproval
              ? 'pending'
              : ((u as { employmentStatus?: string }).employmentStatus ??
                (u.isActive ? 'active' : 'resigned'))
          }
        />
      ),
    },
    {
      // วันเริ่มงานจริง + อายุงาน — วันสมัครเข้าระบบไม่มีใครอยากรู้
      key: 'start',
      header: 'เริ่มงาน',
      hideOnMobile: true,
      sortValue: (u) => (u.startDate ? new Date(u.startDate).getTime() : null),
      cell: (u) =>
        u.startDate ? (
          <div className="text-sm">
            <p className="text-gray-800">
              {new Date(u.startDate).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="text-xs text-gray-500">{tenureLabel(new Date(u.startDate))}</p>
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'company',
      header: 'บริษัท',
      hideOnMobile: true,
      sortValue: (u) => companies.find((c) => c.id === u.companyId)?.code ?? null,
      cell: (u) => {
        const c = companies.find((x) => x.id === u.companyId)
        return c ? (
          <span className="text-sm text-gray-700" title={c.name_th}>{c.code}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )
      },
    },
    {
      key: 'position',
      header: 'ตำแหน่ง',
      sortValue: (u) => (u.jobFunctionId && positions.get(u.jobFunctionId)) || null,
      cell: (u) => {
        const name = u.jobFunctionId ? positions.get(u.jobFunctionId) : null
        return name ? (
          <span className="text-sm text-gray-700">{name}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )
      },
    },
    {
      key: 'birthday',
      header: 'วันเกิด',
      hideOnMobile: true,
      sortValue: (u) => (u.birthDate ? new Date(u.birthDate).getTime() : null),
      cell: (u) =>
        u.birthDate ? (
          <span className="text-sm text-gray-600">
            {new Date(u.birthDate).toLocaleDateString('th-TH', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'bank',
      header: 'บัญชีธนาคาร',
      hideOnMobile: true,
      sortValue: (u) => u.bankName ?? null,
      cell: (u) =>
        u.bankAccountNo ? (
          <div className="text-sm">
            <p className="text-gray-800">{u.bankName}</p>
            <p className="font-mono text-xs tabular-nums text-gray-500">{u.bankAccountNo}</p>
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 48,
      mobileFooterAction: true,
      cell: (u) => (
        <ActionMenu
          items={[
            { label: 'แก้ไขข้อมูล', icon: 'Pencil', onSelect: () => handleEdit(u.id!) },
            {
              // ทางลัดเข้าแท็บเงินเดือนตรง ๆ — งานที่ HR เข้าบ่อยสุด
              label: 'จัดการเงินเดือน',
              icon: 'Wallet',
              onSelect: () => {
                setNavigating(true)
                router.push(`/employees/${u.id}/edit?tab=pay`)
              },
            },
            {
              label: 'ดู timeline',
              icon: 'History',
              onSelect: () => {
                setNavigating(true)
                router.push(`/employees/${u.id}/edit?tab=timeline`)
              },
            },
            { kind: 'divider' },
            // คนที่ออกไปแล้วเห็นปุ่มกลับกัน — กดผิดหรือกลับมาทำงานใหม่ก็แก้ได้
            // (ไม่มีเมนูลบพนักงาน — เจ้าของสั่งเอาออก ใช้สิ้นสุดการเป็นพนักงานแทน)
            ...(isEnded(u)
              ? [{ label: 'ให้กลับมาทำงาน', icon: 'UserCheck', onSelect: () => handleReactivate(u) }]
              : [
                  {
                    label: 'สิ้นสุดการเป็นพนักงาน',
                    icon: 'UserX',
                    onSelect: () => handleEndEmployment(u),
                  },
                ]),
          ]}
        />
      ),
    },
  ]

  // คอลัมน์ตายตัว (รหัส/ชื่อ/เมนู) + คอลัมน์ที่ผู้ใช้เลือกเปิดไว้
  const columns = allColumns.filter(
    (c) => !TOGGLEABLE_COLUMNS.some((t) => t.key === c.key) || visibleCols.includes(c.key)
  )

  // เรียงทั้งก้อนก่อนค่อยตัดหน้า — ไม่งั้นเรียงแค่ในหน้าที่เห็น
  const sorted = sortRows(filtered, columns, sort)
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if ((loading && users.length === 0) || navigating) return <TechLoader />

  return (
    <>
      {dialog}
      <PageHeader
        title="จัดการพนักงาน"
        description="จัดการข้อมูลและสิทธิ์การใช้งานของพนักงาน"
        icon={Users}
        actions={
          <>
            <Link href="/employees/bulk">
              <Button variant="secondary" size="sm">
                <Table2 size={15} /> แก้หลายคนพร้อมกัน
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              icon="RefreshCw"
              title="รีเฟรชข้อมูล"
              onClick={() => {
                setSearch('')
                setRole(null)
                setStatus('active')
                setPendingOnly(false)
                refetch()
              }}
            />
          </>
        }
      />

      {/* กดการ์ดเพื่อกรองรายชื่อข้างล่างได้เลย — การ์ดที่เลือกอยู่ขึ้นกรอบสี */}
      <StatGrid>
        <StatCard
          label="ทั้งหมด"
          value={statistics.total}
          unit="คน"
          icon={Users}
          selected={!pendingOnly && status === null}
          onClick={() => {
            setPendingOnly(false)
            setStatus(null)
          }}
        />
        <StatCard
          label="ใช้งาน"
          value={statistics.active}
          unit="คน"
          icon={CheckCircle}
          tone="success"
          selected={!pendingOnly && status === 'active'}
          onClick={() => {
            setPendingOnly(false)
            setStatus('active')
          }}
        />
        <StatCard
          label="รออนุมัติ"
          value={statistics.pending}
          unit="คน"
          icon={Clock}
          tone="warning"
          selected={pendingOnly}
          onClick={() => {
            // คนรออนุมัติอาจยังไม่ active — ปลดตัวกรองสถานะให้เห็นครบ
            setPendingOnly(true)
            setStatus(null)
          }}
        />
        <StatCard
          label="สิ้นสุดแล้ว"
          value={statistics.inactive}
          unit="คน"
          icon={XCircle}
          tone="danger"
          selected={!pendingOnly && status === 'inactive'}
          onClick={() => {
            setPendingOnly(false)
            setStatus('inactive')
          }}
        />
      </StatGrid>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="ค้นหาชื่อ ชื่อเล่น เบอร์โทร LINE"
      >
        <FilterSelect label="สิทธิ์" value={role} options={ROLE_OPTIONS} onChange={setRole} />
        <FilterSelect
          label="สถานะ"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(v) => {
            // เปลี่ยนสถานะเองจาก dropdown = เลิกโหมดรออนุมัติ
            setPendingOnly(false)
            setStatus(v)
          }}
        />
        <FilterSelect
          label="บริษัท"
          value={company}
          options={companies.map((c) => ({ value: c.id, label: c.name_th }))}
          onChange={setCompany}
        />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="เลือกคอลัมน์ที่แสดง"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Settings2 size={15} className="text-gray-400" />
              คอลัมน์
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3">
            <p className="mb-2 text-xs font-medium text-gray-500">คอลัมน์ที่แสดง (จำไว้ในเครื่องนี้)</p>
            <div className="space-y-2">
              {TOGGLEABLE_COLUMNS.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={visibleCols.includes(c.key)}
                    onCheckedChange={() => toggleColumn(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paginated}
        rowKey={(u) => u.id!}
        sort={sort}
        onSortChange={setSort}
        loading={loading}
        emptyTitle={
          search
            ? 'ไม่พบพนักงานที่ค้นหา'
            : pendingOnly
              ? 'ไม่มีคนรออนุมัติ'
              : 'ยังไม่มีพนักงาน'
        }
        emptyBody={search ? `ไม่มีผลลัพธ์สำหรับ "${search}"` : undefined}
      />

      <TableFooter
        page={page}
        pageSize={PER_PAGE}
        total={filtered.length}
        onPageChange={setPage}
        unit="คน"
      />

      <EndEmploymentDialog
        user={toEnd}
        open={endOpen}
        onOpenChange={setEndOpen}
        onSuccess={() => {
          setToEnd(null)
          refetch()
        }}
      />

    </>
  )
}
