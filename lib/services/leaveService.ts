import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  updateDoc,
  Timestamp,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import {
  LeaveRequest,
  LeaveQuotaYear,
  LeaveType,
  LeaveStatus,
  LEAVE_RULES,
  QuotaHistory,
  CarryOverRules,
  CarryOverResult,
  CarryOverSummary,
  DEFAULT_CARRY_OVER_RULES
} from '@/types/leave';

// Quota Management
export const getQuotaForYear = async (userId: string, year: number): Promise<LeaveQuotaYear | null> => {
  const quotaRef = doc(db, 'quotas', userId, 'years', year.toString());
  const quotaSnap = await getDoc(quotaRef);
  
  if (!quotaSnap.exists()) {
    // Create zero quota if not exists - HR must assign quota first
    const defaultQuota: LeaveQuotaYear = {
      userId,
      year,
      sick: { total: 0, used: 0, remaining: 0 },
      personal: { total: 0, used: 0, remaining: 0 },
      vacation: { total: 0, used: 0, remaining: 0 },
      updatedBy: 'system',
      updatedAt: new Date(),
      history: []
    };
    
    await setDoc(quotaRef, defaultQuota);
    return defaultQuota;
  }
  
  return quotaSnap.data() as LeaveQuotaYear;
};

export const updateQuota = async (
  userId: string, 
  year: number, 
  type: LeaveType, 
  newTotal: number,
  updatedBy: string,
  reason?: string
): Promise<void> => {
  const quotaRef = doc(db, 'quotas', userId, 'years', year.toString());
  const currentQuota = await getQuotaForYear(userId, year);
  
  if (!currentQuota) return;
  
  const oldTotal = currentQuota[type].total;
  const used = currentQuota[type].used;
  const newRemaining = newTotal - used;
  
  // Create history entry
  const historyEntry: QuotaHistory = {
    changedBy: updatedBy,
    changedAt: new Date(),
    changes: {
      [type]: { from: oldTotal, to: newTotal }
    },
    reason
  };
  
  await updateDoc(quotaRef, {
    [`${type}.total`]: newTotal,
    [`${type}.remaining`]: newRemaining,
    updatedBy,
    updatedAt: serverTimestamp(),
    history: [...currentQuota.history, historyEntry]
  });
};

// Leave Request Management
export const createLeaveRequest = async (
  request: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const leaveRef = doc(collection(db, 'leaves'));
  
  // Check quota
  const year = new Date(request.startDate).getFullYear();
  const quota = await getQuotaForYear(request.userId, year);
  
  if (!quota) {
    throw new Error('ไม่พบข้อมูลโควต้า');
  }
  
  const actualDays = request.totalDays * request.urgentMultiplier;
  if (quota[request.type].remaining < actualDays) {
    throw new Error(`โควต้าไม่เพียงพอ (เหลือ ${quota[request.type].remaining} วัน)`);
  }
  
  await setDoc(leaveRef, {
    ...request,
    id: leaveRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return leaveRef.id;
};

export const getLeaveRequests = async (filters?: {
  userId?: string;
  managerId?: string;
  status?: LeaveStatus;
  startDate?: Date;
  endDate?: Date;
}): Promise<LeaveRequest[]> => {
  let q = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'));
  
  if (filters?.userId) {
    q = query(q, where('userId', '==', filters.userId));
  }
  if (filters?.managerId) {
    q = query(q, where('managerId', '==', filters.managerId));
  }
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as LeaveRequest));
};

