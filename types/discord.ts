// types/discord.ts

export interface DiscordConfig {
  botToken: string
  clientId: string
  clientSecret: string
  guildId: string // Server ID
  webhookUrls: {
    checkIn: string
    leave: string
    hr: string
    alerts: string
  }
}


export interface DiscordWebhookPayload {
  content?: string
  username?: string
  avatar_url?: string
  embeds?: DiscordEmbed[]
}

export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  timestamp?: string
  footer?: {
    text: string
    icon_url?: string
  }
  thumbnail?: {
    url: string
  }
  author?: {
    name: string
    url?: string
    icon_url?: string
  }
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
}

export interface NotificationEvent {
  type: 'check_in' | 'check_out' | 'late' | 'absent' | 'leave_request' | 
        'leave_approved' | 'leave_rejected' | 'overtime' | 'forgot_checkout'
  userId: string
  userName: string
  userAvatar?: string
  locationName?: string
  timestamp: Date
  data?: any
}

// Webhook channels
export enum WebhookChannel {
  CHECK_IN = 'checkIn',
  LEAVE = 'leave', 
  HR = 'hr',
  ALERTS = 'alerts'
}

// Embed colors
export const EmbedColors = {
  SUCCESS: 0x28a745,   // Green
  INFO: 0x17a2b8,      // Blue
  WARNING: 0xffc107,   // Yellow
  DANGER: 0xdc3545,    // Red
  PURPLE: 0x6f42c1,    // Purple (overnight)
  GRAY: 0x6c757d       // Gray
} as const