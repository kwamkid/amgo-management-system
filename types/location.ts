// types/location.ts

export interface WorkingHours {
  open: string // "10:00"
  close: string // "22:00"
  isClosed?: boolean
}

export interface Shift {
  id: string
  name: string // "กะเช้า", "กะบ่าย"
  startTime: string // "10:00"
  endTime: string // "18:00"
  graceMinutes: number // 15
}

export interface Location {
  id: string
  name: string // "สาขาสยาม"
  address: string
  lat: number
  lng: number
  radius: number // meters
  workingHours: {
    monday: WorkingHours
    tuesday: WorkingHours
    wednesday: WorkingHours
    thursday: WorkingHours
    friday: WorkingHours
    saturday: WorkingHours
    sunday: WorkingHours
  }
  shifts: Shift[]
  breakHours: number // 1 hour
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface LocationFormData {
  name: string
  address: string
  lat: number
  lng: number
  radius: number
  workingHours: Location['workingHours']
  shifts: Omit<Shift, 'id'>[]
  breakHours: number
  isActive: boolean
}