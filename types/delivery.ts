// types/delivery.ts

export interface DeliveryPoint {
  id?: string
  driverId: string
  driverName: string
  
  // Location Info
  checkInTime: Date | string
  lat: number
  lng: number
  address?: string // Reverse geocoded address
  
  // Customer Info
  customerName?: string
  customerPhone?: string
  orderNumber?: string
  
  // Delivery Info
  deliveryType: 'pickup' | 'delivery' // รับของ หรือ ส่งของ
  deliveryStatus: 'pending' | 'completed' | 'failed'
  failureReason?: string // เหตุผลที่ส่งไม่สำเร็จ
  
  // Photo - เก็บแค่รูปเดียว
  photo?: DeliveryPhoto
  photoUrl?: string // For backward compatibility
  
  // Signature
  customerSignature?: string // Base64 signature
  
  // Notes
  note?: string
  
  // Timestamps
  createdAt?: Date
  updatedAt?: Date
}

export interface DeliveryPhoto {
  id: string
  url: string
  thumbnailUrl?: string // URL ของรูปขนาดเล็ก
  originalSize: number // bytes
  compressedSize?: number // bytes after compression
  width?: number
  height?: number
  uploadedAt: Date
  capturedAt: Date // เวลาที่ถ่ายรูป
}

export interface DeliveryRoute {
  id?: string
  driverId: string
  driverName: string
  date: string // YYYY-MM-DD
  
  // Summary
  totalPoints: number
  completedPoints: number
  failedPoints: number
  totalDistance?: number // km
  totalDuration?: number // minutes
  
  // Timeline
  startTime?: Date
  endTime?: Date
  
  // Status
  status: 'in-progress' | 'completed'
  
  // Timestamps
  createdAt?: Date
  updatedAt?: Date
}

// For creating delivery check-in
export interface CreateDeliveryPointData {
  lat: number
  lng: number
  customerName?: string
  customerPhone?: string
  orderNumber?: string
  deliveryType: 'pickup' | 'delivery'
  note?: string
  photoCaptureData?: string // Base64 data from camera capture
}

// For updating delivery status
export interface UpdateDeliveryPointData {
  deliveryStatus?: 'completed' | 'failed'
  failureReason?: string
  customerSignature?: string
  note?: string
}

// Map view data
export interface DeliveryMapPoint {
  id: string
  lat: number
  lng: number
  checkInTime: Date
  deliveryType: 'pickup' | 'delivery'
  deliveryStatus: 'pending' | 'completed' | 'failed'
  customerName?: string
  address?: string
  sequence?: number // Order in route
    photo?: DeliveryPhoto // เพิ่ม photo
    note?: string // เพิ่ม note
    driverName?: string // เพิ่ม driver name

}

// Daily summary
export interface DeliveryDailySummary {
  date: string
  driverId: string
  driverName: string
  totalDeliveries: number
  completedDeliveries: number
  failedDeliveries: number
  totalDistance?: number
  totalDuration?: number
  firstDeliveryTime?: Date
  lastDeliveryTime?: Date
}

// Photo compression options
export interface PhotoCompressionOptions {
  maxWidth: number // Default: 1024
  maxHeight: number // Default: 1024
  quality: number // 0-1, Default: 0.8
  format?: 'jpeg' | 'webp'
}

// Camera capture options
export interface CameraCaptureOptions {
  facingMode?: 'user' | 'environment' // Default: 'environment' (rear camera)
  width?: number
  height?: number
}

// Auto cleanup config
export interface DeliveryCleanupConfig {
  photosRetentionDays: number // Default: 60 (2 months)
  dataRetentionDays: number // Default: 365 (1 year)
  runCleanupEveryDays: number // Default: 7
  lastCleanupRun?: Date
}

// Search/Filter options
export interface DeliveryFilters {
  driverId?: string
  date?: string // YYYY-MM-DD
  dateRange?: {
    start: string
    end: string
  }
  deliveryType?: 'pickup' | 'delivery'
  deliveryStatus?: 'pending' | 'completed' | 'failed'
  customerName?: string
  orderNumber?: string
}

// Driver performance metrics
export interface DriverPerformanceMetrics {
  driverId: string
  driverName: string
  period: 'daily' | 'weekly' | 'monthly'
  periodDate: string
  
  // Delivery stats
  totalDeliveries: number
  completedDeliveries: number
  failedDeliveries: number
  successRate: number // percentage
  
  // Time stats
  averageDeliveryTime?: number // minutes
  totalWorkingTime?: number // minutes
  
  // Distance stats
  totalDistance?: number // km
  averageDistancePerDelivery?: number // km
  
  // Efficiency
  deliveriesPerHour?: number
  onTimeDeliveryRate?: number // percentage
}

// Constants
export const DELIVERY_PHOTO_CONFIG = {
  maxPhotoSizeMB: 10,
  compressionOptions: {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8,
    format: 'jpeg' as const
  },
  thumbnailOptions: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
    format: 'jpeg' as const
  },
  cameraOptions: {
    facingMode: 'environment' as const, // Use rear camera
    width: 1920,
    height: 1080
  }
}

export const DELIVERY_CLEANUP_CONFIG: DeliveryCleanupConfig = {
  photosRetentionDays: 60, // 2 months
  dataRetentionDays: 365, // 1 year
  runCleanupEveryDays: 7 // Weekly
}

// Helper type for photo compression result
export interface CompressedPhotoResult {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
}