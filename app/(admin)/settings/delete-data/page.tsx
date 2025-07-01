// app/(admin)/settings/delete-data/page.tsx

'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useRouter } from 'next/navigation'
import { 
  Trash2, 
  AlertTriangle, 
  Shield,
  Database,
  FileX,
  Users,
  MapPin,
  Calendar,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { gradients } from '@/lib/theme/colors'
import { deleteAllData } from '@/lib/services/deleteService'

const CONFIRMATION_TEXT = 'DELETE ALL DATA'

interface DataCollection {
  name: string
  collection: string
  icon: any
  count?: number
  color: string
}

const DATA_COLLECTIONS: DataCollection[] = [
  { name: 'Check-ins', collection: 'checkins', icon: CheckCircle, color: 'text-green-600' },
  { name: 'Leaves', collection: 'leaves', icon: Calendar, color: 'text-blue-600' },
  { name: 'Locations', collection: 'locations', icon: MapPin, color: 'text-red-600' },
  { name: 'Invite Links', collection: 'inviteLinks', icon: Shield, color: 'text-purple-600' },
  { name: 'Influencers', collection: 'influencers', icon: Users, color: 'text-pink-600' },
  { name: 'Campaigns', collection: 'campaigns', icon: FileX, color: 'text-orange-600' },
  { name: 'Brands', collection: 'brands', icon: Database, color: 'text-indigo-600' },
  { name: 'Products', collection: 'products', icon: Database, color: 'text-teal-600' },
  { name: 'Submissions', collection: 'submissions', icon: FileX, color: 'text-yellow-600' },
  { name: 'Settings', collection: 'settings', icon: Database, color: 'text-gray-600' },
]

export default function DeleteAllDataPage() {
  const { userData } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletedCollections, setDeletedCollections] = useState<string[]>([])

  // Check if user is admin
  const isAdmin = userData?.role === 'admin'

  const handleDeleteAllData = async () => {
    if (!isAdmin) {
      showToast('คุณไม่มีสิทธิ์ในการลบข้อมูล', 'error')
      return
    }

    if (confirmText !== CONFIRMATION_TEXT) {
      showToast('กรุณาพิมพ์ข้อความยืนยันให้ถูกต้อง', 'error')
      return
    }

    const finalConfirm = confirm(
      '⚠️ คำเตือนสุดท้าย!\n\n' +
      'คุณกำลังจะลบข้อมูลทั้งหมดในระบบ ยกเว้นข้อมูลผู้ใช้\n' +
      'การกระทำนี้ไม่สามารถย้อนกลับได้!\n\n' +
      'คุณแน่ใจหรือไม่?'
    )

    if (!finalConfirm) return

    try {
      setIsDeleting(true)
      setDeletedCollections([])

      // Delete each collection
      for (const collection of DATA_COLLECTIONS) {
        try {
          await deleteAllData(collection.collection)
          setDeletedCollections(prev => [...prev, collection.collection])
          showToast(`ลบข้อมูล ${collection.name} สำเร็จ`, 'success')
        } catch (error) {
          console.error(`Error deleting ${collection.name}:`, error)
          showToast(`ไม่สามารถลบข้อมูล ${collection.name} ได้`, 'error')
        }
      }

      showToast('ลบข้อมูลทั้งหมดสำเร็จ!', 'success')
      
      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
      
    } catch (error) {
      console.error('Error deleting data:', error)
      showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>ไม่มีสิทธิ์เข้าถึง</AlertTitle>
          <AlertDescription>
            เฉพาะ Admin เท่านั้นที่สามารถเข้าถึงหน้านี้ได้
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ลบข้อมูลทั้งหมด</h1>
        <p className="text-gray-600 mt-1">
          ลบข้อมูลทั้งหมดในระบบ ยกเว้นข้อมูลผู้ใช้
        </p>
      </div>

      {/* Warning */}
      <Alert variant="error" className="border-2 border-red-600">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-lg">⚠️ คำเตือน! การกระทำนี้ไม่สามารถย้อนกลับได้</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>การลบข้อมูลจะทำให้:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>ข้อมูลการเช็คอิน/เอาท์ทั้งหมดถูกลบ</li>
            <li>ข้อมูลการลาทั้งหมดถูกลบ</li>
            <li>ข้อมูลสถานที่ทำงานทั้งหมดถูกลบ</li>
            <li>ข้อมูล Influencer และ Campaign ทั้งหมดถูกลบ</li>
            <li>ข้อมูล Invite Links ทั้งหมดถูกลบ</li>
            <li>การตั้งค่าระบบทั้งหมดถูกลบ</li>
          </ul>
          <p className="font-semibold text-red-600">
            ⚠️ ข้อมูลผู้ใช้จะไม่ถูกลบ แต่ผู้ใช้จะต้องสร้างข้อมูลสถานที่ใหม่ก่อนจึงจะสามารถเช็คอินได้
          </p>
        </AlertDescription>
      </Alert>

      {/* Data Collections */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>ข้อมูลที่จะถูกลบ</CardTitle>
          <CardDescription>
            รายการข้อมูลทั้งหมดที่จะถูกลบออกจากระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {DATA_COLLECTIONS.map((collection) => {
              const Icon = collection.icon
              const isDeleted = deletedCollections.includes(collection.collection)
              
              return (
                <div
                  key={collection.collection}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isDeleted 
                      ? 'bg-gray-50 border-gray-200 opacity-50' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    isDeleted ? 'bg-gray-100' : 'bg-red-50'
                  }`}>
                    {isDeleted ? (
                      <X className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Icon className={`w-5 h-5 ${collection.color}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'
                    }`}>
                      {collection.name}
                    </p>
                    {isDeleted && (
                      <p className="text-xs text-gray-400">ลบแล้ว</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation */}
      <Card className={`border-2 border-red-600 bg-gradient-to-r ${gradients.errorLight}`}>
        <CardHeader>
          <CardTitle className="text-red-900">ยืนยันการลบข้อมูล</CardTitle>
          <CardDescription className="text-red-700">
            พิมพ์ "{CONFIRMATION_TEXT}" เพื่อยืนยันการลบข้อมูลทั้งหมด
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder={CONFIRMATION_TEXT}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="text-center text-lg font-mono"
              disabled={isDeleting}
            />
          </div>
          
          <Button
            onClick={handleDeleteAllData}
            disabled={confirmText !== CONFIRMATION_TEXT || isDeleting}
            className={`w-full bg-gradient-to-r ${gradients.error} text-white`}
            size="lg"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                กำลังลบข้อมูล...
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5 mr-2" />
                ลบข้อมูลทั้งหมด
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {isDeleting && deletedCollections.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>ความคืบหน้า</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>ลบแล้ว</span>
                <span>{deletedCollections.length} / {DATA_COLLECTIONS.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(deletedCollections.length / DATA_COLLECTIONS.length) * 100}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}