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

import { useState } from 'react'
import { User, UpdateUserData } from '@/types/user'
import { toDate } from '@/lib/utils/date'
import LocationMultiSelect from './LocationMultiSelect'
import PayCard from './PayCard'
import { TabBar, TabItem } from '@/components/aoo'
import { Phone, Calendar, Save, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  const [tab, setTab] = useState<'info' | 'pay' | 'location'>('info')

  const [formData, setFormData] = useState<UpdateUserData>({
    fullName: user.fullName,
    nickname: user.nickname || '',
    phone: user.phone || '',
    birthDate: formatDateForInput(user.birthDate), // This is already a string
    role: user.role,
    allowedLocationIds: user.allowedLocationIds || [],
    allowCheckInOutsideLocation: user.allowCheckInOutsideLocation || false,
    isActive: user.isActive
  })

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
    
    // เงื่อนไขนี้อยู่คนละแท็บกับปุ่มบันทึก — ต้องพาไปให้เห็นด้วย
    // ไม่งั้นขึ้น alert แล้วผู้ใช้หาไม่เจอว่าต้องแก้ตรงไหน
    if (formData.allowedLocationIds?.length === 0 && !formData.allowCheckInOutsideLocation) {
      setTab('location')
      alert('กรุณาเลือกสาขาที่อนุญาตหรืออนุญาตให้เช็คอินนอกสถานที่')
      return
    }
    
    // Format birthDate as ISO string for Firebase
    const dataToSubmit = {
      ...formData,
      birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : undefined
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
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">สิทธิ์และสถานะ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role">สิทธิ์การใช้งาน</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as User['role'] })}
                disabled={isLoading}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="employee">พนักงาน</SelectItem>
                <SelectItem value="manager">ผู้จัดการ</SelectItem>
                <SelectItem value="hr">ฝ่ายบุคคล</SelectItem>
                <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                <SelectItem value="driver">พนักงานขับรถ</SelectItem>
              </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-3 border-t border-gray-100 pt-4">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, isActive: checked as boolean })
              }
              disabled={isLoading}
            />
            <div className="space-y-1">
              <Label 
                htmlFor="isActive" 
                className="text-base font-medium cursor-pointer"
              >
                เปิดใช้งาน
              </Label>
              <p className="text-sm text-gray-500">
                {formData.isActive 
                  ? 'พนักงานสามารถเข้าใช้งานระบบได้' 
                  : 'พนักงานไม่สามารถเข้าใช้งานระบบได้'}
              </p>
            </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* ── แท็บ 2 · เงินเดือน ──────────────────────────────── *
       * PayCard บันทึกเองทันที ไม่ผ่านปุ่มบันทึกด้านล่าง
       * เพราะเงินเดือนเก็บเป็นประวัติตามวันที่มีผล คนละจังหวะกับข้อมูลอื่น */}
      <div hidden={tab !== 'pay'}>
        {user.id && <PayCard userId={user.id} editable />}
      </div>

      {/* ── แท็บ 3 · สถานที่เช็คอิน ─────────────────────────── */}
      <div hidden={tab !== 'location'}>
        <Card className="border-0 shadow-md">
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label>สาขาที่อนุญาตให้เช็คอิน</Label>
              <LocationMultiSelect
                selectedLocationIds={formData.allowedLocationIds || []}
                onChange={(locationIds) =>
                  setFormData({ ...formData, allowedLocationIds: locationIds })
                }
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center space-x-3 border-t border-gray-100 pt-4">
              <Checkbox
                id="allowCheckInOutsideLocation"
                checked={formData.allowCheckInOutsideLocation}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allowCheckInOutsideLocation: checked as boolean })
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
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {tab === 'pay' && (
          <p className="mr-auto text-sm text-gray-500">
            เงินเดือนกับรายได้พิเศษบันทึกแยกในกล่องด้านบน ไม่ต้องกดปุ่มนี้
          </p>
        )}
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