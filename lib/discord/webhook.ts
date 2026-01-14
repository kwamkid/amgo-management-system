// lib/discord/webhook.ts

import axios from 'axios'
import { 
  DiscordWebhookPayload, 
  DiscordEmbed,
  NotificationEvent, 
  WebhookChannel,
  EmbedColors 
} from '@/types/discord'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { safeFormatDate, formatDateRange } from '@/lib/utils/date'

// Helper function to get webhook URL from database settings
async function getWebhookUrl(channel: WebhookChannel): Promise<string | null> {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'discord'))
    
    if (!settingsDoc.exists()) {
      console.warn('Discord settings not found')
      return null
    }
    
    const settings = settingsDoc.data()
    return settings.webhooks?.[channel] || null
  } catch (error) {
    console.error('Error getting webhook URL:', error)
    return null
  }
}

// Helper function to check if notification is enabled
async function isNotificationEnabled(type: string): Promise<boolean> {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'discord'))
    
    if (!settingsDoc.exists()) return false
    
    const settings = settingsDoc.data()
    return settings.notifications?.[type] !== false // default true
  } catch (error) {
    console.error('Error checking notification settings:', error)
    return false
  }
}

// Helper function to get leave type emoji and label
function getLeaveTypeInfo(type: string): { emoji: string; label: string; color: number } {
  switch (type) {
    case 'sick':
      return { emoji: '🏥', label: 'ลาป่วย', color: 0xf472b6 } // pink
    case 'personal':
      return { emoji: '🏠', label: 'ลากิจ', color: 0x3b82f6 } // blue
    case 'vacation':
      return { emoji: '🏖️', label: 'ลาพักร้อน', color: 0x10b981 } // green
    default:
      return { emoji: '📋', label: 'ลา', color: EmbedColors.INFO }
  }
}

export class DiscordWebhook {
  private channel: WebhookChannel

  constructor(channel: WebhookChannel) {
    this.channel = channel
  }

  async send(payload: DiscordWebhookPayload): Promise<boolean> {
    try {
      // Get webhook URL from database instead of config
      const webhookUrl = await getWebhookUrl(this.channel)
      
      if (!webhookUrl) {
        console.log(`Webhook URL not configured for channel: ${this.channel}`)
        return false
      }

      await axios.post(webhookUrl, payload)
      return true
    } catch (error) {
      console.error('Discord webhook error:', error)
      return false
    }
  }

  async sendEmbed(embed: DiscordEmbed): Promise<boolean> {
    return this.send({ embeds: [embed] })
  }

  async sendText(content: string): Promise<boolean> {
    return this.send({ content })
  }
}

// Notification handlers
export async function sendCheckInNotification(event: NotificationEvent) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('checkIn')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.CHECK_IN)

  const embed: DiscordEmbed = {
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    description: `เช็คอินเรียบร้อย ที่**${event.locationName}**`,
    color: EmbedColors.SUCCESS,
    fields: [
      {
        name: 'เวลา',
        value: safeFormatDate(event.timestamp, 'HH:mm'),
        inline: true
      },
      {
        name: 'วันที่',
        value: safeFormatDate(event.timestamp, 'dd MMM yyyy'),
        inline: true
      }
    ],
    footer: {
      text: 'AMGO Check-in System'
    },
    timestamp: new Date().toISOString()
  }

  // Send with custom username and avatar for notification
  return webhook.send({
    username: event.userName,
    avatar_url: event.userAvatar || undefined,
    embeds: [embed]
  })
}

export async function sendCheckOutNotification(event: NotificationEvent) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('checkOut')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.CHECK_IN)
  const { totalHours, overtime } = event.data || {}

  const embed: DiscordEmbed = {
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    description: `เช็คเอาท์เรียบร้อย`,
    color: EmbedColors.INFO,
    fields: [
      {
        name: 'เวลาทำงาน',
        value: `${totalHours || 0} ชั่วโมง`,
        inline: true
      },
      ...(overtime > 0 ? [{
        name: 'โอที',
        value: `${overtime} ชั่วโมง`,
        inline: true
      }] : [])
    ],
    footer: {
      text: 'AMGO Check-in System'
    },
    timestamp: new Date().toISOString()
  }

  // Send with custom username and avatar for notification
  return webhook.send({
    username: event.userName,
    avatar_url: event.userAvatar || undefined,
    embeds: [embed]
  })
}

export async function sendLeaveRequestNotification(event: NotificationEvent) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('leaveRequest')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.LEAVE)
  const { leaveType, startDate, endDate, totalDays, reason, isUrgent } = event.data || {}
  
  const leaveInfo = getLeaveTypeInfo(leaveType)
  
  const embed: DiscordEmbed = {
    title: `${leaveInfo.emoji} คำขอ${leaveInfo.label}ใหม่`,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    color: leaveInfo.color,
    fields: [
      {
        name: '📅 วันที่ลา',
        value: formatDateRange(startDate, endDate, 'dd MMM yyyy'),
        inline: true
      },
      {
        name: '📊 จำนวนวัน',
        value: `${totalDays} วัน${isUrgent ? ' (ลาด่วน)' : ''}`,
        inline: true
      },
      {
        name: '📝 เหตุผล',
        value: reason || 'ไม่ระบุ',
        inline: false
      }
    ],
    footer: {
      text: '⏳ รออนุมัติ | AMGO Leave System'
    },
    timestamp: new Date().toISOString()
  }

  // Add urgent badge if needed
  if (isUrgent) {
    embed.fields!.push({
      name: '⚠️ หมายเหตุ',
      value: 'คำขอลาด่วน - คิดโควต้าเพิ่มเติม',
      inline: false
    })
  }

  return webhook.sendEmbed(embed)
}

