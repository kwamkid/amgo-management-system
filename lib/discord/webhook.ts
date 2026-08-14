// lib/discord/webhook.ts
//
// ⚠️ ไฟล์นี้รันฝั่งเบราว์เซอร์ (เรียกจาก hooks ตอนเช็คอิน/ขอลา) — ห้ามอ่าน
// webhook URL ตรงนี้: URL เป็นความลับใน app_config (is_secret, อ่านได้เฉพาะ
// hr/admin) พนักงานทั่วไปอ่านไม่ได้ → เคยทำแจ้งเตือนเงียบหายทั้งบริษัท
// ตั้งแต่ 8 ส.ค. 69 (ของแอดมินยังออก เลยดูเหมือนดับๆ ติดๆ)
//
// ทางเดินจริง: ประกอบ embed ที่นี่ → POST /api/discord/send → server อ่าน
// URL ด้วยสิทธิ์ระบบ + เช็คสวิตช์เปิด/ปิดรายประเภท แล้วค่อยยิงเข้า Discord

import {
  DiscordWebhookPayload,
  DiscordEmbed,
  NotificationEvent,
  WebhookChannel,
  EmbedColors
} from '@/types/discord'
import type { DiscordSettings } from './settings'
import { safeFormatDate, formatDateRange } from '@/lib/utils/date'

type NotifyType = keyof DiscordSettings['notifications']

// รูปใหญ่มุมขวาของ embed — ให้เช็คอิน/เช็คเอาท์แยกกันออกในแวบเดียว
// (สีขอบซ้ายอย่างเดียวเจ้าของบอกดูไม่ออก) — ป้ายเข้า/ออกประตูดีไซน์คู่กัน
// ไฟล์อยู่ใน public/discord/ ของแอปเอง (Discord ดึงจากโดเมน production)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.amgovenger.com'
const NOTI_ICONS = {
  checkIn: `${APP_URL}/discord/checkin.png`,
  checkOut: `${APP_URL}/discord/checkout.png`,
  offsite: `${APP_URL}/discord/offsite.png`,
  leaveRequest: `${APP_URL}/discord/leave-request.png`,
  leaveApproved: `${APP_URL}/discord/leave-approved.png`,
  leaveRejected: `${APP_URL}/discord/leave-rejected.png`,
} as const

// สีการ์ดชุดเดียวกับ legend ตารางวันของหน้ารายงาน (เจ้าของขอ 14 ส.ค. 69) —
// เห็นแถบสีใน Discord ปุ๊บรู้สถานะเดียวกับที่เห็นในรายงาน ไม่ต้องจำสองชุด
const GRID_COLORS = {
  onsite: 0x22c55e, // เขียว — มาทำงาน (สาขา)
  offsite: 0xa855f7, // ม่วง — นอกสถานที่
  wfh: 0x0d9488, // teal — ทำงานที่บ้าน
  late: 0xfbbf24, // เหลือง — มาสาย
  absent: 0xef4444, // แดง — ขาด (ใช้กับเช็คเอาท์/ไม่อนุมัติด้วย)
  leave: 0x0ea5e9, // ฟ้า — ลา
} as const

// คนที่ต้องถูก tag เมื่อมีคำขอลาใหม่ — เจ้าของระบุ 14 ส.ค. 69:
// กอล์ฟ (ผู้บริหาร) · หน่อย (HR) · อุ้ย (HR) — id จาก users.discord_user_id
const LEAVE_APPROVER_MENTIONS =
  '<@1357559583136157696> <@1360075523690336277> <@1357709532179988570>'

