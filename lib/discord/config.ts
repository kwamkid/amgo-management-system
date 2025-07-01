// lib/discord/config.ts
import { DiscordConfig } from '@/types/discord'

export const discordConfig: DiscordConfig = {
  // Webhook URLs for notifications
  webhookUrls: {
    checkIn: process.env.DISCORD_WEBHOOK_CHECKIN || '',
    leave: process.env.DISCORD_WEBHOOK_LEAVE || '',
    hr: process.env.DISCORD_WEBHOOK_HR || '',
    alerts: process.env.DISCORD_WEBHOOK_ALERTS || '',
    campaign: process.env.DISCORD_WEBHOOK_CAMPAIGN || '', // เพิ่ม campaign webhook
  },
  
  // Discord Bot Configuration (ยังไม่ใช้ในตอนนี้)
  botToken: process.env.DISCORD_BOT_TOKEN || '',
  clientId: process.env.DISCORD_CLIENT_ID || '',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  guildId: process.env.DISCORD_GUILD_ID || '',
}

// Helper function to check if Discord webhooks are configured
export const isDiscordConfigured = () => {
  return !!(
    discordConfig.webhookUrls.checkIn ||
    discordConfig.webhookUrls.leave ||
    discordConfig.webhookUrls.hr ||
    discordConfig.webhookUrls.alerts ||
    discordConfig.webhookUrls.campaign // เพิ่ม campaign ในการตรวจสอบ
  )
}

// Helper function to check if Discord Bot is configured
export const isDiscordBotConfigured = () => {
  return !!(
    discordConfig.botToken &&
    discordConfig.clientId &&
    discordConfig.clientSecret &&
    discordConfig.guildId
  )
}