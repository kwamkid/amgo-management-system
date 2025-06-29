// types/influencer.ts

// ===== INFLUENCER TYPES =====
export interface Influencer {
  id?: string
  
  // Personal Info
  fullName: string // ชื่อ-นามสกุล
  nickname: string // ชื่อเล่น
  birthDate?: Date | string
  phone: string
  email: string
  lineId?: string
  
  // Address
  shippingAddress?: string
  province?: string
  
  // Categorization
  tier: InfluencerTier
  notes?: string
  
  // Children Info
  children?: Child[]
  
  // Social Media
  socialChannels?: SocialChannel[]
  
  // Stats
  totalFollowers?: number // คำนวณจากทุก channels
  
  // Status
  isActive: boolean
  
  // Timestamps
  createdAt?: Date
  createdBy?: string
  updatedAt?: Date
  updatedBy?: string
}

export interface Child {
  id?: string
  nickname: string
  birthDate?: Date | string
  gender: 'male' | 'female'
}

export interface SocialChannel {
  id?: string
  platform: SocialPlatform
  profileUrl: string
  username?: string
  followerCount?: number
  isVerified?: boolean
  
  // For auto-fetch
  lastFetched?: Date
  fetchError?: string
  
  // Platform-specific data
  platformData?: {
    // YouTube
    subscriberCount?: number
    videoCount?: number
    viewCount?: number
    
    // Instagram
    postCount?: number
    followingCount?: number
    
    // TikTok
    likesCount?: number
    
    // Facebook
    pageId?: string
    pageName?: string
    
    // Other metrics
    engagementRate?: number
    averageViews?: number
  }
}

export type SocialPlatform = 
  | 'facebook' 
  | 'instagram' 
  | 'tiktok' 
  | 'lemon8'
  | 'website'
  | 'youtube'
  | 'twitter'
  | 'others'

export type InfluencerTier = 
  | 'nano'     // < 10K
  | 'micro'    // 10K - 100K  
  | 'macro'    // 100K - 1M
  | 'mega'     // > 1M

// ===== BRAND & PRODUCT TYPES =====
export interface Brand {
  id?: string
  name: string
  description?: string
  logo?: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface Product {
  id?: string
  brandId: string
  brandName?: string // for display
  name: string
  description?: string
  image?: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

// ===== CAMPAIGN TYPES =====
export interface Campaign {
  id?: string
  
  // Basic Info
  name: string
  description: string // Brief
  briefFileUrl?: string // Google Drive/Dropbox link
  trackingUrl?: string // Link สำหรับบิลส่งของ
  
  // Budget
  budget?: number
  currency?: 'THB' | 'USD'
  
  // Timeline
  startDate: Date | string
  deadline: Date | string
  
  // Assignments
  influencers: CampaignInfluencer[]
  
  // Products
  brands: string[] // Brand IDs
  products: string[] // Product IDs
  
  // Status
  status: CampaignStatus
  
  // Management
  createdBy: string
  createdByName?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface CampaignInfluencer {
  influencerId: string
  influencerName: string
  influencerNickname?: string
  
  // Assignment
  assignedAt: Date
  fee?: number // ค่าจ้าง (ถ้ามี)
  
  // Submission
  submissionLink?: string // Unique link
  submissionStatus: SubmissionStatus
  submittedAt?: Date
  
  // Review
  reviewedAt?: Date
  reviewedBy?: string
  reviewNotes?: string
  
  // Submitted Links
  submittedLinks?: SubmittedLink[]
}

export interface SubmittedLink {
  id: string
  url: string
  platform?: SocialPlatform
  addedAt: Date
}

export type CampaignStatus = 
  | 'pending'     // รอดำเนินการ
  | 'active'      // กำลังดำเนินการ
  | 'reviewing'   // มีงานรอตรวจสอบ
  | 'completed'   // เสร็จสิ้น
  | 'cancelled'   // ยกเลิก

export type SubmissionStatus =
  | 'pending'     // ยังไม่ submit
  | 'submitted'   // รอตรวจสอบ
  | 'revision'    // รอแก้ไข
  | 'resubmitted' // ส่งแก้ไขแล้ว รอตรวจสอบ
  | 'approved'    // เสร็จสิ้น
  | 'cancelled'   // ยกเลิก

// ===== SUBMISSION TYPES =====
export interface Submission {
  id?: string
  code: string // Unique submission code
  
  // Link to campaign & influencer
  campaignId: string
  campaignName: string
  influencerId: string
  influencerName: string
  
  // Submission data
  links: SubmittedLink[]
  isDraft: boolean
  
  // History
  submittedAt?: Date
  lastSavedAt?: Date
  
  // Review
  status: SubmissionStatus
  reviewHistory: ReviewAction[]
}

export interface ReviewAction {
  action: 'submitted' | 'approved' | 'rejected' | 'revision_requested'
  actionBy: string
  actionByName: string
  actionAt: Date
  notes?: string
}

// ===== FORM DATA TYPES =====
export interface CreateInfluencerData {
  fullName: string
  nickname: string
  birthDate?: string
  phone: string
  email: string
  lineId?: string
  shippingAddress?: string
  province?: string
  tier: InfluencerTier
  notes?: string
  children: Omit<Child, 'id'>[]
  socialChannels: Omit<SocialChannel, 'id'>[]
}

export interface CreateCampaignData {
  name: string
  description: string
  briefFileUrl?: string
  trackingUrl?: string
  budget?: number
  startDate: string
  deadline: string
  influencerIds: string[]
  brandIds: string[]
  productIds: string[]
}

// ===== SOCIAL MEDIA FETCH TYPES =====
export interface SocialMediaFetchResult {
  success: boolean
  platform: SocialPlatform
  data?: {
    username?: string
    followerCount?: number
    isVerified?: boolean
    profilePicture?: string
    platformData?: any
  }
  error?: string
}

export interface SocialMediaFetcher {
  platform: SocialPlatform
  canFetch: boolean
  fetchData: (url: string) => Promise<SocialMediaFetchResult>
}

// ===== HELPER TYPES =====
// Import these icons from lucide-react in components:
// import { Facebook, Instagram, Music2, Citrus, Globe, Youtube, Twitter, Plus } from 'lucide-react'

export const PLATFORM_INFO: Record<SocialPlatform, {
  name: string
  icon: string // Icon component name from lucide-react
  color: string
  urlPattern?: RegExp
}> = {
  facebook: {
    name: 'Facebook',
    icon: 'Facebook', // Facebook icon
    color: '#1877F2',
    urlPattern: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(.+)/
  },
  instagram: {
    name: 'Instagram',
    icon: 'Instagram', // Instagram icon
    color: '#E4405F',
    urlPattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)/
  },
  tiktok: {
    name: 'TikTok',
    icon: 'Music2', // Music2 icon for TikTok
    color: '#000000',
    urlPattern: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]+)/
  },
  lemon8: {
    name: 'Lemon8',
    icon: 'Citrus', // Citrus icon for Lemon8
    color: '#FED402',
    urlPattern: /(?:https?:\/\/)?(?:www\.)?lemon8-app\.com\/(.+)/
  },
  website: {
    name: 'Website',
    icon: 'Globe', // Globe icon
    color: '#718096',
  },
  youtube: {
    name: 'YouTube',
    icon: 'Youtube', // Youtube icon
    color: '#FF0000',
    urlPattern: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)([A-Za-z0-9_-]+)/
  },
  twitter: {
    name: 'Twitter/X',
    icon: 'Twitter', // Twitter icon
    color: '#1DA1F2',
    urlPattern: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]+)/
  },
  others: {
    name: 'Others',
    icon: 'Plus', // Plus icon
    color: '#A0AEC0',
  }
}