// รูปใสสูง 3px กว้าง 500px ใส่เป็น image ท้าย embed — ดันการ์ดให้กว้างเต็ม
// เท่ากันทุกใบ (ปกติ Discord หดการ์ดตามเนื้อหา ทำให้แต่ละใบกว้างไม่เท่ากัน)
const CARD_WIDTH_SPACER = { url: `${APP_URL}/discord/spacer.png` }

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
  private notifyType?: NotifyType

  constructor(channel: WebhookChannel, notifyType?: NotifyType) {
    this.channel = channel
    this.notifyType = notifyType
  }

  async send(payload: DiscordWebhookPayload): Promise<boolean> {
    try {
      const res = await fetch('/api/discord/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: this.channel, type: this.notifyType, payload }),
      })
      return res.ok
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
  const webhook = new DiscordWebhook(WebhookChannel.CHECK_IN, 'checkIn')

  const { checkinType, lat, lng } = event.data || {}
  const isOffsite = checkinType === 'offsite'
  const isWfh = checkinType === 'wfh'

  const embed: DiscordEmbed = {
    // สีตาม legend ตารางวัน: เขียวสาขา · ม่วงนอกสถานที่ · teal ที่บ้าน
    title: isOffsite ? '🟣 เช็คอิน · นอกสถานที่' : isWfh ? '🏠 เช็คอิน · ทำงานที่บ้าน' : '🟢 เช็คอิน',
    // รูปใหญ่มุมขวา: ป้ายเขียวลูกศรเข้าประตู — คนละภาพกับเช็คเอาท์ชัด ๆ
    thumbnail: { url: isOffsite ? NOTI_ICONS.offsite : NOTI_ICONS.checkIn },
    image: CARD_WIDTH_SPACER,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    // wfh ไม่มีสาขา — locationName เป็นค่า fallback ไม่ต้องโชว์
    description: isOffsite || isWfh ? undefined : `ที่ **${event.locationName}**`,
    color: isOffsite ? GRID_COLORS.offsite : isWfh ? GRID_COLORS.wfh : GRID_COLORS.onsite,
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
      },
      // Add location link for offsite check-in
      ...(isOffsite && lat && lng ? [{
        name: '📌 ตำแหน่ง',
        value: `[ดูใน Google Maps](https://www.google.com/maps?q=${lat},${lng})`,
        inline: false
      }] : [])
    ],
    footer: {
      text: isOffsite ? '⚠️ เช็คอินนอกพื้นที่ | AMGO Check-in System' : 'AMGO Check-in System'
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
  const webhook = new DiscordWebhook(WebhookChannel.CHECK_IN, 'checkOut')
  const { totalHours, overtime } = event.data || {}

  const embed: DiscordEmbed = {
    title: '🔴 เช็คเอาท์',
    // ป้ายแดงลูกศรออกประตู + การ์ดสีแดง — ตัดกับเช็คอินสีเขียวทันที
    thumbnail: { url: NOTI_ICONS.checkOut },
    image: CARD_WIDTH_SPACER,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    color: GRID_COLORS.absent,
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

/** เช็คเอาท์นอกพื้นที่ — แจ้งเข้าห้อง alerts ให้ HR/เจ้าของเห็นทันที */
export async function sendFarCheckoutAlert(data: {
  userName: string
  userAvatar?: string
  locationName: string
  km: number
}) {
  const webhook = new DiscordWebhook(WebhookChannel.ALERTS)
  return webhook.sendEmbed({
    title: '⚠️ เช็คเอาท์นอกพื้นที่',
    author: { name: data.userName, icon_url: data.userAvatar || undefined },
    description: `เช็คอินที่ **${data.locationName}** แต่เช็คเอาท์ห่างออกไป **${data.km} กม.** — ระบบตัดชั่วโมงที่เวลาเลิกงานให้แล้ว (ไม่มี OT)`,
    color: GRID_COLORS.late,
    image: CARD_WIDTH_SPACER,
    footer: { text: 'AMGO Check-in System' },
    timestamp: new Date().toISOString(),
  })
}

export async function sendLeaveRequestNotification(event: NotificationEvent) {
  const webhook = new DiscordWebhook(WebhookChannel.LEAVE, 'leaveRequest')
  const { leaveType, startDate, endDate, totalDays, reason, isUrgent } = event.data || {}
  
  const leaveInfo = getLeaveTypeInfo(leaveType)

  const embed: DiscordEmbed = {
    title: `🔵 ขอ${leaveInfo.label}${isUrgent ? ' · ด่วน' : ''}`,
    // การ์ดฟ้า = ลา (สีเดียวกับจุดลาในตารางวัน)
    thumbnail: { url: NOTI_ICONS.leaveRequest },
    image: CARD_WIDTH_SPACER,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
    color: GRID_COLORS.leave,
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

  // tag คนอนุมัติให้เด้งเตือน — mention ต้องอยู่ใน content เท่านั้นถึงจะ ping
  // (พิมพ์ในตัว embed จะเป็นแค่ข้อความ ไม่เด้ง)
  return webhook.send({ content: LEAVE_APPROVER_MENTIONS, embeds: [embed] })
}

export async function sendLeaveApprovalNotification(event: NotificationEvent) {
  // ผล อนุมัติ/ไม่อนุมัติ ใช้สวิตช์เดียวกับคำขอลา — settings ไม่มีคีย์แยก
  const webhook = new DiscordWebhook(WebhookChannel.LEAVE, 'leaveRequest')
  const { leaveType, startDate, endDate, approvedBy } = event.data || {}
  
  const leaveInfo = getLeaveTypeInfo(leaveType)
  
  const embed: DiscordEmbed = {
    title: `🟢 อนุมัติ${leaveInfo.label}`,
    thumbnail: { url: NOTI_ICONS.leaveApproved },
    image: CARD_WIDTH_SPACER,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
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
  const webhook = new DiscordWebhook(WebhookChannel.LEAVE, 'leaveRequest')
  const { leaveType, startDate, endDate, rejectedBy, reason } = event.data || {}
  
  const leaveInfo = getLeaveTypeInfo(leaveType)
  
  const embed: DiscordEmbed = {
    title: `🔴 ไม่อนุมัติ${leaveInfo.label}`,
    thumbnail: { url: NOTI_ICONS.leaveRejected },
    image: CARD_WIDTH_SPACER,
    author: {
      name: event.userName,
      icon_url: event.userAvatar || undefined
    },
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
  const webhook = new DiscordWebhook(WebhookChannel.ALERTS, 'late')
  
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
  const webhook = new DiscordWebhook(WebhookChannel.ALERTS, 'overtime')
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
  const webhook = new DiscordWebhook(WebhookChannel.HR, 'dailySummary')
  
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
