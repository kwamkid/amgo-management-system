// types/holiday.ts

export interface Holiday {
  id?: string
  name: string // ชื่อวันหยุด เช่น "วันสงกรานต์"
  date: Date | string // วันที่
  type: 'public' | 'company' | 'special' // ประเภทวันหยุด
  
  // การทำงาน
  isWorkingDay: boolean // บางวันหยุดอาจต้องทำงาน เช่น วันหยุดทำการ
  
  // OT Rate สำหรับวันหยุด
  overtimeRates?: {
    office?: number      // 1.5x สำหรับพนักงาน office
    retail?: number      // 2x สำหรับพนักงานหน้าร้าน
    driver?: number      // 1.5x สำหรับคนขับ
    marketing?: number   // 1.5x สำหรับ marketing
  }
  
  // ใช้กับที่ไหน
  applicableLocationIds?: string[] // ถ้าไม่ระบุ = ทุกสาขา
  applicableRoles?: string[] // ถ้าไม่ระบุ = ทุก role
  
  // ข้อมูลเพิ่มเติม
  description?: string
  recurring?: boolean // วันหยุดประจำปี
  recurringDay?: number // วันที่ (1-31)
  recurringMonth?: number // เดือน (1-12)
  
  // Metadata
  isActive: boolean
  createdAt?: Date
  createdBy?: string
  updatedAt?: Date
  updatedBy?: string
}

// สำหรับสร้าง/แก้ไข Holiday
export interface HolidayFormData {
  name: string
  date: string
  type: Holiday['type']
  isWorkingDay: boolean
  overtimeRates: {
    office: number
    retail: number
    driver: number
    marketing: number
  }
  applicableLocationIds: string[]
  applicableRoles: string[]
  description?: string
  recurring: boolean
  recurringDay?: number
  recurringMonth?: number
}

// สำหรับ Import วันหยุดราชการ
export interface PublicHolidayImport {
  name: string
  date: string
  type?: string
}

// Default OT Rates
export const DEFAULT_OT_RATES = {
  office: 1.5,
  retail: 2.0,
  driver: 1.5,
  marketing: 1.5
}

// Holiday type labels
export const HOLIDAY_TYPE_LABELS: Record<Holiday['type'], string> = {
  public: 'วันหยุดราชการ',
  company: 'วันหยุดบริษัท',
  special: 'วันหยุดพิเศษ'
}

// Filter options
export interface HolidayFilters {
  year?: number
  type?: Holiday['type']
  locationId?: string
  isActive?: boolean
}