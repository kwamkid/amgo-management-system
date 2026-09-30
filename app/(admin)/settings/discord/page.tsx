// app/(admin)/settings/discord/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { TimePicker, Checkbox, Label, Input, Alert, Card, CardContent, CardHeader, CardTitle, Button, IconButton } from '@/components/aoo'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { 
  MessageSquare, 
  Save, 
  TestTube,
  AlertCircle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  HelpCircle,
  ExternalLink,
  Bell,
  Calendar,
  Users,
  AlertTriangle,
  TrendingUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  loadDiscordSettings,
  saveDiscordSettings,
  DEFAULT_DISCORD_SETTINGS,
  type DiscordSettings,
} from '@/lib/discord/settings'
import TechLoader from '@/components/shared/TechLoader'
import { PageHeader } from '@/components/shared'

// ชนิดกับค่าเริ่มต้นย้ายไปอยู่ที่ lib/discord/settings.ts แล้ว
// ตัวส่งข้อความใช้ชุดเดียวกัน — เดิมประกาศคนละที่แล้วไม่ตรงกัน
const defaultSettings = DEFAULT_DISCORD_SETTINGS

/** ช่อง Webhook ทั้งหมด — เรียงตามลำดับที่แสดง */
const WEBHOOK_FIELDS: { key: keyof DiscordSettings['webhooks']; label: string; help: string }[] = [
  { key: 'checkIn', label: 'Check-in/Check-out Channel', help: 'แจ้งเตือนการเช็คอิน/เอาท์ของพนักงาน' },
  { key: 'leave', label: 'Leave Request Channel', help: 'แจ้งเตือนคำขอลาและการอนุมัติ' },
  { key: 'hr', label: 'HR Notifications Channel', help: 'สรุปประจำวันและรายงานสำหรับ HR' },
  { key: 'campaign', label: 'Influencer Campaign Channel', help: 'แจ้งเตือน Campaign, Submission และ Review ของ Influencer' },
  { key: 'alerts', label: 'System Alerts Channel', help: 'การแจ้งเตือนระบบ เช่น พนักงานมาสาย, ทำงานเกินเวลา' },
  { key: 'birthday', label: 'Birthday Channel', help: 'อวยพรวันเกิดพนักงานอัตโนมัติทุกเช้า' },
]

