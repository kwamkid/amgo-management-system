// app/(admin)/leaves/quota/page.tsx

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useToast } from '@/hooks/useToast'
import {
  Calendar,
  Users,
  AlertCircle,
  AlertTriangle,
  Heart,
  Briefcase,
  Activity,
  Edit3,
  Check
} from 'lucide-react'
import { SelectMenu, Input, Alert, Pill, Card, Button, IconButton, Popover, type PillTone } from '@/components/aoo'
import TechLoader from '@/components/shared/TechLoader'
import { LeaveQuotaYear, LeaveType } from '@/types/leave'
import {
  getQuotasForYear,
  updateQuota,
  hasQuotaDefaults,
  copyQuotaDefaults,
} from '@/lib/services/leaveService'
import Link from 'next/link'
import CarryOverDialog from '@/components/leave/CarryOverDialog'
import { PageHeader, DataTable, StatCard, StatusBadge, InfoPanel, FilterBar, FilterSelect } from '@/components/shared'
import { Button as AooButton } from '@/components/aoo'
import UserAvatar from '@/components/shared/UserAvatar'

import TableFooter from '@/components/shared/TableFooter'
interface UserQuota {
  user: {
    id: string
    fullName: string
    lineDisplayName: string
    linePictureUrl?: string
    role: string
  }
  quota: LeaveQuotaYear | null
}

interface QuotaEditAllProps {
  userId: string
  userName: string
  userAvatar?: string
  quota: LeaveQuotaYear | null
  onUpdate: (type: LeaveType, newValue: number) => Promise<void>
}

