// lib/services/user/mappers.ts
//
// แปลงแถว users จาก Postgres → รูปแบบที่หน้าจอใช้
//
// ที่ต้องแยกออกมาไว้ตรงนี้ เพราะเดิมมีการแปลงอยู่ 2 ที่ที่ไม่ตรงกัน
// (useAuth แปลงชุดหนึ่ง · userService แปลงอีกชุดหนึ่ง) พอเพิ่มคอลัมน์ใหม่
// แล้วแก้ที่เดียว อีกที่ก็เงียบหาย — ตอนนี้เหลือทางเดียว
//
// ⚠️ ชื่อฟิลด์ต้องคงเป็น camelCase แบบเดิม มีหน้าจอเรียกอยู่หลายสิบจุด

import type { Database } from '@/types/database'

export type UserRow = Database['public']['Tables']['users']['Row']

export interface UserData {
  id?: string
  lineUserId: string
  lineDisplayName: string
  linePictureUrl: string
  fullName: string
  /** ชื่อเล่น — ชื่อ LINE ดูไม่ออกว่าใครเป็นใคร ที่ทำงานเรียกกันด้วยชื่อนี้ */
  nickname: string
  /** "ชื่อจริง (ชื่อเล่น)" — ฐานข้อมูลคำนวณให้ ใช้ตอนแสดงผลแทนการต่อสตริงเอง */
  displayName: string
  /** รหัสพนักงานแบบเลขต่อเนื่อง — โชว์ด้วย lpad 3 หลัก (001) · บัญชีระบบไม่มี */
  employeeCode: number | null
  /** false = ยังเป็นชื่อ LINE ที่ลากมาจากระบบเก่า ยังไม่มีใครยืนยัน */
  nameVerified: boolean
  /** บัญชีระบบ (Dev Admin / Super Admin) — ไม่ใช่พนักงาน ไม่ต้องกรอกอะไร */
  isSystem: boolean
  phone: string
  birthDate?: string | Date
  role: 'admin' | 'hr' | 'manager' | 'employee' | 'driver' | 'marketing'
  permissionGroupId: string | null
  allowedLocationIds?: string[]
  allowCheckInOutsideLocation?: boolean
  allowWorkFromHome?: boolean
  /** ได้ค่าล่วงเวลาไหม — null = ตามตำแหน่ง (job_functions.ot_eligible) */
  otEligible?: boolean | null
  /** เห็นเมนูงานส่งของ (มาจาก job_functions.sees_delivery — useAuth เติมให้ตอนล็อกอิน) */
  seesDelivery?: boolean
  /** code ของตำแหน่ง (job_functions.code — useAuth เติมให้ตอนล็อกอิน) ใช้ gate เมนูเฉพาะตำแหน่ง เช่น production */
  jobFunctionCode?: string
  /** มีสิทธิ์ SRP Calculator อย่างน้อย 1 แบรนด์ (useAuth เติมให้ · แอดมิน = true เสมอ) */
  hasSrpAccess?: boolean
  /** อยู่ในรายชื่อ web_owners — เมนูดูแลเว็บไซต์ลูกค้า (งานส่วนตัว แอดมินคนอื่นไม่เห็น) */
  hasWebAccess?: boolean
  inviteLinkId?: string
  inviteLinkCode?: string
  isActive: boolean
  needsApproval: boolean
  registeredAt: Date
  createdAt: Date
  updatedAt?: Date
  approvedAt?: Date
  approvedBy?: string
  lastLoginAt?: Date

  // ── ฟิลด์ใหม่ที่ Firestore ไม่มี ──────────────────────────────
  employmentStatus: 'active' | 'probation' | 'resigned' | 'terminated' | 'retired'
  employmentType: 'monthly' | 'daily' | null
  startDate: Date | null
  endDate: Date | null
  /** วันพ้นทดลองงาน — เงินเดือนหลังโปรลงวันที่นี้ */
  probationEndDate: string | null
  companyId: string | null
  jobFunctionId: string | null
  requiresCheckin: boolean | null
  wfhEligible: boolean

  bankName?: string | null
  bankAccountNo?: string | null

  /** เลขบัตรประชาชน + ที่อยู่ — ใช้พิมพ์ในสัญญาจ้าง */
  nationalId?: string | null
  address?: string | null

  discordUserId?: string
  discordUsername?: string
  primaryLocationId?: string | null
  daysPerWeek?: number | null
  payrollCycle?: string | null
  startDateVerified?: boolean
  endReason?: string | null
}

const toDate = (v: string | null | undefined): Date | null => (v ? new Date(v) : null)

export function mapUser(row: UserRow, allowedLocationIds: string[] = []): UserData {
  return {
    id: row.id,
    lineUserId: row.line_user_id ?? '',
    lineDisplayName: row.line_display_name ?? '',
    linePictureUrl: row.line_picture_url ?? '',
    fullName: row.full_name,
    nickname: row.nickname ?? '',
    displayName: row.display_name || row.full_name,
    employeeCode: row.employee_code,
    nameVerified: row.name_verified ?? false,
    isSystem: row.is_system ?? false,
    phone: row.phone ?? '',
    birthDate: row.birth_date ?? undefined,
    role: row.role as UserData['role'],
    permissionGroupId: null, // เลิกใช้แล้ว — สิทธิ์อยู่ที่ role_permissions/user_permissions
    allowedLocationIds,
    allowCheckInOutsideLocation: row.allow_checkin_outside_location ?? false,
    allowWorkFromHome: row.wfh_eligible ?? false,
    otEligible: row.ot_eligible ?? null,
    inviteLinkId: row.invite_link_id ?? undefined,
    inviteLinkCode: row.invite_link_code ?? undefined,
    isActive: row.is_active,
    needsApproval: row.needs_approval ?? false,
    registeredAt: toDate(row.registered_at) ?? new Date(),
    createdAt: toDate(row.created_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? undefined,
    approvedAt: toDate(row.approved_at) ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    lastLoginAt: toDate(row.last_login_at) ?? undefined,

    employmentStatus: row.employment_status as UserData['employmentStatus'],
    employmentType: (row.employment_type as 'monthly' | 'daily' | null) ?? null,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
    probationEndDate: row.probation_end_date,
    companyId: row.company_id,
    jobFunctionId: row.job_function_id,
    requiresCheckin: row.requires_checkin,
    wfhEligible: row.wfh_eligible ?? false,

    bankName: row.bank_name,
    bankAccountNo: row.bank_account_no,
    nationalId: row.national_id ?? null,
    address: row.address ?? null,
    discordUserId: row.discord_user_id ?? undefined,
    discordUsername: row.discord_username ?? undefined,
    primaryLocationId: row.primary_location_id,
    daysPerWeek: row.days_per_week,
    payrollCycle: row.payroll_cycle,
    startDateVerified: row.start_date_verified,
    endReason: row.end_reason,
  }
}

/** ผูกสาขาที่เช็คอินได้กลับเข้าไปในผู้ใช้แต่ละคน — เดิมเป็น array ในเอกสาร */
export function attachLocations(
  rows: UserRow[],
  links: { user_id: string; location_id: string }[]
): UserData[] {
  const byUser = new Map<string, string[]>()
  for (const l of links) {
    const list = byUser.get(l.user_id) ?? []
    list.push(l.location_id)
    byUser.set(l.user_id, list)
  }
  return rows.map((r) => mapUser(r, byUser.get(r.id) ?? []))
}
