import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { 
  LeaveRequest, 
  LeaveQuotaYear, 
  LeaveType,
  LeaveStatus,
  LEAVE_TYPE_LABELS 
} from '@/types/leave';
import * as leaveService from '@/lib/services/leaveService';
import { DiscordNotificationService } from '@/lib/discord/notificationService';

export const useLeave = () => {
  const { userData } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<LeaveQuotaYear | null>(null);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);

  // Fetch current year quota
  const fetchQuota = async () => {
    if (!userData?.id) return;
    
    try {
      const currentYear = new Date().getFullYear();
      const data = await leaveService.getQuotaForYear(userData.id, currentYear);
      setQuota(data);
    } catch (error) {
      console.error('Error fetching quota:', error);
    }
  };

  // Fetch my leave requests
  const fetchMyLeaves = async () => {
    if (!userData?.id) return;
    
    try {
      const leaves = await leaveService.getLeaveRequests({ userId: userData.id });
      setMyLeaves(leaves);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  // Fetch team leaves (for managers)
  const fetchTeamLeaves = async () => {
    if (!userData || (userData.role !== 'manager' && userData.role !== 'hr' && userData.role !== 'admin')) {
      return;
    }
    
    try {
      // For now, fetch all pending leaves
      // Later can filter by location or team
      const leaves = await leaveService.getLeaveRequests({ 
        status: 'pending'
      });
      setTeamLeaves(leaves);
    } catch (error) {
      console.error('Error fetching team leaves:', error);
    }
  };

  // Create leave request
  const createLeaveRequest = async (
    type: LeaveType,
    startDate: Date,
    endDate: Date,
    reason: string,
    isUrgent: boolean,
    attachments?: File[]
  ) => {
    if (!userData?.id) return;
    
    setLoading(true);
    try {
      // Validate request
      const validation = leaveService.validateLeaveRequest(type, startDate, isUrgent);
      if (!validation.valid && validation.message) {
        throw new Error(validation.message);
      }
      // ถ้ามี warning จะไม่ throw error แต่จะดำเนินการต่อ
      
      // Calculate days and multiplier
      const totalDays = leaveService.calculateLeaveDays(startDate, endDate);
      const urgentMultiplier = isUrgent ? leaveService.LEAVE_RULES[type].urgentMultiplier : 1;
      
      // Create request with userAvatar
      const leaveId = await leaveService.createLeaveRequest({
        userId: userData.id,
        userName: userData.lineDisplayName || userData.fullName,
        userEmail: userData.id, // Using ID as we don't have email
        userAvatar: userData.linePictureUrl, // เพิ่ม userAvatar จาก LINE picture URL
        type,
        startDate,
        endDate,
        totalDays,
        reason,
        urgentMultiplier,
        status: 'pending'
      });
      
      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        const uploadPromises = attachments.map(file => 
          leaveService.uploadLeaveAttachment(leaveId, file)
        );
        const urls = await Promise.all(uploadPromises);
        
        // Update leave with attachment URLs
        // Note: You'll need to add an updateLeaveRequest function
      }
      
      // Send Discord notification
      try {
        await DiscordNotificationService.notifyLeaveRequest(
          userData.id,
          userData.lineDisplayName || userData.fullName,
          LEAVE_TYPE_LABELS[type],
          startDate,
          endDate,
          totalDays,
          reason,
          isUrgent,
          userData.linePictureUrl
        );
      } catch (error) {
        console.error('Discord notification failed:', error);
        // Don't fail the whole operation if Discord fails
      }
      
      showToast('ส่งคำขอลาเรียบร้อยแล้ว', 'success');
      
      // Refresh data
      await Promise.all([fetchMyLeaves(), fetchQuota()]);
      
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถส่งคำขอลาได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Approve leave request
  const approveLeave = async (leaveId: string) => {
    if (!userData?.id) return;
    
    setLoading(true);
    try {
      // Get leave details for notification
      const leave = teamLeaves.find(l => l.id === leaveId);
      
      await leaveService.approveLeaveRequest(leaveId, userData.id);
      
      // Send Discord notification
      if (leave) {
        try {
          // Safely convert dates
          let startDate: Date;
          let endDate: Date;
          
          try {
            if (leave.startDate instanceof Date) {
              startDate = leave.startDate;
            } else if ((leave.startDate as any)?.toDate) {
              startDate = (leave.startDate as any).toDate();
            } else if ((leave.startDate as any)?.seconds) {
              startDate = new Date((leave.startDate as any).seconds * 1000);
            } else {
              startDate = new Date(leave.startDate as any);
            }
            
            if (leave.endDate instanceof Date) {
              endDate = leave.endDate;
            } else if ((leave.endDate as any)?.toDate) {
              endDate = (leave.endDate as any).toDate();
            } else if ((leave.endDate as any)?.seconds) {
              endDate = new Date((leave.endDate as any).seconds * 1000);
            } else {
              endDate = new Date(leave.endDate as any);
            }
          } catch (err) {
            console.error('Date conversion error:', err);
            // Use today as fallback
            startDate = new Date();
            endDate = new Date();
          }
          
          await DiscordNotificationService.notifyLeaveApproval(
            leave.userId,
            leave.userName,
            LEAVE_TYPE_LABELS[leave.type],
            startDate,
            endDate,
            userData.lineDisplayName || userData.fullName,
            leave.userAvatar
          );
        } catch (error) {
          console.error('Discord notification failed:', error);
        }
      }
      
      showToast('อนุมัติคำขอลาเรียบร้อยแล้ว', 'success');
      
      await fetchTeamLeaves();
      
    } catch (error) {
      showToast('ไม่สามารถอนุมัติคำขอลาได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reject leave request
  const rejectLeave = async (leaveId: string, reason: string) => {
    if (!userData?.id) return;
    
    setLoading(true);
    try {
      // Get leave details for notification
      const leave = teamLeaves.find(l => l.id === leaveId);
      
      await leaveService.rejectLeaveRequest(leaveId, userData.id, reason);
      
      // Send Discord notification
      if (leave) {
        try {
          // Safely convert dates
          let startDate: Date;
          let endDate: Date;
          
          try {
            if (leave.startDate instanceof Date) {
              startDate = leave.startDate;
            } else if ((leave.startDate as any)?.toDate) {
              startDate = (leave.startDate as any).toDate();
            } else if ((leave.startDate as any)?.seconds) {
              startDate = new Date((leave.startDate as any).seconds * 1000);
            } else {
              startDate = new Date(leave.startDate as any);
            }
            
            if (leave.endDate instanceof Date) {
              endDate = leave.endDate;
            } else if ((leave.endDate as any)?.toDate) {
              endDate = (leave.endDate as any).toDate();
            } else if ((leave.endDate as any)?.seconds) {
              endDate = new Date((leave.endDate as any).seconds * 1000);
            } else {
              endDate = new Date(leave.endDate as any);
            }
          } catch (err) {
            console.error('Date conversion error:', err);
            // Use today as fallback
            startDate = new Date();
            endDate = new Date();
          }
          
          await DiscordNotificationService.notifyLeaveRejection(
            leave.userId,
            leave.userName,
            LEAVE_TYPE_LABELS[leave.type],
            startDate,
            endDate,
            userData.lineDisplayName || userData.fullName,
            reason,
            leave.userAvatar
          );
        } catch (error) {
          console.error('Discord notification failed:', error);
        }
      }
      
      showToast('ปฏิเสธคำขอลาเรียบร้อยแล้ว', 'success');
      
      await fetchTeamLeaves();
      
    } catch (error) {
      showToast('ไม่สามารถปฏิเสธคำขอลาได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update quota (HR only)
  const updateQuota = async (
    userId: string,
    year: number,
    type: LeaveType,
    newTotal: number,
    reason?: string
  ) => {
    if (!userData || (userData.role !== 'hr' && userData.role !== 'admin')) {
      return;
    }
    
    setLoading(true);
    try {
      await leaveService.updateQuota(userId, year, type, newTotal, userData.id!, reason);
      
      showToast('อัพเดทโควต้าเรียบร้อยแล้ว', 'success');
      
      if (userId === userData.id) {
        await fetchQuota();
      }
      
    } catch (error) {
      showToast('ไม่สามารถอัพเดทโควต้าได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel leave request
  const cancelLeave = async (leaveId: string, reason?: string) => {
    if (!userData?.id) return;
    
    setLoading(true);
    try {
      await leaveService.cancelLeaveRequest(leaveId, userData.id, reason);
      
      showToast('ยกเลิกคำขอลาเรียบร้อยแล้ว', 'success');
      
      // Refresh data
      await Promise.all([fetchMyLeaves(), fetchTeamLeaves()]);
      
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถยกเลิกคำขอลาได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel approved leave request (HR/Admin only)
  const cancelApprovedLeave = async (leaveId: string, reason: string) => {
    if (!userData?.id) return;
    
    // Check permission
    if (userData.role !== 'hr' && userData.role !== 'admin') {
      showToast('ไม่มีสิทธิ์ยกเลิกคำขอที่อนุมัติแล้ว', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await leaveService.cancelApprovedLeaveRequest(leaveId, userData.id, reason);
      
      showToast('ยกเลิกคำขอลาและคืนโควต้าเรียบร้อยแล้ว', 'success');
      
      // Refresh data
      await Promise.all([fetchMyLeaves(), fetchTeamLeaves(), fetchQuota()]);
      
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถยกเลิกคำขอลาได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData) {
      fetchQuota();
      fetchMyLeaves();
      fetchTeamLeaves();
    }
  }, [userData]);

  return {
    loading,
    quota,
    myLeaves,
    teamLeaves,
    createLeaveRequest,
    approveLeave,
    rejectLeave,
    cancelLeave,
    cancelApprovedLeave,
    updateQuota,
    refreshData: async () => {
      await Promise.all([
        fetchQuota(),
        fetchMyLeaves(),
        fetchTeamLeaves()
      ]);
    }
  };
};