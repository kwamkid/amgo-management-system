// components/users/UserEditForm.tsx
//
// แก้ไขข้อมูลพนักงาน — แบ่งเป็นแท็บ
//
// ── ทำไมต้องแท็บ ──────────────────────────────────────────────────────
// ของเดิมวางเรียงลงมา 4 กล่อง (ค่าตอบแทน · ส่วนตัว · การทำงาน · สถานะ)
// ต้องเลื่อนยาวกว่าจะเจอสิ่งที่จะแก้ และเรื่องที่ไม่เกี่ยวกันเลยอยู่ติดกัน
//
// ── แท็บกับปุ่มบันทึก ─────────────────────────────────────────────────
// ทุกแท็บอยู่ใน <form> เดียวกัน สลับแท็บคือซ่อน/แสดงเฉย ๆ ไม่ใช่ unmount
// กรอกแท็บ 1 แล้วข้ามไปแก้แท็บ 3 กดบันทึกทีเดียวได้ครบ ไม่หายกลางทาง
// (แท็บเงินเดือนเป็นข้อยกเว้น — PayCard บันทึกของตัวเองทันทีที่กด)

'use client'

import { useEffect, useRef, useState } from 'react'
import { User, UpdateUserData } from '@/types/user'
import { toDate } from '@/lib/utils/date'
import LocationMultiSelect from './LocationMultiSelect'
import { createClient } from '@/lib/supabase/client'
import PayCard from './PayCard'
import EmployeeTimeline from './EmployeeTimeline'
import RemarksCard from './RemarksCard'
import EndEmploymentDialog from './EndEmploymentDialog'
import WorkScheduleCard from './WorkScheduleCard'
import { TabBar, TabItem } from '@/components/aoo'
import { Segmented } from '@/components/shared'
import { Phone, Calendar, Save, X, Banknote } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROLE_TH: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ — แก้ได้ทุกคน',
  hr: 'ฝ่ายบุคคล — แก้ได้ทุกคน (ยกเว้นผู้ดูแลระบบ)',
  manager: 'ผู้จัดการ',
  employee: 'พนักงาน',
  driver: 'พนักงานขับรถ (เห็นงานส่งของ)',
  marketing: 'การตลาด (เห็นเมนู influencer)',
}

interface UserEditFormProps {
  user: User
  onSubmit: (data: UpdateUserData) => Promise<boolean>
  onCancel: () => void
  isLoading?: boolean
}

