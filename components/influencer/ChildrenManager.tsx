// components/influencer/ChildrenManager.tsx

'use client'

import { useState } from 'react'
import {
  Baby,
  Trash2,
  Calendar,
  User
} from 'lucide-react'
import { Child } from '@/types/influencer'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Input, Field, SelectMenu, DatePicker, Pill, Card, CardTitle, Button, IconButton } from '@/components/aoo'
import { ListRows, ListRow } from '@/components/shared'
interface ChildrenManagerProps {
  childrenData: Child[]
  onChange: (children: Child[]) => void
  disabled?: boolean
}

export default function ChildrenManager({
  childrenData = [],
  onChange,
  disabled = false
}: ChildrenManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newChild, setNewChild] = useState<Omit<Child, 'id'>>({
    nickname: '',
    gender: 'male',
    birthDate: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Calculate age from birthdate
  const calculateAge = (birthDate: string | Date | undefined): string => {
    if (!birthDate) return '-'
    
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    // If less than 1 year, show months
    if (age < 1) {
      const months = monthDiff < 0 ? 12 + monthDiff : monthDiff
      return `${months} เดือน`
    }
    
    return `${age} ปี`
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!newChild.nickname.trim()) {
      newErrors.nickname = 'กรุณากรอกชื่อเล่น'
    }
    
    if (!newChild.birthDate) {
      newErrors.birthDate = 'กรุณาเลือกวันเกิด'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Add child
  const handleAddChild = () => {
    if (!validateForm()) return
    
    const child: Child = {
      id: Date.now().toString(),
      ...newChild
    }
    
    onChange([...childrenData, child])
    
    // Reset form
    setNewChild({
      nickname: '',
      gender: 'male',
      birthDate: ''
    })
    setShowAddForm(false)
    setErrors({})
  }

  // Update child
  const handleUpdateChild = (childId: string, updates: Partial<Child>) => {
    const updated = childrenData.map(child => 
      child.id === childId ? { ...child, ...updates } : child
    )
    onChange(updated)
  }

  // Remove child
  const handleRemoveChild = (childId: string) => {
    onChange(childrenData.filter(child => child.id !== childId))
  }

  const genderTone = (gender: 'male' | 'female') => (gender === 'male' ? 'sky' : 'pink') as 'sky' | 'pink'

  const resetForm = () => {
    setShowAddForm(false)
    setNewChild({
      nickname: '',
      gender: 'male',
      birthDate: ''
    })
    setErrors({})
  }

  return (
    <div className="space-y-4">
      {/* Children List */}
      {childrenData.length > 0 && (
        <ListRows variant="boxed">
          {childrenData.map((child, index) => (
            <ListRow
              key={child.id}
              leading={
                <span className="aoo-title-icon" data-tone={genderTone(child.gender)}>
                  <Baby size={19} strokeWidth={2} />
                </span>
              }
              title={
                <span className="flex items-center gap-2">
                  ลูกคนที่ {index + 1}: {child.nickname}
                  <Pill tone={genderTone(child.gender)}>
                    {child.gender === 'male' ? 'ชาย' : 'หญิง'}
                  </Pill>
                </span>
              }
              meta={
                <span className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    เกิด: {child.birthDate
                      ? format(new Date(child.birthDate), 'dd MMMM yyyy', { locale: th })
                      : '-'
                    }
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    อายุ: {calculateAge(child.birthDate)}
                  </span>
                </span>
              }
              trailing={
                !disabled ? (
                  <IconButton
                    icon={Trash2}
                    title="ลบข้อมูลลูก"
                    tone="danger"
                    onClick={() => handleRemoveChild(child.id!)}
                  />
                ) : undefined
              }
            />
          ))}
        </ListRows>
      )}

      {/* Add New Child Form */}
      {showAddForm ? (
        <Card>
          <div className="space-y-4">
            <CardTitle icon={Baby} tone="pink">เพิ่มข้อมูลลูก</CardTitle>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Nickname */}
              <Field label="ชื่อเล่น" required error={errors.nickname || undefined}>
                <Input
                  id="child-nickname"
                  type="text"
                  value={newChild.nickname}
                  onChange={(e) => {
                    setNewChild({ ...newChild, nickname: e.target.value })
                    setErrors({ ...errors, nickname: '' })
                  }}
                  placeholder="เช่น: น้องแอล"
                  disabled={disabled}
                  error={!!errors.nickname}
                />
              </Field>

              {/* Gender */}
              <Field label="เพศ" asDiv>
                <SelectMenu
                  size="md"
                  value={newChild.gender}
                  options={[
                    { value: 'male', label: 'ชาย' },
                    { value: 'female', label: 'หญิง' },
                  ]}
                  onChange={(value) => {
                    if (value) setNewChild({ ...newChild, gender: value as 'male' | 'female' })
                  }}
                  disabled={disabled}
                />
              </Field>
            </div>

            {/* Birth Date */}
            <Field
              label="วันเกิด"
              required
              asDiv
              error={errors.birthDate || undefined}
              help={newChild.birthDate ? `อายุ: ${calculateAge(newChild.birthDate)}` : undefined}
            >
              <DatePicker
                value={newChild.birthDate ?
                  (typeof newChild.birthDate === 'string'
                    ? newChild.birthDate
                    : new Date(newChild.birthDate).toISOString().split('T')[0]
                  ) : ''
                }
                onChange={(value) => {
                  setNewChild({ ...newChild, birthDate: value })
                  setErrors({ ...errors, birthDate: '' })
                }}
                max={new Date().toISOString().split('T')[0]} // Cannot be future date
                disabled={disabled}
              />
            </Field>

            {/* Actions */}
            <div className="flex gap-2">
              <Button type="button" icon="Plus" onClick={handleAddChild} disabled={disabled}>
                เพิ่ม
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                ยกเลิก
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          type="button"
          variant="secondary"
          icon="Plus"
          onClick={() => setShowAddForm(true)}
          disabled={disabled}
          className="w-full"
        >
          เพิ่มข้อมูลลูก
        </Button>
      )}

      {/* Summary */}
      {childrenData.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">จำนวนลูก:</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {childrenData.length} คน
              </span>
              <Pill tone="sky">ชาย {childrenData.filter(c => c.gender === 'male').length}</Pill>
              <Pill tone="pink">หญิง {childrenData.filter(c => c.gender === 'female').length}</Pill>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
