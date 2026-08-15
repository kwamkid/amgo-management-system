// lib/services/web/webAlerts.ts
//
// แจ้งเตือนงานดูแลเว็บเข้า Discord — ฝั่งเซิร์ฟเวอร์เท่านั้น
//
// cron ไม่มี session จึงส่งผ่าน /api/discord/send (ที่บังคับล็อกอิน) ไม่ได้
// ตัวนี้อ่าน webhook จาก app_config ด้วยสิทธิ์ระบบแล้วยิงตรง — ใช้ห้อง alerts
// เหมือนแจ้งเตือนเช็คอินนอกสถานที่ เพราะเป็นเรื่อง "ต้องรีบดู" เหมือนกัน

import { createAdminClient } from '@/lib/supabase/admin'
import { loadDiscordSettings } from '@/lib/discord/settings'

export type AlertColor = 'red' | 'green' | 'amber'

const COLORS: Record<AlertColor, number> = {
  red: 0xef4444,
  green: 0x22c55e,
  amber: 0xf59e0b,
}

export async function sendWebAlert(embed: {
  title: string
  description?: string
  color?: AlertColor
  fields?: { name: string; value: string; inline?: boolean }[]
}): Promise<boolean> {
  const settings = await loadDiscordSettings(createAdminClient())
  const url = settings.webhooks.alerts
  if (!url) return false

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: embed.title,
          description: embed.description,
          color: COLORS[embed.color ?? 'red'],
          fields: embed.fields,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })
  if (!res.ok) console.error('[web] Discord ตอบ', res.status)
  return res.ok
}
