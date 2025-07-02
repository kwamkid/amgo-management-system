// types/user.ts

export interface User {
  id?: string
  
  // LINE Info (จาก LINE Login)
  lineUserId: string
  lineDisplayName: string
  linePictureUrl?: string
  
  // Discord Info (optional)
  discordUserId?: string
  discordUsername?: string
  
  // Personal Info
  fullName: string
  phone?: string
  birthDate?: Date | string
  
  // Work Info
  role: 'admin' | 'hr' | 'manager' | 'employee' | 'marketing' | 'driver' // ✅ เพิ่ม marketing และ driver
  allowedLocationIds?: string[] // สาขาที่อนุญาตให้เช็คอิน (หลายที่ได้)
  allowCheckInOutsideLocation?: boolean // อนุญาตให้เช็คอินนอกสถานที่
  
  // Invite Link Info
  inviteLinkId?: string // ID ของ invite link ที่ใช้
  inviteLinkCode?: string // Code ของ invite link ที่ใช้
  
  // Status
  isActive: boolean
  needsApproval: boolean // ยังไม่ได้ approve จากการสมัคร
  
  // Timestamps
  createdAt?: Date
  updatedAt?: Date
  approvedAt?: Date
  approvedBy?: string // userId ของคนที่ approve
  lastLoginAt?: Date
}

// Invite Link สำหรับเชิญพนักงานใหม่
export interface InviteLink {
  id: string
  code: string // รหัสสำหรับแชร์ เช่น "AMGO2024"
  createdBy: string // userId ที่สร้าง
  
  // Default values สำหรับคนที่ใช้ link นี้
  defaultRole: User['role']
  defaultLocationIds?: string[] // สาขาที่จะกำหนดให้
  allowCheckInOutsideLocation?: boolean
  requireApproval: boolean // ต้อง approve หรือ active ทันที
  
  // จำกัดการใช้งาน
  maxUses?: number // จำนวนครั้งที่ใช้ได้
  usedCount: number // ใช้ไปแล้วกี่ครั้ง
  expiresAt?: Date // วันหมดอายุ
  
  // Status
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// สำหรับ create user (ตอนลงทะเบียน)
export type CreateUserData = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'approvedAt' | 'approvedBy'>

// สำหรับ update user
export type UpdateUserData = Partial<Omit<User, 'id' | 'lineUserId' | 'createdAt'>>

// สำหรับ filter/search users
export interface UserFilters {
  role?: User['role']
  isActive?: boolean
  locationId?: string // พนักงานที่สามารถเช็คอินที่สาขานี้
  searchTerm?: string // ค้นหาจากชื่อ
  needsApproval?: boolean // กรองเฉพาะที่รออนุมัติ
}

// User Statistics สำหรับ dashboard
export interface UserStatistics {
  total: number
  active: number
  inactive: number
  pending: number // รออนุมัติ
  byRole: {
    admin: number
    hr: number
    manager: number
    employee: number
    marketing: number // ✅ เพิ่ม marketing
    driver: number    // ✅ เพิ่ม driver
  }
}

// Extended Firebase User with role and additional properties from our User type
import { User as FirebaseUser } from 'firebase/auth';

export interface AuthUser extends FirebaseUser {
  // Essential fields from User type
  role: 'admin' | 'hr' | 'manager' | 'employee' | 'marketing' | 'driver' // ✅ เพิ่ม marketing และ driver
  fullName?: string
  lineDisplayName?: string
  allowedLocationIds?: string[]
  isActive?: boolean
  needsApproval?: boolean
}