export default function DiscordSettingsPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<DiscordSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWebhooks, setShowWebhooks] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<string | null>(null)

  // Check permissions
  const canEdit = ['admin', 'hr', 'manager'].includes(userData?.role || '')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // เติมคีย์ที่ขาดให้ครบตั้งแต่ใน loadDiscordSettings แล้ว
      setSettings(await loadDiscordSettings(createClient()))
    } catch (error) {
      console.error('โหลดการตั้งค่า Discord ไม่สำเร็จ:', error)
      showToast('ไม่สามารถโหลดการตั้งค่าได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!canEdit) return

    try {
      setSaving(true)
      
      await saveDiscordSettings(createClient(), settings)
      showToast('บันทึกการตั้งค่าสำเร็จ', 'success')
    } catch (error) {
      console.error('บันทึกการตั้งค่า Discord ไม่สำเร็จ:', error)
      showToast('ไม่สามารถบันทึกการตั้งค่าได้', 'error')
    } finally {
      setSaving(false)
    }
  }

  const testWebhook = async (type: keyof typeof settings.webhooks) => {
    const webhookUrl = settings.webhooks[type]
    
    if (!webhookUrl) {
      showToast('กรุณาใส่ Webhook URL ก่อนทดสอบ', 'error')
      return
    }
    
    try {
      setTesting(type)
      
      const response = await fetch('/api/discord/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          webhookUrl,
          type 
        })
      })
      
      if (response.ok) {
        showToast('ส่งข้อความทดสอบสำเร็จ! ตรวจสอบ Discord', 'success')
      } else {
        throw new Error('Failed to send test message')
      }
    } catch (error) {
      showToast('ไม่สามารถส่งข้อความทดสอบได้', 'error')
    } finally {
      setTesting(null)
    }
  }

  const toggleWebhookVisibility = (key: string) => {
    setShowWebhooks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    showToast('คัดลอก URL แล้ว', 'success')
  }

  if (loading) {
    return <TechLoader />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตั้งค่า Discord"
        description="จัดการการแจ้งเตือนผ่าน Discord Webhook"
        icon={MessageSquare}
      />

      {/* Permission Warning */}
      {!canEdit && (
        <Alert tone="warning" title="สิทธิ์ไม่เพียงพอ">
          เฉพาะ Admin และ HR เท่านั้นที่สามารถแก้ไขการตั้งค่าได้
        </Alert>
      )}

      {/* Webhook URLs */}
      <Card padding={0}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle icon={MessageSquare} tone="grape">Webhook URLs</CardTitle>
            <a
              href="https://support.discord.com/hc/en-us/articles/228383668"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="link" size="sm" iconRight="ExternalLink" tabIndex={-1}>
                วิธีสร้าง Webhook
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {WEBHOOK_FIELDS.map(({ key, label, help }) => (
            <div key={key}>
              <Label>{label}</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex-1 relative">
                  <Input
                    type={showWebhooks[key] ? 'text' : 'password'}
                    value={settings.webhooks[key]}
                    onChange={(e) => setSettings({
                      ...settings,
                      webhooks: { ...settings.webhooks, [key]: e.target.value }
                    })}
                    placeholder="https://discord.com/api/webhooks/..."
                    disabled={!canEdit}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <IconButton
                      icon={showWebhooks[key] ? EyeOff : Eye}
                      title={showWebhooks[key] ? 'ซ่อน URL' : 'แสดง URL'}
                      onClick={() => toggleWebhookVisibility(key)}
                    />
                    {settings.webhooks[key] && (
                      <IconButton icon={Copy} title="คัดลอก URL" onClick={() => copyWebhookUrl(settings.webhooks[key])} />
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => testWebhook(key)}
                  disabled={!settings.webhooks[key]}
                  loading={testing === key}
                  variant="secondary"
                  aria-label="ทดสอบ Webhook"
                  title="ทดสอบ Webhook"
                >
                  {testing !== key && <TestTube size={16} />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {help}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Bell} tone="warning">การแจ้งเตือน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries({
              checkIn: 'แจ้งเตือนเมื่อพนักงานเช็คอิน',
              checkOut: 'แจ้งเตือนเมื่อพนักงานเช็คเอาท์',
              late: 'แจ้งเตือนพนักงานมาสาย',
              absent: 'แจ้งเตือนพนักงานขาดงาน',
              leaveRequest: 'แจ้งเตือนคำขอลา',
              overtime: 'แจ้งเตือนทำงานเกินเวลา',
              dailySummary: 'ส่งสรุปประจำวัน',
              campaignUpdates: 'แจ้งเตือน Campaign และ Submission' // เพิ่มใหม่
            }).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3">
                <Checkbox
                  checked={settings.notifications[key as keyof typeof settings.notifications]}
                  onChange={(checked) => setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      [key]: checked
                    }
                  })}
                  disabled={!canEdit}
                />
                <span className="text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          {/* Daily Summary Time */}
          {settings.notifications.dailySummary && (
            <div className="mt-4 pt-4 border-t">
              <Label>เวลาส่งสรุปประจำวัน</Label>
              <div className="mt-1 w-40">
                <TimePicker
                  value={settings.dailySummaryTime}
                  step={15}
                  disabled={!canEdit}
                  onChange={(v) => setSettings({ ...settings, dailySummaryTime: v })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={saveSettings} loading={saving} size="lg" variant="primary" icon="Save">
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </Button>
        </div>
      )}
    </div>
  )
}