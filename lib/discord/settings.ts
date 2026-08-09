// lib/discord/settings.ts
//
// ที่เดียวสำหรับอ่าน/เขียนการตั้งค่า Discord
//
// ของเดิมหน้าตั้งค่ากับตัวส่งข้อความต่างคนต่างอ่าน settings/discord เอง
// พอเพิ่มช่องใหม่ (campaign) หน้าตั้งค่าต้องคอยเติมค่าเริ่มต้นให้เองทุกครั้ง
// ที่โหลด เพราะเอกสารเก่าไม่มีคีย์นั้น — ย้ายมาไว้ที่นี่แล้วเติมให้ที่เดียว
//
// ⚠️ webhook URL ถือเป็นความลับ — ใครมี URL ก็ยิงข้อความเข้าห้องแชทบริษัทได้
//    แถวนี้จึงตั้ง is_secret = true (อ่านได้เฉพาะ hr/admin)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const DISCORD_CONFIG_KEY = 'discord_settings'

export interface DiscordSettings {
  webhooks: {
    checkIn: string
    leave: string
    hr: string
    alerts: string
    campaign: string
  }
  notifications: {
    checkIn: boolean
    checkOut: boolean
    late: boolean
    absent: boolean
    leaveRequest: boolean
    overtime: boolean
    dailySummary: boolean
    campaignUpdates: boolean
  }
  /** เวลาส่งสรุปประจำวัน (HH:mm) */
  dailySummaryTime: string
  mentionRoles?: Record<string, string>
}

export const DEFAULT_DISCORD_SETTINGS: DiscordSettings = {
  webhooks: { checkIn: '', leave: '', hr: '', alerts: '', campaign: '' },
  notifications: {
    checkIn: true,
    checkOut: true,
    late: true,
    absent: true,
    leaveRequest: true,
    overtime: true,
    dailySummary: true,
    campaignUpdates: true,
  },
  dailySummaryTime: '18:00',
}

type Client = SupabaseClient<Database>

/** เติมคีย์ที่ขาดให้ครบเสมอ — ค่าที่บันทึกไว้ตอนก่อนเพิ่มช่องใหม่จะไม่มีคีย์นั้น */
function withDefaults(raw: unknown): DiscordSettings {
  const parsed = (raw ?? {}) as Partial<DiscordSettings>
  return {
    webhooks: { ...DEFAULT_DISCORD_SETTINGS.webhooks, ...parsed.webhooks },
    notifications: { ...DEFAULT_DISCORD_SETTINGS.notifications, ...parsed.notifications },
    dailySummaryTime: parsed.dailySummaryTime ?? DEFAULT_DISCORD_SETTINGS.dailySummaryTime,
    mentionRoles: parsed.mentionRoles,
  }
}

export async function loadDiscordSettings(client: Client): Promise<DiscordSettings> {
  const { data, error } = await client
    .from('app_config')
    .select('value')
    .eq('key', DISCORD_CONFIG_KEY)
    .maybeSingle()

  if (error) {
    console.error('โหลดการตั้งค่า Discord ไม่สำเร็จ:', error.message)
    return DEFAULT_DISCORD_SETTINGS
  }
  if (!data?.value) return DEFAULT_DISCORD_SETTINGS

  try {
    return withDefaults(JSON.parse(data.value))
  } catch {
    console.error('การตั้งค่า Discord ที่บันทึกไว้อ่านไม่ออก — ใช้ค่าเริ่มต้นแทน')
    return DEFAULT_DISCORD_SETTINGS
  }
}

export async function saveDiscordSettings(
  client: Client,
  settings: DiscordSettings
): Promise<void> {
  const { error } = await client.from('app_config').upsert(
    {
      key: DISCORD_CONFIG_KEY,
      value: JSON.stringify(settings),
      note: 'การตั้งค่าแจ้งเตือน Discord',
      is_secret: true,
    },
    { onConflict: 'key' }
  )

  if (error) throw new Error(`บันทึกการตั้งค่าไม่สำเร็จ: ${error.message}`)
}

export async function getWebhookUrl(
  client: Client,
  channel: keyof DiscordSettings['webhooks']
): Promise<string | null> {
  const settings = await loadDiscordSettings(client)
  return settings.webhooks[channel] || null
}

export async function isNotificationEnabled(
  client: Client,
  type: keyof DiscordSettings['notifications']
): Promise<boolean> {
  const settings = await loadDiscordSettings(client)
  return settings.notifications[type] !== false
}