export const approveLeaveRequest = async (
  leaveId: string,
  approvedBy: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get leave request
  const leaveRef = doc(db, 'leaves', leaveId);
  const leaveSnap = await getDoc(leaveRef);
  
  if (!leaveSnap.exists()) {
    throw new Error('ไม่พบคำขอลา');
  }
  
  const leave = leaveSnap.data() as LeaveRequest;
  
  // Check if already processed
  if (leave.status !== 'pending') {
    throw new Error('คำขอลานี้ได้รับการดำเนินการแล้ว');
  }
  
  // Update leave status
  batch.update(leaveRef, {
    status: 'approved',
    approvedBy,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  // Convert startDate to proper Date object for year extraction
  let year: number;
  const startDate = leave.startDate;
  
  if (startDate instanceof Date) {
    year = startDate.getFullYear();
  } else if ((startDate as any)?.toDate) {
    // Firestore Timestamp
    year = (startDate as any).toDate().getFullYear();
  } else if ((startDate as any)?.seconds) {
    // Firestore Timestamp object
    year = new Date((startDate as any).seconds * 1000).getFullYear();
  } else {
    // String or number
    year = new Date(startDate as any).getFullYear();
  }
  
  // Get current quota
  const quotaRef = doc(db, 'quotas', leave.userId, 'years', year.toString());
  const quota = await getQuotaForYear(leave.userId, year);
  
  if (!quota) {
    throw new Error('ไม่พบข้อมูลโควต้า');
  }
  
  // Calculate actual days to deduct
  const actualDays = leave.totalDays * leave.urgentMultiplier;
  
  // Check if has enough quota
  if (quota[leave.type].remaining < actualDays) {
    throw new Error(`โควต้าไม่เพียงพอ (เหลือ ${quota[leave.type].remaining} วัน แต่ต้องใช้ ${actualDays} วัน)`);
  }
  
  // Update quota
  const newUsed = quota[leave.type].used + actualDays;
  const newRemaining = quota[leave.type].total - newUsed;
  
  batch.update(quotaRef, {
    [`${leave.type}.used`]: newUsed,
    [`${leave.type}.remaining`]: newRemaining,
    updatedAt: serverTimestamp()
  });
  
  // Add history entry
  const historyEntry: QuotaHistory = {
    changedBy: approvedBy,
    changedAt: new Date(),
    changes: {
      [leave.type]: { 
        from: quota[leave.type].used, 
        to: newUsed 
      }
    },
    reason: `อนุมัติการลา #${leaveId} (${actualDays} วัน)`
  };
  
  batch.update(quotaRef, {
    history: [...(quota.history || []), historyEntry]
  });
  
  await batch.commit();
};

export const rejectLeaveRequest = async (
  leaveId: string,
  rejectedBy: string,
  reason: string
): Promise<void> => {
  const leaveRef = doc(db, 'leaves', leaveId);
  
  await updateDoc(leaveRef, {
    status: 'rejected',
    approvedBy: rejectedBy,
    approvedAt: serverTimestamp(),
    rejectedReason: reason,
    updatedAt: serverTimestamp()
  });
};

// Cancel Leave Request (for pending status)
export const cancelLeaveRequest = async (
  leaveId: string,
  cancelledBy: string,
  cancelReason?: string
): Promise<void> => {
  const leaveRef = doc(db, 'leaves', leaveId);
  const leaveSnap = await getDoc(leaveRef);
  
  if (!leaveSnap.exists()) {
    throw new Error('ไม่พบคำขอลา');
  }
  
  const leave = leaveSnap.data() as LeaveRequest;
  
  // Check if can cancel (only pending status)
  if (leave.status !== 'pending') {
    throw new Error('ไม่สามารถยกเลิกคำขอที่อนุมัติแล้วหรือถูกปฏิเสธแล้ว');
  }
  
  await updateDoc(leaveRef, {
    status: 'cancelled',
    cancelledBy,
    cancelledAt: serverTimestamp(),
    cancelReason: cancelReason || 'ยกเลิกโดยผู้ใช้',
    updatedAt: serverTimestamp()
  });
};

// Cancel Approved Leave Request (HR/Admin only) with quota refund
export const cancelApprovedLeaveRequest = async (
  leaveId: string,
  cancelledBy: string,
  cancelReason: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  // Get leave request
  const leaveRef = doc(db, 'leaves', leaveId);
  const leaveSnap = await getDoc(leaveRef);
  
  if (!leaveSnap.exists()) {
    throw new Error('ไม่พบคำขอลา');
  }
  
  const leave = leaveSnap.data() as LeaveRequest;
  
  // Check if approved
  if (leave.status !== 'approved') {
    throw new Error('สามารถยกเลิกได้เฉพาะคำขอที่อนุมัติแล้วเท่านั้น');
  }
  
  // Update leave status
  batch.update(leaveRef, {
    status: 'cancelled',
    cancelledBy,
    cancelledAt: serverTimestamp(),
    cancelReason,
    previousStatus: 'approved', // เก็บสถานะเดิมไว้
    updatedAt: serverTimestamp()
  });
  
  // Refund quota
  // Convert startDate to proper Date object for year extraction
  let year: number;
  const startDate = leave.startDate;
  
  if (startDate instanceof Date) {
    year = startDate.getFullYear();
  } else if ((startDate as any)?.toDate) {
    year = (startDate as any).toDate().getFullYear();
  } else if ((startDate as any)?.seconds) {
    year = new Date((startDate as any).seconds * 1000).getFullYear();
  } else {
    year = new Date(startDate as any).getFullYear();
  }
  
  // Get current quota
  const quotaRef = doc(db, 'quotas', leave.userId, 'years', year.toString());
  const quota = await getQuotaForYear(leave.userId, year);
  
  if (!quota) {
    throw new Error('ไม่พบข้อมูลโควต้า');
  }
  
  // Calculate days to refund
  const refundDays = leave.totalDays * leave.urgentMultiplier;
  
  // Update quota - คืนโควต้า
  const newUsed = Math.max(0, quota[leave.type].used - refundDays);
  const newRemaining = quota[leave.type].total - newUsed;
  
  batch.update(quotaRef, {
    [`${leave.type}.used`]: newUsed,
    [`${leave.type}.remaining`]: newRemaining,
    updatedAt: serverTimestamp()
  });
  
  // Add history entry
  const historyEntry: QuotaHistory = {
    changedBy: cancelledBy,
    changedAt: new Date(),
    changes: {
      [leave.type]: { 
        from: quota[leave.type].used, 
        to: newUsed 
      }
    },
    reason: `ยกเลิกการลาที่อนุมัติแล้ว #${leaveId} - คืนโควต้า ${refundDays} วัน`
  };
  
  batch.update(quotaRef, {
    history: [...(quota.history || []), historyEntry]
  });
  
  await batch.commit();
};

// File Management
export const uploadLeaveAttachment = async (
  leaveId: string,
  file: File
): Promise<string> => {
  // Compress image if needed
  const compressedFile = await compressImage(file);
  
  const fileName = `${Date.now()}-${file.name}`;
  const storageRef = ref(storage, `leaves/${leaveId}/${fileName}`);
  
  await uploadBytes(storageRef, compressedFile);
  const downloadURL = await getDownloadURL(storageRef);
  
  return downloadURL;
};

const compressImage = async (file: File): Promise<File> => {
  // If not an image or already small, return as is
  if (!file.type.startsWith('image/') || file.size < 500000) {
    return file;
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Calculate new dimensions (max 1200px)
        let { width, height } = img;
        const maxSize = 1200;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Calculate total days between two dates (including weekends)
// เปลี่ยนเป็นนับทุกวันตามที่พนักงานเลือก เพราะบางคนทำงานเสาร์-อาทิตย์
export const calculateLeaveDays = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Reset time to start of day for accurate calculation
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Calculate difference in days
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // +1 เพราะนับวันเริ่มต้นด้วย (เช่น ลา 1-3 = 3 วัน)
  return diffDays + 1;
};

// Validate leave request based on rules
export const validateLeaveRequest = (
  type: LeaveType,
  startDate: Date,
  isUrgent: boolean
): { valid: boolean; message?: string; warning?: string } => {
  const rules = LEAVE_RULES[type];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  // Check backdate
  if (!rules.allowBackdate && start < today) {
    return { 
      valid: false, 
      message: 'ไม่สามารถลาย้อนหลังได้สำหรับประเภทนี้' 
    };
  }
  
  // Check advance notice - ตรวจสอบว่าแจ้งล่วงหน้าพอหรือไม่
  if (!isUrgent && rules.advanceNotice > 0) {
    // คำนวณจำนวนวันระหว่างวันนี้กับวันที่ต้องการลา
    const daysDiff = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // ถ้าแจ้งล่วงหน้าน้อยกว่าที่กำหนด = ลาด่วน
    if (daysDiff < rules.advanceNotice) {
      // Return warning instead of error
      return { 
        valid: true,
        warning: `การลา${type === 'personal' ? 'กิจ' : 'พักร้อน'}ควรแจ้งล่วงหน้า ${rules.advanceNotice} วัน หากดำเนินการต่อจะถูกหักโควต้า ${rules.urgentMultiplier} เท่า` 
      };
    }
  }
  
  return { valid: true };
};

// Auto cleanup old files (run monthly)
export const cleanupOldAttachments = async (): Promise<void> => {
  const fiveMonthsAgo = new Date();
  fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
  
  const oldLeaves = await getDocs(
    query(
      collection(db, 'leaves'),
      where('createdAt', '<', Timestamp.fromDate(fiveMonthsAgo)),
      where('attachments', '!=', null)
    )
  );
  
  for (const doc of oldLeaves.docs) {
    const leave = doc.data() as LeaveRequest;
    if (leave.attachments && leave.attachments.length > 0) {
      // Delete files from storage
      for (const url of leave.attachments) {
        try {
          const storageRef = ref(storage, url);
          await deleteObject(storageRef);
        } catch (error) {
          console.error('Error deleting file:', error);
        }
      }
      
      // Update document
      await updateDoc(doc.ref, {
        attachments: [],
        updatedAt: serverTimestamp()
      });
    }
  }
};

// Re-export LEAVE_RULES for external use
export { LEAVE_RULES } from '@/types/leave';

// =====================================================
// Carry Over Functions - ยกยอดโควต้าวันลาข้ามปี
// =====================================================

/**
 * คำนวณจำนวนวันที่จะยกยอดตาม rules
 */
const calculateCarryOverDays = (
  remaining: number,
  rule: { enabled: boolean; maxDays: number | null; percentage: number }
): number => {
  if (!rule.enabled || remaining <= 0) return 0;

  // คำนวณตาม percentage
  let carryOver = Math.floor(remaining * (rule.percentage / 100));

  // จำกัดตาม maxDays ถ้ามี
  if (rule.maxDays !== null && carryOver > rule.maxDays) {
    carryOver = rule.maxDays;
  }

  return carryOver;
};

/**
 * ยกยอดโควต้าสำหรับพนักงานคนเดียว
 */
export const carryOverQuotaForUser = async (
  userId: string,
  userName: string,
  fromYear: number,
  toYear: number,
  rules: CarryOverRules,
  executedBy: string,
  baseQuota?: { sick: number; personal: number; vacation: number }
): Promise<CarryOverResult> => {
  try {
    // ดึงโควต้าปีเดิม
    const oldQuota = await getQuotaForYear(userId, fromYear);

    if (!oldQuota) {
      return {
        userId,
        userName,
        fromYear,
        toYear,
        sick: { remaining: 0, carriedOver: 0 },
        personal: { remaining: 0, carriedOver: 0 },
        vacation: { remaining: 0, carriedOver: 0 },
        success: false,
        error: 'ไม่พบโควต้าปีเดิม'
      };
    }

    // คำนวณจำนวนวันที่ยกยอด
    const sickCarryOver = calculateCarryOverDays(oldQuota.sick.remaining, rules.sick);
    const personalCarryOver = calculateCarryOverDays(oldQuota.personal.remaining, rules.personal);
    const vacationCarryOver = calculateCarryOverDays(oldQuota.vacation.remaining, rules.vacation);

    // ดึงหรือสร้างโควต้าปีใหม่
    const newQuotaRef = doc(db, 'quotas', userId, 'years', toYear.toString());
    const newQuotaSnap = await getDoc(newQuotaRef);

    let newQuota: LeaveQuotaYear;

    if (newQuotaSnap.exists()) {
      // มีโควต้าปีใหม่อยู่แล้ว - เพิ่มยอดยกมา
      newQuota = newQuotaSnap.data() as LeaveQuotaYear;

      const updatedQuota = {
        sick: {
          total: newQuota.sick.total + sickCarryOver,
          used: newQuota.sick.used,
          remaining: newQuota.sick.total + sickCarryOver - newQuota.sick.used
        },
        personal: {
          total: newQuota.personal.total + personalCarryOver,
          used: newQuota.personal.used,
          remaining: newQuota.personal.total + personalCarryOver - newQuota.personal.used
        },
        vacation: {
          total: newQuota.vacation.total + vacationCarryOver,
          used: newQuota.vacation.used,
          remaining: newQuota.vacation.total + vacationCarryOver - newQuota.vacation.used
        }
      };

      // สร้าง history entry
      const historyEntry: QuotaHistory = {
        changedBy: executedBy,
        changedAt: new Date(),
        changes: {
          sick: sickCarryOver > 0 ? { from: newQuota.sick.total, to: updatedQuota.sick.total } : undefined,
          personal: personalCarryOver > 0 ? { from: newQuota.personal.total, to: updatedQuota.personal.total } : undefined,
          vacation: vacationCarryOver > 0 ? { from: newQuota.vacation.total, to: updatedQuota.vacation.total } : undefined
        },
        reason: `ยกยอดจากปี ${fromYear} (ป่วย: ${sickCarryOver}, กิจ: ${personalCarryOver}, พักร้อน: ${vacationCarryOver})`
      };

      await updateDoc(newQuotaRef, {
        ...updatedQuota,
        updatedBy: executedBy,
        updatedAt: serverTimestamp(),
        history: [...(newQuota.history || []), historyEntry]
      });
    } else {
      // ยังไม่มีโควต้าปีใหม่ - สร้างใหม่พร้อมยอดยกมา
      const baseSick = baseQuota?.sick ?? 0;
      const basePersonal = baseQuota?.personal ?? 0;
      const baseVacation = baseQuota?.vacation ?? 0;

      newQuota = {
        userId,
        year: toYear,
        sick: {
          total: baseSick + sickCarryOver,
          used: 0,
          remaining: baseSick + sickCarryOver
        },
        personal: {
          total: basePersonal + personalCarryOver,
          used: 0,
          remaining: basePersonal + personalCarryOver
        },
        vacation: {
          total: baseVacation + vacationCarryOver,
          used: 0,
          remaining: baseVacation + vacationCarryOver
        },
        updatedBy: executedBy,
        updatedAt: new Date(),
        history: [{
          changedBy: executedBy,
          changedAt: new Date(),
          changes: {
            sick: { from: 0, to: baseSick + sickCarryOver },
            personal: { from: 0, to: basePersonal + personalCarryOver },
            vacation: { from: 0, to: baseVacation + vacationCarryOver }
          },
          reason: `สร้างโควต้าปี ${toYear} พร้อมยกยอดจากปี ${fromYear}`
        }]
      };

      await setDoc(newQuotaRef, newQuota);
    }

    return {
      userId,
      userName,
      fromYear,
      toYear,
      sick: { remaining: oldQuota.sick.remaining, carriedOver: sickCarryOver },
      personal: { remaining: oldQuota.personal.remaining, carriedOver: personalCarryOver },
      vacation: { remaining: oldQuota.vacation.remaining, carriedOver: vacationCarryOver },
      success: true
    };
  } catch (error) {
    console.error(`Error carrying over quota for user ${userId}:`, error);
    return {
      userId,
      userName,
      fromYear,
      toYear,
      sick: { remaining: 0, carriedOver: 0 },
      personal: { remaining: 0, carriedOver: 0 },
      vacation: { remaining: 0, carriedOver: 0 },
      success: false,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
    };
  }
};

/**
 * ยกยอดโควต้าสำหรับพนักงานทั้งหมด
 */
export const carryOverQuotaForAllUsers = async (
  users: Array<{ id: string; fullName: string }>,
  fromYear: number,
  toYear: number,
  rules: CarryOverRules,
  executedBy: string,
  baseQuota?: { sick: number; personal: number; vacation: number }
): Promise<CarryOverSummary> => {
  const results: CarryOverResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const user of users) {
    const result = await carryOverQuotaForUser(
      user.id,
      user.fullName,
      fromYear,
      toYear,
      rules,
      executedBy,
      baseQuota
    );

    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  // บันทึก log การยกยอด
  const summaryRef = doc(collection(db, 'carryOverLogs'));
  const summary: CarryOverSummary = {
    totalUsers: users.length,
    successCount,
    failedCount,
    results,
    executedBy,
    executedAt: new Date()
  };

  await setDoc(summaryRef, {
    ...summary,
    fromYear,
    toYear,
    rules
  });

  return summary;
};

/**
 * ดึงประวัติการยกยอด
 */
export const getCarryOverLogs = async (year?: number): Promise<any[]> => {
  let q = query(collection(db, 'carryOverLogs'), orderBy('executedAt', 'desc'), limit(10));

  if (year) {
    q = query(q, where('toYear', '==', year));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * เช็คว่าเคยยกยอดจากปี fromYear ไป toYear แล้วหรือยัง
 */
export const checkCarryOverExists = async (
  fromYear: number,
  toYear: number
): Promise<{ exists: boolean; lastCarryOver: any | null }> => {
  const q = query(
    collection(db, 'carryOverLogs'),
    where('fromYear', '==', fromYear),
    where('toYear', '==', toYear),
    orderBy('executedAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { exists: false, lastCarryOver: null };
  }

  const doc = snapshot.docs[0];
  return {
    exists: true,
    lastCarryOver: {
      id: doc.id,
      ...doc.data(),
      executedAt: doc.data().executedAt?.toDate?.() || doc.data().executedAt
    }
  };
};

/**
 * เช็คว่ามีโควต้าปี toYear แล้วหรือยัง (สำหรับพนักงานทั้งหมด)
 */
export const checkQuotaExistsForYear = async (
  year: number,
  userIds: string[]
): Promise<{
  hasQuota: boolean;
  usersWithQuota: number;
  usersWithoutQuota: string[];
}> => {
  if (userIds.length === 0) {
    return { hasQuota: false, usersWithQuota: 0, usersWithoutQuota: [] };
  }

  const usersWithoutQuota: string[] = [];
  let usersWithQuota = 0;

  // ตรวจสอบทีละ user (เพราะ Firestore in query รองรับแค่ 30 items)
  for (const userId of userIds) {
    const quotaRef = doc(db, 'leaveQuotas', `${userId}_${year}`);
    const quotaSnap = await getDoc(quotaRef);

    if (quotaSnap.exists()) {
      usersWithQuota++;
    } else {
      usersWithoutQuota.push(userId);
    }
  }

  return {
    hasQuota: usersWithQuota > 0,
    usersWithQuota,
    usersWithoutQuota
  };
};