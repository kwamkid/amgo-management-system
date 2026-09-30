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
  X
} from 'lucide-react'
import { PageHeader } from '@/components/shared'
import { Input, Alert, Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Progress, type CardTone } from '@/components/aoo'
const CONFIRMATION_TEXT = 'DELETE ALL DATA'

interface DataCollection {
  name: string
  collection: string
  icon: any
  count?: number
  tone: CardTone
}

const DATA_COLLECTIONS: DataCollection[] = [
  { name: 'Check-ins', collection: 'checkins', icon: CheckCircle, tone: 'success' },
  { name: 'Leaves', collection: 'leaves', icon: Calendar, tone: 'sky' },
  { name: 'Locations', collection: 'locations', icon: MapPin, tone: 'accent' },
  { name: 'Invite Links', collection: 'inviteLinks', icon: Shield, tone: 'grape' },
  { name: 'Influencers', collection: 'influencers', icon: Users, tone: 'pink' },
  { name: 'Campaigns', collection: 'campaigns', icon: FileX, tone: 'warning' },
  { name: 'Brands', collection: 'brands', icon: Database, tone: 'info' },
  { name: 'Products', collection: 'products', icon: Database, tone: 'plum' },
  { name: 'Submissions', collection: 'submissions', icon: FileX, tone: 'warning' },
  { name: 'Settings', collection: 'settings', icon: Database, tone: 'muted' },
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

  // ⛔ ปุ่มนี้ถูกปิดไว้ตั้งแต่ย้ายมา Supabase
  //
  // ของเดิมมันลบ collection บน Firestore ซึ่งตอนนี้เป็นแค่ข้อมูลสำรอง
  // กดแล้วจะไม่มีอะไรเกิดขึ้นกับระบบจริง แต่จะทำลายชุดสำรองทิ้ง
  //
  // ส่วนถ้าจะให้ลบข้อมูลจริงบน Supabase — ยังไม่ทำ เพราะข้อมูลตอนนี้
  // เป็นของจริงแล้ว (เช็คอิน 82,290 ชม. · ใบลา 299 ใบ · จุดส่ง 3,479 จุด)
  // เครื่องมือแบบนี้เขียนไว้ตอนฐานข้อมูลยังเป็นของทดสอบ
  //
  // ต้องการล้างข้อมูลจริงเมื่อไหร่ค่อยทำใหม่แบบเลือกเป็นตาราง ๆ พร้อมสำรองก่อน
  const handleDeleteAllData = async () => {
    showToast(
      'ปิดการใช้งานไว้ — ระบบย้ายมา Supabase แล้ว ปุ่มนี้ลบได้แค่ข้อมูลสำรองบน Firebase',
      'error'
    )
    return
  }

  const handleDeleteAllDataLegacy = async () => {
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
      'คุณกำลังจะลบข้อมูลทั้งหมดในระบบ ยกเว้น:\n' +
      '- ข้อมูลผู้ใช้\n' +
      '- Discord Webhook URLs\n\n' +
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
          throw new Error('ปิดการใช้งานแล้ว')
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
      <div className="max-w-4xl">
        <Alert tone="error" title="ไม่มีสิทธิ์เข้าถึง">
          เฉพาะ Admin เท่านั้นที่สามารถเข้าถึงหน้านี้ได้
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="ลบข้อมูลทั้งหมด"
        description="ลบข้อมูลทั้งหมดในระบบ ยกเว้นข้อมูลผู้ใช้"
        icon={Trash2}
      />

      {/* Warning */}
      <Alert tone="error" title="⚠️ คำเตือน! การกระทำนี้ไม่สามารถย้อนกลับได้">
        <div className="space-y-2">
          <p>การลบข้อมูลจะทำให้:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>ข้อมูลการเช็คอิน/เอาท์ทั้งหมดถูกลบ</li>
            <li>ข้อมูลการลาทั้งหมดถูกลบ</li>
            <li>ข้อมูลสถานที่ทำงานทั้งหมดถูกลบ</li>
            <li>ข้อมูล Influencer และ Campaign ทั้งหมดถูกลบ</li>
            <li>ข้อมูล Invite Links ทั้งหมดถูกลบ</li>
            <li>การตั้งค่าระบบถูกลบ (ยกเว้น Discord Webhook URLs)</li>
          </ul>
          <p className="font-semibold text-green-600 mt-2">
            ✅ ข้อมูลที่จะไม่ถูกลบ:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4 text-green-600">
            <li>ข้อมูลผู้ใช้ทั้งหมด</li>
            <li>Discord Webhook URLs ที่ตั้งค่าไว้</li>
          </ul>
          <p className="font-semibold text-red-600 mt-2">
            ⚠️ ผู้ใช้จะต้องสร้างข้อมูลสถานที่ใหม่ก่อนจึงจะสามารถเช็คอินได้
          </p>
        </div>
      </Alert>

      {/* Data Collections */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={Database} tone="danger">ข้อมูลที่จะถูกลบ</CardTitle>
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
                <Card
                  key={collection.collection}
                  padding={12}
                  className={`flex items-center gap-3 ${isDeleted ? 'opacity-50' : ''}`}
                >
                  <span className="aoo-title-icon" data-tone={isDeleted ? 'muted' : collection.tone}>
                    {isDeleted ? <X size={20} /> : <Icon size={20} />}
                  </span>
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
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation */}
      <Card padding={0}>
        <CardHeader>
          <CardTitle icon={AlertTriangle} tone="danger">ยืนยันการลบข้อมูล</CardTitle>
          <CardDescription>
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
          
          <Button onClick={handleDeleteAllData} disabled={confirmText !== CONFIRMATION_TEXT} loading={isDeleting} variant="danger" icon="Trash2" className="w-full" size="lg">
            {isDeleting ? 'กำลังลบข้อมูล...' : 'ลบข้อมูลทั้งหมด'}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {isDeleting && deletedCollections.length > 0 && (
        <Card padding={0}>
          <CardHeader>
            <CardTitle icon={Trash2} tone="danger">ความคืบหน้า</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>ลบแล้ว</span>
                <span>{deletedCollections.length} / {DATA_COLLECTIONS.length}</span>
              </div>
              <Progress value={deletedCollections.length} max={DATA_COLLECTIONS.length} tone="danger" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}