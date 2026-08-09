'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

export default function FixClaimsPage() {
  const { userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Refresh current user's claims
  const handleRefreshMyClaims = async () => {
    if (!userData?.id) return
    
    setLoading(true)
    setMessage('')
    setError('')

    try {
      // Call API to update claims
      const response = await fetch('/api/users/update-claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: userData.id })
      })

      if (!response.ok) {
        throw new Error('Failed to update claims')
      }

      const data = await response.json()
      
      // Force token refresh
      const currentUser = auth.currentUser
      if (currentUser) {
        await currentUser.getIdToken(true)
        setMessage(`✅ อัพเดทสิทธิ์สำเร็จ! Role: ${data.claims.role}`)
        
        // Reload page after 2 seconds
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (err) {
      setError('❌ เกิดข้อผิดพลาดในการอัพเดทสิทธิ์')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Batch update all users' claims (Admin only)
  const handleBatchUpdate = async () => {
    if (userData?.role !== 'admin') {
      setError('คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้')
      return
    }

    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/users/update-claims', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to batch update claims')
      }

      const data = await response.json()
      setMessage(`✅ ${data.message}`)
    } catch (err) {
      setError('❌ เกิดข้อผิดพลาดในการอัพเดทสิทธิ์ทั้งหมด')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">แก้ไขปัญหาสิทธิ์การใช้งาน</h1>

      {/* Current User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            ข้อมูลสิทธิ์ปัจจุบัน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>ชื่อ:</strong> {userData?.fullName || userData?.lineDisplayName}</p>
            <p><strong>Role ใน Database:</strong> <span className="text-red-600 font-semibold">{userData?.role}</span></p>
            <p><strong>สถานะ:</strong> {userData?.isActive ? '✅ Active' : '❌ Inactive'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Refresh My Claims */}
      <Card>
        <CardHeader>
          <CardTitle>อัพเดทสิทธิ์ของฉัน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="info">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              หากคุณเพิ่งได้รับการอัพเดทสิทธิ์เป็น Admin แต่ยังเข้าใช้งานไม่ได้ ให้กดปุ่มด้านล่างเพื่ออัพเดท
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleRefreshMyClaims}
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                กำลังอัพเดท...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                อัพเดทสิทธิ์ของฉัน
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Admin Only: Batch Update */}
      {userData?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">🔧 Admin Tool: อัพเดทสิทธิ์ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ฟังก์ชันนี้จะอัพเดท custom claims ของผู้ใช้ทั้งหมดในระบบ ใช้เมื่อต้องการแก้ไขปัญหาสิทธิ์เป็นจำนวนมาก
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleBatchUpdate}
              disabled={loading}
              variant="outline"
              className="w-full border-red-500 text-red-600 hover:bg-red-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  กำลังอัพเดททั้งหมด...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  อัพเดทสิทธิ์ผู้ใช้ทั้งหมด
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {message && (
        <Alert variant="success">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}