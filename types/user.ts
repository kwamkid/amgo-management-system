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
  nickname?: string        // ชื่อเล่น — ที่ทำงานเรียกกันด้วยชื่อนี้
  displayName?: string     // "ชื่อจริง (ชื่อเล่น)" — ฐานข้อมูลคำนวณให้ แก้ตรง ๆ ไม่ได้
  employeeCode?: number | null // รหัสพนักงานเลขต่อเนื่อง — โชว์เป็น 3 หลัก (001)
  bankName?: string | null
  bankAccountNo?: string | null
  nameVerified?: boolean   // false = ยังเป็นชื่อ LINE ที่ลากมาจากระบบเก่า
  phone?: string
  birthDate?: Date | string
  
  // Work Info
  // ⚠️ role ไม่ได้ตั้งเองแล้ว — ฐานข้อมูลเซ็ตให้ตามตำแหน่ง (jobFunctionId)
  role: 'admin' | 'hr' | 'manager' | 'employee' | 'driver'
  companyId?: string | null
  jobFunctionId?: string | null
  startDate?: Date | string | null // วันเริ่มงานจริง (start_date_verified บอกว่ายืนยันแล้ว)
  /** true = มีคนกรอกวันเริ่มงานจริงแล้ว · false/undefined = ยังเป็นวันที่สมัครเข้าระบบ */
  startDateVerified?: boolean
  allowedLocationIds?: string[] // สาขาที่อนุญาตให้เช็คอิน (หลายที่ได้)
  requiresCheckin?: boolean | null // false = ไม่ต้องเช็คอิน รายงานไม่นับขาดงาน · null = ตามตำแหน่ง
  employmentStatus?: string        // active | probation | resigned | terminated | retired
  employmentType?: string          // monthly (รายเดือน) | daily (รายวัน)
  probationEndDate?: string | null // วันพ้นทดลองงาน — ใช้ลงวันที่เงินเดือนหลังโปร + สัญญา
  allowCheckInOutsideLocation?: boolean // อนุญาตให้เช็คอินนอกสถานที่
  allowWorkFromHome?: boolean // อนุญาตให้ Work From Home
  /** ต้องถ่ายรูปหน้าร้าน+สต็อกทุกวันก่อนเช็คเอาท์ (PC บางคน — เจ้าของสั่ง 4 ก.ย. 69) */
  requiresStockPhotos?: boolean
  otEligible?: boolean | null // ได้ค่าล่วงเวลาไหม — null = ตามตำแหน่ง (job_functions.ot_eligible)
  nationalId?: string | null // เลขบัตรประชาชน 13 หลัก — ใช้ในสัญญาจ้าง
  address?: string | null // ที่อยู่ — ใช้ในสัญญาจ้าง
  
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
    driver: number
  }
}

// ผู้ใช้ที่ล็อกอินอยู่ + ข้อมูลจากตาราง users ของเรา
// (เดิม extend User ของ Firebase — ถอด Firebase ออกแล้ว 15 ส.ค. 69)
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthUser extends SupabaseUser {
  // Essential fields from User type
  role: 'admin' | 'hr' | 'manager' | 'employee' | 'driver'
  fullName?: string
  lineDisplayName?: string
  allowedLocationIds?: string[]
  isActive?: boolean
  needsApproval?: boolean
}