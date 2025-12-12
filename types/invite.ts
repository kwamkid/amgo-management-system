// types/invite.ts

export interface InviteLink {
  id?: string
  code: string // รหัสสำหรับแชร์ เช่น "AMGO2024"
  createdBy: string // userId ที่สร้าง
  createdByName?: string // ชื่อคนสร้าง (สำหรับแสดงผล)
  
  // Default values สำหรับคนที่ใช้ link นี้
  defaultRole: 'employee' | 'manager' | 'hr' | 'marketing' | 'driver'

  defaultLocationIds?: string[] // สาขาที่จะกำหนดให้
  allowCheckInOutsideLocation?: boolean
  requireApproval: boolean // ต้อง approve หรือ active ทันที
  
  // จำกัดการใช้งาน
  maxUses?: number // จำนวนครั้งที่ใช้ได้ (null = ไม่จำกัด)
  usedCount: number // ใช้ไปแล้วกี่ครั้ง
  expiresAt?: Date | string // วันหมดอายุ
  
  // Status
  isActive: boolean
  note?: string // หมายเหตุ
  
  // Timestamps
  createdAt?: Date
  updatedAt?: Date
}

// สำหรับสร้าง invite link
export interface CreateInviteLinkData {
  code?: string // ถ้าไม่ใส่จะ generate ให้
  defaultRole: InviteLink['defaultRole']
  defaultLocationIds?: string[]
  allowCheckInOutsideLocation?: boolean
  requireApproval?: boolean
  maxUses?: number
  expiresAt?: string // ISO date string
  note?: string
}

// สำหรับ update invite link
export interface UpdateInviteLinkData {
  isActive?: boolean
  maxUses?: number
  expiresAt?: string
  note?: string
}

// สำหรับแสดงสถิติการใช้งาน
export interface InviteLinkUsage {
  linkId: string
  userId: string
  userName: string
  userEmail?: string
  usedAt: Date
  userStatus: 'active' | 'pending' | 'inactive'
}