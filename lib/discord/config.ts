// lib/discord/config.ts

import { DiscordConfig } from '@/types/discord'

export const discordConfig: DiscordConfig = {

  webhookUrls: {
    checkIn: process.env.DISCORD_WEBHOOK_CHECKIN!,
    leave: process.env.DISCORD_WEBHOOK_LEAVE!,
    hr: process.env.DISCORD_WEBHOOK_HR!,
    alerts: process.env.DISCORD_WEBHOOK_ALERTS!
  }
}

// Validate config
export function validateDiscordConfig(): boolean {
  const required = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID', 
    'DISCORD_CLIENT_SECRET',
    'DISCORD_GUILD_ID',
    'DISCORD_WEBHOOK_CHECKIN',
    'DISCORD_WEBHOOK_HR'
  ]
  
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required Discord config: ${key}`)
      return false
    }
  }
  
  return true
}

// Channel mappings
export const DISCORD_CHANNELS = {
  announcements: 'announcements',
  checkIn: 'check-in-logs',
  leave: 'leave-requests',
  hrNotifications: 'hr-notifications',
  alerts: 'system-alerts'
} as const