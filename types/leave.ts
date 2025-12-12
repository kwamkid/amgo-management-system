export type LeaveType = 'sick' | 'personal' | 'vacation';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveQuota {
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveQuotaYear {
  userId: string;
  year: number;
  sick: LeaveQuota;
  personal: LeaveQuota;
  vacation: LeaveQuota;
  updatedBy: string;
  updatedAt: Date;
  history: QuotaHistory[];
}

export interface QuotaHistory {
  changedBy: string;
  changedAt: Date;
  changes: {
    [key in LeaveType]?: {
      from: number;
      to: number;
    };
  };
  reason?: string;
}

export interface LeaveRequest {
  id?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string; // เพิ่ม field สำหรับรูปโปรไฟล์
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  urgentMultiplier: number; // 1, 2, or 3
  attachments?: string[];
  status: LeaveStatus;
  managerId?: string;
  managerName?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  cancelledBy?: string; // เพิ่ม field สำหรับคนที่ยกเลิก
  cancelledAt?: Date; // เพิ่ม field สำหรับเวลาที่ยกเลิก
  cancelReason?: string; // เพิ่ม field สำหรับเหตุผลที่ยกเลิก
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRules {
  sick: {
    allowBackdate: boolean;
    requireCertificate: number; // days
    advanceNotice: number; // days
    urgentMultiplier: number;
  };
  personal: {
    allowBackdate: boolean;
    advanceNotice: number;
    urgentMultiplier: number;
  };
  vacation: {
    allowBackdate: boolean;
    advanceNotice: number;
    urgentMultiplier: number;
  };
}

export const LEAVE_RULES: LeaveRules = {
  sick: {
    allowBackdate: true,
    requireCertificate: 2,
    advanceNotice: 0,
    urgentMultiplier: 1
  },
  personal: {
    allowBackdate: false,
    advanceNotice: 3,
    urgentMultiplier: 2
  },
  vacation: {
    allowBackdate: false,
    advanceNotice: 7,
    urgentMultiplier: 2
  }
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  vacation: 'ลาพักร้อน'
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิก'
};

// Carry Over Types
export interface CarryOverRules {
  sick: CarryOverRule;
  personal: CarryOverRule;
  vacation: CarryOverRule;
}

export interface CarryOverRule {
  enabled: boolean;        // เปิด/ปิดการยกยอด
  maxDays: number | null;  // จำนวนวันสูงสุดที่ยกยอดได้ (null = ไม่จำกัด)
  percentage: number;      // เปอร์เซ็นต์ที่ยกยอดได้ (100 = ยกยอดทั้งหมด)
}

export interface CarryOverResult {
  userId: string;
  userName: string;
  fromYear: number;
  toYear: number;
  sick: { remaining: number; carriedOver: number };
  personal: { remaining: number; carriedOver: number };
  vacation: { remaining: number; carriedOver: number };
  success: boolean;
  error?: string;
}

export interface CarryOverSummary {
  totalUsers: number;
  successCount: number;
  failedCount: number;
  results: CarryOverResult[];
  executedBy: string;
  executedAt: Date;
}

// Default carry over rules
export const DEFAULT_CARRY_OVER_RULES: CarryOverRules = {
  sick: {
    enabled: false,     // ลาป่วยไม่ยกยอด
    maxDays: null,
    percentage: 0
  },
  personal: {
    enabled: false,     // ลากิจไม่ยกยอด
    maxDays: null,
    percentage: 0
  },
  vacation: {
    enabled: true,      // ลาพักร้อนยกยอดได้
    maxDays: 5,         // สูงสุด 5 วัน
    percentage: 100     // ยกยอดทั้งหมด (แต่ไม่เกิน maxDays)
  }
};