export async function sendLeaveApprovalNotification(event: NotificationEvent) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('leaveApproval')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.LEAVE)
  const { leaveType, startDate, endDate, approvedBy } = event.data || {}
  
  const leaveInfo = getLeaveTypeInfo(leaveType)
  
  const embed: DiscordEmbed = {
    title: `✅ อนุมัติ${leaveInfo.label}`,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    description: `คำขอ${leaveInfo.label}ได้รับการอนุมัติแล้ว`,
    color: EmbedColors.SUCCESS,
    fields: [
      {
        name: '📅 วันที่ลา',
        value: formatDateRange(startDate, endDate, 'dd MMM yyyy'),
        inline: true
      },
      {
        name: '👤 อนุมัติโดย',
        value: approvedBy,
        inline: true
      }
    ],
    footer: {
      text: 'AMGO Leave System'
    },
    timestamp: new Date().toISOString()
  }

  return webhook.sendEmbed(embed)
}

export async function sendLeaveRejectionNotification(event: NotificationEvent) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('leaveRejection')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.LEAVE)
  const { leaveType, startDate, endDate, rejectedBy, reason } = event.data || {}
  
  const leaveInfo = getLeaveTypeInfo(leaveType)
  
  const embed: DiscordEmbed = {
    title: `❌ ไม่อนุมัติ${leaveInfo.label}`,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    description: `คำขอ${leaveInfo.label}ไม่ได้รับการอนุมัติ`,
    color: EmbedColors.DANGER,
    fields: [
      {
        name: '📅 วันที่ขอลา',
        value: formatDateRange(startDate, endDate, 'dd MMM yyyy'),
        inline: false
      },
      {
        name: '❌ เหตุผล',
        value: reason || 'ไม่ระบุ',
        inline: false
      },
      {
        name: '👤 ไม่อนุมัติโดย',
        value: rejectedBy,
        inline: true
      }
    ],
    footer: {
      text: 'AMGO Leave System'
    },
    timestamp: new Date().toISOString()
  }

  return webhook.sendEmbed(embed)
}

export async function sendLateNotification(lateUsers: any[]) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('late')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
  
  const embed: DiscordEmbed = {
    title: '⚠️ พนักงานมาสาย',
    description: `มีพนักงาน ${lateUsers.length} คน มาสายวันนี้`,
    color: EmbedColors.WARNING,
    fields: lateUsers.map(user => ({
      name: user.name,
      value: `สาย ${user.lateMinutes} นาที`,
      inline: true
    })),
    timestamp: new Date().toISOString()
  }

  return webhook.sendEmbed(embed)
}

export async function sendOvertimeAlert(event: NotificationEvent) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('overtime')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
  const { hours, isOvernight } = event.data || {}
  
  const embed: DiscordEmbed = {
    title: isOvernight ? '🌙 ทำงานข้ามวัน' : '⏰ ทำงานนานเกินไป',
    description: `**${event.userName}** ทำงานมา ${hours} ชั่วโมงแล้ว`,
    color: isOvernight ? EmbedColors.PURPLE : EmbedColors.WARNING,
    fields: [
      {
        name: 'สาขา',
        value: event.locationName || 'ไม่ระบุ',
        inline: true
      },
      {
        name: 'เริ่มงาน',
        value: safeFormatDate(event.data?.checkinTime, 'HH:mm'),
        inline: true
      }
    ],
    footer: {
      text: 'ควรให้พนักงานพักผ่อนบ้าง'
    },
    timestamp: new Date().toISOString()
  }

  return webhook.sendEmbed(embed)
}

// Batch notifications
export async function sendDailySummary(data: {
  totalEmployees: number
  checkedIn: number
  late: number
  absent: number
  onLeave: number
}) {
  // Check if notification is enabled
  const enabled = await isNotificationEnabled('dailySummary')
  if (!enabled) return false

  const webhook = new DiscordWebhook(WebhookChannel.HR)
  
  const embed: DiscordEmbed = {
    title: '📊 สรุปการมาทำงานประจำวัน',
    description: safeFormatDate(new Date(), 'EEEE dd MMMM yyyy'),
    color: EmbedColors.INFO,
    fields: [
      {
        name: '👥 พนักงานทั้งหมด',
        value: `${data.totalEmployees} คน`,
        inline: true
      },
      {
        name: '✅ มาทำงาน',
        value: `${data.checkedIn} คน`,
        inline: true
      },
      {
        name: '⏰ มาสาย',
        value: `${data.late} คน`,
        inline: true
      },
      {
        name: '❌ ขาด',
        value: `${data.absent} คน`,
        inline: true
      },
      {
        name: '🏖️ ลา',
        value: `${data.onLeave} คน`,
        inline: true
      }
    ],
    footer: {
      text: 'AMGO HR System'
    },
    timestamp: new Date().toISOString()
  }

  return webhook.sendEmbed(embed)
}

// Export helper functions for external use
export { getWebhookUrl, isNotificationEnabled }