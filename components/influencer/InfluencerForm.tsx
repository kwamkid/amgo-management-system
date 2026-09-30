// components/influencer/InfluencerForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Baby,
  Share2,
  StickyNote,
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
import {
  Textarea,
  Input,
  Field,
  DatePicker,
  SelectMenu,
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from '@/components/aoo'
import { PageHeader } from '@/components/shared'
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
    
   // Clean data before submit - convert empty strings to undefined for optional fields
    const cleanedData = {
      ...formData,
      lineId: formData.lineId || undefined,
      shippingAddress: formData.shippingAddress || undefined,
      province: formData.province || undefined,
      birthDate: formData.birthDate || undefined,
      notes: formData.notes || undefined
    }
    
    console.log('Cleaned data:', cleanedData)
    
    const result = await onSubmit(cleanedData)
    
    if (result) {
      // Always redirect to list page after save
      router.push('/influencers')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      {/* Header - ปุ่มกลับอยู่ทางซ้าย */}
      <PageHeader
        title={isEditMode ? 'แก้ไขข้อมูล Influencer' : 'เพิ่ม Influencer ใหม่'}
        onBack={() => router.push('/influencers')}
      />

      {/* Personal Info */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={User} tone="accent">ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Full Name */}
            <Field label="ชื่อ-นามสกุล" required error={errors.fullName || undefined}>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => {
                  setFormData({ ...formData, fullName: e.target.value })
                  setErrors({ ...errors, fullName: '' })
                }}
                placeholder="ชื่อ-นามสกุลเต็ม"
                error={!!errors.fullName}
              />
            </Field>

            {/* Nickname */}
            <Field label="ชื่อเล่น" required error={errors.nickname || undefined}>
              <Input
                id="nickname"
                type="text"
                value={formData.nickname}
                onChange={(e) => {
                  setFormData({ ...formData, nickname: e.target.value })
                  setErrors({ ...errors, nickname: '' })
                }}
                placeholder="ชื่อเล่น"
                error={!!errors.nickname}
              />
            </Field>

            {/* Birth Date */}
            <Field label="วันเกิด" asDiv>
              <DatePicker
                value={formData.birthDate || ''}
                onChange={(value) => setFormData({ ...formData, birthDate: value })}
              />
            </Field>

            {/* Tier */}
            <Field label="ระดับ Influencer" required asDiv help="จะคำนวณอัตโนมัติจาก total followers">
              <SelectMenu
                size="md"
                value={formData.tier || 'nano'}
                options={[
                  { value: 'nano', label: 'Nano (<10K)' },
                  { value: 'micro', label: 'Micro (10K-100K)' },
                  { value: 'macro', label: 'Macro (100K-1M)' },
                  { value: 'mega', label: 'Mega (>1M)' },
                ]}
                onChange={(value) => {
                  if (value) setFormData(prev => ({ ...prev, tier: value as InfluencerTier }))
                }}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Phone} tone="sky">ข้อมูลติดต่อ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Phone */}
            <Field label="เบอร์โทรศัพท์" required error={errors.phone || undefined}>
              <Input
                prefix={<Phone size={16} />}
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value })
                  setErrors({ ...errors, phone: '' })
                }}
                placeholder="0812345678"
                error={!!errors.phone}
              />
            </Field>

            {/* Email */}
            <Field label="อีเมล" required error={errors.email || undefined}>
              <Input
                prefix={<Mail size={16} />}
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  setErrors({ ...errors, email: '' })
                }}
                placeholder="email@example.com"
                error={!!errors.email}
              />
            </Field>

            {/* LINE ID */}
            <Field label="LINE ID" className="md:col-span-2">
              <Input
                prefix={<MessageSquare size={16} />}
                id="lineId"
                type="text"
                value={formData.lineId}
                onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                placeholder="LINE ID"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address (Optional) */}
      <Card padding={0}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle icon={MapPin} tone="grape">ที่อยู่จัดส่งสินค้า</CardTitle>
            {!showAddressSection && (
              <Button type="button" variant="ghost" size="sm" icon="Plus" onClick={() => setShowAddressSection(true)}>
                เพิ่มที่อยู่
              </Button>
            )}
          </div>
        </CardHeader>
        {showAddressSection && (
          <CardContent className="space-y-4">
            <Field label="ที่อยู่">
              <Textarea
                id="shippingAddress"
                value={formData.shippingAddress}
                onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                placeholder="บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ"
                rows={3}
              />
            </Field>

            <Field label="จังหวัด" asDiv>
              <SelectMenu
                size="md"
                value={formData.province || null}
                options={THAILAND_PROVINCES.map((province) => ({ value: province, label: province }))}
                placeholder="เลือกจังหวัด"
                clearable="ไม่ระบุจังหวัด"
                onChange={(value) => setFormData({ ...formData, province: value ?? '' })}
              />
            </Field>
          </CardContent>
        )}
      </Card>

      {/* Children Info */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Baby} tone="pink">ข้อมูลลูก</CardTitle>
        </CardHeader>
        <CardContent>
          <ChildrenManager
            childrenData={formData.children}
            onChange={(children) => setFormData({ ...formData, children })}
          />
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Share2} tone="info">
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
            <Alert tone="error" className="mt-4">{errors.socialChannels}</Alert>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={StickyNote} tone="warning">หมายเหตุ</CardTitle>
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
        <Button type="button" variant="soft" onClick={() => router.push('/influencers')} disabled={isSubmitting}>
          ยกเลิก
        </Button>
        <Button type="submit" icon="Save" loading={isSubmitting}>
          {isSubmitting ? 'กำลังบันทึก...' : isEditMode ? 'บันทึกการแก้ไข' : 'เพิ่ม Influencer'}
        </Button>
      </div>
    </form>
  )
}
