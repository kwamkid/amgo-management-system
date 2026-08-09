'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUsers, useUserStatistics } from '@/hooks/useUsers'
import { User } from '@/types/user'
import DeleteUserDialog from '@/components/users/DeleteUserDialog'
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Table2,
} from 'lucide-react'
import { Button, ActionMenu, Pagination } from '@/components/aoo'
import {
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  DataTable,
  UserCell,
  FilterBar,
  FilterSelect,
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
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ระงับ' },
]

const PER_PAGE = 20

export default function EmployeesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>('active')
  const [page, setPage] = useState(1)
  const [navigating, setNavigating] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<User | null>(null)

  const { users, loading, deactivateUser, refetch, searchUsers } = useUsers({
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

  useEffect(() => setPage(1), [search, role, status])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.lineDisplayName?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.discordUsername?.toLowerCase().includes(q)
    )
  }, [users, search])

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page]
  )

  const handleEdit = (userId: string) => {
    setNavigating(true)
    router.push(`/employees/${userId}/edit`)
  }

  const handleDeactivate = async (user: User) => {
    if (confirm(`ต้องการระงับการใช้งานของ ${user.fullName} ใช่หรือไม่?`)) {
      await deactivateUser(user.id!)
    }
  }

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'พนักงาน',
      width: 220,
      cell: (u) => (
        <UserCell
          name={u.fullName}
          userId={u.id}
          imageUrl={u.linePictureUrl}
          subtitle={u.lineDisplayName}
          size="md"
        />
      ),
    },
    {
      key: 'contact',
      header: 'ติดต่อ',
      hideOnMobile: true,
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
    { key: 'role', header: 'สิทธิ์', cell: (u) => <StatusBadge status={u.role} /> },
    {
      key: 'status',
      header: 'สถานะ',
      cell: (u) => <StatusBadge status={u.isActive ? 'active' : 'terminated'} label={u.isActive ? 'ใช้งาน' : 'ระงับ'} />,
    },
    {
      key: 'joined',
      header: 'เข้าร่วม',
      hideOnMobile: true,
      cell: (u) =>
        u.createdAt ? (
          <span className="text-sm text-gray-600">
            {new Date(u.createdAt).toLocaleDateString('th-TH', {
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
      key: 'actions',
      header: '',
      align: 'right',
      width: 48,
      cell: (u) => (
        <ActionMenu
          items={[
            { label: 'แก้ไขข้อมูล', icon: 'Pencil', onSelect: () => handleEdit(u.id!) },
            { kind: 'divider' },
            {
              label: 'ระงับการใช้งาน',
              icon: 'UserX',
              disabled: !u.isActive,
              onSelect: () => handleDeactivate(u),
            },
            {
              label: 'ลบพนักงาน',
              icon: 'Trash2',
              tone: 'danger',
              onSelect: () => {
                setToDelete(u)
                setDeleteOpen(true)
              },
            },
          ]}
        />
      ),
    },
  ]

  if ((loading && users.length === 0) || navigating) return <TechLoader />

  return (
    <>
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
                refetch()
              }}
            />
          </>
        }
      />

      <StatGrid>
        <StatCard label="ทั้งหมด" value={statistics.total} unit="คน" icon={Users} />
        <StatCard label="ใช้งาน" value={statistics.active} unit="คน" icon={CheckCircle} tone="success" />
        <StatCard label="รออนุมัติ" value={statistics.pending} unit="คน" icon={Clock} tone="warning" />
        <StatCard label="ระงับ" value={statistics.inactive} unit="คน" icon={XCircle} tone="danger" />
      </StatGrid>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="ค้นหาชื่อ เบอร์โทร LINE"
      >
        <FilterSelect label="สิทธิ์" value={role} options={ROLE_OPTIONS} onChange={setRole} />
        <FilterSelect label="สถานะ" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paginated}
        rowKey={(u) => u.id!}
        loading={loading}
        emptyTitle={search ? 'ไม่พบพนักงานที่ค้นหา' : 'ยังไม่มีพนักงาน'}
        emptyBody={search ? `ไม่มีผลลัพธ์สำหรับ "${search}"` : undefined}
      />

      {filtered.length > PER_PAGE && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            pageCount={Math.ceil(filtered.length / PER_PAGE)}
            onPageChange={setPage}
          />
        </div>
      )}

      <DeleteUserDialog
        user={toDelete}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => {
          setToDelete(null)
          refetch()
        }}
      />
    </>
  )
}
