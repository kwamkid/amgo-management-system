// app/(admin)/settings/auto-checkout/page.tsx

'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react'
import { PageHeader } from '@/components/shared'

export default function AutoCheckoutSettingsPage() {
  const { userData } = useAuth()
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{
    processed: number
    errors: string[]
    timestamp: string
  } | null>(null)

  const canManage = userData?.role === 'admin'

  const handleTestAutoCheckout = async () => {
    try {
      setTesting(true)
      setResult(null)

      const response = await fetch('/api/cron/auto-checkout', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        throw new Error(data.message || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      console.error('Test error:', error)
      alert(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
    } finally {
      setTesting(false)
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-4xl">
        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>ไม่มีสิทธิ์เข้าถึงหน้านี้</AlertTitle>
          <AlertDescription>
            เฉพาะ Admin เท่านั้น
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="เช็คเอาท์อัตโนมัติ"
        description="ตั้งค่าและทดสอบระบบปิดกะให้คนที่ลืมเช็คเอาท์"
        icon={Clock}
      />

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-900">
              <p className="font-medium">เกี่ยวกับ Auto-Checkout</p>
              <ul className="space-y-1 text-blue-800">
                <li>• ระบบจะทำงานทุกวันตอน 23:59 อัตโนมัติ</li>
                <li>• เช็คเอาท์พนักงานที่ลืมเช็คเอาท์เกิน 12 ชั่วโมง</li>
                <li>• ใช้เวลาเช็คเอาท์ตามกะ (ถ้ามี) หรือ default 18:00</li>
                <li>• HR สามารถแก้ไขเวลาเช็คเอาท์ย้อนหลังได้ในหน้า Pending</li>
                <li>• บันทึก edit history ทุกครั้งที่มีการแก้ไข</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cron Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Cron Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Daily Auto-Checkout</p>
              <p className="text-sm text-gray-600 mt-1">
                Schedule: <code className="bg-gray-200 px-2 py-0.5 rounded">59 23 * * *</code>
              </p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Cron job ต้องตั้งค่าใน <code className="bg-yellow-100 px-1.5 py-0.5 rounded">vercel.json</code> หรือ external cron service
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            ทดสอบ Auto-Checkout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            กดปุ่มด้านล่างเพื่อรัน Auto-Checkout ทันที (ทดสอบเท่านั้น)
          </p>

          <Button
            onClick={handleTestAutoCheckout}
            disabled={testing}
            size="lg"
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังประมวลผล...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                รัน Auto-Checkout ทันที
              </>
            )}
          </Button>

          {/* Results */}
          {result && (
            <div className="space-y-3 mt-6">
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">สำเร็จ</p>
                  <p className="text-sm text-green-700">
                    ประมวลผล {result.processed} รายการ
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <Alert variant="error">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>มีข้อผิดพลาด ({result.errors.length} รายการ)</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1 text-sm">
                      {result.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-xs text-gray-500 text-center">
                Timestamp: {new Date(result.timestamp).toLocaleString('th-TH')}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Endpoint Card */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
            <div className="text-gray-600">GET/POST</div>
            <div className="text-gray-900">/api/cron/auto-checkout</div>
          </div>

          <div className="text-sm text-gray-600">
            <p className="mb-2"><strong>Headers:</strong></p>
            <code className="block p-3 bg-gray-50 rounded">
              Authorization: Bearer YOUR_CRON_SECRET
            </code>
          </div>

          <div className="text-xs text-gray-500 mt-4">
            💡 ตั้งค่า CRON_SECRET ใน environment variables เพื่อความปลอดภัย
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
