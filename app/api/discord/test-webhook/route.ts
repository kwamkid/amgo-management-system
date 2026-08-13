// app/api/discord/test-webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { EmbedColors } from '@/types/discord'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // route นี้ยิงข้อความไป URL ที่ผู้เรียกส่งมาเอง — เปิดไว้เฉยๆ = open relay
    // หน้าตั้งค่า Discord เป็นของ hr/admin อยู่แล้ว จำกัดตามนั้น
    const sb = await createServerSupabase()
    const {
      data: { user },
    } = await sb.auth.getUser()
    const role = (user?.app_metadata as { role?: string } | undefined)?.role
    if (!user || !['hr', 'admin'].includes(role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { webhookUrl, type } = await request.json()
    
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL required' },
        { status: 400 }
      )
    }
    
    // Test message based on type
    const testMessages = {
      checkIn: {
        embeds: [{
          title: '🧪 ทดสอบ Check-in Channel',
          description: 'หากคุณเห็นข้อความนี้ แสดงว่า Webhook ทำงานปกติ',
          color: EmbedColors.SUCCESS,
          fields: [
            { name: 'ตัวอย่าง', value: '✅ สมชาย เช็คอินแล้ว', inline: true },
            { name: 'เวลา', value: '10:15', inline: true }
          ],
          footer: { text: 'AMGO HR System - Test Message' },
          timestamp: new Date().toISOString()
        }]
      },
      leave: {
        embeds: [{
          title: '🧪 ทดสอบ Leave Channel',
          description: 'หากคุณเห็นข้อความนี้ แสดงว่า Webhook ทำงานปกติ',
          color: EmbedColors.INFO,
          fields: [
            { name: 'ตัวอย่าง', value: '📋 สมชาย ขอลาป่วย', inline: true },
            { name: 'วันที่', value: '25-26 ม.ค.', inline: true }
          ],
          footer: { text: 'AMGO HR System - Test Message' },
          timestamp: new Date().toISOString()
        }]
      },
      hr: {
        embeds: [{
          title: '🧪 ทดสอบ HR Channel',
          description: 'หากคุณเห็นข้อความนี้ แสดงว่า Webhook ทำงานปกติ',
          color: EmbedColors.INFO,
          fields: [
            { name: 'พนักงานทั้งหมด', value: '50 คน', inline: true },
            { name: 'มาทำงาน', value: '48 คน', inline: true },
            { name: 'ลา', value: '2 คน', inline: true }
          ],
          footer: { text: 'AMGO HR System - Test Message' },
          timestamp: new Date().toISOString()
        }]
      },
      alerts: {
        embeds: [{
          title: '🧪 ทดสอบ Alerts Channel',
          description: 'หากคุณเห็นข้อความนี้ แสดงว่า Webhook ทำงานปกติ',
          color: EmbedColors.WARNING,
          fields: [
            { name: 'ตัวอย่าง', value: '⚠️ มีพนักงาน 3 คน มาสาย' },
            { name: 'การแจ้งเตือน', value: 'ทำงานเกิน 10 ชม.' }
          ],
          footer: { text: 'AMGO HR System - Test Message' },
          timestamp: new Date().toISOString()
        }]
      }
    }
    
    const payload = testMessages[type as keyof typeof testMessages] || {
      content: '🧪 Test message from AMGO HR System'
    }
    
    await axios.post(webhookUrl, payload)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Test webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to send test message' },
      { status: 500 }
    )
  }
}