// components/influencer/InfluencerForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin,
  MessageSquare,
  Save,
  ArrowLeft,
  Loader2
} from 'lucide-react'
import { 
  Influencer, 
  CreateInfluencerData,
  InfluencerTier,
  Child,
  SocialChannel,
  THAILAND_PROVINCES
} from '@/types/influencer'
import SocialChannelManager from './SocialChannelManager'
import ChildrenManager from './ChildrenManager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface InfluencerFormProps {
  influencer?: Influencer | null // For edit mode
  onSubmit: (data: CreateInfluencerData) => Promise<string | null | boolean>
  isSubmitting?: boolean
}

export default function InfluencerForm({
  influencer,
  onSubmit,
  isSubmitting = false
}: InfluencerFormProps) {
  const router = useRouter()
  const isEditMode = !!influencer
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<CreateInfluencerData>({
    fullName: '',
    nickname: '',
    birthDate: '',
    phone: '',
    email: '',
    lineId: '',
    shippingAddress: '',
    province: '',
    tier: 'nano' as InfluencerTier,
    notes: '',
    children: [],
    socialChannels: []
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAddressSection, setShowAddressSection] = useState(false)

  // Initialize form data for edit mode
  useEffect(() => {
    if (influencer && isEditMode) {
      console.log('Influencer data:', influencer)
      console.log('Influencer tier:', influencer.tier)
      
      setFormData({
        fullName: influencer.fullName || '',
        nickname: influencer.nickname || '',
        birthDate: influencer.birthDate 
          ? (typeof influencer.birthDate === 'string'
              ? influencer.birthDate
              : new Date(influencer.birthDate).toISOString().split('T')[0]
            )
          : '',
        phone: influencer.phone || '',
        email: influencer.email || '',
        lineId: influencer.lineId || '',
        shippingAddress: influencer.shippingAddress || '',
        province: influencer.province || '',
        tier: influencer.tier || 'nano', // Make sure tier is set
        notes: influencer.notes || '',
        children: influencer.children || [],
        socialChannels: influencer.socialChannels || []
      })
      
      // Show address section if has address
      if (influencer.shippingAddress || influencer.province) {
        setShowAddressSection(true)
      }
      
      setIsInitialized(true)
    }
  }, [influencer, isEditMode])

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'กรุณากรอกชื่อ-นามสกุล'
    }
    
    if (!formData.nickname.trim()) {
      newErrors.nickname = 'กรุณากรอกชื่อเล่น'
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'กรุณากรอกเบอร์โทรศัพท์'
    } else if (!/^[0-9]{9,10}$/.test(formData.phone.replace(/[^0-9]/g, ''))) {
      newErrors.phone = 'เบอร์โทรศัพท์ไม่ถูกต้อง'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'กรุณากรอกอีเมล'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'อีเมลไม่ถูกต้อง'
    }
    
    if (formData.socialChannels.length === 0) {
      newErrors.socialChannels = 'กรุณาเพิ่มช่องทาง Social Media อย่างน้อย 1 ช่องทาง'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      // Scroll to first error
      const firstError = Object.keys(errors)[0]
      const element = document.getElementById(firstError)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    
    console.log('Form data before submit:', formData)
    console.log('Tier value:', formData.tier)
    
    // Clean data before submit - convert empty strings to null for optional fields
    const cleanedData = {
      ...formData,
      lineId: formData.lineId || null,
      shippingAddress: formData.shippingAddress || null,
      province: formData.province || null,
      birthDate: formData.birthDate || null,
      notes: formData.notes || null
    }
    
    console.log('Cleaned data:', cleanedData)
    
    const result = await onSubmit(cleanedData)
    
    if (result) {
      // Always redirect to list page after save
      router.push('/influencers')
    }
  }

  // Get tier info
  const getTierInfo = (tier: InfluencerTier) => {
    const tierInfo = {
      nano: { label: 'Nano (<10K)', color: 'secondary' },
      micro: { label: 'Micro (10K-100K)', color: 'info' },
      macro: { label: 'Macro (100K-1M)', color: 'warning' },
      mega: { label: 'Mega (>1M)', color: 'error' }
    }
    return tierInfo[tier] || tierInfo.nano
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      {/* Header - ย้ายปุ่มกลับมาทางซ้าย */}
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/influencers')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? 'แก้ไขข้อมูล Influencer' : 'เพิ่ม Influencer ใหม่'}
        </h1>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-red-600" />
            ข้อมูลส่วนตัว
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName">
                ชื่อ-นามสกุล <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => {
                  setFormData({ ...formData, fullName: e.target.value })
                  setErrors({ ...errors, fullName: '' })
                }}
                placeholder="ชื่อ-นามสกุลเต็ม"
                className={errors.fullName ? 'border-red-500' : ''}
              />
              {errors.fullName && (
                <p className="text-sm text-red-600 mt-1">{errors.fullName}</p>
              )}
            </div>

            {/* Nickname */}
            <div>
              <Label htmlFor="nickname">
                ชื่อเล่น <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nickname"
                type="text"
                value={formData.nickname}
                onChange={(e) => {
                  setFormData({ ...formData, nickname: e.target.value })
                  setErrors({ ...errors, nickname: '' })
                }}
                placeholder="ชื่อเล่น"
                className={errors.nickname ? 'border-red-500' : ''}
              />
              {errors.nickname && (
                <p className="text-sm text-red-600 mt-1">{errors.nickname}</p>
              )}
            </div>

            {/* Birth Date */}
            <div>
              <Label htmlFor="birthDate">วันเกิด</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Tier */}
            <div>
              <Label htmlFor="tier">
                ระดับ Influencer <span className="text-red-500">*</span>
              </Label>
              <Select
                key={`tier-${formData.tier}`}
                value={formData.tier || 'nano'}
                onValueChange={(value: InfluencerTier) => {
                  console.log('Tier changing from', formData.tier, 'to', value)
                  setFormData(prev => ({ ...prev, tier: value }))
                }}
              >
                <SelectTrigger id="tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nano">Nano (&lt;10K)</SelectItem>
                  <SelectItem value="micro">Micro (10K-100K)</SelectItem>
                  <SelectItem value="macro">Macro (100K-1M)</SelectItem>
                  <SelectItem value="mega">Mega (&gt;1M)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                จะคำนวณอัตโนมัติจาก total followers
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="w-5 h-5 text-red-600" />
            ข้อมูลติดต่อ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <Label htmlFor="phone">
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value })
                    setErrors({ ...errors, phone: '' })
                  }}
                  placeholder="0812345678"
                  className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">
                อีเมล <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    setErrors({ ...errors, email: '' })
                  }}
                  placeholder="email@example.com"
                  className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">{errors.email}</p>
              )}
            </div>

            {/* LINE ID */}
            <div className="md:col-span-2">
              <Label htmlFor="lineId">LINE ID</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="lineId"
                  type="text"
                  value={formData.lineId}
                  onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                  placeholder="LINE ID"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-600" />
              ที่อยู่จัดส่งสินค้า
            </div>
            {!showAddressSection && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddressSection(true)}
              >
                เพิ่มที่อยู่
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        {showAddressSection && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="shippingAddress">ที่อยู่</Label>
              <Textarea
                id="shippingAddress"
                value={formData.shippingAddress}
                onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                placeholder="บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ"
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="province">จังหวัด</Label>
              <Select
                value={formData.province}
                onValueChange={(value) => setFormData({ ...formData, province: value })}
              >
                <SelectTrigger id="province">
                  <SelectValue placeholder="เลือกจังหวัด" />
                </SelectTrigger>
                <SelectContent>
                  {THAILAND_PROVINCES.map(province => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Children Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูลลูก</CardTitle>
        </CardHeader>
        <CardContent>
          <ChildrenManager
            childrenData={formData.children}
            onChange={(children) => setFormData({ ...formData, children })}
          />
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Social Media <span className="text-red-500">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SocialChannelManager
            channels={formData.socialChannels}
            onChange={(channels) => {
              setFormData({ ...formData, socialChannels: channels })
              setErrors({ ...errors, socialChannels: '' })
            }}
          />
          {errors.socialChannels && (
            <Alert variant="error" className="mt-4">
              <AlertDescription>{errors.socialChannels}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">หมายเหตุ</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="หมายเหตุเพิ่มเติม..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/influencers')}
          disabled={isSubmitting}
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {isEditMode ? 'บันทึกการแก้ไข' : 'เพิ่ม Influencer'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}