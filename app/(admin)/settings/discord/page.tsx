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
  AlertTriangle
} from 'lucide-react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'


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
  dailySummaryTime: string // เวลาส่งสรุปประจำวัน
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">กำลังโหลด...</p>
        </div>
      </div>
    )
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-yellow-800 font-medium">สิทธิ์ไม่เพียงพอ</p>
              <p className="text-yellow-700 text-sm mt-1">
                เฉพาะ Admin และ HR เท่านั้นที่สามารถแก้ไขการตั้งค่าได้
              </p>
            </div>
          </div>
        </div>
      )}



      {/* Webhook URLs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-red-600" />
            Webhook URLs
          </h3>
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

        <div className="space-y-4">
          {/* Check-in Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Check-in/Check-out Channel
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showWebhooks.checkIn ? 'text' : 'password'}
                  value={settings.webhooks.checkIn}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, checkIn: e.target.value }
                  })}
                  className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    onClick={() => toggleWebhookVisibility('checkIn')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {showWebhooks.checkIn ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {settings.webhooks.checkIn && (
                    <button
                      onClick={() => copyWebhookUrl(settings.webhooks.checkIn)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => testWebhook('checkIn')}
                disabled={!settings.webhooks.checkIn || testing === 'checkIn'}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing === 'checkIn' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700" />
                ) : (
                  <TestTube className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              แจ้งเตือนการเช็คอิน/เอาท์ของพนักงาน
            </p>
          </div>

          {/* Leave Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Request Channel
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showWebhooks.leave ? 'text' : 'password'}
                  value={settings.webhooks.leave}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, leave: e.target.value }
                  })}
                  className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    onClick={() => toggleWebhookVisibility('leave')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {showWebhooks.leave ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {settings.webhooks.leave && (
                    <button
                      onClick={() => copyWebhookUrl(settings.webhooks.leave)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => testWebhook('leave')}
                disabled={!settings.webhooks.leave || testing === 'leave'}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing === 'leave' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700" />
                ) : (
                  <TestTube className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              แจ้งเตือนคำขอลาและการอนุมัติ
            </p>
          </div>

          {/* HR Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HR Notifications Channel
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showWebhooks.hr ? 'text' : 'password'}
                  value={settings.webhooks.hr}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, hr: e.target.value }
                  })}
                  className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    onClick={() => toggleWebhookVisibility('hr')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {showWebhooks.hr ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {settings.webhooks.hr && (
                    <button
                      onClick={() => copyWebhookUrl(settings.webhooks.hr)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => testWebhook('hr')}
                disabled={!settings.webhooks.hr || testing === 'hr'}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing === 'hr' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700" />
                ) : (
                  <TestTube className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              สรุปประจำวันและรายงานสำหรับ HR
            </p>
          </div>

          {/* Alerts Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              System Alerts Channel
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showWebhooks.alerts ? 'text' : 'password'}
                  value={settings.webhooks.alerts}
                  onChange={(e) => setSettings({
                    ...settings,
                    webhooks: { ...settings.webhooks, alerts: e.target.value }
                  })}
                  className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!canEdit}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    onClick={() => toggleWebhookVisibility('alerts')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {showWebhooks.alerts ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {settings.webhooks.alerts && (
                    <button
                      onClick={() => copyWebhookUrl(settings.webhooks.alerts)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => testWebhook('alerts')}
                disabled={!settings.webhooks.alerts || testing === 'alerts'}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing === 'alerts' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700" />
                ) : (
                  <TestTube className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              การแจ้งเตือนระบบ เช่น พนักงานมาสาย, ทำงานเกินเวลา
            </p>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-red-600" />
          การแจ้งเตือน
        </h3>

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
              <input
                type="checkbox"
                checked={settings.notifications[key as keyof typeof settings.notifications]}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    [key]: e.target.checked
                  }
                })}
                className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                disabled={!canEdit}
              />
              <span className="text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        {/* Daily Summary Time */}
        {settings.notifications.dailySummary && (
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เวลาส่งสรุปประจำวัน
            </label>
            <input
              type="time"
              value={settings.dailySummaryTime}
              onChange={(e) => setSettings({
                ...settings,
                dailySummaryTime: e.target.value
              })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={!canEdit}
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            บันทึกการตั้งค่า
          </button>
        </div>
      )}
    </div>
  )
}