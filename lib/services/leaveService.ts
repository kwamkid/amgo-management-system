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
  QuotaHistory
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
  
  // Update leave status
  batch.update(leaveRef, {
    status: 'approved',
    approvedBy,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  // Update quota
  const year = new Date(leave.startDate).getFullYear();
  const quotaRef = doc(db, 'quotas', leave.userId, 'years', year.toString());
  const quota = await getQuotaForYear(leave.userId, year);
  
  if (quota) {
    const actualDays = leave.totalDays * leave.urgentMultiplier;
    const newUsed = quota[leave.type].used + actualDays;
    const newRemaining = quota[leave.type].total - newUsed;
    
    batch.update(quotaRef, {
      [`${leave.type}.used`]: newUsed,
      [`${leave.type}.remaining`]: newRemaining,
      updatedAt: serverTimestamp()
    });
  }
  
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

// Calculate working days between two dates (excluding weekends)
export const calculateLeaveDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

// Validate leave request based on rules
export const validateLeaveRequest = (
  type: LeaveType,
  startDate: Date,
  isUrgent: boolean
): { valid: boolean; message?: string } => {
  const rules = LEAVE_RULES[type];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  
  // Check backdate
  if (!rules.allowBackdate && startDate < today) {
    return { 
      valid: false, 
      message: 'ไม่สามารถลาย้อนหลังได้สำหรับประเภทนี้' 
    };
  }
  
  // Check advance notice (only if not urgent and future date)
  if (!isUrgent && startDate > today) {
    const daysDiff = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < rules.advanceNotice) {
      return { 
        valid: false, 
        message: `ต้องลาล่วงหน้าอย่างน้อย ${rules.advanceNotice} วัน` 
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