// Province list for Thailand
export const THAILAND_PROVINCES = [
  'กรุงเทพมหานคร',
  'กระบี่',
  'กาญจนบุรี',
  'กาฬสินธุ์',
  'กำแพงเพชร',
  'ขอนแก่น',
  'จันทบุรี',
  'ฉะเชิงเทรา',
  'ชลบุรี',
  'ชัยนาท',
  'ชัยภูมิ',
  'ชุมพร',
  'เชียงราย',
  'เชียงใหม่',
  'ตรัง',
  'ตราด',
  'ตาก',
  'นครนายก',
  'นครปฐม',
  'นครพนม',
  'นครราชสีมา',
  'นครศรีธรรมราช',
  'นครสวรรค์',
  'นนทบุรี',
  'นราธิวาส',
  'น่าน',
  'บึงกาฬ',
  'บุรีรัมย์',
  'ปทุมธานี',
  'ประจวบคีรีขันธ์',
  'ปราจีนบุรี',
  'ปัตตานี',
  'พระนครศรีอยุธยา',
  'พังงา',
  'พัทลุง',
  'พิจิตร',
  'พิษณุโลก',
  'เพชรบุรี',
  'เพชรบูรณ์',
  'แพร่',
  'พะเยา',
  'ภูเก็ต',
  'มหาสารคาม',
  'มุกดาหาร',
  'แม่ฮ่องสอน',
  'ยโสธร',
  'ยะลา',
  'ร้อยเอ็ด',
  'ระนอง',
  'ระยอง',
  'ราชบุรี',
  'ลพบุรี',
  'ลำปาง',
  'ลำพูน',
  'เลย',
  'ศรีสะเกษ',
  'สกลนคร',
  'สงขลา',
  'สตูล',
  'สมุทรปราการ',
  'สมุทรสงคราม',
  'สมุทรสาคร',
  'สระแก้ว',
  'สระบุรี',
  'สิงห์บุรี',
  'สุโขทัย',
  'สุพรรณบุรี',
  'สุราษฎร์ธานี',
  'สุรินทร์',
  'หนองคาย',
  'หนองบัวลำภู',
  'อ่างทอง',
  'อุดรธานี',
  'อุทัยธานี',
  'อุตรดิตถ์',
  'อุบลราชธานี',
  'อำนาจเจริญ'
]

// Helper function to calculate tier from total followers
export function calculateInfluencerTier(totalFollowers: number): InfluencerTier {
  if (totalFollowers >= 1000000) return 'mega'
  if (totalFollowers >= 100000) return 'macro'
  if (totalFollowers >= 10000) return 'micro'
  return 'nano'
}

// Helper to extract username from social URL
export function extractUsernameFromUrl(url: string, platform: SocialPlatform): string | null {
  const pattern = PLATFORM_INFO[platform].urlPattern
  if (!pattern) return null
  
  const match = url.match(pattern)
  return match ? match[1] : null
}