export default function UserEditForm({ 
  user, 
  onSubmit, 
  onCancel,
  isLoading = false 
}: UserEditFormProps) {
  // Convert birthDate to proper format for input[type="date"]
  const formatDateForInput = (date: any): string => {
    const dateObj = toDate(date)
    if (!dateObj) return ''
    
    // Format as YYYY-MM-DD for HTML date input
    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // เปิดลิงก์ ?tab=timeline มาจากหน้ารายชื่อ/กล่องทดลองงานได้เลย
  const [tab, setTab] = useState<'info' | 'pay' | 'location' | 'timeline' | 'remarks'>(() => {
    if (typeof window === 'undefined') return 'info'
    const t = new URLSearchParams(window.location.search).get('tab')
    return t === 'timeline' || t === 'pay' || t === 'location' || t === 'remarks' ? t : 'info'
  })

  // ตัวเลือกบริษัทกับตำแหน่ง — ตำแหน่งเป็นตัวกำหนดสิทธิ์ ตารางงาน รอบจ่ายเงิน
  const [companies, setCompanies] = useState<{ id: string; code: string; name_th: string }[]>([])
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [functions, setFunctions] = useState<
    { id: string; name_th: string; default_role: string | null; ot_eligible: boolean }[]
  >([])

  useEffect(() => {
    const sb = createClient()
    sb.from('companies').select('id, code, name_th').order('code')
      .then(({ data }) => setCompanies(data ?? []))
    sb.from('job_functions').select('id, name_th, default_role, ot_eligible').eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setFunctions(data ?? []))
  }, [])

  const [formData, setFormData] = useState<UpdateUserData>({
    fullName: user.fullName,
    nickname: user.nickname || '',
    phone: user.phone || '',
    birthDate: formatDateForInput(user.birthDate), // This is already a string
    startDate: formatDateForInput(user.startDate),
    nationalId: user.nationalId ?? '',
    address: user.address ?? '',
    // ⚠️ ไม่มี role — สิทธิ์มากับตำแหน่ง trigger ที่ฐานข้อมูลเซ็ตให้เอง
    companyId: user.companyId ?? null,
    jobFunctionId: user.jobFunctionId ?? null,
    allowedLocationIds: user.allowedLocationIds || [],
    allowCheckInOutsideLocation: user.allowCheckInOutsideLocation || false,
    allowWorkFromHome: user.allowWorkFromHome || false,
    requiresCheckin: user.requiresCheckin ?? true,
    employmentStatus: user.employmentStatus ?? 'active',
    employmentType: user.employmentType ?? 'monthly',
    probationEndDate: user.probationEndDate ?? '',
    otEligible: user.otEligible ?? null,
    isActive: user.isActive
  })

  const onProbation = formData.employmentStatus === 'probation'

  // PayCard จัดฉากการแก้ไว้ แล้วฝากฟังก์ชันเขียนจริงมาที่นี่ —
  // ทั้งหน้าบันทึกด้วยปุ่มเดียวท้ายฟอร์ม ไม่มีของบางส่วนหลุดไปก่อน
  const payFlushRef = useRef<(() => Promise<string[]>) | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    if (!formData.fullName?.trim()) {
      setTab('info')
      alert('กรุณากรอกชื่อ-นามสกุล')
      return
    }

    // ชื่อ LINE ดูไม่ออกว่าใครเป็นใคร — รายงานทุกใบเลยอ่านไม่ออกตามไปด้วย
    if (!formData.nickname?.trim()) {
      setTab('info')
      alert('กรุณากรอกชื่อเล่น')
      return
    }

    if (!formData.phone?.trim()) {
      setTab('info')
      alert('กรุณากรอกเบอร์โทรศัพท์')
      return
    }

    if (!formData.birthDate) {
      setTab('info')
      alert('กรุณาระบุวันเกิด')
      return
    }

    // สัญญาทดลองงานกับเงินเดือนหลังพ้นโปร ต้องรู้ว่าโปรจบเมื่อไหร่
    if (formData.employmentStatus === 'probation' && !formData.probationEndDate) {
      setTab('info')
      alert('กรุณาระบุวันพ้นทดลองงาน')
      return
    }
    
    // เงื่อนไขนี้อยู่คนละแท็บกับปุ่มบันทึก — ต้องพาไปให้เห็นด้วย
    // ไม่งั้นขึ้น alert แล้วผู้ใช้หาไม่เจอว่าต้องแก้ตรงไหน
    // (คนที่ไม่ต้องเช็คอิน ไม่ต้องมีสาขา)
    if (
      (formData.requiresCheckin ?? true) &&
      formData.allowedLocationIds?.length === 0 &&
      !formData.allowCheckInOutsideLocation
    ) {
      setTab('location')
      alert('กรุณาเลือกสาขาที่อนุญาตหรืออนุญาตให้เช็คอินนอกสถานที่')
      return
    }
    
    // Format birthDate as ISO string for Firebase
    const dataToSubmit = {
      ...formData,
      birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : undefined,
      probationEndDate:
        formData.employmentStatus === 'probation' ? formData.probationEndDate || null : null,
    }
    
    // ค่าตอบแทนที่จัดฉากไว้ เขียนตอนนี้ — พังข้อไหนหยุดทั้งหน้า ไม่พาไปต่อ
    if (payFlushRef.current) {
      const payErrors = await payFlushRef.current()
      if (payErrors.length) {
        setTab('pay')
        alert(`ค่าตอบแทนบันทึกไม่ผ่าน:\n${payErrors.join('\n')}`)
        return
      }
    }

    await onSubmit(dataToSubmit)
  }

  // Helper function to ensure birthDate is always a string for the input
  const getBirthDateValue = (): string => {
    if (typeof formData.birthDate === 'string') {
      return formData.birthDate
    }
    if (formData.birthDate instanceof Date) {
      return formatDateForInput(formData.birthDate)
    }
    return ''
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TabBar ariaLabel="หมวดข้อมูลพนักงาน">
        <TabItem active={tab === 'info'} onClick={() => setTab('info')} label="ข้อมูล + สถานะ" />
        <TabItem active={tab === 'pay'} onClick={() => setTab('pay')} label="เงินเดือน" />
        <TabItem
          active={tab === 'location'}
          onClick={() => setTab('location')}
          label="สถานที่เช็คอิน"
        />
        <TabItem
          active={tab === 'timeline'}
          onClick={() => setTab('timeline')}
          label="ไทม์ไลน์"
        />
        <TabItem active={tab === 'remarks'} onClick={() => setTab('remarks')} label="โน้ต" />
      </TabBar>

      {/* ── แท็บ 1 · ข้อมูล + สถานะ ─────────────────────────── */}
      <div hidden={tab !== 'info'} className="space-y-5">
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          {/* LINE Info (Read-only) */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="lineDisplayName">LINE Display Name</Label>
              <Input
                id="lineDisplayName"
                type="text"
                value={user.lineDisplayName}
                disabled
                className="bg-gray-50"
              />
            </div>
            
            <div>
              <Label htmlFor="lineUserId">LINE User ID</Label>
              <Input
                id="lineUserId"
                type="text"
                value={user.lineUserId}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>
          
          {/* Editable Fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">ชื่อ-นามสกุล *</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="ชื่อ นามสกุล"
                required
                disabled={isLoading}
              />
              {user.nameVerified === false && (
                <p className="mt-1 text-xs text-orange-700">
                  ตอนนี้ยังเป็นชื่อจาก LINE — กรุณาแก้เป็นชื่อจริง
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="nickname">ชื่อเล่น *</Label>
              <Input
                id="nickname"
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="เช่น แตน"
                required
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                ใช้แสดงในรายงานและปฏิทินวันเกิด — ชื่อ LINE ดูไม่ออกว่าใครเป็นใคร
              </p>
            </div>

            <div>
              <Label htmlFor="phone">เบอร์โทรศัพท์ *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-10"
                  placeholder="0812345678"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="birthDate">วันเกิด *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="birthDate"
                  type="date"
                  value={getBirthDateValue()}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* วันเริ่มงานจริง — เดิมกรอกได้เฉพาะหน้าแก้หลายคนพร้อมกัน ทั้งที่ไทม์ไลน์
                บอกให้มากรอกที่แท็บนี้ (หน่อยหาไม่เจอ 22 ส.ค. 69)
                ค่าตั้งต้นของคนสมัครใหม่คือวันสมัคร ไม่ใช่วันเริ่มงานจริง —
                กรอกมือเมื่อไหร่ถือว่ายืนยันแล้ว */}
            <div>
              <Label htmlFor="startDate">วันเริ่มงาน</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="startDate"
                  type="date"
                  value={(formData.startDate as string) || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      startDate: e.target.value,
                      startDateVerified: !!e.target.value,
                    })
                  }
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {!user.startDateVerified && (
                <p className="mt-1 text-xs text-amber-600">
                  ยังเป็นวันที่สมัครเข้าระบบ ไม่ใช่วันเริ่มงานจริง — ใช้คิดอายุงานกับสัญญาจ้าง
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="nationalId">เลขบัตรประชาชน</Label>
              <Input
                id="nationalId"
                type="text"
                inputMode="numeric"
                maxLength={13}
                value={(formData.nationalId as string) ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, nationalId: e.target.value.replace(/\D/g, '') })
                }
                placeholder="13 หลัก"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">ใช้พิมพ์ในสัญญาจ้าง</p>
            </div>

            <div>
              <Label htmlFor="address">ที่อยู่</Label>
              <Input
                id="address"
                type="text"
                value={(formData.address as string) ?? ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="ที่อยู่ตามทะเบียนบ้าน"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">ใช้พิมพ์ในสัญญาจ้าง</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">ตำแหน่งและสถานะ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* ตำแหน่งเดียวจบ — สิทธิ์ ตารางงาน รอบจ่ายเงิน ตามตำแหน่งอัตโนมัติ */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company">บริษัท</Label>
                <Select
                  value={formData.companyId ?? ''}
                  onValueChange={(v) => setFormData({ ...formData, companyId: v || null })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="company">
                    <SelectValue placeholder="— ยังไม่ระบุ —" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} · {c.name_th}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="jobFunction">ตำแหน่ง</Label>
                <Select
                  value={formData.jobFunctionId ?? ''}
                  onValueChange={(v) => setFormData({ ...formData, jobFunctionId: v || null })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="jobFunction">
                    <SelectValue placeholder="— ยังไม่ระบุ —" />
                  </SelectTrigger>
                  <SelectContent>
                    {functions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name_th}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const picked = functions.find((f) => f.id === formData.jobFunctionId)
                  return picked?.default_role ? (
                    <p className="mt-1 text-xs text-gray-500">
                      ตำแหน่งนี้ได้สิทธิ์ &ldquo;{ROLE_TH[picked.default_role] ?? picked.default_role}&rdquo;
                      และตารางงานของตำแหน่งอัตโนมัติ
                    </p>
                  ) : null
                })()}
              </div>
            </div>

            {/* ทดลองงานหรือผ่านแล้ว — ส่วนการออกจากงานใช้ปุ่มในหน้ารายชื่อ */}
            <div className="grid md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <Label>สถานะการจ้าง</Label>
                <div className="mt-1.5">
                  {['resigned', 'terminated', 'retired'].includes(formData.employmentStatus ?? '') ? (
                    <p className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-500">
                      สิ้นสุดการเป็นพนักงานแล้ว
                    </p>
                  ) : (
                    <Segmented
                      value={formData.employmentStatus ?? 'active'}
                      onChange={(v) => setFormData({ ...formData, employmentStatus: v })}
                      disabled={isLoading}
                      options={[
                        { value: 'probation', label: 'ทดลองงาน' },
                        { value: 'active', label: 'พนักงานประจำ' },
                      ]}
                    />
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  ทดลองงาน = มีช่องวันพ้นโปร ใช้พิมพ์สัญญาทดลองงาน และขึ้นกล่องติดตามบน Dashboard
                </p>
              </div>

              {onProbation && (
                <div>
                  <Label htmlFor="probationEndDate">วันพ้นทดลองงาน *</Label>
                  <Input
                    id="probationEndDate"
                    type="date"
                    value={(formData.probationEndDate as string) || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, probationEndDate: e.target.value })
                    }
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    ใช้ลงวันที่เงินเดือนหลังพ้นโปร (แท็บเงินเดือน) และพิมพ์ในสัญญาทดลองงาน
                  </p>
                </div>
              )}
            </div>

            {/* เปิดใช้งานเป็นสวิตช์ on/off + ปุ่มสิ้นสุดการจ้างอยู่คู่กัน จะได้ไม่งง
                ว่าปิดสวิตช์ = ลาออก (เจ้าของสั่ง 13 ส.ค. 69) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <div className="flex items-center space-x-3">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked as boolean })
                  }
                  disabled={isLoading}
                />
                <div className="space-y-1">
                  <Label htmlFor="isActive" className="text-base font-medium cursor-pointer">
                    เปิดใช้งาน
                  </Label>
                  <p className="text-sm text-gray-500">
                    {formData.isActive
                      ? 'เข้าใช้งานระบบได้ปกติ'
                      : 'ระงับการเข้าระบบชั่วคราว — ยังเป็นพนักงานอยู่'}
                  </p>
                  <p className="text-xs text-gray-400">
                    ไม่ใช่การลาออก — การสิ้นสุดการจ้างใช้ปุ่มด้านขวา (ระบบจะปิดสวิตช์นี้ให้เอง)
                  </p>
                </div>
              </div>

              {user.id && !['resigned', 'terminated', 'retired'].includes(formData.employmentStatus ?? '') && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setShowEndDialog(true)}
                  disabled={isLoading}
                >
                  สิ้นสุดการเป็นพนักงาน…
                </Button>
              )}
            </div>

            {showEndDialog && (
              <EndEmploymentDialog
                user={user}
                open={showEndDialog}
                onOpenChange={setShowEndDialog}
                onSuccess={() => window.location.reload()}
              />
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* ── แท็บ 2 · เงินเดือน ──────────────────────────────── */}
      <div hidden={tab !== 'pay'} className="space-y-5">
        {/* ประเภทการจ้าง + OT ช่องเดียวกัน (เจ้าของสั่ง 13 ส.ค. 69) — คอลัมน์ของ users
            ทั้งคู่ บันทึกผ่านปุ่มบันทึกท้ายฟอร์มเหมือนแท็บแรก */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
            <Banknote size={16} className="text-gray-400" /> การจ้างและค่าล่วงเวลา
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>ประเภทการจ้าง</Label>
              <div className="mt-1.5">
                <Segmented
                  value={(formData.employmentType as string) ?? 'monthly'}
                  onChange={(v) => setFormData({ ...formData, employmentType: v })}
                  disabled={isLoading}
                  options={[
                    { value: 'monthly', label: 'รายเดือน' },
                    { value: 'daily', label: 'รายวัน' },
                  ]}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                รายเดือน = เงินเดือนคงที่ · รายวัน = คิดตามวันที่มาทำงาน
              </p>
            </div>
            <div>
              <Label>ค่าล่วงเวลา (OT)</Label>
              <div className="mt-1.5">
                <Segmented
                  value={formData.otEligible == null ? 'inherit' : formData.otEligible ? 'yes' : 'no'}
                  onChange={(v) =>
                    setFormData({ ...formData, otEligible: v === 'inherit' ? null : v === 'yes' })
                  }
                  disabled={isLoading}
                  options={(() => {
                    const picked = functions.find((f) => f.id === formData.jobFunctionId)
                    const byPosition = picked
                      ? picked.ot_eligible
                        ? 'ได้ OT'
                        : 'ไม่ได้ OT'
                      : 'ไม่ได้ OT'
                    return [
                      { value: 'inherit', label: `ตามตำแหน่ง (${byPosition})` },
                      { value: 'yes', label: 'ได้' },
                      { value: 'no', label: 'ไม่ได้' },
                    ]
                  })()}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                มีผลกับการเติมชั่วโมง OT อัตโนมัติในหน้าสรุปเงินเดือน — HR ยังพิมพ์เองได้เสมอ
              </p>
            </div>
          </div>
        </div>

        {user.id && (
          <PayCard
            userId={user.id}
            editable
            registerFlush={(fn) => (payFlushRef.current = fn)}
          />
        )}

      </div>

      {/* ── แท็บ 3 · สถานที่เช็คอิน ─────────────────────────── *
       * ไล่ตอบทีละคำถาม: ต้องเช็คอินไหม → ถ้าต้อง ค่อยเลือกสาขา
       * และตอบว่านอกสถานที่ได้ไหม — ไม่ต้องเช็คอินก็ไม่มีอะไรให้ตั้งต่อ */}
      <div hidden={tab !== 'location'}>
        <Card className="border-0 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="requiresCheckin"
                checked={formData.requiresCheckin ?? true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requiresCheckin: checked as boolean })
                }
                disabled={isLoading}
              />
              <div className="space-y-1">
                <Label htmlFor="requiresCheckin" className="text-base font-medium cursor-pointer">
                  ต้องเช็คอิน
                </Label>
                <p className="text-sm text-gray-500">
                  {(formData.requiresCheckin ?? true)
                    ? 'ต้องเช็คอินทุกวันทำงาน — ไม่เช็คอินจะถูกนับว่าขาดงานในรายงาน'
                    : 'ไม่ต้องเช็คอิน — รายงานจะไม่นับขาดงานให้คนนี้'}
                </p>
              </div>
            </div>

            {(formData.requiresCheckin ?? true) && (
              <>
                <div className="flex items-center space-x-3 border-t border-gray-100 pt-4">
                  <Checkbox
                    id="allowCheckInOutsideLocation"
                    checked={formData.allowCheckInOutsideLocation}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        allowCheckInOutsideLocation: checked as boolean,
                      })
                    }
                    disabled={isLoading}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="allowCheckInOutsideLocation"
                      className="text-base font-normal cursor-pointer"
                    >
                      เช็คอินนอกสถานที่ได้
                    </Label>
                    <p className="text-sm text-gray-500">
                      เช็คอินจากที่ไหนก็ได้ ไม่ต้องอยู่ในรัศมีสาขา — รายงานจะระบุว่าเช็คอินนอกสถานที่
                    </p>
                  </div>
                </div>

                {/* WFH เป็นสิทธิ์ย่อยของการเช็คอินนอกรัศมี — ติ๊กได้เมื่อเปิดตัวบนก่อน */}
                {formData.allowCheckInOutsideLocation && (
                  <div className="ml-8 flex items-center space-x-3">
                    <Checkbox
                      id="allowWorkFromHome"
                      checked={formData.allowWorkFromHome ?? false}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, allowWorkFromHome: checked as boolean })
                      }
                      disabled={isLoading}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="allowWorkFromHome"
                        className="text-base font-normal cursor-pointer"
                      >
                        ทำงานที่บ้านได้ (WFH)
                      </Label>
                      <p className="text-sm text-gray-500">
                        ตอนเช็คอินนอกรัศมีจะมีปุ่มให้เลือกว่า WFH — รายงานแยกสีให้ (ไม่ติ๊ก = เลือกได้แค่นอกสถานที่)
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-4">
                  <Label>สาขาที่อนุญาตให้เช็คอิน</Label>
                  <div className="mt-1">
                    <LocationMultiSelect
                      selectedLocationIds={formData.allowedLocationIds || []}
                      onChange={(locationIds) =>
                        setFormData({ ...formData, allowedLocationIds: locationIds })
                      }
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* วันหยุดประจำ + สลับวันหยุด — บันทึกในตัวเอง ไม่ผ่านปุ่มบันทึกของฟอร์ม */}
                {user.id && (
                  <div className="border-t border-gray-100 pt-4">
                    <WorkScheduleCard userId={user.id} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── แท็บ 4 · ไทม์ไลน์ (อ่านอย่างเดียว) ─────────────── */}
      <div hidden={tab !== 'timeline'}>
        {user.id && <EmployeeTimeline userId={user.id} />}
      </div>

      {/* ── แท็บ 5 · โน้ต (บันทึกในตัวเอง ไม่ผ่านปุ่มบันทึกของฟอร์ม) ── */}
      <div hidden={tab !== 'remarks'}>
        {user.id && <RemarksCard userId={user.id} />}
      </div>

      {/* Actions — แท็บไทม์ไลน์/โน้ตไม่มีอะไรให้ปุ่มนี้บันทึก */}
      <div
        hidden={tab === 'timeline' || tab === 'remarks'}
        className="flex items-center justify-end gap-3"
      >

        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          disabled={isLoading}
        >
          <X className="w-4 h-4 mr-2" />
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>
    </form>
  )
}