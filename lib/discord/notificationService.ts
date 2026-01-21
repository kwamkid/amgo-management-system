// ========== FILE: lib/discord/notificationService.ts ==========

import { NotificationEvent, WebhookChannel, EmbedColors } from '@/types/discord'
import * as webhookHandlers from './webhook'
import { DiscordWebhook } from './webhook'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

export class DiscordNotificationService {
  // Send check-in notification
  static async notifyCheckIn(
    userId: string,
    userName: string,
    locationName: string,
    userAvatar?: string,
    checkinType?: 'onsite' | 'offsite',
    lat?: number,
    lng?: number
  ) {
    const event: NotificationEvent = {
      type: 'check_in',
      userId,
      userName,
      userAvatar,
      locationName,
      timestamp: new Date(),
      data: {
        checkinType,
        lat,
        lng
      }
    }

    try {
      await webhookHandlers.sendCheckInNotification(event)
    } catch (error) {
      console.error('Failed to send check-in notification:', error)
    }
  }
  
  // Send check-out notification
  static async notifyCheckOut(
    userId: string,
    userName: string,
    totalHours: number,
    overtime: number = 0,
    userAvatar?: string
  ) {
    const event: NotificationEvent = {
      type: 'check_out',
      userId,
      userName,
      userAvatar,
      timestamp: new Date(),
      data: { totalHours, overtime }
    }
    
    try {
      await webhookHandlers.sendCheckOutNotification(event)
    } catch (error) {
      console.error('Failed to send check-out notification:', error)
    }
  }
  
  // Send leave request notification
  static async notifyLeaveRequest(
    userId: string,
    userName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    totalDays: number,
    reason: string,
    isUrgent: boolean = false,
    userAvatar?: string
  ) {
    const event: NotificationEvent = {
      type: 'leave_request',
      userId,
      userName,
      userAvatar,
      timestamp: new Date(),
      data: { 
        leaveType, 
        startDate, 
        endDate, 
        totalDays,
        reason,
        isUrgent
      }
    }
    
    try {
      await webhookHandlers.sendLeaveRequestNotification(event)
    } catch (error) {
      console.error('Failed to send leave request notification:', error)
    }
  }
  
  // Send leave approval notification
  static async notifyLeaveApproval(
    userId: string,
    userName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    approvedBy: string,
    userAvatar?: string
  ) {
    const event: NotificationEvent = {
      type: 'leave_approved',
      userId,
      userName,
      userAvatar,
      timestamp: new Date(),
      data: { 
        leaveType, 
        startDate, 
        endDate,
        approvedBy
      }
    }
    
    try {
      await webhookHandlers.sendLeaveApprovalNotification(event)
    } catch (error) {
      console.error('Failed to send leave approval notification:', error)
    }
  }
  
  // Send leave rejection notification
  static async notifyLeaveRejection(
    userId: string,
    userName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    rejectedBy: string,
    reason: string,
    userAvatar?: string
  ) {
    const event: NotificationEvent = {
      type: 'leave_rejected',
      userId,
      userName,
      userAvatar,
      timestamp: new Date(),
      data: { 
        leaveType, 
        startDate, 
        endDate,
        rejectedBy,
        reason
      }
    }
    
    try {
      await webhookHandlers.sendLeaveRejectionNotification(event)
    } catch (error) {
      console.error('Failed to send leave rejection notification:', error)
    }
  }
  
  // Send overtime alert
  static async notifyOvertime(
    userId: string,
    userName: string,
    hours: number,
    locationName: string,
    checkinTime: Date,
    isOvernight: boolean = false
  ) {
    const event: NotificationEvent = {
      type: 'overtime',
      userId,
      userName,
      locationName,
      timestamp: new Date(),
      data: { hours, checkinTime, isOvernight }
    }
    
    try {
      await webhookHandlers.sendOvertimeAlert(event)
    } catch (error) {
      console.error('Failed to send overtime alert:', error)
    }
  }
  
  // Send late notification batch
  static async notifyLateEmployees(lateUsers: Array<{
    id: string
    name: string
    lateMinutes: number
  }>) {
    if (lateUsers.length === 0) return
    
    try {
      await webhookHandlers.sendLateNotification(lateUsers)
    } catch (error) {
      console.error('Failed to send late notification:', error)
    }
  }
  
  // Send daily summary
  static async sendDailySummary(data: {
    totalEmployees: number
    checkedIn: number
    late: number
    absent: number
    onLeave: number
  }) {
    try {
      await webhookHandlers.sendDailySummary(data)
    } catch (error) {
      console.error('Failed to send daily summary:', error)
    }
  }
  
