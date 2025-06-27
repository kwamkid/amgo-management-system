// app/(admin)/settings/discord/page.tsx

'use client'

import { useState, useEffect } from 'react'
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
  Loader2
} from 'lucide-react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { gradients } from '@/lib/theme/colors'
import TechLoader from '@/components/shared/TechLoader'

interface DiscordSettings {
  webhooks: {
    checkIn: string
    leave: string
    hr: string
    alerts: string
  }
  notifications: {
    checkIn: boolean
    checkOut: boolean
    late: boolean
    absent: boolean
    leaveRequest: boolean
    overtime: boolean
    dailySummary: boolean
  }
  dailySummaryTime: string
}

const defaultSettings: DiscordSettings = {
  webhooks: {
    checkIn: '',
    leave: '',
    hr: '',
    alerts: ''
  },
  notifications: {
    checkIn: true,
    checkOut: true,
    late: true,
    absent: true,
    leaveRequest: true,
    overtime: true,
    dailySummary: true
  },
  dailySummaryTime: '18:00'
}

export default function DiscordSettingsPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<DiscordSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWebhooks, setShowWebhooks] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<string | null>(null)

  // Check permissions
  const canEdit = userData?.role === 'admin' || userData?.role === 'hr'

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'discord')
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        setSettings(docSnap.data() as DiscordSettings)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      showToast('ไม่สามารถโหลดการตั้งค่าได้', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!canEdit) return

    try {
      setSaving(true)
      
      await setDoc(doc(db, 'settings', 'discord'), {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.id
      })
      
      showToast('บันทึกการตั้งค่าสำเร็จ', 'success')
    } catch (error) {
      console.error('Error saving settings:', error)
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า Discord</h1>
        <p className="text-gray-600 mt-1">
          จัดการการแจ้งเตือนผ่าน Discord Webhook
        </p>
      </div>

      {/* Permission Warning */}
      {!canEdit && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>สิทธิ์ไม่เพียงพอ</AlertTitle>
          <AlertDescription>
            เฉพาะ Admin และ HR เท่านั้นที่สามารถแก้ไขการตั้งค่าได้
          </AlertDescription>
        </Alert>
      )}

      {/* Webhook URLs */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-600" />
              Webhook URLs
            </CardTitle>
            <a
              href="https://support.discord.com/hc/en-us/articles/228383668"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              วิธีสร้าง Webhook
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Check-in Channel */}
          <div>
            <Label>Check-in/Check-out Channel</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 relative">
                <Input
                  type={showWebhooks.checkIn ? 'text' : 'password'}
                  value={settings.webhooks.checkIn}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, checkIn: e.target.value }
                  })}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleWebhookVisibility('checkIn')}
                    className="h-8 w-8"
                  >
                    {showWebhooks.checkIn ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  {settings.webhooks.checkIn && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => copyWebhookUrl(settings.webhooks.checkIn)}
                      className="h-8 w-8"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                onClick={() => testWebhook('checkIn')}
                disabled={!settings.webhooks.checkIn || testing === 'checkIn'}
                variant="outline"
              >
                {testing === 'checkIn' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              แจ้งเตือนการเช็คอิน/เอาท์ของพนักงาน
            </p>
          </div>

          {/* Leave Channel */}
          <div>
            <Label>Leave Request Channel</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 relative">
                <Input
                  type={showWebhooks.leave ? 'text' : 'password'}
                  value={settings.webhooks.leave}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, leave: e.target.value }
                  })}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleWebhookVisibility('leave')}
                    className="h-8 w-8"
                  >
                    {showWebhooks.leave ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  {settings.webhooks.leave && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => copyWebhookUrl(settings.webhooks.leave)}
                      className="h-8 w-8"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                onClick={() => testWebhook('leave')}
                disabled={!settings.webhooks.leave || testing === 'leave'}
                variant="outline"
              >
                {testing === 'leave' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              แจ้งเตือนคำขอลาและการอนุมัติ
            </p>
          </div>

          {/* HR Channel */}
          <div>
            <Label>HR Notifications Channel</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 relative">
                <Input
                  type={showWebhooks.hr ? 'text' : 'password'}
                  value={settings.webhooks.hr}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, hr: e.target.value }
                  })}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleWebhookVisibility('hr')}
                    className="h-8 w-8"
                  >
                    {showWebhooks.hr ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  {settings.webhooks.hr && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => copyWebhookUrl(settings.webhooks.hr)}
                      className="h-8 w-8"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                onClick={() => testWebhook('hr')}
                disabled={!settings.webhooks.hr || testing === 'hr'}
                variant="outline"
              >
                {testing === 'hr' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              สรุปประจำวันและรายงานสำหรับ HR
            </p>
          </div>

          {/* Alerts Channel */}
          <div>
            <Label>System Alerts Channel</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex-1 relative">
                <Input
                  type={showWebhooks.alerts ? 'text' : 'password'}
                  value={settings.webhooks.alerts}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, alerts: e.target.value }
                  })}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleWebhookVisibility('alerts')}
                    className="h-8 w-8"
                  >
                    {showWebhooks.alerts ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  {settings.webhooks.alerts && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => copyWebhookUrl(settings.webhooks.alerts)}
                      className="h-8 w-8"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                onClick={() => testWebhook('alerts')}
                disabled={!settings.webhooks.alerts || testing === 'alerts'}
                variant="outline"
              >
                {testing === 'alerts' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              การแจ้งเตือนระบบ เช่น พนักงานมาสาย, ทำงานเกินเวลา
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-red-600" />
            การแจ้งเตือน
          </CardTitle>
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
              dailySummary: 'ส่งสรุปประจำวัน'
            }).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3">
                <Checkbox
                  checked={settings.notifications[key as keyof typeof settings.notifications]}
                  onCheckedChange={(checked) => setSettings({
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
              <Input
                type="time"
                value={settings.dailySummaryTime}
                onChange={(e) => setSettings({
                  ...settings,
                  dailySummaryTime: e.target.value
                })}
                className="w-32 mt-1"
                disabled={!canEdit}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <Button
            onClick={saveSettings}
            disabled={saving}
            size="lg"
            className={`bg-gradient-to-r ${gradients.primary}`}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                บันทึกการตั้งค่า
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}