function QuotaEditAll({ 
  userId,
  userName,
  userAvatar,
  quota,
  onUpdate 
}: QuotaEditAllProps) {
  const [isOpen, setIsOpen] = useState(false)
  const editBtnRef = useRef<HTMLSpanElement>(null)
  const [values, setValues] = useState({
    sick: quota?.sick.total || 0,
    personal: quota?.personal.total || 0,
    vacation: quota?.vacation.total || 0
  })
  const [isUpdating, setIsUpdating] = useState(false)

  const leaveInfo = (['sick', 'personal', 'vacation'] as const).map((type) => ({
    type,
    used: quota?.[type].used || 0,
    remaining: quota?.[type].remaining || 0
  }))

  const handleUpdate = async () => {
    setIsUpdating(true)
    
    try {
      // Update all changed values
      const promises = []
      for (const [type, newValue] of Object.entries(values)) {
        const currentValue = quota?.[type as LeaveType].total || 0
        if (newValue !== currentValue) {
          promises.push(onUpdate(type as LeaveType, newValue))
        }
      }
      
      if (promises.length > 0) {
        await Promise.all(promises)
      }
      
      setIsOpen(false)
    } catch (error) {
      console.error('Error updating quotas:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const hasChanges = () => {
    return values.sick !== (quota?.sick.total || 0) ||
           values.personal !== (quota?.personal.total || 0) ||
           values.vacation !== (quota?.vacation.total || 0)
  }

  const resetValues = () => {
    setValues({
      sick: quota?.sick.total || 0,
      personal: quota?.personal.total || 0,
      vacation: quota?.vacation.total || 0
    })
  }

  return (
    <>
      <span ref={editBtnRef} className="inline-flex">
        <IconButton
          icon={Edit3}
          title="แก้โควตา"
          onClick={() => { if (isOpen) { setIsOpen(false); resetValues() } else setIsOpen(true) }}
        />
      </span>
      <Popover open={isOpen} onClose={() => { setIsOpen(false); resetValues() }} anchor={editBtnRef.current} align="end" minWidth={320} padding={16}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2">
            <UserAvatar name={userName} imageUrl={userAvatar} size="sm" />
            <div className="flex-1">
              <h4 className="font-medium text-sm">แก้ไขโควต้า - {userName}</h4>
            </div>
          </div>
          
          {/* Leave Types - Compact Grid */}
          <InfoPanel className="space-y-2">
            {leaveInfo.map(({ type, used }) => (
              <div key={type} className="flex items-center gap-2">
                <div className="min-w-[90px]">
                  <StatusBadge status={type} kind="leaveType" />
                </div>
                
                <Input
                  type="number"
                  value={values[type]}
                  onChange={(e) => setValues({ 
                    ...values, 
                    [type]: parseInt(e.target.value) || 0 
                  })}
                  min="0"
                  max="365"
                  className="w-20"
                />
                
                <div className="text-xs text-gray-500 min-w-[60px]">
                  ใช้ {used} เหลือ {Math.max(0, values[type] - used)}
                </div>
                
                {values[type] < used && (
                  <span className="text-orange-600" title="โควต้าน้อยกว่าที่ใช้ไป">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                )}
              </div>
            ))}
          </InfoPanel>
          
          {/* Summary */}
          <InfoPanel tone="sky" className="flex justify-between text-sm">
            <span className="text-gray-600">รวม</span>
            <span className="font-semibold">
              {values.sick + values.personal + values.vacation} วัน
            </span>
          </InfoPanel>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="soft"
              size="sm"
              onClick={() => {
                resetValues()
                setIsOpen(false)
              }}
              disabled={isUpdating}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button size="sm" onClick={handleUpdate} loading={isUpdating} disabled={!hasChanges()} className="flex-1">
              บันทึก
            </Button>
          </div>
        </div>
      </Popover>
    </>
  )
}

export default function LeaveQuotaManagementPage() {
  const router = useRouter()
  const { userData } = useAuth()
  const { users, loading: usersLoading } = useUsers({ 
    isActive: true,
    pageSize: 100  // เพิ่ม pageSize เพื่อดึงพนักงานทั้งหมด
  })
  const { showToast } = useToast()
  
  const [year, setYear] = useState(new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'no-quota' | 'has-quota'>('all')
  const [loading, setLoading] = useState(false)
  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // CarryOver Dialog state
  const [showCarryOverDialog, setShowCarryOverDialog] = useState(false)

  // ปีหน้าต้องตั้งค่าโควตาไว้ล่วงหน้าตั้งแต่ปลายปีนี้
  // ถ้าไม่ตั้ง พอถึง 1 ม.ค. พนักงานจะยื่นใบลาไม่ได้ และจะไม่มีใครรู้จนมีคนบ่น
  const nextYear = new Date().getFullYear() + 1
  const [nextYearReady, setNextYearReady] = useState<boolean | null>(null)
  const [copyingDefaults, setCopyingDefaults] = useState(false)

  useEffect(() => {
    hasQuotaDefaults(nextYear).then(setNextYearReady).catch(() => setNextYearReady(null))
  }, [nextYear])

  const handleCopyDefaults = async () => {
    setCopyingDefaults(true)
    try {
      const n = await copyQuotaDefaults(nextYear - 1, nextYear, userData!.id!)
      showToast(`ตั้งค่าโควต้าปี ${nextYear + 543} แล้ว ${n} ประเภท`, 'success')
      setNextYearReady(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ตั้งค่าไม่สำเร็จ', 'error')
    } finally {
      setCopyingDefaults(false)
    }
  }

  // Check permission
  const canManage = userData && ['hr', 'manager', 'admin'].includes(userData.role)

  useEffect(() => {
    if (userData && !canManage) {
      router.push('/leaves')
      return
    }
  }, [userData, canManage, router])

  // Fetch quotas for all users
  useEffect(() => {
    if (users.length > 0) {
      fetchAllQuotas()
    }
  }, [users, year])

  const fetchAllQuotas = async () => {
    setLoading(true)
    try {
      // ของเดิมยิงทีละคน = จำนวนพนักงาน query ต่อการเปลี่ยนปี 1 ครั้ง
      const quotas = await getQuotasForYear(users.map((u) => u.id!), year)

      setUserQuotas(
        users.map((user) => ({
          user: {
            id: user.id!,
            // "ชื่อจริง (ชื่อเล่น)" — ชื่อ LINE อ่านแล้วไม่รู้ว่าโควต้าของใคร
            fullName: user.displayName || user.fullName,
            lineDisplayName: user.lineDisplayName,
            linePictureUrl: user.linePictureUrl,
            role: user.role,
          },
          quota: quotas.get(user.id!) ?? null,
        }))
      )
    } catch (error) {
      showToast('ไม่สามารถโหลดข้อมูลโควต้าได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleQuotaUpdate = async (userId: string, type: LeaveType, newValue: number) => {
    try {
      await updateQuota(
        userId, 
        year, 
        type, 
        newValue, 
        userData!.id!, 
        'ปรับปรุงโควต้าประจำปี'
      )
      showToast('บันทึกการเปลี่ยนแปลงสำเร็จ', 'success')
      await fetchAllQuotas() // Refresh data
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error')
    }
  }

  // Filter users
  const filteredQuotas = useMemo(() => {
    return userQuotas.filter(({ user, quota }) => {
      // Search filter
      const matchSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lineDisplayName.toLowerCase().includes(searchTerm.toLowerCase())

      // Quota filter
      let matchFilter = true
      if (filterType === 'no-quota') {
        matchFilter = !quota || (quota.sick.total === 0 && quota.personal.total === 0 && quota.vacation.total === 0)
      } else if (filterType === 'has-quota') {
        matchFilter = quota !== null && (quota.sick.total > 0 || quota.personal.total > 0 || quota.vacation.total > 0)
      }

      return matchSearch && matchFilter
    })
  }, [userQuotas, searchTerm, filterType])

  // Pagination calculations
  const totalPages = Math.ceil(filteredQuotas.length / itemsPerPage)
  const paginatedQuotas = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredQuotas.slice(start, end)
  }, [filteredQuotas, currentPage, itemsPerPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterType, year])

  // Show loading while checking auth
  if (!userData) {
    return <TechLoader />
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl">
        <Alert tone="error" title="ไม่มีสิทธิ์เข้าถึงหน้านี้">
          เฉพาะ HR และ Admin เท่านั้น
        </Alert>
        <div className="mt-4 text-center">
          <Link href="/leaves">
            <Button variant="soft">
              กลับไปหน้าการลา
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (loading || usersLoading) {
    return <TechLoader />
  }

  // สีตามประเภทลา (ตรงกับ StatusBadge kind="leaveType")
  const leaveTypes: { type: LeaveType; label: string; icon: typeof Heart; tone: PillTone }[] = [
    { type: 'sick', label: 'ลาป่วย', icon: Heart, tone: 'pink' },
    { type: 'personal', label: 'ลากิจ', icon: Briefcase, tone: 'sky' },
    { type: 'vacation', label: 'ลาพักร้อน', icon: Activity, tone: 'success' },
  ]

  // Check if user has no quota
  const hasNoQuota = (quota: LeaveQuotaYear | null) => {
    return !quota || (quota.sick.total === 0 && quota.personal.total === 0 && quota.vacation.total === 0)
  }

  // Calculate stats
  const stats = {
    total: filteredQuotas.length,
    noQuota: filteredQuotas.filter(uq => hasNoQuota(uq.quota)).length,
    hasQuota: filteredQuotas.filter(uq => !hasNoQuota(uq.quota)).length
  }

  return (
    <div className="space-y-6">
      {nextYearReady === false && (
        <Alert tone="warning" title={`ยังไม่ได้ตั้งโควต้าตั้งต้นของปี ${nextYear + 543}`}>
          <p>
            ต้องตั้งไว้ก่อนขึ้นปีใหม่ ไม่งั้นวันที่ 1 มกราคม พนักงานจะยื่นใบลาไม่ได้
            เพราะไม่มีโควต้า
          </p>
          <AooButton
            variant="secondary"
            size="sm"
            className="mt-3"
            loading={copyingDefaults}
            onClick={handleCopyDefaults}
          >
            {copyingDefaults ? 'กำลังตั้งค่า...' : `คัดลอกค่าจากปี ${nextYear + 542}`}
          </AooButton>
        </Alert>
      )}

      <PageHeader
        title="จัดการโควต้าการลา"
        description="กำหนดจำนวนวันลาสำหรับพนักงานแต่ละคน"
        icon={Calendar}
        backHref="/leaves"
        actions={
          <>
            <AooButton
              variant="secondary"
              size="sm"
              icon="RefreshCw"
              onClick={() => setShowCarryOverDialog(true)}
            >
              ยกยอดโควต้าปีใหม่
            </AooButton>
            <div className="w-28">
              <SelectMenu
                size="md"
                value={String(year)}
                onChange={(v) => v && setYear(Number(v))}
                searchThreshold={99}
                options={[-1, 0, 1].map((offset) => {
                  const y = new Date().getFullYear() + offset
                  // แสดงเป็น พ.ศ. ตามที่คนไทยใช้ แต่เก็บเป็น ค.ศ.
                  return { value: String(y), label: `${y + 543}` }
                })}
              />
            </div>
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="พนักงานทั้งหมด" value={stats.total} icon={Users} tone="sky" />
        <StatCard label="มีโควต้าแล้ว" value={stats.hasQuota} icon={Check} tone="success" />
        <StatCard label="ยังไม่มีโควต้า" value={stats.noQuota} icon={AlertCircle} tone="warning" />
        <StatCard label="ปีที่จัดการ" value={year} icon={Calendar} tone="grape" />
      </div>

      {/* Filters */}
      <FilterBar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="ค้นหาด้วยชื่อพนักงาน..."
        sticky={false}
      >
        <FilterSelect
          label="กรองข้อมูล"
          value={filterType === 'all' ? null : filterType}
          options={[
            { value: 'has-quota', label: 'มีโควต้าแล้ว' },
            { value: 'no-quota', label: 'ยังไม่มีโควต้า' },
          ]}
          onChange={(v) => setFilterType((v ?? 'all') as typeof filterType)}
        />
      </FilterBar>

      {/* Table */}
      <Card padding={0} className="overflow-hidden">
        <DataTable
          columns={[
            {
              key: 'user', header: 'พนักงาน', mobilePrimary: true, sortValue: ({ user }) => user.fullName,
              cell: ({ user }) => (
                <div className="flex items-center gap-3">
                  <UserAvatar name={user.fullName} userId={user.id} size="md" />
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-gray-500">@{user.lineDisplayName}</p>
                  </div>
                </div>
              ),
            },
            ...leaveTypes.map(({ type, label, tone }) => ({
              key: type,
              header: <StatusBadge status={type} kind="leaveType" />,
              align: 'center' as const,
              mobileLabel: label,
              cell: ({ quota }: { quota: (typeof paginatedQuotas)[number]['quota'] }) => (
                <InfoPanel tone={tone}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-lg">{quota?.[type].total || 0}</span>
                    <div className="text-xs text-gray-600">
                      ใช้ {quota?.[type].used || 0} / เหลือ {quota?.[type].remaining || 0}
                    </div>
                  </div>
                </InfoPanel>
              ),
            })),
            {
              key: 'status', header: 'สถานะ', align: 'center', mobileFooterAction: true,
              cell: ({ user, quota }) => (
                <div className="flex items-center justify-center gap-2">
                  <QuotaEditAll
                    userId={user.id}
                    userName={user.fullName}
                    userAvatar={user.linePictureUrl}
                    quota={quota}
                    onUpdate={(type, newValue) => handleQuotaUpdate(user.id, type, newValue)}
                  />
                  {hasNoQuota(quota) ? (
                    <Pill tone="warning">ยังไม่กำหนด</Pill>
                  ) : (
                    <Pill tone="success">กำหนดแล้ว</Pill>
                  )}
                </div>
              ),
            },
          ]}
          rows={paginatedQuotas}
          rowKey={({ user }) => user.id}
          rowClassName={({ quota }) => (hasNoQuota(quota) ? 'bg-orange-50' : undefined)}
          emptyTitle="ไม่พบข้อมูลพนักงาน"
        />

        {/* Pagination */}
        {filteredQuotas.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <TableFooter page={currentPage} pageSize={itemsPerPage} total={filteredQuotas.length} onPageChange={setCurrentPage} onPageSizeChange={setItemsPerPage} />
          </div>
        )}
      </Card>

      {/* CarryOver Dialog */}
      <CarryOverDialog
        open={showCarryOverDialog}
        onOpenChange={setShowCarryOverDialog}
        users={users.map(u => ({ id: u.id!, fullName: u.displayName || u.fullName }))}
        currentYear={year}
        executedBy={userData?.id || ''}
        onSuccess={fetchAllQuotas}
      />
    </div>
  )
}