  // ===== CAMPAIGN NOTIFICATIONS =====
  
  // New campaign created
  static async notifyCampaignCreated(data: {
    campaignName: string
    createdBy: string
    influencerCount: number
    brands: string[]
    deadline: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.CAMPAIGN)
      
      await webhook.send({
        embeds: [{
          title: '📢 Campaign ใหม่',
          description: `**${data.campaignName}**`,
          color: EmbedColors.INFO,
          fields: [
            {
              name: '👤 สร้างโดย',
              value: data.createdBy,
              inline: true
            },
            {
              name: '👥 Influencers',
              value: `${data.influencerCount} คน`,
              inline: true
            },
            {
              name: '🏷️ Brands',
              value: data.brands.join(', ') || '-',
              inline: false
            },
            {
              name: '📅 Deadline',
              value: format(data.deadline, 'dd MMMM yyyy', { locale: th }),
              inline: true
            }
          ],
          footer: {
            text: 'AMGO Influencer System'
          },
          timestamp: new Date().toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send campaign created notification:', error)
    }
  }
  
  // Submission received
  static async notifySubmission(data: {
    campaignId: string
    campaignName: string
    influencerName: string
    influencerNickname?: string
    submissionCount: number
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      const displayName = data.influencerNickname 
        ? `${data.influencerName} (@${data.influencerNickname})`
        : data.influencerName
      
      await webhook.send({
        embeds: [{
          title: '📥 มีการ Submit ผลงาน',
          color: EmbedColors.INFO,
          fields: [
            {
              name: 'Campaign',
              value: data.campaignName,
              inline: false
            },
            {
              name: 'Influencer',
              value: displayName,
              inline: true
            },
            {
              name: 'จำนวน Links',
              value: `${data.submissionCount} links`,
              inline: true
            },
            {
              name: 'Status',
              value: '⏳ รอตรวจสอบ',
              inline: true
            }
          ],
          footer: {
            text: 'กรุณาตรวจสอบผลงานในระบบ'
          },
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send submission notification:', error)
    }
  }
  
  // Submission approved
  static async notifySubmissionApproved(data: {
    campaignName: string
    influencerName: string
    influencerNickname?: string
    approvedBy: string
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      const displayName = data.influencerNickname 
        ? `${data.influencerName} (@${data.influencerNickname})`
        : data.influencerName
      
      await webhook.send({
        embeds: [{
          title: '✅ ผลงานผ่านการตรวจสอบ',
          color: EmbedColors.SUCCESS,
          fields: [
            {
              name: 'Campaign',
              value: data.campaignName,
              inline: false
            },
            {
              name: 'Influencer',
              value: displayName,
              inline: true
            },
            {
              name: 'อนุมัติโดย',
              value: data.approvedBy,
              inline: true
            }
          ],
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send approval notification:', error)
    }
  }
  
  // Submission rejected (revision required)
  static async notifySubmissionRejected(data: {
    campaignName: string
    influencerName: string
    influencerNickname?: string
    rejectedBy: string
    reason: string
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      const displayName = data.influencerNickname 
        ? `${data.influencerName} (@${data.influencerNickname})`
        : data.influencerName
      
      await webhook.send({
        embeds: [{
          title: '🔄 ต้องแก้ไขผลงาน',
          color: EmbedColors.WARNING,
          fields: [
            {
              name: 'Campaign',
              value: data.campaignName,
              inline: false
            },
            {
              name: 'Influencer',
              value: displayName,
              inline: true
            },
            {
              name: 'ตีกลับโดย',
              value: data.rejectedBy,
              inline: true
            },
            {
              name: '📝 หมายเหตุ',
              value: data.reason || 'ไม่ระบุ',
              inline: false
            }
          ],
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send rejection notification:', error)
    }
  }
  
  // Re-submission received
  static async notifyResubmission(data: {
    campaignName: string
    influencerName: string
    influencerNickname?: string
    submissionCount: number
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      const displayName = data.influencerNickname 
        ? `${data.influencerName} (@${data.influencerNickname})`
        : data.influencerName
      
      await webhook.send({
        embeds: [{
          title: '📤 มีการ Submit ผลงานแก้ไข',
          color: EmbedColors.INFO,
          fields: [
            {
              name: 'Campaign',
              value: data.campaignName,
              inline: false
            },
            {
              name: 'Influencer',
              value: displayName,
              inline: true
            },
            {
              name: 'จำนวน Links',
              value: `${data.submissionCount} links`,
              inline: true
            },
            {
              name: 'Status',
              value: '⏳ รอตรวจสอบ (แก้ไขแล้ว)',
              inline: false
            }
          ],
          footer: {
            text: 'กรุณาตรวจสอบผลงานที่แก้ไขในระบบ'
          },
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send resubmission notification:', error)
    }
  }
  
  // Campaign status changed to revising
  static async notifyCampaignRevising(data: {
    campaignName: string
    revisingCount: number
    totalInfluencers: number
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      await webhook.send({
        embeds: [{
          title: '📝 Campaign เข้าสู่สถานะรอแก้ไข',
          color: EmbedColors.WARNING,
          fields: [
            {
              name: 'Campaign',
              value: data.campaignName,
              inline: false
            },
            {
              name: '🔄 รอแก้ไข',
              value: `${data.revisingCount} คน`,
              inline: true
            },
            {
              name: '👥 จากทั้งหมด',
              value: `${data.totalInfluencers} คน`,
              inline: true
            },
            {
              name: 'Status',
              value: '🟠 Revising - รอ Influencer ส่งงานแก้ไขกลับมา',
              inline: false
            }
          ],
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send revising notification:', error)
    }
  }
  
  // Campaign completed
  static async notifyCampaignCompleted(data: {
    campaignName: string
    totalInfluencers: number
    approvedCount: number
    completedBy: string
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      const successRate = Math.round((data.approvedCount / data.totalInfluencers) * 100)
      
      await webhook.send({
        embeds: [{
          title: '🎉 Campaign เสร็จสิ้น',
          description: `**${data.campaignName}**`,
          color: EmbedColors.SUCCESS,
          fields: [
            {
              name: '✅ Influencers ที่ผ่าน',
              value: `${data.approvedCount}/${data.totalInfluencers} คน`,
              inline: true
            },
            {
              name: '📊 Success Rate',
              value: `${successRate}%`,
              inline: true
            },
            {
              name: '⏱️ เสร็จสิ้นโดย',
              value: data.completedBy,
              inline: true
            }
          ],
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send completion notification:', error)
    }
  }
  
  // Campaign cancelled
  static async notifyCampaignCancelled(data: {
    campaignName: string
    cancelledBy: string
    reason?: string
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      await webhook.send({
        embeds: [{
          title: '❌ Campaign ถูกยกเลิก',
          description: `**${data.campaignName}**`,
          color: EmbedColors.DANGER,
          fields: [
            {
              name: '🚫 ยกเลิกโดย',
              value: data.cancelledBy,
              inline: true
            },
            ...(data.reason ? [{
              name: '📝 เหตุผล',
              value: data.reason,
              inline: false
            }] : [])
          ],
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send cancellation notification:', error)
    }
  }
  
  // Deadline reminder
  static async notifyDeadlineReminder(data: {
    campaignName: string
    daysLeft: number
    pendingCount: number
    reviewCount: number
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      const urgency = data.daysLeft <= 1 ? '🚨' : data.daysLeft <= 3 ? '⚠️' : '⏰'
      
      await webhook.send({
        embeds: [{
          title: `${urgency} เตือน Deadline ใกล้ถึง`,
          description: `**${data.campaignName}**`,
          color: data.daysLeft <= 1 ? EmbedColors.DANGER : EmbedColors.WARNING,
          fields: [
            {
              name: '📅 Deadline',
              value: `เหลือ ${data.daysLeft} วัน`,
              inline: true
            },
            {
              name: '⏳ รอ Submit',
              value: `${data.pendingCount} คน`,
              inline: true
            },
            {
              name: '📝 รอตรวจสอบ',
              value: `${data.reviewCount} คน`,
              inline: true
            }
          ],
          footer: {
            text: 'กรุณาติดตาม Influencer ที่ยังไม่ส่งผลงาน'
          },
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send deadline reminder:', error)
    }
  }
  
  // Overdue alert
  static async notifyOverdue(data: {
    campaignName: string
    daysOverdue: number
    pendingInfluencers: string[]
    timestamp: Date
  }) {
    try {
      const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
      
      await webhook.send({
        embeds: [{
          title: '🚨 Campaign เลย Deadline แล้ว',
          color: EmbedColors.DANGER,
          fields: [
            {
              name: 'Campaign',
              value: data.campaignName,
              inline: false
            },
            {
              name: '📅 Deadline',
              value: `เลยมา ${data.daysOverdue} วัน`,
              inline: true
            },
            {
              name: '❌ ยังไม่ Submit',
              value: data.pendingInfluencers.join('\n') || '-',
              inline: false
            }
          ],
          timestamp: data.timestamp.toISOString()
        }]
      })
    } catch (error) {
      console.error('Failed to send overdue alert:', error)
    }
  }
}