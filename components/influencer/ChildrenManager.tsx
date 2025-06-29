// components/influencer/ChildrenManager.tsx

'use client'

import { useState } from 'react'
import { 
  Baby, 
  Plus, 
  Trash2, 
  Calendar,
  User
} from 'lucide-react'
import { Child } from '@/types/influencer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

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

  // Get gender display
  const getGenderDisplay = (gender: 'male' | 'female'): { text: string; color: string } => {
    return gender === 'male' 
      ? { text: 'ชาย', color: 'bg-blue-100 text-blue-700' }
      : { text: 'หญิง', color: 'bg-pink-100 text-pink-700' }
  }

  return (
    <div className="space-y-4">
      {/* Children List */}
      {childrenData.length > 0 && (
        <div className="space-y-3">
          {childrenData.map((child, index) => {
            const genderInfo = getGenderDisplay(child.gender)
            
            return (
              <Card key={child.id} className="p-4">
                <div className="flex items-start gap-4">
                  {/* Child Icon */}
                  <div className={`p-2 rounded-lg ${
                    child.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
                  }`}>
                    <Baby className={`w-5 h-5 ${
                      child.gender === 'male' ? 'text-blue-600' : 'text-pink-600'
                    }`} />
                  </div>

                  {/* Child Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        ลูกคนที่ {index + 1}: {child.nickname}
                      </span>
                      <Badge className={genderInfo.color}>
                        {genderInfo.text}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          เกิด: {child.birthDate 
                            ? format(new Date(child.birthDate), 'dd MMMM yyyy', { locale: th })
                            : '-'
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>อายุ: {calculateAge(child.birthDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!disabled && (
                    <Button
                      onClick={() => handleRemoveChild(child.id!)}
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add New Child Form */}
      {showAddForm ? (
        <Card className="p-4 border-2 border-dashed">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Baby className="w-5 h-5" />
              เพิ่มข้อมูลลูก
            </h4>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Nickname */}
              <div>
                <Label htmlFor="child-nickname">
                  ชื่อเล่น <span className="text-red-500">*</span>
                </Label>
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
                  className={errors.nickname ? 'border-red-500' : ''}
                />
                {errors.nickname && (
                  <p className="text-sm text-red-600 mt-1">{errors.nickname}</p>
                )}
              </div>

              {/* Gender */}
              <div>
                <Label htmlFor="child-gender">เพศ</Label>
                <Select
                  value={newChild.gender}
                  onValueChange={(value: 'male' | 'female') => 
                    setNewChild({ ...newChild, gender: value })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger id="child-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        ชาย
                      </div>
                    </SelectItem>
                    <SelectItem value="female">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-pink-500 rounded-full" />
                        หญิง
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Birth Date */}
            <div>
              <Label htmlFor="child-birthdate">
                วันเกิด <span className="text-red-500">*</span>
              </Label>
              <Input
                id="child-birthdate"
                type="date"
                value={newChild.birthDate ? 
                  (typeof newChild.birthDate === 'string' 
                    ? newChild.birthDate 
                    : new Date(newChild.birthDate).toISOString().split('T')[0]
                  ) : ''
                }
                onChange={(e) => {
                  setNewChild({ ...newChild, birthDate: e.target.value })
                  setErrors({ ...errors, birthDate: '' })
                }}
                max={new Date().toISOString().split('T')[0]} // Cannot be future date
                disabled={disabled}
                className={errors.birthDate ? 'border-red-500' : ''}
              />
              {errors.birthDate && (
                <p className="text-sm text-red-600 mt-1">{errors.birthDate}</p>
              )}
              {newChild.birthDate && (
                <p className="text-sm text-gray-500 mt-1">
                  อายุ: {calculateAge(newChild.birthDate)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleAddChild}
                disabled={disabled}
                className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                เพิ่ม
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false)
                  setNewChild({
                    nickname: '',
                    gender: 'male',
                    birthDate: ''
                  })
                  setErrors({})
                }}
                variant="outline"
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          onClick={() => setShowAddForm(true)}
          variant="outline"
          disabled={disabled}
          className="w-full border-2 border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มข้อมูลลูก
        </Button>
      )}

      {/* Summary */}
      {childrenData.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">จำนวนลูก:</span>
            <div className="flex items-center gap-4">
              <span className="font-medium">
                {childrenData.length} คน
              </span>
              {childrenData.length > 0 && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-blue-600">
                    ชาย {childrenData.filter(c => c.gender === 'male').length}
                  </span>
                  <span className="text-pink-600">
                    หญิง {childrenData.filter(c => c.gender === 'female').length}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}