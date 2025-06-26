// lib/discord/notificationService.ts

import { NotificationEvent, WebhookChannel } from '@/types/discord'
import * as webhookHandlers from './webhook'

export class DiscordNotificationService {
  // Send check-in notification
  static async notifyCheckIn(
    userId: string,
    userName: string,
    locationName: string,
    userAvatar?: string
  ) {
    const event: NotificationEvent = {
      type: 'check_in',
      userId,
      userName,
      userAvatar,
      locationName,
      timestamp: new Date()
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
}