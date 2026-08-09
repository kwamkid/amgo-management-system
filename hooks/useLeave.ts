import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import {
  LeaveRequest,
  LeaveQuotaYear,
  LeaveType,
  LEAVE_TYPE_LABELS,
} from '@/types/leave'
import * as leaveService from '@/lib/services/leaveService'
import { DiscordNotificationService } from '@/lib/discord/notificationService'

/**
 * ── ที่เปลี่ยนจากของเดิม ────────────────────────────────────────────────
 * 1. service คืน Date จริงมาแล้ว — ตัดโค้ดแปลง Firestore Timestamp
 *    ที่ก๊อปวางซ้ำกัน 3 ชุด (ชุดละ ~20 บรรทัด) ออกได้ทั้งหมด
 * 2. ไฟล์แนบถูกผูกกับใบลาจริง ๆ แล้ว ของเดิมอัปโหลดขึ้นไปแล้วลอยทิ้งไว้
 * 3. โควต้าไม่ต้อง refresh เองหลังอนุมัติ/ยกเลิก — ฐานข้อมูลคิดให้ตอนนั้นเลย
 */
export const useLeave = () => {
  const { userData } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<LeaveQuotaYear | null>(null)
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([])
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([])

  const canReview =
    userData?.role === 'manager' || userData?.role === 'hr' || userData?.role === 'admin'

  const fetchQuota = useCallback(async () => {
    if (!userData?.id) return
    try {
      setQuota(await leaveService.getQuotaForYear(userData.id, new Date().getFullYear()))
    } catch (error) {
      console.error('โหลดโควต้าไม่สำเร็จ:', error)
    }
  }, [userData?.id])

  const fetchMyLeaves = useCallback(async () => {
    if (!userData?.id) return
    try {
      setMyLeaves(await leaveService.getLeaveRequests({ userId: userData.id }))
    } catch (error) {
      console.error('โหลดใบลาไม่สำเร็จ:', error)
    }
  }, [userData?.id])

  const fetchTeamLeaves = useCallback(async () => {
    if (!canReview) return
    try {
      setTeamLeaves(await leaveService.getLeaveRequests({ status: 'pending' }))
    } catch (error) {
      console.error('โหลดใบลาของทีมไม่สำเร็จ:', error)
    }
  }, [canReview])

  const refreshData = useCallback(async () => {
    await Promise.all([fetchQuota(), fetchMyLeaves(), fetchTeamLeaves()])
  }, [fetchQuota, fetchMyLeaves, fetchTeamLeaves])

  /* ---------------------------------------------------------------- */
  const createLeaveRequest = async (
    type: LeaveType,
    startDate: Date,
    endDate: Date,
    reason: string,
    isUrgent: boolean,
    attachments?: File[]
  ) => {
    if (!userData?.id) return

    setLoading(true)
    try {
      const validation = leaveService.validateLeaveRequest(type, startDate, isUrgent)
      if (!validation.valid && validation.message) throw new Error(validation.message)

      const totalDays = leaveService.calculateLeaveDays(startDate, endDate)
      const urgentMultiplier = isUrgent ? leaveService.LEAVE_RULES[type].urgentMultiplier : 1

      const leaveId = await leaveService.createLeaveRequest({
        userId: userData.id,
        userName: userData.lineDisplayName || userData.fullName,
        userEmail: userData.id,
        userAvatar: userData.linePictureUrl,
        type,
        startDate,
        endDate,
        totalDays,
        reason,
        urgentMultiplier,
        status: 'pending',
      })

      // ของเดิมอัปโหลดแล้วไม่เคยเก็บ URL ลงใบลา — ไฟล์หายทุกใบ
      if (attachments?.length) {
        try {
          await leaveService.uploadLeaveAttachments(leaveId, attachments)
        } catch (error) {
          // ใบลาส่งไปแล้ว ไฟล์แนบพลาดไม่ควรทำให้ทั้งหมดล้ม
          console.error('แนบไฟล์ไม่สำเร็จ:', error)
          showToast('ส่งใบลาแล้ว แต่แนบไฟล์ไม่สำเร็จ กรุณาแนบใหม่ภายหลัง', 'error')
        }
      }

      await notify(() =>
        DiscordNotificationService.notifyLeaveRequest(
          userData.id!,
          userData.lineDisplayName || userData.fullName,
          LEAVE_TYPE_LABELS[type],
          startDate,
          endDate,
          totalDays,
          reason,
          isUrgent,
          userData.linePictureUrl
        )
      )

      showToast('ส่งคำขอลาเรียบร้อยแล้ว', 'success')
      await Promise.all([fetchMyLeaves(), fetchQuota()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถส่งคำขอลาได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  /* ---------------------------------------------------------------- */
  const approveLeave = async (leaveId: string) => {
    if (!userData?.id) return

    setLoading(true)
    try {
      const leave = teamLeaves.find((l) => l.id === leaveId)
      await leaveService.approveLeaveRequest(leaveId, userData.id)

      if (leave) {
        await notify(() =>
          DiscordNotificationService.notifyLeaveApproval(
            leave.userId,
            leave.userName,
            LEAVE_TYPE_LABELS[leave.type],
            leave.startDate,
            leave.endDate,
            userData.lineDisplayName || userData.fullName,
            leave.userAvatar
          )
        )
      }

      showToast('อนุมัติคำขอลาเรียบร้อยแล้ว', 'success')
      await Promise.all([fetchTeamLeaves(), fetchQuota()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถอนุมัติคำขอลาได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  /* ---------------------------------------------------------------- */
  const rejectLeave = async (leaveId: string, reason: string) => {
    if (!userData?.id) return

    setLoading(true)
    try {
      const leave = teamLeaves.find((l) => l.id === leaveId)
      await leaveService.rejectLeaveRequest(leaveId, userData.id, reason)

      if (leave) {
        await notify(() =>
          DiscordNotificationService.notifyLeaveRejection(
            leave.userId,
            leave.userName,
            LEAVE_TYPE_LABELS[leave.type],
            leave.startDate,
            leave.endDate,
            userData.lineDisplayName || userData.fullName,
            reason,
            leave.userAvatar
          )
        )
      }

      showToast('ปฏิเสธคำขอลาเรียบร้อยแล้ว', 'success')
      await fetchTeamLeaves()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถปฏิเสธคำขอลาได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  /* ---------------------------------------------------------------- */
  const updateQuota = async (
    userId: string,
    year: number,
    type: LeaveType,
    newTotal: number,
    reason?: string
  ) => {
    if (userData?.role !== 'hr' && userData?.role !== 'admin') return

    setLoading(true)
    try {
      await leaveService.updateQuota(userId, year, type, newTotal, userData.id!, reason)
      showToast('อัพเดทโควต้าเรียบร้อยแล้ว', 'success')
      if (userId === userData.id) await fetchQuota()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถอัพเดทโควต้าได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  /* ---------------------------------------------------------------- */
  const cancelLeave = async (leaveId: string, reason?: string) => {
    if (!userData?.id) return

    setLoading(true)
    try {
      await leaveService.cancelLeaveRequest(leaveId, userData.id, reason)
      showToast('ยกเลิกคำขอลาเรียบร้อยแล้ว', 'success')
      await Promise.all([fetchMyLeaves(), fetchTeamLeaves()])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถยกเลิกคำขอลาได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  /* ---------------------------------------------------------------- */
  const cancelApprovedLeave = async (leaveId: string, reason: string) => {
    if (!userData?.id) return

    if (userData.role !== 'hr' && userData.role !== 'admin') {
      showToast('ไม่มีสิทธิ์ยกเลิกคำขอที่อนุมัติแล้ว', 'error')
      return
    }

    setLoading(true)
    try {
      await leaveService.cancelApprovedLeaveRequest(leaveId, userData.id, reason)
      showToast('ยกเลิกคำขอลาและคืนโควต้าเรียบร้อยแล้ว', 'success')
      await refreshData()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ไม่สามารถยกเลิกคำขอลาได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userData) refreshData()
  }, [userData, refreshData])

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
    refreshData,
  }
}

/** แจ้ง Discord ไม่สำเร็จ ไม่ควรทำให้การลาล้มตาม */
async function notify(send: () => Promise<unknown>) {
  try {
    await send()
  } catch (error) {
    console.error('แจ้งเตือน Discord ไม่สำเร็จ:', error)
  }
}
