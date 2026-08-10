'use client'

// หน้าโปรไฟล์ของตัวเอง
//
// รวมสิ่งที่พนักงานต้องเห็นเกี่ยวกับตัวเองไว้ที่เดียว: ตัวตน · การเชื่อมต่อ · การทำงาน
// สองอย่างที่ทำได้จากหน้านี้คือ ดึงรูปจาก LINE ใหม่ กับ เชื่อมต่อ Discord

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { PageHeader, StatusBadge } from '@/components/shared'
import UserAvatar from '@/components/shared/UserAvatar'
import { Button } from '@/components/aoo'
import { User as UserIcon, MessageSquare, RefreshCw, Check } from 'lucide-react'
import TechLoader from '@/components/shared/TechLoader'

const EMPLOYMENT_TYPE: Record<string, string> = {
  monthly: 'รายเดือน',
  daily: 'รายวัน',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{children}</span>
    </div>
  )
}

const thaiDate = (d: Date | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

export default function ProfilePage() {
  const { userData, loading } = useAuth()
  const { showToast } = useToast()

  const [syncing, setSyncing] = useState(false)
  // เปลี่ยนค่านี้เพื่อบังคับให้เบราว์เซอร์โหลดรูปใหม่ ไม่งั้นมันใช้ของในแคช
  const [photoVersion, setPhotoVersion] = useState(0)

  if (loading) return <TechLoader />
  if (!userData) return null

  const handleResync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/users/sync-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.id, refetch: true }),
      })
      if (!res.ok) throw new Error()

      setPhotoVersion((v) => v + 1)
      showToast('ดึงรูปจาก LINE ใหม่แล้ว', 'success')
    } catch {
      showToast('ดึงรูปใหม่ไม่สำเร็จ ลองอีกครั้ง', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const discordLinked = !!userData.discordUserId

  return (
    <>
      <PageHeader title="โปรไฟล์ของฉัน" description="ข้อมูลส่วนตัวและการเชื่อมต่อ" icon={UserIcon} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── รูป ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <div className="flex justify-center">
            <UserAvatar
              key={photoVersion}
              name={userData.fullName}
              userId={userData.id}
              size="xl"
            />
          </div>

          <h2 className="mt-4 font-semibold text-gray-900">{userData.fullName}</h2>
          {userData.lineDisplayName && (
            <p className="text-sm text-gray-500">{userData.lineDisplayName}</p>
          )}

          <div className="mt-3 flex justify-center">
            <StatusBadge status={userData.role} />
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="mt-5 w-full"
            disabled={syncing}
            onClick={handleResync}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'กำลังดึงรูป...' : 'ดึงรูปจาก LINE ใหม่'}
          </Button>
          <p className="mt-2 text-xs text-gray-500">กดเมื่อเปลี่ยนรูปโปรไฟล์ใน LINE แล้ว</p>
        </div>

        {/* ── ข้อมูล ─────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-2 font-semibold text-gray-900">ข้อมูลส่วนตัว</h3>
            <Row label="ชื่อ-นามสกุล">{userData.fullName}</Row>
            <Row label="ชื่อใน LINE">{userData.lineDisplayName || '—'}</Row>
            <Row label="เบอร์โทร">
              <span className="font-mono tabular-nums">{userData.phone || '—'}</span>
            </Row>
            <Row label="วันเกิด">
              {userData.birthDate ? thaiDate(new Date(userData.birthDate)) : '—'}
            </Row>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-2 font-semibold text-gray-900">การเชื่อมต่อ</h3>

            <div className="flex items-center justify-between border-b border-gray-100 py-2.5">
              <span className="text-sm text-gray-500">LINE</span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                <Check size={14} /> เชื่อมต่อแล้ว
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-500">Discord</span>
              {discordLinked ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                  <Check size={14} />
                  {userData.discordUsername || 'เชื่อมต่อแล้ว'}
                </span>
              ) : (
                <a href="/api/auth/discord/start">
                  <Button variant="secondary" size="sm">
                    <MessageSquare size={14} /> เชื่อมต่อ Discord
                  </Button>
                </a>
              )}
            </div>

            {discordLinked && (
              <p className="mt-1 text-xs text-gray-500">
                ระบบจะ mention คุณเวลาแจ้งวันเกิด เตือนลืมเช็คเอาท์ และแจ้งผลอนุมัติลา
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-2 font-semibold text-gray-900">การทำงาน</h3>
            <Row label="สถานะ">
              <StatusBadge status={userData.employmentStatus} />
            </Row>
            <Row label="ประเภทการจ้าง">
              {EMPLOYMENT_TYPE[userData.employmentType ?? ''] ?? '—'}
            </Row>
            <Row label="วันเริ่มงาน">
              {thaiDate(userData.startDate)}
              {userData.startDate && !userData.startDateVerified && (
                <span className="ml-2 text-xs font-normal text-amber-600">รอ HR ยืนยัน</span>
              )}
            </Row>
            {userData.endDate && <Row label="วันสุดท้าย">{thaiDate(userData.endDate)}</Row>}
            <Row label="ทำงานสัปดาห์ละ">
              {userData.daysPerWeek ? `${userData.daysPerWeek} วัน` : '—'}
            </Row>
            <Row label="ทำงานที่บ้านได้">{userData.wfhEligible ? 'ได้' : 'ไม่ได้'}</Row>
          </div>
        </div>
      </div>
    </>
  )
}
